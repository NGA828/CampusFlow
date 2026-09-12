<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A labelled geographic zone used for proximity triggers: "inside the library", "at the registrar
 * door", "on the north lawn".
 *
 * The queue and office engines consult a geofence before falling back to a room's own coordinates,
 * so "you must be there to take a ticket" is a spatial decision an administrator can shape (radius
 * or polygon, active or not) rather than a fixed number welded to a room.
 */
class Geofence extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'geofences';

    protected $fillable = [
        'name', 'type', 'building_id', 'floor_id', 'room_id',
        'center_lat', 'center_lng', 'radius_m', 'polygon_json', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'center_lat'  => 'float',
            'center_lng'  => 'float',
            'radius_m'    => 'float',
            'polygon_json'=> 'array',
            'is_active'   => 'boolean',
        ];
    }

    public function building(): BelongsTo { return $this->belongsTo(Building::class); }
    public function floor(): BelongsTo    { return $this->belongsTo(Floor::class); }
    public function room(): BelongsTo     { return $this->belongsTo(Room::class); }

    public function isPolygon(): bool
    {
        return $this->radius_m === null && ! empty($this->polygon_json);
    }

    /** Great-circle distance in metres — the same approximation the routing engine uses. */
    public function distanceTo(?float $lat, ?float $lng): ?float
    {
        if ($lat === null || $lng === null || $this->center_lat === null || $this->center_lng === null) {
            return null;
        }

        $dLat = deg2rad($lat - (float) $this->center_lat);
        $dLng = deg2rad($lng - (float) $this->center_lng);
        $a = sin($dLat / 2) ** 2
            + cos(deg2rad((float) $this->center_lat)) * cos(deg2rad($lat)) * sin($dLng / 2) ** 2;

        return 2 * 6371000 * asin(min(1.0, sqrt($a)));
    }

    public function contains(?float $lat, ?float $lng): bool
    {
        if ($this->is_active !== true) {
            return false;
        }

        if ($this->radius_m !== null) {
            $distance = $this->distanceTo($lat, $lng);

            return $distance !== null && $distance <= (float) $this->radius_m;
        }

        // Polygon mode: point-in-ring on planar lat/lng is adequate for campus-scale shapes, and the
        // projection to PostGIS geometry is tracked in docs/implementation-audit.md.
        $ring = $this->polygonCoordinates();

        if (count($ring) < 3 || $lat === null || $lng === null) {
            return false;
        }

        $inside = false;
        $points = count($ring);

        for ($i = 0, $j = $points - 1; $i < $points; $j = $i++) {
            [$xi, $yi] = $ring[$i];
            [$xj, $yj] = $ring[$j];

            $intersects = (($yi > $lng) !== ($yj > $lng))
                && ($lat < (($xj - $xi) * ($lng - $yi)) / (($yj - $yi) ?: 1e-9) + $xi);

            if ($intersects) {
                $inside = ! $inside;
            }
        }

        return $inside;
    }

    /** @return list<array{0: float, 1: float}> [lat, lng] pairs */
    public function polygonCoordinates(): array
    {
        $polygon = $this->polygon_json;

        if (! is_array($polygon)) {
            return [];
        }

        $ring = $polygon['coordinates'][0] ?? $polygon[0] ?? [];

        return array_values(array_map(
            fn ($point) => [(float) ($point[0] ?? 0), (float) ($point[1] ?? 0)],
            is_array($ring) ? $ring : [],
        ));
    }

    public function toApiArray(): array
    {
        return [
            'id'          => $this->id,
            'name'        => $this->name,
            'type'        => $this->type,
            'building_id' => $this->building_id,
            'floor_id'    => $this->floor_id,
            'room_id'     => $this->room_id,
            'center_lat'  => $this->center_lat,
            'center_lng'  => $this->center_lng,
            'radius_m'    => $this->radius_m,
            'polygon_json'=> $this->polygon_json,
            'is_active'   => (bool) $this->is_active,
            'building_code' => $this->building?->code,
            'floor_name'    => $this->floor?->name,
            'room_code'     => $this->room?->code,
        ];
    }
}
