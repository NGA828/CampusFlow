<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * `timetable_entries.effective_from` was NOT NULL with no default, so publishing a session without
 * one failed with a raw SQLSTATE 23502. Every other layer already treats a missing value as "runs
 * for the whole term" — `BuildsRoomAvailability` filters on `whereNull('effective_from')` and
 * `TimetableEntry::toApiArray()` null-coalesces it — so the column, not the callers, was wrong.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE timetable_entries ALTER COLUMN effective_from DROP NOT NULL');
    }

    public function down(): void
    {
        DB::statement("UPDATE timetable_entries SET effective_from = CURRENT_DATE WHERE effective_from IS NULL");
        DB::statement('ALTER TABLE timetable_entries ALTER COLUMN effective_from SET NOT NULL');
    }
};