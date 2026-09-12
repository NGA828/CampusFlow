<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Room;
use App\Models\Term;
use App\Models\TimetableEntry;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Whether a room is actually free — computed, never stored.
 *
 * A room's availability is not a column: it is the schedule for that date, the room's own status, and the
 * time of day. Storing it would mean the value a student sees depends on when somebody last wrote the
 * cache, and "is B204 free?" asked at 11:58 about a noon lecture is exactly the question that must not be
 * answered from a stale field. So every availability read in the product goes through here, and the web
 * room page, the mobile room card and the free-room search cannot disagree with each other.
 *
 * The session *labels* are opt-in. A resident is told which class is in the room, because a student walking
 * past with a timetable in hand needs to confirm they have found the right door; a visitor is not, because
 * a public page listing "CSC301 exam, 14:00" has just published the exam timetable. Callers outside an
 * authenticated, scoped context must pass `$withSessions = false`.
 */
trait BuildsRoomAvailability
{
    /**
     * Day-by-day availability for one room.
     *
     * @param  list<string>  $dates  ISO dates, earliest first
     * @return array<string, array<string, mixed>>
     */
    private function availabilityFor(Room $room, array $dates, bool $withSessions = true): array
    {
        $entries = $this->sessionsFor($room, $dates);
        $today = now()->toDateString();
        $clock = now()->format('H:i:s');

        $result = [];

        foreach ($dates as $date) {
            $onDay = $entries
                ->filter(fn (TimetableEntry $entry) => $this->entryAppliesOn($entry, $date))
                ->sortBy(fn (TimetableEntry $entry) => (string) $entry->starts_at)
                ->values();

            $blocking = $onDay->filter(fn (TimetableEntry $entry) => $date === $today
                && (string) $entry->starts_at <= $clock
                && (string) $entry->ends_at >= $clock);

            // `closed`/`maintenance` are the estate's answer for the whole day; `occupied` is a flag
            // somebody set at the door, and it makes a room not-free even in an empty gap in the schedule.
            $roomUnavailable = in_array($room->status, ['closed', 'maintenance'], true);

            $result[$date] = [
                'date'          => $date,
                'status'        => $room->status,
                'is_free'       => ! $roomUnavailable && $room->status !== 'occupied' && $onDay->isEmpty(),
                'is_free_now'   => $date === $today ? (! $roomUnavailable && $blocking->isEmpty()) : null,
                'busy_until'    => $date === $today && $blocking->isNotEmpty()
                    ? substr((string) $blocking->max('ends_at'), 0, 5)
                    : null,
                'session_count' => $onDay->count(),
                'sessions'      => $onDay->map(function (TimetableEntry $entry) use ($withSessions) {
                    $session = [
                        'type'      => $entry->type,
                        'starts_at' => substr((string) $entry->starts_at, 0, 5),
                        'ends_at'   => substr((string) $entry->ends_at, 0, 5),
                    ];

                    if ($withSessions) {
                        $session['course_code'] = $entry->course?->code;
                        $session['course_title'] = $entry->course?->name;
                        $session['lecturer_name'] = $entry->lecturer?->name;
                    }

                    return $session;
                })->all(),
                'reason'        => match (true) {
                    $room->status === 'closed' => 'This room is closed.',
                    $room->status === 'maintenance' => 'This room is under maintenance.',
                    $room->status === 'occupied' => 'This room is marked occupied.',
                    default => null,
                },
            ];
        }

        return $result;
    }

