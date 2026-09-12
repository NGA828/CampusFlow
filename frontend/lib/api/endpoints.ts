/**
 * Typed API surface, organised the same way the backend is: by **domain**, and inside each
 * domain by **role workspace**.
 *
 * There is deliberately no `universalApi`, and no group here that re-reads the signed-in role and
 * changes shape. `publicApi` is what a visitor may read with no token at all. `campusApi` is the
 * shared, read-only campus truth every authenticated role consults (rooms, floors, plans,
 * availability) — it is the same *data*, not the same *screen*, which is why it may be shared.
 * `studentApi`, `staffApi` and `adminApi` are the verbs each role performs, and they map 1:1 onto
 * `/api/v1/student/*`, `/api/v1/staff/*` and `/api/v1/admin/*`. A student token physically cannot
 * call anything in `staffApi`, because the route tree rejects it before the controller runs.
 *
 * Every screen imports from here — no component talks to `fetch` directly, and no URL is written twice.
 */
import { api, ApiError, newIdempotencyKey, request } from './client';
import type {
  AdminAlert,
  AdminDashboard,
  AdminMonitoring,
  AdminOfficeRow,
  AdminRoleRegistry,
  Role,
  AdminUser,
  AiConversation,
  AiMessage,
  AiReply,
  AnalyticsOverview,
  Announcement,
  AuditLogRow,
  Building,
  CampusEvent,
  Course,

  Enrollment,
  EventsPayload,
  Floor,
  FloorPlanPayload,
  Geofence,
  MapPayload,
  NavigationEdge,
  NavigationNode,
  NotificationRow,
  Office,
  OfficeLineRow,
  OfficeSummary,
  OfficeTicketView,
  PageMeta,
  Paginated,
  Position,
  QrNode,
  QueueLineRow,
  QueueListItem,
  QueueSnapshot,
  QueueTicket,
  QueueTicketView,
  Room,
  RoomDetail,
  RoomQueueConfig,
  Route,
  ServiceWindow,
  SessionInfo,
  Setting,
  StudentDashboard,
  StudentToday,
  StaffCourseOption,
  AiCapabilities,
  StaffDashboard,
  StaffRoomOption,
  StaffTimetableRow,
  StaffOfficeDetail,
  StaffQueueDetail,
  Term,
  TimetableEntry,
  TimetableWeek,
  User,
} from './types';

export interface ListQuery {
  page?: number;
  per_page?: number;
  q?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  [key: string]: string | number | boolean | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function arrayOrEmpty<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/* ----------------------------------------------------------------------- auth */

export const authApi = {
  register: (body: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    role?: 'student' | 'staff';
    registration_no?: string;
    department?: string;
  }) =>
    api.post<SessionInfo>('/auth/register', body, { auth: false }),
  login: (body: { email: string; password: string }) =>
    request<SessionInfo>('/auth/login', { method: 'POST', body, auth: false }),
  logout: () => api.post<{ revoked: boolean }>('/auth/logout'),
  me: () => api.get<{ user: User; assignments: User['assignments'] }>('/me'),
  updateProfile: (body: { name?: string; phone?: string | null; department?: string | null; avatar_url?: string | null }) =>
    api.patch<{ user: User }>('/me', body),
  changePassword: (body: { current_password: string; password: string }) => api.put<{ changed: boolean }>('/auth/password', body),
  forgotPassword: (body: { email: string }) =>
    request<{ sent: boolean; reset_token?: string; message?: string }>('/auth/forgot-password', { method: 'POST', body, auth: false }),
  resetPassword: (body: { token: string; password: string }) =>
    request<{ reset: boolean }>('/auth/reset-password', { method: 'POST', body, auth: false }),
};

/* -------------------------------------------------------------------- student */

/* -------------------------------------------------------------------- account */

/**
 * The shared account surface: this person's profile, notification reads and push devices.
 *
 * It used to also expose `dashboard()`, `timetable()` and the active-ticket lookups, which resolved the
 * caller's role server-side and returned a different payload to each role. That is exactly the
 * "one app, same features everywhere" pattern this restructure removes — the payload those screens need
 * now comes from the role group below, so a screen can only ask for what its role actually owns.
 */
export const meApi = {
  profile: () => api.get<{ user: User; assignments: User['assignments'] }>('/me'),
  updateProfile: (body: { name?: string; phone?: string | null; department?: string | null; avatar_url?: string | null }) =>
    api.patch<{ user: User }>('/me', body),
  notifications: (query: ListQuery = {}) => api.get<{ items: NotificationRow[]; meta: PageMeta; unread: number }>('/me/notifications', { query }),
  readNotification: (id: string) => api.post<{ unread: number }>(`/me/notifications/${id}/read`),
  readAllNotifications: () => api.post<{ unread: number }>('/me/notifications/read-all'),
  registerDevice: (body: { token: string; platform: 'ios' | 'android' | 'web' }) => api.post<{ registered: boolean }>('/me/devices', body),
};

