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
        ];
    }

    public function queue(): BelongsTo   { return $this->belongsTo(RoomQueue::class, 'queue_id'); }
    public function user(): BelongsTo    { return $this->belongsTo(User::class); }
    public function events(): HasMany    { return $this->hasMany(QueueEvent::class, 'ticket_id')->orderBy('created_at'); }

    public function isTerminal(): bool
    {
        return in_array($this->status, ['completed', 'cancelled', 'no_show']);
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
        ];
    }
}
