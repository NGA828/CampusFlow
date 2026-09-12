<?php

use App\Http\Controllers\AcademicController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\AiAssistantController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\CampusController;
use App\Http\Controllers\EngagementController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\MeController;
use App\Http\Controllers\NavigationController;
use App\Http\Controllers\OfficeController;
use App\Http\Controllers\PositioningController;
use App\Http\Controllers\PublicCampusController;
use App\Http\Controllers\PublicOverviewController;
use App\Http\Controllers\QueueController;
use App\Http\Controllers\StaffController;
use App\Http\Controllers\Student\StudentDashboardController;
use App\Http\Controllers\Student\StudentTicketController;
use App\Http\Controllers\Student\StudentTimetableController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| CampusFlow API routes — organised by role domain, not by screen
|--------------------------------------------------------------------------
| Prefix: /api/v1 (bootstrap/app.php). Every request also carries a platform context
| (ResolveClientContext) which may only ever *narrow* what a role may do.
|
| The shape of this file is a product rule, not a style preference:
|
|   /public/*   guests only. Projections. Never the internal payload.
|   /me/*       self-scoped: identity, profile, devices, my notification reads.
|   /campus/*   resident reads: campus, rooms, boards, events, route preview.
|   /student/*  the student workspace: dashboard, timetable, tickets, positioning, live navigation.
|   /staff/*    the operations console: lines, call-next, service lifecycle, content, timetable.
|   /admin/*    governance: infrastructure, spatial, services, users, analytics, audit.
|   /ai/*       one assistant gateway; its tool set is filtered by role + platform + permissions.
|
| There is no endpoint that decides "what this person can do" by looking at a flag in the payload,
| and no endpoint that serves every role the same view. A role that must not reach an action does not
| have a route to it — 404 or 403 — rather than a hidden button.
|
| Authorization layers, in the order they run:
|   auth:sanctum   who you are (token)
|   role:*         which workspace this route belongs to          (EnsureRole)
|   permission:*   whether that role may exercise this capability (EnsurePermission)
|   policy:*       whether this specific resource is yours / in scope (App\Policies)
|   controller     business rules: capacity, geofence, state machine, idempotency
*/

// ─────────────────────────────────────────────────────────── meta & guests
Route::get('/health', HealthController::class);

Route::prefix('public')->group(function () {
    Route::get('/overview', PublicOverviewController::class);

    Route::get('/buildings', [PublicCampusController::class, 'buildings']);
    Route::get('/buildings/{code}', [PublicCampusController::class, 'building']);
    Route::get('/floors/{floorId}/plan', [PublicCampusController::class, 'floorPlan']);
    Route::get('/rooms', [PublicCampusController::class, 'rooms']);
    Route::get('/rooms/{code}', [PublicCampusController::class, 'room']);
    Route::get('/offices', [PublicCampusController::class, 'offices']);
    Route::get('/events', [PublicCampusController::class, 'events']);
    Route::get('/announcements', [PublicCampusController::class, 'announcements']);
});

// ────────────────────────────────────────────────────────────────── auth
Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);

    // Only the credential acts live here. Who I am (`GET /me`) and what I may do are the signed-in
    // surface, not a second name for the same reads — the two `/auth/me` and `/me` pair used to answer a
    // profile request differently depending on which client asked, which is the drift this removes.
    Route::middleware('auth:sanctum')->group(function () {
        Route::put('/password', [AuthController::class, 'changePassword']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });
});

// ─────────────────────────────────── self-scoped (any resident role) — `/me`
//
// Deliberately thin: profile, devices and this user's own notification reads. It holds no
// dashboard, no timetable and no ticket list — those are role workspaces, and one `/me/dashboard`
// serving every role is the generic dashboard this platform is required not to have.
Route::middleware(['auth:sanctum', 'role:student,staff,admin'])->prefix('me')->group(function () {
    Route::get('/', [AuthController::class, 'me']);
    Route::patch('/', [AuthController::class, 'updateProfile']);

    Route::get('/notifications', [MeController::class, 'notifications']);
    Route::post('/notifications/{id}/read', [MeController::class, 'readNotification']);
    Route::post('/notifications/read-all', [MeController::class, 'readAllNotifications']);

    Route::post('/devices', [MeController::class, 'registerDevice']);
});

