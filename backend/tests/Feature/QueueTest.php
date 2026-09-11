<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class QueueTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_student_can_join_room_queue(): void
    {
        $student = User::where('role', 'student')->first();
        $room = Room::where('requires_admission', true)->first();

        $response = $this->actingAs($student, 'sanctum')
            ->postJson("/api/v1/rooms/{$room->id}/queue/join");

        $response->assertStatus(201)
            ->assertJsonPath('success', true);
    }
}
