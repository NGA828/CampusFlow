<?php namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
class Course extends Model {
    use HasUuids, SoftDeletes;
    protected $fillable = ['code','name','department','credits','description','status'];
    protected function casts(): array { return ['credits'=>'integer']; }
    public function enrollments()        { return $this->hasMany(Enrollment::class); }
    public function timetableEntries()   { return $this->hasMany(TimetableEntry::class); }
    public function toApiArray(): array {
        return ['id'=>$this->id,'code'=>$this->code,'name'=>$this->name,
                'department'=>$this->department,'credits'=>$this->credits,'description'=>$this->description,'status'=>$this->status];
    }
}
