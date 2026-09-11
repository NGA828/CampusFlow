<?php

namespace App\Http\Controllers;

use App\Models\CampusEvent;
use App\Models\Enrollment;
use App\Models\Office;
use App\Models\OfficeTicket;
use App\Models\QueueTicket;
use App\Models\Term;
use App\Models\TimetableEntry;
use App\Models\UserNotification;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeController extends Controller
{
    /**
     * Student/staff dashboard — aggregated payload.
     *
     * Returns: today's timetable entries, next upcoming class, active queue
     * ticket, active office ticket, unread notifications count, upcoming events,
     * and building alerts (placeholder until real-time alerts are wired).
     */
    public function dashboard(Request $request): JsonResponse
    {
        $user = $request->user();
        $now  = Carbon::now();
        $today = $now->dayOfWeek; // 0=Sun … 6=Sat, matches day_of_week column

        /* ---------- today's timetable ---------- */
        $termCode = optional(Term::where('is_current', true)->first())->code;

        $todayEntries = collect();
        if ($termCode) {
            $courseIds = $user->isStudent()
                ? Enrollment::where('student_id', $user->id)
                    ->where('status', 'enrolled')
                    ->pluck('course_id')
                : collect();

            $q = TimetableEntry::with(['course', 'room.floor.building', 'lecturer'])
                ->where('term_code', $termCode)
                ->where('day_of_week', $today);

            if ($user->isStudent()) {
                $q->whereIn('course_id', $courseIds);
            } elseif ($user->isStaff()) {
                $q->where('lecturer_id', $user->id);
            }

            $todayEntries = $q->orderBy('starts_at')->get();
        }

        /* ---------- next class ---------- */
        $nowTime = $now->format('H:i:s');
        $nextClass = $todayEntries->first(fn($e) => $e->starts_at > $nowTime);

        /* ---------- next class across entire week if nothing today ---------- */
        if (!$nextClass && $termCode) {
            $remaining = collect(range($today + 1, $today + 6))
                ->map(fn($d) => $d % 7);

            foreach ($remaining as $dayNum) {
                $q2 = TimetableEntry::with(['course', 'room.floor.building', 'lecturer'])
                    ->where('term_code', $termCode)
                    ->where('day_of_week', $dayNum);

                if ($user->isStudent()) {
                    $q2->whereIn('course_id', $courseIds ?? []);
                } elseif ($user->isStaff()) {
                    $q2->where('lecturer_id', $user->id);
                }

                $nextClass = $q2->orderBy('starts_at')->first();
                if ($nextClass) break;
            }
        }

        /* ---------- active queue ticket ---------- */
        $queueTicket = QueueTicket::with(['queue.room'])
            ->where('user_id', $user->id)
            ->whereIn('status', ['waiting', 'called', 'navigating', 'checked_in'])
            ->orderBy('created_at', 'desc')
            ->first();

        /* ---------- active office ticket ---------- */
        $officeTicket = OfficeTicket::with(['office'])
            ->where('user_id', $user->id)
            ->whereIn('status', ['waiting', 'called', 'approaching', 'in_service'])
            ->orderBy('created_at', 'desc')
            ->first();

        /* ---------- unread notifications ---------- */
        $unread = UserNotification::where('user_id', $user->id)
            ->whereNull('read_at')
            ->count();

        /* ---------- upcoming events (next 7 days) ---------- */
        $events = CampusEvent::where('starts_at', '>=', $now)
            ->where('starts_at', '<=', $now->copy()->addDays(7))
            ->where('status', 'published')
            ->orderBy('starts_at')
            ->limit(3)
            ->get(['id', 'title', 'starts_at', 'venue', 'category']);

        /* ---------- today's entries serialised ---------- */
        $todaySerialized = $todayEntries->map(fn($e) => $e->toApiArray());

        /* ---------- next class serialised ---------- */
        $nextClassData = null;
        if ($nextClass) {
            $nc = $nextClass->toApiArray();
            // Add computed minutes_until
            $classDate = $now->copy()->startOfDay()
                ->addSeconds(strtotime($nextClass->starts_at) - strtotime('today'));
            $nc['minutes_until'] = max(0, (int) $now->diffInMinutes($classDate, false));
            $nextClassData = $nc;
        }

        return response()->json([
            'success' => true,
            'data'    => [
                'user'            => [
                    'id'   => $user->id,
                    'name' => $user->name,
                    'role' => $user->role,
                ],
                'today'           => [
                    'date'    => $now->toDateString(),
                    'entries' => $todaySerialized,
                ],
                'next_class'      => $nextClassData,
                'queue_ticket'    => $queueTicket ? $queueTicket->toApiArray() : null,
                'office_ticket'   => $officeTicket ? $officeTicket->toApiArray() : null,
                'unread_count'    => $unread,
                'upcoming_events' => $events,
                'building_alerts' => [],   // placeholder — extend when alert model is added
            ],
        ]);
    }

    /**
     * Weekly timetable view.
     *
     * Accepts optional ?week=YYYY-WNN (e.g. 2026-W37) to select a week.
     * Returns an ordered list of entries grouped by day of week.
     */
    public function timetable(Request $request): JsonResponse
    {
        $user = $request->user();
        $termCode = $request->query('term_code');

        if (!$termCode) {
            $termCode = optional(Term::where('is_current', true)->first())->code;
        }

        $courseIds = $user->isStudent()
            ? Enrollment::where('student_id', $user->id)
                ->where('status', 'enrolled')
                ->pluck('course_id')
            : collect();

        $q = TimetableEntry::with(['course', 'room.floor.building', 'lecturer']);

        if ($termCode) {
            $q->where('term_code', $termCode);
        }

        if ($user->isStudent()) {
            $q->whereIn('course_id', $courseIds);
        } elseif ($user->isStaff()) {
            $q->where('lecturer_id', $user->id);
        }

        $entries = $q->orderBy('day_of_week')
            ->orderBy('starts_at')
            ->get()
            ->map(fn($e) => $e->toApiArray());

        return response()->json([
            'success' => true,
            'data'    => [
                'term_code' => $termCode,
                'entries'   => $entries,
            ],
        ]);
    }

    /**
     * Today's timetable entries only.
     */
    public function today(Request $request): JsonResponse
    {
        $user  = $request->user();
        $today = Carbon::now()->dayOfWeek;
        $termCode = optional(Term::where('is_current', true)->first())->code;

        $q = TimetableEntry::with(['course', 'room.floor.building', 'lecturer'])
            ->where('day_of_week', $today);

        if ($termCode) {
            $q->where('term_code', $termCode);
        }

        if ($user->isStudent()) {
            $courseIds = Enrollment::where('student_id', $user->id)
                ->where('status', 'enrolled')
                ->pluck('course_id');
            $q->whereIn('course_id', $courseIds);
        } elseif ($user->isStaff()) {
            $q->where('lecturer_id', $user->id);
        }

        $entries = $q->orderBy('starts_at')->get()->map(fn($e) => $e->toApiArray());

        return response()->json([
            'success' => true,
            'data'    => ['today' => ['date' => now()->toDateString(), 'entries' => $entries]],
        ]);
    }

    /**
     * Next upcoming class for the authenticated user.
     */
    public function nextClass(Request $request): JsonResponse
    {
        $user     = $request->user();
        $now      = Carbon::now();
        $nowTime  = $now->format('H:i:s');
        $today    = $now->dayOfWeek;
        $termCode = optional(Term::where('is_current', true)->first())->code;

        $courseIds = $user->isStudent()
            ? Enrollment::where('student_id', $user->id)->where('status', 'enrolled')->pluck('course_id')
            : collect();

        $buildQuery = function ($dayNum) use ($user, $termCode, $courseIds) {
            $q = TimetableEntry::with(['course', 'room.floor.building', 'lecturer'])
                ->where('day_of_week', $dayNum);
            if ($termCode) $q->where('term_code', $termCode);
            if ($user->isStudent()) $q->whereIn('course_id', $courseIds);
            if ($user->isStaff()) $q->where('lecturer_id', $user->id);
            return $q;
        };

        // Today's remaining
        $nextClass = $buildQuery($today)->where('starts_at', '>', $nowTime)->orderBy('starts_at')->first();

        // Rest of the week
        if (!$nextClass) {
            foreach (range($today + 1, $today + 6) as $offset) {
                $nextClass = $buildQuery($offset % 7)->orderBy('starts_at')->first();
                if ($nextClass) break;
            }
        }

        $data = null;
        if ($nextClass) {
            $data = $nextClass->toApiArray();
            $classDate = $now->copy()->startOfDay()
                ->addSeconds(strtotime($nextClass->starts_at) - strtotime('today'));
            $data['minutes_until'] = max(0, (int) $now->diffInMinutes($classDate, false));
        }

        return response()->json([
            'success' => true,
            'data'    => ['next_class' => $data],
        ]);
    }

    /**
     * Active queue ticket for the authenticated user.
     */
    public function activeQueueTicket(Request $request): JsonResponse
    {
        $ticket = QueueTicket::with(['queue.room'])
            ->where('user_id', $request->user()->id)
            ->whereIn('status', ['waiting', 'called', 'navigating', 'checked_in'])
            ->orderBy('created_at', 'desc')
            ->first();

        return response()->json([
            'success' => true,
            'data'    => ['ticket' => $ticket ? $ticket->toApiArray() : null],
        ]);
    }

    /**
     * Active office ticket for the authenticated user.
     */
    public function activeOfficeTicket(Request $request): JsonResponse
    {
        $ticket = OfficeTicket::with(['office'])
            ->where('user_id', $request->user()->id)
            ->whereIn('status', ['waiting', 'called', 'approaching', 'in_service'])
            ->orderBy('created_at', 'desc')
            ->first();

        return response()->json([
            'success' => true,
            'data'    => ['ticket' => $ticket ? $ticket->toApiArray() : null],
        ]);
    }

    /**
     * Office ticket history for the authenticated user.
     */
    public function officeTicketHistory(Request $request): JsonResponse
    {
        $tickets = OfficeTicket::with(['office'])
            ->where('user_id', $request->user()->id)
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(fn($t) => $t->toApiArray());

        return response()->json([
            'success' => true,
            'data'    => ['tickets' => $tickets],
        ]);
    }

    /**
     * Summary of offices the user has used or has an active ticket for.
     */
    public function officeSummaries(Request $request): JsonResponse
    {
        $user = $request->user();

        // IDs of offices where this user has a ticket today
        $activeOfficeIds = OfficeTicket::where('user_id', $user->id)
            ->whereIn('status', ['waiting', 'called', 'approaching', 'in_service'])
            ->pluck('office_id');

        $offices = Office::with(['serviceWindows'])
            ->where('status', 'active')
            ->get()
            ->map(function ($office) use ($activeOfficeIds) {
                $myTicket = null;
                if ($activeOfficeIds->contains($office->id)) {
                    $myTicket = OfficeTicket::where('office_id', $office->id)
                        ->whereIn('status', ['waiting', 'called', 'approaching', 'in_service'])
                        ->orderBy('created_at', 'desc')
                        ->first();
                }

                $waiting = OfficeTicket::where('office_id', $office->id)
                    ->where('status', 'waiting')
                    ->count();

                return array_merge($office->toApiArray(), [
                    'waiting_count'           => $waiting,
                    'estimated_wait_minutes'  => $office->avg_service_minutes * $waiting,
                    'my_ticket'               => $myTicket ? $myTicket->toApiArray() : null,
                ]);
            });

        return response()->json([
            'success' => true,
            'data'    => ['offices' => $offices],
        ]);
    }

    /**
     * List paginated notifications for the authenticated user.
     */
    public function notifications(Request $request): JsonResponse
    {
        $perPage = min((int) ($request->query('per_page', 20)), 100);
        $type    = $request->query('type');

        $q = UserNotification::where('user_id', $request->user()->id);

        if ($type) {
            $q->where('type', $type);
        }

        $paginated = $q->orderBy('created_at', 'desc')->paginate($perPage);
        $unread    = UserNotification::where('user_id', $request->user()->id)
            ->whereNull('read_at')->count();

        return response()->json([
            'success' => true,
            'data'    => [
                'items' => collect($paginated->items())->map(fn($n) => $n->toApiArray()),
                'meta'  => [
                    'current_page' => $paginated->currentPage(),
                    'last_page'    => $paginated->lastPage(),
                    'total'        => $paginated->total(),
                    'per_page'     => $paginated->perPage(),
                ],
                'unread' => $unread,
            ],
        ]);
    }

    /**
     * Mark a single notification as read.
     */
    public function readNotification(Request $request, string $id): JsonResponse
    {
        $notif = UserNotification::where('user_id', $request->user()->id)
            ->where('id', $id)
            ->firstOrFail();

        if (!$notif->read_at) {
            $notif->update(['read_at' => now()]);
        }

        $unread = UserNotification::where('user_id', $request->user()->id)
            ->whereNull('read_at')->count();

        return response()->json([
            'success' => true,
            'data'    => ['unread' => $unread],
        ]);
    }

    /**
     * Mark all notifications as read.
     */
    public function readAllNotifications(Request $request): JsonResponse
    {
        UserNotification::where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json([
            'success' => true,
            'data'    => ['unread' => 0],
        ]);
    }

    /**
     * Register a push-notification device token (stub — extend when push provider added).
     */
    public function registerDevice(Request $request): JsonResponse
    {
        $request->validate([
            'token'    => 'required|string',
            'platform' => 'required|in:ios,android,web',
        ]);

        // Stub: persist to a device_tokens table when push provider is integrated.
        return response()->json([
            'success' => true,
            'data'    => ['registered' => true],
        ]);
    }
}
