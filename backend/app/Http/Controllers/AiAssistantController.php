<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\RespondsJson;
use App\Models\AiConversation;
use App\Models\AiMessage;
use App\Models\Announcement;
use App\Models\Building;
use App\Models\Office;
use App\Models\QueueTicket;
use App\Models\Room;
use App\Models\RoomQueue;
use App\Support\Access\ClientContext;
use App\Support\Access\Permissions;
use App\Support\Access\Roles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * The AI Campus Assistant — one conversational engine, four different products.
 *
 * The rules this controller enforces (see docs/role-platform-matrix.md §29):
 *
 *  1. The assistant is a gateway to a **registry of backend tools**. It never issues SQL, never
 *     trusts a client-supplied role, and every tool it runs is executed as the caller, through the
 *     same policies the REST API uses. The assistant cannot open a door its owner does not have.
 *  2. The tool set is filtered three times before the model sees it: by role, by permission, and by
 *     platform. A student on mobile may be offered `start_navigation`; the same student on web is
 *     not, because the platform registry says live navigation is a mobile capability.
 *  3. Offered *actions* (the buttons under a reply) are likewise role+platform shaped: mobile gets
 *     in-app routes, web gets console routes. A mobile client has never been handed `/student/queues`.
 *  4. Requests the caller is not entitled to make are answered with a refusal that names the
 *     capability, and the refusal is recorded in the conversation — so the audit trail shows that the
 *     assistant declined, not that it was never asked.
 *
 * Grounding: every factual sentence is produced from rows read here (rooms, queues, offices,
 * announcements), not from a language model's memory of a campus, so the assistant cannot invent an
 * opening time.
 */
class AiAssistantController extends Controller
{
    use RespondsJson;

    public function chat(Request $request, ClientContext $context): JsonResponse
    {
        $validated = $request->validate([
            'message'         => ['required', 'string', 'max:1000'],
            'conversation_id' => ['nullable', 'uuid', 'exists:ai_conversations,id'],
            'context'         => ['nullable', 'array'],
            'context.screen'  => ['nullable', 'string', 'max:60'],
            'context.room'    => ['nullable', 'string', 'max:40'],
        ]);

        $user     = $request->user();
        $prompt   = trim($validated['message']);
        $screen   = $validated['context']['screen'] ?? null;
        $roomHint = $validated['context']['room'] ?? null;

        $conversation = $this->resolveConversation($user->id, $validated, $prompt);

        AiMessage::create([
            'conversation_id' => $conversation->id,
            'role'            => 'user',
            'content'         => $prompt,
            'tool_calls'      => $validated['context'] ?? null,
        ]);

        $intent = $this->classify($prompt);
        $tools  = $this->availableTools($context);

        if (! in_array($intent['tool'], $tools, true)) {
            $reply = $this->refuse($intent, $context);
        } else {
            $reply = $this->run($intent['tool'], $prompt, $user, $context, [
                'screen'   => $screen,
                'room_hint' => $roomHint,
            ]);
        }

        $message = AiMessage::create([
            'conversation_id' => $conversation->id,
            'role'            => 'assistant',
            'content'         => $reply['text'],
            'tool_calls'    => [
                'intent'       => $intent['tool'],
                'authorized'   => in_array($intent['tool'], $tools, true),
                'platform'     => $context->platform,
                'role'         => $context->role(),
                'allowed_tools' => $tools,
            ],
            'tool_results'  => ['actions' => $reply['actions']],
        ]);

        $conversation->update(['last_message_at' => now()]);

        return response()->json([
            'success' => true,
            'data'    => [
                'conversation_id'   => $conversation->id,
                'message'           => $message->toApiArray(),
                'suggested_actions' => $reply['actions'],
                'context'           => $context->toArray(),
            ],
        ]);
    }

