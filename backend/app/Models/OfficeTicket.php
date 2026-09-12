<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OfficeTicket extends Model
{
    use HasUuids;

    protected $table = 'office_tickets';

    protected $fillable = [
        'office_id', 'user_id', 'window_id', 'ticket_number', 'subject', 'notes',
        'status', 'idempotency_key', 'joined_lat', 'joined_lng', 'join_source',
        'called_at', 'service_started_at', 'completed_at', 'cancelled_at', 'cancelled_by',
    ];

    protected $dates = ['called_at', 'service_started_at', 'completed_at', 'cancelled_at'];

    public function office(): BelongsTo  { return $this->belongsTo(Office::class); }
    public function user(): BelongsTo   { return $this->belongsTo(User::class); }
    public function events(): HasMany   { return $this->hasMany(OfficeEvent::class, 'ticket_id')->orderBy('created_at'); }

    /**
     * The numeric tail of the issued ticket number (`REG-007` → 7).
     *
     * There is no `sequence_no` column and there does not need to be one: `ticket_number` is already
     * allocated per office per day under a row lock, so parsing it back is exact and cannot drift.
     */
    public function sequenceNumber(): ?int
    {
        if (preg_match('/(\d+)$/', (string) $this->ticket_number, $m)) {
            return (int) $m[1];
        }

        return null;
    }

    /**
     * Where this ticket stands in its office line, counted the same way every screen counts it.
     *
     * `sequence_no` is the immutable issue order for the day, so position never shifts when someone
     * ahead is cancelled — a student watching "3 ahead" should not see the number jitter because the
     * person in front left the line.
     */
    public function positionInLine(): int
    {
        if ($this->isTerminal()) {
            return 0;
        }

        return (int) static::query()
            ->where('office_id', $this->office_id)
            ->whereIn('status', ['waiting', 'approaching', 'called', 'in_service'])
            ->where('created_at', '<', $this->created_at)
            ->count() + 1;
    }

    public function isTerminal(): bool
    {
        return in_array($this->status, ['completed', 'cancelled', 'no_show']);
    }

    public function toApiArray(): array
    {
        $office = $this->relationLoaded('office') ? $this->office : null;

        return [
            'id'                  => $this->id,
            'office_id'           => $this->office_id,
            'office_name'         => $office?->name,
            'office_code'         => $office?->code,
            'ticket_number'       => $this->ticket_number,
            'subject'             => $this->subject,
            'notes'               => $this->notes,
            'status'              => $this->status,
            'window_id'           => $this->window_id,
            'sequence_no'         => $this->sequenceNumber(),
            'position'            => $this->positionInLine(),
            'join_source'         => $this->join_source,
            'joined_at'           => $this->created_at?->toIso8601String(),
            'called_at'           => $this->called_at?->toIso8601String(),
            'service_started_at'  => $this->service_started_at?->toIso8601String(),
            'completed_at'        => $this->completed_at?->toIso8601String(),
            'cancelled_at'        => $this->cancelled_at?->toIso8601String(),
        ];
    }
}
