/**
 * Typed API surface. Every screen imports from here — no component talks to `fetch`
 * directly, and no URL is written twice.
 */
import { api, newIdempotencyKey, request } from './client';
import type {
  AdminDashboard,
  NavigationActive,
  NavigationStart,
  NavigationUpdate,
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
  DashboardPayload,
  Enrollment,
  EventsPayload,
  Floor,
  FloorPlanPayload,
  Geofence,
  MapPayload,
  NavigationEdge,
  NavigationNode,
  NavigationSession,
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
  StaffCourseOption,
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

/* ----------------------------------------------------------------------- auth */

export const authApi = {
  register: (body: { name: string; email: string; password: string; role?: 'student' | 'staff'; registration_no?: string; department?: string }) =>
    api.post<SessionInfo>('/auth/register', body, { auth: false }),
  login: (body: { email: string; password: string }) =>
    request<SessionInfo>('/auth/login', { method: 'POST', body, auth: false }),
  logout: () => api.post<{ revoked: boolean }>('/auth/logout'),
  me: () => api.get<{ user: User; assignments: User['assignments'] }>('/auth/me'),
  updateProfile: (body: { name?: string; phone?: string | null; department?: string | null; avatar_url?: string | null }) =>
    api.patch<{ user: User }>('/me', body),
  changePassword: (body: { current_password: string; password: string }) => api.post<{ changed: boolean }>('/auth/password', body),
  forgotPassword: (body: { email: string }) =>
    request<{ sent: boolean; reset_token?: string; message?: string }>('/auth/forgot-password', { method: 'POST', body, auth: false }),
  resetPassword: (body: { token: string; password: string }) =>
    request<{ reset: boolean }>('/auth/reset-password', { method: 'POST', body, auth: false }),
};

/* -------------------------------------------------------------------- student */

export const meApi = {
  dashboard: () => api.get<DashboardPayload>('/me/dashboard'),
  timetable: (week?: string) => api.get<TimetableWeek>('/me/timetable', { query: { week } }),
  today: () => api.get<{ today: DashboardPayload['today'] }>('/me/timetable/today'),
  nextClass: () => api.get<{ next_class: DashboardPayload['next_class'] }>('/me/next-class'),
  queueTicket: () => api.get<{ ticket: QueueTicketView | null }>('/me/queue-tickets/active'),
  officeTicket: () => api.get<{ ticket: OfficeTicketView | null }>('/me/office-tickets/active'),
  officeHistory: () => api.get<{ tickets: OfficeTicketView[] }>('/me/office-tickets'),
  officeSummaries: () => api.get<{ offices: OfficeSummary[] }>('/me/offices/summary'),
  notifications: (query: ListQuery = {}) => api.get<{ items: NotificationRow[]; meta: PageMeta; unread: number }>('/me/notifications', { query }),
  readNotification: (id: string) => api.post<{ unread: number }>(`/me/notifications/${id}/read`),
  readAllNotifications: () => api.post<{ unread: number }>('/me/notifications/read-all'),
  registerDevice: (body: { token: string; platform: 'ios' | 'android' | 'web' }) => api.post<{ registered: boolean }>('/me/devices', body),
};

/* --------------------------------------------------------------------- campus */

export const campusApi = {
  buildings: () => api.get<{ buildings: Building[] }>('/buildings'),
  building: (idOrCode: string) => api.get<{ building: Building; floors: Floor[]; rooms: Room[] }>(`/buildings/${idOrCode}`),
  floors: (buildingId: string) => api.get<{ floors: Floor[] }>(`/buildings/${buildingId}/floors`),
  floorPlan: (floorId: string, date?: string) => api.get<FloorPlanPayload>(`/floors/${floorId}/plan`, { query: { date } }),
  floorAvailability: (floorId: string, date?: string) =>
    api.get<{ date: string; busy: Record<string, unknown>; free_now: string[] }>(`/floors/${floorId}/availability`, { query: { date } }),
  rooms: (query: ListQuery = {}) => api.get<Paginated<Room>>('/rooms', { query }),
  room: (idOrCode: string) => api.get<RoomDetail>(`/rooms/${idOrCode}`),
  roomAvailability: (id: string, date?: string) => api.get<{ availability: RoomDetail['availability'] }>(`/rooms/${id}/availability`, { query: { date } }),
  publicOverview: () =>
    api.get<{
      stats: { buildings: number; rooms: number; offices: number; seats: number; events?: number };
      buildings: Pick<Building, 'id' | 'code' | 'name' | 'lat' | 'lng' | 'footprint' | 'status'>[];
      announcements: Pick<Announcement, 'id' | 'title' | 'body' | 'priority' | 'published_at'>[];
      events: Pick<CampusEvent, 'id' | 'title' | 'starts_at' | 'venue' | 'category'>[];
    }>('/public/overview', { auth: false }),
  health: () => request<{ status: string; database: { engine: string; latency_ms: number }; time: string }>('/health', { auth: false }),
};

/* ---------------------------------------------------------------- positioning */

export const positioningApi = {
  scan: (body: { payload?: string; code?: string }) => api.post<{ position: Position; qr_node: QrNode }>('/positioning/scan', body),
  current: () => api.get<{ position: Position | null }>('/positioning/current'),
  update: (body: {
    lat: number;
    lng: number;
    accuracy_m?: number | null;
    source?: 'gps' | 'manual' | 'simulated';
    building_id?: string | null;
    floor_id?: string | null;
    plan_x?: number | null;
    plan_y?: number | null;
  }) => api.post<{ position: Position }>('/positioning/position', body),
  anchors: () => api.get<{ anchors: QrNode[] }>('/positioning/anchors'),
};

/* ----------------------------------------------------------------- navigation */

export const navigationApi = {
  route: (body: {
    to_room_id?: string;
    to_room_code?: string;
    to_node_id?: string;
    from_node_id?: string;
    accessible?: boolean;
  }) => api.post<{ route: Route; destination_label: string }>('/navigation/route', body),
  startSession: (body: { to_room_id?: string; to_room_code?: string; to_node_id?: string; from_node_id?: string; accessible?: boolean }) =>
    api.post<NavigationStart>('/navigation/sessions', body),
  activeSession: () => api.get<NavigationActive>('/navigation/sessions/active'),
  updatePosition: (
    sessionId: string,
    body: { lat: number; lng: number; accuracy_m?: number | null; source?: string; plan_x?: number | null; plan_y?: number | null; floor_id?: string | null },
  ) => api.post<NavigationUpdate>(`/navigation/sessions/${sessionId}/position`, body),
  complete: (sessionId: string) => api.post<{ status: string }>(`/navigation/sessions/${sessionId}/complete`),
  abandon: (sessionId: string) => api.post<{ status: string }>(`/navigation/sessions/${sessionId}/abandon`),
  history: (query: ListQuery = {}) => api.get<{ sessions: NavigationSession[] }>('/navigation/sessions', { query }),
  node: (id: string) => api.get<{ node: NavigationNode }>(`/navigation/nodes/${id}`),
};

/* --------------------------------------------------------------------- queues */

export const queueApi = {
  list: () => api.get<{ queues: QueueListItem[] }>('/queues'),
  detail: (id: string) => api.get<QueueSnapshot>(`/queues/${id}`),
  roomQueue: (roomId: string) => api.get<QueueSnapshot>(`/rooms/${roomId}/queue`),
  join: (queueId: string, body: { qr_code?: string; fix?: { lat?: number; lng?: number; plan_x?: number; plan_y?: number; floor_id?: string; source?: string } } = {}) =>
    api.post<{ ticket: QueueTicket; queue: Record<string, unknown>; counts: Record<string, number>; proximity: Record<string, unknown> | null }>(
      `/queues/${queueId}/tickets`,
      body,
      { idempotencyKey: newIdempotencyKey('join') },
    ),
  ticket: (id: string) => api.get<{ ticket: QueueTicketView }>(`/queue-tickets/${id}`),
  history: (id: string) => api.get<{ events: { type: string; created_at: string; metadata: Record<string, unknown> | null }[] }>(`/queue-tickets/${id}/history`),
  cancel: (id: string) => api.post<{ ticket: QueueTicketView }>(`/queue-tickets/${id}/cancel`),
  checkIn: (id: string, body: { qr_code?: string; fix?: Record<string, unknown> } = {}) =>
    api.post<{ ticket: QueueTicketView }>(`/queue-tickets/${id}/check-in`, body),
  navigating: (id: string) => api.post<{ ticket: QueueTicketView }>(`/queue-tickets/${id}/navigating`),
  proximityCheck: (id: string, body: { fix?: Record<string, unknown>; qr_code?: string }) =>
    api.post<{ within: boolean; distance_m: number; radius_m: number; method: string }>(`/queues/${id}/proximity-check`, body),
};

/* -------------------------------------------------------------------- offices */

export const officeApi = {
  list: () => api.get<{ offices: Office[]; my_ticket: OfficeTicketView | null }>('/offices'),
  detail: (idOrCode: string) =>
    api.get<OfficeSummary & { my_ticket: OfficeTicketView | null; today_in_line: { position: number; status: string }[] }>(`/offices/${idOrCode}`),
  request: (officeId: string, body: { subject: string; notes?: string; qr_code?: string; fix?: Record<string, unknown> }) =>
    api.post<OfficeTicketView>(`/offices/${officeId}/tickets`, body, { idempotencyKey: newIdempotencyKey('office') }),
  ticket: (id: string) => api.get<OfficeTicketView>(`/office-tickets/${id}`),
  history: (id: string) => api.get<{ events: { type: string; created_at: string; metadata: Record<string, unknown> | null }[] }>(`/office-tickets/${id}/history`),
  cancel: (id: string) => api.post<OfficeTicketView>(`/office-tickets/${id}/cancel`),
  checkIn: (id: string, body: { qr_code?: string; fix?: Record<string, unknown> } = {}) => api.post<OfficeTicketView>(`/office-tickets/${id}/check-in`, body),
  approaching: (id: string) => api.post<{ ticket: OfficeTicketView }>(`/office-tickets/${id}/approaching`),
};

/* ---------------------------------------------------------------- engagement */

export const engagementApi = {
  events: (query: ListQuery = {}) => api.get<EventsPayload>('/events', { query }),
  event: (id: string) => api.get<{ event: CampusEvent; attendees?: number }>(`/events/${id}`),
  register: (id: string) => api.post<{ registration: { id: string; event_id: string; user_id: string } }>(`/events/${id}/register`, {}),
  unregister: (id: string) => api.delete<void>(`/events/${id}/register`),
  announcements: (query: ListQuery = {}) => api.get<Paginated<Announcement>>('/announcements', { query }),
  announcement: (id: string) => api.get<{ announcement: Announcement }>(`/announcements/${id}`),
};

/* ---------------------------------------------------------------- assistant */

export const assistantApi = {
  send: (body: { message: string; conversation_id?: string }) => api.post<AiReply>('/ai/messages', body),
  conversations: () => api.get<{ conversations: AiConversation[] }>('/ai/conversations'),
  conversation: (id: string) => api.get<{ conversation: AiConversation; messages: AiMessage[] }>(`/ai/conversations/${id}`),
  remove: (id: string) => api.delete<void>(`/ai/conversations/${id}`),
  tools: () => api.get<{ provider: string; model: string | null; tools: { name: string; description: string; roles: string[] }[] }>('/ai/tools'),
};

/* --------------------------------------------------------------------- staff */

export const staffApi = {
  dashboard: () => api.get<StaffDashboard>('/staff/dashboard'),
  queues: () => api.get<{ queues: StaffDashboard['queues'] }>('/staff/queues'),
  queueLine: (id: string) => api.get<StaffQueueDetail>(`/staff/queues/${id}/line`),
  callNext: (id: string) => api.post<{ called: QueueLineRow }>(`/staff/queues/${id}/call-next`),
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

  users: (query: ListQuery = {}) => api.get<Paginated<AdminUser>>('/admin/users', { query }),
  createUser: (body: { name: string; email: string; role_code: string; password?: string; registration_no?: string; department?: string }) =>
    api.post<{ user: AdminUser; password?: string }>('/admin/users', body),
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

  offices: (query: ListQuery = {}) => api.get<Paginated<Office>>('/admin/offices', { query }),
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
