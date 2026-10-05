<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A surveyed point of service on a campus — canteen, library, pharmacy, bank, water point.
 *
 * Seeded from `database/data/yaounde-uy1-facilities.json` (OpenStreetMap, ODbL). An unnamed row is
 * normal and intentional: OSM records many water points and toilet blocks without a name, and the
 * position is still worth showing.
 */
class Facility extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    /** Grouping of raw OSM amenity values, used for filtering in the clients. */
    public const CATEGORIES = [
        'food', 'study', 'health', 'money', 'water', 'sanitation', 'parking', 'worship', 'culture',
    ];

    protected $fillable = [
        'university_id', 'building_id', 'name', 'category', 'osm_amenity', 'lat', 'lng',
        'cuisine', 'phone', 'opening_hours', 'wheelchair', 'is_active', 'osm_type', 'osm_id',
    ];

    protected function casts(): array
    {
        return [
            'lat'       => 'float',
            'lng'       => 'float',
            'is_active' => 'boolean',
            'osm_id'    => 'integer',
        ];
    }

    public function university(): BelongsTo
    {
        return $this->belongsTo(University::class);
    }

    public function building(): BelongsTo
    {
        return $this->belongsTo(Building::class);
    }

    public function osmUrl(): ?string
    {
        if (! $this->osm_type || ! $this->osm_id) {
            return null;
        }

        return "https://www.openstreetmap.org/{$this->osm_type}/{$this->osm_id}";
    }

    /**
     * A label for a facility OSM never named. The category is a surveyed fact; the name is not,
     * so this stays clearly generic rather than impersonating a real business name.
     */
    public function displayName(): string
    {
        if ($this->name) {
            return $this->name;
        }

        return [
            'food'       => 'Unnamed food outlet',
            'study'      => 'Unnamed library',
            'health'     => 'Unnamed health service',
            'money'      => 'Unnamed bank or cash point',
            'water'      => 'Drinking water point',
            'sanitation' => 'Public toilets',
            'parking'    => 'Parking area',
            'worship'    => 'Place of worship',
            'culture'    => 'Cultural venue',
        ][$this->category] ?? 'Unnamed facility';
    }

    public function toApiArray(): array
    {
        return [
            'id'            => $this->id,
            'university_id' => $this->university_id,
            'building_id'   => $this->building_id,
            'name'          => $this->name,
            'display_name'  => $this->displayName(),
            'category'      => $this->category,
            'osm_amenity'   => $this->osm_amenity,
            'lat'           => $this->lat,
            'lng'           => $this->lng,
            'cuisine'       => $this->cuisine,
            'phone'         => $this->phone,
            'opening_hours' => $this->opening_hours,
            'wheelchair'    => $this->wheelchair,
            'osm_url'       => $this->osmUrl(),
        ];
    }
}
