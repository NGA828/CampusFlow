<?php namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
class Enrollment extends Model {
    use HasUuids;
    protected $fillable = ['student_id','course_id','term_code','status'];
    public function student() { return $this->belongsTo(User::class,'student_id'); }
    public function course()  { return $this->belongsTo(Course::class); }
    public function term()    { return $this->belongsTo(Term::class,'term_code','code'); }
    public function toApiArray(): array {
        return ['id'=>$this->id,'student_id'=>$this->student_id,'course_id'=>$this->course_id,
                'term_code'=>$this->term_code,'status'=>$this->status];
    }
}
