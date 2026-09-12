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
        'code', 'ticket_prefix', 'name', 'description', 'room_id', 'status', 'is_open',
        'opening_hours', 'phone', 'email', 'image_url', 'avg_service_minutes',
        'concurrent_capacity', 'check_in_radius_m', 'daily_capacity', 'requires_appointment',
        'grace_period_seconds', 'requires_proximity_to_request',
        // Write-only aliases: the Admin Web form speaks product language, the table keeps its shape.
        'service_duration_minutes', 'contact_email', 'contact_phone', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_open'              => 'boolean',
            'avg_service_minutes'  => 'integer',
            'concurrent_capacity'  => 'integer',
            'check_in_radius_m'    => 'float',
            'daily_capacity'       => 'integer',
            'requires_appointment' => 'boolean',
            'requires_proximity_to_request' => 'boolean',
            'grace_period_seconds' => 'integer',
        ];
    }

    /**
     * The admin console edits `service_duration_minutes`, `contact_email`, `contact_phone` and
     * `is_active`; the table stores `avg_service_minutes`, `email`, `phone` and `status`.
     *
     * Aliasing here instead of duplicating columns keeps one source of truth, and it is why an
     * administrator's edit now persists instead of being silently dropped by a mass-assignment filter.
     */
    public function setServiceDurationMinutesAttribute($value): void { $this->attributes['avg_service_minutes'] = (int) $value; }
    public function setContactEmailAttribute($value): void   { $this->attributes['email'] = $value ?: null; }
    public function setContactPhoneAttribute($value): void   { $this->attributes['phone'] = $value ?: null; }
    public function setIsActiveAttribute($value): void       { $this->attributes['status'] = filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 'active' : 'inactive'; }

    public function isEffectivelyOpen(): bool
    {
        return $this->status === 'active' && (bool) $this->is_open;
    }

    public function room(): BelongsTo      { return $this->belongsTo(Room::class); }
    public function tickets(): HasMany     { return $this->hasMany(OfficeTicket::class); }
    public function windows(): HasMany     { return $this->hasMany(OfficeServiceWindow::class); }
    public function serviceWindows(): HasMany { return $this->hasMany(OfficeServiceWindow::class); }
    public function staffPivot(): HasMany  { return $this->hasMany(OfficeStaff::class); }
    public function staff(): HasMany       { return $this->hasMany(OfficeStaff::class); }

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
            'ticket_prefix'        => $this->ticket_prefix ?: strtoupper(substr($this->code, 0, 3)),
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
            'service_duration_minutes' => (int) ($this->avg_service_minutes ?? 10),
            'daily_capacity'       => $this->daily_capacity === null ? null : (int) $this->daily_capacity,
            'daily_capacity_used'  => null,
            'requires_appointment' => (bool) $this->requires_appointment,
            'requires_proximity_to_request' => (bool) $this->requires_proximity_to_request,
            'grace_period_seconds' => (int) ($this->grace_period_seconds ?? 300),
            'contact_email'        => $this->email,
            'contact_phone'        => $this->phone,
            'is_active'            => $this->status === 'active',
            'building_id'          => $this->room?->floor?->building_id,
            'floor_id'             => $this->room?->floor_id,
            'building_code'        => $this->room?->floor?->building?->code,
            'building_name'        => $this->room?->floor?->building?->name,
            'floor_name'           => $this->room?->floor?->name,
            'room_code'            => $this->room?->code,
            'room_name'            => $this->room?->name,
            'room_lat'             => $this->room?->lat,
            'room_lng'             => $this->room?->lng,
            'concurrent_capacity'  => (int) ($this->concurrent_capacity ?? 1),
            'check_in_radius_m'    => (float) ($this->check_in_radius_m ?? 75.0),
        ];
    }
}