// ─────────────────────────────────────────── resident reads — `/campus`
//
// Buildings, floors, rooms, boards and route preview for anyone with a CampusFlow account.
// Visitors get /public/* instead, which is a narrower projection of the same tables.
Route::middleware(['auth:sanctum', 'role:student,staff,admin'])->prefix('campus')->group(function () {
    Route::get('/buildings', [CampusController::class, 'buildings']);
    Route::get('/buildings/{id}', [CampusController::class, 'building']);
    Route::get('/buildings/{buildingId}/floors', [CampusController::class, 'floors']);
    Route::get('/floors/{id}', [CampusController::class, 'floor']);
    Route::get('/floors/{floorId}/plan', [CampusController::class, 'floorPlan']);
    Route::get('/floors/{floorId}/availability', [CampusController::class, 'floorAvailability']);
    Route::get('/rooms', [CampusController::class, 'rooms']);
    Route::get('/rooms/{id}', [CampusController::class, 'room']);
    Route::get('/rooms/{id}/availability', [CampusController::class, 'roomAvailability']);
    Route::get('/rooms/{room}/queue', [QueueController::class, 'show']);
    Route::get('/queues', [QueueController::class, 'index']);
    Route::get('/queues/{id}', [QueueController::class, 'showById']);
    Route::get('/offices', [OfficeController::class, 'index']);
    Route::get('/events', [EngagementController::class, 'events']);
    Route::get('/events/{event}', [EngagementController::class, 'showEvent']);
    Route::get('/announcements', [EngagementController::class, 'announcements']);
    Route::get('/announcements/{announcement}', [EngagementController::class, 'showAnnouncement']);
    Route::get('/academic/courses', [AcademicController::class, 'courses']);
    Route::get('/academic/terms', [AcademicController::class, 'terms']);

    // Route computation is shared: a student planning a walk, a staff member pointing a visitor at
    // a room, an admin checking a link. Live *tracking* is not here — it is student/mobile only.
    Route::middleware('permission:navigation.preview')->post('/navigation/route', [NavigationController::class, 'route']);
    Route::middleware('permission:spatial.view')->group(function () {
        Route::get('/navigation/nodes', [NavigationController::class, 'nodes']);
        Route::get('/navigation/edges', [NavigationController::class, 'edges']);
        Route::get('/navigation/nodes/{id}', [NavigationController::class, 'node']);
    });
    Route::get('/positioning/anchors', [PositioningController::class, 'anchors']);
});

