<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\RoomQueue;
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

    public function test_client_queue_contract_lists_joins_and_reads_a_ticket(): void
    {
        $student = User::where('role', 'student')->firstOrFail();
        $queue = RoomQueue::where('is_open', true)->firstOrFail();

        $this->getJson('/api/v1/queues')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => ['queues']]);

        $join = $this->actingAs($student, 'sanctum')
            ->withHeader('Idempotency-Key', 'queue-contract-test')
            ->postJson("/api/v1/queues/{$queue->id}/tickets", []);

        $join->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => ['ticket' => ['ticket' => ['id', 'ticket_number'], 'queue', 'people_ahead']]]);

        $ticketId = $join->json('data.ticket.ticket.id');
        $this->actingAs($student, 'sanctum')
            ->getJson("/api/v1/queue-tickets/{$ticketId}")
            ->assertOk()
            ->assertJsonPath('data.ticket.id', $ticketId);
    }
}