/* -------------------------------------------------------------------- student */

/**
 * Student web + student mobile. Every call is `role:student` on the server: staff and admin tokens
 * get 403 ROLE_NOT_PERMITTED from these paths, so a student payload can never leak into an operator
 * screen by accident.
 */
export const studentApi = {
  dashboard: () => api.get<StudentDashboard>('/student/dashboard'),
  timetable: (week?: string) => api.get<TimetableWeek>('/student/timetable', { query: { week } }),
  today: () => api.get<StudentToday>('/student/timetable/today'),
  nextClass: () => api.get<{ next_class: StudentDashboard['next_class'] }>('/student/next-class'),
  enrolments: () => api.get<{ enrolments: Enrollment[] }>('/student/enrolments'),

  queueBoard: () => api.get<{ queues: QueueListItem[] }>('/student/queues/board'),
  queueTickets: (query: ListQuery = {}) => api.get<{ tickets: QueueTicketView[] }>('/student/queue-tickets', { query }),
  activeQueueTicket: () => api.get<{ ticket: QueueTicketView | null }>('/student/queue-tickets/active'),
  queueTicket: (id: string) => api.get<QueueTicketView>(`/student/queue-tickets/${id}`),
  queueTicketHistory: (id: string) =>
    api.get<{ events: { id: string; type: string; created_at: string; metadata: Record<string, unknown> | null }[] }>(`/student/queue-tickets/${id}/history`),
  cancelQueueTicket: (id: string) => api.post<QueueTicketView>(`/student/queue-tickets/${id}/cancel`),
  leaveQueueTicket: (id: string) => api.post<QueueTicketView>(`/student/queue-tickets/${id}/leave`),
  navigatingQueueTicket: (id: string) => api.post<QueueTicketView>(`/student/queue-tickets/${id}/navigating`),
  checkInQueueTicket: (id: string, body: { qr_code?: string; fix?: Record<string, unknown> } = {}) =>
    api.post<QueueTicketView>(`/student/queue-tickets/${id}/check-in`, body),

  // The office index answers "which desk, how long, am I already in a line" — one projection,
  // built server-side, shared by the student web list and the mobile office screens.
  offices: () => api.get<{ offices: OfficeSummary[] }>('/student/offices'),
  officeTickets: (query: ListQuery = {}) => api.get<{ tickets: OfficeTicketView[] }>('/student/office-tickets', { query }),
  activeOfficeTicket: () => api.get<{ ticket: OfficeTicketView | null }>('/student/office-tickets/active'),
  officeTicket: (id: string) => api.get<OfficeTicketView>(`/student/office-tickets/${id}`),
  officeTicketHistory: (id: string) =>
    api.get<{ events: { id: string; type: string; created_at: string; metadata: Record<string, unknown> | null }[] }>(`/student/office-tickets/${id}/history`),
  cancelOfficeTicket: (id: string) => api.post<OfficeTicketView>(`/student/office-tickets/${id}/cancel`),
  checkInOfficeTicket: (id: string, body: { qr_code?: string; fix?: Record<string, unknown> } = {}) =>
    api.post<OfficeTicketView>(`/student/office-tickets/${id}/check-in`, body),
  approachingOfficeTicket: (id: string) => api.post<{ ticket: OfficeTicketView }>(`/student/office-tickets/${id}/approaching`),

  // Event registration is a student act; the create/update side belongs to staff and admin.
  registerEvent: (id: string) => api.post<{ registration: { id: string; event_id: string; user_id: string } }>(`/student/events/${id}/register`, {}),
  unregisterEvent: (id: string) => api.delete<void>(`/student/events/${id}/register`),

  // Where the phone last put this student. Reading a position is allowed anywhere; *writing* one is not —
  // `positioning.update.own` and `qr.scan` are mobile grants, so the browser has no method here to call,
  // and the map page renders this read beside a "open the app to update" note rather than a fake control.
  position: () => api.get<{ position: Position | null }>('/student/positioning/current'),
};

/* --------------------------------------------------------------------- campus */

function normalizeFloorPlan(value: unknown): FloorPlanPayload {
  if (!isRecord(value) || !isRecord(value.floor) || !isRecord(value.building)) {
    throw new ApiError(502, 'The campus service returned an incomplete floor plan.', 'INVALID_FLOOR_PLAN');
  }

  return {
    ...value,
    floor: value.floor as unknown as FloorPlanPayload['floor'],
    building: value.building as unknown as FloorPlanPayload['building'],
    rooms: arrayOrEmpty<Room>(value.rooms),
    qr_nodes: arrayOrEmpty<QrNode>(value.qr_nodes),
    navigation_nodes: arrayOrEmpty<NavigationNode>(value.navigation_nodes),
    navigation_edges: arrayOrEmpty<NavigationEdge>(value.navigation_edges),
    geofences: arrayOrEmpty<Geofence>(value.geofences),
    busy: isRecord(value.busy) ? (value.busy as FloorPlanPayload['busy']) : {},
  };
}

