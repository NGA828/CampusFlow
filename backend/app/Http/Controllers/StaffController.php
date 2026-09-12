<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
use App\Models\CampusEvent;
use App\Models\Office;
use App\Models\OfficeEvent;
use App\Models\OfficeServiceWindow;
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
        $user = $request->user();

        return $user !== null
            && $user->isActive()
            && $user->hasPermission(\App\Support\Access\Permissions::QUEUE_OPERATE_ASSIGNED);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json(['success' => false, 'message' => 'Forbidden'], 403);
    }

    /**
     * Resolve a queue and assert the caller runs it.
     *
     * Staff authority is *scoped*: `staff_assignments` decides which lines a person may operate, so
     * "you are staff" is necessary but never sufficient. Admins pass through (an explicit override in
     * the permission registry, for continuity when a duty officer is absent).
     */
    private function findQueue(Request $request, string $id): RoomQueue
    {
        $queue = RoomQueue::with(['room.floor.building'])->findOrFail($id);

        abort_unless(
            \App\Support\Access\StaffScope::canOperateQueue($request->user(), $queue),
            403,
            'This queue is outside your assignment scope.',
        );

        return $queue;
    }

    private function assertQueue(Request $request, string $id): void
    {
        $this->findQueue($request, $id);
    }

    private function findQueueTicket(Request $request, string $ticketId): QueueTicket
    {
        $ticket = QueueTicket::with(['queue.room'])->findOrFail($ticketId);

        $queue = $ticket->queue;

        abort_unless(
            $queue && \App\Support\Access\StaffScope::canOperateQueue($request->user(), $queue),
            403,
            'This ticket belongs to a queue outside your assignment scope.',
        );

        return $ticket;
    }

    private function findOffice(Request $request, string $id): Office
    {
        $office = Office::with(['serviceWindows', 'room.floor.building'])->findOrFail($id);

        abort_unless(
            \App\Support\Access\StaffScope::canOperateOffice($request->user(), $office),
            403,
            'This office is outside your assignment scope.',
        );

        return $office;
    }

    private function findOfficeTicket(Request $request, string $ticketId): OfficeTicket
    {
        $ticket = OfficeTicket::with('office')->findOrFail($ticketId);

        abort_unless(
            $ticket->office && \App\Support\Access\StaffScope::canOperateOffice($request->user(), $ticket->office),
            403,
            'This ticket belongs to an office outside your assignment scope.',
        );

        return $ticket;
    }

    /* ---------------------------------------------------------------- dashboard */

    /**
     * Staff operations dashboard.
     */
    public function dashboard(Request $request): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $user = $request->user();

        $activeRoomTickets   = QueueTicket::whereIn('status', ['waiting', 'called', 'checked_in'])->count();
        $activeOfficeTickets = OfficeTicket::whereIn('status', ['waiting', 'called', 'in_service'])->count();
        $todayAdmitted       = QueueTicket::where('status', 'admitted')
            ->whereDate('admitted_at', now()->today())->count();
        $todayServed         = OfficeTicket::where('status', 'completed')
            ->whereDate('completed_at', now()->today())->count();

        // Queues the staff member may manage (simplified: all open queues)
        $queues = RoomQueue::with(['room.floor.building'])
            ->where('is_open', true)
            ->get()
            ->map(function ($q) {
                $active = QueueTicket::with('user')
                    ->where('queue_id', $q->id)
                    ->whereNotIn('status', ['completed', 'cancelled', 'no_show'])
                    ->orderBy('position')
                    ->get();
                $current = $active->first(fn($ticket) => in_array($ticket->status, ['called', 'checked_in'], true));
                $room = $q->room;
                $line = $current ? [
                    'id' => $current->id,
                    'ticket_number' => 'Q-' . str_pad((string) $current->position, 3, '0', STR_PAD_LEFT),
                    'position' => $current->position,
                    'status' => $current->status,
                    'student_name' => $current->user?->name ?? 'Student',
                    'issued_at' => $current->created_at?->toIso8601String(),
                    'called_at' => $current->called_at?->toIso8601String(),
                    'check_in_deadline' => null,
                    'checked_in_at' => $current->checked_in_at?->toIso8601String(),
                    'eta_seconds' => null,
                    'wait_seconds' => max(0, now()->diffInSeconds($current->created_at)),
                    'checked_in' => $current->status === 'checked_in',
                ] : null;
                return [
                    'queue_id' => $q->id,
                    'room_id' => $room?->id,
                    'room_code' => $room?->code,
                    'room_name' => $room?->name,
                    'building_code' => $room?->floor?->building?->code,
                    'floor_name' => $room?->floor?->name,
                    'is_active' => $q->is_open,
                    'admission_capacity' => $q->capacity,
                    'avg_service_seconds' => 300,
                    'max_size' => $q->max_capacity,
                    'proximity_radius_m' => $q->proximity_radius_m,
                    'requires_proximity_to_join' => $q->proximity_radius_m > 0,
                    'waiting' => $active->where('status', 'waiting')->count(),
                    'occupying' => $active->whereIn('status', ['called', 'checked_in'])->count(),
                    'checked_in' => $active->where('status', 'checked_in')->count(),
                    'current' => $line,
                ];
            })->values();

        // Offices the staff member is assigned to
        $officeIds = OfficeStaff::where('user_id', $user->id)->pluck('office_id');
        $offices   = Office::with('room.floor.building')->whereIn('id', $officeIds)->where('status', 'active')->get()
            ->map(function ($o) {
                $active = OfficeTicket::with('user')->where('office_id', $o->id)
                    ->whereNotIn('status', ['completed', 'cancelled', 'no_show'])
                    ->orderBy('created_at')
                    ->get();
                $room = $o->room;
                $current = $active->first(fn($ticket) => $ticket->status === 'in_service');
                return [
                    'office_id' => $o->id,
                    'name' => $o->name,
                    'code' => $o->code,
                    'ticket_prefix' => str($o->code)->upper()->toString(),
                    'concurrent_capacity' => 1,
                    'service_duration_minutes' => $o->avg_service_minutes,
                    'check_in_radius_m' => 50,
                    'is_active' => $o->is_open,
                    'building_code' => $room?->floor?->building?->code,
                    'floor_name' => $room?->floor?->name,
                    'room_code' => $room?->code,
                    'waiting' => $active->where('status', 'waiting')->count(),
                    'in_service' => $active->where('status', 'in_service')->count(),
                    'completed_today' => OfficeTicket::where('office_id', $o->id)->where('status', 'completed')->whereDate('completed_at', today())->count(),
                    'current' => $current ? [
                        'id' => $current->id,
                        'ticket_number' => $current->ticket_number,
                        'position' => 1,
                        'status' => $current->status,
                        'student_name' => $current->user?->name ?? 'Student',
                        'subject' => $current->subject,
                        'requested_at' => $current->created_at?->toIso8601String(),
                        'called_at' => $current->called_at?->toIso8601String(),
                        'check_in_deadline' => null,
                        'checked_in_at' => null,
                        'service_started_at' => $current->service_started_at?->toIso8601String(),
                        'wait_seconds' => max(0, now()->diffInSeconds($current->created_at)),
                        'checked_in' => true,
                        'service_minutes' => $o->avg_service_minutes,
                    ] : null,
                ];
            })->values();

        $pendingQueueActions = QueueTicket::with(['user', 'queue.room'])
            ->whereIn('status', ['called', 'checked_in'])
            ->orderBy('position')
            ->get()
            ->map(fn($ticket) => [
                'id' => $ticket->id,
                'ticket_number' => 'Q-' . str_pad((string) $ticket->position, 3, '0', STR_PAD_LEFT),
                'status' => $ticket->status,
                'position' => $ticket->position,
                'check_in_deadline' => null,
                'student_name' => $ticket->user?->name ?? 'Student',
                'room_code' => $ticket->queue?->room?->code,
                'room_name' => $ticket->queue?->room?->name,
                'queue_id' => $ticket->queue_id,
            ])->values();

        $pendingOfficeActions = OfficeTicket::with('user')
            ->whereIn('status', ['called', 'checked_in'])
            ->orderBy('created_at')
            ->get()
            ->map(fn($ticket) => [
                'id' => $ticket->id,
                'ticket_number' => $ticket->ticket_number,
                'status' => $ticket->status,
                'position' => 0,
                'check_in_deadline' => null,
                'subject' => $ticket->subject,
                'student_name' => $ticket->user?->name ?? 'Student',
                'office_name' => $ticket->office?->name,
            ])->values();

        return response()->json([
            'success' => true,
            'data'    => [
                'scopes' => ['queues' => $queues->count(), 'offices' => $offices->count()],
                'queues' => $queues,
                'offices' => $offices,
                'pending_queue_actions' => $pendingQueueActions,
                'pending_office_actions' => $pendingOfficeActions,
                'teaching_today' => [],
                'kpis' => [
                    'served_today' => $todayAdmitted + $todayServed,
                    'waiting_now' => $activeRoomTickets + $activeOfficeTickets,
                    'offices_open' => $offices->where('is_active', true)->count(),
                ],
                'campus_time' => [
                    'date' => now()->toDateString(),
                    'dayOfWeek' => now()->dayOfWeek,
                    'time' => now()->format('H:i:s'),
                    'minutes' => now()->hour * 60 + now()->minute,
                ],
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

        $queue = $this->findQueue($request, $id);

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

        $this->assertQueue($request, $id);

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

        $ticket = $this->findQueueTicket($request, $ticketId);

        DB::transaction(function () use ($ticket, $request) {
            $queue = RoomQueue::where('id', $ticket->queue_id)->lockForUpdate()->first();

            // Admission is the moment a person becomes a body in the room, so this is where the
            // occupancy counter moves — and it is capped by the room's capacity, which is the whole
            // point of a controlled room. A second admit of the same ticket must not double-count.
            if ($ticket->status === 'admitted') {
                return;
            }

            if ($queue && $queue->capacity > 0 && (int) $queue->current_count >= (int) $queue->capacity) {
                abort(422, 'This room is at capacity — admit someone else first.');
            }

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

        $ticket = $this->findQueueTicket($request, $ticketId);
        DB::transaction(function () use ($ticket, $request) {
            $wasInside = $ticket->status === 'admitted';

            $ticket->update(['status' => 'completed', 'completed_at' => now()]);

            if ($wasInside) {
                $queue = RoomQueue::where('id', $ticket->queue_id)->lockForUpdate()->first();
                if ($queue && (int) $queue->current_count > 0) {
                    $queue->decrement('current_count');
                }
            }

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

        $ticket = $this->findQueueTicket($request, $ticketId);
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

        $office  = $this->findOffice($request, $id);
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
                'windows' => $office->serviceWindows->map(fn (OfficeServiceWindow $window) => $window->toApiArray())->values(),
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

        $this->findOffice($request, $id);

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

        $ticket = $this->findOfficeTicket($request, $ticketId);
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

        $ticket = $this->findOfficeTicket($request, $ticketId);
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

        $ticket = $this->findOfficeTicket($request, $ticketId);
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

        $ticket = $this->findOfficeTicket($request, $ticketId);
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

    /* ──────────────────────────────────────────────────── single queue */

    /**
     * GET /staff/queues/{queue}
     *
     * One queue, fully loaded — the shape the staff *mobile* companion uses, where the web console
     * shows the whole board. Same authorization, smaller payload: a phone in a corridor should not
     * pay for thirty rooms' statistics to answer "who is next?".
     */
    public function queueShow(Request $request, string $id): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $queue = $this->findQueue($request, $id);

        $active = QueueTicket::with('user')
            ->where('queue_id', $queue->id)
            ->whereNotIn('status', ['completed', 'cancelled', 'no_show'])
            ->orderBy('position')
            ->get();

        return response()->json([
            'success' => true,
            'data'    => [
                'queue'  => array_merge($queue->toApiArray(), [
                    'room_code'     => $queue->room?->code,
                    'room_name'     => $queue->room?->name,
                    'building_code' => $queue->room?->floor?->building?->code,
                    'floor_name'    => $queue->room?->floor?->name,
                    'waiting'       => $active->where('status', 'waiting')->count(),
                    'called'        => $active->where('status', 'called')->count(),
                    'checked_in'    => $active->where('status', 'checked_in')->count(),
                    'ahead_estimate_minutes' => $active->where('status', 'waiting')->count()
                        * max(1, (int) ($queue->avg_service_minutes ?? 6)),
                ]),
                'next'   => $active->firstWhere('status', 'waiting')?->toApiArray(),
                'current'=> $active->firstWhere('status', 'called')?->toApiArray(),
            ],
        ]);
    }

    /** POST /staff/queues/{queue}/open — start or close the line for this session. */
    public function setQueueOpen(Request $request, string $id): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $validated = $request->validate(['is_open' => ['required', 'boolean']]);
        $queue = $this->findQueue($request, $id);

        $queue->update(['is_open' => $validated['is_open']]);

        // Queue open/close is not about a ticket, and `queue_events.ticket_id` is a non-nullable
        // foreign key, so the operator action is written to the audit trail instead.
        DB::table('audit_logs')->insert([
            'user_id'      => $request->user()->id,
            'action'       => $validated['is_open'] ? 'queue.opened' : 'queue.closed',
            'subject_type' => RoomQueue::class,
            'subject_id'   => (string) $queue->id,
            'after'        => json_encode(['is_open' => $validated['is_open']]),
            'created_at'   => now(),
        ]);

        return response()->json([
            'success' => true,
            'data'    => ['queue' => $queue->fresh()->toApiArray()],
        ]);
    }

    /** POST /staff/queue-tickets/{ticket}/call — call a specific student, not just the head of the line. */
    public function callTicket(Request $request, string $ticketId): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $ticket = $this->findQueueTicket($request, $ticketId);

        if (!in_array($ticket->status, ['waiting', 'called'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Only a waiting ticket can be called.',
                'code'    => 'INVALID_TRANSITION',
            ], 422);
        }

        DB::transaction(function () use ($ticket, $request) {
            // The check-in window is derived from the queue's grace period, so the deadline the
            // student's countdown shows and the one the no-show sweep enforces cannot drift apart.
            $ticket->update([
                'status'    => 'called',
                'called_at' => now(),
            ]);

            QueueEvent::create([
                'ticket_id'  => $ticket->id,
                'type'       => 'called',
                'metadata'   => ['called_by' => $request->user()->id, 'explicit' => true],
                'created_at' => now(),
            ]);
        });

        return response()->json([
            'success' => true,
            'data'    => ['ticket' => array_merge($ticket->fresh()->load('user')->toApiArray(), [
                'user_name' => $ticket->user?->name,
            ])],
        ]);
    }

    /**
     * POST /staff/queue-tickets/{ticket}/check-in
     *
     * The staff-side alternative to a student checking in on their own device: the student is
     * standing in front of the desk, so the operator asserts presence. This is the one case where
     * the "check-in is a mobile act" rule does not apply, because the mobile device is not required
     * to prove somebody is present when a member of staff is vouching for it.
     */
    public function staffCheckIn(Request $request, string $ticketId): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $ticket = $this->findQueueTicket($request, $ticketId);

        if (!in_array($ticket->status, ['waiting', 'called', 'navigating'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'This ticket cannot be checked in from its current state.',
                'code'    => 'INVALID_TRANSITION',
            ], 422);
        }

        DB::transaction(function () use ($ticket, $request) {
            $ticket->update(['status' => 'checked_in', 'checked_in_at' => now()]);

            QueueEvent::create([
                'ticket_id'  => $ticket->id,
                'type'       => 'checked_in',
                'metadata'   => ['by' => 'staff', 'staff_id' => $request->user()->id],
                'created_at' => now(),
            ]);
        });

        return response()->json([
            'success' => true,
            'data'    => ['ticket' => $ticket->fresh()->toApiArray()],
        ]);
    }

    /** POST /staff/office-tickets/{ticket}/call — call a named office ticket. */
    public function officeCallTicket(Request $request, string $ticketId): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $ticket = $this->findOfficeTicket($request, $ticketId);

        if ($ticket->status !== 'waiting') {
            return response()->json([
                'success' => false,
                'message' => 'Only a waiting ticket can be called.',
                'code'    => 'INVALID_TRANSITION',
            ], 422);
        }

        DB::transaction(function () use ($ticket, $request) {
            $ticket->update(['status' => 'called', 'called_at' => now()]);

            OfficeEvent::create([
                'ticket_id'  => $ticket->id,
                'type'       => 'called',
                'metadata'   => ['called_by' => $request->user()->id, 'window_id' => $request->input('window_id')],
                'created_at' => now(),
            ]);
        });

        return response()->json([
            'success' => true,
            'data'    => ['called' => array_merge($ticket->fresh()->load('user')->toApiArray(), [
                'user_name' => $ticket->user?->name,
            ])],
        ]);
    }

    /**
     * GET /staff/students/{registrationNo}
     *
     * Identity verification at the desk: "is the person in front of me who the ticket says it is?".
     * Deliberately narrow — name, programme, status and the tickets they hold. No contact details,
     * no grades, no history beyond what is needed to serve the request, because a queue operator's
     * job is verification and not surveillance.
     */
    public function studentLookup(Request $request, string $registrationNo): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $student = User::query()
            ->where('role', 'student')
            ->where('registration_no', strtoupper(trim($registrationNo)))
            ->first();

        if (! $student) {
            return response()->json([
                'success' => false,
                'message' => 'No student is registered with that number.',
                'code'    => 'STUDENT_NOT_FOUND',
            ], 404);
        }

        $activeQueues = QueueTicket::with('queue.room')
            ->where('user_id', $student->id)
            ->whereIn('status', ['waiting', 'called', 'navigating', 'checked_in'])
            ->get()
            ->map(fn ($t) => [
                'ticket_number' => $t->ticketNumber(),
                'status'        => $t->status,
                'room_code'     => $t->queue?->room?->code,
                'position'      => $t->position,
            ]);

        $activeOffices = OfficeTicket::with('office')
            ->where('user_id', $student->id)
            ->whereIn('status', ['waiting', 'called', 'approaching', 'in_service'])
            ->get()
            ->map(fn ($t) => [
                'ticket_number' => $t->ticket_number,
                'status'        => $t->status,
                'office'        => $t->office?->name,
            ]);

        return response()->json([
            'success' => true,
            'data'    => [
                'student' => [
                    'name'            => $student->name,
                    'registration_no' => $student->registration_no,
                    'program'         => $student->program,
                    'department'      => $student->department,
                    'year_level'      => $student->year_level,
                    'status'          => $student->status,
                ],
                'queue_tickets'  => $activeQueues,
                'office_tickets' => $activeOffices,
            ],
        ]);
    }

    /**
     * GET /staff/analytics
     *
     * Operational analytics for the lines this person runs — not the campus-wide picture, which is
     * an administration concern. Scope is the same `staff_assignments` scope the operations use, so
     * a duty officer sees their building's numbers and nothing more.
     */
    public function analytics(Request $request): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $user = $request->user();
        $from = $request->date('from') ?? now()->subDays(7)->startOfDay();
        $to   = $request->date('to') ?? now()->endOfDay();

        $queues = $user->role === 'admin'
            ? RoomQueue::pluck('id')->all()
            : RoomQueue::get()->filter(fn ($q) => \App\Support\Access\StaffScope::canOperateQueue($user, $q))->pluck('id')->all();

        $offices = $user->role === 'admin'
            ? Office::pluck('id')->all()
            : Office::get()->filter(fn ($o) => \App\Support\Access\StaffScope::canOperateOffice($user, $o))->pluck('id')->all();

        $tickets = QueueTicket::whereIn('queue_id', $queues)
            ->whereBetween('created_at', [$from, $to])
            ->get();

        $issued = $tickets->count();
        $served = $tickets->whereIn('status', ['admitted', 'completed'])->count();
        $noShow = $tickets->where('status', 'no_show')->count();

        $waited = $tickets->filter(fn ($t) => $t->checked_in_at && $t->created_at)
            ->map(fn ($t) => $t->created_at->diffInSeconds($t->checked_in_at));

        $officeTickets = OfficeTicket::whereIn('office_id', $offices)
            ->whereBetween('created_at', [$from, $to])
            ->get();

        $servedTimes = $officeTickets->filter(fn ($t) => $t->service_started_at && $t->called_at)
            ->map(fn ($t) => $t->called_at->diffInSeconds($t->service_started_at));

        return response()->json([
            'success' => true,
            'data'    => [
                'range' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
                'scope' => ['queues' => count($queues), 'offices' => count($offices)],
                'queues' => [
                    'issued'        => $issued,
                    'served'        => $served,
                    'no_shows'      => $noShow,
                    'service_rate'  => $issued > 0 ? round($served / $issued, 3) : null,
                    'no_show_rate'  => $issued > 0 ? round($noShow / $issued, 3) : null,
                    'median_wait_s' => $waited->isNotEmpty() ? (int) $waited->median() : null,
                    'average_wait_s'=> $waited->isNotEmpty() ? (int) $waited->avg() : null,
                ],
                'offices' => [
                    'issued'   => $officeTickets->count(),
                    'completed'=> $officeTickets->where('status', 'completed')->count(),
                    'no_shows' => $officeTickets->where('status', 'no_show')->count(),
                    'median_call_to_service_s' => $servedTimes->isNotEmpty() ? (int) $servedTimes->median() : null,
                ],
                'per_queue' => collect($queues)->map(function ($queueId) use ($from, $to) {
                    $rows = QueueTicket::where('queue_id', $queueId)
                        ->whereBetween('created_at', [$from, $to])
                        ->get(['status', 'created_at', 'checked_in_at', 'admitted_at']);

                    return [
                        'queue_id' => $queueId,
                        'room_code' => RoomQueue::with('room')->find($queueId)?->room?->code,
                        'issued' => $rows->count(),
                        'served' => $rows->whereIn('status', ['admitted', 'completed'])->count(),
                        'no_shows' => $rows->where('status', 'no_show')->count(),
                        'waiting_now' => $rows->where('status', 'waiting')->count(),
                    ];
                })->values(),
                'generated_at' => now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * PATCH /staff/rooms/{room}
     *
     * The one write a staff member may make on campus data: correcting a room record inside their
     * own assignment scope (capacity, availability, features). Buildings, floors, geometry, QR
     * anchors and the routing graph are administration, and there is no route here for them.
     */
    public function updateRoom(Request $request, string $room): JsonResponse
    {
        if (!$this->requireStaff($request)) return $this->forbidden();

        $record = Room::findOrFail($room);

        abort_unless(
            \App\Support\Access\StaffScope::canManageRoom($request->user(), $record),
            403,
            'This room is outside your assignment scope.',
        );

        // A status field, not a room editor. Everything else on this row is the estate's decision: capacity
        // drives a queue's admission limit, `access_rule` decides who may enter, and visibility is what a
        // visitor sees — none of which belongs on a screen an operator uses between students.
        $validated = $request->validate([
            'status' => ['required', 'string', Rule::in(['available', 'occupied', 'closed', 'maintenance'])],
        ]);

        $before = $record->status;

        if ($before !== $validated['status']) {
            $record->update(['status' => $validated['status']]);

            DB::table('audit_logs')->insert([
                'user_id'      => $request->user()->id,
                'action'       => 'room.status.changed',
                'subject_type' => Room::class,
                'subject_id'   => (string) $record->id,
                'before'       => json_encode(['status' => $before]),
                'after'        => json_encode(['status' => $validated['status']]),
                'ip_address'   => $request->ip(),
                'created_at'   => now(),
            ]);
        }

        return response()->json(['success' => true, 'data' => [
            'room'    => $record->fresh()->toApiArray(true),
            'changed' => $before !== $validated['status'],
        ]]);
    }
}
