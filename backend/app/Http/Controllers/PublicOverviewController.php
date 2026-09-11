<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;

/**
 * GET /api/v1/public/overview
 *
 * Provides public metrics, active buildings, announcements, and upcoming events
 * for the landing page without authentication.
 */
class PublicOverviewController extends Controller
{
    public function __invoke(): JsonResponse
    {
        // Placeholders until full domain tables are seeded in Phase B
        return response()->json([
            'success' => true,
            'data' => [
                'stats' => [
                    'buildings' => 12,
                    'rooms'     => 148,
                    'offices'   => 8,
                    'seats'     => 4200,
                    'events'    => 5,
                ],
                'buildings' => [],
                'announcements' => [],
                'events' => [],
            ],
            'message' => 'Public campus overview retrieved.',
        ]);
    }
}
