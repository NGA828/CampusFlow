<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class QrNode extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $table = 'qr_nodes';

    protected $fillable = [
        'code', 'label', 'building_id', 'floor_id', 'room_id',
        'lat', 'lng', 'plan_x', 'plan_y', 'type', 'version', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'lat'       => 'float',
            'lng'       => 'float',
            'plan_x'    => 'float',
            'plan_y'    => 'float',
            'version'   => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function building()   { return $this->belongsTo(Building::class); }
    public function floor()      { return $this->belongsTo(Floor::class); }
    public function room()       { return $this->belongsTo(Room::class); }

    public function toApiArray(): array
    {
        return [
            'id'          => $this->id,
            'code'        => $this->code,
            'label'       => $this->label,
            'building_id' => $this->building_id,
            'floor_id'    => $this->floor_id,
            'room_id'     => $this->room_id,
            'lat'         => $this->lat,
            'lng'         => $this->lng,
            'plan_x'      => $this->plan_x,
            'plan_y'      => $this->plan_y,
            'type'        => $this->type,
            'version'     => $this->version,
            'is_active'   => $this->is_active,
        ];
    }
}
