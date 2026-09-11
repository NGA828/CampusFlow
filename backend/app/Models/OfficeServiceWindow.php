<?php namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
class OfficeServiceWindow extends Model {
    use HasUuids;
    protected $table = 'office_service_windows';
    protected $fillable = ['office_id','name','status','served_by_user_id'];
    public function office() { return $this->belongsTo(Office::class); }
    public function servedBy() { return $this->belongsTo(User::class,'served_by_user_id'); }
}
