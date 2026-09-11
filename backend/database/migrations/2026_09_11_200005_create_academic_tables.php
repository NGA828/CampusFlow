<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Academic domain tables:
 *   terms        — academic terms/semesters
 *   courses      — modules/units
 *   enrollments  — student ↔ course ↔ term
 *   timetable_entries — scheduled sessions (lectures, labs, tutorials)
 *   staff_assignments — staff ↔ scope (course, room, building, etc.)
 *   user_positions    — last-known position per user (live tracking)
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── terms ──────────────────────────────────────────────────────────
        Schema::create('terms', function (Blueprint $table) {
            $table->string('code', 20)->primary()
                  ->comment('e.g. 2026-SEM1');
            $table->string('name', 120);
            $table->date('starts_at');
            $table->date('ends_at');
            $table->boolean('is_current')->default(false);
            $table->timestamps();
        });

        // ── courses ────────────────────────────────────────────────────────
        Schema::create('courses', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->string('code', 20)->unique();
            $table->string('name', 200);
            $table->string('department', 120)->nullable();
            $table->integer('credits')->default(3);
            $table->text('description')->nullable();
            $table->string('status', 20)->default('active');
            $table->timestamps();
            $table->softDeletes();
            $table->index('department');
        });

        // ── enrollments ────────────────────────────────────────────────────
        Schema::create('enrollments', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('course_id')->constrained()->cascadeOnDelete();
            $table->string('term_code', 20)->constrained('terms', 'code')->cascadeOnDelete();
            $table->string('status', 20)->default('enrolled')
                  ->comment('enrolled | dropped | completed | failed');
            $table->timestamps();
            $table->unique(['student_id', 'course_id', 'term_code']);
            $table->index(['student_id', 'term_code']);
        });

        // ── timetable_entries ──────────────────────────────────────────────
        Schema::create('timetable_entries', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->foreignUuid('course_id')->constrained()->cascadeOnDelete();
            $table->string('term_code', 20);
            $table->foreignUuid('room_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('lecturer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('type', 20)->default('lecture')
                  ->comment('lecture | lab | tutorial | seminar | exam');
            $table->tinyInteger('day_of_week')
                  ->comment('0=Sunday, 1=Monday…6=Saturday');
            $table->time('starts_at');
            $table->time('ends_at');
            $table->date('effective_from');
            $table->date('effective_until')->nullable()
                  ->comment('Null = runs for the full term');
            $table->json('excluded_dates')->nullable()
                  ->comment('ISO date strings for cancelled/holiday sessions');
            $table->timestamps();
            $table->softDeletes();
            $table->index(['term_code', 'day_of_week']);
            $table->index('room_id');
            $table->index('lecturer_id');
        });

        // ── staff_assignments ──────────────────────────────────────────────
        Schema::create('staff_assignments', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('scope_type', 40)
                  ->comment('course | room | building | floor | office | campus');
            $table->string('scope_id', 40)
                  ->comment('UUID or code of the scoped entity');
            $table->string('role_in_scope', 40)->nullable()
                  ->comment('e.g. lecturer, lab_assistant, room_manager');
            $table->boolean('can_manage_timetable')->default(false);
            $table->boolean('can_publish_content')->default(false);
            $table->boolean('can_call_tickets')->default(false);
            $table->timestamps();
            $table->unique(['user_id', 'scope_type', 'scope_id']);
            $table->index(['scope_type', 'scope_id']);
        });

        // ── user_positions ──────────────────────────────────────────────────
        Schema::create('user_positions', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
            $table->decimal('plan_x', 10, 4)->nullable();
            $table->decimal('plan_y', 10, 4)->nullable();
            $table->decimal('accuracy_m', 8, 2)->nullable();
            $table->foreignUuid('building_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('floor_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('room_id')->nullable()->constrained()->nullOnDelete();
            $table->string('source', 20)->default('gps')
                  ->comment('gps | qr | manual | simulated');
            $table->timestamp('recorded_at')->useCurrent();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_positions');
        Schema::dropIfExists('staff_assignments');
        Schema::dropIfExists('timetable_entries');
        Schema::dropIfExists('enrollments');
        Schema::dropIfExists('courses');
        Schema::dropIfExists('terms');
    }
};
