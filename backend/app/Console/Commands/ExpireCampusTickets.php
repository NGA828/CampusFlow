<?php

namespace App\Console\Commands;

use App\Models\OfficeTicket;
use App\Models\QueueTicket;
use App\Services\Notifications\NotificationFanOut;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ExpireCampusTickets extends Command
{
    protected $signature = 'campusflow:tickets:expire';

    protected $description = 'Expire unattended queue tickets and mark missed calls as no-shows';

    public function handle(NotificationFanOut $notifications): int
    {
        $now = now();
        $waitingTtl = $this->waitingTicketTtlMinutes();
        $expiredWaiting = 0;
        $missedQueueCalls = 0;
        $missedOfficeCalls = 0;

        QueueTicket::query()
            ->where('status', 'waiting')
            ->where('created_at', '<=', $now->copy()->subMinutes($waitingTtl))
            ->orderBy('id')
            ->chunkById(200, function ($tickets) use (&$expiredWaiting, $notifications, $waitingTtl): void {
                foreach ($tickets as $candidate) {
                    $expired = DB::transaction(function () use ($candidate, $waitingTtl): ?QueueTicket {
                        $ticket = QueueTicket::whereKey($candidate->id)->lockForUpdate()->first();

                        if (! $ticket || $ticket->status !== 'waiting' || $ticket->created_at->gt(now()->subMinutes($waitingTtl))) {
                            return null;
                        }

                        $ticket->update([
                            'status' => 'cancelled',
                            'cancelled_at' => now(),
                            'cancelled_by' => 'system',
                        ]);
                        DB::table('queue_events')->insert([
                            'ticket_id' => $ticket->id,
                            'type' => 'expired',
                            'metadata' => json_encode(['reason' => 'waiting_timeout', 'expired_by' => 'system']),
                            'created_at' => now(),
                        ]);

                        return $ticket->fresh();
                    });

                    if ($expired) {
                        $expiredWaiting++;
                        $notifications->toUsers(
                            [(string) $expired->user_id],
                            'queue_expired',
                            'Your queue ticket expired',
                            'The line was closed because the ticket was not called in time.',
                            ['ticket_id' => $expired->id, 'queue_id' => $expired->queue_id],
                        );
                    }
                }
            });

        QueueTicket::query()
            ->with('queue')
            ->whereIn('status', ['called', 'navigating'])
            ->whereNotNull('called_at')
            ->orderBy('id')
            ->chunkById(200, function ($tickets) use (&$missedQueueCalls, $notifications): void {
                foreach ($tickets as $candidate) {
                    $expired = DB::transaction(function () use ($candidate): ?QueueTicket {
                        $ticket = QueueTicket::with('queue')->whereKey($candidate->id)->lockForUpdate()->first();

                        if (! $ticket || ! in_array($ticket->status, ['called', 'navigating'], true)) {
                            return null;
                        }

                        $deadline = $ticket->checkInDeadline();
                        if (! $deadline || $deadline->isFuture()) {
                            return null;
                        }

                        $ticket->update([
                            'status' => 'no_show',
                            'cancelled_at' => now(),
                            'cancelled_by' => 'system',
                        ]);
                        DB::table('queue_events')->insert([
                            'ticket_id' => $ticket->id,
                            'type' => 'no_show',
                            'metadata' => json_encode(['reason' => 'check_in_timeout', 'marked_by' => 'system']),
                            'created_at' => now(),
                        ]);

                        return $ticket->fresh();
                    });

                    if ($expired) {
                        $missedQueueCalls++;
                        $notifications->toUsers(
                            [(string) $expired->user_id],
                            'queue_no_show',
                            'Your queue call expired',
                            'The check-in window ended before you arrived.',
                            ['ticket_id' => $expired->id, 'queue_id' => $expired->queue_id],
                        );
                    }
                }
            });

        OfficeTicket::query()
            ->with('office')
            ->whereIn('status', ['called', 'approaching'])
            ->whereNotNull('called_at')
            ->orderBy('id')
            ->chunkById(200, function ($tickets) use (&$missedOfficeCalls, $notifications): void {
                foreach ($tickets as $candidate) {
                    $expired = DB::transaction(function () use ($candidate): ?OfficeTicket {
                        $ticket = OfficeTicket::with('office')->whereKey($candidate->id)->lockForUpdate()->first();

                        if (! $ticket || ! in_array($ticket->status, ['called', 'approaching'], true) || ! $ticket->called_at) {
                            return null;
                        }

                        $graceSeconds = max(1, (int) ($ticket->office?->grace_period_seconds ?? 300));
                        if ($ticket->called_at->copy()->addSeconds($graceSeconds)->isFuture()) {
                            return null;
                        }

                        $ticket->update([
                            'status' => 'no_show',
                            'cancelled_at' => now(),
                            'cancelled_by' => 'system',
                        ]);
                        DB::table('office_events')->insert([
                            'ticket_id' => $ticket->id,
                            'type' => 'no_show',
                            'metadata' => json_encode(['reason' => 'check_in_timeout', 'marked_by' => 'system']),
                            'created_at' => now(),
                        ]);

                        return $ticket->fresh();
                    });

                    if ($expired) {
                        $missedOfficeCalls++;
                        $notifications->toUsers(
                            [(string) $expired->user_id],
                            'office_no_show',
                            'Your office call expired',
                            'The check-in window ended before you arrived.',
                            ['ticket_id' => $expired->id, 'office_id' => $expired->office_id],
                        );
                    }
                }
            });

        $this->info(sprintf(
            'Expired %d waiting tickets; marked %d room-queue and %d office no-shows.',
            $expiredWaiting,
            $missedQueueCalls,
            $missedOfficeCalls,
        ));

        return self::SUCCESS;
    }

    private function waitingTicketTtlMinutes(): int
    {
        $stored = DB::table('settings')->where('key', 'queue_auto_expire_mins')->value('value');
        $decoded = is_string($stored) ? json_decode($stored, true) : $stored;
        $minutes = is_numeric($decoded) ? (int) $decoded : 10;

        return max(1, min($minutes, 1440));
    }
}
