<?php

namespace Tests\Feature;

use App\Models\NavigationNode;
use App\Models\QrNode;
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

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/positioning/scan', [
                'code' => $qr->code,
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_can_find_navigation_route(): void
    {
        $nodes = NavigationNode::take(2)->get();

        $response = $this->postJson('/api/v1/navigation/route', [
            'from_node_id' => $nodes[0]->id,
            'to_node_id'   => $nodes[1]->id,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true);
    }
}
