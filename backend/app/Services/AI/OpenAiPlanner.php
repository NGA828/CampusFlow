<?php

namespace App\Services\AI;

use App\Exceptions\AiProviderException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class OpenAiPlanner
{
    public function configured(): bool
    {
        return trim((string) config('services.openai.key')) !== '';
    }

    public function provider(): string
    {
        return $this->configured() ? 'openai' : 'deterministic';
    }

    public function model(): ?string
    {
        return $this->configured() ? (string) config('services.openai.model', 'gpt-4o-mini') : null;
    }

    /**
     * Ask the model to choose one already-authorized backend tool.
     *
     * @param list<string> $availableTools
     * @return array{tool: string, room_code: ?string, provider: string, model: string}|null
     */
    public function select(string $prompt, array $availableTools, string $role, string $platform): ?array
    {
        if (! $this->configured()) {
            return null;
        }

        $model = (string) config('services.openai.model', 'gpt-4o-mini');
        $baseUrl = rtrim((string) config('services.openai.base_url', 'https://api.openai.com/v1'), '/');

        $response = Http::baseUrl($baseUrl)
            ->withToken((string) config('services.openai.key'))
            ->acceptJson()
            ->timeout((int) config('services.openai.timeout', 20))
            ->post('/chat/completions', [
                'model' => $model,
                'temperature' => 0,
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => implode(' ', [
                            'You route CampusFlow requests to one controlled backend tool.',
                            'Choose exactly one tool from the supplied enum.',
                            'Never answer the user, invent campus facts, perform database work, or select a tool outside the enum.',
                            "The caller's role is {$role} and platform is {$platform}.",
                            'If a room code is present, return it as room_code; otherwise return an empty string.',
                        ]),
                    ],
                    ['role' => 'user', 'content' => $prompt],
                ],
                'tools' => [[
                    'type' => 'function',
                    'function' => [
                        'name' => 'select_campus_tool',
                        'description' => 'Select the single authorized CampusFlow tool that best matches the request.',
                        'parameters' => [
                            'type' => 'object',
                            'properties' => [
                                'tool' => [
                                    'type' => 'string',
                                    'enum' => array_values($availableTools),
                                ],
                                'room_code' => [
                                    'type' => 'string',
                                    'description' => 'The room code mentioned by the user, or an empty string.',
                                ],
                            ],
                            'required' => ['tool', 'room_code'],
                            'additionalProperties' => false,
                        ],
                    ],
                ]],
                'tool_choice' => [
                    'type' => 'function',
                    'function' => ['name' => 'select_campus_tool'],
                ],
            ]);

        if (! $response->successful()) {
            Log::warning('OpenAI assistant request failed.', [
                'status' => $response->status(),
                'model' => $model,
            ]);

            throw new AiProviderException;
        }

        $arguments = data_get($response->json(), 'choices.0.message.tool_calls.0.function.arguments');
        if (! is_string($arguments)) {
            throw new AiProviderException('The AI model returned an incomplete tool selection.', 'AI_INVALID_RESPONSE');
        }

        $selection = json_decode($arguments, true);
        if (! is_array($selection)) {
            throw new AiProviderException('The AI model returned an invalid tool selection.', 'AI_INVALID_RESPONSE');
        }

        $tool = $selection['tool'] ?? null;
        if (! is_string($tool) || ! in_array($tool, $availableTools, true)) {
            throw new AiProviderException('The AI model selected an unauthorized tool.', 'AI_UNAUTHORIZED_TOOL');
        }

        $roomCode = $selection['room_code'] ?? '';

        return [
            'tool' => $tool,
            'room_code' => is_string($roomCode) && trim($roomCode) !== '' ? strtoupper(trim($roomCode)) : null,
            'provider' => 'openai',
            'model' => $model,
        ];
    }
}
