<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Acknowledgements for derived system alerts.
 *
 * Admin alerts are computed from live state (a queue past capacity, an office closed with a line
 * outside, a room whose geofence is missing) — there is no alerts table to mutate, because a stored
 * alert that nobody refreshed is worse than none. What does need persisting is the human act of
 * having seen one, which is why this table stores a fingerprint key per acknowledgement.
 *
 * `fingerprint` matches the `key` the alert feed emits (type + subject + bucket), so acknowledging a
 * condition mutes it until the condition changes and re-emits.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('alert_acknowledgements', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->string('fingerprint', 160)->unique();
            $table->string('type', 60);
            $table->foreignId('acknowledged_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('note', 300)->nullable();
            $table->timestamp('acknowledged_at')->useCurrent();
            $table->index(['type', 'acknowledged_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('alert_acknowledgements');
    }
};
