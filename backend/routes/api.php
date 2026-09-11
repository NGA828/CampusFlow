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
use App\Http\Controllers\PublicOverviewController;
use App\Http\Controllers\QueueController;
use App\Http\Controllers\StaffController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — CampusFlow
| Prefix: /api/v1 (configured in bootstrap/app.php)
|--------------------------------------------------------------------------
*/

// Public Endpoints
Route::get('/health', HealthController::class);
Route::get('/public/overview', PublicOverviewController::class);

// Auth — Guest & Sanctum
Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::put('/profile', [AuthController::class, 'updateProfile']);
        Route::put('/password', [AuthController::class, 'changePassword']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });
});

// Me Endpoints
Route::middleware('auth:sanctum')->prefix('me')->group(function () {
    Route::get('/', [AuthController::class, 'me']);
    Route::patch('/', [AuthController::class, 'updateProfile']);
    Route::get('/dashboard', [MeController::class, 'dashboard']);
    Route::get('/timetable', [MeController::class, 'timetable']);
    Route::get('/timetable/today', [MeController::class, 'todayTimetable']);
    Route::get('/next-class', [MeController::class, 'nextClass']);
    Route::get('/queue-tickets/active', [MeController::class, 'activeQueueTicket']);
    Route::get('/office-tickets/active', [MeController::class, 'activeOfficeTicket']);
    Route::get('/office-tickets', [MeController::class, 'officeTickets']);
    Route::get('/tickets', [QueueController::class, 'myTickets']);
    Route::get('/offices/summary', [MeController::class, 'officesSummary']);
    Route::get('/notifications', [MeController::class, 'notifications']);
    Route::post('/notifications/{id}/read', [MeController::class, 'markNotificationRead']);
    Route::post('/notifications/read-all', [MeController::class, 'markAllNotificationsRead']);
    Route::post('/devices', [MeController::class, 'registerDevice']);
});

// Spatial & Campus (Public read, protected extensions)
Route::get('/buildings', [CampusController::class, 'buildings']);
Route::get('/buildings/{building}', [CampusController::class, 'building']);
Route::get('/floors/{floor}', [CampusController::class, 'floor']);
Route::get('/floors/{floor}/plan', [CampusController::class, 'floorPlan']);
Route::get('/floors/{floor}/availability', [CampusController::class, 'floorAvailability']);
Route::get('/rooms', [CampusController::class, 'rooms']);
Route::get('/rooms/{room}', [CampusController::class, 'room']);
Route::get('/rooms/{room}/availability', [CampusController::class, 'roomAvailability']);

// Positioning & Navigation
Route::prefix('positioning')->group(function () {
    Route::post('/scan', [PositioningController::class, 'scan']);
    Route::get('/anchors', [PositioningController::class, 'anchors']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/current', [PositioningController::class, 'current']);
        Route::post('/current', [PositioningController::class, 'updatePosition']);
        Route::post('/position', [PositioningController::class, 'updatePosition']);
    });
});

Route::prefix('navigation')->group(function () {
    Route::post('/route', [NavigationController::class, 'route']);
    Route::get('/nodes', [NavigationController::class, 'nodes']);
    Route::get('/edges', [NavigationController::class, 'edges']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/sessions', [NavigationController::class, 'startSession']);
        Route::get('/sessions', [NavigationController::class, 'history']);
        Route::get('/sessions/active', [NavigationController::class, 'activeSession']);
        Route::patch('/sessions/{session}', [NavigationController::class, 'updateSession']);
        Route::post('/sessions/{session}/position', [NavigationController::class, 'updatePosition']);
        Route::post('/sessions/{session}/end', [NavigationController::class, 'endSession']);
        Route::post('/sessions/{session}/complete', [NavigationController::class, 'complete']);
        Route::post('/sessions/{session}/abandon', [NavigationController::class, 'abandon']);
    });
});

// Room Queue Admission
Route::get('/queues', [QueueController::class, 'index']);
Route::get('/queues/{id}', [QueueController::class, 'showById']);
Route::get('/rooms/{room}/queue', [QueueController::class, 'show']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/rooms/{room}/queue/join', [QueueController::class, 'join']);
    Route::post('/queues/{id}/tickets', [QueueController::class, 'joinByQueueId']);
    Route::get('/queue-tickets/{id}', [QueueController::class, 'ticketDetails']);
    Route::post('/queue-tickets/{id}/cancel', [QueueController::class, 'cancelTicket']);
    Route::post('/queue-tickets/{id}/check-in', [QueueController::class, 'checkInTicket']);
    Route::post('/queue-tickets/{id}/navigating', [QueueController::class, 'setNavigating']);
    Route::post('/queues/{id}/proximity-check', [QueueController::class, 'proximityCheck']);
    Route::post('/queue/tickets/{ticket}/call', [QueueController::class, 'callTicket']);
    Route::post('/queue/tickets/{ticket}/admit', [QueueController::class, 'admitTicket']);
    Route::post('/queue/tickets/{ticket}/leave', [QueueController::class, 'leaveTicket']);
});

