<?php

namespace Tests\Feature;

use App\Models\NavigationNode;
use App\Models\QrNode;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NavigationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_can_scan_qr_code(): void
    {
        $user = \App\Models\User::where('role', 'student')->first();
        $qr = QrNode::first();

        // Scanning is a mobile grant: the same request from a browser is refused with
        // PLATFORM_NOT_SUPPORTED, which is why the web client has no scanner at all.
        $response = $this->actingAs($user, 'sanctum')
            ->withHeader('X-CampusFlow-Client', 'mobile')
            ->postJson('/api/v1/student/positioning/scan', [
                'code' => $qr->code,
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    /**
     * The admin console prints `CF1|<code>|<version>|<signature>`, which is what the phone camera
     * hands to the scanner, so the printed graphic has to validate end to end.
     */
    public function test_scans_the_signed_anchor_payload_printed_by_the_admin_console(): void
    {
        $user = User::where('role', 'student')->firstOrFail();
        $qr = QrNode::firstOrFail();

        $response = $this->actingAs($user, 'sanctum')
            ->withHeader('X-CampusFlow-Client', 'mobile')
            ->postJson('/api/v1/student/positioning/scan', ['payload' => $qr->signedPayload()]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.qr_node.code', $qr->code);
    }

    public function test_rejects_a_signed_payload_whose_signature_was_edited(): void
    {
        $user = User::where('role', 'student')->firstOrFail();
        $qr = QrNode::firstOrFail();

        $forged = 'CF1|' . $qr->code . '|' . $qr->version . '|' . str_repeat('a', 64);

        $response = $this->actingAs($user, 'sanctum')
            ->withHeader('X-CampusFlow-Client', 'mobile')
            ->postJson('/api/v1/student/positioning/scan', ['payload' => $forged]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('code', 'QR_SIGNATURE_INVALID');
    }

    public function test_scans_a_bare_hand_typed_code(): void
    {
        $user = User::where('role', 'student')->firstOrFail();
        $qr = QrNode::firstOrFail();

        $response = $this->actingAs($user, 'sanctum')
            ->withHeader('X-CampusFlow-Client', 'mobile')
            ->postJson('/api/v1/student/positioning/scan', ['code' => $qr->code]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.qr_node.code', $qr->code);
    }

    public function test_scans_an_anchor_json_badge_printed_before_the_signed_format(): void
    {
        $user = User::where('role', 'student')->firstOrFail();
        $qr = QrNode::firstOrFail();

        $response = $this->actingAs($user, 'sanctum')
            ->withHeader('X-CampusFlow-Client', 'mobile')
            ->postJson('/api/v1/student/positioning/scan', [
                'payload' => json_encode([
                    'id'      => $qr->id,
                    'code'    => $qr->code,
                    'version' => $qr->version,
                ]),
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.qr_node.code', $qr->code);
    }

    public function test_scans_a_scan_link_that_carries_the_code_as_a_query_parameter(): void
    {
        $user = User::where('role', 'student')->firstOrFail();
        $qr = QrNode::firstOrFail();

        $response = $this->actingAs($user, 'sanctum')
            ->withHeader('X-CampusFlow-Client', 'mobile')
            ->postJson('/api/v1/student/positioning/scan', [
                'payload' => 'https://campusflow.edu/scan?qr=' . $qr->code,
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.qr_node.code', $qr->code);
    }

    public function test_rejects_a_print_out_older_than_the_rotated_code(): void
    {
        $user = User::where('role', 'student')->firstOrFail();
        $qr = QrNode::firstOrFail();
        $qr->increment('version');

        $response = $this->actingAs($user, 'sanctum')
            ->withHeader('X-CampusFlow-Client', 'mobile')
            ->postJson('/api/v1/student/positioning/scan', [
                'payload' => json_encode([
                    'id'      => $qr->id,
                    'code'    => $qr->code,
                    'version' => $qr->version - 1,
                ]),
            ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('code', 'QR_VERSION_STALE');
    }

    public function test_can_find_navigation_route(): void
    {
        $nodes = NavigationNode::take(2)->get();

        $response = $this->actingAs(User::where('role', 'student')->firstOrFail(), 'sanctum')
            ->postJson('/api/v1/campus/navigation/route', [
            'from_node_id' => $nodes[0]->id,
            'to_node_id'   => $nodes[1]->id,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }
    private function waypoint(string $label, bool $active = true): NavigationNode
    {
        return NavigationNode::create([
            'label' => $label, 'type' => 'waypoint', 'is_active' => $active,
            'is_accessible' => true, 'lat' => 3.86, 'lng' => 11.51,
        ]);
    }

    private function connect(NavigationNode $from, NavigationNode $to, float $metres, bool $accessible = true, bool $bidirectional = true): void
    {
        \App\Models\NavigationEdge::create([
            'from_node_id' => $from->id, 'to_node_id' => $to->id,
            'weight' => $metres, 'accessible' => $accessible,
            'bidirectional' => $bidirectional, 'edge_type' => 'outdoor',
        ]);
    }

    public function test_shortest_route_uses_distance_not_fewest_edges_and_excludes_inactive_shortcuts(): void
    {
        $a = $this->waypoint('Start');
        $b = $this->waypoint('Bend');
        $c = $this->waypoint('End');
        $closed = $this->waypoint('Closed passage', false);
        $this->connect($a, $c, 100);
        $this->connect($a, $b, 10);
        $this->connect($b, $c, 15);
        $this->connect($a, $closed, 1);
        $this->connect($closed, $c, 1);
        $this->actingAs(User::where('role', 'student')->firstOrFail(), 'sanctum')
            ->postJson('/api/v1/campus/navigation/route', ['from_node_id' => $a->id, 'to_node_id' => $c->id])
            ->assertOk()->assertJsonPath('data.route.distance_m', 25)
            ->assertJsonPath('data.route.nodes.1.id', $b->id)
            ->assertJsonPath('data.route.steps.1.node_id', $b->id);
    }

    public function test_step_free_route_can_be_longer_and_disconnected_routes_fail(): void
    {
        $a = $this->waypoint('Start');
        $b = $this->waypoint('Ramp');
        $c = $this->waypoint('End');
        $this->connect($a, $c, 10, false);
        $this->connect($a, $b, 20);
        $this->connect($b, $c, 20);
        $this->actingAs(User::where('role', 'student')->firstOrFail(), 'sanctum')
            ->postJson('/api/v1/campus/navigation/route', ['from_node_id' => $a->id, 'to_node_id' => $c->id, 'accessible' => true])
            ->assertOk()->assertJsonPath('data.route.distance_m', 40);
        $isolated = $this->waypoint('Disconnected');
        $this->postJson('/api/v1/campus/navigation/route', ['from_node_id' => $a->id, 'to_node_id' => $isolated->id])
            ->assertUnprocessable();
    }

    public function test_one_way_path_cannot_be_traversed_backwards(): void
    {
        $a = $this->waypoint('One-way entrance');
        $b = $this->waypoint('One-way exit');
        $this->connect($a, $b, 12, true, false);
        $this->actingAs(User::where('role', 'student')->firstOrFail(), 'sanctum')
            ->postJson('/api/v1/campus/navigation/route', ['from_node_id' => $b->id, 'to_node_id' => $a->id])
            ->assertUnprocessable();
    }

}
