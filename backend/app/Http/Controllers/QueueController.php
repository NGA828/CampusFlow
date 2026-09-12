<?php

namespace App\Http\Controllers;

use App\Exceptions\BusinessRuleException;
use App\Http\Controllers\Concerns\BuildsQueueViews;
use App\Models\Geofence;
use App\Models\QrNode;
use App\Models\QueueEvent;
use App\Models\QueueTicket;
use App\Models\Room;
use App\Models\RoomQueue;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

class QueueController extends Controller
{
    use BuildsQueueViews;

    /**
     * Get queue details for a room.
     */
    public function show(Room $room): JsonResponse
    {
        $queue = RoomQueue::where('room_id', $room->id)->first();

        if (!$queue) {
            return response()->json([
                'success' => false,
                'message' => 'Room does not have an active queue manager enabled',
            ], 404);
        }

        $activeTicketsCount = QueueTicket::where('queue_id', $queue->id)
            ->whereIn('status', ['waiting', 'called', 'navigating', 'checked_in'])
            ->count();

        $myTicket = null;
        if (auth()->check()) {
            $myTicket = QueueTicket::where('queue_id', $queue->id)
                ->where('user_id', auth()->id())
                ->whereIn('status', ['waiting', 'called', 'navigating', 'checked_in'])
                ->first();
        }

        return response()->json([
            'success' => true,
            'data'    => [
                'queue'             => $queue->toApiArray(),
                'room'              => $room->toApiArray(),
                'active_waiting'    => $activeTicketsCount,
                'current_occupancy' => $queue->current_count,
                'max_capacity'      => $queue->max_capacity,
                'my_ticket'         => $myTicket ? $myTicket->toApiArray() : null,
            ],
        ]);
    }

    /**
     * Join room queue with strict concurrency and idempotency.
     */
    /**
     * POST /student/rooms/{room}/queue/join — take a place in the line for a room.
     *
     * The room is the natural thing to point at ("I am standing outside B204"), so both join routes
     * resolve to one queue and then share `issueTicket()`. Two join implementations is how a product
     * ends up enforcing capacity on one screen and not the other.
     */
    public function join(Request $request, Room $room): JsonResponse
    {
        $queue = RoomQueue::where('room_id', $room->id)->first();

        if (! $queue) {
            throw new BusinessRuleException('This room has no queue configured.', 'NO_QUEUE');
        }

        return $this->issueTicket($request, $queue);
    }

    /** POST /student/queues/{queue}/tickets — the same act, addressed by queue id. */
    public function joinByQueueId(Request $request, string $queue): JsonResponse
    {
        $model = RoomQueue::with('room.floor.building')->findOrFail($queue);

        return $this->issueTicket($request, $model);
    }

    /**
     * GET /campus/queues — every line a resident may look at, as that resident sees it.
     *
     * The *board* is shared campus truth (a staff member reading it for a report and a student choosing
     * where to stand are reading the same numbers); what differs is what each of them may then do, and
     * that lives on the action routes, not here.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $queues = RoomQueue::with('room.floor.building')
            ->whereHas('room', function ($query) {
                $query->where('status', '!=', 'archived');
            })
            ->get()
            ->filter(fn (RoomQueue $queue) => Gate::allows('view', $queue))
            ->map(fn (RoomQueue $queue) => $this->queuePayload($queue, $user?->id))
            ->sortBy(fn ($a, $b) => [$a['building_code'], $a['room_code']] <=> [$b['building_code'], $b['room_code']])
            ->values();

        return $this->ok([
            'queues'        => $queues,
            'open_count'    => $queues->where('is_active', true)->count(),
            'generated_at'  => now()->toIso8601String(),
        ]);
    }

    /** GET /campus/queues/{id} — one line, same projection as the board. */
    public function showById(Request $request, string $id): JsonResponse
    {
        $queue = RoomQueue::with('room.floor.building')->findOrFail($id);
        Gate::authorize('view', $queue);

        return $this->ok($this->queuePayload($queue, $request->user()?->id));
    }

