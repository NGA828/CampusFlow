<?php namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
class Term extends Model {
    protected $primaryKey = 'code';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['code','name','starts_at','ends_at','is_current'];
    protected function casts(): array { return ['starts_at'=>'date','ends_at'=>'date','is_current'=>'boolean']; }
    public function timetableEntries() { return $this->hasMany(TimetableEntry::class,'term_code','code'); }
    public function toApiArray(): array {
        return ['code'=>$this->code,'name'=>$this->name,'starts_at'=>$this->starts_at?->toDateString(),
                'ends_at'=>$this->ends_at?->toDateString(),'is_current'=>$this->is_current];
    }
}
