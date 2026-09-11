<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class QueueEvent extends Model
{
    use HasUuids;

    protected $table    = 'queue_events';
    public    $timestamps = false;

    protected $fillable = ['ticket_id', 'type', 'metadata', 'created_at'];

    protected function casts(): array
    {
        return [
            'metadata'   => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function ticket() { return $this->belongsTo(QueueTicket::class, 'ticket_id'); }
}
