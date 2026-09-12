<?php namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
class Announcement extends Model {
    use HasUuids, SoftDeletes;
    protected $fillable = ['title','body','priority','target_roles','created_by','published_at','expires_at'];
    protected $dates = ['published_at','expires_at'];
    protected function casts(): array { return ['target_roles'=>'array','published_at'=>'datetime','expires_at'=>'datetime']; }
    public function creator() { return $this->belongsTo(User::class,'created_by'); }

    /**
     * Announcements this reader should be able to see.
     *
     * A null `target_roles` means the whole campus; anything else is an explicit allow-list of role codes.
     * An expiry is honoured here rather than in each screen, because "the notice stopped showing" must not
     * depend on whether a particular client remembered to filter — the phone, the browser and the public
     * site all read through this scope.
     */
    public function scopeVisibleTo($query, ?User $user = null)
    {
        return $query->whereNotNull('published_at')
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->where(fn ($q) => $q->whereNull('target_roles')
                ->orWhereJsonContains('target_roles', $user?->role_code ?? 'student')
                ->orWhereJsonContains('target_roles', 'all'));
    }
    public function toApiArray(): array {
        return ['id'=>$this->id,'title'=>$this->title,'body'=>$this->body,'priority'=>$this->priority,
                'target_roles'=>$this->target_roles,'published_at'=>$this->published_at?->toIso8601String(),
                'expires_at'=>$this->expires_at?->toIso8601String()];
    }
}
