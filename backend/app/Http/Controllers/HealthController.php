<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * GET /api/v1/health
 *
 * Used by the Next.js landing page (server-side) to confirm the API is up
 * and to show database latency. Returns 200 when healthy, 503 when not.
 */
class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $start = microtime(true);

        try {
            DB::select('SELECT 1');
            $latency = round((microtime(true) - $start) * 1000, 2);
            $dbOk    = true;
        } catch (\Throwable) {
            $latency = null;
            $dbOk    = false;
        }

        // Detect PostGIS
        $postgisVersion = null;
        if ($dbOk) {
            try {
                $row = DB::selectOne("SELECT PostGIS_Lib_Version() AS v");
                $postgisVersion = $row->v ?? null;
            } catch (\Throwable) {
                // PostGIS not installed yet — non-fatal at this phase
            }
        }

        $payload = [
            'success' => $dbOk,
            'data'    => [
                'status'   => $dbOk ? 'ok' : 'degraded',
                'database' => [
                    'engine'     => config('database.default'),
                    'latency_ms' => $latency,
                    'ok'         => $dbOk,
                    'postgis'    => $postgisVersion,
                ],
                'time' => now()->toIso8601String(),
            ],
            'message' => $dbOk ? 'CampusFlow API is healthy.' : 'Database unreachable.',
        ];

        return response()->json($payload, $dbOk ? 200 : 503);
    }
}
