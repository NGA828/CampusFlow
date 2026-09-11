<?php namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
class CampusEvent extends Model {
    use HasUuids, SoftDeletes;
    protected $table = 'campus_events';
    protected $fillable = ['title','description','category','room_id','venue','starts_at','ends_at','capacity','image_url','status','created_by'];
    protected $dates = ['starts_at','ends_at'];
    public function room()    { return $this->belongsTo(Room::class); }
    public function creator() { return $this->belongsTo(User::class,'created_by'); }
    public function registrations() { return $this->hasMany(EventRegistration::class,'event_id'); }
    public function toApiArray(): array {
        return ['id'=>$this->id,'title'=>$this->title,'description'=>$this->description,'category'=>$this->category,
                'venue'=>$this->venue,'room_id'=>$this->room_id,'starts_at'=>$this->starts_at?->toIso8601String(),
                'ends_at'=>$this->ends_at?->toIso8601String(),'capacity'=>$this->capacity,'image_url'=>$this->image_url,'status'=>$this->status];
    }
}
