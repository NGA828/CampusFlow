<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\BuildsRoomAvailability;
use App\Http\Controllers\Concerns\RespondsJson;
use App\Models\Building;
use App\Models\Floor;
use App\Models\Room;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Campus spatial endpoints:
 *  GET /buildings
 *  GET /buildings/{id}
 *  GET /buildings/{id}/floors
 *  GET /floors/{id}/plan
 *  GET /floors/{id}/availability
 *  GET /rooms
 *  GET /rooms/{id}
 *  GET /rooms/{id}/availability
 */
class CampusController extends Controller
{
    use BuildsRoomAvailability;
    use RespondsJson;

    // ── Buildings ───────────────────────────────────────────────────────────

    public function buildings(): JsonResponse
    {
        $buildings = Building::where('status', '!=', 'closed')
            ->orderBy('name')
            ->get()
            ->map(fn ($b) => $b->toApiArray());

        return $this->ok(['buildings' => $buildings]);
    }

    public function building(string $id): JsonResponse
    {
        $building = Building::where('id', $id)
            ->orWhere('code', strtoupper($id))
            ->firstOrFail();

        $floors = $building->floors()
            ->where('status', '!=', 'closed')
            ->orderBy('level')
            ->get()
            ->map(fn ($f) => $f->toApiArray());

        $rooms = Room::whereHas('floor', fn ($q) => $q->where('building_id', $building->id))
            ->with(['floor.building', 'queue'])
            ->orderBy('code')
            ->get()
            ->map(fn ($r) => $r->toApiArray(true));

        return $this->ok([
            'building' => $building->toApiArray(),
            'floors'   => $floors,
            'rooms'    => $rooms,
        ]);
    }

    public function floors(string $buildingId): JsonResponse
    {
        $building = Building::findOrFail($buildingId);
        $floors   = $building->floors()->orderBy('level')->get()->map(fn ($f) => $f->toApiArray());
        return $this->ok(['floors' => $floors]);
    }

    /**
     * GET /campus/floors/{floor}
     *
     * Floor metadata on its own — the map client needs the plan geometry before it can place a room,
     * and re-fetching the whole building for that is wasteful on a phone connection.
     */
    public function floor(string $id): JsonResponse
    {
        $floor = Floor::with('building')->findOrFail($id);

        return $this->ok([
            'floor' => $floor->toApiArray(),
            'building' => $floor->building?->toApiArray(),
            'rooms' => Room::where('floor_id', $floor->id)->orderBy('code')
                ->get()
                ->map(fn ($r) => $r->toApiArray(true)),
        ]);
    }

    public function floorPlan(string $floorId, Request $request): JsonResponse
    {
        $floor = Floor::with(['building', 'rooms.queue'])->findOrFail($floorId);
        $date  = $request->query('date', now()->toDateString());

        $rooms = $floor->rooms->map(fn ($r) => $r->toApiArray(true));

        return $this->ok([
            'floor'       => $floor->toApiArray(),
            'building'    => $floor->building->toApiArray(),
            'rooms'       => $rooms,
            'date'        => $date,
            'free_now'    => $rooms->where('status', 'available')->pluck('id')->values(),
        ]);
    }

    public function floorAvailability(string $floorId, Request $request): JsonResponse
    {
        $floor = Floor::findOrFail($floorId);
        $date  = $request->query('date', now()->toDateString());

        $rooms = Room::where('floor_id', $floorId)->with('queue')->get();
        $today = $date;

        // A floor "free room" list built from `status` alone is a lie by lunchtime: a room in a lecture
        // still says `available` in the estate table. Each room is asked instead whether the schedule is
        // clear right now, which is the same question the room page answers for a single room.
        $busy = [];
        $freeNow = [];

        foreach ($rooms as $room) {
            $availability = $this->availabilityFor($room, [$today], false)[$today] ?? null;

            if ($availability && $availability['is_free_now']) {
                $freeNow[] = $room->id;

                continue;
            }

            $busy[$room->id] = $availability['reason']
                ?? ($availability['busy_until'] ? 'in use until ' . $availability['busy_until'] : 'in use today');
        }

        $freeNow = collect($freeNow);

        return $this->ok([
            'date'     => $date,
            'busy'     => $busy,
            'free_now' => $freeNow,
        ]);
    }

