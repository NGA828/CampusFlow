<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Engagement & communication tables:
 *   campus_events   — events (seminars, fairs, sports)
 *   event_registrations — student ↔ event
 *   announcements   — system & staff announcements
 *   notifications   — per-user notification inbox
 *   ai_conversations — AI assistant conversation threads
 *   ai_messages      — messages within an AI conversation
 *   audit_logs       — system-wide immutable audit trail
 *   settings         — admin key-value configuration store
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── campus_events ──────────────────────────────────────────────────
        Schema::create('campus_events', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->string('title', 200);
            $table->text('description')->nullable();
            $table->string('category', 40)->default('general');
            $table->foreignUuid('room_id')->nullable()->constrained()->nullOnDelete();
            $table->string('venue', 200)->nullable();
            $table->timestamp('starts_at');
            $table->timestamp('ends_at');
            $table->integer('capacity')->nullable();
            $table->string('image_url', 500)->nullable();
            $table->string('status', 20)->default('published')
                  ->comment('draft | published | cancelled');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['starts_at', 'status']);
            $table->index('category');
        });

        // ── event_registrations ────────────────────────────────────────────
        Schema::create('event_registrations', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->foreignUuid('event_id')->constrained('campus_events')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['event_id', 'user_id']);
        });

        // ── announcements ──────────────────────────────────────────────────
        Schema::create('announcements', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->string('title', 200);
            $table->text('body');
            $table->string('priority', 20)->default('normal')
                  ->comment('low | normal | high | urgent');
            $table->json('target_roles')->nullable()
                  ->comment('null = all roles; else array of role strings');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('published_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['published_at', 'priority']);
        });

        // ── notifications ──────────────────────────────────────────────────
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 60)
                  ->comment('queue_called | queue_admitted | office_called | announcement | event | system');
            $table->string('title', 200);
            $table->text('body')->nullable();
            $table->json('data')->nullable()
                  ->comment('Context for deep-link: {ticket_id, office_id, etc.}');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'read_at']);
            $table->index(['user_id', 'created_at']);
        });

        // ── ai_conversations ───────────────────────────────────────────────
        Schema::create('ai_conversations', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title', 200)->nullable();
            $table->timestamp('last_message_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['user_id', 'last_message_at']);
        });

        // ── ai_messages ────────────────────────────────────────────────────
        Schema::create('ai_messages', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->foreignUuid('conversation_id')->constrained('ai_conversations')->cascadeOnDelete();
            $table->string('role', 20)->comment('user | assistant | system');
            $table->text('content');
            $table->json('tool_calls')->nullable();
            $table->json('tool_results')->nullable();
            $table->timestamps();
            $table->index(['conversation_id', 'created_at']);
        });

        // ── audit_logs ─────────────────────────────────────────────────────
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action', 80);
            $table->string('subject_type', 80)->nullable();
            $table->string('subject_id', 40)->nullable();
            $table->json('before')->nullable();
            $table->json('after')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 300)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['user_id', 'created_at']);
            $table->index(['subject_type', 'subject_id']);
            $table->index('action');
        });

        // ── settings ───────────────────────────────────────────────────────
        Schema::create('settings', function (Blueprint $table) {
            $table->string('key', 80)->primary();
            $table->json('value')->nullable();
            $table->string('description', 300)->nullable();
            $table->string('group', 40)->default('general');
            $table->timestamps();
            $table->index('group');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('ai_messages');
        Schema::dropIfExists('ai_conversations');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('announcements');
        Schema::dropIfExists('event_registrations');
        Schema::dropIfExists('campus_events');
    }
};
