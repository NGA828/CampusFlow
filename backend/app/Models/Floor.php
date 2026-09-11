<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Floor extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'building_id', 'code', 'name', 'level',
        'plan_svg', 'plan_url', 'plan_width_m', 'plan_height_m', 'status',
    ];

    protected function casts(): array
    {
        return [
            'level'        => 'integer',
            'plan_svg'     => 'array',
            'plan_width_m' => 'float',
            'plan_height_m'=> 'float',
        ];
    }

    public function building(): BelongsTo
    {
        return $this->belongsTo(Building::class);
    }

    public function rooms(): HasMany
    {
        return $this->hasMany(Room::class);
    }

    public function toApiArray(): array
    {
        return [
            'id'            => $this->id,
            'building_id'   => $this->building_id,
            'code'          => $this->code,
            'name'          => $this->name,
            'level'         => $this->level,
            'plan_url'      => $this->plan_url,
            'plan_width_m'  => $this->plan_width_m,
            'plan_height_m' => $this->plan_height_m,
            'status'        => $this->status,
        ];
    }
}
