<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Office;
use App\Models\OfficeServiceWindow;
use App\Models\OfficeTicket;
use Carbon\Carbon;
use Illuminate\Support\Facades\Gate;

/**
 * The one place an office is turned into "what a student can decide from".
 *
 * Both the student index (`GET /student/offices`) and the detail screen (`GET /student/offices/{code}`)
 * need exactly the same arithmetic, and the staff console needs a superset of it. Computing it twice is
 * how two screens end up disagreeing about whether a desk is open, so it is computed here.
 *
 * Everything is derived from persisted state — windows, tickets, the office's own configuration. No
 * field in this payload is invented, which is the point of the accompanying migration: an "expected
 * window" that no column supports is a UI that lies.
 */
trait BuildsOfficeSummaries
{
    /**
     * @param int|null $userId whose ticket (if any) should be attached
     * @return array<string, mixed> shaped as the client's `OfficeSummary`
     */
    protected function officeSummary(Office $office, ?int $userId = null): array
    {
        $office->loadMissing(['serviceWindows', 'staffPivot.user', 'room.floor.building']);

        $now = Carbon::now();
        $today = (int) $now->dayOfWeek;

        /** @var \Illuminate\Support\Collection<OfficeServiceWindow> $windows */
        $windows = $office->serviceWindows
            ->filter(fn (OfficeServiceWindow $w) => $w->is_active && $w->status === 'active')
            ->sortBy([['day_of_week', 'asc'], ['opens_at', 'asc']])
            ->values();

        $todayWindows = $windows->where('day_of_week', $today)->values();
        $openNow = $office->is_open && $todayWindows->contains(fn (OfficeServiceWindow $w) => $w->isOpenNow());

        $current = $todayWindows->first(fn (OfficeServiceWindow $w) => $w->isOpenNow());
        $nextOpening = null;

        if (! $openNow) {
            $later = $todayWindows->first(fn (OfficeServiceWindow $w) => substr((string) $w->opens_at, 0, 5) > $now->format('H:i'));

            if ($later) {
                $nextOpening = $now->toDateString() . 'T' . substr((string) $later->opens_at, 0, 5) . ':00';
            } else {
                for ($offset = 1; $offset <= 7 && ! $nextOpening; $offset++) {
                    $day = $windows->where('day_of_week', ($today + $offset) % 7);
                    $first = $day->sortBy('opens_at')->first();

                    if ($first) {
                        $nextOpening = $now->copy()->addDays($offset)->toDateString() . 'T' . substr((string) $first->opens_at, 0, 5) . ':00';
                    }
                }
            }
        }

        $counts = [
            'waiting'         => OfficeTicket::where('office_id', $office->id)->where('status', 'waiting')->count(),
            'in_service'      => OfficeTicket::where('office_id', $office->id)->where('status', 'in_service')->count(),
            'checked_in'      => OfficeTicket::where('office_id', $office->id)->whereIn('status', ['called', 'approaching'])->count(),
            'completed_today' => OfficeTicket::where('office_id', $office->id)->where('status', 'completed')->whereDate('completed_at', $now)->count(),
        ];

        $issuedToday = OfficeTicket::where('office_id', $office->id)->whereDate('created_at', $now)->count();
        $average = (int) ($current?->avg_service_minutes ?: $office->avg_service_minutes ?: 10);
        $waitMinutes = (int) round(($counts['waiting'] * $average) / max(1, (int) ($office->concurrent_capacity ?: 1)));

        $myTicket = $userId
            ? OfficeTicket::where('office_id', $office->id)
                ->where('user_id', $userId)
                ->whereIn('status', ['waiting', 'approaching', 'called', 'in_service'])
                ->latest('created_at')
                ->first()
            : null;

        // The student's expected slot is bounded by the window's own closing time: promising
        // "15:40–16:10" at a desk that shuts at 16:00 is worse than promising nothing.
        $expectedWindow = null;

        if ($current && $openNow) {
            $startsAt = $now->copy()->addMinutes($waitMinutes);
            $endsAt = $startsAt->copy()->addMinutes($average);
            $closesAt = Carbon::parse($now->toDateString() . 'T' . substr((string) $current->closes_at, 0, 5) . ':00');

            if ($startsAt->lt($closesAt)) {
                $expectedWindow = [
                    'starts_at' => $startsAt->toIso8601String(),
                    'ends_at'   => $endsAt->min($closesAt)->toIso8601String(),
                ];
            }
        }

        return [
            'office' => array_merge($office->toApiArray(), [
                'daily_capacity_used' => $issuedToday,
                'waiting'             => $counts['waiting'],
                'in_service'          => $counts['in_service'],
            ]),
            'windows'      => $windows->map(fn (OfficeServiceWindow $w) => $w->toApiArray())->values()->all(),
            'today_windows' => $todayWindows->map(fn (OfficeServiceWindow $w) => $w->toApiArray())->values()->all(),
            'is_open_now'  => $openNow,
            'opens_at'     => $current ? $now->toDateString() . 'T' . substr((string) $current->opens_at, 0, 5) . ':00' : null,
            'closes_at'    => $current ? $now->toDateString() . 'T' . substr((string) $current->closes_at, 0, 5) . ':00' : null,
            'next_opening' => $nextOpening,
            'counts'       => $counts,
            'average_service_minutes' => $average,
            'next_ticket_number'      => $this->nextTicketNumber($office),
            'estimated_wait_minutes'  => $openNow ? $waitMinutes : 0,
            'expected_window'         => $expectedWindow,
            'daily_capacity'          => $office->daily_capacity === null ? null : (int) $office->daily_capacity,
            'daily_capacity_used'     => $issuedToday,
            'grace_period_seconds'    => (int) ($office->grace_period_seconds ?? 300),
            'requires_appointment'    => (bool) $office->requires_appointment,
            'staff'      => $office->staffPivot
                ->map(fn ($pivot) => [
                    'id'   => $pivot->user?->id,
                    'name' => $pivot->user?->name,
                    'role' => $pivot->role,
                ])
                ->filter(fn ($row) => $row['name'] !== null)
                ->values()
                ->all(),
            'my_ticket' => $myTicket?->toApiArray(),
        ];
    }

