<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Office extends Model
{
    use HasUuids, SoftDeletes;

    protected $fillable = [
        'code', 'name', 'description', 'room_id', 'status', 'is_open',
        'opening_hours', 'phone', 'email', 'image_url', 'avg_service_minutes',
    ];

    protected function casts(): array
    {
        return [
            'is_open'              => 'boolean',
            'avg_service_minutes'  => 'integer',
        ];
    }

    public function room(): BelongsTo      { return $this->belongsTo(Room::class); }
    public function tickets(): HasMany     { return $this->hasMany(OfficeTicket::class); }
    public function windows(): HasMany     { return $this->hasMany(OfficeServiceWindow::class); }
    public function serviceWindows(): HasMany { return $this->hasMany(OfficeServiceWindow::class); }
    public function staffPivot(): HasMany  { return $this->hasMany(OfficeStaff::class); }

    public function activeTickets()
    {
        return $this->tickets()->whereNotIn('status', ['completed', 'cancelled', 'no_show']);
    }

    public function waitingCount(): int
    {
        return $this->activeTickets()->where('status', 'waiting')->count();
    }

    public function toApiArray(): array
    {
        return [
            'id'                   => $this->id,
            'code'                 => $this->code,
            'name'                 => $this->name,
            'description'          => $this->description,
            'room_id'              => $this->room_id,
            'status'               => $this->status,
            'is_open'              => $this->is_open,
            'opening_hours'        => $this->opening_hours,
            'phone'                => $this->phone,
            'email'                => $this->email,
            'image_url'            => $this->image_url,
            'avg_service_minutes'  => $this->avg_service_minutes,
        ];
    }
}
