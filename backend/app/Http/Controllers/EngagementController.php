<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
use App\Models\CampusEvent;
use App\Models\EventRegistration;
use App\Models\UserNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EngagementController extends Controller
{
    /**
     * List campus events.
     */
    public function events(Request $request): JsonResponse
    {
        $events = CampusEvent::with(['room.floor.building'])
            ->where('status', 'published')
            ->orderBy('starts_at', 'asc')
            ->get();

        $user = $request->user();

        $data = $events->map(function ($event) use ($user) {
            $array = $event->toArray();
            if ($user) {
                $array['is_registered'] = EventRegistration::where('event_id', $event->id)
                    ->where('user_id', $user->id)
                    ->exists();
            }
            return $array;
        });

        return response()->json([
            'success' => true,
            'data'    => $data,
        ]);
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
    public function announcements(): JsonResponse
    {
        $announcements = Announcement::whereNotNull('published_at')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data'    => $announcements,
        ]);
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
