<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Institutions above `buildings`.
 *
 * CampusFlow was seeded as a single anonymous campus, so `buildings` was the top of the spatial
 * tree. Yaoundé has many distinct institutions (Université de Yaoundé I, ENSP, UCAC, UPAC…), each
 * with its own grounds, contact details and buildings, so a building now belongs to a university.
 *
 * `university_id` is nullable on purpose: a building that predates this migration, or one an admin
 * creates before assigning it, is still a valid row. The operational features (queues, offices,
 * timetable) are NOT scoped by this column — they continue to work exactly as before against
 * whichever buildings they already reference.
 *
 * Every seeded value for these columns comes from OpenStreetMap via
 * `database/data/yaounde-universities.json`; the `osm_type`/`osm_id` pair records the upstream
 * feature so any row can be re-verified against openstreetmap.org.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('universities', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->string('code', 20)->unique()
                  ->comment('Stable slug used by the API and seeders, e.g. UY1, ENSP, UCAC-NKB');
            $table->string('name', 160);
            $table->string('name_en', 160)->nullable();
            $table->string('short_name', 60)->nullable();
            $table->string('type', 20)->default('public')
                  ->comment('public | private | confessional');
            $table->string('operator', 80)->nullable()
                  ->comment('Supervising body, e.g. MINESUP');
            $table->text('description')->nullable();

            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
            $table->json('boundary')->nullable()
                  ->comment('GeoJSON-style [lng,lat] ring of the campus grounds; null when OSM has no polygon');

            $table->string('website', 300)->nullable();
            $table->string('email', 160)->nullable();
            $table->string('phone', 60)->nullable();
            $table->string('address', 300)->nullable();
            $table->string('wikipedia', 200)->nullable();
            $table->string('logo_url', 500)->nullable();
            $table->string('established', 40)->nullable();
            $table->string('wheelchair', 10)->nullable()
                  ->comment('OSM wheelchair tag: yes | no | limited; null = unsurveyed, never assume');

            $table->boolean('is_primary')->default(false)
                  ->comment('The institution this deployment operates: queues, offices and timetable are seeded here');
            $table->string('status', 20)->default('active');

            $table->string('osm_type', 10)->nullable()->comment('node | way | relation');
            $table->bigInteger('osm_id')->nullable();

            $table->timestamps();
            $table->softDeletes();
            $table->index('type');
            $table->index('status');
            $table->index('is_primary');
            $table->unique(['osm_type', 'osm_id']);
        });

        Schema::table('buildings', function (Blueprint $table) {
            $table->foreignUuid('university_id')->nullable()->after('id')
                  ->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('buildings', function (Blueprint $table) {
            $table->dropConstrainedForeignId('university_id');
        });

        Schema::dropIfExists('universities');
    }
};
