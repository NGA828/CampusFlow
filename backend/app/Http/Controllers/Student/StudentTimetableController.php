<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Concerns\RespondsJson;
use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Models\Term;
use App\Models\TimetableEntry;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * A student's own academic schedule.
 *
 * There is exactly one principal here: the enrolled student. Every query is filtered by that
 * student's enrolments before a row is touched, which is why a student asking for another student's
 * timetable gets an empty week rather than somebody else's classes — and why no `?student_id`
 * parameter exists on this surface. Staff teaching schedules live in `StaffController`, and
 * campus-wide timetable administration lives in `AdminController`.
 */
class StudentTimetableController extends Controller
{
    use RespondsJson;

    /** GET /student/timetable — the whole week for the current term. */
    public function index(Request $request): JsonResponse
    {
        $term = $this->term($request);
        $courseIds = $this->courseIds($request);

        if (! $term || $courseIds->isEmpty()) {
            return $this->ok([
                'term'      => $term?->only(['code', 'name', 'starts_at', 'ends_at']),
                'entries'   => [],
                'days'      => $this->emptyDays(),
                'enrolments' => 0,
            ]);
        }

        $entries = TimetableEntry::with(['course', 'room.floor.building', 'lecturer'])
            ->where('term_code', $term->code)
            ->whereIn('course_id', $courseIds)
            ->orderBy('day_of_week')
            ->orderBy('starts_at')
            ->get()
            ->map(fn (TimetableEntry $e) => $e->toApiArray());

        $days = $this->emptyDays();
        foreach ($entries as $entry) {
            $index = (int) $entry['day_of_week'];
            if (isset($days[$index])) {
                $days[$index]['entries'][] = $entry;
            }
        }

        return $this->ok([
            'term'       => $term->only(['code', 'name', 'starts_at', 'ends_at']),
            'entries'    => $entries->values(),
            'days'       => array_values($days),
            'enrolments' => $courseIds->count(),
        ]);
    }

    /** GET /student/timetable/today — the compact, mobile-shaped day list. */
    public function today(Request $request): JsonResponse
    {
        $term  = $this->term($request);
        $now   = Carbon::now();
        $days  = $this->emptyDays();

        if ($term) {
            $entries = TimetableEntry::with(['course', 'room.floor.building', 'lecturer'])
                ->where('term_code', $term->code)
                ->where('day_of_week', $now->dayOfWeek)
                ->whereIn('course_id', $this->courseIds($request))
                ->orderBy('starts_at')
                ->get();

            $days[$now->dayOfWeek]['entries'] = $entries->map(fn ($e) => $e->toApiArray())->values()->all();
        }

        return $this->ok([
            'date'    => $now->toDateString(),
            'entries' => $days[$now->dayOfWeek]['entries'],
            'remaining' => collect($days[$now->dayOfWeek]['entries'])
                ->filter(fn (array $e) => ($e['ends_at'] ?? '00:00:00') >= $now->format('H:i:s'))
                ->count(),
        ]);
    }

    /**
     * GET /student/next-class — the single card the mobile home screen is built around.
     *
     * Deliberately its own endpoint: the phone asks "where do I go now" dozens of times a day and
     * should not pay for a week grid to answer it.
     */
    public function nextClass(Request $request): JsonResponse
    {
        $term = $this->term($request);
        $now  = Carbon::now();

        if (! $term) {
            return $this->ok(['next_class' => null]);
        }

        $courseIds = $this->courseIds($request);
        if ($courseIds->isEmpty()) {
            return $this->ok(['next_class' => null]);
        }

        $query = fn (int $day) => TimetableEntry::with(['course', 'room.floor.building', 'lecturer'])
            ->where('term_code', $term->code)
            ->where('day_of_week', $day)
            ->whereIn('course_id', $courseIds);

        $next = $query($now->dayOfWeek)
            ->where('starts_at', '>', $now->format('H:i:s'))
            ->orderBy('starts_at')
            ->first();

        if (! $next) {
            for ($offset = 1; $offset <= 6 && ! $next; $offset++) {
                $next = $query(($now->dayOfWeek + $offset) % 7)->orderBy('starts_at')->first();
            }
        }

        if (! $next) {
            return $this->ok(['next_class' => null]);
        }

        $data = $next->toApiArray();
        $data['day_offset']      = $this->dayOffset((int) $next->day_of_week, $now);
        $data['minutes_until']   = $this->minutesUntil((string) $next->starts_at, $data['day_offset'], $now);
        $data['starts_in_label'] = $this->startsInLabel($data['minutes_until'], $data['day_offset']);

        return $this->ok(['next_class' => $data]);
    }

    /** GET /student/enrolments — the courses this student is on. */
    public function enrolments(Request $request): JsonResponse
    {
        $enrolments = Enrollment::with('course')
            ->where('student_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (Enrollment $e) => [
                'id'         => $e->id,
                'status'     => $e->status,
                'term_code'  => $e->term_code,
                'course'     => $e->course?->toApiArray(),
            ]);

        return $this->ok(['enrolments' => $enrolments]);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private function term(Request $request): ?Term
    {
        if ($code = $request->query('term_code')) {
            return Term::find($code);
        }

        return Term::where('is_current', true)->first();
    }

    private function courseIds(Request $request)
    {
        return Enrollment::query()
            ->where('student_id', $request->user()->id)
            ->where('status', 'enrolled')
            ->pluck('course_id');
    }

    /** @return array<int, array{index: int, label: string, entries: array}> */
    private function emptyDays(): array
    {
        $labels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        $days   = [];

        foreach ($labels as $index => $label) {
            $days[$index] = ['index' => $index, 'label' => $label, 'entries' => []];
        }

        return $days;
    }

    private function dayOffset(int $dayOfWeek, Carbon $now): int
    {
        return ($dayOfWeek - $now->dayOfWeek + 7) % 7;
    }

    private function minutesUntil(string $startsAt, int $dayOffset, Carbon $now): int
    {
        [$h, $m] = array_pad(explode(':', $startsAt), 3, '0');
        $target = $now->copy()->startOfDay()->addHours((int) $h)->addMinutes((int) $m)->addDays($dayOffset);

        return max(0, (int) $now->diffInMinutes($target, false));
    }

    private function startsInLabel(int $minutes, int $dayOffset): string
    {
        if ($dayOffset === 0) {
            if ($minutes <= 0) {
                return 'starting now';
            }
            if ($minutes < 60) {
                return "in {$minutes} minute" . ($minutes === 1 ? '' : 's');
            }

            $hours = intdiv($minutes, 60);

            return "in {$hours} hour" . ($hours === 1 ? '' : 's');
        }

        return $dayOffset === 1 ? 'tomorrow' : "in {$dayOffset} days";
    }
}