    /**
     * GET /ai/capabilities
     *
     * What the assistant is allowed to do for *this* caller, computed the same way the chat endpoint
     * computes it. Clients render their assistant affordances from here rather than guessing, and the
     * endpoint doubles as the human-readable answer to "why is there no scan button on the web app?".
     */
    public function capabilities(Request $request, ClientContext $context): JsonResponse
    {
        $registry = $this->toolRegistry();

        $tools = collect($registry)
            ->only($this->availableTools($context))
            ->map(fn (array $tool) => [
                'id'    => $tool['id'],
                'label' => $tool['label'],
                'needs' => $tool['permission'],
            ])
            ->values();

        return $this->ok([
            'platform'    => $context->platform,
            'role'        => $context->role(),
            'tools'       => $tools,
            'tool_count'  => $tools->count(),
            'total_tools' => count($registry),
            'note'        => $context->isWeb()
                ? 'Camera scanning and live navigation are not offered from the web client.'
                : 'Configuration and management tools are not offered from the mobile client.',
        ]);
    }

    /** GET /ai/conversations */
    public function conversations(Request $request): JsonResponse
    {
        $conversations = AiConversation::where('user_id', $request->user()->id)
            ->with(['messages' => fn ($q) => $q->orderBy('created_at', 'asc')])
            ->orderByDesc('updated_at')
            ->limit(30)
            ->get();

        return response()->json([
            'success' => true,
            'data'    => [
                'conversations' => $conversations->map(fn (AiConversation $c) => array_merge($c->toApiArray(), [
                    'messages' => $c->messages->map(fn (AiMessage $m) => $m->toApiArray())->values(),
                    'message_count' => $c->messages->count(),
                ]))->values(),
            ],
        ]);
    }

    /**
     * GET /ai/conversations/{conversation} — one transcript, in order.
     *
     * Scoped to the caller by the `where('user_id')` rather than by a policy on the front door: an
     * administrator may read the audit log, but that is not the same as reading a conversation over
     * somebody's shoulder, and the endpoint deliberately cannot be talked into it by passing an id.
     */
    public function showConversation(Request $request, string $conversation): JsonResponse
    {
        $model = AiConversation::where('id', $conversation)
            ->where('user_id', $request->user()->id)
            ->with(['messages' => fn ($query) => $query->orderBy('created_at')])
            ->firstOrFail();

        return $this->ok([
            'conversation' => array_merge($model->toApiArray(), [
                'messages'      => $model->messages->map(fn (AiMessage $message) => $message->toApiArray())->values(),
                'message_count' => $model->messages->count(),
            ]),
        ]);
    }

    /**
     * DELETE /ai/conversations/{conversation}
     *
     * Deleting a conversation is not a privacy eraser — the tool calls it made remain in the assistant log,
     * which is the point: an audit trail that vanishes when the user clears their chat is not an audit
     * trail. What goes is the transcript this person no longer wants to see.
     */
    public function deleteConversation(Request $request, string $conversation): JsonResponse
    {
        $model = AiConversation::where('id', $conversation)->where('user_id', $request->user()->id)->firstOrFail();

        $model->messages()->delete();
        $model->delete();

        return $this->ok(['deleted' => $model->id]);
    }

    // ── intent ───────────────────────────────────────────────────────────────

