<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * One assistant thread, owned by exactly one account.
 *
 * Conversations are private to their owner — every read in the assistant controller is filtered by
 * `user_id`, and the id returned to a client is only ever honoured when it belongs to the caller.
 */
class AiConversation extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'ai_conversations';

    protected $fillable = ['user_id', 'title', 'last_message_at'];

    protected function casts(): array
    {
        return ['last_message_at' => 'datetime'];
    }

    public function messages(): HasMany
    {
        return $this->hasMany(AiMessage::class, 'conversation_id')->orderBy('created_at');
    }

    public function toApiArray(): array
    {
        return [
            'id'              => $this->id,
            'title'           => $this->title,
            'last_message_at' => $this->last_message_at?->toIso8601String(),
            'created_at'      => $this->created_at?->toIso8601String(),
        ];
    }
}
