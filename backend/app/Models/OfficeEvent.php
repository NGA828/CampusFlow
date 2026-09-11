<?php namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
class OfficeEvent extends Model {
    use HasUuids;
    protected $table = 'office_events';
    public $timestamps = false;
    protected $fillable = ['ticket_id','type','metadata','created_at'];
    protected function casts(): array { return ['metadata'=>'array','created_at'=>'datetime']; }
    public function ticket() { return $this->belongsTo(OfficeTicket::class,'ticket_id'); }
}