// Administrative Office Ticketing
Route::get('/offices', [OfficeController::class, 'index']);
Route::get('/offices/{office}', [OfficeController::class, 'show']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/offices/{office}/tickets', [OfficeController::class, 'createTicket']);
    Route::get('/office-tickets/{id}', [OfficeController::class, 'showTicket']);
    Route::post('/office-tickets/{id}/cancel', [OfficeController::class, 'cancelTicket']);
    Route::post('/office-tickets/{id}/check-in', [OfficeController::class, 'checkInTicket']);
    Route::post('/office-tickets/{id}/approaching', [OfficeController::class, 'approachingTicket']);
    Route::post('/offices/tickets/{ticket}/call', [OfficeController::class, 'callTicket']);
    Route::post('/offices/tickets/{ticket}/complete', [OfficeController::class, 'completeTicket']);
    Route::post('/offices/tickets/{ticket}/cancel', [OfficeController::class, 'cancelTicket']);
});

// Academic & Timetable
Route::get('/academic/courses', [AcademicController::class, 'courses']);
Route::get('/academic/terms', [AcademicController::class, 'terms']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/academic/timetable', [AcademicController::class, 'timetable']);
    Route::post('/academic/enrollments', [AcademicController::class, 'enroll']);
});

// Engagement (Events, Announcements, Notifications)
Route::get('/events', [EngagementController::class, 'events']);
Route::get('/announcements', [EngagementController::class, 'announcements']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/events/{event}/register', [EngagementController::class, 'registerEvent']);
    Route::delete('/events/{event}/register', [EngagementController::class, 'cancelEventRegistration']);
    Route::get('/notifications', [EngagementController::class, 'notifications']);
    Route::patch('/notifications/{notification}/read', [EngagementController::class, 'markNotificationRead']);
    Route::post('/notifications/read-all', [EngagementController::class, 'markAllNotificationsRead']);
});

// AI Assistant
Route::middleware('auth:sanctum')->prefix('ai')->group(function () {
    Route::post('/chat', [AiAssistantController::class, 'chat']);
    Route::post('/messages', [AiAssistantController::class, 'chat']);
    Route::get('/conversations', [AiAssistantController::class, 'conversations']);
});

// Staff Management
Route::middleware('auth:sanctum')->prefix('staff')->group(function () {
    Route::get('/dashboard', [StaffController::class, 'dashboard']);
    Route::get('/queues', [StaffController::class, 'queues']);
    Route::get('/queues/{id}/line', [StaffController::class, 'queueLine']);
    Route::post('/queues/{id}/call-next', [StaffController::class, 'callNext']);
    Route::post('/queue-tickets/{id}/admit', [StaffController::class, 'admitTicket']);
    Route::post('/queue-tickets/{id}/complete', [StaffController::class, 'completeQueueTicket']);
    Route::post('/queue-tickets/{id}/no-show', [StaffController::class, 'noShowQueueTicket']);

    Route::get('/offices', [StaffController::class, 'offices']);
    Route::get('/offices/{id}/line', [StaffController::class, 'officeLine']);
    Route::post('/offices/{id}/call-next', [StaffController::class, 'officeCallNext']);
    Route::post('/office-tickets/{id}/check-in', [StaffController::class, 'officeCheckIn']);
    Route::post('/office-tickets/{id}/start-service', [StaffController::class, 'officeStartService']);
    Route::post('/office-tickets/{id}/complete', [StaffController::class, 'officeComplete']);
    Route::post('/office-tickets/{id}/no-show', [StaffController::class, 'officeNoShow']);

    Route::get('/timetable', [StaffController::class, 'timetable']);
    Route::post('/timetable', [StaffController::class, 'createEntry']);
    Route::patch('/timetable/{id}', [StaffController::class, 'updateEntry']);
    Route::delete('/timetable/{id}', [StaffController::class, 'deleteEntry']);

    Route::post('/events', [StaffController::class, 'createEvent']);
    Route::patch('/events/{id}', [StaffController::class, 'updateEvent']);
    Route::delete('/events/{id}', [StaffController::class, 'deleteEvent']);

    Route::get('/announcements', [StaffController::class, 'announcements']);
    Route::post('/announcements', [StaffController::class, 'createAnnouncement']);
    Route::delete('/announcements/{id}', [StaffController::class, 'deleteAnnouncement']);
});

