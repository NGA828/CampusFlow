<?php namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
class NavigationEdge extends Model {
    use HasUuids;
    protected $table = 'navigation_edges';
    protected $fillable = ['from_node_id','to_node_id','weight','bidirectional','accessible','edge_type'];
    protected function casts(): array { return ['weight'=>'float','bidirectional'=>'boolean','accessible'=>'boolean']; }
    public function fromNode() { return $this->belongsTo(NavigationNode::class,'from_node_id'); }
    public function toNode()   { return $this->belongsTo(NavigationNode::class,'to_node_id'); }
    public function toApiArray(): array {
        return ['id'=>$this->id,'from_node_id'=>$this->from_node_id,'to_node_id'=>$this->to_node_id,
                'weight'=>$this->weight,'bidirectional'=>$this->bidirectional,'accessible'=>$this->accessible,'edge_type'=>$this->edge_type];
    }
}
