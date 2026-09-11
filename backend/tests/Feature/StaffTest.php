<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StaffTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_staff_can_access_staff_dashboard(): void
    {
        $staff = User::whereIn('role', ['staff', 'admin'])->first();

        $response = $this->actingAs($staff, 'sanctum')
            ->getJson('/api/v1/staff/dashboard');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_staff_can_list_queues_and_offices(): void
    {
        $staff = User::whereIn('role', ['staff', 'admin'])->first();

        $responseQueues = $this->actingAs($staff, 'sanctum')
            ->getJson('/api/v1/staff/queues');
        $responseQueues->assertStatus(200)->assertJsonPath('success', true);

        $responseOffices = $this->actingAs($staff, 'sanctum')
            ->getJson('/api/v1/staff/offices');
        $responseOffices->assertStatus(200)->assertJsonPath('success', true);
    }
}
