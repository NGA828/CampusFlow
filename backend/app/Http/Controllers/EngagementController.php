<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
use App\Models\CampusEvent;
use App\Models\EventRegistration;
use App\Models\UserNotification;
use App\Http\Controllers\Concerns\RespondsJson;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EngagementController extends Controller
{
    use Concerns\RespondsJson;

    /**
     * GET /campus/events — the resident calendar.
     *
     * Shaped as `{ items, meta }` because a browser paginating a list and a phone showing "what is on
     * tonight" must read one envelope; a bare array here would be a second contract for one endpoint, and
     * the two clients would drift the first time either of them needed a page. `is_registered` is computed,
     * never stored — it is a fact about the caller and this event, right now.
     */
    public function events(Request $request): JsonResponse
    {
        $query = CampusEvent::with(['room.floor.building'])
            ->where('status', 'published')
            ->orderBy('starts_at');

        $page = $query->paginate(min(100, max(1, (int) $request->input('per_page', 25))));
        $user = $request->user();

        $items = collect($page->items())->map(function (CampusEvent $event) use ($user) {
            $array = $event->toApiArray();

            if ($user) {
                $array['is_registered'] = EventRegistration::where('event_id', $event->id)
                    ->where('user_id', $user->id)
                    ->exists();
            }

            return $array;
        })->values();

        return $this->ok([
            'items'    => $items,
            'upcoming' => $items->take(3)->values(),
            'meta'     => [
                'page'        => $page->currentPage(),
                'per_page'    => $page->perPage(),
                'total'       => $page->total(),
                'total_pages' => $page->lastPage(),
            ],
        ]);
    }

    /**
     * GET /campus/events/{event} — one event, with who is going.
     *
     * An unpublished event is refused by id as well as hidden from the list: a detail route that ignored
     * `status` would be a way to read around the list, and "is this still on" is the one question a student
     * standing in the rain needs answered correctly.
     */
    public function showEvent(Request $request, CampusEvent $event): JsonResponse
    {
        abort_unless($event->status === 'published', 404, 'This event is not listed.');

        $event->loadMissing('room.floor.building');
        $user = $request->user();

        $payload = $event->toApiArray();
        $payload['is_registered'] = $user
            ? EventRegistration::where('event_id', $event->id)->where('user_id', $user->id)->exists()
            : false;
        $payload['attendee_count'] = EventRegistration::where('event_id', $event->id)->count();

        return $this->ok(['event' => $payload]);
    }

    /**
     * Register for event.
     */
    public function registerEvent(Request $request, CampusEvent $event): JsonResponse
    {
        $user = $request->user();

        $reg = EventRegistration::firstOrCreate([
            'event_id' => $event->id,
            'user_id'  => $user->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Successfully registered for event',
            'data'    => $reg,
        ], 201);
    }

    /**
     * Cancel event registration.
     */
    public function cancelEventRegistration(Request $request, CampusEvent $event): JsonResponse
    {
        $user = $request->user();

        EventRegistration::where('event_id', $event->id)
            ->where('user_id', $user->id)
            ->delete();

        return response()->json([
            'success' => true,
            'message' => 'Event registration cancelled',
        ]);
    }

    /**
     * List announcements.
     */
    /**
     * GET /campus/announcements — notices addressed to a role, a department or everyone.
     *
     * Targeting is resolved by the visibility scope on the model, not by a filter in a screen, so the phone
     * and the browser cannot disagree about which notices a given person should have seen.
     */
    public function announcements(Request $request): JsonResponse
    {
        $query = Announcement::query()->visibleTo($request->user())->orderByDesc('published_at');

        $page = $query->paginate(min(100, max(1, (int) $request->input('per_page', 25))));

        return $this->ok([
            'items' => collect($page->items())->map(fn (Announcement $announcement) => $announcement->toApiArray())->values(),
            'meta'  => [
                'page'        => $page->currentPage(),
                'per_page'    => $page->perPage(),
                'total'       => $page->total(),
                'total_pages' => $page->lastPage(),
            ],
        ]);
    }

    /**
     * GET /campus/announcements/{announcement} — the full body of one notice.
     *
     * An expiry is reported as 410 rather than 404: the notice existed, and "it was withdrawn" is a
     * different and more useful answer than "there is no such notice" when a student is quoting one back.
     */
    public function showAnnouncement(Request $request, Announcement $announcement): JsonResponse
    {
        abort_if($announcement->published_at === null, 404, 'This announcement is not published.');
        abort_if($announcement->expires_at !== null && $announcement->expires_at->isPast(), 410, 'This announcement has expired.');

        $payload = $announcement->toApiArray();
        $payload['author'] = $announcement->loadMissing('creator')->creator?->name;

        return $this->ok(['announcement' => $payload]);
    }

    /**
     * List notifications for current user.
     */
    public function notifications(Request $request): JsonResponse
    {
        $notifications = UserNotification::where('user_id', $request->user()->id)
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get();

        return response()->json([
            'success' => true,
            'data'    => $notifications,
        ]);
    }

    /**
     * Mark notification as read.
     */
    public function markNotificationRead(Request $request, string $id): JsonResponse
    {
        $notification = UserNotification::where('user_id', $request->user()->id)
            ->where('id', $id)
            ->firstOrFail();

        $notification->update(['read_at' => now()]);

        return response()->json([
            'success' => true,
            'message' => 'Notification marked as read',
            'data'    => $notification,
        ]);
    }

    /**
     * Mark all notifications read.
     */
    public function markAllNotificationsRead(Request $request): JsonResponse
    {
        UserNotification::where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json([
            'success' => true,
            'message' => 'All notifications marked as read',
        ]);
    }
}
