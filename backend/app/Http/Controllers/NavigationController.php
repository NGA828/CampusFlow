<?php

namespace App\Http\Controllers;

use App\Models\Building;
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
            'from_lat' => ['sometimes', 'nullable', 'numeric', 'between:-90,90', 'required_with:from_lng'],
            'from_lng' => ['sometimes', 'nullable', 'numeric', 'between:-180,180', 'required_with:from_lat'],
            'from_plan_x' => ['sometimes', 'nullable', 'numeric', 'required_with:from_plan_y,from_floor_id'],
            'from_plan_y' => ['sometimes', 'nullable', 'numeric', 'required_with:from_plan_x,from_floor_id'],
            'from_floor_id' => ['sometimes', 'nullable', 'uuid', 'required_with:from_plan_x,from_plan_y'],
            'from_building_id' => ['sometimes', 'nullable', 'uuid'],
            'accessible'   => ['sometimes', 'boolean'],
        ]);

        $toNode = $this->resolveDestination($validated);

        if (! $toNode) {
            return $this->error('Destination not found or has no navigation node.', 422);
        }

        $accessible = $validated['accessible'] ?? false;
        $fromNodeId = $this->resolveOriginNodeId($validated, $accessible);
        $route      = $this->computeRoute($fromNodeId, $toNode->id, $accessible);

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
            'from_lat' => ['sometimes', 'nullable', 'numeric', 'between:-90,90', 'required_with:from_lng'],
            'from_lng' => ['sometimes', 'nullable', 'numeric', 'between:-180,180', 'required_with:from_lat'],
            'from_plan_x' => ['sometimes', 'nullable', 'numeric', 'required_with:from_plan_y,from_floor_id'],
            'from_plan_y' => ['sometimes', 'nullable', 'numeric', 'required_with:from_plan_x,from_floor_id'],
            'from_floor_id' => ['sometimes', 'nullable', 'uuid', 'required_with:from_plan_x,from_plan_y'],
            'from_building_id' => ['sometimes', 'nullable', 'uuid'],
            'accessible'   => ['sometimes', 'boolean'],
        ]);

        $user   = $request->user();
        $toNode = $this->resolveDestination($validated);

        if (! $toNode) {
            return $this->error('Destination not found.', 422);
        }

        $accessible = $validated['accessible'] ?? false;
        $fromNodeId = $this->resolveOriginNodeId($validated, $accessible);
        $route      = $this->computeRoute($fromNodeId, $toNode->id, $accessible);

        // Keep an existing walk active unless the new destination and origin form a valid route.
        NavigationSession::where('user_id', $user->id)->where('status', 'active')->update([
            'status' => 'abandoned', 'abandoned_at' => now(),
        ]);

        $toRoom = $toNode->room_id ? Room::find($toNode->room_id) : null;

        $session = NavigationSession::create([
            'user_id'        => $user->id,
            'from_node_id'   => $fromNodeId,
            'to_node_id'     => $toNode->id,
            'current_lat'    => $validated['from_lat'] ?? null,
            'current_lng'    => $validated['from_lng'] ?? null,
            'current_plan_x' => $validated['from_plan_x'] ?? null,
            'current_plan_y' => $validated['from_plan_y'] ?? null,
            'current_floor_id' => $validated['from_floor_id'] ?? null,
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

        $edges = $query->with(['fromNode:id,floor_id', 'toNode:id,floor_id'])->limit(5000)->get()->map(fn ($e) => $e->toApiArray());

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

    /** Resolve a phone's precise QR-plan fix or GPS fix to the nearest published route node. */
    private function resolveOriginNodeId(array $validated, bool $accessible): ?string
    {
        if (! empty($validated['from_node_id'])) {
            return $validated['from_node_id'];
        }

        $candidates = NavigationNode::query()
            ->where('is_active', true)
            ->when($accessible, fn ($query) => $query->where('is_accessible', true)->whereNotIn('type', ['stairs', 'stairwell']));

        if (isset($validated['from_plan_x'], $validated['from_plan_y'], $validated['from_floor_id'])) {
            $nodes = (clone $candidates)
                ->where('floor_id', $validated['from_floor_id'])
                ->when($validated['from_building_id'] ?? null, fn ($query, $id) => $query->where('building_id', $id))
                ->whereNotNull('plan_x')
                ->whereNotNull('plan_y')
                ->get();

            $bestNode = null;
            $bestDistance = PHP_FLOAT_MAX;
            foreach ($nodes as $node) {
                $dx = (float) $node->plan_x - (float) $validated['from_plan_x'];
                $dy = (float) $node->plan_y - (float) $validated['from_plan_y'];
                $distance = sqrt($dx * $dx + $dy * $dy);
                if ($distance < $bestDistance) {
                    $bestNode = $node;
                    $bestDistance = $distance;
                }
            }

            // A scan far from any route node is not a safe origin; do not draw a made-up shortcut.
            return $bestDistance <= 150 ? $bestNode?->id : null;
        }

        if (isset($validated['from_lat'], $validated['from_lng'])) {
            $nodes = (clone $candidates)
                ->where(function ($query) {
                    // Geospatial route origins belong to campus/outdoor anchors. Indoor room nodes
                    // often carry a building centroid, which is not a walkable starting point.
                    $query->whereNull('floor_id')->orWhereIn('type', ['entrance', 'exit', 'outdoor']);
                })
                ->whereNotNull('lat')
                ->whereNotNull('lng')
                ->get();

            $bestNode = null;
            $bestDistance = PHP_FLOAT_MAX;
            foreach ($nodes as $node) {
                $distance = $this->approximateMeters(
                    (float) $validated['from_lat'],
                    (float) $validated['from_lng'],
                    (float) $node->lat,
                    (float) $node->lng,
                );
                if ($distance < $bestDistance) {
                    $bestNode = $node;
                    $bestDistance = $distance;
                }
            }

            return $bestDistance <= 1000 ? $bestNode?->id : null;
        }

        return null;
    }

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

        $code = trim($validated['to_room_code'] ?? '');

        $room = null;
        if (! empty($validated['to_room_id'])) {
            $room = Room::find($validated['to_room_id']);
        } elseif ($code !== '') {
            $upper = strtoupper($code);
            // 1. Exact match on code (case-insensitive)
            $room = Room::whereRaw('UPPER(code) = ?', [$upper])->first();

            // 2. Normalize hyphens/spaces (e.g. ADM101 -> ADM-101 or ADM 101 -> ADM-101)
            if (! $room && preg_match('/^([A-Z]+)\s*[-_]?\s*(\d+)$/i', $code, $m)) {
                $normalized = strtoupper($m[1]) . '-' . $m[2];
                $room = Room::whereRaw('UPPER(code) = ?', [$normalized])->first();
            }

            // 3. Prefix or room name match
            if (! $room) {
                $room = Room::whereRaw('UPPER(code) LIKE ?', [$upper . '%'])
                    ->orWhereRaw('UPPER(name) LIKE ?', ['%' . $upper . '%'])
                    ->first();
            }
        }

        if ($room) {
            $node = NavigationNode::where('room_id', $room->id)->where('type', 'room_entry')->first()
                ?? NavigationNode::where('room_id', $room->id)->first();
            return $node;
        }

        // 4. Fallback: match Building code or name if no room matched (e.g., ADM, STB, LIB, ENG, BUS, SAC, SUB)
        if ($code !== '') {
            $upper = strtoupper($code);
            $building = Building::whereRaw('UPPER(code) = ?', [$upper])
                ->orWhereRaw('UPPER(name) LIKE ?', ['%' . $upper . '%'])
                ->first();

            if ($building) {
                return NavigationNode::where('building_id', $building->id)->where('type', 'exit')->first()
                    ?? NavigationNode::where('building_id', $building->id)->first();
            }
        }

        return null;
    }

    /**
     * Dijkstra over published walkable edges, weighted in metres.
     */
    private function computeRoute(?string $fromNodeId, string $toNodeId, bool $accessible): array
    {
        if (! $fromNodeId) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'route' => 'No walkable route connects these places with the selected accessibility preference. Choose another starting point or ask campus staff to check the published paths.',
            ]);
        }

        // Load all active nodes + edges for the graph
        $nodes = NavigationNode::with(['building', 'floor', 'room'])
            ->where('is_active', true)
            ->when($accessible, fn ($q) => $q->where('is_accessible', true)->whereNotIn('type', ['stairs', 'stairwell']))
            ->get()
            ->keyBy('id');

        $edges = NavigationEdge::with(['fromNode:id,floor_id', 'toNode:id,floor_id'])
            ->when($accessible, fn ($q) => $q->where('accessible', true))
            ->get();

        if (! isset($nodes[$fromNodeId]) || ! isset($nodes[$toNodeId])) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'route' => 'No walkable route connects these places with the selected accessibility preference. Choose another starting point or ask campus staff to check the published paths.',
            ]);
        }

        // Build adjacency list
        $adj = [];
        foreach ($edges as $edge) {
            // Never route through a node excluded by activity/accessibility filters.
            if (! isset($nodes[$edge->from_node_id], $nodes[$edge->to_node_id])
                || ! is_finite((float) $edge->weight) || $edge->weight < 0
                || ($accessible && in_array($edge->edge_type, ['stairs', 'stairwell'], true))) {
                continue;
            }
            $adj[$edge->from_node_id][] = ['node' => $edge->to_node_id, 'weight' => (float) $edge->weight, 'edge' => $edge];
            if ($edge->bidirectional) {
                $adj[$edge->to_node_id][] = ['node' => $edge->from_node_id, 'weight' => (float) $edge->weight, 'edge' => $edge];
            }
        }

        // Dijkstra algorithm
        $dist  = [$fromNodeId => 0.0];
        $prev  = [];
        $queue = new \SplMinHeap();
        $queue->insert([0.0, $fromNodeId]);

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

        if (! isset($dist[$toNodeId])) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'route' => 'No walkable route connects these places with the selected accessibility preference. Choose another starting point or ask campus staff to check the published paths.',
            ]);
        }

        // Reconstruct path
        $pathNodeIds = [];
        $cur = $toNodeId;
        while (isset($prev[$cur])) {
            array_unshift($pathNodeIds, $cur);
            $cur = $prev[$cur]['from'];
        }
        array_unshift($pathNodeIds, $fromNodeId);

        $orderedNodes = array_values(array_filter(array_map(fn ($id) => $nodes[$id] ?? null, $pathNodeIds)));
        if (empty($orderedNodes)) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'route' => 'No walkable route connects these places with the selected accessibility preference. Choose another starting point or ask campus staff to check the published paths.',
            ]);
        }

        // Keep each selected edge with the direction actually traversed. Stored shape points are
        // ordered from edge.from_node_id to edge.to_node_id, so reverse them for reverse travel.
        $routeEdges = [];
        for ($i = 1; $i < count($orderedNodes); $i++) {
            $from = $orderedNodes[$i - 1];
            $to = $orderedNodes[$i];
            $edge = $prev[$to->id]['edge'];
            $geometry = $edge->geometry ?? [];
            if ($edge->from_node_id !== $from->id) {
                $geometry = array_reverse($geometry);
            }
            $routeEdges[] = [
                'id' => $edge->id,
                'from_node_id' => $from->id,
                'to_node_id' => $to->id,
                'kind' => match ($edge->edge_type) {
                    'stairwell' => 'stairs',
                    'lift' => 'elevator',
                    default => $edge->edge_type,
                },
                'geometry_space' => $edge->geometry_space,
                'geometry' => $geometry,
                'distance_m' => (float) $edge->weight,
            ];
        }

        $originNode = $orderedNodes[0];
        $destNode   = end($orderedNodes);

        $totalDistance = round($dist[$toNodeId], 2);
        $durationSeconds = (int) round($totalDistance / 1.2);

        $usesStairs = false;
        $steps = [];
        $transitions = [];

        // 1. Build Steps & Transitions
        $steps[] = [
            'index'        => 0,
            'node_id'      => $originNode->id,
            'instruction'  => 'Start at ' . ($originNode->label ?? 'starting anchor'),
            'kind'         => 'start',
            'distance_m'   => 0,
            'duration_s'   => 0,
            'floor_id'     => $originNode->floor_id,
            'floor_name'   => $originNode->floor?->name,
        ];

        for ($i = 1; $i < count($orderedNodes); $i++) {
            $prevNode = $orderedNodes[$i - 1];
            $currNode = $orderedNodes[$i];
            $edgeWeight = ($dist[$currNode->id] ?? 0) - ($dist[$prevNode->id] ?? 0);

            if (in_array($currNode->type, ['stairs', 'stairwell'], true) || in_array($prevNode->type, ['stairs', 'stairwell'], true) || in_array($prev[$currNode->id]['edge']->edge_type, ['stairs', 'stairwell'], true)) {
                $usesStairs = true;
            }

            $instruction = "Head to {$currNode->label}";
            $stepKind = 'walk';
            // Only vertical/passsage edges change floors; outdoor geo paths may connect
            // entrance anchors that carry floor metadata for their building.
            $transitionEdge = $prev[$currNode->id]['edge'];
            $isOutdoorEdge = $transitionEdge->edge_type === 'outdoor' || $transitionEdge->geometry_space === 'geo';
            if ($prevNode->floor_id && $currNode->floor_id && $prevNode->floor_id !== $currNode->floor_id && ! $isOutdoorEdge) {
                $edgeKind = $transitionEdge->edge_type;
                $kind = match ($edgeKind) {
                    'lift', 'elevator' => 'elevator',
                    'stairwell', 'stairs' => 'stairs',
                    'ramp' => 'ramp',
                    default => 'passage',
                };
                if ($kind === 'stairs') $usesStairs = true;
                $floorName = $currNode->floor?->name ?? 'Level ' . ($currNode->floor?->level ?? 1);
                $instruction = "Take the {$kind} to {$floorName}";
                $stepKind = $kind;
                $transitions[] = [
                    'kind'        => $kind,
                    'instruction' => "Take {$kind} to {$floorName}",
                    'floor_name'  => $floorName,
                    'distance_m'  => round($edgeWeight, 1),
                ];
            } elseif ($prevNode->floor_id === null && $currNode->floor_id !== null) {
                $instruction = 'Enter ' . ($currNode->building?->name ?? 'the building') . ' at ' . $currNode->label;
                $stepKind = 'entrance';
            } elseif ($prevNode->floor_id !== null && $currNode->floor_id === null) {
                $instruction = 'Exit the building toward ' . $currNode->label;
                $stepKind = 'exit';
            }

            $steps[] = [
                'index'        => $i,
                'node_id'      => $currNode->id,
                'instruction'  => $instruction,
                'kind'         => $stepKind,
                'distance_m'   => round($edgeWeight, 1),
                'duration_s'   => (int) round($edgeWeight / 1.2),
                'floor_id'     => $currNode->floor_id,
                'floor_name'   => $currNode->floor?->name,
            ];
        }

        $steps[] = [
            'index'        => count($orderedNodes),
            'node_id'      => $destNode->id,
            'instruction'  => 'Arrive at ' . ($destNode->room?->name ?? $destNode->label),
            'kind'         => 'arrive',
            'distance_m'   => 0,
            'duration_s'   => 0,
            'floor_id'     => $destNode->floor_id,
            'floor_name'   => $destNode->floor?->name,
        ];

        // Group route edges by coordinate space. Outdoor links can join two entrance
        // nodes that have floor metadata, while a lift/stair transition must not be
        // drawn as a line between unrelated floor plans.
        $legs = [];
        $currentLegNodes = [];
        $currentLegEdges = [];
        $currentLegSpace = null;
        $currentFloorId = null;
        $flushLeg = function () use (&$legs, &$currentLegNodes, &$currentLegEdges, &$currentLegSpace, &$currentFloorId): void {
            if ($currentLegNodes) {
                $legs[] = $this->buildLeg($currentLegNodes, $currentLegEdges, $currentLegSpace);
            }
            $currentLegNodes = [];
            $currentLegEdges = [];
            $currentLegSpace = null;
            $currentFloorId = null;
        };

        foreach ($routeEdges as $index => $edge) {
            $from = $orderedNodes[$index];
            $to = $orderedNodes[$index + 1];
            $space = $edge['geometry_space']
                ?? (($edge['kind'] === 'outdoor' || $from->floor_id === null || $to->floor_id === null)
                    ? 'geo'
                    : ($from->floor_id === $to->floor_id ? 'plan' : null));

            if ($space === null || ($space === 'plan' && $from->floor_id !== $to->floor_id)) {
                $flushLeg();
                continue;
            }

            $floorChanged = $space === 'plan' && $currentFloorId !== $from->floor_id;
            $disconnected = $currentLegNodes && end($currentLegNodes)->id !== $from->id;
            if ($currentLegSpace !== $space || $floorChanged || $disconnected) {
                $flushLeg();
                $currentLegNodes = [$from];
                $currentLegSpace = $space;
                $currentFloorId = $space === 'plan' ? $from->floor_id : null;
            }
            if (! $currentLegNodes) {
                $currentLegNodes = [$from];
                $currentLegSpace = $space;
                $currentFloorId = $space === 'plan' ? $from->floor_id : null;
            }
            $currentLegEdges[] = $edge;
            $currentLegNodes[] = $to;
        }
        $flushLeg();
        if (! $routeEdges) {
            $legs[] = $this->buildLeg([$originNode], [], $originNode->floor_id ? 'plan' : 'geo');
        }

        return [
            'nodes'       => array_map(fn ($n) => $n->toApiArray(), $orderedNodes),
            'edges'       => $routeEdges,
            'steps'       => $steps,
            'legs'        => $legs,
            'transitions' => $transitions,
            'distance_m'  => $totalDistance,
            'duration_s'  => $durationSeconds,
            'accessible'  => $accessible,
            'uses_stairs' => $usesStairs,
            'origin'      => [
                'label' => $originNode->label,
                'node'  => $originNode->toApiArray(),
            ],
            'destination' => [
                'label'   => $destNode->room?->name ?? $destNode->label,
                'node'    => $destNode->toApiArray(),
                'room_id' => $destNode->room_id,
            ],
        ];
    }

    private function buildLeg(array $legNodes, array $legEdges = [], ?string $spaceOverride = null): array
    {
        $first = $legNodes[0];
        $allSameFloor = true;
        $firstFloorId = $first->floor_id;
        foreach ($legNodes as $node) {
            if ($node->floor_id !== $firstFloorId) {
                $allSameFloor = false;
                break;
            }
        }

        $space = $spaceOverride ?? ($allSameFloor && $firstFloorId !== null ? 'plan' : 'geo');
        $floorId = $space === 'plan' && $allSameFloor ? $firstFloorId : null;
        $floorName = $floorId !== null ? ($first->floor?->name ?? 'Floor Plan') : 'Campus Grounds';
        $getCoordinate = static function ($node) use ($space): ?array {
            if ($space === 'plan' && $node->plan_x !== null && $node->plan_y !== null) {
                return [(float) $node->plan_x, (float) $node->plan_y];
            }
            if ($space === 'geo' && $node->lat !== null && $node->lng !== null) {
                return [(float) $node->lng, (float) $node->lat];
            }
            return null;
        };
        $isCoordinate = static fn ($point): bool => is_array($point)
            && count($point) === 2
            && is_numeric($point[0])
            && is_numeric($point[1])
            && is_finite((float) $point[0])
            && is_finite((float) $point[1]);

        $coordinates = [];
        $segmentGeometry = [];
        $complete = count($legEdges) === max(0, count($legNodes) - 1);
        $firstCoordinate = $getCoordinate($legNodes[0]);
        if ($firstCoordinate === null) {
            $complete = false;
        } else {
            $coordinates[] = $firstCoordinate;
        }

        foreach ($legEdges as $index => $edge) {
            $shape = $edge['geometry'] ?? [];
            if ($shape && ($edge['geometry_space'] ?? null) !== $space) {
                $complete = false;
                break;
            }
            $hasSavedShape = count($shape) > 0;
            foreach ($shape as $point) {
                if (! $isCoordinate($point)) {
                    $complete = false;
                    break 2;
                }
                $coordinates[] = [(float) $point[0], (float) $point[1]];
                $segmentGeometry[] = true;
            }
            $nextCoordinate = $getCoordinate($legNodes[$index + 1] ?? null);
            if ($nextCoordinate === null) {
                $complete = false;
                break;
            }
            $coordinates[] = $nextCoordinate;
            $segmentGeometry[] = $hasSavedShape;
        }
        if (! $complete) {
            $coordinates = [];
            $segmentGeometry = [];
        }

        $distance = array_sum(array_map(static fn ($edge) => (float) ($edge['distance_m'] ?? 0), $legEdges));
        $points = $space === 'plan'
            ? array_map(static fn ($point) => ['x' => $point[0], 'y' => $point[1]], $coordinates)
            : [];
        $geo = $space === 'geo'
            ? array_map(static fn ($point) => ['lat' => $point[1], 'lng' => $point[0]], $coordinates)
            : [];

        return [
            'floor_id'      => $floorId,
            'floor_name'    => $floorName,
            'floor_level'   => $allSameFloor ? ($first->floor?->level ?? 1) : 0,
            'building_code' => $allSameFloor ? ($first->building?->code ?? null) : null,
            'distance_m'    => round($distance, 1),
            'duration_s'    => (int) round($distance / 1.2),
            'points'        => $points,
            'geo'           => $geo,
            'segment_geometry' => $segmentGeometry,
        ];
    }

    private function error(string $message, int $status): JsonResponse
    {
        return response()->json(['success' => false, 'message' => $message], $status);
    }
}