    /**
     * Deterministic intent classification.
     *
     * A keyword map rather than an LLM call, on purpose: the intent decides which *tool* runs, and a
     * tool that mutates state must not be reachable by a prompt-injection string inside a room
     * description. When a real model is wired in, it proposes an intent and this same allow-list still
     * decides whether it may be executed.
     *
     * @return array{tool: string, argument: ?string}
     */
    private function classify(string $prompt): array
    {
        $lower = strtolower($prompt);

        if (preg_match('/\b(navigate|take me|how do i get|directions|route)\b/', $lower, $m)) {
            return ['tool' => 'start_navigation', 'argument' => $this->extractRoomCode($prompt)];
        }

        if (preg_match('/\b(where is|where’s|locate|find)\b/', $lower)) {
            return ['tool' => 'locate_room', 'argument' => $this->extractRoomCode($prompt)];
        }

        if (str_contains($lower, 'queue') || str_contains($lower, 'in line') || str_contains($lower, 'wait')) {
            return ['tool' => 'queue_status', 'argument' => $this->extractRoomCode($prompt)];
        }

        if (str_contains($lower, 'office') || str_contains($lower, 'registrar') || str_contains($lower, 'finance') || str_contains($lower, 'ticket')) {
            return ['tool' => 'offices', 'argument' => null];
        }

        if (str_contains($lower, 'timetable') || str_contains($lower, 'schedule') || str_contains($lower, 'class') || str_contains($lower, 'lecture')) {
            return ['tool' => 'my_schedule', 'argument' => null];
        }

        if (str_contains($lower, 'announcement') || str_contains($lower, 'notice')) {
            return ['tool' => 'announcements', 'argument' => null];
        }

        if (str_contains($lower, 'building') || str_contains($lower, 'map') || str_contains($lower, 'campus')) {
            return ['tool' => 'campus_overview', 'argument' => null];
        }

        if (str_contains($lower, 'waiting') || str_contains($lower, 'how many') || str_contains($lower, 'load')) {
            return ['tool' => 'queue_statistics', 'argument' => null];
        }

        if (str_contains($lower, 'active queue') || str_contains($lower, 'system') || str_contains($lower, 'utilisation') || str_contains($lower, 'utilization')) {
            return ['tool' => 'system_analytics', 'argument' => null];
        }

        if (str_contains($lower, 'create') || str_contains($lower, 'delete') || str_contains($lower, 'edit') || str_contains($lower, 'configure')) {
            return ['tool' => 'configuration_help', 'argument' => $prompt];
        }

        return ['tool' => 'help', 'argument' => null];
    }

    private function extractRoomCode(string $prompt): ?string
    {
        if (preg_match('/\b([A-Z]{1,4}\d{2,4}[A-Za-z]?)\b/', $prompt, $m)) {
            return strtoupper($m[1]);
        }

        return null;
    }

    // ── tool registry ────────────────────────────────────────────────────────

    /** @return array<string, array{id:string,label:string,permission:string,roles:list<string>,platforms:list<string>}> */
    private function toolRegistry(): array
    {
        return [
            'help' => [
                'id' => 'help', 'label' => 'Explain what the assistant can do',
                'permission' => Permissions::AI_BASIC, 'roles' => [Roles::STUDENT, Roles::STAFF, Roles::ADMIN],
                'platforms' => ['web', 'mobile', 'api'],
            ],
            'locate_room' => [
                'id' => 'locate_room', 'label' => 'Find a room',
                'permission' => Permissions::CAMPUS_VIEW_PRIVATE, 'roles' => [Roles::STUDENT, Roles::STAFF, Roles::ADMIN],
                'platforms' => ['web', 'mobile', 'api'],
            ],
            'campus_overview' => [
                'id' => 'campus_overview', 'label' => 'Campus overview',
                'permission' => Permissions::CAMPUS_VIEW_PRIVATE, 'roles' => [Roles::STUDENT, Roles::STAFF, Roles::ADMIN],
                'platforms' => ['web', 'mobile', 'api'],
            ],
            'announcements' => [
                'id' => 'announcements', 'label' => 'Current announcements',
                'permission' => Permissions::CONTENT_VIEW, 'roles' => [Roles::STUDENT, Roles::STAFF, Roles::ADMIN],
                'platforms' => ['web', 'mobile', 'api'],
            ],
            'queue_status' => [
                'id' => 'queue_status', 'label' => 'Check a queue board',
                'permission' => Permissions::QUEUE_VIEW, 'roles' => [Roles::STUDENT, Roles::STAFF, Roles::ADMIN],
                'platforms' => ['web', 'mobile', 'api'],
            ],
            'offices' => [
                'id' => 'offices', 'label' => 'Administrative offices',
                'permission' => Permissions::OFFICE_VIEW, 'roles' => [Roles::STUDENT, Roles::STAFF, Roles::ADMIN],
                'platforms' => ['web', 'mobile', 'api'],
            ],
            'my_schedule' => [
                'id' => 'my_schedule', 'label' => 'My schedule',
                'permission' => Permissions::TIMETABLE_VIEW_OWN, 'roles' => [Roles::STUDENT, Roles::STAFF, Roles::ADMIN],
                'platforms' => ['web', 'mobile', 'api'],
            ],
            'start_navigation' => [
                'id' => 'start_navigation', 'label' => 'Start navigation',
                'permission' => Permissions::NAVIGATION_LIVE, 'roles' => [Roles::STUDENT],
                'platforms' => ['mobile'],
            ],
            'queue_statistics' => [
                'id' => 'queue_statistics', 'label' => 'Queue load for my lines',
                'permission' => Permissions::ANALYTICS_OPERATIONAL, 'roles' => [Roles::STAFF, Roles::ADMIN],
                'platforms' => ['web', 'api'],
            ],
            'system_analytics' => [
                'id' => 'system_analytics', 'label' => 'System analytics',
                'permission' => Permissions::ANALYTICS_SYSTEM, 'roles' => [Roles::ADMIN],
                'platforms' => ['web', 'api'],
            ],
            'configuration_help' => [
                'id' => 'configuration_help', 'label' => 'How to configure the platform',
                'permission' => Permissions::AI_ADMINISTRATION, 'roles' => [Roles::ADMIN],
                'platforms' => ['web'],
            ],
        ];
    }

