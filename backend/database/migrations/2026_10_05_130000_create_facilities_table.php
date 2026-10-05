<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Campus amenities: canteens, libraries, pharmacies, banks, water points, toilets, parking.
 *
 * These are deliberately NOT rooms. A room is an interior space the university schedules and
 * admits people to; a facility is a surveyed point of service a student wants to find. Modelling
 * them separately keeps the queue and timetable machinery away from data that has no capacity,
 * no owner and no booking.
 *
 * `name` is nullable because OSM frequently records a drinking-water point or a toilet block with
 * no name at all. That is a real, useful fact — the position and the kind are surveyed — so the
 * row is kept and the clients render the category instead of inventing a label.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('facilities', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->foreignUuid('university_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('building_id')->nullable()->constrained()->nullOnDelete()
                  ->comment('Set only when the facility is known to sit inside a mapped building');

            $table->string('name', 160)->nullable()
                  ->comment('Null when the upstream survey recorded no name — do not substitute one');
            $table->string('category', 30)
                  ->comment('food | study | health | money | water | sanitation | parking | worship | culture');
            $table->string('osm_amenity', 40)->nullable()
                  ->comment('Original OSM amenity value, preserved so the grouping stays reversible');

            $table->decimal('lat', 10, 7);
            $table->decimal('lng', 10, 7);

            $table->string('cuisine', 80)->nullable();
            $table->string('phone', 60)->nullable();
            $table->string('opening_hours', 120)->nullable()
                  ->comment('Only ever set from a surveyed opening_hours tag');
            $table->string('wheelchair', 10)->nullable();

            $table->boolean('is_active')->default(true);

            $table->string('osm_type', 10)->nullable();
            $table->bigInteger('osm_id')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index('category');
            $table->index('is_active');
            $table->index(['university_id', 'category']);
            $table->unique(['osm_type', 'osm_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('facilities');
    }
};
