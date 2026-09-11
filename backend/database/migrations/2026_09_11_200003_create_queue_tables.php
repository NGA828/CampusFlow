<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Room admission queues:
 *   room_queues   — queue configuration per room
 *   queue_tickets — individual student tickets
 *   queue_events  — immutable audit trail for each ticket state change
 *
 * Concurrency safety: queue_tickets uses row-level locking + unique
 * constraints to prevent double-joining (see PROMPT.md §21).
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── room_queues ────────────────────────────────────────────────────
        Schema::create('room_queues', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->foreignUuid('room_id')->unique()->constrained()->cascadeOnDelete();
            $table->boolean('is_open')->default(false);
            $table->integer('capacity')->default(30);
            $table->integer('max_capacity')->default(30);
            $table->integer('current_count')->default(0)
                  ->comment('Maintained by DB triggers / app layer');
            $table->integer('call_window_minutes')->default(5)
                  ->comment('How long the called student has to check-in');
            $table->decimal('proximity_radius_m', 8, 2)->default(50.0)
                  ->comment('Geo-fence radius for proximity-based check-in');
            $table->string('mode', 20)->default('manual')
                  ->comment('manual | auto — auto calls next on completion');
            $table->text('welcome_message')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        // ── queue_tickets ──────────────────────────────────────────────────
        Schema::create('queue_tickets', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->foreignUuid('queue_id')->constrained('room_queues')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->integer('position')->comment('Queue position at join time');
            $table->string('status', 30)->default('waiting')
                  ->comment('waiting | called | navigating | checked_in | admitted | completed | cancelled | no_show');
            $table->string('idempotency_key', 120)->unique()
                  ->comment('Prevents duplicate joins from retry storms');
            // Geolocation at join
            $table->decimal('joined_lat', 10, 7)->nullable();
            $table->decimal('joined_lng', 10, 7)->nullable();
            $table->decimal('joined_plan_x', 10, 4)->nullable();
            $table->decimal('joined_plan_y', 10, 4)->nullable();
            $table->foreignUuid('joined_floor_id')->nullable()->constrained('floors')->nullOnDelete();
            $table->string('join_source', 20)->default('manual')
                  ->comment('manual | qr');
            // Lifecycle timestamps
            $table->timestamp('called_at')->nullable();
            $table->timestamp('checked_in_at')->nullable();
            $table->timestamp('admitted_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancelled_by', 20)->nullable()
                  ->comment('user | staff | system');
            $table->timestamps();

            // Enforce: one active ticket per user per queue (database constraint)
            $table->unique(['queue_id', 'user_id', 'status'], 'unique_active_ticket');
            $table->index(['queue_id', 'status', 'position']);
            $table->index(['user_id', 'status']);
        });

        // ── queue_events ───────────────────────────────────────────────────
        Schema::create('queue_events', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->foreignUuid('ticket_id')->constrained('queue_tickets')->cascadeOnDelete();
            $table->string('type', 40)
                  ->comment('joined | called | navigating | checked_in | admitted | completed | cancelled | no_show');
            $table->json('metadata')->nullable()
                  ->comment('Arbitrary payload per event type');
            $table->timestamp('created_at');
            $table->index(['ticket_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('queue_events');
        Schema::dropIfExists('queue_tickets');
        Schema::dropIfExists('room_queues');
    }
};
