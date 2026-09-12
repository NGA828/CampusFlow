<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Office scheduling: the columns the student-facing office flow and the Admin Web office
 * configuration both need, which the original office tables never had.
 *
 * Why this exists rather than the client inventing the numbers: the web client has always rendered
 * "open now / next window / expected window / daily capacity" for an office, but `offices` only ever
 * stored a free-text `opening_hours` string and `office_service_windows` stored a name. Either the
 * schedule is data — and therefore configurable, queryable and honest — or the screen has to lie.
 *
 * Roles and platforms (docs/role-platform-matrix.md): the columns are *configured* by admin on web
 * (`permission:office.configure`), *operated* by staff on either platform
 * (`office.operate.assigned`), and *read* by students as availability only.
 *
 * `opening_hours` stays as the human-readable string for display; `day_of_week` + `opens_at` /
 * `closes_at` are what the engine checks.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('office_service_windows', function (Blueprint $table) {
            $table->unsignedTinyInteger('day_of_week')->default(1)->after('name')
                  ->comment('0 = Sunday … 6 = Saturday, matching Carbon::dayOfWeek');
            $table->time('opens_at')->default('08:00:00')->after('day_of_week');
            $table->time('closes_at')->default('16:00:00')->after('opens_at');
            $table->integer('capacity')->default(1)->after('closes_at')
                  ->comment('Tickets this window accepts per rotation');
            $table->integer('avg_service_minutes')->default(10)->after('capacity');
            $table->boolean('is_active')->default(true)->after('status');
            $table->index(['office_id', 'day_of_week', 'is_active'], 'office_window_day_active_idx');
        });

        Schema::table('offices', function (Blueprint $table) {
            $table->integer('daily_capacity')->nullable()->after('concurrent_capacity')
                  ->comment('Tickets issued per day; null means unlimited');
            $table->boolean('requires_appointment')->default(false)->after('daily_capacity');
            $table->integer('grace_period_seconds')->default(300)->after('check_in_radius_m')
                  ->comment('How long a called student has to appear at the desk');
            $table->boolean('requires_proximity_to_request')->default(false)->after('requires_appointment')
                  ->comment('When true a ticket may only be taken inside check_in_radius_m of the office room');
        });
    }

    public function down(): void
    {
        Schema::table('office_service_windows', function (Blueprint $table) {
            $table->dropIndex('office_window_day_active_idx');
            $table->dropColumn(['day_of_week', 'opens_at', 'closes_at', 'capacity', 'avg_service_minutes', 'is_active']);
        });

        Schema::table('offices', function (Blueprint $table) {
            $table->dropColumn(['daily_capacity', 'requires_appointment', 'grace_period_seconds', 'requires_proximity_to_request']);
        });
    }
};