// ──────────────────────────────────────────────────────────── student
//
// `role:student`: staff and administrators receive 403 here even though the admin role outranks
// them everywhere else. Taking a ticket and running a line are different jobs.
Route::middleware(['auth:sanctum', 'role:student'])->prefix('student')->group(function () {
    Route::get('/dashboard', StudentDashboardController::class);

    Route::get('/timetable', [StudentTimetableController::class, 'index']);
    Route::get('/timetable/today', [StudentTimetableController::class, 'today']);
    Route::get('/next-class', [StudentTimetableController::class, 'nextClass']);
    Route::get('/enrolments', [StudentTimetableController::class, 'enrolments']);

    // Room queues ----------------------------------------------------------
    Route::middleware('permission:queue.join')->group(function () {
        Route::post('/rooms/{room}/queue/join', [QueueController::class, 'join']);
        Route::post('/queues/{queue}/tickets', [QueueController::class, 'joinByQueueId']);
    });
    Route::get('/queue-tickets', [QueueController::class, 'myTickets']);
    Route::get('/queue-tickets/active', [StudentTicketController::class, 'active']);
    Route::get('/queue-tickets/{id}', [QueueController::class, 'ticketDetails']);
    Route::get('/queue-tickets/{id}/history', [QueueController::class, 'history']);
    Route::post('/queue-tickets/{id}/cancel', [QueueController::class, 'cancelTicket']);
    Route::post('/queue-tickets/{id}/leave', [QueueController::class, 'leaveTicket']);
    Route::post('/queues/{id}/proximity-check', [QueueController::class, 'proximityCheck']);
    // Check-in asserts physical presence: the policy refuses it from a web client.
    Route::post('/queue-tickets/{id}/check-in', [QueueController::class, 'checkInTicket']);
    Route::post('/queue-tickets/{id}/navigating', [QueueController::class, 'setNavigating']);
    Route::get('/queues/board', [StudentTicketController::class, 'queueBoard']);

    // Administrative offices ----------------------------------------------
    Route::get('/offices', [StudentTicketController::class, 'offices']);
    Route::get('/offices/{office}', [OfficeController::class, 'show']);
    Route::middleware('permission:office.ticket.request')->post('/offices/{office}/tickets', [OfficeController::class, 'createTicket']);
    Route::get('/office-tickets', [StudentTicketController::class, 'officeHistory']);
    Route::get('/office-tickets/active', [StudentTicketController::class, 'activeOffice']);
    Route::get('/office-tickets/{id}', [OfficeController::class, 'showTicket']);
    Route::get('/office-tickets/{id}/history', [OfficeController::class, 'ticketHistory']);
    Route::post('/office-tickets/{ticketId}/cancel', [OfficeController::class, 'cancelTicket']);
    Route::post('/office-tickets/{id}/check-in', [OfficeController::class, 'checkInTicket']);
    Route::post('/office-tickets/{id}/approaching', [OfficeController::class, 'approachingTicket']);

    // Events ----------------------------------------------------------------
    Route::post('/events/{event}/register', [EngagementController::class, 'registerEvent']);
    Route::delete('/events/{event}/register', [EngagementController::class, 'cancelEventRegistration']);

    // Positioning, indoor navigation and QR: the mobile companion's reason to exist.
    // `permission:` here is what makes "the scanner is not a web feature" a server-side fact.
    Route::middleware('permission:qr.scan')->post('/positioning/scan', [PositioningController::class, 'scan']);
    Route::get('/positioning/current', [PositioningController::class, 'current']);
    Route::middleware('permission:positioning.update.own')->post('/positioning/position', [PositioningController::class, 'update']);

    Route::middleware('permission:navigation.live')->prefix('navigation')->group(function () {
        Route::post('/sessions', [NavigationController::class, 'startSession']);
        Route::get('/sessions', [NavigationController::class, 'history']);
        Route::get('/sessions/active', [NavigationController::class, 'activeSession']);
        Route::patch('/sessions/{sessionId}', [NavigationController::class, 'updateSession']);
        Route::post('/sessions/{sessionId}/position', [NavigationController::class, 'updatePosition']);
        Route::post('/sessions/{sessionId}/complete', [NavigationController::class, 'complete']);
        Route::post('/sessions/{sessionId}/abandon', [NavigationController::class, 'abandon']);
    });
});

