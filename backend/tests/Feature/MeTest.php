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

    /**
     * There is no `/me/dashboard`.
     *
     * One endpoint answering a dashboard to every role is the thing this platform is required not to have:
     * a student's home is a next-class card, a staff member's is the line they run, and an administrator's
     * is the alert feed. The assertion here is that the generic route is *gone*, not that some role can
     * still reach it.
     */
    public function test_there_is_no_universal_dashboard_endpoint(): void
    {
        $student = User::where('role', 'student')->firstOrFail();

        foreach (['/me/dashboard', '/me/timetable', '/me/queue-tickets/active'] as $path) {
            $this->actingAs($student, 'sanctum')->getJson('/api/v1' . $path)->assertStatus(404);
        }

        $this->actingAs($student, 'sanctum')
            ->getJson('/api/v1/student/dashboard')
            ->assertOk()
            ->assertJsonPath('success', true);
    }

    public function test_authenticated_user_can_get_me_dashboard(): void
    {
        $student = User::where('role', 'student')->first();

        $response = $this->actingAs($student, 'sanctum')
            ->getJson('/api/v1/student/dashboard');

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
            ->getJson('/api/v1/student/timetable');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_user_can_register_and_unregister_their_push_device(): void
    {
        $user = User::where('role', 'student')->firstOrFail();
        $token = 'ExponentPushToken[campusflow-test-device]';

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/me/devices', [
                'token' => $token,
                'platform' => 'android',
                'device_name' => 'Test handset',
            ])
            ->assertOk()
            ->assertJsonPath('data.registered', true);

        $this->assertDatabaseHas('device_tokens', [
            'user_id' => $user->id,
            'token' => $token,
            'platform' => 'android',
        ]);

        $other = User::where('role', 'staff')->firstOrFail();
        $this->actingAs($other, 'sanctum')
            ->postJson('/api/v1/me/devices/unregister', ['token' => $token])
            ->assertOk()
            ->assertJsonPath('data.unregistered', false);
        $this->assertDatabaseHas('device_tokens', ['user_id' => $user->id, 'token' => $token]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/me/devices/unregister', ['token' => $token])
            ->assertOk()
            ->assertJsonPath('data.unregistered', true);
        $this->assertDatabaseMissing('device_tokens', ['token' => $token]);
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
