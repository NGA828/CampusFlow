<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE queue_tickets DROP CONSTRAINT IF EXISTS unique_active_ticket');
        DB::statement('ALTER TABLE office_tickets DROP CONSTRAINT IF EXISTS unique_active_office_ticket');

        DB::statement(
            "CREATE UNIQUE INDEX queue_tickets_one_active_user
             ON queue_tickets (queue_id, user_id)
             WHERE status IN ('waiting', 'called', 'navigating', 'checked_in', 'admitted')"
        );
        DB::statement(
            "CREATE UNIQUE INDEX queue_tickets_active_position
             ON queue_tickets (queue_id, position)
             WHERE status IN ('waiting', 'called', 'navigating', 'checked_in', 'admitted')"
        );
        DB::statement(
            "CREATE UNIQUE INDEX office_tickets_one_active_user
             ON office_tickets (office_id, user_id)
             WHERE status IN ('waiting', 'called', 'approaching', 'in_service')"
        );
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS queue_tickets_one_active_user');
        DB::statement('DROP INDEX IF EXISTS queue_tickets_active_position');
        DB::statement('DROP INDEX IF EXISTS office_tickets_one_active_user');

        DB::statement(
            'ALTER TABLE queue_tickets ADD CONSTRAINT unique_active_ticket UNIQUE (queue_id, user_id, status)'
        );
        DB::statement(
            'ALTER TABLE office_tickets ADD CONSTRAINT unique_active_office_ticket UNIQUE (office_id, user_id, status)'
        );
    }
};
