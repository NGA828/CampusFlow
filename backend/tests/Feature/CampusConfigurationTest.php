<?php

namespace Tests\Feature;

use App\Models\Building;
use App\Models\Floor;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CampusConfigurationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        $this->actingAs(User::where('role', 'admin')->firstOrFail(), 'sanctum');
    }

    public function test_buildings_keep_null_and_zero_coordinates_and_validate_writes(): void
    {
        $created = $this->postJson('/api/v1/admin/buildings', ['code' => 'TEST-N', 'name' => 'New wing', 'lat' => null, 'lng' => null])->assertCreated();
        $created->assertJsonPath('data.lat', null)->assertJsonPath('data.lng', null);
        $id = $created->json('data.id');
        $this->patchJson('/api/v1/admin/buildings/' . $id, ['lat' => 0, 'lng' => 0, 'address' => 'North campus'])->assertOk()->assertJsonPath('data.address', 'North campus');
        $this->assertEquals(0, Building::findOrFail($id)->lat);
        $this->patchJson('/api/v1/admin/buildings/' . $id, ['lat' => 91])->assertUnprocessable();
        $this->patchJson('/api/v1/admin/buildings/' . $id, ['campus_name' => 'Not a column'])->assertUnprocessable();
    }

    public function test_floor_code_and_metre_dimensions_are_stored_and_parent_is_immutable(): void
    {
        $b = Building::firstOrFail();
        $this->postJson('/api/v1/admin/floors', ['building_id' => $b->id, 'name' => 'Basement', 'level' => -2])->assertUnprocessable()->assertJsonValidationErrors('code');
        $result = $this->postJson('/api/v1/admin/floors', ['building_id' => $b->id, 'code' => 'TEST-B2', 'name' => 'Basement', 'level' => -2, 'plan_width_m' => 45.5, 'plan_height_m' => null])->assertCreated();
        $id = $result->json('data.id');
        $this->assertEquals(45.5, Floor::findOrFail($id)->plan_width_m);
        $this->assertNull(Floor::findOrFail($id)->plan_height_m);
        $this->patchJson('/api/v1/admin/floors/' . $id, ['building_id' => $b->id])->assertUnprocessable();
        $this->patchJson('/api/v1/admin/floors/' . $id, ['plan_width' => 60])->assertUnprocessable();
        $this->patchJson('/api/v1/admin/floors/' . $id, ['plan_width_m' => 60])->assertOk();
        $this->assertEquals(60, Floor::findOrFail($id)->plan_width_m);
    }

    public function test_room_partial_geometry_patch_preserves_metadata_and_rejects_unsupported_rectangle_fields(): void
    {
        $f = Floor::firstOrFail();
        $result = $this->postJson('/api/v1/admin/rooms', ['floor_id' => $f->id, 'code' => 'TEST-ROOM', 'name' => 'Seminar space', 'type' => 'seminar', 'area_m2' => 28.5, 'features' => ['projector'], 'plan_x' => 0, 'plan_y' => 12])->assertCreated();
        $id = $result->json('data.id');
        $this->patchJson('/api/v1/admin/rooms/' . $id, ['plan_x' => 1.23456789, 'plan_y' => 2.5])->assertOk(); // Spatial editor still accepts computed coordinates; DB precision applies.
        $r = Room::findOrFail($id);
        $this->assertEquals(1.2346, $r->plan_x);
        $this->assertSame(['projector'], $r->features);
        $this->assertSame('seminar', $r->type);
        $this->patchJson('/api/v1/admin/rooms/' . $id, ['floor_id' => $f->id])->assertUnprocessable();
        $this->patchJson('/api/v1/admin/rooms/' . $id, ['plan_w' => 6])->assertUnprocessable();
        $this->patchJson('/api/v1/admin/rooms/' . $id, ['capacity' => -1])->assertUnprocessable();
    }

    public function test_room_search_stays_inside_parent_scope_and_floor_zero_is_searchable(): void
    {
        $b = Building::create(['code' => 'TEST-P', 'name' => 'Parent']);
        $f = Floor::create(['building_id' => $b->id, 'code' => 'GROUND', 'name' => 'Ground', 'level' => 0]);
        $other = Floor::firstOrFail();
        Room::create(['floor_id' => $f->id, 'code' => 'MATCH-ONE', 'name' => 'In scope']);
        Room::create(['floor_id' => $other->id, 'code' => 'MATCH-TWO', 'name' => 'Outside scope']);
        $feed = $this->getJson('/api/v1/admin/rooms?floor_id=' . $f->id . '&q=MATCH&per_page=1')->assertOk();
        $feed->assertJsonPath('data.meta.total', 1)->assertJsonPath('data.items.0.code', 'MATCH-ONE');
        $floors = $this->getJson('/api/v1/admin/floors?building_id=' . $b->id . '&q=0')->assertOk();
        $floors->assertJsonPath('data.meta.total', 1)->assertJsonPath('data.items.0.level', 0);
        $this->getJson('/api/v1/admin/buildings?q=TEST-P')->assertOk()->assertJsonPath('data.items.0.floors_count', 1);
    }

    public function test_linked_places_are_not_removed_and_unused_removal_returns_identity(): void
    {
        $b = Building::create(['code' => 'TEST-USED', 'name' => 'Used place']);
        $f = Floor::create(['building_id' => $b->id, 'code' => 'F0', 'name' => 'Ground', 'level' => 0]);
        $this->deleteJson('/api/v1/admin/buildings/' . $b->id)->assertConflict();
        $this->deleteJson('/api/v1/admin/floors/' . $f->id)->assertOk()->assertJsonPath('data.deleted', $f->id);
        $this->deleteJson('/api/v1/admin/buildings/' . $b->id)->assertConflict(); // Historical floor still references it.
        $unused = Building::create(['code' => 'TEST-EMPTY', 'name' => 'Unused']);
        $this->deleteJson('/api/v1/admin/buildings/' . $unused->id)->assertOk()->assertJsonPath('data.deleted', $unused->id);
        $this->assertSoftDeleted('buildings', ['id' => $unused->id]);
        $student = User::factory()->create(['role' => 'student']);
        $this->actingAs($student, 'sanctum')->postJson('/api/v1/admin/buildings', ['code' => 'DENIED', 'name' => 'Denied'])->assertForbidden();
    }
}
