<?php

namespace App\Http\Controllers;

use App\Models\UserNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeController extends Controller
{
    /*
     * The `/me` surface is deliberately small.
     *
     * It used to carry a `dashboard()`, `timetable()`, `nextClass()` and ticket summary that re-read the
     * caller's role and bent their payload around it — one endpoint serving three products, which is what
     * made "every role gets the same app" possible at all. Those responsibilities now live in the role
     * workspaces that own them:
     *
     *   GET /student/dashboard      StudentDashboardController   academic + campus activity
     *   GET /student/timetable      StudentTimetableController   the enrolled week, today, next class
     *   GET /student/queue-tickets  StudentTicketController      a student's own tickets
     *   GET /staff/dashboard        StaffController::dashboard   the lines this operator runs
     *   GET /admin/dashboard        AdminController::dashboard   platform and infrastructure state
     *
     * What is left below is genuinely the same for every role: this person's notification reads and the
     * push devices registered to their account.
     */
    public function notifications(Request $request): JsonResponse
    {
        $perPage = min((int) ($request->query('per_page', 20)), 100);
        $type    = $request->query('type');

        $q = UserNotification::where('user_id', $request->user()->id);

        if ($type) {
            $q->where('type', $type);
        }

        $paginated = $q->orderBy('created_at', 'desc')->paginate($perPage);
        $unread    = UserNotification::where('user_id', $request->user()->id)
            ->whereNull('read_at')->count();

        return response()->json([
            'success' => true,
            'data'    => [
                'items' => collect($paginated->items())->map(fn($n) => $n->toApiArray()),
                'meta'  => [
                    'current_page' => $paginated->currentPage(),
                    'last_page'    => $paginated->lastPage(),
                    'total'        => $paginated->total(),
                    'per_page'     => $paginated->perPage(),
                ],
                'unread' => $unread,
            ],
        ]);
    }

    /**
     * Mark a single notification as read.
     */
    public function readNotification(Request $request, string $id): JsonResponse
    {
        $notif = UserNotification::where('user_id', $request->user()->id)
            ->where('id', $id)
            ->firstOrFail();

        if (!$notif->read_at) {
            $notif->update(['read_at' => now()]);
        }

        $unread = UserNotification::where('user_id', $request->user()->id)
            ->whereNull('read_at')->count();

        return response()->json([
            'success' => true,
            'data'    => ['unread' => $unread],
        ]);
    }

    /**
     * Mark all notifications as read.
     */
    public function readAllNotifications(Request $request): JsonResponse
    {
        UserNotification::where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json([
            'success' => true,
            'data'    => ['unread' => 0],
        ]);
    }

    /**
     * Register a push-notification device token (stub — extend when push provider added).
     */
    public function registerDevice(Request $request): JsonResponse
    {
        $request->validate([
            'token'    => 'required|string',
            'platform' => 'required|in:ios,android,web',
        ]);

        // Stub: persist to a device_tokens table when push provider is integrated.
        return response()->json([
            'success' => true,
            'data'    => ['registered' => true],
        ]);
    }

}
