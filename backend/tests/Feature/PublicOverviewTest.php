<?php

namespace Tests\Feature;

use Tests\TestCase;

class PublicOverviewTest extends TestCase
{
    public function test_public_overview_returns_stats(): void
    {
        $response = $this->getJson('/api/v1/public/overview');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'stats' => ['buildings', 'rooms', 'offices', 'seats'],
                    'buildings',
                    'announcements',
                    'events',
                ],
            ]);
    }
}
