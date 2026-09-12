<?php

namespace App\Http\Controllers;

use App\Models\QueueEvent;
use App\Models\QueueTicket;
use App\Models\Room;
use App\Models\RoomQueue;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class QueueController extends Controller
{
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
    public function join(Request $request, Room $room): JsonResponse
    {
        $user = $request->user();

        return DB::transaction(function () use ($request, $user, $room) {
            // Lock room queue row
            $queue = RoomQueue::where('room_id', $room->id)->lockForUpdate()->first();

            if (!$queue || !$queue->is_open) {
                return response()->json([
                    'success' => false,
                    'message' => 'Queue is currently closed for this room',
                ], 422);
            }

            // Check existing active ticket
            $existing = QueueTicket::where('queue_id', $queue->id)
                ->where('user_id', $user->id)
                ->whereIn('status', ['waiting', 'called', 'navigating', 'checked_in'])
                ->first();

            if ($existing) {
                return response()->json([
                    'success' => false,
                    'message' => 'You already have an active ticket for this queue',
                    'data'    => ['ticket' => $existing->toApiArray()],
                ], 409);
            }

            // Calculate current waiting position
            $lastPosition = QueueTicket::where('queue_id', $queue->id)
                ->whereIn('status', ['waiting', 'called', 'navigating', 'checked_in'])
                ->max('position') ?? 0;

            $nextPosition = $lastPosition + 1;
            $idempotencyKey = 'JOIN-' . $user->id . '-' . $queue->id . '-' . time();

            $ticket = QueueTicket::create([
                'queue_id'        => $queue->id,
                'user_id'         => $user->id,
                'position'        => $nextPosition,
                'status'          => 'waiting',
                'idempotency_key' => $idempotencyKey,
                'join_source'     => $request->input('join_source', 'manual'),
            ]);

            QueueEvent::create([
                'ticket_id'  => $ticket->id,
                'type'       => 'joined',
                'metadata'   => ['position' => $nextPosition, 'user_id' => $user->id],
                'created_at' => now(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Successfully joined room queue',
                'data'    => ['ticket' => $ticket->toApiArray()],
            ], 201);
        });
    }

    /**
     * Staff calls student ticket.
     */
    public function callTicket(Request $request, string $ticketId): JsonResponse
    {
        $ticket = QueueTicket::findOrFail($ticketId);
        $user = $request->user();

        if (!in_array($user->role, ['admin', 'staff'])) {
            return response()->json(['success' => false, 'message' => 'Forbidden'], 403);
        }

        DB::transaction(function () use ($ticket, $user) {
            $ticket->update([
                'status'    => 'called',
                'called_at' => now(),
            ]);

            QueueEvent::create([
                'ticket_id'  => $ticket->id,
                'type'       => 'called',
                'metadata'   => ['called_by' => $user->id],
                'created_at' => now(),
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Ticket called successfully',
            'data'    => ['ticket' => $ticket->fresh()->toApiArray()],
        ]);
    }

    /**
     * Admit student to room (increments room occupancy).
     */
    public function admitTicket(Request $request, string $ticketId): JsonResponse
    {
        $ticket = QueueTicket::findOrFail($ticketId);
        $user = $request->user();

        if (!in_array($user->role, ['admin', 'staff'])) {
            return response()->json(['success' => false, 'message' => 'Forbidden'], 403);
        }

        DB::transaction(function () use ($ticket, $user) {
            $queue = RoomQueue::where('id', $ticket->queue_id)->lockForUpdate()->first();

            $ticket->update([
                'status'      => 'admitted',
                'admitted_at' => now(),
            ]);

            if ($queue) {
                $queue->increment('current_count');
            }

            QueueEvent::create([
                'ticket_id'  => $ticket->id,
                'type'       => 'admitted',
                'metadata'   => ['admitted_by' => $user->id, 'new_count' => $queue?->current_count],
                'created_at' => now(),
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Student admitted successfully',
            'data'    => ['ticket' => $ticket->fresh()->toApiArray()],
        ]);
    }

    /**
     * Student leaves queue / room.
     */
    public function leaveTicket(Request $request, string $ticketId): JsonResponse
    {
        $ticket = QueueTicket::findOrFail($ticketId);
        $user = $request->user();

        if ($ticket->user_id !== $user->id && !in_array($user->role, ['admin', 'staff'])) {
            return response()->json(['success' => false, 'message' => 'Unauthorized action'], 403);
        }

        DB::transaction(function () use ($ticket, $user) {
            $wasAdmitted = ($ticket->status === 'admitted');

            $ticket->update([
                'status'       => 'cancelled',
                'cancelled_at' => now(),
                'cancelled_by' => ($ticket->user_id === $user->id) ? 'user' : 'staff',
            ]);

            if ($wasAdmitted) {
                $queue = RoomQueue::where('id', $ticket->queue_id)->lockForUpdate()->first();
                if ($queue && $queue->current_count > 0) {
                    $queue->decrement('current_count');
                }
            }

            QueueEvent::create([
                'ticket_id'  => $ticket->id,
                'type'       => 'cancelled',
                'metadata'   => ['cancelled_by' => $user->id],
                'created_at' => now(),
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Left queue/room successfully',
            'data'    => ['ticket' => $ticket->fresh()->toApiArray()],
        ]);
    }

    /**
     * List user tickets.
     */
    public function myTickets(Request $request): JsonResponse
    {
        $user = $request->user();
        $tickets = QueueTicket::where('user_id', $user->id)
            ->with(['queue.room'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data'    => $tickets->map(fn($t) => $t->toApiArray()),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $queues = RoomQueue::with('room.floor.building')->where('is_open', true)->get()->map(function (RoomQueue $queue) use ($request) {
            return $this->queuePayload($queue, $request->user()?->id);
        });

        return response()->json(['success' => true, 'data' => ['queues' => $queues]]);
    }

    public function showById(Request $request, string $id): JsonResponse
    {
        $queue = RoomQueue::with('room.floor.building')->findOrFail($id);
        $ticket = $this->activeTicket($queue->id, $request->user()?->id);

        return response()->json(['success' => true, 'data' => [
            'queue' => $this->queuePayload($queue, $request->user()?->id),
            'my_ticket_id' => $ticket?->id,
            'counts' => $this->counts($queue->id),
        ]]);
    }

    public function joinByQueueId(Request $request, string $id): JsonResponse
    {
        $queue = RoomQueue::with('room')->findOrFail($id);
        $key = $request->header('Idempotency-Key');
        if (! $key) return response()->json(['success' => false, 'message' => 'An idempotency key is required'], 422);

        $ticket = DB::transaction(function () use ($request, $queue, $key) {
            $locked = RoomQueue::lockForUpdate()->findOrFail($queue->id);
            $replay = QueueTicket::where('idempotency_key', $key)->first();
            if ($replay) {
                abort_unless($replay->user_id === $request->user()->id && $replay->queue_id === $locked->id, 409, 'Idempotency key has already been used');
                return $replay;
            }
            abort_unless($locked->is_open, 422, 'Queue is currently closed for this room');
            abort_if($this->activeTicket($locked->id, $request->user()->id), 409, 'You already have an active ticket for this queue');
            $position = (QueueTicket::where('queue_id', $locked->id)->max('position') ?? 0) + 1;
            $ticket = QueueTicket::create(['queue_id' => $locked->id, 'user_id' => $request->user()->id, 'position' => $position, 'status' => 'waiting', 'idempotency_key' => $key, 'joined_lat' => data_get($request->input('fix'), 'lat'), 'joined_lng' => data_get($request->input('fix'), 'lng'), 'join_source' => $request->input('qr_code') ? 'qr' : 'manual']);
            QueueEvent::create(['ticket_id' => $ticket->id, 'type' => 'joined', 'metadata' => ['position' => $position], 'created_at' => now()]);
            return $ticket;
        });

        return response()->json(['success' => true, 'data' => ['ticket' => $this->ticketPayload($ticket->fresh('queue.room.floor.building'))]], 201);
    }

    public function ticketDetails(Request $request, string $id): JsonResponse
    {
        $ticket = QueueTicket::with('queue.room.floor.building')->findOrFail($id);
        $this->ensureAccess($request, $ticket);
        return response()->json(['success' => true, 'data' => $this->ticketPayload($ticket)]);
    }

    public function cancelTicket(Request $request, string $id): JsonResponse
    {
        $ticket = QueueTicket::findOrFail($id);
        $this->ensureAccess($request, $ticket);
        abort_if($ticket->isTerminal(), 422, 'This ticket is already closed');
        $ticket->update(['status' => 'cancelled', 'cancelled_at' => now(), 'cancelled_by' => $ticket->user_id === $request->user()->id ? 'user' : 'staff']);
        QueueEvent::create(['ticket_id' => $ticket->id, 'type' => 'cancelled', 'metadata' => ['cancelled_by' => $request->user()->id], 'created_at' => now()]);
        return response()->json(['success' => true, 'data' => $this->ticketPayload($ticket->fresh('queue.room.floor.building'))]);
    }

    public function checkInTicket(Request $request, string $id): JsonResponse
    {
        $ticket = QueueTicket::findOrFail($id);
        abort_unless($ticket->user_id === $request->user()->id, 403, 'Forbidden');
        abort_unless(in_array($ticket->status, ['called', 'navigating'], true), 422, 'Only a called ticket can be checked in');
        $ticket->update(['status' => 'checked_in', 'checked_in_at' => now()]);
        QueueEvent::create(['ticket_id' => $ticket->id, 'type' => 'checked_in', 'metadata' => [], 'created_at' => now()]);
        return response()->json(['success' => true, 'data' => $this->ticketPayload($ticket->fresh('queue.room.floor.building'))]);
    }

    public function setNavigating(Request $request, string $id): JsonResponse
    {
        $ticket = QueueTicket::findOrFail($id);
        abort_unless($ticket->user_id === $request->user()->id, 403, 'Forbidden');
        abort_unless($ticket->status === 'called', 422, 'Only a called ticket can start navigating');
        $ticket->update(['status' => 'navigating']);
        QueueEvent::create(['ticket_id' => $ticket->id, 'type' => 'navigating', 'metadata' => [], 'created_at' => now()]);
        return response()->json(['success' => true, 'data' => $this->ticketPayload($ticket->fresh('queue.room.floor.building'))]);
    }

    public function proximityCheck(Request $request, string $id): JsonResponse
    {
        $queue = RoomQueue::with('room')->findOrFail($id);
        $fix = $request->validate(['fix.lat' => ['required', 'numeric'], 'fix.lng' => ['required', 'numeric']])['fix'];
        abort_if($queue->room->lat === null || $queue->room->lng === null, 422, 'This room has no configured geofence');
        $distance = $this->distanceMeters((float) $fix['lat'], (float) $fix['lng'], (float) $queue->room->lat, (float) $queue->room->lng);
        return response()->json(['success' => true, 'data' => ['within' => $distance <= $queue->proximity_radius_m, 'distance_m' => round($distance, 2), 'radius_m' => $queue->proximity_radius_m, 'method' => 'gps']]);
    }

    private function activeTicket(string $queueId, ?int $userId): ?QueueTicket
    {
        if (! $userId) return null;
        return QueueTicket::where('queue_id', $queueId)->where('user_id', $userId)->whereIn('status', ['waiting', 'called', 'navigating', 'checked_in', 'admitted'])->first();
    }

    private function counts(string $queueId): array
    {
        return ['waiting' => QueueTicket::where('queue_id', $queueId)->where('status', 'waiting')->count(), 'in_service' => QueueTicket::where('queue_id', $queueId)->whereIn('status', ['called', 'checked_in', 'admitted'])->count()];
    }

    private function queuePayload(RoomQueue $queue, ?int $userId): array
    {
        $room = $queue->room;
        return array_merge($queue->toApiArray(), ['is_active' => $queue->is_open, 'admission_capacity' => $queue->capacity, 'avg_service_seconds' => 300, 'requires_proximity_to_join' => false, 'check_in_window_seconds' => $queue->call_window_minutes * 60, 'room_code' => $room?->code, 'room_name' => $room?->name, 'building_code' => $room?->floor?->building?->code, 'building_name' => $room?->floor?->building?->name, 'floor_name' => $room?->floor?->name, 'waiting' => $this->counts($queue->id)['waiting'], 'serving' => $this->counts($queue->id)['in_service'], 'my_ticket_id' => $this->activeTicket($queue->id, $userId)?->id]);
    }

    private function ticketPayload(QueueTicket $ticket): array
    {
        $ticket->loadMissing('queue.room.floor.building');
        $ahead = QueueTicket::where('queue_id', $ticket->queue_id)->whereIn('status', ['waiting', 'called', 'navigating', 'checked_in', 'admitted'])->where('position', '<', $ticket->position)->count();
        return ['ticket' => array_merge($ticket->toApiArray(), ['ticket_number' => 'Q-' . str_pad((string) $ticket->position, 3, '0', STR_PAD_LEFT), 'issued_at' => $ticket->created_at?->toIso8601String(), 'eta_seconds' => $ahead * 300]), 'queue' => $this->queuePayload($ticket->queue, $ticket->user_id), 'people_ahead' => $ahead, 'counts' => $this->counts($ticket->queue_id), 'eta_seconds' => $ahead * 300, 'expected_service_at' => now()->addSeconds($ahead * 300)->toIso8601String(), 'check_in_deadline' => null, 'seconds_until_deadline' => null, 'can_check_in' => in_array($ticket->status, ['called', 'navigating'], true), 'can_cancel' => ! $ticket->isTerminal()];
    }

    private function ensureAccess(Request $request, QueueTicket $ticket): void
    {
        abort_unless($ticket->user_id === $request->user()->id || in_array($request->user()->role, ['staff', 'admin'], true), 403, 'Forbidden');
    }

    private function distanceMeters(float $latA, float $lngA, float $latB, float $lngB): float
    {
        $a = sin(deg2rad($latB - $latA) / 2) ** 2 + cos(deg2rad($latA)) * cos(deg2rad($latB)) * sin(deg2rad($lngB - $lngA) / 2) ** 2;
        return 12742000 * asin(min(1, sqrt($a)));
    }
}