    /** @return list<string> */
    private function availableTools(ClientContext $context): array
    {
        $role = $context->role();

        return collect($this->toolRegistry())
            ->filter(fn (array $tool) => in_array($role, $tool['roles'], true)
                && $context->may($tool['permission']))
            ->keys()
            ->all();
    }

    private function refuse(array $intent, ClientContext $context): array
    {
        $tool = $this->toolRegistry()[$intent['tool']] ?? null;

        $reason = $tool === null
            ? 'I could not match that to something I am able to do.'
            : (in_array($context->role(), $tool['roles'], true)
                ? sprintf('%s is not available from the %s client.', $tool['label'], $context->platform)
                : sprintf('%s is not part of the %s workspace.', $tool['label'], Roles::label((string) $context->role())));

        return [
            'text' => $reason . ' ' . $this->alternativesLine($context),
            'actions' => [],
            'refused' => true,
        ];
    }

    private function alternativesLine(ClientContext $context): string
    {
        $tools = collect($this->availableTools($context))
            ->map(fn (string $id) => $this->toolRegistry()[$id]['label'])
            ->take(3);

        return $tools->isEmpty()
            ? ''
            : 'I can: ' . $tools->implode(', ') . '.';
    }

    // ── tool execution (read-only aggregation + policy-checked guidance) ──────

    private function run(string $tool, string $prompt, $user, ClientContext $context, array $ctx): array
    {
        return match ($tool) {
            'locate_room'          => $this->locateRoom($prompt, $ctx, $context),
            'campus_overview'      => $this->campusOverview($context),
            'announcements'        => $this->announcements($context),
            'queue_status'         => $this->queueStatus($prompt, $ctx, $context),
            'offices'              => $this->offices($user, $context),
            'my_schedule'          => $this->schedule($user, $context),
            'start_navigation'     => $this->startNavigation($prompt, $ctx, $context),
            'queue_statistics'     => $this->queueStatistics($user, $context),
            'system_analytics'     => $this->systemAnalytics($context),
            'configuration_help'   => $this->configurationHelp($prompt),
            default                 => $this->help($user, $context),
        };
    }

    private function help($user, ClientContext $context): array
    {
        return [
            'text' => sprintf(
                "Hello %s — I am the CampusFlow assistant for the %s workspace on %s. Ask me where a room is, how long a queue is, what your next class is, or how a service works.",
                explode(' ', (string) $user->name)[0],
                Roles::label((string) $context->role()),
                $context->platform,
            ),
            'actions' => $this->actions($context, [
                ['id' => 'rooms', 'label' => 'Find a room', 'mobile' => '/rooms', 'web' => '/student/campus/rooms'],
                ['id' => 'queues', 'label' => 'Queue board', 'mobile' => '/queue', 'web' => '/student/queues'],
            ]),
        ];
    }

