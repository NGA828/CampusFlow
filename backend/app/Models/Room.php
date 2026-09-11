<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Room extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'floor_id', 'code', 'name', 'type', 'capacity', 'area_m2',
        'plan_x', 'plan_y', 'lat', 'lng', 'features',
        'requires_admission', 'status', 'image_url',
    ];

    protected function casts(): array
    {
        return [
            'capacity'          => 'integer',
            'area_m2'           => 'float',
            'plan_x'            => 'float',
            'plan_y'            => 'float',
            'lat'               => 'float',
            'lng'               => 'float',
            'features'          => 'array',
            'requires_admission'=> 'boolean',
        ];
    }

    public function floor(): BelongsTo
    {
        return $this->belongsTo(Floor::class);
    }

    public function queue(): HasOne
    {
        return $this->hasOne(RoomQueue::class);
    }

    public function toApiArray(bool $withAvailability = false): array
    {
        $floor    = $this->relationLoaded('floor') ? $this->floor : null;
        $building = $floor?->relationLoaded('building') ? $floor->building : null;

        $base = [
            'id'                 => $this->id,
            'floor_id'           => $this->floor_id,
            'code'               => $this->code,
            'name'               => $this->name,
            'type'               => $this->type,
            'capacity'           => $this->capacity,
            'area_m2'            => $this->area_m2,
            'plan_x'             => $this->plan_x,
            'plan_y'             => $this->plan_y,
            'lat'                => $this->lat,
            'lng'                => $this->lng,
            'features'           => $this->features ?? [],
            'requires_admission' => $this->requires_admission,
            'status'             => $this->status,
            'image_url'          => $this->image_url,
            'building_code'      => $building?->code,
            'building_name'      => $building?->name,
            'floor_code'         => $floor?->code,
            'floor_name'         => $floor?->name,
            'floor_level'        => $floor?->level,
        ];

        if ($withAvailability && $this->relationLoaded('queue')) {
            $q = $this->queue;
            $base['queue'] = $q ? [
                'id'            => $q->id,
                'is_open'       => $q->is_open,
                'capacity'      => $q->capacity,
                'current_count' => $q->current_count,
                'available'     => max(0, $q->capacity - $q->current_count),
            ] : null;
        }

        return $base;
    }
}
