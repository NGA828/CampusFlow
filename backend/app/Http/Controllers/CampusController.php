<?php

namespace App\Http\Controllers;

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
        $busy  = $rooms->where('status', '!=', 'available')
            ->mapWithKeys(fn ($r) => [$r->id => $r->status]);
        $freeNow = $rooms->where('status', 'available')->pluck('id');

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

    public function room(string $id): JsonResponse
    {
        $room = Room::with(['floor.building', 'queue'])
            ->where(function ($query) use ($id) {
                $query->where('code', strtoupper($id));
                if (Str::isUuid($id)) $query->orWhere('id', $id);
            })
            ->firstOrFail();

        $availability = [];
        for ($i = 0; $i < 7; $i++) {
            $day = now()->addDays($i)->toDateString();
            $availability[$day] = ['status' => $room->status]; // Phase C: real timetable lookup
        }

        return $this->ok(array_merge($room->toApiArray(true), [
            'availability' => $availability,
        ]));
    }

    public function roomAvailability(string $id, Request $request): JsonResponse
    {
        $room = Room::with('queue')->findOrFail($id);
        $date = $request->query('date', now()->toDateString());

        return $this->ok([
            'availability' => [
                $date => [
                    'status'       => $room->status,
                    'queue_open'   => $room->queue?->is_open ?? false,
                    'queue_count'  => $room->queue?->current_count ?? 0,
                ],
            ],
        ]);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function ok(array $data, int $status = 200): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $data], $status);
    }
}
