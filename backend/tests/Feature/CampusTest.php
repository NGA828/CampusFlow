<?php

namespace Tests\Feature;

use App\Models\Building;
use App\Models\Floor;
use App\Models\Room;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CampusTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_can_list_buildings(): void
    {
        $response = $this->getJson('/api/v1/public/buildings');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertNotEmpty($response->json('data'));
    }

    public function test_can_get_single_building_details(): void
    {
        $building = Building::first();

        $response = $this->getJson('/api/v1/public/buildings/' . $building->id);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.building.code', $building->code);
    }

    public function test_can_list_rooms(): void
    {
        $response = $this->getJson('/api/v1/public/rooms');

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertNotEmpty($response->json('data'));
    }

    public function test_can_get_a_room_by_code_without_querying_the_uuid_column(): void
    {
        $room = Room::firstOrFail();

        $this->getJson('/api/v1/public/rooms/' . $room->code)
            ->assertOk()
            ->assertJsonPath('data.code', $room->code);
    }
}
