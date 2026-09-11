<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserPosition extends Model
{
    protected $table = 'user_positions';

    protected $fillable = [
        'user_id', 'lat', 'lng', 'plan_x', 'plan_y', 'accuracy_m',
        'building_id', 'floor_id', 'room_id', 'source', 'recorded_at',
    ];

    protected function casts(): array
    {
        return [
            'lat'         => 'float',
            'lng'         => 'float',
            'plan_x'      => 'float',
            'plan_y'      => 'float',
            'accuracy_m'  => 'float',
            'recorded_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo     { return $this->belongsTo(User::class); }
    public function building(): BelongsTo { return $this->belongsTo(Building::class); }
    public function floor(): BelongsTo    { return $this->belongsTo(Floor::class); }
    public function room(): BelongsTo     { return $this->belongsTo(Room::class); }
}
