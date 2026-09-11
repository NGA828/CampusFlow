<?php

namespace App\Http\Controllers;

use App\Models\AiConversation;
use App\Models\AiMessage;
use App\Models\Building;
use App\Models\Office;
use App\Models\Room;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AiAssistantController extends Controller
{
    /**
     * Send message to CampusFlow AI Assistant.
     */
    public function chat(Request $request): JsonResponse
    {
        $request->validate([
            'message'         => 'required|string|max:1000',
            'conversation_id' => 'nullable|uuid|exists:ai_conversations,id',
        ]);

        $user = $request->user();
        $prompt = trim($request->input('message'));
        $conversationId = $request->input('conversation_id');

        if (!$conversationId) {
            $conversation = AiConversation::create([
                'user_id' => $user->id,
                'title'   => Str::limit($prompt, 30),
            ]);
            $conversationId = $conversation->id;
        } else {
            $conversation = AiConversation::where('id', $conversationId)
                ->where('user_id', $user->id)
                ->firstOrFail();
        }

        // Store user message
        AiMessage::create([
            'ai_conversation_id' => $conversationId,
            'role'               => 'user',
            'content'            => $prompt,
        ]);

        // Simple intelligent context matching for CampusFlow bot
        $replyContent = $this->generateSmartReply($prompt, $user);

        // Store assistant response
        $assistantMsg = AiMessage::create([
            'ai_conversation_id' => $conversationId,
            'role'               => 'assistant',
            'content'            => $replyContent['text'],
            'metadata'           => $replyContent['metadata'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'data'    => [
                'conversation_id' => $conversationId,
                'message'         => $assistantMsg,
                'suggested_actions' => $replyContent['actions'] ?? [],
            ],
        ]);
    }

    /**
     * List user AI conversations.
     */
    public function conversations(Request $request): JsonResponse
    {
        $conversations = AiConversation::where('user_id', $request->user()->id)
            ->with(['messages' => fn($q) => $q->orderBy('created_at', 'asc')])
            ->orderBy('updated_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data'    => $conversations,
        ]);
    }

    private function generateSmartReply(string $prompt, $user): array
    {
        $lower = strtolower($prompt);

        if (str_contains($lower, 'registrar') || str_contains($lower, 'financial aid') || str_contains($lower, 'office') || str_contains($lower, 'ticket')) {
            $offices = Office::where('is_active', true)->pluck('name')->join(', ');
            return [
                'text'    => "You can get in line for administrative offices right from CampusFlow! Available offices: {$offices}. Would you like to view current wait times?",
                'actions' => [
                    ['label' => 'View Offices Queue', 'route' => '/offices'],
                ],
            ];
        }

        if (str_contains($lower, 'room') || str_contains($lower, 'class') || str_contains($lower, 'find') || str_contains($lower, 'navigate') || str_contains($lower, 'map')) {
            return [
                'text'    => "CampusFlow provides turn-by-turn indoor and outdoor navigation across campus buildings. Tap below to search for a room or open the interactive map.",
                'actions' => [
                    ['label' => 'Explore Campus Map', 'route' => '/map'],
                    ['label' => 'Search Rooms', 'route' => '/rooms'],
                ],
            ];
        }

        if (str_contains($lower, 'timetable') || str_contains($lower, 'schedule') || str_contains($lower, 'lecture')) {
            return [
                'text'    => "Hi {$user->name}! Your personalized academic timetable shows all your scheduled lectures, tutorials, and room locations with direct navigation links.",
                'actions' => [
                    ['label' => 'View Timetable', 'route' => '/timetable'],
                ],
            ];
        }

        return [
            'text'    => "I am your CampusFlow AI Assistant! I can help you find rooms, check office queue wait times, navigate between buildings, or check your class timetable. What would you like help with?",
            'actions' => [
                ['label' => 'Find a Room', 'route' => '/rooms'],
                ['label' => 'Office Queues', 'route' => '/offices'],
                ['label' => 'My Timetable', 'route' => '/timetable'],
            ],
        ];
    }
}
