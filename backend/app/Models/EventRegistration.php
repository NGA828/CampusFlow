<?php namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
class EventRegistration extends Model {
    use HasUuids;
    protected $table = 'event_registrations';
    protected $fillable = ['event_id','user_id'];
    public function event() { return $this->belongsTo(CampusEvent::class,'event_id'); }
    public function user()  { return $this->belongsTo(User::class); }
}
