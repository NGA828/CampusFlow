<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_authenticated_user_can_get_me_dashboard(): void
    {
        $student = User::where('role', 'student')->first();

        $response = $this->actingAs($student, 'sanctum')
            ->getJson('/api/v1/me/dashboard');

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'user',
                    'today',
                    'next_class',
                    'queue_ticket',
                    'office_ticket',
                    'unread_count',
                    'upcoming_events',
                    'building_alerts',
                ]
            ]);
    }

    public function test_authenticated_user_can_get_me_timetable(): void
    {
        $student = User::where('role', 'student')->first();

        $response = $this->actingAs($student, 'sanctum')
            ->getJson('/api/v1/me/timetable');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_authenticated_user_can_get_me_notifications(): void
    {
        $student = User::where('role', 'student')->first();

        $response = $this->actingAs($student, 'sanctum')
            ->getJson('/api/v1/me/notifications');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }
}
