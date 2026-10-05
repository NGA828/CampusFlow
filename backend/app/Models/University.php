<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * An institution in the Yaoundé higher-education map.
 *
 * Rows are seeded from `database/data/yaounde-universities.json`, harvested from OpenStreetMap.
 * A null column means OSM holds no value for that institution — it is never filled with a guess,
 * so the clients must treat null as "unknown", not as "absent".
 */
class University extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'code', 'name', 'name_en', 'short_name', 'type', 'operator', 'description',
        'lat', 'lng', 'boundary', 'website', 'email', 'phone', 'address', 'wikipedia',
        'logo_url', 'established', 'wheelchair', 'is_primary', 'status', 'osm_type', 'osm_id',
    ];

    protected function casts(): array
    {
        return [
            'lat'        => 'float',
            'lng'        => 'float',
            'boundary'   => 'array',
            'is_primary' => 'boolean',
            'osm_id'     => 'integer',
        ];
    }

    public function buildings(): HasMany
    {
        return $this->hasMany(Building::class);
    }

    /** The institution this deployment actually operates queues, offices and timetables for. */
    public static function primary(): ?self
    {
        return static::where('is_primary', true)->first();
    }

    /** Link back to the upstream OSM feature so any seeded value can be re-verified. */
    public function osmUrl(): ?string
    {
        if (! $this->osm_type || ! $this->osm_id) {
            return null;
        }

        return "https://www.openstreetmap.org/{$this->osm_type}/{$this->osm_id}";
    }

    public function toApiArray(): array
    {
        return [
            'id'             => $this->id,
            'code'           => $this->code,
            'name'           => $this->name,
            'name_en'        => $this->name_en,
            'short_name'     => $this->short_name,
            'type'           => $this->type,
            'operator'       => $this->operator,
            'description'    => $this->description,
            'lat'            => $this->lat,
            'lng'            => $this->lng,
            'boundary'       => $this->boundary,
            'website'        => $this->website,
            'email'          => $this->email,
            'phone'          => $this->phone,
            'address'        => $this->address,
            'wikipedia'      => $this->wikipedia,
            'logo_url'       => $this->logo_url,
            'established'    => $this->established,
            'wheelchair'     => $this->wheelchair,
            'is_primary'     => (bool) $this->is_primary,
            'status'         => $this->status,
            'osm_url'        => $this->osmUrl(),
            'buildings_count' => $this->buildings_count ?? $this->buildings()->count(),
        ];
    }
}
