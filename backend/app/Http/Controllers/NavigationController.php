<?php

namespace App\Http\Controllers;

use App\Models\NavigationEdge;
use App\Models\NavigationNode;
use App\Models\NavigationSession;
use App\Models\Room;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Navigation endpoints:
 *   POST /navigation/route                             — compute a route (stateless)
 *   POST /navigation/sessions                          — start a navigation session
 *   GET  /navigation/sessions/active                   — get active session
 *   POST /navigation/sessions/{id}/position            — update live position
 *   POST /navigation/sessions/{id}/complete
 *   POST /navigation/sessions/{id}/abandon
 *   GET  /navigation/sessions                          — history
 *   PATCH /navigation/sessions/{id}                    — pause / resume / change destination
 *   GET  /navigation/nodes/{id}                        — single node detail
 *
 * Route *domain* note: these endpoints are reached through /campus/navigation/* (route preview,
 * graph reads) and /student/navigation/sessions/* (live tracking). There is no single
 * /navigation/* surface any role can use — the live loop belongs to the student mobile client and
 * the graph itself belongs to administration. See routes/api.php.
 */
class NavigationController extends Controller
{
    // ── Route (stateless) ────────────────────────────────────────────────────

    public function route(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'to_room_id'   => ['sometimes', 'nullable', 'uuid'],
            'to_room_code' => ['sometimes', 'nullable', 'string'],
            'to_node_id'   => ['sometimes', 'nullable', 'uuid'],
            'from_node_id' => ['sometimes', 'nullable', 'uuid'],
            'accessible'   => ['sometimes', 'boolean'],
        ]);

        $toNode = $this->resolveDestination($validated);

        if (! $toNode) {
            return $this->error('Destination not found or has no navigation node.', 422);
        }

        $accessible = $validated['accessible'] ?? false;
        $route      = $this->computeRoute($validated['from_node_id'] ?? null, $toNode->id, $accessible);

        return response()->json([
            'success' => true,
            'data'    => [
                'route'             => $route,
                'destination_label' => $toNode->label ?? $toNode->room?->name ?? $toNode->id,
            ],
        ]);
    }

    // ── Sessions ─────────────────────────────────────────────────────────────

    public function startSession(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'to_room_id'   => ['sometimes', 'nullable', 'uuid'],
            'to_room_code' => ['sometimes', 'nullable', 'string'],
            'to_node_id'   => ['sometimes', 'nullable', 'uuid'],
            'from_node_id' => ['sometimes', 'nullable', 'uuid'],
            'accessible'   => ['sometimes', 'boolean'],
        ]);

        $user   = $request->user();
        $toNode = $this->resolveDestination($validated);

        if (! $toNode) {
            return $this->error('Destination not found.', 422);
        }

        // Abandon any currently active session
        NavigationSession::where('user_id', $user->id)->where('status', 'active')->update([
            'status' => 'abandoned', 'abandoned_at' => now(),
        ]);

        $accessible = $validated['accessible'] ?? false;
        $route      = $this->computeRoute($validated['from_node_id'] ?? null, $toNode->id, $accessible);

        $toRoom = $toNode->room_id ? Room::find($toNode->room_id) : null;

        $session = NavigationSession::create([
            'user_id'        => $user->id,
            'from_node_id'   => $validated['from_node_id'] ?? null,
            'to_node_id'     => $toNode->id,
            'to_room_id'     => $toRoom?->id,
            'accessible'     => $accessible,
            'route_snapshot' => $route,
            'status'         => 'active',
        ]);

        return response()->json([
            'success' => true,
            'data'    => [
                'session'           => $session->toApiArray(),
                'route'             => $route,
                'destination_label' => $toNode->label ?? $toRoom?->name ?? $toNode->id,
            ],
        ], 201);
    }

    public function activeSession(Request $request): JsonResponse
    {
        $session = NavigationSession::with(['fromNode', 'toNode', 'toRoom'])
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->latest()
            ->first();

        return response()->json([
            'success' => true,
            'data'    => [
                'session'           => $session?->toApiArray(),
                'route'             => $session?->route_snapshot,
                'destination_label' => $session?->toNode?->label ?? $session?->toRoom?->name,
            ],
        ]);
    }

    public function updatePosition(Request $request, string $sessionId): JsonResponse
    {
        $session = NavigationSession::where('id', $sessionId)
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->firstOrFail();

        $validated = $request->validate([
            'lat'       => ['required', 'numeric'],
            'lng'       => ['required', 'numeric'],
            'accuracy_m'=> ['sometimes', 'nullable', 'numeric'],
            'source'    => ['sometimes', 'string'],
            'plan_x'    => ['sometimes', 'nullable', 'numeric'],
            'plan_y'    => ['sometimes', 'nullable', 'numeric'],
            'floor_id'  => ['sometimes', 'nullable', 'uuid'],
        ]);

        $session->update([
            'current_lat'    => $validated['lat'],
            'current_lng'    => $validated['lng'],
            'current_plan_x' => $validated['plan_x'] ?? null,
            'current_plan_y' => $validated['plan_y'] ?? null,
            'current_floor_id' => $validated['floor_id'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'data'    => [
                'session' => $session->fresh()->toApiArray(),
                'route'   => $session->route_snapshot,
            ],
        ]);
    }

    public function complete(Request $request, string $sessionId): JsonResponse
    {
        $session = NavigationSession::where('id', $sessionId)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $session->update(['status' => 'completed', 'completed_at' => now()]);

        return response()->json(['success' => true, 'data' => ['status' => 'completed']]);
    }

    public function abandon(Request $request, string $sessionId): JsonResponse
    {
        $session = NavigationSession::where('id', $sessionId)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $session->update(['status' => 'abandoned', 'abandoned_at' => now()]);

        return response()->json(['success' => true, 'data' => ['status' => 'abandoned']]);
    }

    public function history(Request $request): JsonResponse
    {
        $sessions = NavigationSession::where('user_id', $request->user()->id)
            ->latest()
            ->limit(50)
            ->get()
            ->map(fn ($s) => $s->toApiArray());

        return response()->json(['success' => true, 'data' => ['sessions' => $sessions]]);
    }

    public function node(string $id): JsonResponse
    {
        $node = NavigationNode::with(['building', 'floor', 'room'])->findOrFail($id);
        return response()->json(['success' => true, 'data' => ['node' => $node->toApiArray()]]);
    }

    // ── Graph reads ─────────────────────────────────────────────────────────

    /**
     * GET /campus/navigation/nodes
     *
     * The routing graph is infrastructure: it is what makes a route computable, and an attacker who
     * can read it can map the campus without walking it. Reads are therefore behind `spatial.view`
     * (staff and administration, plus students only where the map needs the overlay), and writes are
     * admin-only on /admin/navigation-nodes.
     */
    public function nodes(Request $request): JsonResponse
    {
        $query = NavigationNode::query();

        if ($floorId = $request->query('floor_id')) {
            $query->where('floor_id', $floorId);
        }
        if ($buildingId = $request->query('building_id')) {
            $query->where('building_id', $buildingId);
        }
        if ($request->boolean('active_only', false)) {
            $query->where('is_active', true);
        }

        $nodes = $query->orderBy('label')->limit(2000)->get()->map(fn ($n) => $n->toApiArray());

        return response()->json(['success' => true, 'data' => ['nodes' => $nodes->values()]]);
    }

    /** GET /campus/navigation/edges — the walkable links between nodes. */
    public function edges(Request $request): JsonResponse
    {
        $query = NavigationEdge::query();

        if ($floorId = $request->query('floor_id')) {
            $query->whereHas('fromNode', fn ($q) => $q->where('floor_id', $floorId));
        }
        if ($buildingId = $request->query('building_id')) {
            $query->whereHas('fromNode', fn ($q) => $q->where('building_id', $buildingId));
        }

        $edges = $query->limit(5000)->get()->map(fn ($e) => $e->toApiArray());

        return response()->json(['success' => true, 'data' => ['edges' => $edges->values()]]);
    }

    /**
     * PATCH /student/navigation/sessions/{session}
     *
     * Pause, resume, or change the destination mid-walk. Ownership is enforced by the same
     * where('user_id', …) filter the other session endpoints use, so a session id copied from
     * somebody else's URL is a 404 rather than a hijack.
     */
    public function updateSession(Request $request, string $sessionId): JsonResponse
    {
        $session = NavigationSession::where('id', $sessionId)
            ->where('user_id', $request->user()->id)
            ->whereIn('status', ['active', 'paused'])
            ->firstOrFail();

        $validated = $request->validate([
            'action'       => ['sometimes', 'string', 'in:pause,resume,reroute,change_destination'],
            'to_room_id'   => ['sometimes', 'nullable', 'uuid'],
            'to_room_code' => ['sometimes', 'nullable', 'string'],
            'to_node_id'   => ['sometimes', 'nullable', 'uuid'],
            'accessible'   => ['sometimes', 'boolean'],
        ]);

        $action = $validated['action'] ?? 'pause';

        if ($action === 'pause') {
            $session->update(['status' => 'paused']);

            return response()->json(['success' => true, 'data' => ['session' => $session->fresh()->toApiArray()]]);
        }

        if ($action === 'resume') {
            $session->update(['status' => 'active']);

            return response()->json(['success' => true, 'data' => ['session' => $session->fresh()->toApiArray()]]);
        }

        // reroute / change_destination: recompute from the walker's current position.
        $toNode = $this->resolveDestination($validated);

        if (! $toNode) {
            return $this->error('Destination not found or has no navigation node.', 422);
        }

        // Recompute from the node the session last reported, falling back to where it started:
        // the walk has to continue from the walker, not from the original origin.
        $fromNodeId = $session->current_floor_id
            ? $this->nearestNodeOnFloor($session->current_lat, $session->current_lng, (string) $session->current_floor_id) ?? $session->from_node_id
            : $session->from_node_id;

        $route = $this->computeRoute(
            $fromNodeId,
            $toNode->id,
            (bool) ($validated['accessible'] ?? $session->accessible),
        );

        $session->update([
            'to_node_id'     => $toNode->id,
            'to_room_id'     => $validated['to_room_id'] ?? $toNode->room_id,
            'status'         => 'active',
            'route_snapshot' => $route,
        ]);

        return response()->json([
            'success' => true,
            'data'    => [
                'session'           => $session->fresh()->toApiArray(),
                'route'             => $route,
                'destination_label' => $toNode->label ?? $toNode->room?->name,
                'recalculated'      => true,
            ],
        ]);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** Closest walkable node to a raw fix on a floor — used when rerouting mid-walk. */
    private function nearestNodeOnFloor(?float $lat, ?float $lng, string $floorId): ?string
    {
        $candidates = NavigationNode::query()->where('floor_id', $floorId)->where('is_active', true)->get();

        if ($candidates->isEmpty()) {
            return null;
        }

        if ($lat === null || $lng === null) {
            return $candidates->first()->id;
        }

        $best = null;
        $bestDistance = PHP_FLOAT_MAX;

        foreach ($candidates as $node) {
            if ($node->lat === null || $node->lng === null) {
                continue;
            }

            $distance = $this->approximateMeters($lat, $lng, (float) $node->lat, (float) $node->lng);

            if ($distance < $bestDistance) {
                $bestDistance = $distance;
                $best = $node->id;
            }
        }

        return $best;
    }

    private function approximateMeters(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return 2 * 6371000 * asin(min(1.0, sqrt($a)));
    }

    private function resolveDestination(array $validated): ?NavigationNode
    {
        if (! empty($validated['to_node_id'])) {
            return NavigationNode::find($validated['to_node_id']);
        }

        $room = null;
        if (! empty($validated['to_room_id'])) {
            $room = Room::find($validated['to_room_id']);
        } elseif (! empty($validated['to_room_code'])) {
            $room = Room::where('code', strtoupper($validated['to_room_code']))->first();
        }

        if ($room) {
            return NavigationNode::where('room_id', $room->id)->where('type', 'room_entry')->first()
                ?? NavigationNode::where('room_id', $room->id)->first();
        }

        return null;
    }

    /**
     * Simple BFS/greedy route calculation.
     * Phase C will swap this for a proper Dijkstra with accessible-only filtering.
     */
    private function computeRoute(?string $fromNodeId, string $toNodeId, bool $accessible): array
    {
        // Load all active nodes + edges for the graph
        $nodes = NavigationNode::where('is_active', true)
            ->when($accessible, fn ($q) => $q->where('is_accessible', true))
            ->get()
            ->keyBy('id');

        $edges = NavigationEdge::when($accessible, fn ($q) => $q->where('accessible', true))
            ->get();

        // Build adjacency list
        $adj = [];
        foreach ($edges as $edge) {
            $adj[$edge->from_node_id][] = ['node' => $edge->to_node_id, 'weight' => $edge->weight, 'edge' => $edge];
            if ($edge->bidirectional) {
                $adj[$edge->to_node_id][] = ['node' => $edge->from_node_id, 'weight' => $edge->weight, 'edge' => $edge];
            }
        }

        if (! $fromNodeId || ! isset($nodes[$fromNodeId]) || ! isset($nodes[$toNodeId])) {
            return ['nodes' => [], 'edges' => [], 'total_distance_m' => 0];
        }

        // Dijkstra
        $dist   = [$fromNodeId => 0];
        $prev   = [];
        $queue  = new \SplMinHeap();
        $queue->insert([0, $fromNodeId]);

        while (! $queue->isEmpty()) {
            [$d, $u] = $queue->extract();
            if ($d > ($dist[$u] ?? PHP_INT_MAX)) continue;
            if ($u === $toNodeId) break;

            foreach ($adj[$u] ?? [] as $neighbour) {
                $v   = $neighbour['node'];
                $alt = $d + $neighbour['weight'];
                if ($alt < ($dist[$v] ?? PHP_INT_MAX)) {
                    $dist[$v] = $alt;
                    $prev[$v] = ['from' => $u, 'edge' => $neighbour['edge']];
                    $queue->insert([$alt, $v]);
                }
            }
        }

        // Reconstruct path
        $path  = [];
        $edgesUsed = [];
        $cur   = $toNodeId;
        while (isset($prev[$cur])) {
            array_unshift($path, $cur);
            array_unshift($edgesUsed, $prev[$cur]['edge']->toApiArray());
            $cur = $prev[$cur]['from'];
        }
        array_unshift($path, $fromNodeId);

        return [
            'nodes'             => collect($path)->map(fn ($id) => $nodes[$id]?->toApiArray())->filter()->values(),
            'edges'             => $edgesUsed,
            'total_distance_m'  => round($dist[$toNodeId] ?? 0, 2),
        ];
    }

    private function error(string $message, int $status): JsonResponse
    {
        return response()->json(['success' => false, 'message' => $message], $status);
    }
}