export const publicApi = {
  overview: () => api.get<PublicOverview>('/public/overview', { auth: false }),
  buildings: () => api.get<{ buildings: Building[] }>('/public/buildings', { auth: false }),
  building: (idOrCode: string) => api.get<{ building: Building; floors: Floor[]; rooms: Room[] }>(`/public/buildings/${idOrCode}`, { auth: false }),
  floorPlan: (floorId: string) => api.get<unknown>(`/public/floors/${floorId}/plan`, { auth: false }),
  rooms: (query: ListQuery = {}) => api.get<Paginated<Room>>('/public/rooms', { query, auth: false }),
  room: (idOrCode: string) => api.get<RoomDetail>(`/public/rooms/${idOrCode}`, { auth: false }),
  // Public office listings carry names, hours and where to find a desk — never a live line length,
  // because a stranger has no reason to know how many students are waiting.
  offices: () => api.get<{ offices: PublicOffice[] }>('/public/offices', { auth: false }),
  events: (query: ListQuery = {}) => api.get<Paginated<CampusEvent>>('/public/events', { query, auth: false }),
  announcements: (query: ListQuery = {}) => api.get<Paginated<Announcement>>('/public/announcements', { query, auth: false }),
};

/**
 * Resident campus reads — shared by student, staff and admin, because the campus is the same campus.
 * Data, not a screen: each role renders it differently and nothing in this group writes.
 */
export const campusApi = {
  buildings: () => api.get<{ buildings: Building[] }>('/campus/buildings'),
  building: (idOrCode: string) => api.get<{ building: Building; floors: Floor[]; rooms: Room[] }>(`/campus/buildings/${idOrCode}`),
  floors: (buildingId: string) => api.get<{ floors: Floor[] }>(`/campus/buildings/${buildingId}/floors`),
  floor: (floorId: string) => api.get<{ floor: Floor; building: Building; rooms: Room[] }>(`/campus/floors/${floorId}`),
  floorPlan: async (floorId: string, date?: string) =>
    normalizeFloorPlan(await api.get<unknown>(`/campus/floors/${floorId}/plan`, { query: { date } })),
  floorAvailability: (floorId: string, date?: string) =>
    api.get<{ date: string; busy: Record<string, unknown>; free_now: string[] }>(`/campus/floors/${floorId}/availability`, { query: { date } }),
  rooms: (query: ListQuery = {}) => api.get<Paginated<Room>>('/campus/rooms', { query }),
  room: (idOrCode: string) => api.get<RoomDetail>(`/campus/rooms/${idOrCode}`),
  roomAvailability: (id: string, date?: string) => api.get<{ availability: RoomDetail['availability'] }>(`/campus/rooms/${id}/availability`, { query: { date } }),
  queues: () => api.get<{ queues: QueueListItem[] }>('/campus/queues'),
  queue: (id: string) => api.get<QueueSnapshot>(`/campus/queues/${id}`),
  roomQueue: (roomId: string) => api.get<QueueSnapshot>(`/campus/rooms/${roomId}/queue`),
  anchors: () => api.get<{ anchors: QrNode[] }>('/campus/positioning/anchors'),
  events: (query: ListQuery = {}) => api.get<Paginated<CampusEvent>>('/campus/events', { query }),
  event: (id: string) => api.get<{ event: CampusEvent; attendees?: number }>(`/campus/events/${id}`),
  announcements: (query: ListQuery = {}) => api.get<Paginated<Announcement>>('/campus/announcements', { query }),
  announcement: (id: string) => api.get<{ announcement: Announcement }>(`/campus/announcements/${id}`),
  courses: () => api.get<Course[]>('/campus/academic/courses'),
  terms: () => api.get<Term[]>('/campus/academic/terms'),
  /** Route *preview*: planning a walk, which the web may do. Starting a live session is mobile-only. */
  route: async (body: { to_room_id?: string; to_room_code?: string; to_node_id?: string; from_node_id?: string; accessible?: boolean }) => {
    const response = await api.post<{ route: unknown; destination_label: string }>('/campus/navigation/route', body);
    return { ...response, route: requireRenderableRoute(response.route) };
  },
  node: (id: string) => api.get<{ node: NavigationNode }>(`/campus/navigation/nodes/${id}`),
  health: () => request<{ status: string; database: { engine: string; latency_ms: number }; time: string }>('/health', { auth: false }),
};

/* ---------------------------------------------------------------- positioning */

/**
 * Wayfinding. Live navigation (start / position / complete) is a **student mobile** capability: the
 * server requires `navigation.live`, which is registered for the mobile platform only, so the same call
 * from a browser answers 403 PLATFORM_NOT_SUPPORTED instead of half-working. `/campus/navigation/route`
 * below is the preview variant, allowed wherever `navigation.preview` is granted.
 */
