<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class QrNode extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $table = 'qr_nodes';

    protected $fillable = [
        'code', 'label', 'building_id', 'floor_id', 'room_id',
        'lat', 'lng', 'plan_x', 'plan_y', 'type', 'version', 'is_active', 'secret',
    ];

    /**
     * Every anchor gets a signing secret on creation, so a printed graphic can always be signed.
     */
    protected static function booted(): void
    {
        static::creating(function (self $node): void {
            if (blank($node->secret)) {
                $node->secret = Str::random(64);
            }
        });
    }

    /** HMAC over the parts of the payload a student must not be able to change. */
    public function payloadSignature(): string
    {
        return hash_hmac('sha256', $this->code . '|' . $this->version, (string) $this->secret);
    }

    /** The string encoded in the printed graphic and read by the phone camera. */
    public function signedPayload(): string
    {
        return 'CF1|' . $this->code . '|' . $this->version . '|' . $this->payloadSignature();
    }

    public function signatureIsValid(?string $signature): bool
    {
        return filled($this->secret) && filled($signature) && hash_equals($this->payloadSignature(), $signature);
    }

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
    public function navNode()    { return $this->hasOne(NavigationNode::class, 'qr_node_id'); }

    public function toApiArray(): array
    {
        return [
            'id'          => $this->id,
            'code'        => $this->code,
            'label'       => $this->label,
            'building_id' => $this->building_id,
            'floor_id'    => $this->floor_id,
            'room_id'     => $this->room_id,
            'nav_node_id' => $this->relationLoaded('navNode') ? $this->navNode?->id : $this->navNode()->value('id'),
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
