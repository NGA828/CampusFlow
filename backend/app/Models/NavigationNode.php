<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class NavigationNode extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'navigation_nodes';

    protected $fillable = [
        'label', 'type', 'building_id', 'floor_id', 'room_id', 'qr_node_id',
        'lat', 'lng', 'plan_x', 'plan_y', 'is_accessible', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'lat'           => 'float',
            'lng'           => 'float',
            'plan_x'        => 'float',
            'plan_y'        => 'float',
            'is_accessible' => 'boolean',
            'is_active'     => 'boolean',
        ];
    }

    public function building()  { return $this->belongsTo(Building::class); }
    public function floor()     { return $this->belongsTo(Floor::class); }
    public function room()      { return $this->belongsTo(Room::class); }
    public function qrNode()    { return $this->belongsTo(QrNode::class,'qr_node_id'); }

    public function edgesFrom() { return $this->hasMany(NavigationEdge::class,'from_node_id'); }
    public function edgesTo()   { return $this->hasMany(NavigationEdge::class,'to_node_id'); }

    public function toApiArray(): array
    {
        return [
            'id'            => $this->id,
            'label'         => $this->label,
            'type'          => $this->type,
            'building_id'   => $this->building_id,
            'floor_id'      => $this->floor_id,
            'room_id'       => $this->room_id,
            'qr_node_id'    => $this->qr_node_id,
            'lat'           => $this->lat,
            'lng'           => $this->lng,
            'plan_x'        => $this->plan_x,
            'plan_y'        => $this->plan_y,
            'is_accessible' => $this->is_accessible,
            'is_active'     => $this->is_active,
        ];
    }
}
