<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Building extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'code', 'name', 'short_name', 'description', 'address', 'lat', 'lng',
        'footprint', 'image_url', 'status', 'is_public', 'floors_count',
    ];

    protected function casts(): array
    {
        return [
            'lat'          => 'float',
            'lng'          => 'float',
            'footprint'    => 'array',
            'floors_count' => 'integer',
            'is_public'    => 'boolean',
        ];
    }

    public function floors(): HasMany
    {
        return $this->hasMany(Floor::class);
    }

    public function qrNodes(): HasMany
    {
        return $this->hasMany(QrNode::class);
    }

    public function toApiArray(): array
    {
        return [
            'id'           => $this->id,
            'code'         => $this->code,
            'name'         => $this->name,
            'short_name'   => $this->short_name,
            'description'  => $this->description,
            'address'      => $this->address,
            'is_public'    => (bool) ($this->is_public ?? true),
            'lat'          => $this->lat,
            'lng'          => $this->lng,
            'footprint'    => $this->footprint,
            'image_url'    => $this->image_url,
            'status'       => $this->status,
            'floors_count' => $this->floors_count,
        ];
    }
}
