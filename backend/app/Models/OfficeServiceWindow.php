<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One recurring service window at a desk — "Registrar, Mondays, 08:00–12:00, 20 per rotation".
 *
 * Windows are the unit staff operate against: a ticket is called *to* a window, and the student's
 * "expected window" is derived from the windows running today. Configuration belongs to Admin Web
 * (`permission:office.configure`); staff never edit the schedule, only who is standing at the desk.
 */
class OfficeServiceWindow extends Model
{
    use HasUuids;

    protected $table = 'office_service_windows';

    protected $fillable = [
        'office_id', 'name', 'status', 'day_of_week', 'opens_at', 'closes_at',
        'capacity', 'avg_service_minutes', 'is_active', 'served_by_user_id',
        'label',
    ];

    /** The console calls it a label, the column calls it a name. */
    public function setLabelAttribute($value): void { $this->attributes['name'] = $value; }

    protected function casts(): array
    {
        return [
            'day_of_week'       => 'integer',
            'capacity'          => 'integer',
            'avg_service_minutes' => 'integer',
            'is_active'         => 'boolean',
        ];
    }

    public function office(): BelongsTo   { return $this->belongsTo(Office::class); }
    public function servedBy(): BelongsTo { return $this->belongsTo(User::class, 'served_by_user_id'); }

    public function isOpenNow(): bool
    {
        if (! $this->is_active || $this->status !== 'active') {
            return false;
        }

        $now = now();

        return (int) $this->day_of_week === (int) $now->dayOfWeek
            && $now->format('H:i') >= substr((string) $this->opens_at, 0, 5)
            && $now->format('H:i') < substr((string) $this->closes_at, 0, 5);
    }

    public function toApiArray(): array
    {
        return [
            'id'                => $this->id,
            'office_id'         => $this->office_id,
            'name'              => $this->name,
            'label'             => $this->name,
            'day_of_week'       => (int) $this->day_of_week,
            'opens_at'          => substr((string) $this->opens_at, 0, 5),
            'closes_at'         => substr((string) $this->closes_at, 0, 5),
            'capacity'          => (int) $this->capacity,
            'avg_service_minutes' => (int) $this->avg_service_minutes,
            'is_active'         => (bool) $this->is_active,
            'served_by'         => $this->servedBy?->name,
            'status'            => $this->status,
        ];
    }
}