// ──────────────────────────────────────────────────────────────── staff
//
// Operations. Available to staff, and to admins as an explicit operational override (see the
// permission registry) — never to students, and never as a place to configure the platform.
Route::middleware(['auth:sanctum', 'role:staff,admin'])->prefix('staff')->group(function () {
    Route::get('/dashboard', [StaffController::class, 'dashboard']);

    // Room queues. The operations are `queue.operate.assigned` — granted on both platforms — because
    // calling the next ticket is counter work whether the operator is at a desk or in a corridor; the
    // *scope* (which lines this person may touch at all) is resolved by StaffScope in the controller and
    // in the policy, not by the route.
    Route::middleware('permission:queue.operate.assigned')->group(function () {
        Route::get('/queues', [StaffController::class, 'queues']);
        Route::get('/queues/{id}', [StaffController::class, 'queueShow']);
        Route::get('/queues/{id}/line', [StaffController::class, 'queueLine']);
        Route::post('/queues/{id}/call-next', [StaffController::class, 'callNext']);
        Route::post('/queues/{id}/open', [StaffController::class, 'setQueueOpen']);
        Route::post('/queue-tickets/{ticketId}/call', [StaffController::class, 'callTicket']);
        Route::post('/queue-tickets/{ticketId}/check-in', [StaffController::class, 'staffCheckIn']);
        Route::post('/queue-tickets/{ticketId}/admit', [StaffController::class, 'admitTicket']);
        Route::post('/queue-tickets/{ticketId}/complete', [StaffController::class, 'completeQueueTicket']);
        Route::post('/queue-tickets/{ticketId}/no-show', [StaffController::class, 'noShowQueueTicket']);
    });

    Route::middleware('permission:office.operate.assigned')->group(function () {
        Route::get('/offices', [StaffController::class, 'offices']);
        Route::get('/offices/{id}/line', [StaffController::class, 'officeLine']);
        Route::post('/offices/{id}/call-next', [StaffController::class, 'officeCallNext']);
        Route::post('/office-tickets/{ticketId}/call', [StaffController::class, 'officeCallTicket']);
        Route::post('/office-tickets/{ticketId}/check-in', [StaffController::class, 'officeCheckIn']);
        Route::post('/office-tickets/{ticketId}/start-service', [StaffController::class, 'officeStartService']);
        Route::post('/office-tickets/{ticketId}/complete', [StaffController::class, 'officeComplete']);
        Route::post('/office-tickets/{ticketId}/no-show', [StaffController::class, 'officeNoShow']);
        // Verification, not browsing: identity plus what is outstanding at this desk.
        Route::get('/students/{registrationNo}', [StaffController::class, 'studentLookup']);
    });

    // Academics & content (web console; the mobile companion has none of this)
    Route::middleware('permission:timetable.manage.assigned')->group(function () {
        Route::get('/timetable', [StaffController::class, 'timetable']);
        Route::post('/timetable', [StaffController::class, 'createEntry']);
        Route::patch('/timetable/{id}', [StaffController::class, 'updateEntry']);
        Route::delete('/timetable/{id}', [StaffController::class, 'deleteEntry']);
    });

    Route::middleware('permission:content.manage.own_scope')->group(function () {
        Route::post('/events', [StaffController::class, 'createEvent']);
        Route::patch('/events/{id}', [StaffController::class, 'updateEvent']);
        Route::delete('/events/{id}', [StaffController::class, 'deleteEvent']);
        Route::get('/announcements', [StaffController::class, 'announcements']);
        Route::post('/announcements', [StaffController::class, 'createAnnouncement']);
        Route::delete('/announcements/{id}', [StaffController::class, 'deleteAnnouncement']);
    });

    Route::middleware('permission:analytics.operational')->get('/analytics', [StaffController::class, 'analytics']);

    // The staff campus surface is a *status correction* on a room they are attached to — the web console's
    // `rooms.update.own_scope`. Capacity, admission rules, visibility and geometry belong to
    // `rooms.manage`, which staff do not hold, and the spatial graph is not reachable from here at all.
    Route::get('/rooms', [CampusController::class, 'rooms'])->middleware('permission:campus.view.private');
    Route::patch('/rooms/{room}', [StaffController::class, 'updateRoom'])->middleware('permission:rooms.update.own_scope');
});