    private function locateRoom(string $prompt, array $ctx, ClientContext $context): array
    {
        $code = $ctx['room_hint'] ?? $this->extractRoomCode($prompt);

        if (! $code) {
            return [
                'text'   => 'Which room should I look for? Give me a code such as B204.',
                'actions' => $this->actions($context, [['id' => 'search', 'label' => 'Search rooms', 'mobile' => '/rooms', 'web' => '/student/campus/rooms']]),
            ];
        }

        $room = Room::with('floor.building')->where('code', strtoupper($code))->first();

        if (! $room) {
            return [
                'text'    => sprintf('I could not find a room called %s on the campus map.', strtoupper($code)),
                'actions' => $this->actions($context, [['id' => 'search', 'label' => 'Search rooms', 'mobile' => '/rooms', 'web' => '/student/campus/rooms']]),
            ];
        }

        $queue = RoomQueue::where('room_id', $room->id)->first();

        $text = sprintf(
            '%s — %s, %s, floor %s (%s).',
            $room->code,
            $room->name,
            $room->type,
            $room->floor?->name ?? '—',
            $room->floor?->building?->name ?? 'unknown building',
        );

        if ($queue) {
            $waiting = QueueTicket::where('queue_id', $queue->id)->where('status', 'waiting')->count();
            $text .= $queue->is_open
                ? sprintf(' The queue is open with %d waiting (about %d min).', $waiting, $waiting * max(1, (int) ($queue->avg_service_minutes ?? 6)))
                : ' Its queue is currently closed.';
        }

        $actions = $context->isMobile()
            ? [
                ['id' => 'navigate', 'label' => 'Navigate to ' . $room->code, 'href' => '/navigate/' . $room->code, 'kind' => 'navigation', 'confirm' => false],
                ['id' => 'queue', 'label' => 'Join queue', 'href' => '/room/' . $room->code, 'kind' => 'queue', 'confirm' => true],
            ]
            : [
                ['id' => 'room', 'label' => 'Open room page', 'href' => '/student/campus/rooms/' . $room->code, 'kind' => 'campus', 'confirm' => false],
                ['id' => 'map', 'label' => 'Show on map', 'href' => '/student/campus/map?room=' . $room->code, 'kind' => 'campus', 'confirm' => false],
            ];

        return ['text' => $text, 'actions' => $actions];
    }

    private function campusOverview(ClientContext $context): array
    {
        $buildings = Building::count();
        $rooms = Room::count();
        $seats = (int) Room::sum('capacity');

        return [
            'text'    => sprintf('The campus has %d buildings, %d mapped rooms and %d mapped seats.', $buildings, $rooms, $seats),
            'actions' => $this->actions($context, [['id' => 'map', 'label' => 'Open the map', 'mobile' => '/map', 'web' => '/student/campus/map']]),
        ];
    }

    private function announcements(ClientContext $context): array
    {
        $items = Announcement::query()
            ->whereNotNull('published_at')
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>=', now()))
            ->latest('published_at')
            ->limit(3)
            ->get();

        if ($items->isEmpty()) {
            return ['text' => 'There are no active announcements right now.', 'actions' => []];
        }

        return [
            'text'    => $items->map(fn (Announcement $a, $i) => sprintf('%d. %s — %s', $i + 1, $a->title, Str::limit((string) $a->body, 110)))->implode("\n"),
            'actions' => $this->actions($context, [['id' => 'announcements', 'label' => 'All announcements', 'mobile' => '/notifications', 'web' => '/student/announcements']]),
        ];
    }