/**
 * Where the campus thinks this person is standing.
 *
 * Read-only here. Scanning a code (`qr.scan`) and reporting a position (`positioning.update.own`) are
 * mobile-only grants: a laptop has no camera on a wall and no reason to claim it is in a corridor, so the
 * web surface shows the *last* position the phone recorded and nothing more. That is why the map page can
 * say "you are here" without being able to write "here".
 */
export const positioningApi = {
  current: () => api.get<{ position: Position | null }>('/student/positioning/current'),
  anchors: () => api.get<{ anchors: QrNode[] }>('/campus/positioning/anchors'),
};

/* ----------------------------------------------------------------- navigation */

function isRenderableRoute(value: unknown): value is Route {
  if (!value || typeof value !== 'object') return false;

  const route = value as Partial<Route>;
  return (
    Array.isArray(route.nodes) &&
    Array.isArray(route.steps) &&
    Array.isArray(route.legs) &&
    Array.isArray(route.transitions) &&
    typeof route.origin?.label === 'string' &&
    typeof route.destination?.label === 'string'
  );
}

function requireRenderableRoute(value: unknown): Route {
  if (isRenderableRoute(value)) return value;

  throw new ApiError(
    502,
    'The navigation service returned an incomplete route. Please try again after the route service is updated.',
    'INVALID_ROUTE_RESPONSE',
  );
}

/**
 * Wayfinding, web side: preview only.
 *
 * A browser may compute a route and look at a node, and that is the end of it — the API registers
 * `navigation.live` for the mobile platform alone, so a session started from a laptop would be refused.
 * This file therefore has no `startSession`/`updatePosition`/`complete` to call: the phone owns the walk,
 * because a walk is something a body does in a building. The web equivalent of "how do I get there" is
 * `campusApi.route(...)`, which renders the same polyline without ever claiming presence.
 */
export const navigationApi = {
  route: campusApi.route,
  node: campusApi.node,
};

/* --------------------------------------------------------------------- queues */

/**
 * Student queue surface.
 *
 * Joining is guarded three ways server-side: the room's queue must be open with room in the line, the
 * caller must be inside the queue's geofence (or present the QR printed at that room), and the request
 * must carry an idempotency key so a double tap cannot take two places in line. `join` returns the key
 * it used so a retry after a network blip re-sends the same one instead of minting a new ticket.
 */
/**
 * Student queue verbs. The boards themselves are campus reads (`campusApi.queues`, `campusApi.roomQueue`);
 * what lives here is only what a student *does* to their own ticket, which is why every path below is
 * under `/student/` and every one of them is authorised by `QueueTicketPolicy` on the server.
 */
export const queueApi = {
  join: (
    queueId: string,
    body: { qr_code?: string; fix?: Record<string, unknown>; note?: string } = {},
    idempotencyKey = newIdempotencyKey('join'),
  ) => api.post<{ ticket: QueueTicketView; replayed?: boolean }>(`/student/queues/${queueId}/tickets`, { ...body, idempotency_key: idempotencyKey }, { idempotencyKey }),
  joinByRoom: (
    roomId: string,
    body: { qr_code?: string; fix?: Record<string, unknown>; note?: string } = {},
    idempotencyKey = newIdempotencyKey('join'),
  ) => api.post<{ ticket: QueueTicketView }>(`/student/rooms/${roomId}/queue/join`, { ...body, idempotency_key: idempotencyKey }, { idempotencyKey }),
  ticket: (id: string) => api.get<QueueTicketView>(`/student/queue-tickets/${id}`),
  history: (id: string) => api.get<{ events: { type: string; created_at: string; metadata: Record<string, unknown> | null }[] }>(`/student/queue-tickets/${id}/history`),
  cancel: (id: string) => api.post<QueueTicketView>(`/student/queue-tickets/${id}/cancel`),
  leave: (id: string) => api.post<QueueTicketView>(`/student/queue-tickets/${id}/leave`),
  checkIn: (id: string, body: { qr_code?: string; fix?: Record<string, unknown> } = {}) =>
    api.post<QueueTicketView>(`/student/queue-tickets/${id}/check-in`, body),
  navigating: (id: string) => api.post<QueueTicketView>(`/student/queue-tickets/${id}/navigating`),
  proximityCheck: (id: string, body: { fix?: Record<string, unknown>; qr_code?: string }) =>
    api.post<{ within: boolean; distance_m: number; radius_m: number; method: string }>(`/student/queues/${id}/proximity-check`, body),
};

