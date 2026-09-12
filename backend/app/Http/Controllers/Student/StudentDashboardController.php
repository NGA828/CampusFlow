<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Concerns\BuildsOfficeSummaries;
use App\Http\Controllers\Concerns\BuildsQueueViews;
use App\Http\Controllers\Concerns\RespondsJson;
use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\Building;
use App\Models\UserPosition;
use App\Models\CampusEvent;
use App\Models\Enrollment;
use App\Models\OfficeTicket;
use App\Models\QueueTicket;
use App\Models\RoomQueue;
use App\Models\Term;
use App\Models\TimetableEntry;
use App\Models\User;
use App\Models\UserNotification;
use App\Support\Access\ClientContext;
use App\Support\Access\Permissions;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The student workspace dashboard — academic and campus activity for one enrolled human.
 *
 * This is one of three dashboards and it is not a variant of the other two. `StaffController`
 * answers "who do I call next?" and `AdminController` answers "is the platform healthy?"; this
 * endpoint answers "what is my day, and where do I need to be?". A staff or admin principal cannot
 * reach it (`role:student` on the route), and it contains no branch on any role other than student.
 *
 * `quick_actions` is returned by the server on purpose: which verbs the *platform* is allowed to
 * offer comes from the permission registry, so the web and mobile clients render different action
 * sets without either one deciding that on its own.
 */
class StudentDashboardController extends Controller
{
    use BuildsQueueViews;
    use BuildsOfficeSummaries;
    use RespondsJson;

    public function __invoke(Request $request, ClientContext $context): JsonResponse
    {
        $user  = $request->user();
        $now   = Carbon::now();
        $today = $now->dayOfWeek;

        $term  = Term::where('is_current', true)->first();
        $courseIds = $term
            ? Enrollment::where('student_id', $user->id)->where('status', 'enrolled')->pluck('course_id')
            : collect();

        $todayEntries = collect();
        $nextClass    = null;

        if ($term && $courseIds->isNotEmpty()) {
            $todayEntries = $this->entriesFor($term->code, $today, $courseIds)
                ->orderBy('starts_at')
                ->get();

            $nowTime = $now->format('H:i:s');
            $nextClass = $todayEntries->first(fn (TimetableEntry $e) => $e->starts_at > $nowTime);

            if (! $nextClass) {
                foreach (range($today + 1, $today + 6) as $offset) {
                    $candidate = $this->entriesFor($term->code, $offset % 7, $courseIds)
                        ->orderBy('starts_at')
                        ->first();

                    if ($candidate) {
                        $nextClass = $candidate;
                        break;
                    }
                }
            }
        }

        $queueTicket = QueueTicket::with(['queue.room.floor.building'])
            ->where('user_id', $user->id)
            ->whereIn('status', ['waiting', 'called', 'navigating', 'checked_in'])
            ->latest('created_at')
            ->first();

        $officeTicket = OfficeTicket::with(['office'])
            ->where('user_id', $user->id)
            ->whereIn('status', ['waiting', 'called', 'approaching', 'in_service'])
            ->latest('created_at')
            ->first();

        $nextClassData = null;
        if ($nextClass) {
            $nextClassData = $nextClass->toApiArray();
            $nextClassData['minutes_until'] = $this->minutesUntil((string) $nextClass->starts_at, $nextClass->day_of_week, $now);
        }

        return $this->ok([
            'user' => [
                'id'              => $user->id,
                'name'            => $user->name,
                'role'            => $user->role,
                'registration_no' => $user->registration_no,
                'program'         => $user->program,
                'department'      => $user->department,
            ],
            'term'            => $term?->only(['code', 'name']),
            'today'           => [
                'date'    => $now->toDateString(),
                'entries' => $todayEntries->map(fn ($e) => $e->toApiArray())->values(),
                'remaining' => $todayEntries->filter(fn ($e) => $e->ends_at >= $now->format('H:i:s'))->count(),
            ],
            'next_class'      => $nextClassData,
            'queue_ticket'    => $queueTicket ? $this->ticketPayload($queueTicket) : null,
            'office_ticket'   => $officeTicket ? $this->officeTicketView($officeTicket) : null,
            'notifications'   => $this->recentNotifications($user),
            'unread_notifications' => UserNotification::where('user_id', $user->id)->whereNull('read_at')->count(),
            'announcements'   => Announcement::query()
                ->whereNotNull('published_at')
                ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>=', $now))
                ->latest('published_at')
                ->limit(3)
                ->get()
                ->map(fn (Announcement $a) => $a->toApiArray())
                ->values(),
            'events'          => CampusEvent::query()
                ->where('status', 'published')
                ->whereBetween('starts_at', [$now, $now->copy()->addDays(7)])
                ->orderBy('starts_at')
                ->limit(3)
                ->get(['id', 'title', 'starts_at', 'venue', 'category']),
            'campus_snapshot' => [
                'open_queues'      => RoomQueue::where('is_open', true)->count(),
                'rooms_in_queue'   => QueueTicket::whereIn('status', ['waiting'])->distinct('queue_id')->count('queue_id'),
                'enrolled_courses' => $courseIds->count(),
            ],
            'building_alerts' => $this->buildingAlerts($todayEntries),
            'position'        => $this->lastFix($user),
            'quick_actions'   => $this->quickActions($context, $nextClassData, $queueTicket, $officeTicket),
        ]);
    }

