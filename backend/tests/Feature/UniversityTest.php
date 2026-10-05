<?php

namespace Tests\Feature;

use App\Models\Building;
use App\Models\University;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The Yaoundé institution map.
 *
 * These tests guard the property that matters most about this dataset: it describes real places.
 * A regression that reseeds the campus somewhere else, or quietly invents a coordinate, has to
 * fail here rather than ship a navigation app that points people at the wrong continent.
 */
class UniversityTest extends TestCase
{
    use RefreshDatabase;

    /** Yaoundé sits at roughly 3.87 N, 11.52 E. */
    private const CITY_MIN_LAT = 3.5;
    private const CITY_MAX_LAT = 4.2;
    private const CITY_MIN_LNG = 11.2;
    private const CITY_MAX_LNG = 11.9;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    private function student(): User
    {
        return User::where('email', 'student@campusflow.edu')->firstOrFail();
    }

    public function test_seeds_the_yaounde_institutions(): void
    {
        $this->assertGreaterThanOrEqual(15, University::count());

        $uy1 = University::where('code', 'UY1')->first();

        $this->assertNotNull($uy1);
        $this->assertTrue($uy1->is_primary);
        $this->assertSame('Université de Yaoundé I', $uy1->name);
        $this->assertSame('way', $uy1->osm_type);
        $this->assertSame(188072747, $uy1->osm_id);
    }

    public function test_exactly_one_institution_is_primary(): void
    {
        $this->assertSame(1, University::where('is_primary', true)->count());
    }

    /** The regression that this whole change exists to prevent. */
    public function test_every_institution_is_inside_yaounde(): void
    {
        foreach (University::whereNotNull('lat')->get() as $university) {
            $this->assertGreaterThanOrEqual(self::CITY_MIN_LAT, $university->lat, "{$university->code} latitude");
            $this->assertLessThanOrEqual(self::CITY_MAX_LAT, $university->lat, "{$university->code} latitude");
            $this->assertGreaterThanOrEqual(self::CITY_MIN_LNG, $university->lng, "{$university->code} longitude");
            $this->assertLessThanOrEqual(self::CITY_MAX_LNG, $university->lng, "{$university->code} longitude");
        }
    }

    public function test_every_building_is_inside_yaounde(): void
    {
        foreach (Building::whereNotNull('lat')->get() as $building) {
            $this->assertGreaterThanOrEqual(self::CITY_MIN_LAT, $building->lat, "{$building->code} latitude");
            $this->assertLessThanOrEqual(self::CITY_MAX_LAT, $building->lat, "{$building->code} latitude");
            $this->assertGreaterThanOrEqual(self::CITY_MIN_LNG, $building->lng, "{$building->code} longitude");
            $this->assertLessThanOrEqual(self::CITY_MAX_LNG, $building->lng, "{$building->code} longitude");
        }
    }

    public function test_uy1_buildings_are_attached_to_uy1(): void
    {
        $uy1 = University::where('code', 'UY1')->firstOrFail();

        $this->assertGreaterThanOrEqual(30, $uy1->buildings()->count());

        $calcul = Building::where('code', 'UY1-CALCUL')->first();

        $this->assertNotNull($calcul, 'The Centre de Calcul must exist: the seeder routes queues through it.');
        $this->assertSame($uy1->id, $calcul->university_id);
    }

    /** OSM heights are surveyed for a minority of buildings; the rest must stay null, not guessed. */
    public function test_building_height_is_only_set_when_surveyed(): void
    {
        $surveyed = Building::where('code', 'UY1-BATF')->firstOrFail();
        $this->assertEqualsWithDelta(25.0, $surveyed->height_m, 0.001);

        $unsurveyed = Building::where('code', 'UY1-A1')->firstOrFail();
        $this->assertNull($unsurveyed->height_m);
    }

    public function test_campus_boundary_is_a_closed_ring(): void
    {
        $uy1 = University::where('code', 'UY1')->firstOrFail();

        $this->assertIsArray($uy1->boundary);
        $this->assertGreaterThan(3, count($uy1->boundary));
        $this->assertSame($uy1->boundary[0], $uy1->boundary[count($uy1->boundary) - 1]);
    }

    public function test_university_index_requires_authentication(): void
    {
        $this->getJson('/api/v1/campus/universities')->assertStatus(401);
    }

    public function test_student_can_list_universities(): void
    {
        $response = $this->actingAs($this->student(), 'sanctum')
            ->getJson('/api/v1/campus/universities');

        $response->assertStatus(200)->assertJsonPath('success', true);

        $universities = $response->json('data.universities');

        $this->assertNotEmpty($universities);
        // Primary institution is ordered first so the map opens on the campus being operated.
        $this->assertSame('UY1', $universities[0]['code']);
        $this->assertStringContainsString('OpenStreetMap', $response->json('data.attribution'));
    }

    public function test_student_can_read_one_university_by_code(): void
    {
        $code = University::where('code', 'UY1')->firstOrFail()->code;

        $response = $this->actingAs($this->student(), 'sanctum')
            ->getJson('/api/v1/campus/universities/' . $code);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.university.code', 'UY1')
            ->assertJsonPath('data.university.operator', 'MINESUP');

        $this->assertNotEmpty($response->json('data.buildings'));
        $this->assertSame(
            'https://www.openstreetmap.org/way/188072747',
            $response->json('data.university.osm_url')
        );
    }

    public function test_unknown_university_is_a_404(): void
    {
        $missing = 'NO-SUCH-INSTITUTION';

        $this->actingAs($this->student(), 'sanctum')
            ->getJson('/api/v1/campus/universities/' . $missing)
            ->assertStatus(404);
    }

    public function test_seeder_is_idempotent(): void
    {
        $before = University::count();
        $buildingsBefore = Building::count();

        $this->seed();

        $this->assertSame($before, University::count());
        $this->assertSame($buildingsBefore, Building::count());
    }
}
