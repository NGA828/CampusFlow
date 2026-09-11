<?php

namespace Tests\Feature;

use Tests\TestCase;

class HealthTest extends TestCase
{
    public function test_health_endpoint_returns_success_status(): void
    {
        $response = $this->getJson('/api/v1/health');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'status',
                    'database' => [
                        'engine',
                        'latency_ms',
                        'ok',
                    ],
                    'time',
                ],
                'message',
            ]);
    }
}
