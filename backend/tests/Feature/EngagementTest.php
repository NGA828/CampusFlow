<?php

namespace Tests\Feature;

use App\Models\CampusEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EngagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_can_list_events(): void
    {
        $response = $this->getJson('/api/v1/events');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_student_can_register_for_event(): void
    {
        $student = User::where('role', 'student')->first();
        $event = CampusEvent::first();

        $response = $this->actingAs($student, 'sanctum')
            ->postJson("/api/v1/events/{$event->id}/register");

        $response->assertStatus(201)
            ->assertJsonPath('success', true);
    }
}
