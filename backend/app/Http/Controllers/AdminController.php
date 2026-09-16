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
use App\Models\NavigationSession;
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
use App\Support\Access\Roles;
use App\Support\CampusConfiguration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AdminController extends Controller
{
    /* ──────────────────────────────────────── guard */

    /**
     * Defensive second layer.
     *
     * routes/api.php already gates this whole controller behind `role:admin`; this exists so a route
     * that is later moved out of that group cannot accidentally become public, and so the check is
     * phrased as a capability (the admin role's own governance permission) instead of a string
     * comparison scattered through 60 methods.
     */
    private function requireAdmin(Request $request): bool
    {
        $user = $request->user();

        return $user !== null
            && $user->role === Roles::ADMIN
            && $user->isActive();
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
        $perPage = max(1, min((int) ($request->query('per_page', 20)), 100));
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

    public function dashboard(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();

        $now = now();
        $totalUsers          = User::count();
        $totalStudents       = User::where('role', 'student')->count();
        $totalStaff          = User::where('role', 'staff')->count();
        $activeRoomTickets   = QueueTicket::whereIn('status', ['waiting', 'called', 'checked_in'])->count();
        $activeOfficeTickets = OfficeTicket::whereIn('status', ['waiting', 'called', 'in_service'])->count();
        $todayAdmitted       = QueueTicket::where('status', 'admitted')->whereDate('admitted_at', now()->today())->count();
        $todayOfficeCompleted= OfficeTicket::where('status', 'completed')->whereDate('completed_at', now()->today())->count();
        $buildingsCount      = Building::count();
        $roomsCount          = Room::count();
        $queues = RoomQueue::with('room.floor.building')
            ->get()
            ->map(fn ($queue) => [
                'queue_id' => $queue->id,
                'room_code' => $queue->room?->code,
                'room_name' => $queue->room?->name,
                'building_code' => $queue->room?->floor?->building?->code,
                'waiting' => QueueTicket::where('queue_id', $queue->id)->where('status', 'waiting')->count(),
                'occupying' => QueueTicket::where('queue_id', $queue->id)->whereIn('status', ['called', 'checked_in'])->count(),
                'admission_capacity' => $queue->capacity,
                'is_active' => $queue->is_open,
            ])->values();
        $issued7d = QueueTicket::where('created_at', '>=', $now->copy()->subDays(7))->count();
        $officeIssued7d = OfficeTicket::where('created_at', '>=', $now->copy()->subDays(7))->count();
        $navigation7d = NavigationSession::where('created_at', '>=', $now->copy()->subDays(7));
        $recentAudit = DB::table('audit_logs')
            ->leftJoin('users', 'users.id', '=', 'audit_logs.user_id')
            ->orderByDesc('audit_logs.created_at')
            ->limit(8)
            ->get(['audit_logs.id', 'audit_logs.action', 'audit_logs.subject_type', 'audit_logs.subject_id', 'users.name as actor_name', 'audit_logs.created_at'])
            ->map(fn ($log) => [
                'id'           => $log->id,
                'action'       => $log->action,
                'subject_type' => $log->subject_type,
                'subject_id'   => $log->subject_id,
                'actor_name'   => $log->actor_name,
                'created_at'   => $log->created_at,
            ])->values();

        return $this->ok([
            'kpis' => [
                'generated_at' => $now->toIso8601String(),
                'students' => $totalStudents,
                'staff' => $totalStaff,
                'waiting_now' => $activeRoomTickets,
                'issued_today' => QueueTicket::whereDate('created_at', $now->toDateString())->count(),
                'office_waiting_now' => $activeOfficeTickets,
                'office_completed_today' => $todayOfficeCompleted,
                'navigation_sessions_today' => NavigationSession::whereDate('created_at', $now->toDateString())->count(),
                'average_wait_minutes' => null,
                'no_show_rate_7d' => null,
                'rooms' => $roomsCount,
                'buildings' => $buildingsCount,
            ],
            'overview' => [
                'generated_at' => $now->toIso8601String(),
                'users' => ['students' => $totalStudents, 'staff' => $totalStaff, 'admins' => User::where('role', 'admin')->count(), 'total' => $totalUsers, 'active_7d' => User::where('updated_at', '>=', $now->copy()->subDays(7))->count()],
                'campus' => ['buildings' => $buildingsCount, 'floors' => Floor::count(), 'rooms' => $roomsCount, 'total_capacity' => Room::sum('capacity'), 'qr_nodes' => QrNode::count(), 'navigation_nodes' => NavigationNode::count(), 'navigation_edges' => NavigationEdge::count()],
                'queues' => ['configured' => RoomQueue::count(), 'active' => RoomQueue::where('is_open', true)->count(), 'waiting_now' => $activeRoomTickets, 'issued_today' => QueueTicket::whereDate('created_at', $now->toDateString())->count(), 'issued_7d' => $issued7d, 'called_today' => QueueTicket::whereDate('called_at', $now->toDateString())->count(), 'average_wait_minutes' => null, 'average_service_minutes' => null, 'no_show_rate_7d' => null, 'busiest_rooms' => [], 'hourly_volume' => []],
                'offices' => ['configured' => Office::count(), 'open_now' => Office::where('is_open', true)->count(), 'issued_today' => OfficeTicket::whereDate('created_at', $now->toDateString())->count(), 'completed_today' => $todayOfficeCompleted, 'waiting_now' => $activeOfficeTickets, 'average_service_minutes' => null, 'average_wait_minutes' => null, 'no_show_rate_7d' => null, 'busiest' => []],
                'navigation' => ['sessions_today' => NavigationSession::whereDate('created_at', $now->toDateString())->count(), 'sessions_7d' => $navigation7d->count(), 'completion_rate_7d' => null, 'off_route_events_7d' => 0, 'recalculations_7d' => 0, 'average_distance_m' => null, 'popular_destinations' => []],
                'engagement' => ['events_upcoming' => CampusEvent::where('starts_at', '>=', $now)->count(), 'announcements_active' => Announcement::whereNotNull('published_at')->count(), 'notifications_7d' => DB::table('notifications')->where('created_at', '>=', $now->copy()->subDays(7))->count()],
                'utilisation' => [],
            ],
            'live_queues' => $queues,
            'recent_audit' => $recentAudit,
            'buildings' => Building::orderBy('code')->get()->map(fn ($building) => ['id' => $building->id, 'code' => $building->code, 'name' => $building->name, 'status' => $building->status, 'is_public' => (bool) ($building->is_public ?? true)])->values(),
        ]);
    }

    /* ─────────────────────────────────────── analytics */

    public function analytics(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();

        /*
         * The analytics screen consumes the same complete overview contract as the admin
         * dashboard. Keeping one server-side projection prevents cards from drifting apart
         * when a metric is added or renamed.
         */
        $dashboard = $this->dashboard($request)->getData(true);

        return $this->ok($dashboard['data']['overview'] ?? []);
    }

    /* ─────────────────────────────────────── users */

    public function users(Request $request): JsonResponse
    {
        $request->validate(['q' => 'nullable|string|max:255', 'role' => 'nullable|in:admin,staff,student,visitor', 'per_page' => 'nullable|integer|min:1|max:100', 'page' => 'nullable|integer|min:1']);
        $query = User::query();

        if ($role = $request->query('role'))     $query->where('role', $role);
        if ($q    = $request->query('q'))        $query->where(fn($sq) =>
            $sq->where('name', 'ilike', "%{$q}%")->orWhere('email', 'ilike', "%{$q}%")->orWhere('registration_no', 'ilike', "%{$q}%")
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
            'role'       => 'prohibited',
            'department' => 'sometimes|nullable|string',
            'status'     => 'sometimes|in:active,suspended',
        ]);

        if ($request->input('status') === 'suspended') {
            if ($user->id === $request->user()->id) return $this->fail('You cannot suspend your own account.', 409);
            if ($user->role === Roles::ADMIN && !User::where('role', Roles::ADMIN)->where('status', 'active')->where('id', '!=', $user->id)->exists())
                return $this->fail('This is the last active administrator.', 409);
        }
        // status is intentionally not globally mass-assignable on User.
        $user->forceFill($request->only(['name', 'department', 'status']))->save();

        return $this->ok(['user' => $user->fresh()]);
    }

    public function updateUserRole(Request $request, User $user): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();

        $validated = $request->validate(['role' => 'required|in:admin,staff,student,visitor']);
        $role = $validated['role'];

        // Two ways to lock everybody out of the platform are refused here rather than in a form: taking
        // your own admin away mid-session, and leaving the campus with no administrator at all. A client
        // can hide the option, but hiding is not a rule — this is.
        if ($user->id === $request->user()->id && $role !== Roles::ADMIN) {
            return $this->fail('You cannot remove your own administrator role. Ask another administrator to transfer it first.', 409, [], 'SELF_DEMOTION');
        }

        if ($user->role === Roles::ADMIN && $role !== Roles::ADMIN) {
            $remaining = User::query()->where('role', Roles::ADMIN)->where('id', '!=', $user->id)->where('status', 'active')->count();

            if ($remaining === 0) {
                return $this->fail('This is the last active administrator. Promote somebody else before demoting them.', 409, [], 'LAST_ADMIN');
            }
        }

        $before = $user->role;

        if ($before === $role) {
            return $this->ok(['user' => $user->fresh(), 'changed' => false]);
        }

        $user->update(['role' => $role]);

        DB::table('audit_logs')->insert([
            'user_id'      => $request->user()->id,
            'action'       => 'user.role.changed',
            'subject_type' => User::class,
            'subject_id'   => (string) $user->id,
            'before'       => json_encode(['role' => $before]),
            'after'        => json_encode(['role' => $role]),
            'ip_address'   => $request->ip(),
            'created_at'   => now(),
        ]);

        return $this->ok(['user' => $user->fresh(), 'changed' => true]);
    }

    public function deleteUser(Request $request, User $user): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        if ($user->id === $request->user()->id) return $this->fail('You cannot deactivate your own account.', 409);
        if ($user->role === Roles::ADMIN && !User::where('role', Roles::ADMIN)->where('status', 'active')->where('id', '!=', $user->id)->exists())
            return $this->fail('This is the last active administrator.', 409);
        $user->tokens()->delete();
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
        $scopes = [];
        foreach (['building' => Building::class, 'floor' => Floor::class, 'room' => Room::class,
            'office' => Office::class, 'course' => Course::class] as $kind => $model) {
            $scopes[$kind] = $model::orderBy('name')->get()->map(fn ($row) => [
                'id' => $row->id, 'label' => trim(($row->code ?? '') . ' · ' . $row->name, ' ·'),
            ])->values();
        }
        return $this->ok(['assignments' => $assignments, 'scopes' => $scopes,
            'people' => User::whereIn('role', ['staff', 'admin'])->orderBy('name')->get(['id', 'name', 'email'])]);
    }

    public function createStaffAssignment(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $request->validate([
            'user_id'    => 'required|uuid|exists:users,id',
            'scope_type' => 'required|in:building,floor,room,office,course',
            'scope_id'   => 'required|uuid',
            'role_in_scope' => 'nullable|string|max:100',
            'can_manage_timetable' => 'sometimes|boolean', 'can_publish_content' => 'sometimes|boolean',
            'can_call_tickets' => 'sometimes|boolean',
        ]);
        $target = User::findOrFail($request->input('user_id'));
        abort_unless(in_array($target->role, ['staff', 'admin'], true), 422, 'Choose a staff or administrator account.');
        $models = ['building' => Building::class, 'floor' => Floor::class, 'room' => Room::class, 'office' => Office::class, 'course' => Course::class];
        $model = $models[$request->input('scope_type')];
        abort_unless($model::whereKey($request->input('scope_id'))->exists(), 422, 'The selected scope does not exist.');
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
        $request->validate(['q' => 'nullable|string|max:120', 'building_id' => 'nullable|uuid', 'floor_id' => 'nullable|uuid', 'page' => 'sometimes|integer|min:1', 'per_page' => 'sometimes|integer|min:1']);
        $q = Building::withCount('floors');
        $search = trim((string) $request->query('q', ''));
        if ($search !== '') $q->where(fn ($q) => $q->where('name', 'ilike', "%{$search}%")->orWhere('code', 'ilike', "%{$search}%"));
        return $this->ok($this->paginate($q->orderBy('name')->orderBy('id'), $request, fn($b) => $b->toApiArray()));
    }

    public function createBuilding(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $b = CampusConfiguration::create('building', CampusConfiguration::validate($request, 'building'));
        return $this->ok($b->toApiArray(), 201);
    }

    public function updateBuilding(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $b = Building::findOrFail($id);
        $b->update(CampusConfiguration::validate($request, 'building', $b));
        return $this->ok($b->fresh()->toApiArray());
    }

    public function deleteBuilding(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        CampusConfiguration::remove(Building::findOrFail($id), 'building');
        return $this->ok(['deleted' => $id]);
    }

    /* ─────────────────────────────────────── floors */

    public function floors(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $request->validate(['q' => 'nullable|string|max:120', 'building_id' => 'nullable|uuid', 'floor_id' => 'nullable|uuid', 'page' => 'sometimes|integer|min:1', 'per_page' => 'sometimes|integer|min:1']);
        $q = Floor::with('building')->withCount('rooms')->when($request->query('building_id'), fn($q, $id) => $q->where('building_id', $id));
        $search = trim((string) $request->query('q', ''));
        if ($search !== '') $q->where(function ($q) use ($search) {
            $q->where('name', 'ilike', "%{$search}%")->orWhere('code', 'ilike', "%{$search}%");
            if (filter_var($search, FILTER_VALIDATE_INT, ['options' => ['min_range' => -2147483648, 'max_range' => 2147483647]]) !== false) $q->orWhere('level', (int) $search);
        });
        return $this->ok($this->paginate($q->orderBy('level')->orderBy('id'), $request, fn($f) => array_merge($f->toApiArray(), [
            'building_code' => $f->building?->code, 'building_name' => $f->building?->name, 'rooms_count' => (int) $f->rooms_count,
        ])));
    }

    public function createFloor(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $f = CampusConfiguration::create('floor', CampusConfiguration::validate($request, 'floor'));
        return $this->ok($f->toApiArray(), 201);
    }

    public function updateFloor(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $f = Floor::findOrFail($id);
        $f->update(CampusConfiguration::validate($request, 'floor', $f));
        return $this->ok($f->fresh()->toApiArray());
    }

    public function deleteFloor(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        CampusConfiguration::remove(Floor::findOrFail($id), 'floor');
        return $this->ok(['deleted' => $id]);
    }

    /* ─────────────────────────────────────── rooms */

    public function adminRooms(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $request->validate(['q' => 'nullable|string|max:120', 'building_id' => 'nullable|uuid', 'floor_id' => 'nullable|uuid', 'page' => 'sometimes|integer|min:1', 'per_page' => 'sometimes|integer|min:1']);
        $q = Room::with('floor.building')
            ->when($request->query('floor_id'), fn ($q, $id) => $q->where('floor_id', $id))
            ->when($request->query('building_id'), fn ($q, $id) => $q->whereHas('floor', fn ($q) => $q->where('building_id', $id)));
        $search = trim((string) $request->query('q', ''));
        if ($search !== '') $q->where(fn ($q) => $q->where('name', 'ilike', "%{$search}%")->orWhere('code', 'ilike', "%{$search}%"));
        return $this->ok($this->paginate($q->orderBy('code')->orderBy('id'), $request, fn($r) => array_merge($r->toApiArray(), ['building_id' => $r->floor?->building_id])));
    }

    public function createRoom(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $r = CampusConfiguration::create('room', CampusConfiguration::validate($request, 'room'));
        return $this->ok($r->toApiArray(), 201);
    }

    public function updateRoom(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $r = Room::findOrFail($id);
        $r->update(CampusConfiguration::validate($request, 'room', $r));
        return $this->ok($r->fresh()->toApiArray());
    }

    public function deleteRoom(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        CampusConfiguration::remove(Room::findOrFail($id), 'room');
        return $this->ok(['deleted' => $id]);
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

    /**
     * GET /admin/offices
     *
     * Configuration plus the live figures an administrator needs while setting that configuration: if you
     * tighten a daily capacity you want to see today's issuance move on the same screen.
     */
    public function adminOffices(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $q = Office::with('room.floor.building')->withTrashed()->when(!$request->boolean('with_deleted'), fn($q) => $q->whereNull('deleted_at'));
        return $this->ok($this->paginate($q->orderBy('name'), $request, function (Office $office) {
            $waiting = OfficeTicket::where('office_id', $office->id)->where('status', 'waiting')->count();
            $inService = OfficeTicket::where('office_id', $office->id)->where('status', 'in_service')->count();
            return array_merge($office->toApiArray(), [
                'is_open_now' => $office->isEffectivelyOpen(),
                'waiting' => $waiting,
                'in_service' => $inService,
                'daily_capacity_used' => OfficeTicket::where('office_id', $office->id)->whereDate('created_at', now())->count(),
                'estimated_wait_minutes' => $waiting * max(1, (int) ($office->avg_service_minutes ?? 10)),
            ]);
        }));
    }

    public function createOffice(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $request->validate(['code' => 'required|string|max:30|unique:offices,code', 'name' => 'required|string|max:120']);
        // Every office policy the console exposes has to arrive here, or the toggle becomes decoration.
        $o = Office::create($request->only(['code', 'name', 'description', 'room_id', 'status', 'is_open', 'opening_hours', 'phone', 'email', 'image_url', 'avg_service_minutes', 'ticket_prefix', 'concurrent_capacity', 'check_in_radius_m', 'daily_capacity', 'requires_appointment', 'requires_proximity_to_request', 'grace_period_seconds', 'service_duration_minutes', 'contact_email', 'contact_phone', 'is_active']));
        return $this->ok($o->toApiArray(), 201);
    }

    public function updateOffice(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $o = Office::findOrFail($id);
        $o->update($request->only(['code', 'name', 'description', 'room_id', 'status', 'is_open', 'opening_hours', 'phone', 'email', 'image_url', 'avg_service_minutes', 'ticket_prefix', 'concurrent_capacity', 'check_in_radius_m', 'daily_capacity', 'requires_appointment', 'requires_proximity_to_request', 'grace_period_seconds', 'service_duration_minutes', 'contact_email', 'contact_phone', 'is_active']));
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
        $request->validate([
            'office_id'   => 'required|uuid|exists:offices,id',
            'label'       => 'required|string|max:80',
            'day_of_week' => ['required', 'integer', 'between:0,6'],
            'opens_at'    => 'required|date_format:H:i',
            'closes_at'   => 'required|date_format:H:i|after:opens_at',
            'capacity'    => 'nullable|integer|min:1|max:500',
        ]);
        $w = OfficeServiceWindow::create($request->only(['office_id', 'label', 'status', 'day_of_week', 'opens_at', 'closes_at', 'capacity', 'avg_service_minutes', 'is_active', 'served_by_user_id']));
        return $this->ok($w->toApiArray(), 201);
    }

    public function updateServiceWindow(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();
        $w = OfficeServiceWindow::findOrFail($id);
        $w->update($request->only(['label', 'status', 'day_of_week', 'opens_at', 'closes_at', 'capacity', 'avg_service_minutes', 'is_active', 'served_by_user_id']));
        return $this->ok($w->fresh()->toApiArray());
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
        // The column is json, so it is decoded on the way out: the console then edits `true` and `5`
        // instead of the strings \"true\" and \"5\", and a value it saves comes back with the same type.
        $settings = DB::table('settings')->get()->map(function ($row) {
            $decoded = json_decode((string) $row->value, true);

            return [
                'key'         => $row->key,
                'value'       => json_last_error() === JSON_ERROR_NONE ? $decoded : $row->value,
                'description' => $row->description ?? null,
                'group'       => $row->group ?? 'general',
            ];
        });
        return $this->ok(['settings' => $settings]);
    }

    /**
     * PATCH /admin/settings/{key} — the only way a setting changes.
     *
     * Two rules here are the difference between a settings store and a global `$_GET`: the key must already
     * exist, so an administrator is editing something the platform understands rather than inventing a
     * name a code path will never read; and the previous value is written to the audit log beside the new
     * one, because a policy change nobody can date is a policy change nobody can undo. The value is
     * JSON-encoded rather than cast to a string, so a boolean stays a boolean and `true` does not become
     * the four characters that used to make every reader guess.
     */
    public function updateSetting(Request $request, string $key): JsonResponse
    {
        $validated = $request->validate(['value' => ['required', 'nullable']]);

        $existing = DB::table('settings')->where('key', $key)->first();

        if (! $existing) {
            return $this->fail(
                'There is no setting called ' . $key . '. Options are registered by the platform; add one through a deployment, not from the console.',
                422,
                [],
                'UNKNOWN_SETTING',
            );
        }

        $encoded = json_encode($validated['value']);

        DB::table('settings')->where('key', $key)->update([
            'value'      => $encoded,
            'updated_at' => now(),
        ]);

        DB::table('audit_logs')->insert([
            'user_id'      => $request->user()->id,
            'action'       => 'settings.updated',
            'subject_type' => 'setting',
            'subject_id'   => mb_substr($key, 0, 40),
            'before'       => json_encode(['value' => $existing->value]),
            'after'        => json_encode(['value' => $encoded]),
            'ip_address'   => $request->ip(),
            'created_at'   => now(),
        ]);

        return $this->ok(['setting' => ['key' => $key, 'value' => $validated['value']]]);
    }

    /* ─────────────────────────────────────── audit logs */

    public function auditLogs(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();

        $query = DB::table('audit_logs')
            ->leftJoin('users', 'users.id', '=', 'audit_logs.user_id')
            ->select([
                'audit_logs.id',
                'audit_logs.action',
                'audit_logs.subject_type',
                'audit_logs.subject_id',
                'audit_logs.user_id',
                'users.name as actor_name',
                'audit_logs.ip_address',
                'audit_logs.created_at',
            ])
            ->when($request->query('action'), fn($q, $action) => $q->where('audit_logs.action', $action))
            ->when($request->query('user_id'), fn($q, $id) => $q->where('audit_logs.user_id', $id))
            ->orderByDesc('audit_logs.created_at');

        return $this->ok($this->paginate($query, $request, fn($log) => [
            'id'           => $log->id,
            'action'       => $log->action,
            'subject_type' => $log->subject_type,
            'subject_id'   => $log->subject_id,
            'user_id'      => $log->user_id,
            'actor_name'   => $log->actor_name,
            'ip_address'   => $log->ip_address,
            'created_at'   => $log->created_at,
        ]));
    }

    /* ─────────────────────────────────────── roles & permissions registry */

    /**
     * GET /admin/roles
     *
     * Renders the authoritative registry (App\Support\Access\Permissions) rather than a table an
     * operator types into. That is deliberate: at this stage roles are a product decision, so the
     * screen is a *readable answer* to "who may do what, on which platform" — and the moment a
     * deployment needs custom roles, this endpoint is where the DB-backed registry is swapped in
     * without the client changing.
     */
    public function roles(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();

        $counts = [
            'student' => User::where('role', 'student')->count(),
            'staff'   => User::where('role', 'staff')->count(),
            'admin'   => User::where('role', 'admin')->count(),
            'visitor' => User::where('role', 'visitor')->count(),
        ];

        $roles = collect(['student', 'staff', 'admin'])->map(fn ($role) => [
            'code'        => $role,
            'label'       => Roles::label($role),
            'users'       => $counts[$role],
            'home_route'  => \App\Support\Access\Roles::homeRoute($role),
            'permissions' => \App\Support\Access\Permissions::forRole($role),
            'platforms'   => [
                'web'    => \App\Support\Access\Platforms::allowedPermissions($role, 'web'),
                'mobile' => \App\Support\Access\Platforms::allowedPermissions($role, 'mobile'),
            ],
        ])->values();

        return $this->ok([
            'roles'    => $roles,
            'registry' => \App\Support\Access\Permissions::registry(),
            'assignments' => [
                'total'     => StaffAssignment::count(),
                'unassigned_staff' => User::where('role', 'staff')
                    ->whereDoesntHave('staffAssignments')
                    ->count(),
            ],
        ]);
    }

    /* ─────────────────────────────────────── admin mobile monitoring */

    /**
     * GET /admin/alerts
     *
     * The whole of the administrator's mobile surface: a derived feed of conditions that need a
     * human, each with the numbers that justify it. Alerts are computed, never stored, so an alert
     * cannot outlive the state that produced it. Acknowledging writes a fingerprint so the same
     * condition stops re-firing until it changes.
     */
    /**
     * The alert feed, as data.
     *
     * Split out of the endpoint so `GET /admin/monitoring/summary` can count the same conditions the
     * alert screen shows, instead of a second copy of the rules drifting apart from the first.
     *
     * @return list<array{key: string, severity: string, title: string, detail: string, target?: string}>
     */
    /**
     * POST /admin/alerts/ack
     *
     * Body: { fingerprint, note? }. Acknowledging mutes the *condition*, not an id: a new occurrence
     * with a different fingerprint surfaces again immediately.
     */
    /**
     * GET /admin/alerts
     *
     * The alert feed is **computed from live state**, never stored. There is no `alerts` table: an
     * alert is a condition the platform notices while you look — an over-capacity line, a queue open
     * for a room that is not available, a desk closed with students still holding tickets, staff
     * accounts with no scope to operate anything, a burst of failed scans. Nothing can therefore go
     * stale, and nothing can be quietly deleted.
     *
     * What *is* stored is the human act of acknowledging: `POST /admin/alerts/ack` mutes one
     * fingerprint, and only that fingerprint. A recurrence with a new fingerprint (another hour,
     * another day, another room) surfaces again immediately.
     */
    public function alerts(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();

        $snapshot = $this->deriveAlerts();

        return $this->ok([
            'alerts'       => $snapshot,
            'counts'       => $this->alertCounts($snapshot),
            'generated_at' => now()->toIso8601String(),
        ]);
    }

    /** @return list<array{key: string, severity: string, title: string, detail: string, target?: string}> */
    private function deriveAlerts(): array
    {
        $muted = DB::table('alert_acknowledgements')->pluck('fingerprint')->all();
        $today = now()->toDateString();
        $alerts = [];

        // 1 + 2 — the line and the room must agree with each other.
        foreach (RoomQueue::with('room.floor.building')->where('is_open', true)->get() as $queue) {
            $waiting = QueueTicket::where('queue_id', $queue->id)
                ->whereIn('status', ['waiting', 'called', 'checked_in'])
                ->count();

            if ($waiting > max(1, (int) ($queue->max_capacity ?? 0))) {
                $alerts[] = [
                    'key'      => 'queue_over_capacity:' . $queue->id . ':' . $queue->room?->code,
                    'severity' => 'warning',
                    'title'    => ($queue->room?->code ?? 'Queue') . ' is past its line limit',
                    'detail'   => $waiting . ' active tickets against a maximum of ' . (int) ($queue->max_capacity ?? 0) . '.',
                    'target'   => '/admin/services',
                ];
            }

            $roomAvailable = $queue->room && $queue->room->status !== 'closed';

            if ($waiting > 0 && ! $roomAvailable) {
                $alerts[] = [
                    'key'      => 'queue_open_for_closed_room:' . $queue->id,
                    'severity' => 'critical',
                    'title'    => 'A queue is open for a room that is not available',
                    'detail'   => ($queue->room?->code ?? 'Room') . ' has ' . $waiting . ' students waiting but its status is ' . ($queue->room?->status ?? 'missing') . '.',
                    'target'   => '/admin/campus',
                ];
            }
        }

        // 3 — a desk closed with people still holding a ticket is the failure a student feels first.
        $stranded = OfficeTicket::whereIn('status', ['waiting', 'called', 'approaching', 'in_service'])
            ->whereHas('office', fn ($q) => $q->where('is_open', false)->where('status', 'active'))
            ->count();

        if ($stranded > 0) {
            $alerts[] = [
                'key'      => 'offices_closed_with_line:' . $today,
                'severity' => 'critical',
                'title'    => $stranded . ' tickets remain at closed offices',
                'detail'   => 'These tickets belong to active offices whose open switch is off. Review the remaining line and any service in progress.',
                'target'   => '/admin/services',
            ];
        }

        // 4 + 5 — controlled rooms the mobile app cannot route to, or cannot gate entry for.
        $unroutable = Room::where('requires_admission', true)->whereNull('lat')->count();
        if ($unroutable > 0) {
            $alerts[] = [
                'key'      => 'rooms_without_coordinates:' . $today,
                'severity' => 'warning',
                'title'    => $unroutable . ' admission rooms have no coordinates',
                'detail'   => 'Proximity checks and navigation cannot work for a room that is not placed on a plan.',
                'target'   => '/admin/spatial',
            ];
        }

        $noQueue = Room::where('requires_admission', true)
            ->whereDoesntHave('queue')
            ->count();

        if ($noQueue > 0) {
            $alerts[] = [
                'key'      => 'rooms_requiring_admission_without_queue:' . $today,
                'severity' => 'warning',
                'title'    => $noQueue . ' rooms demand a ticket but have no queue',
                'detail'   => 'Students cannot obtain the ticket these rooms require, so the rule blocks the door with no way through.',
                'target'   => '/admin/services',
            ];
        }

        // 6 — scope misconfiguration: an operator who is allowed nothing.
        // Only worth reporting under strict scoping: when unassigned staff fall back to the whole
        // campus, an unassigned account can still work, and the alert would be noise.
        if (config('campusflow.access.unassigned_staff_scope', 'campus') !== 'campus') {
            $unassigned = User::where('role', 'staff')
                ->where('status', 'active')
                ->whereDoesntHave('staffAssignments')
                ->count();

            if ($unassigned > 0) {
                $alerts[] = [
                    'key'      => 'staff_without_assignments:' . $today,
                    'severity' => 'critical',
                    'title'    => $unassigned . ' staff accounts cannot operate anything',
                    'detail'   => 'Strict scoping means an unassigned staff member has no queues and no offices, so sign-in leads nowhere.',
                    'target'   => '/admin/users',
                ];
            }
        }

        // 7 — a spike in rejected scans means anchors were rotated, printed over, or removed.
        $failedScans = DB::table('audit_logs')
            ->where('action', 'positioning.scan_failed')
            ->where('created_at', '>=', now()->subHour())
            ->count();

        if ($failedScans > 5) {
            $alerts[] = [
                'key'      => 'scan_failures:' . now()->format('Y-m-d-H'),
                'severity' => 'warning',
                'title'    => $failedScans . ' failed QR scans in the last hour',
                'detail'   => 'Codes on the wall are not resolving — check whether anchors were regenerated or deactivated.',
                'target'   => '/admin/spatial',
            ];
        }

        // The wire key is an opaque acknowledgement fingerprint, used unchanged by web and mobile.
        // A changed reported condition must not inherit the previous mute. This is still a snapshot:
        // an identical condition in the same bucket can match an earlier acknowledgement.
        foreach ($alerts as &$alert) {
            $condition = json_encode([$alert['severity'], $alert['title'], $alert['detail'], $alert['target'] ?? null]);
            $alert['key'] .= ':' . substr(hash('sha256', $condition), 0, 16);
        }
        unset($alert);

        return array_values(array_filter(
            $alerts,
            fn (array $alert) => ! in_array($alert['key'], $muted, true)
        ));
    }

    /** @return array{critical: int, warning: int, acknowledged: int} */
    private function alertCounts(?array $snapshot = null): array
    {
        $alerts = collect($snapshot ?? $this->deriveAlerts());

        return [
            'critical'     => $alerts->where('severity', 'critical')->count(),
            'warning'      => $alerts->where('severity', 'warning')->count(),
            'acknowledged' => DB::table('alert_acknowledgements')->count(),
        ];
    }

    public function acknowledgeAlert(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();

        $validated = $request->validate([
            'fingerprint' => ['required', 'string', 'max:160'],
            'note'        => ['nullable', 'string', 'max:300'],
        ]);

        DB::table('alert_acknowledgements')->updateOrInsert(
            ['fingerprint' => $validated['fingerprint']],
            [
                'type'            => explode(':', $validated['fingerprint'])[0],
                'acknowledged_by' => $request->user()->id,
                'note'            => $validated['note'] ?? null,
                'acknowledged_at' => now(),
            ],
        );

        return $this->ok(['acknowledged' => $validated['fingerprint']], 201);
    }

    /** GET /admin/monitoring/summary — the four numbers an administrator checks from a phone. */
    public function monitoringSummary(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();

        $today = now()->startOfDay();

        $issued = QueueTicket::where('created_at', '>=', $today)->count();
        $served = QueueTicket::where('status', 'admitted')->where('admitted_at', '>=', $today)->count();
        $noShows = QueueTicket::where('status', 'no_show')->where('created_at', '>=', $today)->count();

        return $this->ok([
            'generated_at' => now()->toIso8601String(),
            'queues' => [
                'open'      => RoomQueue::where('is_open', true)->count(),
                'waiting_now' => QueueTicket::where('status', 'waiting')->count(),
                'issued_today' => $issued,
                'served_today' => $served,
                'no_show_rate_today' => $issued > 0 ? round($noShows / $issued, 3) : null,
            ],
            'offices' => [
                'open'   => Office::where('is_open', true)->count(),
                'waiting_now' => OfficeTicket::where('status', 'waiting')->count(),
                'completed_today' => OfficeTicket::where('status', 'completed')->where('completed_at', '>=', $today)->count(),
            ],
            'platform' => [
                'active_queues'    => RoomQueue::where('is_open', true)->count(),
                'navigation_today' => NavigationSession::where('created_at', '>=', $today)->count(),
                'unacknowledged_alerts' => count($this->deriveAlerts()),
                'users' => User::count(),
            ],
        ]);
    }

    /* ─────────────────────────────────────── geofences */

    public function geofences(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();

        $query = \App\Models\Geofence::with(['building', 'floor', 'room'])
            ->when($request->query('building_id'), fn($q, $id) => $q->where('building_id', $id))
            ->when($request->query('type'), fn($q, $type) => $q->where('type', $type));

        return $this->ok($this->paginate($query->orderBy('name'), $request, fn($g) => $g->toApiArray()));
    }

    public function createGeofence(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();

        $validated = $request->validate([
            'name'       => ['required', 'string', 'max:120'],
            'type'       => ['required', 'string', 'in:building,floor,room,campus_zone,parking,outdoor_area'],
            'building_id'=> ['nullable', 'uuid', 'exists:buildings,id'],
            'floor_id'   => ['nullable', 'uuid', 'exists:floors,id'],
            'room_id'    => ['nullable', 'uuid', 'exists:rooms,id'],
            'center_lat' => ['nullable', 'numeric', 'between:-90,90'],
            'center_lng' => ['nullable', 'numeric', 'between:-180,180'],
            'radius_m'   => ['nullable', 'numeric', 'min:1', 'max:5000'],
            'polygon_json' => ['nullable', 'array'],
            'is_active'  => ['sometimes', 'boolean'],
        ]);

        if (($validated['radius_m'] ?? null) === null && empty($validated['polygon_json'])) {
            return response()->json([
                'success' => false,
                'message' => 'A geofence needs either a radius (circle mode) or a polygon_json (polygon mode).',
                'code'    => 'GEOFENCE_SHAPE_REQUIRED',
            ], 422);
        }

        $geofence = \App\Models\Geofence::create($validated);

        return $this->ok($geofence->toApiArray(), 201);
    }

    public function updateGeofence(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();

        $geofence = \App\Models\Geofence::findOrFail($id);

        $geofence->update($request->only([
            'name', 'type', 'building_id', 'floor_id', 'room_id',
            'center_lat', 'center_lng', 'radius_m', 'polygon_json', 'is_active',
        ]));

        return $this->ok($geofence->fresh()->toApiArray());
    }

    public function deleteGeofence(Request $request, string $id): JsonResponse
    {
        if (!$this->requireAdmin($request)) return $this->forbidden();

        $geofence = \App\Models\Geofence::findOrFail($id);
        $geofence->delete();

        return response()->json(['success' => true]);
    }
}
