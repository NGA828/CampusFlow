<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Per-anchor secret for the signed QR payload `CF1|<code>|<version>|<signature>`.
 *
 * The secret never leaves the server, so a printed badge cannot be edited into a position
 * somebody else claims. Existing anchors are given a secret here so their next printed graphic is
 * signed; the scan endpoint keeps accepting an unsigned code typed by hand.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('qr_nodes', function (Blueprint $table) {
            $table->string('secret', 64)->nullable()->after('code')
                ->comment('Per-anchor HMAC secret; never exposed by the API');
        });

        foreach (DB::table('qr_nodes')->select('id')->get() as $node) {
            DB::table('qr_nodes')->where('id', $node->id)->update(['secret' => Str::random(64)]);
        }
    }

    public function down(): void
    {
        Schema::table('qr_nodes', function (Blueprint $table) {
            $table->dropColumn('secret');
        });
    }
};