    /**
     * Closures that would interrupt *this student's* day.
     *
     * A maintenance notice on a building they never visit is admin noise, not a student alert — so the
     * card is scoped to the buildings that actually host today's classes.
     */
    private function buildingAlerts($todayEntries): array
    {
        $buildingIds = $todayEntries
            ->map(fn (TimetableEntry $entry) => $entry->room?->floor?->building_id)
            ->filter()
            ->unique();

        if ($buildingIds->isEmpty()) {
            return [];
        }

        return Building::whereIn('id', $buildingIds)
            ->where('status', '!=', 'active')
            ->get(['id', 'code', 'name', 'status'])
            ->map(fn (Building $building) => $building->toArray())
            ->all();
    }


    private function entriesFor(string $termCode, int $dayOfWeek, $courseIds)
    {
        return TimetableEntry::with(['course', 'room.floor.building', 'lecturer'])
            ->where('term_code', $termCode)
            ->where('day_of_week', $dayOfWeek)
            ->whereIn('course_id', $courseIds);
    }

    /**
     * Verbs the server is willing to honour for this principal on this platform. A client may only
     * render what appears here, and calling an action that is absent returns 403 — so the list is a
     * description of the API, never a substitute for it.
     *
     * @return list<array{id: string, label: string, href: string, kind: string}>
     */
    private function quickActions(ClientContext $context, ?array $nextClass, ?QueueTicket $queueTicket, ?OfficeTicket $officeTicket): array
    {
        $actions = [];

        if ($nextClass && ($context->may(Permissions::NAVIGATION_PREVIEW) || $context->may(Permissions::NAVIGATION_LIVE))) {
            $actions[] = [
                'id'    => 'navigate-next-class',
                'label' => $context->isMobile() ? 'Navigate to ' . ($nextClass['room_code'] ?? 'class') : 'Route to ' . ($nextClass['room_code'] ?? 'class'),
                'href'  => $context->isMobile()
                    ? '/navigate/' . urlencode((string) ($nextClass['room_code'] ?? ''))
                    : '/student/campus/rooms/' . urlencode((string) ($nextClass['room_code'] ?? '')),
                'kind'  => 'navigation',
            ];
        }

        // The scanner is only ever offered to a mobile principal: `qr.scan` is registered for the
        // mobile platform, so this branch simply never fires in a browser and there is no dead button.
        if ($context->may(Permissions::QR_SCAN)) {
            $actions[] = ['id' => 'scan', 'label' => 'Scan a location code', 'href' => '/scan', 'kind' => 'positioning'];
        }

        if ($context->may(Permissions::QUEUE_JOIN)) {
            $actions[] = [
                'id'    => 'queue',
                'label' => $queueTicket ? 'View my queue ticket' : 'Find a room and join its queue',
                'href'  => $context->isMobile() ? '/queue' : '/student/services/queues',
                'kind'  => 'queue',
            ];
        }

        if ($context->may(Permissions::OFFICE_TICKET_REQUEST)) {
            $actions[] = [
                'id'    => 'office',
                'label' => $officeTicket ? 'Track my office ticket' : 'Get an office ticket',
                'href'  => $context->isMobile() ? '/offices' : '/student/services/offices',
                'kind'  => 'office',
            ];
        }

        if ($context->may(Permissions::TIMETABLE_VIEW_OWN)) {
            $actions[] = [
                'id'    => 'timetable',
                'label' => $context->isMobile() ? 'Today’s classes' : 'Week timetable',
                'href'  => $context->isMobile() ? '/timetable' : '/student/timetable',
                'kind'  => 'academic',
            ];
        }

        return $actions;
    }

    private function recentNotifications(User $user): array
    {
        return UserNotification::where('user_id', $user->id)
            ->latest()
            ->limit(3)
            ->get()
            ->map(fn (UserNotification $n) => $n->toApiArray())
            ->values()
            ->all();
    }

    /** Minutes until a recurring slot, expressed against *this* week's calendar. */
    private function minutesUntil(string $startsAt, int $dayOfWeek, Carbon $now): int
    {
        [$h, $m] = array_pad(explode(':', $startsAt), 3, '0');
        $target = $now->copy()->startOfDay()->addHours((int) $h)->addMinutes((int) $m);

        $deltaDays = ($dayOfWeek - $now->dayOfWeek + 7) % 7;
        $target->addDays($deltaDays);

        return max(0, (int) $now->diffInMinutes($target, false));
    }
}