    /**
     * The one-day answer a room screen shows: is it free now, what is in it, when does it open up.
     *
     * `free_slots` is measured against the teaching day (08:00–18:00), which is the horizon a student
     * actually plans around — a gap at 03:00 is not a free slot worth walking for. `occupancy` comes from
     * the admission queue when the room has one, because that counter is the number of people the campus
     * believes are inside; a room's seat count is capacity, not presence.
     *
     * @return array<string, mixed>
     */
    private function availabilitySummary(Room $room, ?string $date = null): array
    {
        if ($date === null) {
            $date = now()->toDateString();
        }

        $clock = now()->format('H:i:s');
        $isToday = $date === now()->toDateString();

        $entries = $this->sessionsFor($room, [$date])
            ->filter(fn (TimetableEntry $entry) => $this->entryAppliesOn($entry, $date))
            ->sortBy(fn (TimetableEntry $entry) => (string) $entry->starts_at)
            ->values();

        $busy = $entries->map(fn (TimetableEntry $entry) => [
            'starts_at'    => substr((string) $entry->starts_at, 0, 5),
            'ends_at'      => substr((string) $entry->ends_at, 0, 5),
            'course_code'  => $entry->course?->code,
            'course_title' => $entry->course?->name,
            'session_type' => $entry->type,
        ])->values();

        $covering = $isToday
            ? $entries->first(fn (TimetableEntry $entry) => substr((string) $entry->starts_at, 0, 8) <= $clock
                && substr((string) $entry->ends_at, 0, 8) >= $clock)
            : null;

        $upcoming = $isToday
            ? $entries->first(fn (TimetableEntry $entry) => substr((string) $entry->starts_at, 0, 8) > $clock)
            : null;

        $freeSlots = [];
        $cursor = '08:00';

        foreach ($busy as $session) {
            if ($session['starts_at'] > $cursor) {
                $freeSlots[] = ['starts_at' => $cursor, 'ends_at' => $session['starts_at']];
            }

            if ($session['ends_at'] > $cursor) {
                $cursor = $session['ends_at'];
            }
        }

        if ($cursor < '18:00') {
            $freeSlots[] = ['starts_at' => $cursor, 'ends_at' => '18:00'];
        }

        $blocked = in_array($room->status, ['closed', 'maintenance'], true);
        $queue = $room->queue;
        $capacity = (int) (($queue?->capacity ?: 0) ?: ($room->capacity ?: 0));

        $availableNow = ! $blocked && $room->status !== 'occupied' && $covering === null;

        $headline = match (true) {
            $room->status === 'closed' => 'This room is closed.',
            $room->status === 'maintenance' => 'This room is under maintenance.',
            $room->status === 'occupied' => 'This room is marked occupied.',
            $covering !== null => sprintf(
                '%s%s is in here until %s.',
                $covering->course?->code ?? 'A session',
                $covering->course?->name ? ' — ' . $covering->course->name : '',
                substr((string) $covering->ends_at, 0, 5),
            ),
            $upcoming !== null => sprintf('Free now, next session at %s.', substr((string) $upcoming->starts_at, 0, 5)),
            $isToday && $entries->isNotEmpty() => 'Free for the rest of the day.',
            $entries->isNotEmpty() => 'No sessions scheduled on this date.',
            default => 'Nothing is scheduled in this room.',
        };

        return [
            'room_id' => $room->id,
            'date' => $date,
            'is_open' => ! $blocked,
            'is_available_now' => $availableNow,
            'next_free_at' => match (true) {
                $covering !== null => substr((string) $covering->ends_at, 0, 5),
                $availableNow => null,
                $upcoming !== null => substr((string) $upcoming->starts_at, 0, 5),
                default => null,
            },
            'current_session' => $covering ? [
                'course_code'  => $covering->course?->code,
                'course_title' => $covering->course?->name,
                'starts_at'    => substr((string) $covering->starts_at, 0, 5),
                'ends_at'      => substr((string) $covering->ends_at, 0, 5),
                'session_type' => $covering->type,
            ] : null,
            'busy' => $busy->all(),
            'free_slots' => $freeSlots,
            'session_count' => $entries->count(),
            'occupancy' => $queue ? ['inside' => (int) $queue->current_count, 'capacity' => $capacity] : null,
            'queue' => $queue ? [
                'id'                 => $queue->id,
                'waiting'            => (int) $queue->current_count,
                'requires_proximity' => (bool) ($queue->proximity_radius_m ?? 0),
                'is_active'          => (bool) $queue->is_open,
            ] : null,
            'reason' => match (true) {
                $room->status === 'closed' => 'This room is closed.',
                $room->status === 'maintenance' => 'This room is under maintenance.',
                $room->status === 'occupied' => 'This room is marked occupied.',
                default => null,
            },
            'headline' => $headline,
        ];
    }

    /**
     * The room's recurring sessions, which is what the "this week" strip in both clients shows.
     *
     * Deliberately the *pattern* rather than seven materialised days: inventing dated rows would make a
     * cancelled session look like a fact about a particular Tuesday.
     */
    private function weekSessions(Room $room): array
    {
        $term = Term::query()->where('is_current', true)->first();

        return TimetableEntry::query()
            ->with(['course'])
            ->where('room_id', $room->id)
            ->when($term, fn ($query) => $query->where('term_code', $term->code))
            ->get()
            ->sortBy([['day_of_week', 'asc'], ['starts_at', 'asc']])
            ->values()
            ->map(fn (TimetableEntry $entry) => [
                'id'           => $entry->id,
                'day_of_week'  => (int) $entry->day_of_week,
                'starts_at'    => substr((string) $entry->starts_at, 0, 5),
                'ends_at'      => substr((string) $entry->ends_at, 0, 5),
                'course_code'  => $entry->course?->code,
                'course_title' => $entry->course?->name,
                'session_type' => $entry->type,
            ])
            ->all();
    }

    /**
     * Every scheduled session in a room across a date range, in one query.
     *
     * The range is filtered in PHP beyond the weekday index, because a weekly pattern with
     * `effective_from`, `effective_until` and `excluded_dates` cannot be expressed as one join without
     * duplicating the expansion rules — and two expansion rules is how a room looks free on one screen and
     * booked on another.
     *
     * @param  list<string>  $dates
     */
    private function sessionsFor(Room $room, array $dates): Collection
    {
        if ($dates === []) {
            return collect();
        }

        $weekdays = collect($dates)
            ->map(fn (string $date) => (int) Carbon::parse($date)->dayOfWeek)
            ->unique()
            ->values();

        $query = TimetableEntry::query()
            ->with(['course', 'lecturer'])
            ->where('room_id', $room->id)
            ->whereIn('day_of_week', $weekdays->all())
            ->where(fn ($q) => $q->whereNull('effective_from')->orWhere('effective_from', '<=', max($dates)))
            ->where(fn ($q) => $q->whereNull('effective_until')->orWhere('effective_until', '>=', min($dates)));

        // Only the current term, when the campus has one: a schedule from a finished term must not make a
        // room look busy in a week when nothing runs.
        $term = Term::query()->where('is_current', true)->first();

        if ($term) {
            $query->where('term_code', $term->code);
        }

        return $query->orderBy('starts_at')->get();
    }

    private function entryAppliesOn(TimetableEntry $entry, string $date): bool
    {
        $weekday = (int) Carbon::parse($date)->dayOfWeek;

        if ((int) $entry->day_of_week !== $weekday) {
            return false;
        }

        if ($entry->effective_from !== null && $date < (string) $entry->effective_from) {
            return false;
        }

        if ($entry->effective_until !== null && $date > (string) $entry->effective_until) {
            return false;
        }

        $excluded = $entry->excluded_dates;

        if (is_string($excluded)) {
            $excluded = json_decode($excluded, true);
        }

        return ! is_array($excluded) || ! in_array($date, $excluded, true);
    }
}
