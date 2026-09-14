<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\RespondsJson;
use App\Models\Announcement;
use App\Models\Building;
use App\Models\CampusEvent;
use App\Models\Floor;
use App\Models\Office;
use App\Models\Room;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Visitor surface — the authenticated-free reading of campus.
 *
 * These endpoints answer the questions a member of the public is allowed to ask ("where is the
 * library, is it open, what's on this week") and nothing else. They are deliberate **projections**,
 * not the internal `CampusController` payloads:
 *
 *   no QR anchor codes or payloads — an anchor is a check-in credential;
 *   no navigation graph (nodes/edges) — the routing model is campus infrastructure, not tourism;
 *   no room occupancy, class links, student lists, timetables or queue lines;
 *   no buildings flagged non-public, and no closed/hidden rooms.
 *
 * A visitor therefore cannot reach a student, staff or admin payload by guessing a URL: the
 * private read paths live under `role:` guards, and these routes never call them.
 */
class PublicCampusController extends Controller
{
    use RespondsJson;

    /** GET /public/buildings */
    public function buildings(): JsonResponse
    {
        $buildings = Building::query()
            ->where('status', '!=', 'closed')
            ->where('is_public', true)
            ->orderBy('name')
            ->get()
            ->map(fn (Building $b) => [
                'id'          => $b->id,
                'code'        => $b->code,
                'name'        => $b->name,
                'description' => $b->description ?? null,
                'address'     => $b->address ?? null,
                'lat'         => $b->lat,
                'lng'         => $b->lng,
                'footprint'   => $b->footprint,
                'floors'      => Floor::where('building_id', $b->id)->where('status', '!=', 'closed')->count(),
            ]);

        return $this->ok(['buildings' => $buildings->values()]);
    }

    /** GET /public/buildings/{code} */
    public function building(string $code): JsonResponse
    {
        $building = Building::query()
            ->where(function ($query) use ($code) {
                $query->where('code', strtoupper($code));
                if (Str::isUuid($code)) {
                    $query->orWhere('id', $code);
                }
            })
            ->where('is_public', true)
            ->firstOrFail();

        $floors = Floor::where('building_id', $building->id)
            ->where('status', '!=', 'closed')
            ->orderBy('level')
            ->get()
            ->map(fn (Floor $f) => [
                'id'          => $f->id,
                'code'        => $f->code,
                'name'        => $f->name,
                'level'       => $f->level,
                'rooms'       => $this->publicRoomQuery()->where('floor_id', $f->id)->count(),
            ]);

        $rooms = $this->publicRoomQuery()
            ->with('floor')
            ->where(fn ($q) => $q->where('floor_id', $floors->pluck('id')->all()))
            ->orderBy('code')
            ->get()
            ->map(fn (Room $r) => $this->roomProjection($r));

        return $this->ok([
            'building' => [
                'id'          => $building->id,
                'code'        => $building->code,
                'name'        => $building->name,
                'description' => $building->description ?? null,
                'address'     => $building->address ?? null,
                'lat'         => $building->lat,
                'lng'         => $building->lng,
                'footprint'   => $building->footprint,
                'image_url'   => $building->image_url ?? null,
            ],
            'floors' => $floors->values(),
            'rooms'  => $rooms->values(),
        ]);
    }

    /** GET /public/rooms?building=&type=&q= — the public room finder. */
    public function rooms(Request $request): JsonResponse
    {
        $query = $this->publicRoomQuery()->with('floor.building');

        if ($search = trim((string) $request->query('q', ''))) {
            $query->where(fn ($q) => $q->where('code', 'ilike', "%{$search}%")->orWhere('name', 'ilike', "%{$search}%"));
        }

        if ($type = $request->query('type')) {
            $query->where('type', $type);
        }

        if ($building = $request->query('building')) {
            $floorIds = Floor::query()
                ->where('building_id', $building)
                ->orWhereHas('building', fn ($q) => $q->where('code', strtoupper($building)))
                ->pluck('id');
            $query->whereIn('floor_id', $floorIds);
        }

        $perPage = min(max((int) $request->query('per_page', 24), 1), 100);
        $paged = $query->orderBy('code')->paginate($perPage);

        return $this->ok([
            'items' => collect($paged->items())->map(fn (Room $r) => $this->roomProjection($r))->values(),
            'meta'  => [
                'total'        => $paged->total(),
                'per_page'     => $paged->perPage(),
                'current_page' => $paged->currentPage(),
                'last_page'    => $paged->lastPage(),
            ],
        ]);
    }

    /** GET /public/rooms/{code} */
    public function room(string $code): JsonResponse
    {
        $room = $this->publicRoomQuery()
            ->with('floor.building')
            ->where(function ($query) use ($code) {
                $query->where('code', strtoupper($code));
                if (Str::isUuid($code)) {
                    $query->orWhere('id', $code);
                }
            })
            ->firstOrFail();

        $projection = $this->roomProjection($room, true);

        return $this->ok(array_merge($projection, ['room' => $projection]));
    }

    /**
     * GET /public/floors/{id}/plan — a floor plan a visitor can read.
     *
     * The authenticated plan additionally carries QR anchors, navigation nodes/edges, geofences and
     * busy-room computation. Those are omitted here by construction: this method never reads the
     * `qr_nodes`, `navigation_nodes` or `navigation_edges` tables.
     */
    public function floorPlan(string $floorId): JsonResponse
    {
        $floor = Floor::with('building')->findOrFail($floorId);

        if (! $floor->building || ! $floor->building->is_public) {
            return $this->fail('This building is not published to the public campus map.', 404, [], 'NOT_PUBLIC');
        }

        $rooms = $this->publicRoomQuery()
            ->where('floor_id', $floor->id)
            ->get()
            ->map(fn (Room $r) => $this->roomProjection($r));

        return $this->ok([
            'floor' => [
                'id'        => $floor->id,
                'code'      => $floor->code,
                'name'      => $floor->name,
                'level'     => $floor->level,
                'plan_url'  => $floor->plan_url ?? null,
                'plan_width_m'  => $floor->plan_width_m ?? null,
                'plan_height_m' => $floor->plan_height_m ?? null,
            ],
            'building' => [
                'id'   => $floor->building->id,
                'code' => $floor->building->code,
                'name' => $floor->building->name,
                'lat'  => $floor->building->lat,
                'lng'  => $floor->building->lng,
            ],
            'rooms' => $rooms->values(),
        ]);
    }

    /** GET /public/events */
    public function events(Request $request): JsonResponse
    {
        $events = CampusEvent::query()
            ->where('status', 'published')
            ->where('starts_at', '>=', now()->subDay())
            ->orderBy('starts_at')
            ->limit(min(max((int) $request->query('per_page', 20), 1), 50))
            ->get()
            ->map(fn (CampusEvent $e) => [
                'id'         => $e->id,
                'title'      => $e->title,
                'description'=> $e->description,
                'category'   => $e->category,
                'venue'      => $e->venue,
                'room_id'    => $e->room_id,
                'starts_at'  => $e->starts_at?->toIso8601String(),
                'ends_at'    => $e->ends_at?->toIso8601String(),
                'image_url'  => $e->image_url,
                'capacity'   => $e->capacity,
            ]);

        return $this->ok(['events' => $events->values()]);
    }

    /** GET /public/announcements — published notices whose target roles include visitors. */
    public function announcements(Request $request): JsonResponse
    {
        // Visitors are a different audience, not an unauthenticated resident: `Announcement::visibleTo()`
        // resolves what a signed-in role may read, and a notice aimed at students stays out of here. The
        // expiry rule is the same one on purpose, so a withdrawn notice cannot show on one surface only.
        $announcements = Announcement::query()
            ->whereNotNull('published_at')
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>=', now()))
            ->latest('published_at')
            ->limit(min(max((int) $request->query('per_page', 20), 1), 50))
            ->get()
            ->filter(fn (Announcement $a) => $this->targetsVisitor($a))
            ->values()
            ->map(fn (Announcement $a) => $a->toApiArray());

        return $this->ok(['announcements' => $announcements]);
    }

    /** GET /public/offices — where to find the registrar, finance, etc. No lines, no names. */
    public function offices(): JsonResponse
    {
        $offices = Office::with('room.floor.building')
            ->where('status', 'active')
            ->orderBy('name')
            ->get()
            ->map(fn (Office $o) => [
                'id'            => $o->id,
                'code'          => $o->code,
                'name'          => $o->name,
                'description'   => $o->description,
                'opening_hours' => $o->opening_hours,
                'phone'         => $o->phone,
                'email'         => $o->email,
                'is_open'       => (bool) $o->is_open,
                'location'      => $o->room ? [
                    'room_code'     => $o->room->code,
                    'floor_name'    => $o->room->floor?->name,
                    'building_code' => $o->room->floor?->building?->code,
                ] : null,
            ]);

        return $this->ok(['offices' => $offices->values()]);
    }

    // ── projection rules ─────────────────────────────────────────────────────

    private function publicRoomQuery()
    {
        return Room::query()
            ->whereNotIn('status', ['closed', 'maintenance'])
            ->where('is_public', true)
            ->whereHas('floor.building', fn ($q) => $q->where('is_public', true));
    }

    private function roomProjection(Room $room, bool $withFloor = false): array
    {
        $data = [
            'code'     => $room->code,
            'name'     => $room->name,
            'type'     => $room->type,
            'capacity' => $room->capacity,
            'features' => $room->features ?? [],
            'building' => $room->floor?->building?->code,
            'floor'    => $room->floor?->name,
            'image_url'=> $room->image_url,
            'plan_x'   => $room->plan_x,
            'plan_y'   => $room->plan_y,
            'requires_admission' => (bool) $room->requires_admission,
        ];

        if ($withFloor) {
            $data['floor_id'] = $room->floor_id;
            $data['building_name'] = $room->floor?->building?->name;
        }

        return $data;
    }

    private function targetsVisitor(Announcement $announcement): bool
    {
        $targets = $announcement->target_roles;

        if (is_string($targets)) {
            $targets = json_decode($targets, true);
        }

        // No targeting means "campus-wide", which includes visitors.
        return ! is_array($targets) || $targets === [] || in_array('visitor', $targets, true);
    }
}
