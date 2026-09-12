<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\RoomQueue;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Room queues, from the student's side.
 *
 * The reads live under `/campus` because a line outside a door is shared campus truth; the *acts* live under
 * `/student` because taking a place in a line is something only a student does. Proximity is switched off
 * per test rather than faked with coordinates: these cases are about issuing a ticket, not about the
 * geofence engine, and a test that quietly passes a fix would stop proving the join path is honest.
 */
class QueueTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    private function openQueue(): RoomQueue
    {
        $queue = RoomQueue::where('is_open', true)->firstOrFail();

        $queue->forceFill([
            'join_requires_proximity' => false,
            'proximity_radius_m'      => 0,
            'max_capacity'            => null,
        ])->save();

        return $queue;
    }

    public function test_student_can_join_a_room_queue(): void
    {
        $student = User::where('role', 'student')->firstOrFail();
        $queue = $this->openQueue();

        $response = $this->actingAs($student, 'sanctum')
            ->withHeader('X-CampusFlow-Client', 'mobile')
            ->postJson("/api/v1/student/rooms/{$queue->room_id}/queue/join", ['idempotency_key' => 'join-by-room-test']);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.ticket.status', 'waiting');
    }

    public function test_client_queue_contract_lists_joins_and_reads_a_ticket(): void
    {
        $student = User::where('role', 'student')->firstOrFail();
        $queue = $this->openQueue();

        $this->actingAs($student, 'sanctum')
            ->getJson('/api/v1/campus/queues')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => ['queues']]);

        $join = $this->actingAs($student, 'sanctum')
            ->withHeader('Idempotency-Key', 'queue-contract-test')
            ->postJson("/api/v1/student/queues/{$queue->id}/tickets", []);

        $join->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => ['ticket' => ['id', 'ticket_number'], 'queue', 'people_ahead', 'can_check_in', 'can_cancel']]);

        $ticketId = $join->json('data.ticket.id');

        $this->actingAs($student, 'sanctum')
            ->getJson("/api/v1/student/queue-tickets/{$ticketId}")
            ->assertOk()
            ->assertJsonPath('data.ticket.id', $ticketId);

        // A second join with the same key replays the first ticket; a second join with a new key is a
        // duplicate place in line and is refused. Either way the student holds exactly one ticket.
        $replay = $this->actingAs($student, 'sanctum')
            ->withHeader('Idempotency-Key', 'queue-contract-test')
            ->postJson("/api/v1/student/queues/{$queue->id}/tickets", []);

        $replay->assertOk()->assertJsonPath('data.ticket.id', $ticketId);

        $this->actingAs($student, 'sanctum')
            ->postJson("/api/v1/student/queues/{$queue->id}/tickets", ['idempotency_key' => 'a-different-key'])
            ->assertStatus(409)
            ->assertJsonPath('code', 'DUPLICATE_TICKET');
    }

    public function test_joining_a_closed_line_is_refused_as_a_business_rule(): void
    {
        $student = User::where('role', 'student')->firstOrFail();
        $queue = $this->openQueue();
        $queue->forceFill(['is_open' => false])->save();

        $this->actingAs($student, 'sanctum')
            ->postJson("/api/v1/student/queues/{$queue->id}/tickets", ['idempotency_key' => 'closed-line-test'])
            ->assertStatus(409)
            ->assertJsonPath('code', 'QUEUE_CLOSED');
    }

    public function test_a_room_without_a_queue_says_so_instead_of_issuing_a_ticket(): void
    {
        $student = User::where('role', 'student')->firstOrFail();

        $room = Room::whereDoesntHave('queue')->firstOrFail();

        $this->actingAs($student, 'sanctum')
            ->postJson("/api/v1/student/rooms/{$room->id}/queue/join", ['idempotency_key' => 'no-queue-test'])
            ->assertStatus(422)
            ->assertJsonPath('code', 'NO_QUEUE');
    }

    public function test_a_student_cannot_read_another_students_ticket(): void
    {
        $queue = $this->openQueue();

        $owner = User::where('role', 'student')->firstOrFail();
        $other = User::where('role', 'student')->where('id', '!=', $owner->id)->first();

        if (! $other) {
            $this->markTestSkipped('The test campus seeds a single student, so there is no second principal to try.');
        }

        $ticket = $this->actingAs($owner, 'sanctum')
            ->postJson("/api/v1/student/queues/{$queue->id}/tickets", ['idempotency_key' => 'ownership-test'])
            ->json('data.ticket.id');

        $this->actingAs($other, 'sanctum')
            ->getJson("/api/v1/student/queue-tickets/{$ticket}")
            ->assertStatus(403);

        $this->actingAs($other, 'sanctum')
            ->postJson("/api/v1/student/queue-tickets/{$ticket}/cancel")
            ->assertStatus(403);
    }

    public function test_a_queue_board_is_readable_by_every_resident_role(): void
    {
        foreach (['student', 'staff', 'admin'] as $role) {
            $this->actingAs(User::where('role', $role)->firstOrFail(), 'sanctum')
                ->getJson('/api/v1/campus/queues')
                ->assertOk();
        }
    }

    public function test_cancelling_a_ticket_releases_the_place_in_line(): void
    {
        $student = User::where('role', 'student')->firstOrFail();
        $queue = $this->openQueue();

        $ticket = $this->actingAs($student, 'sanctum')
            ->postJson("/api/v1/student/queues/{$queue->id}/tickets", ['idempotency_key' => 'cancel-test'])
            ->json('data.ticket.id');

        $this->actingAs($student, 'sanctum')
            ->postJson("/api/v1/student/queue-tickets/{$ticket}/cancel")
            ->assertOk()
            ->assertJsonPath('data.ticket.status', 'cancelled');

        // The room's occupancy counter is about who is *inside*, so joining and leaving never move it;
        // only admission does. Asserting it here keeps the invariant from drifting back into the join path.
        $this->assertSame(0, (int) $queue->fresh()->current_count);
    }
}
