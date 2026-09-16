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
        $staff = User::where('role', 'staff')->first();

        $response = $this->actingAs($staff, 'sanctum')
            ->getJson('/api/v1/staff/dashboard');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_staff_can_list_queues_and_offices(): void
    {
        $staff = User::where('role', 'staff')->first();

        $responseQueues = $this->actingAs($staff, 'sanctum')
            ->getJson('/api/v1/staff/queues');
        $responseQueues->assertStatus(200)->assertJsonPath('success', true);

        $responseOffices = $this->actingAs($staff, 'sanctum')
            ->getJson('/api/v1/staff/offices');
        $responseOffices->assertStatus(200)->assertJsonPath('success', true);
    }
    public function test_queue_directory_includes_closed_assigned_lines_without_leaking_other_rooms(): void
    {
        $staff = User::where('role', 'staff')->firstOrFail();
        $queue = \App\Models\RoomQueue::firstOrFail();
        $queue->update(['is_open' => false]);
        \App\Models\StaffAssignment::where('user_id', $staff->id)->delete();
        \App\Models\StaffAssignment::create([
            'user_id' => $staff->id, 'scope_type' => 'room', 'scope_id' => $queue->room_id,
            'role_in_scope' => 'operator', 'can_call_tickets' => true,
        ]);
        $response = $this->actingAs($staff, 'sanctum')->getJson('/api/v1/staff/queues');
        $response->assertOk()->assertJsonPath('data.queues.0.id', $queue->id)
            ->assertJsonPath('data.queues.0.is_open', false);
        foreach ($response->json('data.queues') as $row) {
            $this->assertSame($queue->room_id, $row['room_id']);
        }
        $other = \App\Models\RoomQueue::where('room_id', '!=', $queue->room_id)->firstOrFail();
        $this->actingAs($staff, 'sanctum')->getJson('/api/v1/staff/queues/' . $other->id . '/line')->assertForbidden();
    }

    public function test_unassigned_staff_with_closed_scope_see_an_empty_queue_directory(): void
    {
        config(['campusflow.access.unassigned_staff_scope' => 'none']);
        $staff = User::where('role', 'staff')->firstOrFail();
        \App\Models\StaffAssignment::where('user_id', $staff->id)->delete();
        $this->actingAs($staff, 'sanctum')->getJson('/api/v1/staff/queues')
            ->assertOk()->assertJsonPath('data.queues', []);
    }
    public function test_office_directory_matches_the_operation_scope(): void
    {
        $staff = User::where('role', 'staff')->firstOrFail();
        $office = \App\Models\Office::firstOrFail();
        \App\Models\StaffAssignment::where('user_id', $staff->id)->delete();
        \App\Models\StaffAssignment::create(['user_id' => $staff->id, 'scope_type' => 'office', 'scope_id' => $office->id, 'role_in_scope' => 'operator']);
        $this->actingAs($staff, 'sanctum')->getJson('/api/v1/staff/offices')
            ->assertOk()->assertJsonCount(1, 'data.offices')->assertJsonPath('data.offices.0.id', $office->id);
        $this->actingAs($staff, 'sanctum')->getJson('/api/v1/staff/offices/' . $office->id . '/line')->assertOk();
    }

    public function test_room_read_includes_write_capability_and_status_update_is_validated(): void
    {
        $staff = User::where('role', 'staff')->firstOrFail();
        $room = \App\Models\Room::firstOrFail();
        \App\Models\StaffAssignment::where('user_id', $staff->id)->delete();
        \App\Models\StaffAssignment::create(['user_id' => $staff->id, 'scope_type' => 'room', 'scope_id' => $room->id, 'role_in_scope' => 'operator']);
        $response = $this->actingAs($staff, 'sanctum')->getJson('/api/v1/staff/rooms?q=' . urlencode($room->code))->assertOk();
        $record = collect($response->json('data.items'))->firstWhere('id', $room->id);
        $this->assertTrue($record['can_update_status']);
        $this->actingAs($staff, 'sanctum')->patchJson('/api/v1/staff/rooms/' . $room->id, ['status' => 'maintenance'])
            ->assertOk()->assertJsonPath('data.room.status', 'maintenance');
        $this->actingAs($staff, 'sanctum')->patchJson('/api/v1/staff/rooms/' . $room->id, ['status' => 'invented'])
            ->assertUnprocessable();
    }

    public function test_teaching_catalogue_and_sunday_create_update_contract(): void
    {
        $staff = User::where('role', 'staff')->firstOrFail();
        $catalogue = $this->actingAs($staff, 'sanctum')->getJson('/api/v1/staff/timetable')->assertOk();
        $this->assertNotEmpty($catalogue->json('data.courses'));
        $this->assertNotEmpty($catalogue->json('data.terms'));
        $body = ['course_id' => $catalogue->json('data.courses.0.id'), 'term_code' => $catalogue->json('data.terms.0.code'),
            'room_id' => null, 'type' => 'tutorial', 'day_of_week' => 0, 'starts_at' => '09:00:00', 'ends_at' => '10:00:00'];
        $response = $this->actingAs($staff, 'sanctum')->postJson('/api/v1/staff/timetable', $body)
            ->assertCreated()->assertJsonPath('data.entry.day_of_week', 0)->assertJsonPath('data.entry.type', 'tutorial');
        $this->actingAs($staff, 'sanctum')->patchJson('/api/v1/staff/timetable/' . $response->json('data.entry.id'),
            ['type' => 'lab', 'day_of_week' => 6, 'starts_at' => '11:00:00', 'ends_at' => '12:00:00'])
            ->assertOk()->assertJsonPath('data.entry.day_of_week', 6)->assertJsonPath('data.entry.type', 'lab');
    }

    public function test_dashboard_uses_operation_scope_for_counts_and_pending_people(): void
    {
        config(['campusflow.access.unassigned_staff_scope' => 'none']);
        $staff = User::where('role', 'staff')->firstOrFail();
        \App\Models\StaffAssignment::where('user_id', $staff->id)->delete();
        $this->actingAs($staff, 'sanctum')->getJson('/api/v1/staff/dashboard')->assertOk()
            ->assertJsonCount(0, 'data.queues')->assertJsonCount(0, 'data.offices')
            ->assertJsonCount(0, 'data.pending_queue_actions')->assertJsonCount(0, 'data.pending_office_actions')
            ->assertJsonPath('data.kpis.waiting_now', 0)->assertJsonPath('data.kpis.served_today', 0);
        $q = \App\Models\RoomQueue::firstOrFail();
        $q->update(['is_open' => false]);
        \App\Models\StaffAssignment::create(['user_id' => $staff->id, 'scope_type' => 'room', 'scope_id' => $q->room_id, 'can_call_tickets' => true]);
        $result = $this->actingAs($staff, 'sanctum')->getJson('/api/v1/staff/dashboard')->assertOk();
        foreach ($result->json('data.queues') as $row) $this->assertSame($q->room_id, $row['room_id']);
        foreach ($result->json('data.pending_queue_actions') as $row) $this->assertSame($q->id, $row['queue_id']);
    }

    public function test_content_preserves_real_fields_and_refuses_other_authors(): void
    {
        $staff = User::where('role', 'staff')->firstOrFail();
        $other = User::factory()->create(['role' => 'staff']);
        $event = $this->actingAs($staff, 'sanctum')->postJson('/api/v1/staff/events', [
            'title' => 'Design critique', 'description' => 'Bring your sketches', 'starts_at' => '2026-10-01T10:00:00Z',
            'ends_at' => '2026-10-01T11:00:00Z', 'capacity' => 24,
        ])->assertCreated()->assertJsonPath('data.event.created_by', $staff->id)->assertJsonPath('data.event.capacity', 24);
        $this->actingAs($other, 'sanctum')->deleteJson('/api/v1/staff/events/' . $event->json('data.event.id'))->assertNotFound();
        $notice = $this->actingAs($staff, 'sanctum')->postJson('/api/v1/staff/announcements', [
            'title' => 'Staff briefing', 'body' => 'Meet in the library.', 'priority' => 'high', 'target_roles' => ['staff'],
        ])->assertCreated()->assertJsonPath('data.announcement.created_by', $staff->id)->assertJsonPath('data.announcement.target_roles.0', 'staff');
        $this->actingAs($other, 'sanctum')->deleteJson('/api/v1/staff/announcements/' . $notice->json('data.announcement.id'))->assertNotFound();
    }
}
