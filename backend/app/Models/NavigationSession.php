<?php namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
class NavigationSession extends Model {
    use HasUuids;
    protected $table = 'navigation_sessions';
    protected $fillable = ['user_id','from_node_id','to_node_id','to_room_id','status','accessible',
        'route_snapshot','current_lat','current_lng','current_plan_x','current_plan_y','current_floor_id',
        'completed_at','abandoned_at'];
    protected $dates = ['completed_at','abandoned_at'];
    protected function casts(): array {
        return ['accessible'=>'boolean','route_snapshot'=>'array',
                'current_lat'=>'float','current_lng'=>'float','current_plan_x'=>'float','current_plan_y'=>'float'];
    }
    public function user()      { return $this->belongsTo(User::class); }
    public function fromNode()  { return $this->belongsTo(NavigationNode::class,'from_node_id'); }
    public function toNode()    { return $this->belongsTo(NavigationNode::class,'to_node_id'); }
    public function toRoom()    { return $this->belongsTo(Room::class,'to_room_id'); }
    public function currentFloor() { return $this->belongsTo(Floor::class,'current_floor_id'); }
    public function toApiArray(): array {
        return ['id'=>$this->id,'status'=>$this->status,'accessible'=>$this->accessible,
                'from_node_id'=>$this->from_node_id,'to_node_id'=>$this->to_node_id,'to_room_id'=>$this->to_room_id,
                'current_lat'=>$this->current_lat,'current_lng'=>$this->current_lng,
                'current_plan_x'=>$this->current_plan_x,'current_plan_y'=>$this->current_plan_y,
                'current_floor_id'=>$this->current_floor_id,
                'started_at'=>$this->created_at?->toIso8601String(),
                'completed_at'=>$this->completed_at?->toIso8601String(),
                'abandoned_at'=>$this->abandoned_at?->toIso8601String()];
    }
}
