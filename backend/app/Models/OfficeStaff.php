<?php namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
class OfficeStaff extends Model {
    use HasUuids;
    protected $table = 'office_staff';
    protected $fillable = ['office_id','user_id','role','is_primary'];
    protected function casts(): array { return ['is_primary'=>'boolean']; }
    public function office() { return $this->belongsTo(Office::class); }
    public function user()   { return $this->belongsTo(User::class); }
}