// ──────────────────────────────────────────────────────────────── admin
//
// Governance. The group is `role:admin`, and *inside* it every section carries the capability that section
// is about — which is what makes the platform rule real rather than decorative: each console permission is
// registered for the web platform alone, so an administrator arriving from a phone is refused by
// `EnsurePermission` with PLATFORM_NOT_SUPPORTED, while the two monitoring reads below (granted to
// `analytics.operational`, allowed on both) keep working. The mobile app therefore has no admin forms
// because there is nothing for it to call, not because a stylesheet hides them.
Route::middleware(['auth:sanctum', 'role:admin'])->prefix('admin')->group(function () {
    // Monitoring: the whole of administration on a phone. Alerts are derived from live state, the summary
    // is the four numbers an administrator checks from a corridor, and the acknowledge write is the one
    // action a phone may take — it records that a condition was seen, it changes nothing about the campus.
    Route::middleware('permission:analytics.operational')->group(function () {
        Route::get('/alerts', [AdminController::class, 'alerts']);
        // The fingerprint is the payload, not a path id: an alert key can contain slashes and colons, and
        // muting a condition is an action on a fingerprint rather than on a stored row.
        Route::post('/alerts/ack', [AdminController::class, 'acknowledgeAlert']);
        Route::get('/monitoring/summary', [AdminController::class, 'monitoringSummary']);
    });

    Route::middleware('permission:analytics.system')->group(function () {
        Route::get('/dashboard', [AdminController::class, 'dashboard']);
        Route::get('/analytics', [AdminController::class, 'analytics']);
    });

    Route::middleware('permission:audit.view')->group(function () {
        Route::get('/audit-logs', [AdminController::class, 'auditLogs']);
    });

    Route::middleware('permission:spatial.view')->group(function () {
        Route::get('/map', [AdminController::class, 'map']);
        Route::get('/geofences', [AdminController::class, 'geofences']);
        Route::get('/qr-nodes', [AdminController::class, 'qrNodes']);
        Route::get('/qr-nodes/{id}/payload', [AdminController::class, 'qrPayload']);
        Route::get('/navigation-nodes', [AdminController::class, 'navigationNodes']);
        Route::get('/navigation-edges', [AdminController::class, 'navigationEdges']);
    });

    Route::middleware('permission:spatial.manage')->group(function () {
        Route::post('/geofences', [AdminController::class, 'createGeofence']);
        Route::patch('/geofences/{id}', [AdminController::class, 'updateGeofence']);
        Route::delete('/geofences/{id}', [AdminController::class, 'deleteGeofence']);
        Route::post('/qr-nodes', [AdminController::class, 'createQrNode']);
        Route::patch('/qr-nodes/{id}', [AdminController::class, 'updateQrNode']);
        Route::delete('/qr-nodes/{id}', [AdminController::class, 'deleteQrNode']);
        Route::post('/qr-nodes/{id}/regenerate', [AdminController::class, 'regenerateQr']);
        Route::post('/navigation-nodes', [AdminController::class, 'createNavigationNode']);
        Route::patch('/navigation-nodes/{id}', [AdminController::class, 'updateNavigationNode']);
        Route::delete('/navigation-nodes/{id}', [AdminController::class, 'deleteNavigationNode']);
        Route::post('/navigation-edges', [AdminController::class, 'createNavigationEdge']);
        Route::patch('/navigation-edges/{id}', [AdminController::class, 'updateNavigationEdge']);
        Route::delete('/navigation-edges/{id}', [AdminController::class, 'deleteNavigationEdge']);
    });

    // The estate: buildings, floors and rooms. Reads and writes share `rooms.manage` because the read is
    // the management table itself — a list of rooms with edit affordances is not a public view.
    Route::middleware('permission:rooms.manage')->group(function () {
        Route::get('/buildings', [AdminController::class, 'buildings']);
        Route::post('/buildings', [AdminController::class, 'createBuilding']);
        Route::patch('/buildings/{id}', [AdminController::class, 'updateBuilding']);
        Route::delete('/buildings/{id}', [AdminController::class, 'deleteBuilding']);
        Route::get('/floors', [AdminController::class, 'floors']);
        Route::post('/floors', [AdminController::class, 'createFloor']);
        Route::patch('/floors/{id}', [AdminController::class, 'updateFloor']);
        Route::delete('/floors/{id}', [AdminController::class, 'deleteFloor']);
        Route::get('/rooms', [AdminController::class, 'adminRooms']);
        Route::post('/rooms', [AdminController::class, 'createRoom']);
        Route::patch('/rooms/{id}', [AdminController::class, 'updateRoom']);
        Route::delete('/rooms/{id}', [AdminController::class, 'deleteRoom']);
    });

    Route::middleware('permission:settings.manage')->group(function () {
        Route::get('/settings', [AdminController::class, 'settings']);
        // One write per act: `POST /admin/settings` used to accept an arbitrary object and upsert every key
        // in it without validation or an audit row. A setting is edited by name, or it is not a setting.
        Route::patch('/settings/{key}', [AdminController::class, 'updateSetting']);
    });

    Route::middleware('permission:users.manage')->group(function () {
        Route::get('/users', [AdminController::class, 'users']);
        Route::post('/users', [AdminController::class, 'createUser']);
        Route::patch('/users/{user}', [AdminController::class, 'updateUser']);
        Route::delete('/users/{user}', [AdminController::class, 'deleteUser']);
        Route::post('/users/{user}/reset-password', [AdminController::class, 'resetUserPassword']);
    });

    // Who may do what — the registry itself, and the scopes that decide what an operator can reach.
    Route::middleware('permission:roles.manage')->group(function () {
        Route::get('/roles', [AdminController::class, 'roles']);
        Route::get('/staff-assignments', [AdminController::class, 'staffAssignments']);
        Route::post('/staff-assignments', [AdminController::class, 'createStaffAssignment']);
        Route::delete('/staff-assignments/{id}', [AdminController::class, 'deleteStaffAssignment']);
    });

    // A role change is separate from a profile edit on purpose: it is the one user write that changes what
    // a person can authorise, so it has its own permission, its own guards and its own audit row.
    Route::patch('/users/{user}/role', [AdminController::class, 'updateUserRole'])
        ->middleware('permission:roles.manage');

    Route::middleware('permission:timetable.manage.all')->group(function () {
        Route::get('/timetable', [AdminController::class, 'adminTimetable']);
    });

    Route::middleware('permission:courses.view')->group(function () {
        Route::get('/courses', [AdminController::class, 'courses']);
        Route::get('/terms', [AdminController::class, 'terms']);
    });

    Route::middleware('permission:enrolments.manage')->group(function () {
        Route::post('/courses', [AdminController::class, 'createCourse']);
        Route::patch('/courses/{id}', [AdminController::class, 'updateCourse']);
        Route::delete('/courses/{id}', [AdminController::class, 'deleteCourse']);
        Route::post('/terms', [AdminController::class, 'createTerm']);
        Route::patch('/terms/{code}', [AdminController::class, 'updateTerm']);
        Route::delete('/terms/{code}', [AdminController::class, 'deleteTerm']);
        Route::get('/enrollments', [AdminController::class, 'enrollments']);
        Route::post('/enrollments', [AdminController::class, 'createEnrollment']);
        Route::delete('/enrollments/{id}', [AdminController::class, 'deleteEnrollment']);
    });

    // Service configuration: which rooms run a line, which desks exist, who staffs them, and what each
    // window does. Distinct from *operating* a line, which is staff work under `queue.operate.assigned`.
    Route::middleware('permission:queue.configure')->group(function () {
        Route::get('/queues', [AdminController::class, 'adminQueues']);
        Route::post('/rooms/{roomId}/queue', [AdminController::class, 'configureQueue']);
        Route::patch('/queues/{id}', [AdminController::class, 'updateQueue']);
        Route::delete('/queues/{id}', [AdminController::class, 'deleteQueue']);
    });

    Route::middleware('permission:office.configure')->group(function () {
        Route::get('/offices', [AdminController::class, 'adminOffices']);
        Route::post('/offices', [AdminController::class, 'createOffice']);
        Route::patch('/offices/{id}', [AdminController::class, 'updateOffice']);
        Route::delete('/offices/{id}', [AdminController::class, 'deleteOffice']);
        Route::get('/office-service-windows', [AdminController::class, 'serviceWindows']);
        Route::post('/office-service-windows', [AdminController::class, 'createServiceWindow']);
        Route::patch('/office-service-windows/{id}', [AdminController::class, 'updateServiceWindow']);
        Route::delete('/office-service-windows/{id}', [AdminController::class, 'deleteServiceWindow']);
        Route::get('/office-staff', [AdminController::class, 'officeStaff']);
        Route::post('/office-staff', [AdminController::class, 'addOfficeStaff']);
        Route::delete('/office-staff/{officeId}/{userId}', [AdminController::class, 'removeOfficeStaff']);
    });
});

// ─────────────────────────────────────────────────────────── ai assistant
//
// One conversational engine for every role and both platforms, but the actions it may offer are
// resolved from the caller's role, platform and permissions in the controller — the model never
// receives a tool it is not allowed to call, and never receives SQL.
Route::middleware(['auth:sanctum', 'role:student,staff,admin'])->prefix('ai')->group(function () {
    // One verb for one act: `POST /ai/messages` used to be an alias of `/ai/chat`, and two names for the
    // same write is how a client ends up calling the one with no rate limit on it.
    Route::post('/chat', [AiAssistantController::class, 'chat']);
    Route::get('/conversations', [AiAssistantController::class, 'conversations']);
    Route::get('/conversations/{conversation}', [AiAssistantController::class, 'showConversation']);
    Route::delete('/conversations/{conversation}', [AiAssistantController::class, 'deleteConversation']);
    Route::get('/capabilities', [AiAssistantController::class, 'capabilities']);
});