// Administration
Route::middleware('auth:sanctum')->prefix('admin')->group(function () {
    Route::get('/dashboard', [AdminController::class, 'dashboard']);
    Route::get('/analytics', [AdminController::class, 'analytics']);
    Route::get('/audit-logs', [AdminController::class, 'auditLogs']);
    Route::get('/map', [AdminController::class, 'mapData']);
    Route::get('/timetable', [AdminController::class, 'adminTimetable']);

    Route::get('/settings', [AdminController::class, 'settings']);
    Route::post('/settings', [AdminController::class, 'updateSettings']);
    Route::patch('/settings/{key}', [AdminController::class, 'updateSingleSetting']);

    Route::get('/users', [AdminController::class, 'users']);
    Route::post('/users', [AdminController::class, 'createUser']);
    Route::patch('/users/{user}', [AdminController::class, 'updateUser']);
    Route::patch('/users/{user}/role', [AdminController::class, 'updateUserRole']);
    Route::delete('/users/{user}', [AdminController::class, 'deleteUser']);
    Route::post('/users/{user}/reset-password', [AdminController::class, 'resetUserPassword']);

    Route::get('/staff-assignments', [AdminController::class, 'staffAssignments']);
    Route::post('/staff-assignments', [AdminController::class, 'createStaffAssignment']);
    Route::delete('/staff-assignments/{id}', [AdminController::class, 'deleteStaffAssignment']);

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

    Route::get('/qr-nodes', [AdminController::class, 'qrNodes']);
    Route::post('/qr-nodes', [AdminController::class, 'createQrNode']);
    Route::patch('/qr-nodes/{id}', [AdminController::class, 'updateQrNode']);
    Route::delete('/qr-nodes/{id}', [AdminController::class, 'deleteQrNode']);
    Route::get('/qr-nodes/{id}/payload', [AdminController::class, 'qrPayload']);
    Route::post('/qr-nodes/{id}/regenerate', [AdminController::class, 'regenerateQr']);

    Route::get('/navigation-nodes', [AdminController::class, 'navigationNodes']);
    Route::post('/navigation-nodes', [AdminController::class, 'createNavigationNode']);
    Route::patch('/navigation-nodes/{id}', [AdminController::class, 'updateNavigationNode']);
    Route::delete('/navigation-nodes/{id}', [AdminController::class, 'deleteNavigationNode']);

    Route::get('/navigation-edges', [AdminController::class, 'navigationEdges']);
    Route::post('/navigation-edges', [AdminController::class, 'createNavigationEdge']);
    Route::patch('/navigation-edges/{id}', [AdminController::class, 'updateNavigationEdge']);
    Route::delete('/navigation-edges/{id}', [AdminController::class, 'deleteNavigationEdge']);

    Route::get('/courses', [AdminController::class, 'courses']);
    Route::post('/courses', [AdminController::class, 'createCourse']);
    Route::patch('/courses/{id}', [AdminController::class, 'updateCourse']);
    Route::delete('/courses/{id}', [AdminController::class, 'deleteCourse']);

    Route::get('/terms', [AdminController::class, 'terms']);
    Route::post('/terms', [AdminController::class, 'createTerm']);
    Route::patch('/terms/{code}', [AdminController::class, 'updateTerm']);
    Route::delete('/terms/{code}', [AdminController::class, 'deleteTerm']);

    Route::get('/enrollments', [AdminController::class, 'enrollments']);
    Route::post('/enrollments', [AdminController::class, 'createEnrollment']);
    Route::delete('/enrollments/{id}', [AdminController::class, 'deleteEnrollment']);

    Route::get('/queues', [AdminController::class, 'adminQueues']);
    Route::post('/rooms/{id}/queue', [AdminController::class, 'configureQueue']);

    Route::get('/offices', [AdminController::class, 'adminOffices']);
    Route::post('/offices', [AdminController::class, 'createOffice']);
    Route::patch('/offices/{id}', [AdminController::class, 'updateOffice']);
    Route::delete('/offices/{id}', [AdminController::class, 'deleteOffice']);

    Route::get('/office-service-windows', [AdminController::class, 'adminServiceWindows']);
    Route::post('/office-service-windows', [AdminController::class, 'createServiceWindow']);
    Route::patch('/office-service-windows/{id}', [AdminController::class, 'updateServiceWindow']);
    Route::delete('/office-service-windows/{id}', [AdminController::class, 'deleteServiceWindow']);

    Route::get('/office-staff', [AdminController::class, 'adminOfficeStaff']);
    Route::post('/office-staff', [AdminController::class, 'assignOfficeStaff']);
    Route::delete('/office-staff/{id}', [AdminController::class, 'removeOfficeStaff']);
});