    // ── Rooms ────────────────────────────────────────────────────────────────

    public function rooms(Request $request): JsonResponse
    {
        $query = Room::with(['floor.building', 'queue']);

        if ($q = $request->query('q')) {
            $query->where(fn ($sq) => $sq
                ->where('name', 'ilike', "%{$q}%")
                ->orWhere('code', 'ilike', "%{$q}%")
            );
        }
        if ($type = $request->query('type')) {
            $query->where('type', $type);
        }
        if ($request->boolean('admission_required')) {
            $query->where('requires_admission', true);
        }

        $perPage = min((int)($request->query('per_page', 20)), 100);
        $paged   = $query->orderBy('code')->paginate($perPage);

        return $this->ok([
            'items' => collect($paged->items())->map(fn ($r) => $r->toApiArray(true)),
            'meta'  => [
                'total'        => $paged->total(),
                'per_page'     => $paged->perPage(),
                'current_page' => $paged->currentPage(),
                'last_page'    => $paged->lastPage(),
            ],
        ]);
    }

    /**
     * GET /campus/rooms/{room} — one room, with the week ahead.
     *
     * Availability is derived from the timetable rather than a cached flag, so the free/busy strip a student
     * reads and the class their timetable names are the same fact from the same table.
     */
    public function room(string $id): JsonResponse
    {
        $room = Room::with(['floor.building', 'queue'])
            ->where(function ($query) use ($id) {
                $query->where('code', strtoupper($id));
                if (Str::isUuid($id)) $query->orWhere('id', $id);
            })
            ->firstOrFail();

        $dates = [];

        for ($i = 0; $i < 7; $i++) {
            $dates[] = now()->addDays($i)->toDateString();
        }

        return $this->ok([
            'room'         => $room->toApiArray(true),
            'availability' => $this->availabilitySummary($room),
            'days'         => $this->availabilityFor($room, $dates),
            'week'         => $this->weekSessions($room),
        ]);
    }

    /**
     * GET /campus/rooms/{room}/availability?date=&days=
     *
     * `days` lets one call answer the week view on the web room page instead of seven; the answer is
     * computed the same way either way, which is the only reason the two cannot disagree.
     */
    /**
     * GET /campus/rooms/{room}/availability?date=&days=
     *
     * One day by default, up to fourteen on request, so the week view on the web room page is one call
     * rather than seven. The answer is computed by the same code the room page uses, which is the only
     * reason the two screens cannot disagree about whether a walk is worth making.
     */
    public function roomAvailability(string $id, Request $request): JsonResponse
    {
        $room = Room::with(['floor.building', 'queue'])
            ->where(function ($query) use ($id) {
                $query->where('code', strtoupper($id));
                if (Str::isUuid($id)) $query->orWhere('id', $id);
            })
            ->firstOrFail();

        $start = $request->query('date')
            ? \Illuminate\Support\Carbon::parse((string) $request->query('date'))
            : now();

        $days = max(1, min(14, (int) $request->query('days', 1)));

        $dates = [];

        for ($i = 0; $i < $days; $i++) {
            $dates[] = $start->copy()->addDays($i)->toDateString();
        }

        return $this->ok([
            'date'         => $dates[0],
            'room_id'      => $room->id,
            'room_code'    => $room->code,
            'availability' => $this->availabilitySummary($room, $dates[0]),
            'days'         => $this->availabilityFor($room, $dates, $request->user()?->can('campus.view.private')),
            'queue'        => $room->queue?->toApiArray(),
        ]);
    }
}