export const officeApi = {
  list: () => api.get<{ offices: OfficeSummary[] }>('/campus/offices'),
  detail: (idOrCode: string) => api.get<OfficeSummary>(`/student/offices/${idOrCode}`),
  request: (officeId: string, body: { subject: string; notes?: string; qr_code?: string; fix?: Record<string, unknown> }, idempotencyKey = newIdempotencyKey('office')) =>
    api.post<OfficeTicketView>(`/student/offices/${officeId}/tickets`, { ...body, idempotency_key: idempotencyKey }, { idempotencyKey }),
  ticket: (id: string) => api.get<OfficeTicketView>(`/student/office-tickets/${id}`),
  history: (id: string) => api.get<{ events: { type: string; created_at: string; metadata: Record<string, unknown> | null }[] }>(`/student/office-tickets/${id}/history`),
  // Every student mutation answers with the same ticket view the read endpoints use, so a screen
  // never has to refetch to learn that the state it just changed is now `in_service`.
  cancel: (id: string) => api.post<OfficeTicketView>(`/student/office-tickets/${id}/cancel`),
  checkIn: (id: string, body: { qr_code?: string; fix?: Record<string, unknown> } = {}) => api.post<OfficeTicketView>(`/student/office-tickets/${id}/check-in`, body),
  approaching: (id: string) => api.post<OfficeTicketView>(`/student/office-tickets/${id}/approaching`),
};

/* ---------------------------------------------------------------- engagement */

function normalizeEvents(value: unknown, query: ListQuery): EventsPayload {
  const payload = isRecord(value) ? value : null;
  const items = arrayOrEmpty<CampusEvent>(Array.isArray(value) ? value : payload?.items);
  if (!Array.isArray(value) && (!payload || !Array.isArray(payload.items))) {
    throw new ApiError(502, 'The events service returned an invalid event list.', 'INVALID_EVENTS_RESPONSE');
  }

  const meta = isRecord(payload?.meta) ? payload.meta : null;
  const page = typeof meta?.page === 'number' ? meta.page : typeof query.page === 'number' ? query.page : 1;
  const perPage = typeof meta?.per_page === 'number' ? meta.per_page : typeof query.per_page === 'number' ? query.per_page : items.length;
  const total = typeof meta?.total === 'number' ? meta.total : items.length;
  const totalPages = typeof meta?.total_pages === 'number' ? meta.total_pages : Math.max(1, Math.ceil(total / Math.max(perPage, 1)));

  return {
    items,
    meta: { page, per_page: perPage, total, total_pages: totalPages },
    registered_event_ids: arrayOrEmpty<string>(payload?.registered_event_ids),
  };
}

export const engagementApi = {
  events: async (query: ListQuery = {}) => normalizeEvents(await api.get<unknown>('/campus/events', { query }), query),
  event: (id: string) => api.get<{ event: CampusEvent; attendees?: number }>(`/campus/events/${id}`),
  register: (id: string) => studentApi.registerEvent(id),
  unregister: (id: string) => studentApi.unregisterEvent(id),
  announcements: (query: ListQuery = {}) => api.get<Paginated<Announcement>>('/campus/announcements', { query }),
  announcement: (id: string) => api.get<{ announcement: Announcement }>(`/campus/announcements/${id}`),
};

/* ---------------------------------------------------------------- assistant */

/**
 * The assistant gateway. `capabilities` is what the client renders its affordances from: the client asks
 * "which tools may I offer this principal on this platform" instead of hard-coding a student tool list
 * into the web bundle.
 */
export const assistantApi = {
  send: (body: { message: string; conversation_id?: string; context?: { screen?: string; room?: string } }) => api.post<AiReply>('/ai/chat', body),
  capabilities: () => api.get<AiCapabilities>('/ai/capabilities'),
  conversations: () => api.get<{ conversations: AiConversation[] }>('/ai/conversations'),
  conversation: (id: string) => api.get<{ conversation: AiConversation; messages: AiMessage[] }>(`/ai/conversations/${id}`),
  remove: (id: string) => api.delete<void>(`/ai/conversations/${id}`),

};

/* --------------------------------------------------------------------- staff */

