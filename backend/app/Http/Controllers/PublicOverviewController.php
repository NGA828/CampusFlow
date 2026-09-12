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

/**
 * GET /api/v1/public/overview — the landing page's live campus snapshot.
 *
 * Everything here is counted from the public projections (the same visibility rules
 * {@see PublicCampusController} applies), because the landing page used to print hard-coded
 * numbers: a marketing figure that never changed was indistinguishable from a real metric.
 */
class PublicOverviewController extends Controller
{
    use RespondsJson;

    public function __invoke(): JsonResponse
    {
        $publicBuildingIds = Building::query()->where('is_public', true)->where('status', '!=', 'closed')->pluck('id');
        $publicFloorIds    = Floor::query()->whereIn('building_id', $publicBuildingIds)->pluck('id');
        $publicRooms       = Room::query()->whereIn('floor_id', $publicFloorIds)->where('is_public', true);

        $roomCount = (clone $publicRooms)->count();
        $seatCount = (int) (clone $publicRooms)->where('status', '!=', 'closed')->sum('capacity');

        $buildings = Building::query()
            ->where('is_public', true)
            ->where('status', '!=', 'closed')
            ->orderBy('name')
            ->limit(12)
            ->get()
            ->map(fn (Building $b) => [
                'id'        => $b->id,
                'code'      => $b->code,
                'name'      => $b->name,
                'short_name'=> $b->short_name,
                'lat'       => $b->lat,
                'lng'       => $b->lng,
                'footprint' => $b->footprint,
                'status'    => $b->status,
                'floors'    => Floor::where('building_id', $b->id)->count(),
            ]);

        $announcements = Announcement::query()
            ->whereNotNull('published_at')
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>=', now()))
            ->latest('published_at')
            ->limit(3)
            ->get()
            ->map(fn (Announcement $a) => [
                'id'           => $a->id,
                'title'        => $a->title,
                'body'         => $a->body,
                'priority'     => $a->priority,
                'published_at' => $a->published_at?->toIso8601String(),
            ]);

        $events = CampusEvent::query()
            ->where('status', 'published')
            ->where('starts_at', '>=', now())
            ->orderBy('starts_at')
            ->limit(4)
            ->get()
            ->map(fn (CampusEvent $e) => [
                'id'        => $e->id,
                'title'     => $e->title,
                'starts_at' => $e->starts_at?->toIso8601String(),
                'venue'     => $e->venue,
                'category'  => $e->category,
            ]);

        return $this->ok([
            'stats' => [
                'buildings'     => $publicBuildingIds->count(),
                'floors'        => $publicFloorIds->count(),
                'rooms'         => $roomCount,
                'seats'         => $seatCount,
                'offices'       => Office::where('status', 'active')->count(),
                'events'        => CampusEvent::where('status', 'published')->where('starts_at', '>=', now())->count(),
                'open_offices'  => Office::where('status', 'active')->where('is_open', true)->count(),
            ],
            'buildings'     => $buildings->values(),
            'announcements' => $announcements->values(),
            'events'        => $events->values(),
            'generated_at'  => now()->toIso8601String(),
        ]);
    }
}
