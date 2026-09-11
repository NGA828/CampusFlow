<?php

namespace App\Http\Controllers;

use App\Models\QrNode;
use App\Models\UserPosition;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Positioning endpoints:
 *   POST /positioning/scan       — resolve a QR code to a position
 *   GET  /positioning/current    — get the user's last known position
 *   POST /positioning/position   — update position from GPS/manual
 *   GET  /positioning/anchors    — list all active QR nodes (for map overlay)
 */
class PositioningController extends Controller
{
    public function scan(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'payload' => ['sometimes', 'nullable', 'string'],
            'code'    => ['sometimes', 'nullable', 'string'],
        ]);

        $code = $validated['code']
            ?? $this->extractCodeFromPayload($validated['payload'] ?? '');

        $node = QrNode::where('code', $code)
            ->where('is_active', true)
            ->firstOrFail();

        // Persist position from this scan
        $this->upsertPosition($request->user()->id, [
            'lat'         => $node->lat,
            'lng'         => $node->lng,
            'plan_x'      => $node->plan_x,
            'plan_y'      => $node->plan_y,
            'building_id' => $node->building_id,
            'floor_id'    => $node->floor_id,
            'room_id'     => $node->room_id,
            'source'      => 'qr',
        ]);

        $position = UserPosition::where('user_id', $request->user()->id)->first();

        return response()->json([
            'success' => true,
            'data'    => [
                'position' => $this->positionArray($position),
                'qr_node'  => $node->toApiArray(),
            ],
        ]);
    }

    public function current(Request $request): JsonResponse
    {
        $position = UserPosition::where('user_id', $request->user()->id)->first();

        return response()->json([
            'success' => true,
            'data'    => ['position' => $position ? $this->positionArray($position) : null],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'lat'         => ['required', 'numeric', 'between:-90,90'],
            'lng'         => ['required', 'numeric', 'between:-180,180'],
            'accuracy_m'  => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'source'      => ['sometimes', 'string', 'in:gps,manual,simulated'],
            'building_id' => ['sometimes', 'nullable', 'uuid'],
            'floor_id'    => ['sometimes', 'nullable', 'uuid'],
            'plan_x'      => ['sometimes', 'nullable', 'numeric'],
            'plan_y'      => ['sometimes', 'nullable', 'numeric'],
        ]);

        $this->upsertPosition($request->user()->id, $validated);

        $position = UserPosition::where('user_id', $request->user()->id)->first();

        return response()->json([
            'success' => true,
            'data'    => ['position' => $this->positionArray($position)],
        ]);
    }

    public function anchors(): JsonResponse
    {
        $anchors = QrNode::where('is_active', true)
            ->orderBy('label')
            ->get()
            ->map(fn ($n) => $n->toApiArray());

        return response()->json([
            'success' => true,
            'data'    => ['anchors' => $anchors],
        ]);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function upsertPosition(int $userId, array $fields): void
    {
        UserPosition::updateOrCreate(
            ['user_id' => $userId],
            array_merge($fields, ['recorded_at' => now()])
        );
    }

    private function positionArray(?UserPosition $pos): ?array
    {
        if (! $pos) return null;
        return [
            'lat'         => $pos->lat,
            'lng'         => $pos->lng,
            'plan_x'      => $pos->plan_x,
            'plan_y'      => $pos->plan_y,
            'accuracy_m'  => $pos->accuracy_m,
            'building_id' => $pos->building_id,
            'floor_id'    => $pos->floor_id,
            'room_id'     => $pos->room_id,
            'source'      => $pos->source,
            'recorded_at' => $pos->recorded_at?->toIso8601String(),
        ];
    }

    private function extractCodeFromPayload(string $payload): string
    {
        // Supports full scan URL: https://campusflow.edu/scan/{code}
        if (preg_match('#/scan/([A-Za-z0-9_-]+)#', $payload, $m)) {
            return $m[1];
        }
        return $payload;
    }
}
