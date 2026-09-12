<?php

namespace App\Http\Controllers;

use App\Exceptions\BusinessRuleException;
use App\Models\QrNode;
use App\Models\UserPosition;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Indoor positioning.
 *
 *   POST /student/positioning/scan      — resolve an anchor code to a position (student only)
 *   GET  /student/positioning/current   — this student's last known fix
 *   POST /student/positioning/position  — write this student's own fix
 *   GET  /campus/positioning/anchors    — active anchors, for a map overlay
 *
 * Scanning is a **student mobile** capability in this product: a visitor has no reason to claim a
 * position inside a building, a student on the web is not standing at the wall, staff operate lines
 * rather than hunt for rooms, and administration manages anchors through /admin/qr-nodes. The route
 * therefore carries `role:student` plus `permission:qr.scan`, and that permission is registered for
 * the mobile platform only — so the same student on the same account gets 403 from a browser, not a
 * disabled button.
 *
 * A scan also validates the anchor's *version*: a printed code that predates a rotation stops being
 * a position claim, because a revoked sticker must not keep working.
 */
class PositioningController extends Controller
{
    public function scan(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'payload' => ['sometimes', 'nullable', 'string'],
            'code'    => ['sometimes', 'nullable', 'string'],
            'version' => ['sometimes', 'nullable', 'integer', 'min:1'],
        ]);

        $code = $validated['code']
            ?? $this->extractCodeFromPayload($validated['payload'] ?? '');

        $node = QrNode::where('code', $code)->first();

        if (! $node || ! $node->is_active) {
            $this->logScanFailure($request, $code, $node ? 'revoked' : 'unknown');

            throw new BusinessRuleException(
                'That code is not a recognised CampusFlow anchor.',
                'QR_UNKNOWN',
            );
        }

        if (isset($validated['version']) && (int) $validated['version'] < (int) $node->version) {
            $this->logScanFailure($request, $code, 'stale_version');

            throw new BusinessRuleException(
                'That print-out is out of date. Use the current code for this location.',
                'QR_VERSION_STALE',
            );
        }

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

    /**
     * GET /campus/positioning/anchors
     *
     * Anchor *labels and coordinates* for map rendering — deliberately not the codes themselves.
     * Handing out live codes is what turns a map overlay into a supply of valid position claims.
     */
    public function anchors(Request $request): JsonResponse
    {
        $anchors = QrNode::with(['building', 'floor', 'room'])
            ->where('is_active', true)
            ->when($request->query('floor_id'), fn ($q, $id) => $q->where('floor_id', $id))
            ->when($request->query('building_id'), fn ($q, $id) => $q->where('building_id', $id))
            ->orderBy('label')
            ->get()
            ->map(fn (QrNode $node) => [
                'id'            => $node->id,
                'label'         => $node->label,
                'type'          => $node->type,
                'lat'           => $node->lat,
                'lng'           => $node->lng,
                'plan_x'        => $node->plan_x,
                'plan_y'        => $node->plan_y,
                'building_code' => $node->building?->code,
                'floor_name'    => $node->floor?->name,
                'room_code'     => $node->room?->code,
            ]);

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

    /** Failed scans are counted by the admin alert feed; a spike means anchors were rotated or removed. */
    private function logScanFailure(Request $request, string $code, string $reason): void
    {
        DB::table('audit_logs')->insert([
            'user_id'      => $request->user()?->id,
            'action'       => 'positioning.scan_failed',
            'subject_type' => QrNode::class,
            'subject_id'   => substr($code, 0, 40),
            'after'        => json_encode(['reason' => $reason]),
            'ip_address'   => $request->ip(),
            'created_at'   => now(),
        ]);
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
