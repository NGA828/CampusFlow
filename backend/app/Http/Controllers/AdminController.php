<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
use App\Models\Building;
use App\Models\CampusEvent;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Floor;
use App\Models\NavigationEdge;
use App\Models\NavigationNode;
use App\Models\Office;
use App\Models\OfficeServiceWindow;
use App\Models\OfficeStaff;
use App\Models\OfficeTicket;
use App\Models\QrNode;
use App\Models\QueueTicket;
use App\Models\Room;
use App\Models\RoomQueue;
use App\Models\StaffAssignment;
use App\Models\Term;
use App\Models\TimetableEntry;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AdminController extends Controller
{
    /* ──────────────────────────────────────── guard */

    private function requireAdmin(Request $request): bool
    {
        return $request->user()?->role === 'admin';
    }

    private function forbidden(): JsonResponse
    {
        return response()->json(['success' => false, 'message' => 'Forbidden — admin only'], 403);
    }

    private function ok(array $data, int $status = 200): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $data], $status);
    }

    private function paginate($query, Request $request, callable $transform = null): array
    {
        $perPage = min((int) ($request->query('per_page', 20)), 100);
        $paged   = $query->paginate($perPage);
        $items   = collect($paged->items());
        if ($transform) $items = $items->map($transform);
        return [
            'items' => $items,
            'meta'  => [
                'total'        => $paged->total(),
                'per_page'     => $paged->perPage(),
                'current_page' => $paged->currentPage(),
                'last_page'    => $paged->lastPage(),
            ],
        ];
    }

    /* ─────────────────────────────────────── dashboard */

    public function dashboard(): JsonResponse
    {
        $totalUsers          = User::count();
        $totalStudents       = User::where('role', 'student')->count();
        $totalStaff          = User::where('role', 'staff')->count();
        $activeRoomTickets   = QueueTicket::whereIn('status', ['waiting', 'called'])->count();
        $activeOfficeTickets = OfficeTicket::whereIn('status', ['waiting', 'called', 'in_service'])->count();
        $todayAdmitted       = QueueTicket::where('status', 'admitted')->whereDate('admitted_at', now()->today())->count();
        $todayOfficeCompleted= OfficeTicket::where('status', 'completed')->whereDate('completed_at', now()->today())->count();
        $buildingsCount      = Building::count();
        $roomsCount          = Room::count();

        return $this->ok([
            'users'  => ['total' => $totalUsers, 'students' => $totalStudents, 'staff' => $totalStaff],
            'queues' => ['active_room_tickets' => $activeRoomTickets, 'active_office_tickets' => $activeOfficeTickets,
                         'today_room_admitted' => $todayAdmitted, 'today_office_served' => $todayOfficeCompleted],
            'campus' => ['buildings' => $buildingsCount, 'rooms' => $roomsCount],
        ]);
    }

    /* ─────────────────────────────────────── analytics */

    public function analytics(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();

        $roomUtilisation = QueueTicket::selectRaw('queue_id, count(*) as total, count(admitted_at) as admitted')
            ->whereDate('created_at', '>=', now()->subDays(30))
            ->groupBy('queue_id')
            ->with('queue.room')
            ->get()
            ->map(fn($r) => [
                'queue_id'  => $r->queue_id,
                'room_code' => $r->queue?->room?->code,
                'room_name' => $r->queue?->room?->name,
                'total'     => $r->total,
                'admitted'  => $r->admitted,
            ]);

        $officeDemand = OfficeTicket::selectRaw('office_id, count(*) as total, count(completed_at) as completed')
            ->whereDate('created_at', '>=', now()->subDays(30))
            ->groupBy('office_id')
            ->get()
            ->map(fn($r) => [
                'office_id' => $r->office_id,
                'total'     => $r->total,
                'completed' => $r->completed,
            ]);

        return $this->ok([
            'room_utilisation' => $roomUtilisation,
            'office_demand'    => $officeDemand,
            'period_days'      => 30,
        ]);
    }

    /* ─────────────────────────────────────── users */

    public function users(Request $request): JsonResponse
    {
        $query = User::query();

        if ($role = $request->query('role'))     $query->where('role', $role);
        if ($q    = $request->query('q'))        $query->where(fn($sq) =>
            $sq->where('name', 'ilike', "%{$q}%")->orWhere('email', 'ilike', "%{$q}%")
        );

        return $this->ok($this->paginate($query->orderBy('name'), $request));
    }

    public function createUser(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();

        $request->validate([
            'name'            => 'required|string|max:255',
            'email'           => 'required|email|unique:users,email',
            'role'            => 'required|in:admin,staff,student,visitor',
            'password'        => 'nullable|string|min:8',
            'registration_no' => 'nullable|string',
            'department'      => 'nullable|string',
        ]);

        $password = $request->input('password') ?? Str::random(12);

        $user = User::create([
            'name'            => $request->input('name'),
            'email'           => $request->input('email'),
            'role'            => $request->input('role'),
            'password'        => Hash::make($password),
            'registration_no' => $request->input('registration_no'),
            'department'      => $request->input('department'),
        ]);

        return $this->ok(['user' => $user, 'password' => $request->has('password') ? null : $password], 201);
    }

    public function updateUser(Request $request, User $user): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();

        $request->validate([
            'name'       => 'sometimes|string|max:255',
            'role'       => 'sometimes|in:admin,staff,student,visitor',
            'department' => 'sometimes|nullable|string',
            'status'     => 'sometimes|in:active,suspended',
        ]);

        $user->update($request->only(['name', 'role', 'department', 'status']));

        return $this->ok(['user' => $user->fresh()]);
    }

    public function updateUserRole(Request $request, User $user): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();

        $request->validate(['role' => 'required|in:admin,staff,student,visitor']);
        $user->update(['role' => $request->input('role')]);

        return $this->ok(['user' => $user->fresh()]);
    }

    public function deleteUser(Request $request, User $user): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $user->delete();
        return response()->json(['success' => true, 'message' => 'User deleted'], 200);
    }

    public function resetUserPassword(Request $request, User $user): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $password = Str::random(12);
        $user->update(['password' => Hash::make($password)]);
        return $this->ok(['password' => $password]);
    }

    /* ─────────────────────────────────────── staff assignments */

    public function staffAssignments(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $assignments = StaffAssignment::with(['user'])->get();
        return $this->ok(['assignments' => $assignments]);
    }

    public function createStaffAssignment(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $request->validate([
            'user_id'    => 'required|uuid|exists:users,id',
            'scope_type' => 'required|string',
            'scope_id'   => 'required|string',
        ]);
        $a = StaffAssignment::create($request->only(['user_id', 'scope_type', 'scope_id', 'role_in_scope', 'can_manage_timetable', 'can_publish_content', 'can_call_tickets']));
        return $this->ok(['assignment' => $a], 201);
    }

    public function deleteStaffAssignment(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        StaffAssignment::findOrFail($id)->delete();
        return response()->json(['success' => true]);
    }

    /* ─────────────────────────────────────── buildings */

    public function buildings(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $q = Building::query();
        if ($search = $request->query('q')) $q->where('name', 'ilike', "%{$search}%");
        return $this->ok($this->paginate($q->orderBy('name'), $request, fn($b) => $b->toApiArray()));
    }

    public function createBuilding(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $request->validate(['code' => 'required|string|unique:buildings,code', 'name' => 'required|string']);
        $b = Building::create($request->only(['code', 'name', 'short_name', 'description', 'lat', 'lng', 'footprint', 'image_url', 'status']));
        return $this->ok($b->toApiArray(), 201);
    }

    public function updateBuilding(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $b = Building::findOrFail($id);
        $b->update($request->only(['code', 'name', 'short_name', 'description', 'lat', 'lng', 'footprint', 'image_url', 'status']));
        return $this->ok($b->fresh()->toApiArray());
    }

    public function deleteBuilding(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        Building::findOrFail($id)->delete();
        return response()->json(['success' => true]);
    }

    /* ─────────────────────────────────────── floors */

    public function floors(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $q = Floor::with(['building'])->when($request->query('building_id'), fn($q, $id) => $q->where('building_id', $id));
        return $this->ok($this->paginate($q->orderBy('level'), $request, fn($f) => $f->toApiArray()));
    }

    public function createFloor(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $request->validate(['building_id' => 'required|uuid|exists:buildings,id', 'level' => 'required|integer', 'name' => 'required|string']);
        $f = Floor::create($request->only(['building_id', 'level', 'code', 'name', 'plan_url', 'plan_width', 'plan_height', 'status']));
        return $this->ok($f->toApiArray(), 201);
    }

    public function updateFloor(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $f = Floor::findOrFail($id);
        $f->update($request->only(['level', 'code', 'name', 'plan_url', 'plan_width', 'plan_height', 'status']));
        return $this->ok($f->fresh()->toApiArray());
    }

    public function deleteFloor(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        Floor::findOrFail($id)->delete();
        return response()->json(['success' => true]);
    }

    /* ─────────────────────────────────────── rooms */

    public function adminRooms(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $q = Room::with(['floor.building'])->when($request->query('q'), fn($q, $s) =>
            $q->where('name', 'ilike', "%{$s}%")->orWhere('code', 'ilike', "%{$s}%")
        );
        return $this->ok($this->paginate($q->orderBy('code'), $request, fn($r) => $r->toApiArray()));
    }

    public function createRoom(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $request->validate(['floor_id' => 'required|uuid|exists:floors,id', 'code' => 'required|string', 'name' => 'required|string']);
        $r = Room::create($request->only(['floor_id', 'code', 'name', 'type', 'capacity', 'area_m2', 'plan_x', 'plan_y', 'lat', 'lng', 'features', 'requires_admission', 'status', 'image_url']));
        return $this->ok($r->toApiArray(), 201);
    }

    public function updateRoom(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $r = Room::findOrFail($id);
        $r->update($request->only(['code', 'name', 'type', 'capacity', 'area_m2', 'plan_x', 'plan_y', 'lat', 'lng', 'features', 'requires_admission', 'status', 'image_url']));
        return $this->ok($r->fresh()->toApiArray());
    }

    public function deleteRoom(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        Room::findOrFail($id)->delete();
        return response()->json(['success' => true]);
    }

    /* ─────────────────────────────────────── QR nodes */

    public function qrNodes(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $q = QrNode::query()->when($request->query('building_id'), fn($q, $id) => $q->where('building_id', $id));
        return $this->ok($this->paginate($q->orderBy('code'), $request, fn($n) => $n->toApiArray()));
    }

    public function createQrNode(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $request->validate(['building_id' => 'required|uuid|exists:buildings,id', 'label' => 'required|string']);
        $n = QrNode::create(array_merge($request->only(['building_id', 'floor_id', 'room_id', 'label', 'lat', 'lng', 'plan_x', 'plan_y', 'type', 'is_active']), [
            'code'    => 'QR-' . strtoupper(Str::random(8)),
            'version' => 1,
        ]));
        return $this->ok($n->toApiArray(), 201);
    }

    public function updateQrNode(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $n = QrNode::findOrFail($id);
        $n->update($request->only(['label', 'lat', 'lng', 'plan_x', 'plan_y', 'type', 'is_active']));
        return $this->ok($n->fresh()->toApiArray());
    }

    public function deleteQrNode(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        QrNode::findOrFail($id)->delete();
        return response()->json(['success' => true]);
    }

    public function qrPayload(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $node = QrNode::findOrFail($id);
        $payload = json_encode(['id' => $node->id, 'code' => $node->code, 'version' => $node->version]);
        return $this->ok(['payload' => $payload, 'code' => $node->code, 'label' => $node->label, 'version' => $node->version, 'scan_url' => url("/scan?qr={$node->code}")]);
    }

    public function regenerateQr(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $node = QrNode::findOrFail($id);
        $node->update(['code' => 'QR-' . strtoupper(Str::random(8)), 'version' => $node->version + 1]);
        return $this->ok(['node' => ['id' => $node->id, 'code' => $node->code, 'version' => $node->version]]);
    }

    /* ─────────────────────────────────────── navigation nodes */

    public function navigationNodes(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $q = NavigationNode::query()->when($request->query('floor_id'), fn($q, $id) => $q->where('floor_id', $id));
        return $this->ok($this->paginate($q, $request, fn($n) => $n->toArray()));
    }

    public function createNavigationNode(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $request->validate(['building_id' => 'required|uuid|exists:buildings,id']);
        $n = NavigationNode::create($request->only(['building_id', 'floor_id', 'room_id', 'code', 'label', 'type', 'lat', 'lng', 'plan_x', 'plan_y', 'is_accessible']));
        return $this->ok($n->toArray(), 201);
    }

    public function updateNavigationNode(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $n = NavigationNode::findOrFail($id);
        $n->update($request->only(['code', 'label', 'type', 'lat', 'lng', 'plan_x', 'plan_y', 'is_accessible']));
        return $this->ok($n->fresh()->toArray());
    }

    public function deleteNavigationNode(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        NavigationNode::findOrFail($id)->delete();
        return response()->json(['success' => true]);
    }

    /* ─────────────────────────────────────── navigation edges */

    public function navigationEdges(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $q = NavigationEdge::query();
        return $this->ok($this->paginate($q, $request, fn($e) => $e->toArray()));
    }

    public function createNavigationEdge(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $request->validate(['from_node_id' => 'required|uuid', 'to_node_id' => 'required|uuid']);
        $e = NavigationEdge::create($request->only(['from_node_id', 'to_node_id', 'distance_m', 'edge_type', 'is_accessible', 'bidirectional']));
        return $this->ok($e->toArray(), 201);
    }

    public function updateNavigationEdge(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $e = NavigationEdge::findOrFail($id);
        $e->update($request->only(['distance_m', 'edge_type', 'is_accessible', 'bidirectional']));
        return $this->ok($e->fresh()->toArray());
    }

    public function deleteNavigationEdge(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        NavigationEdge::findOrFail($id)->delete();
        return response()->json(['success' => true]);
    }

    /* ─────────────────────────────────────── courses */

    public function courses(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $q = Course::query()->when($request->query('q'), fn($q, $s) => $q->where('name', 'ilike', "%{$s}%")->orWhere('code', 'ilike', "%{$s}%"));
        return $this->ok($this->paginate($q->orderBy('code'), $request));
    }

    public function createCourse(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $request->validate(['code' => 'required|string|unique:courses,code', 'name' => 'required|string']);
        $c = Course::create($request->only(['code', 'name', 'description', 'credits', 'department', 'level']));
        return $this->ok($c->toArray(), 201);
    }

    public function updateCourse(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $c = Course::findOrFail($id);
        $c->update($request->only(['code', 'name', 'description', 'credits', 'department', 'level']));
        return $this->ok($c->fresh()->toArray());
    }

    public function deleteCourse(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        Course::findOrFail($id)->delete();
        return response()->json(['success' => true]);
    }

    /* ─────────────────────────────────────── terms */

    public function terms(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $q = Term::orderBy('start_date', 'desc');
        return $this->ok($this->paginate($q, $request));
    }

    public function createTerm(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $request->validate(['code' => 'required|string|unique:terms,code', 'name' => 'required|string', 'start_date' => 'required|date', 'end_date' => 'required|date|after:start_date']);
        $t = Term::create($request->only(['code', 'name', 'start_date', 'end_date', 'is_current']));
        return $this->ok($t->toArray(), 201);
    }

    public function updateTerm(Request $request, string $code): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $t = Term::where('code', $code)->firstOrFail();
        $t->update($request->only(['name', 'start_date', 'end_date', 'is_current']));
        return $this->ok($t->fresh()->toArray());
    }

    public function deleteTerm(Request $request, string $code): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        Term::where('code', $code)->firstOrFail()->delete();
        return response()->json(['success' => true]);
    }

    /* ─────────────────────────────────────── enrollments */

    public function enrollments(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $q = Enrollment::with(['student', 'course'])->when($request->query('student_id'), fn($q, $id) => $q->where('student_id', $id));
        return $this->ok($this->paginate($q, $request));
    }

    public function createEnrollment(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $request->validate(['student_id' => 'required|uuid|exists:users,id', 'course_id' => 'required|uuid|exists:courses,id', 'term_code' => 'required|string|exists:terms,code']);
        $e = Enrollment::firstOrCreate(
            ['student_id' => $request->input('student_id'), 'course_id' => $request->input('course_id'), 'term_code' => $request->input('term_code')],
            ['status' => $request->input('status', 'enrolled')]
        );
        return $this->ok(['enrollment' => $e], 201);
    }

    public function deleteEnrollment(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        Enrollment::findOrFail($id)->delete();
        return response()->json(['success' => true]);
    }

    /* ─────────────────────────────────────── queues */

    public function adminQueues(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $queues = RoomQueue::with(['room.floor.building'])->get()->map(fn($q) => array_merge($q->toApiArray(), [
            'room_code'     => $q->room?->code,
            'room_name'     => $q->room?->name,
            'building_code' => $q->room?->floor?->building?->code,
        ]));
        $roomsWithout = Room::whereDoesntHave('queue')->get(['id', 'code', 'name', 'requires_admission'])->map(fn($r) => [
            'id' => $r->id, 'code' => $r->code, 'name' => $r->name, 'requires_admission' => $r->requires_admission, 'building_code' => null,
        ]);
        return $this->ok(['queues' => $queues, 'rooms_without_queue' => $roomsWithout]);
    }

    public function configureQueue(Request $request, string $roomId): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $room = Room::findOrFail($roomId);
        $q = RoomQueue::updateOrCreate(['room_id' => $roomId], $request->only(['is_open', 'capacity', 'max_capacity', 'call_window_minutes', 'proximity_radius_m', 'mode', 'welcome_message']));
        return $this->ok(['queue' => $q->toApiArray()], 201);
    }

    public function updateQueue(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $q = RoomQueue::findOrFail($id);
        $q->update($request->only(['is_open', 'capacity', 'max_capacity', 'call_window_minutes', 'proximity_radius_m', 'mode', 'welcome_message']));
        return $this->ok(['queue' => $q->fresh()->toApiArray()]);
    }

    public function deleteQueue(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        RoomQueue::findOrFail($id)->delete();
        return response()->json(['success' => true]);
    }

    /* ─────────────────────────────────────── offices */

    public function adminOffices(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $q = Office::withTrashed()->when(!$request->boolean('with_deleted'), fn($q) => $q->whereNull('deleted_at'));
        return $this->ok($this->paginate($q->orderBy('name'), $request, fn($o) => $o->toApiArray()));
    }

    public function createOffice(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $request->validate(['code' => 'required|string|unique:offices,code', 'name' => 'required|string']);
        $o = Office::create($request->only(['code', 'name', 'description', 'room_id', 'status', 'is_open', 'opening_hours', 'phone', 'email', 'image_url', 'avg_service_minutes']));
        return $this->ok($o->toApiArray(), 201);
    }

    public function updateOffice(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $o = Office::findOrFail($id);
        $o->update($request->only(['code', 'name', 'description', 'room_id', 'status', 'is_open', 'opening_hours', 'phone', 'email', 'image_url', 'avg_service_minutes']));
        return $this->ok($o->fresh()->toApiArray());
    }

    public function deleteOffice(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        Office::findOrFail($id)->delete();
        return response()->json(['success' => true]);
    }

    /* ─────────────────────────────────────── service windows */

    public function serviceWindows(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $q = OfficeServiceWindow::query()->when($request->query('office_id'), fn($q, $id) => $q->where('office_id', $id));
        return $this->ok($this->paginate($q, $request));
    }

    public function createServiceWindow(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $request->validate(['office_id' => 'required|uuid|exists:offices,id', 'label' => 'required|string']);
        $w = OfficeServiceWindow::create($request->only(['office_id', 'label', 'status']));
        return $this->ok($w->toArray(), 201);
    }

    public function updateServiceWindow(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $w = OfficeServiceWindow::findOrFail($id);
        $w->update($request->only(['label', 'status']));
        return $this->ok($w->fresh()->toArray());
    }

    public function deleteServiceWindow(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        OfficeServiceWindow::findOrFail($id)->delete();
        return response()->json(['success' => true]);
    }

    /* ─────────────────────────────────────── office staff */

    public function officeStaff(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $q = OfficeStaff::with(['user', 'office'])->when($request->query('office_id'), fn($q, $id) => $q->where('office_id', $id));
        $staff = $q->get()->map(fn($os) => [
            'office_id'   => $os->office_id,
            'user_id'     => $os->user_id,
            'role'        => $os->role,
            'is_primary'  => $os->is_primary,
            'user_name'   => $os->user?->name,
            'office_name' => $os->office?->name,
        ]);
        return $this->ok(['staff' => $staff]);
    }

    public function addOfficeStaff(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $request->validate(['office_id' => 'required|uuid|exists:offices,id', 'user_id' => 'required|uuid|exists:users,id']);
        $os = OfficeStaff::firstOrCreate(
            ['office_id' => $request->input('office_id'), 'user_id' => $request->input('user_id')],
            ['role' => $request->input('role', 'staff'), 'is_primary' => $request->boolean('is_primary')]
        );
        return $this->ok(['staff' => $os], 201);
    }

    public function removeOfficeStaff(Request $request, string $officeId, string $userId): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        OfficeStaff::where('office_id', $officeId)->where('user_id', $userId)->delete();
        return response()->json(['success' => true]);
    }

    /* ─────────────────────────────────────── admin map */

    public function map(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();

        $buildings = Building::with(['floors.rooms.queue'])->get()->map(fn($b) => array_merge($b->toApiArray(), [
            'floors' => $b->floors->map(fn($f) => array_merge($f->toApiArray(), [
                'rooms' => $f->rooms->map(fn($r) => $r->toApiArray(true)),
            ])),
        ]));

        $nodes = NavigationNode::all()->map(fn($n) => $n->toArray());
        $edges = NavigationEdge::all()->map(fn($e) => $e->toArray());
        $qrNodes = QrNode::all()->map(fn($n) => $n->toApiArray());

        return $this->ok(['buildings' => $buildings, 'nodes' => $nodes, 'edges' => $edges, 'qr_nodes' => $qrNodes]);
    }

    /* ─────────────────────────────────────── admin timetable */

    public function adminTimetable(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();

        $termCode = $request->query('term_code', optional(Term::where('is_current', true)->first())->code);

        $q = TimetableEntry::with(['course', 'room.floor.building', 'lecturer'])
            ->when($termCode, fn($q) => $q->where('term_code', $termCode));

        $entries = $q->orderBy('day_of_week')->orderBy('starts_at')->get()->map(fn($e) => $e->toApiArray());

        return $this->ok(['term' => $termCode, 'entries' => $entries]);
    }

    /* ─────────────────────────────────────── settings */

    public function settings(): JsonResponse
    {
        $settings = DB::table('settings')->get()->map(fn($s) => [
            'key'   => $s->key,
            'value' => $s->value,
        ]);
        return $this->ok(['settings' => $settings]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $input = $request->all();
        foreach ($input as $key => $value) {
            DB::table('settings')->updateOrInsert(
                ['key' => $key],
                ['value' => is_array($value) ? json_encode($value) : (string) $value, 'updated_at' => now()]
            );
        }
        return response()->json(['success' => true, 'message' => 'Settings updated']);
    }

    public function updateSetting(Request $request, string $key): JsonResponse
    {
        $request->validate(['value' => 'required']);
        $value = is_array($request->input('value')) ? json_encode($request->input('value')) : (string) $request->input('value');
        DB::table('settings')->updateOrInsert(['key' => $key], ['value' => $value, 'updated_at' => now()]);
        return $this->ok(['setting' => ['key' => $key, 'value' => $value]]);
    }

    /* ─────────────────────────────────────── audit logs */

    public function auditLogs(Request $request): JsonResponse
    {
        $logs = DB::table('audit_logs')->orderBy('created_at', 'desc')->paginate(50);
        return $this->ok($this->paginate(DB::table('audit_logs')->orderBy('created_at', 'desc'), $request));
    }
}
