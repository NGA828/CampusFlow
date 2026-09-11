<?php

namespace Tests\Feature;

use App\Models\Office;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OfficeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_can_list_offices(): void
    {
        $response = $this->getJson('/api/v1/offices');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertNotEmpty($response->json('data'));
    }

    public function test_student_can_take_office_ticket(): void
    {
        $student = User::where('role', 'student')->first();
        $office = Office::first();

        $response = $this->actingAs($student, 'sanctum')
            ->postJson("/api/v1/offices/{$office->id}/tickets", [
                'service_type' => 'Transcripts',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true);
    }
}
