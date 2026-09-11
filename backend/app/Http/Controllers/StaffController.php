<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
use App\Models\CampusEvent;
use App\Models\Office;
use App\Models\OfficeEvent;
use App\Models\OfficeStaff;
use App\Models\OfficeTicket;
use App\Models\QueueEvent;
use App\Models\QueueTicket;
use App\Models\Room;
use App\Models\RoomQueue;
use App\Models\Term;
use App\Models\TimetableEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StaffController extends Controller
{
    /* ------------------------------------------------------------------ guard */

    private function requireStaff(Request $request): bool
    {
        return in_array($request->user()->role, ['staff', 'admin']);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json(['success' => false, 'message' => 'Forbidden'], 403);
    }

    /* ---------------------------------------------------------------- dashboard */

    /**
     * Staff operations dashboard.
     */
    public function dashboard(Request $request): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $user = $request->user();

        $activeRoomTickets   = QueueTicket::whereIn('status', ['waiting', 'called'])->count();
        $activeOfficeTickets = OfficeTicket::whereIn('status', ['waiting', 'called', 'in_service'])->count();
        $todayAdmitted       = QueueTicket::where('status', 'admitted')
            ->whereDate('admitted_at', now()->today())->count();
        $todayServed         = OfficeTicket::where('status', 'completed')
            ->whereDate('completed_at', now()->today())->count();

        // Queues the staff member may manage (simplified: all open queues)
        $queues = RoomQueue::with(['room'])
            ->where('is_open', true)
            ->get()
            ->map(fn($q) => array_merge($q->toApiArray(), [
                'room_code' => $q->room?->code,
                'room_name' => $q->room?->name,
                'waiting'   => QueueTicket::where('queue_id', $q->id)->where('status', 'waiting')->count(),
            ]));

        // Offices the staff member is assigned to
        $officeIds = OfficeStaff::where('user_id', $user->id)->pluck('office_id');
        $offices   = Office::whereIn('id', $officeIds)->where('status', 'active')->get()
            ->map(fn($o) => array_merge($o->toApiArray(), [
                'waiting' => OfficeTicket::where('office_id', $o->id)->where('status', 'waiting')->count(),
            ]));

        return response()->json([
            'success' => true,
            'data'    => [
                'stats'   => [
                    'active_room_tickets'   => $activeRoomTickets,
                    'active_office_tickets' => $activeOfficeTickets,
                    'today_admitted'        => $todayAdmitted,
                    'today_served'          => $todayServed,
                ],
                'queues'  => $queues,
                'offices' => $offices,
            ],
        ]);
    }

    /* --------------------------------------------------------------- queues */

    /**
     * List all open queues with waiting counts.
     */
    public function queues(Request $request): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $queues = RoomQueue::with(['room'])
            ->where('is_open', true)
            ->get()
            ->map(fn($q) => array_merge($q->toApiArray(), [
                'room_code'  => $q->room?->code,
                'room_name'  => $q->room?->name,
                'building'   => $q->room?->floor?->building?->name,
                'waiting'    => QueueTicket::where('queue_id', $q->id)->where('status', 'waiting')->count(),
                'called'     => QueueTicket::where('queue_id', $q->id)->where('status', 'called')->count(),
                'checked_in' => QueueTicket::where('queue_id', $q->id)->where('status', 'checked_in')->count(),
            ]));

        return response()->json(['success' => true, 'data' => ['queues' => $queues]]);
    }

    /**
     * Full queue line for a specific queue.
     */
    public function queueLine(Request $request, string $id): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $queue = RoomQueue::with(['room'])->findOrFail($id);

        $tickets = QueueTicket::with(['user'])
            ->where('queue_id', $id)
            ->whereNotIn('status', ['completed', 'cancelled', 'no_show'])
            ->orderBy('position')
            ->get()
            ->map(fn($t) => array_merge($t->toApiArray(), [
                'user_name' => $t->user?->name,
                'user_email' => $t->user?->email,
            ]));

        return response()->json([
            'success' => true,
            'data'    => [
                'queue'   => array_merge($queue->toApiArray(), [
                    'room_code' => $queue->room?->code,
                    'room_name' => $queue->room?->name,
                ]),
                'line'    => $tickets,
                'counts'  => [
                    'waiting'    => $tickets->where('status', 'waiting')->count(),
                    'called'     => $tickets->where('status', 'called')->count(),
                    'checked_in' => $tickets->where('status', 'checked_in')->count(),
                ],
            ],
        ]);
    }

    /**
     * Call the next waiting ticket in a queue.
     */
    public function callNext(Request $request, string $id): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $result = DB::transaction(function () use ($request, $id) {
            $queue  = RoomQueue::findOrFail($id);
            $ticket = QueueTicket::where('queue_id', $id)
                ->where('status', 'waiting')
                ->orderBy('position')
                ->lockForUpdate()
                ->first();

            if (!$ticket) return null;

            $ticket->update(['status' => 'called', 'called_at' => now()]);

            QueueEvent::create([
                'ticket_id' => $ticket->id,
                'type'      => 'called',
                'metadata'  => ['called_by' => $request->user()->id],
                'created_at'=> now(),
            ]);

            return $ticket->fresh(['user']);
        });

        if (!$result) {
            return response()->json(['success' => false, 'message' => 'No waiting tickets in this queue'], 422);
        }

        return response()->json([
            'success' => true,
            'data'    => ['called' => array_merge($result->toApiArray(), ['user_name' => $result->user?->name])],
        ]);
    }

    /**
     * Admit a queue ticket (staff action).
     */
    public function admitTicket(Request $request, string $ticketId): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $ticket = QueueTicket::findOrFail($ticketId);

        DB::transaction(function () use ($ticket, $request) {
            $queue = RoomQueue::where('id', $ticket->queue_id)->lockForUpdate()->first();
            $ticket->update(['status' => 'admitted', 'admitted_at' => now()]);
            if ($queue) $queue->increment('current_count');
            QueueEvent::create([
                'ticket_id'  => $ticket->id,
                'type'       => 'admitted',
                'metadata'   => ['admitted_by' => $request->user()->id],
                'created_at' => now(),
            ]);
        });

        return response()->json([
            'success' => true,
            'data'    => ['ticket' => $ticket->fresh()->toApiArray()],
        ]);
    }

    /**
     * Complete a queue ticket (staff action).
     */
    public function completeQueueTicket(Request $request, string $ticketId): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $ticket = QueueTicket::findOrFail($ticketId);
        DB::transaction(function () use ($ticket, $request) {
            $ticket->update(['status' => 'completed', 'completed_at' => now()]);
            QueueEvent::create([
                'ticket_id'  => $ticket->id,
                'type'       => 'completed',
                'metadata'   => ['completed_by' => $request->user()->id],
                'created_at' => now(),
            ]);
        });

        return response()->json(['success' => true, 'data' => ['ticket' => $ticket->fresh()->toApiArray()]]);
    }

    /**
     * Mark a queue ticket as no-show.
     */
    public function noShowQueueTicket(Request $request, string $ticketId): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $ticket = QueueTicket::findOrFail($ticketId);
        DB::transaction(function () use ($ticket, $request) {
            $ticket->update(['status' => 'no_show', 'cancelled_at' => now(), 'cancelled_by' => 'staff']);
            QueueEvent::create([
                'ticket_id'  => $ticket->id,
                'type'       => 'no_show',
                'metadata'   => ['marked_by' => $request->user()->id, 'reason' => $request->input('reason')],
                'created_at' => now(),
            ]);
        });

        return response()->json(['success' => true, 'data' => ['ticket' => $ticket->fresh()->toApiArray()]]);
    }

    /* -------------------------------------------------------------- offices */

    /**
     * List offices the staff member is assigned to (admin sees all).
     */
    public function offices(Request $request): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $user = $request->user();

        $q = Office::with(['serviceWindows'])->where('status', 'active');
        if ($user->role !== 'admin') {
            $officeIds = OfficeStaff::where('user_id', $user->id)->pluck('office_id');
            $q->whereIn('id', $officeIds);
        }

        $offices = $q->get()->map(fn($o) => array_merge($o->toApiArray(), [
            'waiting' => OfficeTicket::where('office_id', $o->id)->where('status', 'waiting')->count(),
            'serving' => OfficeTicket::where('office_id', $o->id)->where('status', 'in_service')->count(),
        ]));

        return response()->json(['success' => true, 'data' => ['offices' => $offices]]);
    }

    /**
     * Full office queue line.
     */
    public function officeLine(Request $request, string $id): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $office  = Office::with(['serviceWindows'])->findOrFail($id);
        $tickets = OfficeTicket::with(['user'])
            ->where('office_id', $id)
            ->whereNotIn('status', ['completed', 'cancelled', 'no_show'])
            ->orderBy('created_at')
            ->get()
            ->map(fn($t) => array_merge($t->toApiArray(), [
                'user_name'  => $t->user?->name,
                'user_email' => $t->user?->email,
            ]));

        return response()->json([
            'success' => true,
            'data'    => [
                'office'  => $office->toApiArray(),
                'line'    => $tickets,
                'windows' => $office->serviceWindows->map(fn($w) => $w->toArray()),
                'counts'  => [
                    'waiting'    => $tickets->where('status', 'waiting')->count(),
                    'called'     => $tickets->where('status', 'called')->count(),
                    'in_service' => $tickets->where('status', 'in_service')->count(),
                ],
            ],
        ]);
    }

    /**
     * Call the next waiting office ticket.
     */
    public function officeCallNext(Request $request, string $id): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $result = DB::transaction(function () use ($request, $id) {
            $ticket = OfficeTicket::where('office_id', $id)
                ->where('status', 'waiting')
                ->orderBy('created_at')
                ->lockForUpdate()
                ->first();

            if (!$ticket) return null;

            $ticket->update(['status' => 'called', 'called_at' => now()]);
            OfficeEvent::create([
                'ticket_id'  => $ticket->id,
                'type'       => 'called',
                'metadata'   => ['called_by' => $request->user()->id, 'window_id' => $request->input('window_id')],
                'created_at' => now(),
            ]);

            return $ticket->fresh(['user']);
        });

        if (!$result) {
            return response()->json(['success' => false, 'message' => 'No waiting tickets'], 422);
        }

        return response()->json([
            'success' => true,
            'data'    => ['called' => array_merge($result->toApiArray(), ['user_name' => $result->user?->name])],
        ]);
    }

    /**
     * Check in an office ticket (staff confirms proximity).
     */
    public function officeCheckIn(Request $request, string $ticketId): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $ticket = OfficeTicket::findOrFail($ticketId);
        DB::transaction(function () use ($ticket, $request) {
            $ticket->update(['status' => 'in_service', 'service_started_at' => now()]);
            OfficeEvent::create([
                'ticket_id'  => $ticket->id,
                'type'       => 'checked_in',
                'metadata'   => ['by' => $request->user()->id],
                'created_at' => now(),
            ]);
        });

        return response()->json(['success' => true, 'data' => ['ticket' => $ticket->fresh()->toApiArray()]]);
    }

    /**
     * Start service on an office ticket.
     */
    public function officeStartService(Request $request, string $ticketId): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $ticket = OfficeTicket::findOrFail($ticketId);
        DB::transaction(function () use ($ticket, $request) {
            $ticket->update(['status' => 'in_service', 'service_started_at' => $ticket->service_started_at ?? now()]);
            OfficeEvent::create([
                'ticket_id'  => $ticket->id,
                'type'       => 'service_started',
                'metadata'   => ['by' => $request->user()->id],
                'created_at' => now(),
            ]);
        });

        return response()->json(['success' => true, 'data' => ['ticket' => $ticket->fresh()->toApiArray()]]);
    }

    /**
     * Complete an office service ticket.
     */
    public function officeComplete(Request $request, string $ticketId): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $ticket = OfficeTicket::findOrFail($ticketId);
        DB::transaction(function () use ($ticket, $request) {
            $ticket->update(['status' => 'completed', 'completed_at' => now()]);
            OfficeEvent::create([
                'ticket_id'  => $ticket->id,
                'type'       => 'completed',
                'metadata'   => ['by' => $request->user()->id],
                'created_at' => now(),
            ]);
        });

        return response()->json(['success' => true, 'data' => ['ticket' => $ticket->fresh()->toApiArray()]]);
    }

    /**
     * Mark an office ticket as no-show.
     */
    public function officeNoShow(Request $request, string $ticketId): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $ticket = OfficeTicket::findOrFail($ticketId);
        DB::transaction(function () use ($ticket, $request) {
            $ticket->update(['status' => 'no_show', 'cancelled_at' => now(), 'cancelled_by' => 'staff']);
            OfficeEvent::create([
                'ticket_id'  => $ticket->id,
                'type'       => 'no_show',
                'metadata'   => ['by' => $request->user()->id, 'reason' => $request->input('reason')],
                'created_at' => now(),
            ]);
        });

        return response()->json(['success' => true, 'data' => ['ticket' => $ticket->fresh()->toApiArray()]]);
    }

    /* ------------------------------------------------------------ timetable */

    /**
     * Staff's own timetable entries.
     */
    public function timetable(Request $request): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $user     = $request->user();
        $termCode = $request->query('term_code');
        if (!$termCode) $termCode = optional(Term::where('is_current', true)->first())->code;

        $q = TimetableEntry::with(['course', 'room.floor.building', 'lecturer'])
            ->where('lecturer_id', $user->id);

        if ($termCode) $q->where('term_code', $termCode);

        $entries = $q->orderBy('day_of_week')->orderBy('starts_at')->get()
            ->map(fn($e) => $e->toApiArray());

        return response()->json([
            'success' => true,
            'data'    => [
                'entries'      => $entries,
                'can_manage'   => true,
                'courses'      => [],  // staff's own courses — extend if needed
                'rooms'        => [],
            ],
        ]);
    }

    /**
     * Create a timetable entry (staff must be the lecturer).
     */
    public function createEntry(Request $request): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $request->validate([
            'course_id'  => 'required|uuid|exists:courses,id',
            'term_code'  => 'required|string|exists:terms,code',
            'room_id'    => 'nullable|uuid|exists:rooms,id',
            'type'       => 'required|in:lecture,tutorial,lab,seminar',
            'day_of_week'=> 'required|integer|between:0,6',
            'starts_at'  => 'required|date_format:H:i:s',
            'ends_at'    => 'required|date_format:H:i:s|after:starts_at',
        ]);

        $entry = TimetableEntry::create(array_merge($request->only([
            'course_id', 'term_code', 'room_id', 'type', 'day_of_week', 'starts_at', 'ends_at',
        ]), ['lecturer_id' => $request->user()->id]));

        return response()->json([
            'success' => true,
            'data'    => ['entry' => $entry->fresh(['course', 'room.floor.building'])->toApiArray()],
        ], 201);
    }

    /**
     * Update a timetable entry.
     */
    public function updateEntry(Request $request, string $id): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $entry = TimetableEntry::findOrFail($id);
        if ($entry->lecturer_id !== $request->user()->id && $request->user()->role !== 'admin') {
            return $this->forbidden();
        }

        $entry->update($request->only(['room_id', 'type', 'day_of_week', 'starts_at', 'ends_at']));

        return response()->json([
            'success' => true,
            'data'    => ['entry' => $entry->fresh(['course', 'room.floor.building'])->toApiArray()],
        ]);
    }

    /**
     * Delete a timetable entry.
     */
    public function deleteEntry(Request $request, string $id): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $entry = TimetableEntry::findOrFail($id);
        if ($entry->lecturer_id !== $request->user()->id && $request->user()->role !== 'admin') {
            return $this->forbidden();
        }

        $entry->delete();

        return response()->json(['success' => true, 'message' => 'Timetable entry deleted']);
    }

    /* ------------------------------------------------------------ events */

    /**
     * Create a campus event.
     */
    public function createEvent(Request $request): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $request->validate([
            'title'      => 'required|string|max:255',
            'description'=> 'nullable|string',
            'starts_at'  => 'required|date',
            'ends_at'    => 'nullable|date|after:starts_at',
            'venue'      => 'nullable|string|max:255',
            'category'   => 'nullable|string|max:100',
        ]);

        $event = CampusEvent::create(array_merge($request->only([
            'title', 'description', 'starts_at', 'ends_at', 'venue', 'category',
        ]), ['status' => 'published', 'organizer_id' => $request->user()->id]));

        return response()->json(['success' => true, 'data' => ['event' => $event]], 201);
    }

    /**
     * Update a campus event.
     */
    public function updateEvent(Request $request, string $id): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $event = CampusEvent::findOrFail($id);
        $event->update($request->only(['title', 'description', 'starts_at', 'ends_at', 'venue', 'category', 'status']));

        return response()->json(['success' => true, 'data' => ['event' => $event->fresh()]]);
    }

    /**
     * Delete a campus event.
     */
    public function deleteEvent(Request $request, string $id): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        CampusEvent::findOrFail($id)->delete();

        return response()->json(['success' => true, 'message' => 'Event deleted']);
    }

    /* ---------------------------------------------------------- announcements */

    /**
     * List announcements.
     */
    public function announcements(Request $request): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $announcements = Announcement::orderBy('created_at', 'desc')->get();

        return response()->json(['success' => true, 'data' => ['announcements' => $announcements]]);
    }

    /**
     * Create an announcement.
     */
    public function createAnnouncement(Request $request): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $request->validate([
            'title'   => 'required|string|max:255',
            'body'    => 'required|string',
            'priority'=> 'nullable|in:low,normal,high,urgent',
        ]);

        $ann = Announcement::create(array_merge($request->only(['title', 'body', 'priority']), [
            'author_id'    => $request->user()->id,
            'published_at' => now(),
        ]));

        return response()->json(['success' => true, 'data' => ['announcement' => $ann]], 201);
    }

    /**
     * Delete an announcement.
     */
    public function deleteAnnouncement(Request $request, string $id): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        Announcement::findOrFail($id)->delete();

        return response()->json(['success' => true, 'message' => 'Announcement deleted']);
    }
}
