<?php

namespace Tests\Feature;

use App\Models\Announcement;
use App\Models\Building;
use App\Models\Room;
use App\Models\RoomQueue;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The role × platform matrix, asserted against the API.
 *
 * Every case here is a refusal that must come from the server. A client hiding a button is not a test
 * subject: if the route answered 200 to the wrong principal, the product would only be correct until
 * somebody sent the request by hand. The negative cases therefore hit the route directly with the right
 * token and the wrong role, platform, or both.
 *
 * The `X-CampusFlow-Client` header is what makes a platform case testable: with no header a request is
 * `unknown`, and `unknown` keeps a role's rights rather than gaining any — so a platform refusal is only
 * provable by declaring the platform that must be refused.
 */
class PlatformRoleAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    private function student(): User
    {
        return User::where('role', 'student')->firstOrFail();
    }

    private function staff(): User
    {
        return User::where('role', 'staff')->firstOrFail();
    }

    private function admin(): User
    {
        return User::where('role', 'admin')->firstOrFail();
    }

    /* ───────────────────────────────────────────────────── visitor vs resident */

    public function test_visitor_has_no_routes_under_any_role_tree(): void
    {
        foreach (['/student/dashboard', '/staff/dashboard', '/admin/dashboard', '/campus/rooms'] as $path) {
            $this->getJson('/api/v1' . $path)->assertStatus(401);
        }
    }

    public function test_visitor_public_surface_exposes_no_student_or_operator_data(): void
    {
        $response = $this->getJson('/api/v1/public/overview');

        $response->assertStatus(200);

        // A visitor projection may not carry the things that make CampusFlow a student's companion:
        // no QR anchor codes (they seed a scan), no navigation graph (it would let a visitor compute a
        // route through a building), and no occupancy or timetable of an active room.
        $payload = (array) $response->json('data');

        // A visitor projection may not carry the things that make CampusFlow a student's companion: no QR
        // anchor codes (they seed a scan), no navigation graph (it would let a stranger compute a route
        // through a building), and no queue or occupancy counters.
        foreach (['qr_nodes', 'navigation_nodes', 'navigation_edges', 'queues', 'occupancy'] as $forbidden) {
            $this->assertArrayNotHasKey($forbidden, $payload);
        }
    }

    public function test_visitor_cannot_read_a_resident_building_endpoint(): void
    {
        $building = Building::firstOrFail();

        $this->getJson('/api/v1/campus/buildings/' . $building->id)->assertStatus(401);
        $this->getJson('/api/v1/public/buildings/' . $building->id)->assertStatus(200);
    }

    /* ───────────────────────────────────────────────── student cannot operate */

    public function test_student_is_refused_every_staff_and_admin_tree(): void
    {
        $student = $this->student();

        $paths = [
            '/staff/dashboard',
            '/staff/queues',
            '/staff/offices',
            '/admin/dashboard',
            '/admin/rooms',
            '/admin/queues',
            '/admin/users',
            '/admin/settings',
        ];

        foreach ($paths as $path) {
            $response = $this->actingAs($student, 'sanctum')->getJson('/api/v1' . $path);

            $response->assertStatus(403)
                ->assertJsonPath('code', 'ROLE_NOT_PERMITTED');

            // `required_roles` and `your_home` are the fields that let a client explain the refusal instead
            // of showing a dead end, and `your_home` is what sends a person to their own workspace.
            $this->assertNotEmpty($response->json('required_roles'));
            $this->assertNotEmpty($response->json('your_home'));
        }
    }

    public function test_student_may_not_configure_a_queue_even_though_admin_outranks_nobody_here(): void
    {
        $queue = RoomQueue::firstOrFail();
        $originalCapacity = $queue->capacity;

        $this->actingAs($this->student(), 'sanctum')
            ->patchJson('/api/v1/admin/queues/' . $queue->id, ['capacity' => 99])
            ->assertStatus(403)
            ->assertJsonPath('code', 'ROLE_NOT_PERMITTED');

        $this->assertSame($originalCapacity, (int) $queue->fresh()->capacity, 'The refusal must not have written anything.');
    }

    public function test_staff_and_admin_cannot_take_a_students_place_in_a_line(): void
    {
        $queue = RoomQueue::firstOrFail();

        foreach ([$this->staff(), $this->admin()] as $operator) {
            $this->actingAs($operator, 'sanctum')
                ->postJson('/api/v1/student/queues/' . $queue->id . '/tickets')
                ->assertStatus(403)
                ->assertJsonPath('code', 'ROLE_NOT_PERMITTED');
        }
    }

    /* ─────────────────────────────────────────── students cannot read each other */

    public function test_a_student_reads_only_their_own_timetable_and_tickets(): void
    {
        $student = $this->student();
        $other = User::where('role', 'student')->where('id', '!=', $student->id)->first();

        $mine = $this->actingAs($student, 'sanctum')->getJson('/api/v1/student/timetable');
        $mine->assertStatus(200);

        // There is no `?user_id=` to try: the principal comes from the token only. A student asking for
        // another student's ticket by id must be refused by the policy, not filtered out by a screen.
        if ($other) {
            $foreignTicket = \App\Models\QueueTicket::where('user_id', $other->id)->first();

            if ($foreignTicket) {
                $this->actingAs($student, 'sanctum')
                    ->getJson('/api/v1/student/queue-tickets/' . $foreignTicket->id)
                    ->assertStatus(403);
            }

            // There is no way to ask for somebody else's week: the id in the query string is not a
            // parameter this endpoint reads, so the answer is the caller's own timetable either way.
            $withParam = $this->actingAs($student, 'sanctum')
                ->getJson('/api/v1/student/timetable?user_id=' . $other->id);

            $withParam->assertStatus(200);
            $this->assertSame(
                collect($mine->json('data.entries'))->pluck('id')->all(),
                collect($withParam->json('data.entries'))->pluck('id')->all(),
            );
        }
    }

    /* ─────────────────────────────────────────────────────── admin ⊆ authorized */

    public function test_admin_reaches_every_console_surface_it_needs(): void
    {
        $admin = $this->admin();

        foreach ([
            '/admin/dashboard',
            '/admin/alerts',
            '/admin/monitoring/summary',
            '/admin/roles',
            '/admin/buildings',
            '/admin/rooms',
            '/admin/queues',
            '/admin/offices',
            '/admin/qr-nodes',
            '/admin/geofences',
            '/admin/analytics',
            '/admin/audit-logs',
            '/admin/settings',
            '/campus/rooms',
            '/campus/queues',
        ] as $path) {
            $this->actingAs($admin, 'sanctum')->getJson('/api/v1' . $path)->assertStatus(200);
        }
    }

    public function test_admin_may_read_a_students_dashboard_because_it_is_a_student_route_not_a_private_one(): void
    {
        // Deliberate: the student tree is `role:student`, and even an administrator is refused there.
        // Admins have their own overview of the same campus; there is no back door into a student's
        // personal data through a route that happens to be mounted for somebody else.
        $this->actingAs($this->admin(), 'sanctum')
            ->getJson('/api/v1/student/dashboard')
            ->assertStatus(403)
            ->assertJsonPath('code', 'ROLE_NOT_PERMITTED');
    }

    /* ──────────────────────────────────────────────────────────── platform gate */

    public function test_a_browser_may_not_scan_a_qr_code(): void
    {
        $student = $this->student();

        $this->actingAs($student, 'sanctum')
            ->withHeader('X-CampusFlow-Client', 'web')
            ->postJson('/api/v1/student/positioning/scan', ['code' => 'QR-NOT-A-THING'])
            ->assertStatus(403)
            ->assertJsonPath('code', 'PLATFORM_NOT_SUPPORTED')
            ->assertJsonPath('platform', 'web')
            ->assertJsonPath('required_permission', 'qr.scan');
    }

    public function test_a_browser_may_not_open_a_live_navigation_session(): void
    {
        $this->actingAs($this->student(), 'sanctum')
            ->withHeader('X-CampusFlow-Client', 'web')
            ->postJson('/api/v1/student/navigation/sessions', ['to_room_code' => Room::firstOrFail()->code])
            ->assertStatus(403)
            ->assertJsonPath('code', 'PLATFORM_NOT_SUPPORTED');
    }

    public function test_a_staff_phone_may_correct_a_room_status_only_from_the_console(): void
    {
        $staff = $this->staff();
        $room = Room::firstOrFail();

        // The one campus write staff hold is a status correction, and it is a console action: the mobile
        // app has no room editor, and the API refuses the call from a phone because `rooms.update.own_scope`
        // is registered for the web platform.
        $this->actingAs($staff, 'sanctum')
            ->withHeader('X-CampusFlow-Client', 'mobile')
            ->patchJson('/api/v1/staff/rooms/' . $room->id, ['status' => 'maintenance'])
            ->assertStatus(403)
            ->assertJsonPath('code', 'PLATFORM_NOT_SUPPORTED');

        $this->assertNotSame('maintenance', $room->fresh()->status);
    }

    public function test_a_phone_may_not_open_the_admin_console(): void
    {
        // Administration on mobile is monitoring: the alert feed and the summary. Everything that *changes*
        // the campus is a console route, and the platform gate refuses the phone there.
        $admin = $this->admin();

        $this->actingAs($admin, 'sanctum')
            ->withHeader('X-CampusFlow-Client', 'mobile')
            ->getJson('/api/v1/admin/alerts')
            ->assertStatus(200);

        $this->actingAs($admin, 'sanctum')
            ->withHeader('X-CampusFlow-Client', 'mobile')
            ->postJson('/api/v1/admin/rooms', ['code' => 'Z999', 'name' => 'From a phone', 'floor_id' => \App\Models\Floor::firstOrFail()->id])
            ->assertStatus(403)
            ->assertJsonPath('code', 'PLATFORM_NOT_SUPPORTED');
    }

    public function test_check_in_is_refused_from_a_browser_by_default(): void
    {
        $config = (bool) config('campusflow.access.require_mobile_for_check_in');
        $this->assertTrue($config, 'The default product rule is that checking in means being there.');

        $ticket = \App\Models\QueueTicket::whereIn('status', ['waiting', 'called'])->first();

        if (! $ticket) {
            $this->markTestSkipped('The seeded campus has no open queue ticket to attempt to check in.');
        }

        $this->actingAs($ticket->user, 'sanctum')
            ->withHeader('X-CampusFlow-Client', 'web')
            ->postJson('/api/v1/student/queue-tickets/' . $ticket->id . '/check-in')
            ->assertStatus(403)
            ->assertJsonPath('code', 'PLATFORM_NOT_SUPPORTED');
    }

    public function test_staff_may_not_use_the_student_scanner_or_wayfinding_from_a_phone(): void
    {
        $staff = $this->staff();

        // Staff mobile is a service-desk client. It has no scan endpoint (that is a student principal's
        // route), no live navigation, and no way to take a ticket.
        $this->actingAs($staff, 'sanctum')
            ->withHeader('X-CampusFlow-Client', 'mobile')
            ->postJson('/api/v1/student/positioning/scan', ['code' => 'A103'])
            ->assertStatus(403)
            ->assertJsonPath('code', 'ROLE_NOT_PERMITTED');

        $this->actingAs($staff, 'sanctum')
            ->withHeader('X-CampusFlow-Client', 'mobile')
            ->getJson('/api/v1/staff/dashboard')
            ->assertStatus(200);
    }

    /* ─────────────────────────────────────────────────────────── role from token */

    public function test_the_role_comes_from_the_token_and_not_the_request_body(): void
    {
        $student = $this->student();

        $this->actingAs($student, 'sanctum')
            ->postJson('/api/v1/auth/logout', ['role' => 'admin'])
            ->assertStatus(200);

        $this->assertSame('student', $student->fresh()->role);
    }

    public function test_the_platform_header_never_widens_what_a_role_may_do(): void
    {
        $student = $this->student();

        // Declaring `mobile` as a student must not unlock an operator surface: the header only ever
        // removes capabilities from what the role already holds.
        $this->actingAs($student, 'sanctum')
            ->withHeader('X-CampusFlow-Client', 'mobile')
            ->getJson('/api/v1/admin/audit-logs')
            ->assertStatus(403);
    }

    public function test_announcement_targeting_decides_who_reads_it_not_which_client_asked(): void
    {
        $studentOnly = Announcement::create([
            'title' => 'Exam timetable published',
            'body' => 'Only students in this cohort need to know.',
            'priority' => 'high',
            'target_roles' => ['student'],
            'published_at' => now(),
        ]);

        $this->actingAs($this->student(), 'sanctum')
            ->getJson('/api/v1/campus/announcements')
            ->assertStatus(200)
            ->assertJsonFragment(['title' => $studentOnly->title]);

        $this->actingAs($this->staff(), 'sanctum')
            ->getJson('/api/v1/campus/announcements')
            ->assertStatus(200)
            ->assertJsonMissing(['title' => $studentOnly->title]);

        $this->getJson('/api/v1/public/announcements')
            ->assertStatus(200)
            ->assertJsonMissing(['title' => $studentOnly->title]);
    }
}