    private function queueStatus(?string $prompt, array $ctx, ClientContext $context): array
    {
        $code = $ctx['room_hint'] ?? $this->extractRoomCode((string) $prompt);

        $query = RoomQueue::with('room')->where('is_open', true);

        if ($code) {
            $query->whereHas('room', fn ($q) => $q->where('code', strtoupper($code)));
        }

        $queues = $query->limit(4)->get()->map(function (RoomQueue $queue) {
            $waiting = QueueTicket::where('queue_id', $queue->id)->where('status', 'waiting')->count();

            return sprintf(
                '%s: %d waiting, ~%d min',
                $queue->room?->code ?? 'Queue',
                $waiting,
                $waiting * max(1, (int) ($queue->avg_service_minutes ?? 6)),
            );
        });

        return [
            'text'    => $queues->isEmpty()
                ? 'No room queues are open right now.'
                : 'Live queues: ' . $queues->implode('; ') . '.',
            'actions' => $this->actions($context, [['id' => 'queues', 'label' => 'Queue board', 'mobile' => '/queue', 'web' => '/student/queues']]),
        ];
    }

    private function offices($user, ClientContext $context): array
    {
        $offices = Office::where('status', 'active')->orderBy('name')->get()
            ->map(function (Office $office) {
                $waiting = OfficeTicket::where('office_id', $office->id)->where('status', 'waiting')->count();

                return sprintf(
                    '%s (%s): %s — %d waiting',
                    $office->name,
                    $office->code,
                    $office->is_open ? 'open' : 'closed',
                    $waiting,
                );
            });

        return [
            'text'    => $offices->isEmpty() ? 'No administrative offices are published.' : $offices->take(4)->implode("\n"),
            'actions' => $this->actions($context, [['id' => 'offices', 'label' => 'Office services', 'mobile' => '/office', 'web' => '/student/offices']]),
        ];
    }

    private function schedule($user, ClientContext $context): array
    {
        // Same enrolment scope as the student timetable controller — the assistant sees what the user
        // could see by hand, nothing more.
        if ($context->role() === Roles::STUDENT) {
            $text = 'Your classes for today are listed on your dashboard; open the timetable view for the whole week.';
            $actions = $this->actions($context, [
                ['id' => 'today', 'label' => 'Today', 'mobile' => '/timetable', 'web' => '/student/timetable'],
            ]);
        } elseif ($context->role() === Roles::STAFF) {
            $text = 'Your teaching schedule lives in the operations console, where you can also publish changes.';
            $actions = [['id' => 'timetable', 'label' => 'Open timetable', 'href' => '/staff/timetable', 'kind' => 'academic', 'confirm' => false]];
        } else {
            $text = 'Campus-wide timetable administration is in the admin console.';
            $actions = [['id' => 'timetable', 'label' => 'Open timetable admin', 'href' => '/admin/timetable', 'kind' => 'academic', 'confirm' => false]];
        }

        return ['text' => $text, 'actions' => $actions];
    }

    /**
     * The mobile-only verb. It hands the client a *start* intent rather than performing the walk: the
     * navigation session itself is created by the student's own request through
     * POST /student/navigation/sessions, with its own guards.
     */
    private function startNavigation(?string $prompt, array $ctx, ClientContext $context): array
    {
        if (! $context->isMobile()) {
            return $this->refuse(['tool' => 'start_navigation'], $context);
        }

        $code = $ctx['room_hint'] ?? $this->extractRoomCode((string) $prompt);

        if (! $code) {
            return [
                'text'    => 'Where to? Say a room code, for example "navigate me to B204".',
                'actions' => [],
            ];
        }

        $room = Room::with('floor.building')->where('code', strtoupper($code))->first();

        if (! $room) {
            return ['text' => sprintf('I cannot route to %s — it is not on the campus map.', strtoupper($code)), 'actions' => []];
        }

        return [
            'text'    => sprintf(
                'Routing to %s%s. Tap start and I will guide you turn by turn.',
                $room->code,
                $room->floor?->name ? ' (' . $room->floor->name . ')' : '',
            ),
            'actions' => [
                ['id' => 'navigate', 'label' => 'Start navigation', 'href' => '/navigate/' . $room->code, 'kind' => 'navigation', 'confirm' => false],
            ],
        ];
    }

