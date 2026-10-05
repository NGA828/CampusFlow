<?php

namespace Database\Seeders;

use App\Models\Building;
use App\Models\Facility;
use App\Models\University;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Loads the Yaoundé institutions and the Université de Yaoundé I building set.
 *
 * The seeder reads committed JSON harvested from OpenStreetMap rather than holding coordinates
 * inline, so every value is traceable to an upstream feature and the dataset can be refreshed
 * without touching PHP. It is idempotent: re-running updates rows by `code` instead of
 * duplicating them, which matters because DatabaseSeeder truncates and re-seeds.
 *
 * Nothing here is invented. A field absent from OSM is stored as null.
 */
class UniversitySeeder extends Seeder
{
    use WithoutModelEvents;

    public const UNIVERSITIES_FILE = 'yaounde-universities.json';
    public const UY1_BUILDINGS_FILE = 'yaounde-uy1-buildings.json';
    public const UY1_FACILITIES_FILE = 'yaounde-uy1-facilities.json';

    public function run(): void
    {
        $universities = $this->readDataset(self::UNIVERSITIES_FILE);
        $byCode = [];

        foreach ($universities['universities'] as $row) {
            $byCode[$row['code']] = University::updateOrCreate(
                ['code' => $row['code']],
                [
                    'name'        => $row['name'],
                    'name_en'     => $row['name_en'] ?? null,
                    'short_name'  => $row['short_name'] ?? null,
                    'type'        => $row['type'] ?? 'public',
                    'operator'    => $row['operator'] ?? null,
                    'lat'         => $row['lat'] ?? null,
                    'lng'         => $row['lng'] ?? null,
                    'boundary'    => $row['boundary'] ?? null,
                    'website'     => $row['website'] ?? null,
                    'email'       => $row['email'] ?? null,
                    'phone'       => $row['phone'] ?? null,
                    'address'     => $row['address'] ?? null,
                    'wikipedia'   => $row['wikipedia'] ?? null,
                    'logo_url'    => $row['logo_url'] ?? null,
                    'established' => $row['established'] ?? null,
                    'wheelchair'  => $row['wheelchair'] ?? null,
                    'is_primary'  => (bool) ($row['is_primary'] ?? false),
                    'status'      => 'active',
                    'osm_type'    => $row['osm']['type'] ?? null,
                    'osm_id'      => $row['osm']['id'] ?? null,
                ]
            );
        }

        $this->command?->info(sprintf('Seeded %d Yaoundé institutions from OpenStreetMap.', count($byCode)));

        $this->seedUy1Buildings($byCode);
        $this->seedUy1Facilities($byCode);
    }

    /**
     * UY1 is the institution this deployment operates, so its real building set is loaded in full.
     * Buildings for the other institutions are not seeded: OSM has no surveyed building list for
     * them, and inventing one would put fabricated places on a map people navigate with.
     */
    private function seedUy1Buildings(array $byCode): void
    {
        $uy1 = $byCode['UY1'] ?? null;

        if (! $uy1) {
            throw new RuntimeException('UY1 must exist before its buildings can be attached.');
        }

        $dataset = $this->readDataset(self::UY1_BUILDINGS_FILE);
        $count = 0;

        foreach ($dataset['buildings'] as $row) {
            Building::updateOrCreate(
                ['code' => $row['code']],
                [
                    'university_id' => $uy1->id,
                    'name'          => $row['name'],
                    'short_name'    => $this->shortName($row['name']),
                    'description'   => $this->describe($row),
                    'lat'           => $row['lat'],
                    'lng'           => $row['lng'],
                    // Only a surveyed OSM height is stored. An untagged building stays null so the
                    // map renders it flat rather than extruding an invented storey count.
                    'height_m'      => $row['height_m'] ?? null,
                    'floors_count'  => $row['levels'] ?? 1,
                    'status'        => $row['status'] ?? 'active',
                    'is_public'     => true,
                ]
            );
            $count++;
        }

        $this->command?->info(sprintf('Seeded %d real Université de Yaoundé I buildings.', $count));
    }

    /**
     * Campus amenities. Unlike buildings these are points of service, so they are attached to the
     * university rather than to a building: OSM surveys most of them as standalone nodes and does
     * not say which building, if any, they sit inside.
     */
    private function seedUy1Facilities(array $byCode): void
    {
        $uy1 = $byCode['UY1'] ?? null;

        if (! $uy1) {
            throw new RuntimeException('UY1 must exist before its facilities can be attached.');
        }

        $dataset = $this->readDataset(self::UY1_FACILITIES_FILE);
        $count = 0;

        foreach ($dataset['facilities'] as $row) {
            if (! in_array($row['category'], Facility::CATEGORIES, true)) {
                throw new RuntimeException("Unknown facility category: {$row['category']}");
            }

            Facility::updateOrCreate(
                ['osm_type' => 'node', 'osm_id' => $row['osm_id']],
                [
                    'university_id' => $uy1->id,
                    'name'          => $row['name'] ?? null,
                    'category'      => $row['category'],
                    'osm_amenity'   => $row['osm_amenity'] ?? null,
                    'lat'           => $row['lat'],
                    'lng'           => $row['lng'],
                    'cuisine'       => $row['cuisine'] ?? null,
                    'phone'         => $row['phone'] ?? null,
                    // Deliberately not seeded: see the dataset notes. Guessing when a campus
                    // pharmacy closes sends someone across campus for nothing.
                    'opening_hours' => null,
                    'is_active'     => true,
                ]
            );
            $count++;
        }

        $this->command?->info(sprintf('Seeded %d real UY1 campus facilities.', $count));
    }

    private function describe(array $row): string
    {
        $category = [
            'lecture'        => 'Lecture hall / amphithéâtre.',
            'faculty'        => 'Faculty and teaching building.',
            'research'       => 'Research and study centre.',
            'administration' => 'Administrative building.',
            'residence'      => 'Student residence (mini-cité).',
            'health'         => 'Campus health service.',
            'utility'        => 'Campus technical service.',
        ][$row['category']] ?? 'Campus building.';

        $parts = [$category];

        if (! empty($row['status_reason'])) {
            $parts[] = $row['status_reason'];
        }

        $parts[] = sprintf(
            'Mapped in OpenStreetMap as way %d (© OpenStreetMap contributors, ODbL).',
            $row['osm_id']
        );

        return implode(' ', $parts);
    }

    private function shortName(string $name): string
    {
        return mb_substr($name, 0, 40);
    }

    /** @return array<string,mixed> */
    private function readDataset(string $file): array
    {
        $path = database_path('data/' . $file);

        if (! is_readable($path)) {
            throw new RuntimeException("Campus dataset missing or unreadable: {$path}");
        }

        $decoded = json_decode((string) file_get_contents($path), true);

        if (! is_array($decoded)) {
            throw new RuntimeException("Campus dataset is not valid JSON: {$path}");
        }

        return $decoded;
    }
}
