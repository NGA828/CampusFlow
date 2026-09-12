<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The columns the role/platform model actually needs.
 *
 * Each one exists because a capability in docs/role-platform-matrix.md was being *invented* in the
 * client rather than *stored* by the platform:
 *
 *  - `is_public` (buildings, rooms): the visitor web surface is a projection, so "published to
 *    visitors" has to be data an administrator sets — not a hard-coded allow-list in a page.
 *  - `address`: the public building card.
 *  - `rooms.access_rule`: "who may enter this room at all" is a room property enforced by the queue
 *    join path, so it must be configured, not assumed.
 *  - `room_queues.no_show_grace_minutes / join_requires_proximity / allow_multiple_active_tickets`:
 *    §11 makes timeout, grace period, proximity radius and duplicate-ticket rules administrator
 *    configuration. The queue engine already enforced them as hard-coded constants; now they are
 *    policy the admin owns.
 *  - `offices.ticket_prefix / concurrent_capacity / check_in_radius_m`: the office workflow
 *    (prefix, capacity, check-in rules) is configured in Admin Web and read by the student's
 *    ticket, so the fields must exist before either side can honour them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('buildings', function (Blueprint $table) {
            $table->string('address', 200)->nullable()->after('description');
            $table->boolean('is_public')->default(true)->after('status')
                  ->comment('Shown on the visitor-facing campus map and public search');
            $table->index('is_public');
        });

        Schema::table('rooms', function (Blueprint $table) {
            $table->boolean('is_public')->default(true)->after('status')
                  ->comment('False for staff-only or restricted-space rooms');
            $table->json('access_rule')->nullable()->after('is_public')
                  ->comment('{"allowed_roles":[…], "requires_ticket":bool, "requires_badge":bool}');
            $table->index('is_public');
        });

        Schema::table('room_queues', function (Blueprint $table) {
            $table->integer('no_show_grace_minutes')->default(5)->after('call_window_minutes')
                  ->comment('How long after being called a student may still check in');
            $table->boolean('join_requires_proximity')->default(true)->after('proximity_radius_m')
                  ->comment('Reject a join that is not geofence-verified');
            $table->boolean('allow_multiple_active_tickets')->default(false)->after('join_requires_proximity')
                  ->comment('Duplicate-ticket rule for this queue');
            $table->integer('avg_service_minutes')->default(6)->after('allow_multiple_active_tickets');
        });

        Schema::table('offices', function (Blueprint $table) {
            $table->string('ticket_prefix', 8)->nullable()->after('code')
                  ->comment('Ticket number prefix, e.g. REG → REG-042');
            $table->integer('concurrent_capacity')->default(3)->after('avg_service_minutes')
                  ->comment('Service windows able to run in parallel');
            $table->decimal('check_in_radius_m', 8, 2)->default(75.0)->after('concurrent_capacity')
                  ->comment('Proximity needed to check in for a slot');
        });
    }

    public function down(): void
    {
        Schema::table('offices', function (Blueprint $table) {
            $table->dropColumn(['ticket_prefix', 'concurrent_capacity', 'check_in_radius_m']);
        });

        Schema::table('room_queues', function (Blueprint $table) {
            $table->dropColumn(['no_show_grace_minutes', 'join_requires_proximity', 'allow_multiple_active_tickets', 'avg_service_minutes']);
        });

        Schema::table('rooms', function (Blueprint $table) {
            $table->dropIndex(['is_public']);
            $table->dropColumn(['is_public', 'access_rule']);
        });

        Schema::table('buildings', function (Blueprint $table) {
            $table->dropIndex(['is_public']);
            $table->dropColumn(['address', 'is_public']);
        });
    }
};