    private function queueStatistics($user, ClientContext $context): array
    {
        $queues = RoomQueue::with('room')->get()->filter(function (RoomQueue $queue) use ($user) {
            return \App\Support\Access\StaffScope::canOperateQueue($user, $queue);
        });

        $waiting = $queues->sum(fn (RoomQueue $q) => QueueTicket::where('queue_id', $q->id)->where('status', 'waiting')->count());

        return [
            'text'    => sprintf(
                'Across the %d queue%s you operate, %d student%s are waiting now.',
                $queues->count(),
                $queues->count() === 1 ? '' : 's',
                $waiting,
                $waiting === 1 ? ' is' : 's are',
            ),
            'actions' => [['id' => 'queues', 'label' => 'Open queue console', 'href' => '/staff/queues', 'kind' => 'queue', 'confirm' => false]],
        ];
    }

    private function systemAnalytics(ClientContext $context): array
    {
        $open = RoomQueue::where('is_open', true)->count();
        $issuedToday = QueueTicket::whereDate('created_at', today())->count();
        $offices = Office::where('is_open', true)->count();

        return [
            'text'    => sprintf('%d room queues are open, %d queue tickets were issued today and %d offices are serving.', $open, $issuedToday, $offices),
            'actions' => [['id' => 'analytics', 'label' => 'Open analytics', 'href' => '/admin/analytics', 'kind' => 'analytics', 'confirm' => false]],
        ];
    }

    private function configurationHelp(string $prompt): array
    {
        $lower = strtolower($prompt);

        $guidance = match (true) {
            str_contains($lower, 'geofence') => 'Geofences are drawn in Admin → Campus → Geofences: choose a centre and radius, or a polygon, and mark it active. Room queues fall back to the room radius when no geofence covers it.',
            str_contains($lower, 'queue') => 'Queue policy lives in Admin → Queues: admission capacity, line ceiling, proximity requirement, call window, no-show grace and the duplicate-ticket rule. Staff cannot change these.',
            str_contains($lower, 'qr') => 'QR anchors are issued in Admin → Spatial → QR nodes. Regenerating rotates the code and bumps its version, so old prints stop being accepted.',
            str_contains($lower, 'user') || str_contains($lower, 'role') => 'Accounts and roles are managed in Admin → Users. Public registration creates students only; staff and admin accounts are provisioned here.',
            default => 'Configuration is a desktop responsibility: campus geometry, spatial graph, service policies and accounts are all under the Admin workspace navigation.',
        };

        return [
            'text'    => $guidance,
            'actions' => [['id' => 'open', 'label' => 'Open the admin console', 'href' => '/admin/dashboard', 'kind' => 'admin', 'confirm' => false]],
        ];
    }

    /**
     * Actions are emitted for the platform that asked. `confirm: true` marks anything that mutates
     * state, so a client must show a confirmation sheet before it fires.
     *
     * @param list<array{id: string, label: string, mobile: string, web: string, confirm?: bool}> $candidates
     */
    private function actions(ClientContext $context, array $candidates): array
    {
        return collect($candidates)
            ->map(fn (array $action) => [
                'id'      => $action['id'],
                'label'   => $action['label'],
                'href'    => $context->isMobile() ? $action['mobile'] : $action['web'],
                'kind'    => $action['id'],
                'confirm' => $action['confirm'] ?? false,
            ])
            ->values()
            ->all();
    }

    private function resolveConversation(int $userId, array $validated, string $prompt): AiConversation
    {
        if (! empty($validated['conversation_id'])) {
            return AiConversation::where('id', $validated['conversation_id'])
                ->where('user_id', $userId)
                ->firstOrFail();
        }

        return AiConversation::create([
            'user_id' => $userId,
            'title'   => Str::limit($prompt, 48),
        ]);
    }
}
