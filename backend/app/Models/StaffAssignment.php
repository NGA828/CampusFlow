<?php namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
class StaffAssignment extends Model {
    use HasUuids;
    protected $table = 'staff_assignments';
    protected $fillable = ['user_id','scope_type','scope_id','role_in_scope','can_manage_timetable','can_publish_content','can_call_tickets'];
    protected function casts(): array { return ['can_manage_timetable'=>'boolean','can_publish_content'=>'boolean','can_call_tickets'=>'boolean']; }
    public function user() { return $this->belongsTo(User::class); }
    public function toApiArray(): array {
        return ['id'=>$this->id,'user_id'=>$this->user_id,'scope_type'=>$this->scope_type,
                'scope_id'=>$this->scope_id,'role_in_scope'=>$this->role_in_scope,
                'can_manage_timetable'=>$this->can_manage_timetable,
                'can_publish_content'=>$this->can_publish_content,'can_call_tickets'=>$this->can_call_tickets];
    }
}
