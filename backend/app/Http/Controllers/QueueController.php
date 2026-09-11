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
}
