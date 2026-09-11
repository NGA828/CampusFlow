<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Core campus spatial tables:
 *   buildings → floors → rooms
 *   qr_nodes (physical QR-code anchors inside rooms/corridors)
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── buildings ──────────────────────────────────────────────────────
        Schema::create('buildings', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->string('code', 20)->unique();
            $table->string('name', 120);
            $table->string('short_name', 40)->nullable();
            $table->text('description')->nullable();
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
            $table->json('footprint')->nullable()          // GeoJSON polygon
                  ->comment('GeoJSON polygon of ground footprint');
            $table->string('image_url', 500)->nullable();
            $table->string('status', 20)->default('active')
                  ->comment('active | under_maintenance | closed');
            $table->integer('floors_count')->default(1);
            $table->timestamps();
            $table->softDeletes();
            $table->index('status');
        });

        // ── floors ────────────────────────────────────────────────────────
        Schema::create('floors', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->foreignUuid('building_id')->constrained()->cascadeOnDelete();
            $table->string('code', 20);
            $table->string('name', 80);
            $table->integer('level')->default(0)          // 0 = ground, -1 = basement, etc.
                  ->comment('Numeric floor level; 0=ground, negatives=basement');
            $table->json('plan_svg')->nullable()           // SVG floor plan meta
                  ->comment('Parsed floor-plan metadata; raw SVG served separately');
            $table->string('plan_url', 500)->nullable();
            $table->decimal('plan_width_m', 8, 2)->nullable();
            $table->decimal('plan_height_m', 8, 2)->nullable();
            $table->string('status', 20)->default('active');
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['building_id', 'code']);
            $table->index('level');
        });

        // ── rooms ─────────────────────────────────────────────────────────
        Schema::create('rooms', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->foreignUuid('floor_id')->constrained()->cascadeOnDelete();
            $table->string('code', 30)->unique();
            $table->string('name', 120);
            $table->string('type', 40)->default('classroom')
                  ->comment('classroom | lab | office | seminar | hall | common | toilet | stairwell | lift');
            $table->integer('capacity')->default(0);
            $table->decimal('area_m2', 8, 2)->nullable();
            $table->decimal('plan_x', 10, 4)->nullable();   // anchor point on floor plan
            $table->decimal('plan_y', 10, 4)->nullable();
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
            $table->json('features')->nullable()
                  ->comment('Array of strings: projector, wifi, wheelchair_access, etc.');
            $table->boolean('requires_admission')->default(false)
                  ->comment('If true, a queue ticket is needed to enter');
            $table->string('status', 20)->default('available')
                  ->comment('available | occupied | closed | maintenance');
            $table->string('image_url', 500)->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index('type');
            $table->index('status');
            $table->index('requires_admission');
        });

        // ── qr_nodes ──────────────────────────────────────────────────────
        Schema::create('qr_nodes', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->string('code', 80)->unique()
                  ->comment('Stable URL-safe code; rotated on regenerate');
            $table->string('label', 120)->nullable();
            $table->foreignUuid('building_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('floor_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('room_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
            $table->decimal('plan_x', 10, 4)->nullable();
            $table->decimal('plan_y', 10, 4)->nullable();
            $table->string('type', 30)->default('room_entry')
                  ->comment('room_entry | corridor | lift | stairwell | exit | info_point');
            $table->integer('version')->default(1)
                  ->comment('Incremented on regenerate; old scans rejected');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
            $table->index('type');
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('qr_nodes');
        Schema::dropIfExists('rooms');
        Schema::dropIfExists('floors');
        Schema::dropIfExists('buildings');
    }
};
