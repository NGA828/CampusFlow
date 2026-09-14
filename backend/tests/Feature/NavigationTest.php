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
}