export const staffApi = {
  dashboard: () => api.get<StaffDashboard>('/staff/dashboard'),
  queues: () => api.get<{ queues: StaffDashboard['queues'] }>('/staff/queues'),
  queueLine: (id: string) => api.get<StaffQueueDetail>(`/staff/queues/${id}/line`),
  callNext: (id: string) => api.post<{ called: QueueLineRow }>(`/staff/queues/${id}/call-next`),
  /**
   * Opening and closing a line is a decision of the day, so it belongs to the operator running it.
   * What a line *is* — capacity, call window, proximity, the duplicate rule — is set in Admin →
   * Services and is never accepted from here.
   */
  setQueueOpen: (id: string, isOpen: boolean) =>
    api.post<{ queue: { id: string; is_open: boolean } }>(`/staff/queues/${id}/open`, { is_open: isOpen }),
  admit: (ticketId: string) => api.post<{ ticket: QueueLineRow }>(`/staff/queue-tickets/${ticketId}/admit`),
  complete: (ticketId: string) => api.post<{ ticket: QueueLineRow }>(`/staff/queue-tickets/${ticketId}/complete`),
  staffCheckIn: (ticketId: string) => api.post<{ ticket: QueueLineRow }>(`/staff/queue-tickets/${ticketId}/check-in`),
  noShow: (ticketId: string, reason?: string) => api.post<{ ticket: QueueLineRow }>(`/staff/queue-tickets/${ticketId}/no-show`, { reason }),
  offices: () => api.get<{ offices: StaffDashboard['offices'] }>('/staff/offices'),
  officeLine: (id: string) => api.get<StaffOfficeDetail>(`/staff/offices/${id}/line`),
  officeCallNext: (id: string) => api.post<{ called: OfficeLineRow }>(`/staff/offices/${id}/call-next`),
  officeCheckIn: (ticketId: string) => api.post<{ ticket: OfficeLineRow }>(`/staff/office-tickets/${ticketId}/check-in`),
  officeStartService: (ticketId: string) => api.post<{ ticket: OfficeLineRow }>(`/staff/office-tickets/${ticketId}/start-service`),
  officeComplete: (ticketId: string) => api.post<{ ticket: OfficeLineRow }>(`/staff/office-tickets/${ticketId}/complete`),
  officeNoShow: (ticketId: string, reason?: string) => api.post<{ ticket: OfficeLineRow }>(`/staff/office-tickets/${ticketId}/no-show`, { reason }),
  /**
   * Quick actions for the operator on the move. Kept deliberately small: the console (this app) is where
   * a line is configured, the phone is where a ticket is called — the same verbs, fewer of them.
   */
  analytics: (query: ListQuery = {}) => api.get<Record<string, unknown>>('/staff/analytics', { query }),
  /** Verification only: who this student is and what they have outstanding, never their history. */
  studentLookup: (registrationNo: string) =>
    api.get<{ student: { id: string; name: string; registration_no: string | null; program: string | null; year: string | null; status: string | null }; tickets: { queue?: Record<string, unknown>; office?: Record<string, unknown> } }>(
      `/staff/students/${encodeURIComponent(registrationNo)}`,
    ),
  /** The single campus write staff may make: flipping a room's availability on the day. */
  updateRoom: (id: string, body: Record<string, unknown>) => api.patch<{ room: Room }>(`/staff/rooms/${id}`, body),
  rooms: (query: ListQuery = {}) => api.get<Paginated<Room>>('/staff/rooms', { query }),

  timetable: (query: ListQuery = {}) =>
    api.get<{ entries: StaffTimetableRow[]; can_manage: boolean; courses: StaffCourseOption[]; rooms: StaffRoomOption[] }>('/staff/timetable', { query }),
  createEntry: (body: Record<string, unknown>) => api.post<{ entry: StaffTimetableRow }>('/staff/timetable', body),
  updateEntry: (id: string, body: Record<string, unknown>) => api.patch<{ entry: StaffTimetableRow }>(`/staff/timetable/${id}`, body),
  deleteEntry: (id: string) => api.delete<void>(`/staff/timetable/${id}`),
  createEvent: (body: Record<string, unknown>) => api.post<{ event: CampusEvent }>('/staff/events', body),
  updateEvent: (id: string, body: Record<string, unknown>) => api.patch<{ event: CampusEvent }>(`/staff/events/${id}`, body),
  deleteEvent: (id: string) => api.delete<void>(`/staff/events/${id}`),
  announcements: () => api.get<{ announcements: Announcement[] }>('/staff/announcements'),
  createAnnouncement: (body: Record<string, unknown>) => api.post<{ announcement: Announcement }>('/staff/announcements', body),
  deleteAnnouncement: (id: string) => api.delete<void>(`/staff/announcements/${id}`),
};

/* --------------------------------------------------------------------- admin */

