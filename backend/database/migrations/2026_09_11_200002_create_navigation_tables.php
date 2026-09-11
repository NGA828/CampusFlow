<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Indoor navigation graph:
 *   navigation_nodes — physical waypoints (rooms, corridors, lifts, stairs, exits)
 *   navigation_edges — weighted directed edges between nodes
 *   geofences        — labelled geographic zones for proximity triggers
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── navigation_nodes ───────────────────────────────────────────────
        Schema::create('navigation_nodes', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->string('label', 120)->nullable();
            $table->string('type', 30)->default('waypoint')
                  ->comment('waypoint | room_entry | lift | stairwell | exit | toilet | info');
            $table->foreignUuid('building_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('floor_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('room_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('qr_node_id')->nullable()->constrained('qr_nodes')->nullOnDelete();
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
            $table->decimal('plan_x', 10, 4)->nullable();
            $table->decimal('plan_y', 10, 4)->nullable();
            $table->boolean('is_accessible')->default(true)
                  ->comment('wheelchair/mobility accessible');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
            $table->index('type');
            $table->index('is_accessible');
            $table->index('is_active');
        });

        // ── navigation_edges ───────────────────────────────────────────────
        Schema::create('navigation_edges', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->foreignUuid('from_node_id')->constrained('navigation_nodes')->cascadeOnDelete();
            $table->foreignUuid('to_node_id')->constrained('navigation_nodes')->cascadeOnDelete();
            $table->decimal('weight', 8, 2)->default(1.0)
                  ->comment('Cost for routing: usually Euclidean metres');
            $table->boolean('bidirectional')->default(true);
            $table->boolean('accessible')->default(true)
                  ->comment('Safe for wheelchair/mobility-impaired users');
            $table->string('edge_type', 30)->default('corridor')
                  ->comment('corridor | stairwell | lift | outdoor | ramp');
            $table->timestamps();
            $table->unique(['from_node_id', 'to_node_id']);
            $table->index('accessible');
        });

        // ── geofences ──────────────────────────────────────────────────────
        Schema::create('geofences', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->string('name', 120);
            $table->string('type', 40)->default('building')
                  ->comment('building | floor | room | campus_zone | parking | outdoor_area');
            $table->foreignUuid('building_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('floor_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('room_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('center_lat', 10, 7)->nullable();
            $table->decimal('center_lng', 10, 7)->nullable();
            $table->decimal('radius_m', 8, 2)->nullable()
                  ->comment('Null = polygon mode; use polygon_json instead');
            $table->json('polygon_json')->nullable()
                  ->comment('GeoJSON polygon — used when radius_m is null');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
            $table->index('type');
            $table->index('is_active');
        });

        // ── navigation_sessions ────────────────────────────────────────────
        Schema::create('navigation_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('from_node_id')->nullable()->constrained('navigation_nodes')->nullOnDelete();
            $table->foreignUuid('to_node_id')->nullable()->constrained('navigation_nodes')->nullOnDelete();
            $table->foreignUuid('to_room_id')->nullable()->constrained('rooms')->nullOnDelete();
            $table->string('status', 20)->default('active')
                  ->comment('active | completed | abandoned');
            $table->boolean('accessible')->default(false);
            $table->json('route_snapshot')->nullable()
                  ->comment('Serialised route nodes+edges at session start');
            $table->decimal('current_lat', 10, 7)->nullable();
            $table->decimal('current_lng', 10, 7)->nullable();
            $table->decimal('current_plan_x', 10, 4)->nullable();
            $table->decimal('current_plan_y', 10, 4)->nullable();
            $table->foreignUuid('current_floor_id')->nullable()->constrained('floors')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('abandoned_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('navigation_sessions');
        Schema::dropIfExists('geofences');
        Schema::dropIfExists('navigation_edges');
        Schema::dropIfExists('navigation_nodes');
    }
};
