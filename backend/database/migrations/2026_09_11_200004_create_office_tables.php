<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Administrative office ticketing system:
 *   offices          — service offices (registrar, finance, etc.)
 *   office_service_windows — named windows within an office
 *   office_staff     — pivot linking staff users to offices with role
 *   office_tickets   — student service requests / tickets
 *   office_events    — audit trail per ticket
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── offices ────────────────────────────────────────────────────────
        Schema::create('offices', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->string('code', 30)->unique();
            $table->string('name', 120);
            $table->text('description')->nullable();
            $table->foreignUuid('room_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 20)->default('active')
                  ->comment('active | closed | maintenance');
            $table->boolean('is_open')->default(false);
            $table->string('opening_hours', 120)->nullable()
                  ->comment('Human-readable; structured schedules in future');
            $table->string('phone', 40)->nullable();
            $table->string('email', 120)->nullable();
            $table->string('image_url', 500)->nullable();
            $table->integer('avg_service_minutes')->default(10);
            $table->timestamps();
            $table->softDeletes();
            $table->index('status');
        });

        // ── office_service_windows ─────────────────────────────────────────
        Schema::create('office_service_windows', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->foreignUuid('office_id')->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            $table->string('status', 20)->default('active')
                  ->comment('active | closed');
            $table->foreignId('served_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['office_id', 'status']);
        });

        // ── office_staff ───────────────────────────────────────────────────
        Schema::create('office_staff', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->foreignUuid('office_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role', 40)->default('agent')
                  ->comment('agent | supervisor | manager');
            $table->boolean('is_primary')->default(false);
            $table->timestamps();
            $table->unique(['office_id', 'user_id']);
        });

        // ── office_tickets ─────────────────────────────────────────────────
        Schema::create('office_tickets', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->foreignUuid('office_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('window_id')->nullable()->constrained('office_service_windows')->nullOnDelete();
            $table->string('ticket_number', 20)
                  ->comment('Human-readable: e.g. REG-042');
            $table->string('subject', 255);
            $table->text('notes')->nullable();
            $table->string('status', 30)->default('waiting')
                  ->comment('waiting | called | approaching | in_service | completed | cancelled | no_show');
            $table->string('idempotency_key', 120)->unique();
            // Join geolocation
            $table->decimal('joined_lat', 10, 7)->nullable();
            $table->decimal('joined_lng', 10, 7)->nullable();
            $table->string('join_source', 20)->default('manual');
            // Lifecycle
            $table->timestamp('called_at')->nullable();
            $table->timestamp('service_started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancelled_by', 20)->nullable();
            $table->timestamps();

            $table->unique(['office_id', 'user_id', 'status'], 'unique_active_office_ticket');
            $table->index(['office_id', 'status']);
            $table->index(['user_id', 'status']);
        });

        // ── office_events ──────────────────────────────────────────────────
        Schema::create('office_events', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->foreignUuid('ticket_id')->constrained('office_tickets')->cascadeOnDelete();
            $table->string('type', 40);
            $table->json('metadata')->nullable();
            $table->timestamp('created_at');
            $table->index(['ticket_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('office_events');
        Schema::dropIfExists('office_tickets');
        Schema::dropIfExists('office_staff');
        Schema::dropIfExists('office_service_windows');
        Schema::dropIfExists('offices');
    }
};
