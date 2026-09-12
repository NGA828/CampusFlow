<?php

namespace App\Http\Controllers\Concerns;

use App\Models\QueueTicket;
use App\Models\RoomQueue;
use Illuminate\Support\Facades\Gate;

/**
 * Reading a room queue the way a *student* reads it.
 *
 * Both the student queue endpoints and the student dashboard need the same composition — the ticket, the
 * queue's own policy block, how many people are ahead, the ETA, the check-in countdown and which buttons
 * this caller may press — and it must not be computed twice, because the countdown on a card and the
 * countdown on the ticket page disagreeing is exactly the kind of bug a student reports as "the app lied
 * to me".
 *
 * Nothing in here answers an operator question. `StaffController` builds line views with student names
 * and call history; this trait deliberately never loads another ticket, and every method takes the ticket
 * whose owner is asking.
 */
trait BuildsQueueViews
{
    /**
     * Live counts for a queue: who is waiting, called and being served.
     */
    private function counts(string $queueId): array
    {
        return ['waiting' => QueueTicket::where('queue_id', $queueId)->where('status', 'waiting')->count(), 'in_service' => QueueTicket::where('queue_id', $queueId)->whereIn('status', ['called', 'checked_in', 'admitted'])->count()];
    }

    /**
     * This caller's own live ticket for a queue, if they hold one.
     */
    private function activeTicket(string $queueId, ?int $userId): ?QueueTicket
    {
        if (! $userId) return null;
        return QueueTicket::where('queue_id', $queueId)->where('user_id', $userId)->whereIn('status', ['waiting', 'called', 'navigating', 'checked_in', 'admitted'])->first();
    }

    /**
     * A queue as the campus board shows it, plus this caller's ticket id.
     */
    private function queuePayload(RoomQueue $queue, ?int $userId): array
    {
        $room = $queue->room;
        $counts = $this->counts($queue->id);

        return array_merge($queue->toApiArray(), [
            'is_active' => (bool) $queue->is_open,
            'admission_capacity' => (int) ($queue->capacity ?? 0),
            'avg_service_seconds' => (int) ($queue->avg_service_minutes ?? 6) * 60,
            'requires_proximity_to_join' => (bool) ($queue->join_requires_proximity ?? true),
            'no_show_grace_minutes' => (int) ($queue->no_show_grace_minutes ?? $queue->call_window_minutes),
            'check_in_window_seconds' => (int) ($queue->call_window_minutes ?? 5) * 60,
            'room_code' => $room?->code,
            'room_name' => $room?->name,
            'building_code' => $room?->floor?->building?->code,
            'building_name' => $room?->floor?->building?->name,
            'floor_name' => $room?->floor?->name,
            'waiting' => $counts['waiting'],
            'serving' => $counts['in_service'],
            'my_ticket_id' => $this->activeTicket($queue->id, $userId)?->id,
        ]);
    }

    /**
     * A student's view of their own place in a line.
     */
    private function ticketPayload(QueueTicket $ticket): array
    {
        $ticket->loadMissing('queue.room.floor.building');

        $ahead = QueueTicket::where('queue_id', $ticket->queue_id)
            ->whereIn('status', ['waiting', 'called', 'navigating', 'checked_in', 'admitted'])
            ->where('position', '<', $ticket->position)
            ->count();

        $serviceSeconds = max(60, (int) ($ticket->queue?->avg_service_minutes ?? 6) * 60);
        $eta = $ahead * $serviceSeconds;

        return [
            'ticket' => array_merge($ticket->toApiArray(), [
                'issued_at' => $ticket->created_at?->toIso8601String(),
                'eta_seconds' => $eta,
            ]),
            'queue'    => $this->queuePayload($ticket->queue, $ticket->user_id),
            'people_ahead' => $ahead,
            'counts'   => $this->counts($ticket->queue_id),
            'eta_seconds' => $eta,
            'expected_service_at' => now()->addSeconds($eta)->toIso8601String(),
            'check_in_deadline' => $ticket->checkInDeadline()?->toIso8601String(),
            'seconds_until_deadline' => $ticket->secondsUntilDeadline(),
            // Resolved through the policy so platform rules apply: the web client therefore hides the
            // check-in button by default (`access.require_mobile_for_check_in`), while the phone shows it.
            'can_check_in' => Gate::allows('checkIn', $ticket),
            'can_navigate' => Gate::allows('markNavigating', $ticket),
            'can_cancel'   => ! $ticket->isTerminal() && Gate::allows('cancel', $ticket),
        ];
    }
}
