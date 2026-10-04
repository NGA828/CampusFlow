<?php

namespace Tests\Feature;

use App\Models\Building;
use App\Models\Office;
use App\Models\OfficeTicket;
use App\Models\QueueTicket;
use App\Models\RoomQueue;
use App\Models\NavigationSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_admin_can_access_dashboard_metrics(): void
    {
        $admin = User::where('role', 'admin')->first();

        $response = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/admin/dashboard');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_analytics_are_derived_from_ticket_and_navigation_records(): void
    {
        $admin = User::where('role', 'admin')->firstOrFail();
        $student = User::where('role', 'student')->firstOrFail();
        $queue = RoomQueue::firstOrFail();
        $now = now();

        QueueTicket::create([
            'queue_id' => $queue->id,
            'user_id' => $student->id,
            'position' => 9001,
            'status' => 'completed',
            'idempotency_key' => 'analytics-completed-' . $student->id,
            'called_at' => $now->copy()->subMinutes(50),
            'admitted_at' => $now->copy()->subMinutes(40),
            'completed_at' => $now->copy()->subMinutes(20),
            'created_at' => $now->copy()->subMinutes(60),
            'updated_at' => $now,
        ]);
        QueueTicket::create([
            'queue_id' => $queue->id,
            'user_id' => User::factory()->create(['role' => 'student'])->id,
            'position' => 9002,
            'status' => 'no_show',
            'idempotency_key' => 'analytics-no-show-' . \Illuminate\Support\Str::uuid(),
            'created_at' => $now->copy()->subMinutes(30),
            'updated_at' => $now,
        ]);

        $office = Office::firstOrFail();
        OfficeTicket::create([
            'office_id' => $office->id,
            'user_id' => $student->id,
            'ticket_number' => 'AN-001',
            'subject' => 'Analytics test',
            'status' => 'completed',
            'idempotency_key' => 'analytics-office-' . $student->id,
            'called_at' => $now->copy()->subMinutes(40),
            'service_started_at' => $now->copy()->subMinutes(30),
            'completed_at' => $now->copy()->subMinutes(10),
            'created_at' => $now->copy()->subMinutes(50),
            'updated_at' => $now,
        ]);

        NavigationSession::create([
            'user_id' => $student->id,
            'status' => 'completed',
            'route_snapshot' => ['distance_m' => 345.5],
            'completed_at' => $now,
            'created_at' => $now->copy()->subMinutes(15),
            'updated_at' => $now,
        ]);

        $data = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/admin/analytics')
            ->assertOk()
            ->json('data');

        $this->assertSame(50.0, $data['queues']['no_show_rate_7d']);
        $this->assertSame(10.0, $data['queues']['average_wait_minutes']);
        $this->assertSame(20.0, $data['queues']['average_service_minutes']);
        $this->assertSame(10.0, $data['offices']['average_wait_minutes']);
        $this->assertSame(20.0, $data['offices']['average_service_minutes']);
        $this->assertSame(100.0, $data['navigation']['completion_rate_7d']);
        $this->assertSame(345.5, $data['navigation']['average_distance_m']);
        $this->assertNotEmpty($data['queues']['busiest_rooms']);
        $this->assertNotEmpty($data['offices']['busiest']);
    }

    public function test_admin_can_list_users(): void
    {
        $admin = User::where('role', 'admin')->first();

        $response = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/admin/users');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_admin_can_list_buildings(): void
    {
        $admin = User::where('role', 'admin')->first();

        $response = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/admin/buildings');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_admin_can_create_building(): void
    {
        $admin = User::where('role', 'admin')->first();

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/admin/buildings', [
                'name' => 'Test Science Wing',
                'code' => 'TSW',
                'latitude' => 6.5244,
                'longitude' => 3.3792,
                'description' => 'Newly added test building',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('buildings', ['code' => 'TSW']);
    }

    public function test_people_contract_separates_role_and_profile_updates(): void
    {
        $admin = User::where('role', 'admin')->firstOrFail();
        $person = User::factory()->create(['role' => 'student']);
        $this->actingAs($admin, 'sanctum')->patchJson('/api/v1/admin/users/' . $person->id, ['role' => 'admin'])->assertUnprocessable();
        $this->actingAs($admin, 'sanctum')->patchJson('/api/v1/admin/users/' . $person->id, ['department' => 'Design', 'status' => 'suspended'])
            ->assertOk()->assertJsonPath('data.user.status', 'suspended')->assertJsonPath('data.user.department', 'Design');
        $this->actingAs($admin, 'sanctum')->deleteJson('/api/v1/admin/users/' . $admin->id)->assertConflict();
        $result = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/users?role=staff&per_page=2')->assertOk();
        foreach ($result->json('data.items') as $row) $this->assertSame('staff', $row['role']);
        $result->assertJsonStructure(['data' => ['meta' => ['current_page', 'last_page', 'total', 'per_page']]]);
    }

    public function test_assignment_catalogue_is_independent_of_people_page_and_rejects_invalid_scope(): void
    {
        $admin = User::where('role', 'admin')->firstOrFail();
        $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/staff-assignments')->assertOk()
            ->assertJsonStructure(['data' => ['assignments', 'people', 'scopes' => ['building', 'floor', 'room', 'office', 'course']]]);
        $staff = User::where('role', 'staff')->firstOrFail();
        $this->actingAs($admin, 'sanctum')->postJson('/api/v1/admin/staff-assignments', [
            'user_id' => $staff->id, 'scope_type' => 'queue', 'scope_id' => (string) \Illuminate\Support\Str::uuid(),
        ])->assertUnprocessable();
    }
    public function test_alert_fingerprint_changes_with_the_reported_condition_and_acknowledgement_is_idempotent(): void
    {
        $admin = User::where('role', 'admin')->firstOrFail();
        $floor = \App\Models\Floor::firstOrFail();
        \App\Models\Room::create(['floor_id' => $floor->id, 'code' => 'ALERT-A', 'name' => 'Review room A', 'requires_admission' => true]);
        $feed = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/alerts')->assertOk();
        $condition = collect($feed->json('data.alerts'))->first(fn ($a) => str_starts_with($a['key'], 'rooms_requiring_admission_without_queue:'));
        $this->assertNotNull($condition);
        $fingerprint = $condition['key'];
        $this->assertLessThanOrEqual(160, strlen($fingerprint));
        $this->assertMatchesRegularExpression('/:[a-f0-9]{16}$/', $fingerprint);
        foreach ([1, 2] as $attempt) {
            $this->postJson('/api/v1/admin/alerts/ack', ['fingerprint' => $fingerprint, 'note' => 'Reviewed.'])
                ->assertCreated()->assertJsonPath('data.acknowledged', $fingerprint);
        }
        $this->assertSame(1, \Illuminate\Support\Facades\DB::table('alert_acknowledgements')->where('fingerprint', $fingerprint)->count());
        $muted = $this->getJson('/api/v1/admin/alerts')->assertOk();
        $this->assertFalse(collect($muted->json('data.alerts'))->contains('key', $fingerprint));
        \App\Models\Room::create(['floor_id' => $floor->id, 'code' => 'ALERT-B', 'name' => 'Review room B', 'requires_admission' => true]);
        $changed = $this->getJson('/api/v1/admin/alerts')->assertOk();
        $next = collect($changed->json('data.alerts'))->first(fn ($a) => str_starts_with($a['key'], 'rooms_requiring_admission_without_queue:'));
        $this->assertNotNull($next);
        $this->assertNotSame($fingerprint, $next['key']);
        foreach (['critical', 'warning'] as $severity) {
            $this->assertSame(collect($changed->json('data.alerts'))->where('severity', $severity)->count(), $changed->json('data.counts.' . $severity));
        }
    }

    public function test_closed_office_alert_excludes_tickets_at_unrelated_open_offices(): void
    {
        $admin = User::where('role', 'admin')->firstOrFail();
        \App\Models\Office::query()->update(['is_open' => true]);
        $open = \App\Models\Office::create(['code' => 'ALERT-OPEN', 'name' => 'Open desk', 'status' => 'active', 'is_open' => true]);
        $closed = \App\Models\Office::create(['code' => 'ALERT-CLOSED', 'name' => 'Closed desk', 'status' => 'active', 'is_open' => false]);
        $ticket = function ($office, $status) {
            return \App\Models\OfficeTicket::create([
                'office_id' => $office->id, 'user_id' => User::factory()->create(['role' => 'student'])->id,
                'subject' => 'Alert review', 'ticket_number' => 'REVIEW-001', 'status' => $status,
                'idempotency_key' => (string) \Illuminate\Support\Str::uuid(),
            ]);
        };
        $ticket($open, 'waiting');
        $first = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/alerts')->assertOk();
        $find = fn ($response) => collect($response->json('data.alerts'))->first(fn ($a) => str_starts_with($a['key'], 'offices_closed_with_line:'));
        $this->assertNull($find($first));
        $ticket($closed, 'waiting');
        $ticket($closed, 'in_service');
        $second = $this->getJson('/api/v1/admin/alerts')->assertOk();
        $this->assertSame('2 tickets remain at closed offices', $find($second)['title']);
        $closed->update(['is_open' => true]);
        $this->assertNull($find($this->getJson('/api/v1/admin/alerts')->assertOk()));
    }

    public function test_alert_acknowledgement_validates_note_length_and_admin_authority(): void
    {
        $admin = User::where('role', 'admin')->firstOrFail();
        $this->actingAs($admin, 'sanctum')->postJson('/api/v1/admin/alerts/ack', ['fingerprint' => 'review:key', 'note' => str_repeat('x', 301)])
            ->assertUnprocessable()->assertJsonValidationErrors('note');
        $this->postJson('/api/v1/admin/alerts/ack', ['fingerprint' => str_repeat('x', 161)])
            ->assertUnprocessable()->assertJsonValidationErrors('fingerprint');
        $student = User::factory()->create(['role' => 'student']);
        $this->actingAs($student, 'sanctum')->getJson('/api/v1/admin/alerts')->assertForbidden();
        $this->postJson('/api/v1/admin/alerts/ack', ['fingerprint' => 'review:key'])->assertForbidden();
    }

}