    /**
     * GET /student/queue-tickets — this student's places in lines, present and past.
     *
     * Deliberately scoped to the caller: a student may see their own history, and never anybody else's,
     * which is why there is no `user_id` parameter to pass here.
     */
    public function myTickets(Request $request): JsonResponse
    {
        $tickets = QueueTicket::with('queue.room.floor.building')
            ->where('user_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        return $this->ok([
            'tickets' => $tickets->map(fn (QueueTicket $ticket) => $this->ticketPayload($ticket))->values(),
        ]);
    }

    /**
     * Issue a place in a line.
     *
     * The order of the checks is the whole point of this method, so it lives in one place and both join
     * routes funnel through it. First the policy decides whether this caller may queue at all — role,
     * permission, platform and room access, none of which a client is allowed to answer for the server.
     * Then the queue's own configuration decides whether the line is open. Then the door decides whether
     * they are standing at it. Then the idempotency key decides whether this is really a new request or a
     * retry that must not mint a second ticket. Only after all of that is capacity counted, so a full
     * line cannot be topped up by a client that hid the button but kept the route.
     */
    private function issueTicket(Request $request, RoomQueue $queue): JsonResponse
    {
        $user = $request->user();

        Gate::authorize('join', $queue);

        if (! $queue->is_open) {
            throw new BusinessRuleException(
                'This line is not taking tickets right now.',
                'QUEUE_CLOSED',
                status: 409,
                context: ['queue_id' => $queue->id, 'room_code' => $queue->room?->code],
            );
        }

        // A scan of this room's own plaque is the strongest proof of where the student is; a fix is the
        // fallback. Neither is optional when the queue demands the door.
        $scanned = $this->resolveJoinQr($request, $queue);

        if (! $scanned) {
            $this->assertProximityToJoin($request, $queue);
        }

        $clientKey = $request->header('Idempotency-Key') ?: $request->input('idempotency_key');
        $fix = $this->requestFix($request);

        return DB::transaction(function () use ($request, $queue, $user, $clientKey, $fix, $scanned) {
            $locked = RoomQueue::where('id', $queue->id)->lockForUpdate()->first();

            // A retry with a key we have seen replays the original answer rather than running the issue
            // path again — the corridor signal that dropped the response is the same one that would
            // happily produce a second place in line.
            if ($clientKey) {
                $replay = QueueTicket::where('idempotency_key', $clientKey)->first();

                if ($replay) {
                    if ($replay->user_id !== $user->id) {
                        throw new BusinessRuleException(
                            'That request key has already been used for another ticket.',
                            'IDEMPOTENCY_CONFLICT',
                        );
                    }

                    return $this->ok($this->ticketPayload($replay->loadMissing('queue.room.floor.building')));
                }
            }

            $holding = QueueTicket::where('queue_id', $locked->id)
                ->where('user_id', $user->id)
                ->whereIn('status', ['waiting', 'called', 'navigating', 'checked_in'])
                ->first();

            if ($holding && ! (bool) ($locked->allow_multiple_active_tickets ?? false)) {
                throw new BusinessRuleException(
                    'You are already in this line — check your ticket instead of joining again.',
                    'DUPLICATE_TICKET',
                    status: 409,
                    context: ['ticket_id' => $holding->id, 'position' => $holding->position],
                );
            }

            if ($locked->max_capacity) {
                $inLine = QueueTicket::where('queue_id', $locked->id)
                    ->whereNotIn('status', ['completed', 'cancelled', 'no_show'])
                    ->count();

                if ($inLine >= (int) $locked->max_capacity) {
                    throw new BusinessRuleException(
                        sprintf('This line is full at %d tickets. Try again later or use another desk.', (int) $locked->max_capacity),
                        'QUEUE_FULL',
                        status: 409,
                        context: ['max_capacity' => (int) $locked->max_capacity, 'in_line' => $inLine],
                    );
                }
            }

            $position = (int) QueueTicket::where('queue_id', $locked->id)
                ->whereNotIn('status', ['completed', 'cancelled', 'no_show'])
                ->max('position') + 1;

            $ticket = QueueTicket::create([
                'queue_id'        => $locked->id,
                'user_id'         => $user->id,
                'position'        => $position,
                'status'          => 'waiting',
                'idempotency_key' => $clientKey ?: 'QUEUE-' . $user->id . '-' . $locked->id . '-' . Str::random(10),
                'joined_lat'      => $fix['lat'] ?? $scanned['lat'] ?? null,
                'joined_lng'      => $fix['lng'] ?? $scanned['lng'] ?? null,
                'join_source'     => $scanned ? 'qr' : 'manual',
            ]);

            QueueEvent::create([
                'ticket_id'  => $ticket->id,
                'type'       => 'joined',
                'metadata'   => [
                    'position'    => $position,
                    'source'      => $scanned ? 'qr' : 'manual',
                    'device'      => $request->header('X-CampusFlow-Client'),
                    'qr_node'     => $scanned['code'] ?? null,
                ],
                'created_at' => now(),
            ]);

            return $this->ok($this->ticketPayload($ticket->load('queue.room.floor.building')), 201);
        });
    }

    /**
     * Verify a scanned plaque against the queue's room, if the client supplied one.
     *
     * Returns the matched node, or null when no code was sent. A code that does not resolve, or that
     * belongs to another room, is a refusal — never a silent downgrade to "no proof given", because the
     * UI has already told the student they are at the door.
     *
     * @return array{code: string, lat: float|null, lng: float|null}|null
     */
    private function resolveJoinQr(Request $request, RoomQueue $queue): ?array
    {
        $payload = $request->input('qr_code') ?: $request->input('code');

        if (! $payload) {
            return null;
        }

        $node = QrNode::where('code', $payload)->where('is_active', true)->first();

        if (! $node) {
            throw new BusinessRuleException(
                'That code is not a CampusFlow anchor, or it has been rotated.',
                'QR_UNKNOWN',
                status: 422,
            );
        }

        if ($queue->room_id && $node->room_id !== $queue->room_id) {
            throw new BusinessRuleException(
                'That code belongs to a different room — stand at the door of the room you want to join.',
                'WRONG_LOCATION',
                status: 422,
                context: ['room_code' => $queue->room?->code],
            );
        }

        return ['code' => $node->code, 'lat' => $node->lat === null ? null : (float) $node->lat, 'lng' => $node->lng === null ? null : (float) $node->lng];
    }
    public function ticketDetails(Request $request, string $id): JsonResponse
    {
        $ticket = QueueTicket::with('queue.room.floor.building')->findOrFail($id);
        Gate::authorize('view', $ticket);
        return response()->json(['success' => true, 'data' => $this->ticketPayload($ticket)]);
    }

    public function cancelTicket(Request $request, string $id): JsonResponse
    {
        $ticket = QueueTicket::with('queue')->findOrFail($id);
        Gate::authorize('cancel', $ticket);
        abort_if($ticket->isTerminal(), 422, 'This ticket is already closed');
        $ticket->update(['status' => 'cancelled', 'cancelled_at' => now(), 'cancelled_by' => $ticket->user_id === $request->user()->id ? 'user' : 'staff']);
        QueueEvent::create(['ticket_id' => $ticket->id, 'type' => 'cancelled', 'metadata' => ['cancelled_by' => $request->user()->id], 'created_at' => now()]);
        return response()->json(['success' => true, 'data' => $this->ticketPayload($ticket->fresh('queue.room.floor.building'))]);
    }

    public function checkInTicket(Request $request, string $id): JsonResponse
    {
        $ticket = QueueTicket::with('queue')->findOrFail($id);

        // The policy decides ownership, that the caller is the ticket's student, and that this client
        // may claim physical presence at all (a browser may not).
        Gate::authorize('checkIn', $ticket);
        $this->assertProximityToCheckIn($request, $ticket);

        if (! in_array($ticket->status, ['waiting', 'called', 'navigating'], true)) {
            throw new BusinessRuleException('This ticket cannot be checked in from its current state.', 'INVALID_TRANSITION');
        }
        $ticket->update(['status' => 'checked_in', 'checked_in_at' => now()]);
        QueueEvent::create(['ticket_id' => $ticket->id, 'type' => 'checked_in', 'metadata' => [], 'created_at' => now()]);
        return response()->json(['success' => true, 'data' => $this->ticketPayload($ticket->fresh('queue.room.floor.building'))]);
    }

    public function setNavigating(Request $request, string $id): JsonResponse
    {
        $ticket = QueueTicket::findOrFail($id);
        Gate::authorize('markNavigating', $ticket);
        abort_unless($ticket->status === 'called', 422, 'Only a called ticket can start navigating');
        $ticket->update(['status' => 'navigating']);
        QueueEvent::create(['ticket_id' => $ticket->id, 'type' => 'navigating', 'metadata' => [], 'created_at' => now()]);
        return response()->json(['success' => true, 'data' => $this->ticketPayload($ticket->fresh('queue.room.floor.building'))]);
    }

    public function proximityCheck(Request $request, string $id): JsonResponse
    {
        $queue = RoomQueue::with('room')->findOrFail($id);

        // The caller must hold a ticket in this queue. Without that this endpoint is a free oracle for
        // "am I within 50 m of the lab?" — presence information a queue exists to keep private.
        $ticket = QueueTicket::where('queue_id', $queue->id)
            ->where('user_id', $request->user()->id)
            ->whereIn('status', ['waiting', 'called', 'navigating', 'checked_in'])
            ->firstOrFail();

        Gate::authorize('proximityCheck', $ticket);

        $fix = $request->validate(['fix.lat' => ['required', 'numeric'], 'fix.lng' => ['required', 'numeric']])['fix'];

        return response()->json([
            'success' => true,
            'data'    => $this->evaluateProximity($queue, (float) $fix['lat'], (float) $fix['lng']),
        ]);
    }

    /**
     * GET /student/queue-tickets/{id}/history — the ticket's own event trail.
     *
     * A student is entitled to the record of what happened to their place in a line: joined, called,
     * expired, admitted, and by whom. It is not the queue's line, and it carries nobody else's rows.
     */
    public function history(Request $request, string $id): JsonResponse
    {
        $ticket = QueueTicket::findOrFail($id);
        Gate::authorize('view', $ticket);

        $events = QueueEvent::where('ticket_id', $ticket->id)
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
     * POST /student/queue-tickets/{id}/leave
     *
     * A student giving up their place (or leaving the room). It mirrors the staff "complete" action
     * and shares its release of the occupied seat, but it is authorised differently: the holder may do
     * it at any time before the service ends, with no operator permission involved.
     */
    public function leaveTicket(Request $request, string $id): JsonResponse
    {
        $ticket = QueueTicket::with('queue')->findOrFail($id);
        Gate::authorize('cancel', $ticket);

        DB::transaction(function () use ($ticket, $request) {
            $wasOccupying = in_array($ticket->status, ['checked_in', 'admitted'], true);

            $ticket->update([
                'status'       => 'cancelled',
                'cancelled_at' => now(),
                'cancelled_by' => 'user',
            ]);

            if ($wasOccupying && $ticket->queue) {
                $queue = RoomQueue::where('id', $ticket->queue_id)->lockForUpdate()->first();
                if ($queue && $queue->current_count > 0) {
                    $queue->decrement('current_count');
                }
            }

            QueueEvent::create([
                'ticket_id'  => $ticket->id,
                'type'       => 'left',
                'metadata'   => ['by' => $request->user()->id],
                'created_at' => now(),
            ]);
        });

        return response()->json(['success' => true, 'data' => $this->ticketPayload($ticket->fresh('queue.room.floor.building'))]);
    }




    /* ─────────────────────────────────────────── proximity rules */

    /**
     * Join-time geofence check, honouring the queue's own configuration.
     *
     * An administrator decides whether a line may be joined remotely (a student starts queuing from
     * the far side of campus) or only from the door. When proximity is required, a fix is mandatory:
     * "no position sent" is a refusal with a code the client can act on, never a silent pass.
     */
    private function assertProximityToJoin(Request $request, RoomQueue $queue): void
    {
        if (! ($queue->join_requires_proximity ?? true)) {
            return;
        }

        $fix = $this->requestFix($request);

        if ($fix === null) {
            throw new BusinessRuleException(
                'Joining this queue requires your location. Scan the room code or allow location access.',
                'PROXIMITY_REQUIRED',
            );
        }

        $verdict = $this->evaluateProximity($queue, $fix['lat'], $fix['lng']);

        if (! $verdict['within']) {
            throw new BusinessRuleException(sprintf(
                'You are %.0f m from %s — this queue accepts joins only within %.0f m.',
                $verdict['distance_m'],
                $queue->room?->code ?? 'this room',
                $verdict['radius_m'],
            ), 'OUTSIDE_PROXIMITY');
        }
    }

    /** Presence for check-in: a fix inside the envelope, or a scan of this room's own anchor. */
    private function assertProximityToCheckIn(Request $request, QueueTicket $ticket): void
    {
        $queue = $ticket->queue;

        if (! $queue || ! ($queue->join_requires_proximity ?? true)) {
            return;
        }

        $fix = $this->requestFix($request);

        if ($fix === null) {
            $code = $request->input('qr_code') ?? $request->input('qr_payload') ?? $request->input('code');

            if (is_string($code) && $code !== '') {
                $node = QrNode::where('code', $code)->where('is_active', true)->first();

                if ($node === null) {
                    throw new BusinessRuleException('Unknown or revoked QR code.', 'QR_UNVERIFIED');
                }

                if ($node->room_id !== null && (string) $node->room_id !== (string) $queue->room_id) {
                    throw new BusinessRuleException('That code is not an anchor for this room.', 'WRONG_LOCATION');
                }

                return;
            }

            throw new BusinessRuleException('Checking in requires a location fix or a scan of the room code.', 'PROXIMITY_REQUIRED');
        }

        $verdict = $this->evaluateProximity($queue, $fix['lat'], $fix['lng']);

        if (! $verdict['within']) {
            throw new BusinessRuleException('You are not close enough to the room to check in yet.', 'OUTSIDE_PROXIMITY');
        }
    }

    /** @return array{lat: float, lng: float}|null */
    private function requestFix(Request $request): ?array
    {
        $fix = $request->input('fix');

        if (! is_array($fix)) {
            $fix = ['lat' => $request->input('lat'), 'lng' => $request->input('lng')];
        }

        if (! isset($fix['lat'], $fix['lng']) || $fix['lat'] === null || $fix['lng'] === null) {
            return null;
        }

        return ['lat' => (float) $fix['lat'], 'lng' => (float) $fix['lng']];
    }

    /**
     * Distance verdict for a fix, preferring an administrator-drawn geofence over the room's own
     * coordinates: a room with a polygon gets polygon semantics, everyone else gets the radius.
     *
     * @return array{within: bool, distance_m: float, radius_m: float, method: string}
     */
    private function evaluateProximity(RoomQueue $queue, float $lat, float $lng): array
    {
        $radius = (float) ($queue->proximity_radius_m ?: 50);

        $geofence = Geofence::query()
            ->where('is_active', true)
            ->where(fn ($q) => $q->where('room_id', $queue->room_id)->orWhere('floor_id', $queue->room?->floor_id))
            ->orderByRaw('case when room_id is not null then 0 else 1 end')
            ->first();

        if ($geofence) {
            return [
                'within'     => $geofence->contains($lat, $lng),
                'distance_m' => round((float) ($geofence->distanceTo($lat, $lng) ?? 0), 2),
                'radius_m'   => (float) ($geofence->radius_m ?? $radius),
                'method'     => $geofence->isPolygon() ? 'geofence_polygon' : 'geofence_radius',
                'geofence'   => ['id' => $geofence->id, 'name' => $geofence->name],
            ];
        }

        $room = $queue->room;

        if ($room === null || $room->lat === null || $room->lng === null) {
            throw new BusinessRuleException(
                'This room has no geofence or coordinates configured, so proximity cannot be verified. An administrator must set them.',
                'NO_GEOFENCE',
            );
        }

        $distance = $this->distanceMeters($lat, $lng, (float) $room->lat, (float) $room->lng);

        return [
            'within'     => $distance <= $radius,
            'distance_m' => round($distance, 2),
            'radius_m'   => $radius,
            'method'     => 'gps_room_radius',
        ];
    }

    private function distanceMeters(float $latA, float $lngA, float $latB, float $lngB): float
    {
        $a = sin(deg2rad($latB - $latA) / 2) ** 2 + cos(deg2rad($latA)) * cos(deg2rad($latB)) * sin(deg2rad($lngB - $lngA) / 2) ** 2;
        return 12742000 * asin(min(1, sqrt($a)));
    }
}
