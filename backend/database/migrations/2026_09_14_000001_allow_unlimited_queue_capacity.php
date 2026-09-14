<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE room_queues ALTER COLUMN max_capacity DROP NOT NULL');
    }

    public function down(): void
    {
        DB::statement('UPDATE room_queues SET max_capacity = capacity WHERE max_capacity IS NULL');
        DB::statement('ALTER TABLE room_queues ALTER COLUMN max_capacity SET NOT NULL');
    }
};
