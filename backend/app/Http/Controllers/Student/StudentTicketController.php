<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Concerns\BuildsOfficeSummaries;
use App\Http\Controllers\Concerns\RespondsJson;
use App\Http\Controllers\Controller;
use App\Models\Office;
use App\Models\OfficeTicket;
use App\Models\QueueTicket;
use App\Models\RoomQueue;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * A student's own tickets, and the counters they need to decide whether it is worth joining.
 *
 * History is intentionally separated from the live workflow: the web console reads this endpoint
 * ("what happened to my ticket last week?"), while the real-time loop — position, people ahead,
 * ETA, check-in — is driven by `GET /queue-tickets/{id}` and the queue broadcast channel on mobile.
 */
class StudentTicketController extends Controller
{
    use BuildsOfficeSummaries;
    use RespondsJson;

    private const ACTIVE_QUEUE_STATUSES  = ['waiting', 'called', 'navigating', 'checked_in'];

    private const ACTIVE_OFFICE_STATUSES = ['waiting', 'called', 'approaching', 'in_service'];

    public function active(Request $request): JsonResponse
    {
        return $this->ok([
            'ticket' => $this->activeQueueTicket($request)?->toApiArray(),
        ]);
    }

    public function history(Request $request): JsonResponse
    {
        $tickets = QueueTicket::with(['queue.room.floor.building'])
            ->where('user_id', $request->user()->id)
            ->latest('created_at')
            ->limit(50)
            ->get()
            ->map(fn (QueueTicket $t) => array_merge($t->toApiArray(), [
                'room_code' => $t->queue?->room?->code,
                'room_name' => $t->queue?->room?->name,
                'building'  => $t->queue?->room?->floor?->building?->code,
            ]));

        return $this->ok(['tickets' => $tickets->values(), 'total' => $tickets->count()]);
    }

    public function activeOffice(Request $request): JsonResponse
    {
        return $this->ok([
            'ticket' => $this->activeOfficeTicket($request)?->toApiArray(),
        ]);
    }

    public function officeHistory(Request $request): JsonResponse
    {
        $tickets = OfficeTicket::with('office')
            ->where('user_id', $request->user()->id)
            ->latest('created_at')
            ->limit(50)
            ->get()
            ->map(fn (OfficeTicket $t) => array_merge($t->toApiArray(), [
                'office_name' => $t->office?->name,
                'office_code' => $t->office?->code,
            ]));

        return $this->ok(['tickets' => $tickets->values(), 'total' => $tickets->count()]);
    }

    /**
     * GET /student/offices — the directory a student uses to pick a service.
     *
     * It carries wait counts only: no other student's name, no window roster. The staff-facing
     * equivalent (`GET /staff/offices/{id}/line`) is a different endpoint with different rights,
     * because "when is my turn?" and "who do I call next?" are different products.
     */
    public function offices(Request $request): JsonResponse
    {
        $offices = Office::with('room.floor.building')
            ->where('status', 'active')
            ->orderBy('name')
            ->get();

        return $this->ok([
            'offices' => $offices
                ->map(fn (Office $office) => $this->officeSummary($office, $request->user()->id))
                ->values(),
        ]);
    }

    /** GET /student/queues/board — the availability board (status only, no names). */
    public function queueBoard(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $boards = RoomQueue::with('room.floor.building')
            ->get()
            ->map(function (RoomQueue $queue) use ($userId) {
                $mine = QueueTicket::query()
                    ->where('queue_id', $queue->id)
                    ->where('user_id', $userId)
                    ->whereIn('status', self::ACTIVE_QUEUE_STATUSES)
                    ->latest('created_at')
                    ->first();

                return [
                    'queue_id'   => $queue->id,
                    'room_id'    => $queue->room_id,
                    'room_code'  => $queue->room?->code,
                    'room_name'  => $queue->room?->name,
                    'building'   => $queue->room?->floor?->building?->code,
                    'floor'      => $queue->room?->floor?->name,
                    'is_open'    => (bool) $queue->is_open,
                    'waiting'    => QueueTicket::where('queue_id', $queue->id)->where('status', 'waiting')->count(),
                    'occupancy'  => $queue->current_count,
                    'capacity'   => $queue->capacity,
                    'my_ticket'  => $mine?->toApiArray(),
                ];
            })
            ->sortBy(fn ($board) => $board['room_code'] ?? 'zzz')
            ->values();

        return $this->ok([
            'queues'   => $boards,
            'generated_at' => now()->toIso8601String(),
        ]);
    }

    private function activeQueueTicket(Request $request): ?QueueTicket
    {
        return QueueTicket::with(['queue.room.floor.building'])
            ->where('user_id', $request->user()->id)
            ->whereIn('status', self::ACTIVE_QUEUE_STATUSES)
            ->latest('created_at')
            ->first();
    }

    private function activeOfficeTicket(Request $request): ?OfficeTicket
    {
        return OfficeTicket::with('office')
            ->where('user_id', $request->user()->id)
            ->whereIn('status', self::ACTIVE_OFFICE_STATUSES)
            ->latest('created_at')
            ->first();
    }
}
