<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A single assistant turn.
 *
 * `tool_calls` records what the assistant was allowed to attempt and what it resolved to; it is the
 * audit trail that answers "did the assistant actually have permission to say that?" after the fact.
 */
class AiMessage extends Model
{
    use HasUuids;

    protected $table = 'ai_messages';

    protected $fillable = ['conversation_id', 'role', 'content', 'tool_calls', 'tool_results'];

    protected function casts(): array
    {
        return [
            'tool_calls'   => 'array',
            'tool_results' => 'array',
        ];
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(AiConversation::class, 'conversation_id');
    }

    public function toApiArray(): array
    {
        return [
            'id'         => $this->id,
            'role'       => $this->role,
            'content'    => $this->content,
            'metadata'   => $this->tool_calls,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