export const adminApi = {
  dashboard: () => api.get<AdminDashboard>('/admin/dashboard'),
  analytics: () => api.get<AnalyticsOverview>('/admin/analytics'),
  auditLogs: (query: ListQuery = {}) => api.get<Paginated<AuditLogRow>>('/admin/audit-logs', { query }),

  /**
   * Admin *monitoring*. These are the reads an administrator also uses from a phone, which is why they
   * are aggregate counts and computed conditions rather than editable tables: `alerts` are derived from
   * live state (an over-capacity line, a queue open for a closed room, a staff member with no scope),
   * and `ack` mutes one specific fingerprint so the same condition is not shouted about twice.
   */
  alerts: () =>
    api.get<{ alerts: AdminAlert[]; counts: { critical: number; warning: number; acknowledged: number }; generated_at: string }>('/admin/alerts'),
  acknowledgeAlert: (fingerprint: string, note?: string) =>
    api.post<{ acknowledged: string }>('/admin/alerts/ack', { fingerprint, note: note ?? null }),
  monitoring: () => api.get<AdminMonitoring>('/admin/monitoring/summary'),

  /** The permission registry as the server sees it: role → permissions → platforms. */
  roles: () => api.get<AdminRoleRegistry>('/admin/roles'),

  users: (query: ListQuery = {}) => api.get<Paginated<AdminUser>>('/admin/users', { query }),
  createUser: (body: { name: string; email: string; role_code: string; password?: string; registration_no?: string; department?: string }) =>
    api.post<{ user: AdminUser; password?: string }>('/admin/users', body),
  /**
   * A role change is its own call, not a field on the profile form: it is the one user edit that changes
   * what a person can *do*, so the server guards it separately (nobody demotes themselves, nobody demotes
   * the last administrator) and writes its own audit row with before and after.
   */
  setUserRole: (id: string, role: Role) => api.patch<{ user: AdminUser; changed: boolean }>(`/admin/users/${id}/role`, { role }),
  updateUser: (id: string, body: Record<string, unknown>) => api.patch<{ user: AdminUser }>(`/admin/users/${id}`, body),
  resetUserPassword: (id: string) => api.post<{ password: string }>(`/admin/users/${id}/reset-password`),
  deleteUser: (id: string) => api.delete<void>(`/admin/users/${id}`),

  staffAssignments: () => api.get<{ assignments: (User['assignments'] extends (infer A)[] | undefined ? A : never)[] }>('/admin/staff-assignments'),
  createAssignment: (body: { user_id: string; scope_type: string; scope_id: string; role_in_scope?: string; can_manage_timetable?: boolean; can_publish_content?: boolean; can_call_tickets?: boolean }) =>
    api.post<{ assignment: unknown }>('/admin/staff-assignments', body),
  deleteAssignment: (id: string) => api.delete<void>(`/admin/staff-assignments/${id}`),

  buildings: (query: ListQuery = {}) => api.get<Paginated<Building>>('/admin/buildings', { query }),
  createBuilding: (body: Record<string, unknown>) => api.post<Building>('/admin/buildings', body),
  updateBuilding: (id: string, body: Record<string, unknown>) => api.patch<Building>(`/admin/buildings/${id}`, body),
  deleteBuilding: (id: string) => api.delete<void>(`/admin/buildings/${id}`),

  floors: (query: ListQuery = {}) => api.get<Paginated<Floor>>('/admin/floors', { query }),
  createFloor: (body: Record<string, unknown>) => api.post<Floor>('/admin/floors', body),
  updateFloor: (id: string, body: Record<string, unknown>) => api.patch<Floor>(`/admin/floors/${id}`, body),
  deleteFloor: (id: string) => api.delete<void>(`/admin/floors/${id}`),

  rooms: (query: ListQuery = {}) => api.get<Paginated<Room>>('/admin/rooms', { query }),
  createRoom: (body: Record<string, unknown>) => api.post<Room>('/admin/rooms', body),
  updateRoom: (id: string, body: Record<string, unknown>) => api.patch<Room>(`/admin/rooms/${id}`, body),
  deleteRoom: (id: string) => api.delete<void>(`/admin/rooms/${id}`),

  qrNodes: (query: ListQuery = {}) => api.get<Paginated<QrNode>>('/admin/qr-nodes', { query }),
  createQrNode: (body: Record<string, unknown>) => api.post<QrNode>('/admin/qr-nodes', body),
  updateQrNode: (id: string, body: Record<string, unknown>) => api.patch<QrNode>(`/admin/qr-nodes/${id}`, body),
  deleteQrNode: (id: string) => api.delete<void>(`/admin/qr-nodes/${id}`),
  qrPayload: (id: string) => api.get<{ payload: string; code: string; label: string; version: number; scan_url: string }>(`/admin/qr-nodes/${id}/payload`),
  regenerateQr: (id: string) => api.post<{ node: { id: string; code: string; version: number } }>(`/admin/qr-nodes/${id}/regenerate`),

  navigationNodes: (query: ListQuery = {}) => api.get<Paginated<NavigationNode>>('/admin/navigation-nodes', { query }),
  createNavigationNode: (body: Record<string, unknown>) => api.post<NavigationNode>('/admin/navigation-nodes', body),
  updateNavigationNode: (id: string, body: Record<string, unknown>) => api.patch<NavigationNode>(`/admin/navigation-nodes/${id}`, body),
  deleteNavigationNode: (id: string) => api.delete<void>(`/admin/navigation-nodes/${id}`),

  navigationEdges: (query: ListQuery = {}) => api.get<Paginated<NavigationEdge>>('/admin/navigation-edges', { query }),
  createNavigationEdge: (body: Record<string, unknown>) => api.post<NavigationEdge>('/admin/navigation-edges', body),
  updateNavigationEdge: (id: string, body: Record<string, unknown>) => api.patch<NavigationEdge>(`/admin/navigation-edges/${id}`, body),
  deleteNavigationEdge: (id: string) => api.delete<void>(`/admin/navigation-edges/${id}`),

  geofences: (query: ListQuery = {}) => api.get<Paginated<Geofence>>('/admin/geofences', { query }),
  createGeofence: (body: Record<string, unknown>) => api.post<Geofence>('/admin/geofences', body),
  updateGeofence: (id: string, body: Record<string, unknown>) => api.patch<Geofence>(`/admin/geofences/${id}`, body),
  deleteGeofence: (id: string) => api.delete<void>(`/admin/geofences/${id}`),

  courses: (query: ListQuery = {}) => api.get<Paginated<Course>>('/admin/courses', { query }),
  createCourse: (body: Record<string, unknown>) => api.post<Course>('/admin/courses', body),
  updateCourse: (id: string, body: Record<string, unknown>) => api.patch<Course>(`/admin/courses/${id}`, body),
  deleteCourse: (id: string) => api.delete<void>(`/admin/courses/${id}`),

  terms: (query: ListQuery = {}) => api.get<Paginated<Term>>('/admin/terms', { query }),
  createTerm: (body: Record<string, unknown>) => api.post<Term>('/admin/terms', body),
  updateTerm: (code: string, body: Record<string, unknown>) => api.patch<Term>(`/admin/terms/${code}`, body),
  deleteTerm: (code: string) => api.delete<void>(`/admin/terms/${code}`),

  enrollments: (query: ListQuery = {}) => api.get<Paginated<Enrollment>>('/admin/enrollments', { query }),
  createEnrollment: (body: { student_id: string; course_id: string; term_code: string; status?: string }) =>
    api.post<{ enrollment: Enrollment }>('/admin/enrollments', body),
  deleteEnrollment: (id: string) => api.delete<void>(`/admin/enrollments/${id}`),

  queues: () => api.get<{ queues: RoomQueueConfig[]; rooms_without_queue: { id: string; code: string; name: string; building_code: string; requires_admission: boolean }[] }>('/admin/queues'),
  configureQueue: (roomId: string, body: Record<string, unknown>) => api.post<{ queue: RoomQueueConfig }>(`/admin/rooms/${roomId}/queue`, body),
  updateQueue: (id: string, body: Record<string, unknown>) => api.patch<{ queue: RoomQueueConfig }>(`/admin/queues/${id}`, body),
  deleteQueue: (id: string) => api.delete<void>(`/admin/queues/${id}`),

  offices: (query: ListQuery = {}) => api.get<Paginated<AdminOfficeRow>>('/admin/offices', { query }),
  createOffice: (body: Record<string, unknown>) => api.post<Office>('/admin/offices', body),
  updateOffice: (id: string, body: Record<string, unknown>) => api.patch<Office>(`/admin/offices/${id}`, body),
  deleteOffice: (id: string) => api.delete<void>(`/admin/offices/${id}`),

  serviceWindows: (query: ListQuery = {}) => api.get<Paginated<ServiceWindow>>('/admin/office-service-windows', { query }),
  createServiceWindow: (body: Record<string, unknown>) => api.post<ServiceWindow>('/admin/office-service-windows', body),
  updateServiceWindow: (id: string, body: Record<string, unknown>) => api.patch<ServiceWindow>(`/admin/office-service-windows/${id}`, body),
  deleteServiceWindow: (id: string) => api.delete<void>(`/admin/office-service-windows/${id}`),

  officeStaff: (query: ListQuery = {}) => api.get<{ staff: { office_id: string; user_id: string; role: string; is_primary: boolean; user_name?: string; office_name?: string }[] }>('/admin/office-staff', { query }),
  addOfficeStaff: (body: { office_id: string; user_id: string; role?: string; is_primary?: boolean }) =>
    api.post<{ staff: unknown }>('/admin/office-staff', body),
  removeOfficeStaff: (officeId: string, userId: string) => api.delete<void>(`/admin/office-staff/${officeId}/${userId}`),

  map: () => api.get<MapPayload>('/admin/map'),
  timetable: (query: ListQuery = {}) => api.get<{ term: string; entries: TimetableEntry[] }>('/admin/timetable', { query }),
  settings: () => api.get<{ settings: Setting[] }>('/admin/settings'),
  updateSetting: (key: string, value: unknown) => api.patch<{ setting: Setting }>(`/admin/settings/${key}`, { value }),
};

export type { CampusEvent, OfficeTicketView, QueueTicketView };

export interface PublicOffice {
  id: string;
  code: string;
  name: string;
  description: string | null;
  opening_hours: string | null;
  phone: string | null;
  email: string | null;
  is_open: boolean;
  location: { room_code: string | null; floor_name: string | null; building_code: string | null } | null;
}

export interface PublicOverview {
  stats: { buildings: number; rooms: number; offices: number; seats: number; events: number };
  buildings: Pick<Building, 'id' | 'code' | 'name' | 'lat' | 'lng' | 'footprint' | 'status'>[];
  announcements: Pick<Announcement, 'id' | 'title' | 'body' | 'priority' | 'published_at'>[];
  events: Pick<CampusEvent, 'id' | 'title' | 'starts_at' | 'venue' | 'category'>[];
}
