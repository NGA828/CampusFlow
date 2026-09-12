<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class RoomQueue extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'room_queues';

    protected $fillable = [
        'room_id', 'is_open', 'capacity', 'max_capacity', 'current_count',
        'call_window_minutes', 'no_show_grace_minutes', 'proximity_radius_m',
        'join_requires_proximity', 'allow_multiple_active_tickets', 'avg_service_minutes',
        'mode', 'welcome_message',
    ];

    protected function casts(): array
    {
        return [
            'is_open'              => 'boolean',
            'capacity'             => 'integer',
            'max_capacity'         => 'integer',
            'current_count'        => 'integer',
            'call_window_minutes'    => 'integer',
            'no_show_grace_minutes'  => 'integer',
            'proximity_radius_m'     => 'float',
            'join_requires_proximity'   => 'boolean',
            'allow_multiple_active_tickets' => 'boolean',
            'avg_service_minutes'    => 'integer',
        ];
    }

    public function room()    { return $this->belongsTo(Room::class); }
    public function tickets() { return $this->hasMany(QueueTicket::class, 'queue_id'); }

    public function activeTickets()
    {
        return $this->tickets()->whereNotIn('status', ['completed', 'cancelled', 'no_show']);
    }

    public function toApiArray(): array
    {
        return [
            'id'                    => $this->id,
            'room_id'               => $this->room_id,
            'is_open'               => $this->is_open,
            'capacity'              => $this->capacity,
            'max_capacity'          => $this->max_capacity,
            'current_count'         => $this->current_count,
            'available'             => max(0, $this->capacity - $this->current_count),
            'call_window_minutes'   => $this->call_window_minutes,
            'no_show_grace_minutes' => $this->no_show_grace_minutes,
            'proximity_radius_m'    => $this->proximity_radius_m,
            'join_requires_proximity'      => (bool) ($this->join_requires_proximity ?? true),
            'allow_multiple_active_tickets'=> (bool) ($this->allow_multiple_active_tickets ?? false),
            'avg_service_minutes'   => $this->avg_service_minutes,
            'mode'                  => $this->mode,
            'welcome_message'       => $this->welcome_message,
        ];
    }
}
