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
    public function toApiArray(): array {
        return ['id'=>$this->id,'title'=>$this->title,'body'=>$this->body,'priority'=>$this->priority,
                'target_roles'=>$this->target_roles,'published_at'=>$this->published_at?->toIso8601String(),
                'expires_at'=>$this->expires_at?->toIso8601String()];
    }
}
