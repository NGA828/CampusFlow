<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\BuildsOfficeSummaries;
use App\Http\Controllers\Concerns\RespondsJson;
use App\Models\Office;
use App\Models\OfficeEvent;
use App\Models\OfficeServiceWindow;
use App\Models\OfficeTicket;
use App\Exceptions\BusinessRuleException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OfficeController extends Controller
{
    use BuildsOfficeSummaries, RespondsJson;

    /**
     * GET /campus/offices — the shared office availability read.
     *
     * Resident roles may look at the board (it is campus information); taking a ticket is a student
     * verb and lives under /student. Staff get their own operational line view under /staff.
     */
    public function index(Request $request): JsonResponse
    {
        $offices = Office::with('room.floor.building')
            ->where('status', 'active')
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data'    => [
                'offices' => $offices
                    ->map(fn (Office $office) => $this->officeSummary($office, $request->user()?->id))
                    ->values()
                    ->all(),
            ],
        ]);
    }

    /**
     * GET /student/offices/{office}
     *
     * Everything a student needs before deciding to queue at a desk: today's windows, who is serving,
     * the live line, and their own ticket if they already have one.
     */
    public function show(Request $request, Office $office): JsonResponse
    {
        $summary = $this->officeSummary($office, $request->user()->id);

        $summary['today_in_line'] = OfficeTicket::where('office_id', $office->id)
            ->whereIn('status', ['waiting', 'approaching', 'called', 'in_service'])
            ->whereDate('created_at', now())
            ->orderBy('created_at')
            ->get(['id', 'ticket_number', 'status', 'called_at', 'created_at'])
            ->values()
            ->map(fn (OfficeTicket $ticket, int $index) => [
                'position'      => $index + 1,
                'ticket_number' => $ticket->ticket_number,
                'status'        => $ticket->status,
                'called_at'     => $ticket->called_at?->toIso8601String(),
            ])
            ->values()
            ->all();

        return response()->json(['success' => true, 'data' => $summary]);
    }

    /**
     * Presence at the desk, judged by the office's own radius.
     *
     * Mirrors the queue engine's rule but with one difference that matters to a student: an office may
     * be closed to remote ticketing entirely, in which case a missing fix is refused rather than
     * trusted. There is no silent pass on "we could not tell where you are".
     */
    private function assertNearOffice(Request $request, Office $office): void
    {
        $room = $office->room;
        $payload = $this->officeFixPayload($request);

        if ($payload === null) {
            throw new BusinessRuleException(
                'This office requires you to be on site. Scan the desk code or allow location access.',
                'PROXIMITY_REQUIRED',
            );
        }

        $radius = (float) ($office->check_in_radius_m ?? 75.0);

        if ($payload['qr_room_code'] !== null) {
            if (strcasecmp((string) $payload['qr_room_code'], (string) $room?->code) !== 0) {
                throw new BusinessRuleException(
                    sprintf('That code belongs to %s, not %s.', $payload['qr_room_code'], $room?->code ?? 'this desk'),
                    'WRONG_LOCATION',
                    status: 422,
                    context: ['scanned_room' => $payload['qr_room_code'], 'required_room' => $room?->code],
                );
            }

            return;
        }

        if (! $room || $room->lat === null || $room->lng === null) {
            throw new BusinessRuleException('This office has no location on the map, so proximity cannot be verified. Contact the desk directly.', 'NO_GEOFENCE');
        }

        $distance = $this->metersBetween((float) $payload['lat'], (float) $payload['lng'], (float) $room->lat, (float) $room->lng);

        if ($distance > $radius) {
            throw new BusinessRuleException(sprintf(
                'You are %.0f m from %s — tickets are issued only within %.0f m of the desk.',
                $distance,
                $room->code,
                $radius,
            ), 'OUTSIDE_PROXIMITY', context: ['distance_m' => round($distance, 1), 'radius_m' => $radius]);
        }
    }

    /** @return array{lat: ?float, lng: ?float, qr_room_code: ?string}|null */
    private function officeFixPayload(Request $request): ?array
    {
        $code = $request->input('qr_code') ?? $request->input('payload');

        if (is_string($code) && $code !== '') {
            $node = \App\Models\QrNode::where('code', $code)->first();

            if ($node) {
                return ['lat' => $node->lat === null ? null : (float) $node->lat, 'lng' => $node->lng === null ? null : (float) $node->lng, 'qr_room_code' => $node->room?->code];
            }
        }

        $lat = $request->input('fix.lat') ?? $request->input('lat');
        $lng = $request->input('fix.lng') ?? $request->input('lng');

        if ($lat !== null && $lng !== null) {
            return ['lat' => (float) $lat, 'lng' => (float) $lng, 'qr_room_code' => null];
        }

        $last = \App\Models\UserPosition::where('user_id', $request->user()->id)->first();

        if ($last && $last->lat !== null) {
            return ['lat' => (float) $last->lat, 'lng' => (float) $last->lng, 'qr_room_code' => null];
        }

        return null;
    }

    private function metersBetween(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371000.0;
        $toRadians = deg2rad(1);
        $dLat = ($lat2 - $lat1) * $toRadians;
        $dLng = ($lng2 - $lng1) * $toRadians;
        $a = sin($dLat / 2) ** 2 + cos($lat1 * $toRadians) * cos($lat2 * $toRadians) * sin($dLng / 2) ** 2;

        return 2 * $earthRadius * asin(min(1.0, sqrt($a)));
    }

    /**
     * Take an office ticket.
     */
    public function createTicket(Request $request, Office $office): JsonResponse
    {
        $request->validate([
            'service_type' => 'nullable|string|max:100',
            'subject'      => 'nullable|string|max:255',
            'notes'        => 'nullable|string|max:500',
        ]);

        $user = $request->user();

        // Configuration an administrator set has to bite here, not in the UI: appointment-first desks,
        // the daily ticket ceiling and the door-radius rule are all enforced at issue time.
        if ($office->requires_appointment) {
            throw new BusinessRuleException(
                'This office serves by appointment only. Book a slot before requesting a ticket.',
                'APPOINTMENT_REQUIRED',
            );
        }

        if ($office->daily_capacity !== null) {
            $issuedToday = OfficeTicket::where('office_id', $office->id)->whereDate('created_at', now())->count();

            if ($issuedToday >= (int) $office->daily_capacity) {
                throw new BusinessRuleException(
                    sprintf('This desk has issued all %d of today’s tickets. Come back tomorrow or check the office hours.', (int) $office->daily_capacity),
                    'OFFICE_CLOSED_TODAY',
                    status: 409,
                    context: ['daily_capacity' => (int) $office->daily_capacity, 'issued_today' => $issuedToday],
                );
            }
        }

        if ($office->requires_proximity_to_request) {
            $office->loadMissing('room.floor.building');
            $this->assertNearOffice($request, $office);
        }

        return DB::transaction(function () use ($request, $user, $office) {
            // Lock office to prevent race conditions in ticket numbering
            $lockedOffice = Office::where('id', $office->id)->lockForUpdate()->first();

            // A retry must not mint a second ticket, so a repeated Idempotency-Key replays the first
            // answer instead of running the issue path again.
            $clientKey = $request->header('Idempotency-Key');

            if ($clientKey) {
                $replay = OfficeTicket::where('idempotency_key', $clientKey)->first();

                if ($replay) {
                    return response()->json([
                        'success' => true,
                        'message' => 'Office ticket replayed',
                        'data'    => ['ticket' => $replay->toApiArray(), 'replayed' => true],
                    ]);
                }
            }

            $existing = OfficeTicket::where('office_id', $office->id)
                ->where('user_id', $user->id)
                ->whereIn('status', ['waiting', 'called', 'approaching', 'in_service'])
                ->first();

            if ($existing) {
                return response()->json([
                    'success' => false,
                    'code'    => 'DUPLICATE_TICKET',
                    'message' => 'You already have an active ticket for this office',
                    'data'    => ['ticket' => $existing->toApiArray()],
                ], 409);
            }

            $prefix = strtoupper(substr($office->code ?? 'OFF', 0, 3));
            $todayCount = OfficeTicket::where('office_id', $office->id)
                ->whereDate('created_at', now()->today())
                ->count();

            $ticketNum = $prefix . '-' . sprintf('%03d', $todayCount + 1);
            $idempotencyKey = $clientKey ?: 'OFFICE-' . $user->id . '-' . $office->id . '-' . Str::random(8);
            $subject = $request->input('subject') ?? $request->input('service_type') ?? 'General Inquiry';

            $ticket = OfficeTicket::create([
                'office_id'       => $office->id,
                'user_id'         => $user->id,
                'ticket_number'   => $ticketNum,
                'subject'         => $subject,
                'status'          => 'waiting',
                'idempotency_key' => $idempotencyKey,
                'notes'           => $request->input('notes'),
            ]);

            OfficeEvent::create([
                'ticket_id'  => $ticket->id,
                'type'       => 'created',
                'metadata'   => ['ticket_number' => $ticketNum, 'user_id' => $user->id],
                'created_at' => now(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Office ticket issued successfully',
                'data'    => $this->officeTicketView($ticket),
            ], 201);
        });
    }

    /**
     * Cancel ticket.
     */
    public function cancelTicket(Request $request, string $ticketId): JsonResponse
    {
        $ticket = OfficeTicket::findOrFail($ticketId);
        $user = $request->user();
        Gate::authorize('cancel', $ticket);

        if ($ticket->isTerminal()) {
            throw new BusinessRuleException('This ticket is already ' . $ticket->status . ' — there is nothing to cancel.', 'INVALID_TRANSITION');
        }

        DB::transaction(function () use ($ticket, $user) {
            $ticket->update([
                'status'       => 'cancelled',
                'cancelled_at' => now(),
                'cancelled_by' => ($ticket->user_id === $user->id) ? 'user' : 'staff',
            ]);

            OfficeEvent::create([
                'ticket_id'  => $ticket->id,
                'type'       => 'cancelled',
                'metadata'   => ['cancelled_by' => $user->id],
                'created_at' => now(),
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Office ticket cancelled',
            'data'    => $this->officeTicketView($ticket->fresh()),
        ]);
    }

    /**
     * Get user's office tickets.
     */
    public function myOfficeTickets(Request $request): JsonResponse
    {
        $tickets = OfficeTicket::where('user_id', $request->user()->id)
            ->with(['office'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data'    => $tickets->map(fn($t) => $t->toApiArray()),
        ]);
    }

    public function showTicket(Request $request, string $id): JsonResponse
    {
        $ticket = OfficeTicket::with('office')->findOrFail($id);
        Gate::authorize('view', $ticket);
        return response()->json(['success' => true, 'data' => $this->officeTicketView($ticket)]);
    }

    public function checkInTicket(Request $request, string $id): JsonResponse
    {
        $ticket = OfficeTicket::with('office')->findOrFail($id);

        // Presence at the office door is a mobile act; the policy says so, and a staff member standing
        // at the desk uses POST /staff/office-tickets/{ticket}/check-in instead.
        Gate::authorize('checkIn', $ticket);

        if (! in_array($ticket->status, ['waiting', 'called', 'approaching'], true)) {
            throw new BusinessRuleException('This ticket cannot be checked in from its current state.', 'INVALID_TRANSITION');
        }
        $ticket->update(['status' => 'in_service', 'service_started_at' => now()]);
        OfficeEvent::create(['ticket_id' => $ticket->id, 'type' => 'checked_in', 'metadata' => ['by' => $request->user()->id], 'created_at' => now()]);

        return response()->json(['success' => true, 'data' => $this->officeTicketView($ticket->fresh('office'))]);
    }

    public function approachingTicket(Request $request, string $id): JsonResponse
    {
        $ticket = OfficeTicket::findOrFail($id);
        Gate::authorize('approaching', $ticket);
        abort_unless($ticket->status === 'waiting', 422, 'Only a waiting ticket can be marked as approaching');
        $ticket->update(['status' => 'approaching']);
        OfficeEvent::create(['ticket_id' => $ticket->id, 'type' => 'approaching', 'metadata' => [], 'created_at' => now()]);

        return response()->json(['success' => true, 'data' => $this->officeTicketView($ticket->fresh('office'))]);
    }

    /**
     * GET /student/office-tickets/{id}/history
     *
     * The student's own service record for one ticket — issued, called, approached, served, missed.
     * Kept separate from the office line (which is staff data) for the same reason the two screens are
     * separate: this answers "what happened to me", not "who is next".
     */
    public function ticketHistory(Request $request, string $id): JsonResponse
    {
        $ticket = OfficeTicket::findOrFail($id);
        Gate::authorize('view', $ticket);

        $events = OfficeEvent::where('ticket_id', $ticket->id)
            ->orderBy('created_at')
            ->get(['id', 'type', 'metadata', 'created_at'])
            ->map(fn ($event) => [
                'id'         => $event->id,
                'type'       => $event->type,
                'metadata'   => $event->metadata,
                'created_at' => $event->created_at?->toIso8601String(),
            ]);

        return response()->json(['success' => true, 'data' => ['events' => $events]]);
    }

    /**
     * What a student may see about their own desk ticket.
     *
     * `expected_window` and the check-in countdown are read from the live office summary rather than
     * hard-coded, so the number on the screen and the number the desk works from are the same number.
     */
}
