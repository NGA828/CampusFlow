<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class QueueTicket extends Model
{
    use HasUuids;

    protected $table = 'queue_tickets';

    protected $fillable = [
        'queue_id', 'user_id', 'position', 'status', 'idempotency_key',
        'joined_lat', 'joined_lng', 'joined_plan_x', 'joined_plan_y',
        'joined_floor_id', 'join_source',
        'called_at', 'checked_in_at', 'admitted_at', 'completed_at',
        'cancelled_at', 'cancelled_by',
    ];

    protected $dates = [
        'called_at', 'checked_in_at', 'admitted_at',
        'completed_at', 'cancelled_at',
    ];

    protected function casts(): array
    {
        return [
            'position'      => 'integer',
            'joined_lat'    => 'float',
            'joined_lng'    => 'float',
            'joined_plan_x' => 'float',
            'joined_plan_y' => 'float',
            'called_at'     => 'datetime',
            'checked_in_at' => 'datetime',
            'admitted_at'   => 'datetime',
            'completed_at'  => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function queue(): BelongsTo   { return $this->belongsTo(RoomQueue::class, 'queue_id'); }
    public function user(): BelongsTo    { return $this->belongsTo(User::class); }
    public function events(): HasMany    { return $this->hasMany(QueueEvent::class, 'ticket_id')->orderBy('created_at'); }

    public function isTerminal(): bool
    {
        return in_array($this->status, ['completed', 'cancelled', 'no_show']);
    }

    /** Display ticket number. Derived from the position so it is stable and never collides. */
    public function ticketNumber(): string
    {
        return 'Q-' . str_pad((string) $this->position, 3, '0', STR_PAD_LEFT);
    }

    /**
     * The instant at which a called ticket becomes a no-show: the queue's own grace window measured
     * from when the student was called. Derived rather than stored, so changing an administrator's
     * `call_window_minutes` applies to the tickets already on the line instead of stranding them.
     */
    public function checkInDeadline(): ?\Carbon\Carbon
    {
        if (! $this->called_at || $this->isTerminal()) {
            return null;
        }

        $queue = $this->relationLoaded('queue') ? $this->queue : $this->queue()->first();
        $grace = (int) ($queue?->no_show_grace_minutes ?? $queue?->call_window_minutes ?? 5);

        return $this->called_at->copy()->addMinutes(max(1, $grace));
    }

    public function secondsUntilDeadline(): ?int
    {
        $deadline = $this->checkInDeadline();

        return $deadline ? max(0, now()->diffInSeconds($deadline, false)) : null;
    }

    public function canStudentCheckIn(): bool
    {
        return in_array($this->status, ['waiting', 'called', 'navigating'], true);
    }

    public function toApiArray(): array
    {
        $queue = $this->relationLoaded('queue') ? $this->queue : null;
        $room  = $queue?->relationLoaded('room') ? $queue->room : null;

        return [
            'id'              => $this->id,
            'queue_id'        => $this->queue_id,
            'room_id'         => $room?->id,
            'room_code'       => $room?->code,
            'room_name'       => $room?->name,
            'position'        => $this->position,
            'status'          => $this->status,
            'join_source'     => $this->join_source,
            'joined_at'       => $this->created_at?->toIso8601String(),
            'called_at'       => $this->called_at?->toIso8601String(),
            'checked_in_at'   => $this->checked_in_at?->toIso8601String(),
            'admitted_at'     => $this->admitted_at?->toIso8601String(),
            'completed_at'    => $this->completed_at?->toIso8601String(),
            'cancelled_at'    => $this->cancelled_at?->toIso8601String(),
            'ticket_number'   => $this->ticketNumber(),
            'check_in_deadline'      => $this->checkInDeadline()?->toIso8601String(),
            'seconds_until_deadline' => $this->secondsUntilDeadline(),
            'can_check_in'    => $this->canStudentCheckIn(),
            'can_cancel'      => ! $this->isTerminal(),
        ];
    }
}
