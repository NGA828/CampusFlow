<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Extends the default users table with:
 *  - role enum (visitor | student | staff | admin)
 *  - status enum (active | inactive | suspended)
 *  - student-specific profile columns (student_id, registration_no, program, year_level)
 *  - staff-specific profile columns (staff_id)
 *  - shared profile columns (phone, department, avatar_url)
 *  - soft deletes
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // RBAC & Status
            $table->string('role', 20)->default('student')->after('email')
                ->comment('visitor | student | staff | admin');
            $table->string('status', 20)->default('active')->after('role');

            // Student profile
            $table->string('student_id', 50)->nullable()->unique()->after('status');
            $table->string('registration_no', 50)->nullable()->unique()->after('student_id');
            $table->string('program', 120)->nullable()->after('registration_no');
            $table->integer('year_level')->nullable()->after('program');

            // Staff profile
            $table->string('staff_id', 50)->nullable()->unique()->after('year_level');

            // Shared profile
            $table->string('department', 120)->nullable()->after('staff_id');
            $table->string('phone', 30)->nullable()->after('department');
            $table->string('avatar_url', 500)->nullable()->after('phone');

            // Soft deletes
            $table->softDeletes();

            // Indexes
            $table->index('role');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropSoftDeletes();
            $table->dropIndex(['role']);
            $table->dropIndex(['status']);
            $table->dropColumn([
                'role', 'status', 'student_id', 'registration_no', 'program',
                'year_level', 'staff_id', 'department', 'phone', 'avatar_url'
            ]);
        });
    }
};
