<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('navigation_edges', function (Blueprint $table) {
            // Intermediate coordinates only; edge endpoints are always taken from their nodes.
            // Plan coordinates are [x, y], geographic coordinates are [longitude, latitude].
            $table->json('geometry')->nullable();
            $table->string('geometry_space', 8)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('navigation_edges', function (Blueprint $table) {
            $table->dropColumn(['geometry', 'geometry_space']);
        });
    }
};