    /**
     * A student's own ticket at a desk — the same composition the ticket page and the dashboard use.
     */
    protected function officeTicketView(OfficeTicket $ticket): array
    {
        $ticket->loadMissing('office.room.floor.building');
        $office = $ticket->office;

        $ahead = OfficeTicket::where('office_id', $ticket->office_id)
            ->whereIn('status', ['waiting', 'approaching', 'called', 'in_service'])
            ->where('created_at', '<', $ticket->created_at)
            ->count();

        $average = max(1, (int) ($office?->avg_service_minutes ?? 10));
        $eta = $ahead * $average * 60;

        $summary = $office ? $this->officeSummary($office, $ticket->user_id) : null;

        $grace = (int) ($office?->grace_period_seconds ?? 300);
        $deadline = $ticket->called_at?->copy()->addSeconds($grace);
        $remaining = $deadline && ! $ticket->isTerminal() ? max(0, now()->diffInSeconds($deadline, false)) : null;

        return [
            'ticket' => array_merge($ticket->toApiArray(), [
                'position'  => $ahead + 1,
                'issued_at' => $ticket->created_at?->toIso8601String(),
                'eta_seconds' => $eta,
            ]),
            'office'    => $office?->toApiArray(),
            'people_ahead' => $ahead,
            'counts'    => $summary['counts'] ?? ['waiting' => 0, 'in_service' => 0],
            'eta_seconds' => $eta,
            'expected_window' => $summary['expected_window'] ?? null,
            'check_in_deadline' => $deadline?->toIso8601String(),
            'seconds_until_deadline' => $remaining,
            // `can_*` is answered by the policy, not by the status alone: it folds in role, ownership
            // and — for check-in — the platform, so a browser hides the button the server would
            // refuse, and the phone shows the one it is allowed to press.
            'can_check_in' => Gate::allows('checkIn', $ticket),
            'can_approaching' => Gate::allows('approaching', $ticket),
            'can_cancel'   => ! $ticket->isTerminal() && Gate::allows('cancel', $ticket),
            'status_label' => str($ticket->status)->replace('_', ' ')->title()->toString(),
        ];
    }

    /** The number the next ticket at this desk will carry, shown so a student can predict their own. */
    protected function nextTicketNumber(Office $office): string
    {
        $prefix = $office->ticket_prefix ?: strtoupper(substr((string) $office->code, 0, 3));

        $latest = OfficeTicket::where('office_id', $office->id)
            ->whereDate('created_at', Carbon::now())
            ->orderByDesc('created_at')
            ->value('ticket_number');

        $next = 1;

        if ($latest && preg_match('/(\d+)$/', (string) $latest, $m)) {
            $next = (int) $m[1] + 1;
        }

        return $prefix . '-' . sprintf('%03d', $next);
    }
}
