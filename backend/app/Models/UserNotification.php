<?php namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
class UserNotification extends Model {
    use HasUuids;
    protected $table = 'notifications';
    protected $fillable = ['user_id','type','title','body','data','read_at'];
    protected $dates = ['read_at'];
    protected function casts(): array { return ['data'=>'array','read_at'=>'datetime']; }
    public function user() { return $this->belongsTo(User::class); }
    public function toApiArray(): array {
        return ['id'=>$this->id,'type'=>$this->type,'title'=>$this->title,'body'=>$this->body,
                'data'=>$this->data,'read_at'=>$this->read_at?->toIso8601String(),
                'created_at'=>$this->created_at?->toIso8601String()];
    }
}
