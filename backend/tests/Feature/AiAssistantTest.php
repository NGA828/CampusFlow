<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AiAssistantTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_configured_openai_model_selects_an_authorized_backend_tool(): void
    {
        Config::set('services.openai.key', 'test-openai-key');
        Config::set('services.openai.model', 'gpt-4o-mini');
        Config::set('services.openai.base_url', 'https://api.openai.com/v1');
        Http::fake([
            'https://api.openai.com/v1/chat/completions' => Http::response([
                'choices' => [[
                    'message' => [
                        'tool_calls' => [[
                            'function' => [
                                'arguments' => json_encode([
                                    'tool' => 'locate_room',
                                    'room_code' => Room::firstOrFail()->code,
                                ]),
                            ],
                        ]],
                    ],
                ]],
            ]),
        ]);

        $student = User::where('role', 'student')->firstOrFail();
        $response = $this->actingAs($student, 'sanctum')
            ->withHeader('X-CampusFlow-Client', 'web')
            ->postJson('/api/v1/ai/chat', ['message' => 'Where is my room?']);

        $response->assertOk()
            ->assertJsonPath('data.planner', 'openai')
            ->assertJsonPath('data.model', 'gpt-4o-mini')
            ->assertJsonPath('data.message.metadata.planner', 'openai');

        Http::assertSent(function (HttpRequest $request): bool {
            return $request->url() === 'https://api.openai.com/v1/chat/completions'
                && $request->data()['model'] === 'gpt-4o-mini'
                && $request->hasHeader('Authorization', 'Bearer test-openai-key');
        });
    }

    public function test_assistant_uses_deterministic_planner_without_an_openai_key(): void
    {
        Config::set('services.openai.key', '');
        Http::fake();

        $student = User::where('role', 'student')->firstOrFail();
        $response = $this->actingAs($student, 'sanctum')
            ->withHeader('X-CampusFlow-Client', 'web')
            ->postJson('/api/v1/ai/chat', ['message' => 'Show me my timetable']);

        $response->assertOk()
            ->assertJsonPath('data.planner', 'deterministic')
            ->assertJsonPath('data.model', null);

        Http::assertNothingSent();
    }
}
