/**
 * The single HTTP client for the CampusFlow mobile app.
 *
 * Mirrors the web client — same envelope unwrapping, same idempotency discipline, no screen calling
 * `axios` directly — but it is **not** the same surface. The groups below are the mobile role domains:
 * `/student/*` for the companion (scan, walk, queue, check in), `/staff/*` for the handful of operational
 * quick actions a phone is allowed to perform, `/admin/*` for monitoring only. There is no group here for
 * a capability the platform does not have: nothing in this file can create a room, edit a policy or read
 * somebody else's timetable, because the corresponding endpoints are not mounted for this client at all.
 *
 * Every request declares itself with `X-CampusFlow-Client: mobile`. That header is a *statement of which
 * app is calling*, and the server's platform gate turns it into the difference between `qr.scan` and
 * `navigation.live` being allowed or answered with 403 PLATFORM_NOT_SUPPORTED. It is never trusted for
 * identity — that is the bearer token, and only the token.
 */
import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type {
  AdminAlert,
  AdminMobileMonitoring,
  AiReply,
  Announcement,
  Building,
  CampusEvent,
  DashboardPayload,
  EventsPayload,
  Floor,
  NotificationRow,
  OfficeSummary,
  OfficeTicketView,
  Paginated,
  Position,
  QueueListItem,
  QueueTicketView,
  RoomQueueSnapshot,
  Room,
  RoomDetail,
  ServiceWindow,
  SessionInfo,
  StaffMobileDashboard,
  StaffOfficeLinePayload,
  StaffOfficeLineRow,
  StaffQueueLinePayload,
  StaffQueueLineRow,
  StaffStudentLookup,
  TimetableEntry,
  TimetableWeek,
  User,
} from './types';

export const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:8001/api/v1').replace(/\/$/, '');

const TOKEN_KEY = 'campusflow.token';

let memoryToken: string | null = null;

function webStorage(): Storage | null {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return null;
  return localStorage;
}

export async function loadToken(): Promise<string | null> {
  if (memoryToken) return memoryToken;
  const browserStorage = webStorage();
  if (browserStorage) {
    memoryToken = browserStorage.getItem(TOKEN_KEY);
    return memoryToken;
  }
  if (!(await SecureStore.isAvailableAsync())) return null;
  memoryToken = await SecureStore.getItemAsync(TOKEN_KEY);
  return memoryToken;
}

export async function saveToken(token: string | null): Promise<void> {
  memoryToken = token;
  const browserStorage = webStorage();
  if (browserStorage) {
    if (token) browserStorage.setItem(TOKEN_KEY, token);
    else browserStorage.removeItem(TOKEN_KEY);
    return;
  }
  if (!(await SecureStore.isAvailableAsync())) {
    if (token) throw new Error('Secure token storage is unavailable on this device.');
    return;
  }
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly errors: Record<string, string[]> | null;

  constructor(status: number, message: string, code: string | null = null, errors: Record<string, string[]> | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.errors = errors;
  }

  get firstError(): string | null {
    if (!this.errors) return null;
    const [first] = Object.values(this.errors);
    return first?.[0] ?? null;
  }
}

export const CLIENT_PLATFORM = 'mobile';

const http = axios.create({
  baseURL: API_BASE,
  timeout: 20_000,
  headers: { accept: 'application/json', 'X-CampusFlow-Client': CLIENT_PLATFORM },
});

http.interceptors.request.use(async (config) => {
  const token = await loadToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function toApiError(error: unknown): ApiError {
  const axiosError = error as AxiosError<{ message?: string; code?: string; errors?: Record<string, string[]> }>;
  if (!axiosError.response) {
    return new ApiError(0, `The CampusFlow API is unreachable at ${API_BASE}. Check that the API is running and that EXPO_PUBLIC_API_URL points at your machine.`, 'NETWORK_ERROR');
  }
  const { status, data } = axiosError.response;
  return new ApiError(status, data?.message ?? 'The request could not be completed.', data?.code ?? null, data?.errors ?? null);
}

async function call<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await http.request<{ success: boolean; data?: T } & T>({ ...config, validateStatus: (status) => status >= 200 && status < 300 });
    if (response.status === 204) return undefined as T;
    const body = response.data as { success?: boolean; data?: T };
    return (body && typeof body === 'object' && 'data' in body ? (body.data as T) : (response.data as T)) ?? (undefined as T);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw toApiError(error);
  }
}

export function newIdempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const api = {
  get: <T>(path: string, params?: Record<string, unknown>) => call<T>({ method: 'GET', url: path, params }),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) => call<T>({ method: 'POST', url: path, data: body ?? {}, headers }),
  patch: <T>(path: string, body?: unknown) => call<T>({ method: 'PATCH', url: path, data: body ?? {} }),
  delete: <T>(path: string) => call<T>({ method: 'DELETE', url: path }),
};

/* ------------------------------------------------------------------------- auth */

export const authApi = {
  login: (body: { email: string; password: string }) => api.post<SessionInfo>('/auth/login', body),
  register: (body: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    registration_no?: string;
    department?: string;
    role?: 'student' | 'staff';
  }) =>
    api.post<SessionInfo>('/auth/register', body),
  logout: () => api.post<{ revoked: boolean }>('/auth/logout'),
  me: () => api.get<{ user: User }>('/me'),
  updateProfile: (body: { name?: string; phone?: string | null; department?: string | null }) => api.patch<{ user: User }>('/me', body),
};

/* ---------------------------------------------------------------------- student */

/**
 * Shared account surface — the same for every role, which is why it is the only `/me` group here.
 * Notifications and devices follow a person, not a job title.
 */
export const accountApi = {
  profile: () => api.get<{ user: User }>('/me'),
  updateProfile: (body: { name?: string; phone?: string | null; department?: string | null }) => api.patch<{ user: User }>('/me', body),
  notifications: (params?: { per_page?: number }) => api.get<{ items: NotificationRow[]; unread: number }>('/me/notifications', params),
  readNotification: (id: string) => api.post<{ unread: number }>(`/me/notifications/${id}/read`),
  readAllNotifications: () => api.post<{ unread: number }>('/me/notifications/read-all'),
  registerDevice: (body: { token: string; platform: 'ios' | 'android'; name?: string }) => api.post<{ registered: boolean }>('/me/devices', body),
};

/**
 * The student companion: this is the payload the home screen is built from, and it is the reason the
 * phone exists at all — the next class, where I am, where I stand in a line.
 */
export const studentApi = {
  dashboard: () => api.get<DashboardPayload>('/student/dashboard'),
  timetable: () => api.get<TimetableWeek>('/student/timetable'),
  today: () => api.get<{ date: string; entries: TimetableEntry[]; remaining: number }>('/student/timetable/today'),
  nextClass: () => api.get<{ next_class: TimetableEntry | null }>('/student/next-class'),
  queueTickets: () => api.get<{ tickets: QueueTicketView[] }>('/student/queue-tickets'),
  activeQueueTicket: () => api.get<{ ticket: QueueTicketView | null }>('/student/queue-tickets/active'),
  queueTicketHistory: (id: string) => api.get<{ events: { type: string; created_at: string; metadata: Record<string, unknown> | null }[] }>(`/student/queue-tickets/${id}/history`),
  officeTickets: () => api.get<{ tickets: OfficeTicketView[] }>('/student/office-tickets'),
  activeOfficeTicket: () => api.get<{ ticket: OfficeTicketView | null }>('/student/office-tickets/active'),
  officeSummaries: () => api.get<{ offices: OfficeSummary[] }>('/student/offices'),
};

/* ----------------------------------------------------------------------- campus */

export const campusApi = {
  buildings: () => api.get<{ buildings: Building[] }>('/campus/buildings'),
  building: (idOrCode: string) => api.get<{ building: Building; floors: Floor[]; rooms: Room[] }>(`/campus/buildings/${idOrCode}`),
  rooms: (params?: { q?: string; per_page?: number }) => api.get<Paginated<Room>>('/campus/rooms', params),
  room: (idOrCode: string) => api.get<RoomDetail>(`/campus/rooms/${idOrCode}`),
  roomQueue: (roomId: string) => api.get<RoomQueueSnapshot>(`/campus/rooms/${roomId}/queue`),
  events: (params?: { per_page?: number }) => api.get<EventsPayload>('/campus/events', params),
  announcements: (params?: { per_page?: number }) => api.get<Paginated<Announcement>>('/campus/announcements', params),
};

/* --------------------------------------------------------------------- position */

/**
 * The camera. This is the capability that defines the mobile client: a code on a wall becomes a position,
 * and a position becomes an allowed action. It is registered for mobile only, so the identical endpoint
 * answered to a browser would be refused — which is why the web app has no scanner at all.
 */
export const positioningApi = {
  scan: (body: { payload?: string; code?: string; version?: number }) =>
    api.post<{ position: Position; qr_node: { code: string; label: string; room_code?: string | null } }>('/student/positioning/scan', body),
  current: () => api.get<{ position: Position | null }>('/student/positioning/current'),
  update: (body: { lat: number; lng: number; accuracy_m?: number | null; source?: string; floor_id?: string | null; plan_x?: number | null; plan_y?: number | null }) =>
    api.post<{ position: Position }>('/student/positioning/position', body),
  anchors: () => api.get<{ anchors: { id: string; code: string; label: string; building_code?: string; floor_name?: string }[] }>('/campus/positioning/anchors'),
};

/* ----------------------------------------------------------------------- queues */

/**
 * Standing in a line, from the door.
 *
 * `join` always carries an idempotency key: a corridor with one bar of signal is where duplicate tickets
 * are born, and the server replays the first answer for a repeated key instead of issuing a second place.
 * `checkIn` is accepted from this client and refused from a browser by default — checking in means *I am
 * physically here*, which a laptop cannot honestly claim.
 */
export const queueApi = {
  list: () => api.get<{ queues: QueueListItem[] }>('/campus/queues'),
  board: () => api.get<{ queues: QueueListItem[] }>('/student/queues/board'),
  detail: (id: string) => api.get<QueueListItem>(`/campus/queues/${id}`),
  join: (queueId: string, body: { qr_code?: string; fix?: Record<string, unknown>; note?: string } = {}) => {
    const key = newIdempotencyKey('join');
    return api.post<QueueTicketView>(`/student/queues/${queueId}/tickets`, { ...body, idempotency_key: key }, { 'idempotency-key': key });
  },
  joinByRoom: (roomId: string, body: { qr_code?: string; fix?: Record<string, unknown> } = {}) => {
    const key = newIdempotencyKey('join');
    return api.post<QueueTicketView>(`/student/rooms/${roomId}/queue/join`, { ...body, idempotency_key: key }, { 'idempotency-key': key });
  },
  ticket: (id: string) => api.get<QueueTicketView>(`/student/queue-tickets/${id}`),
  cancel: (id: string) => api.post<QueueTicketView>(`/student/queue-tickets/${id}/cancel`),
  leave: (id: string) => api.post<QueueTicketView>(`/student/queue-tickets/${id}/leave`),
  navigating: (id: string) => api.post<QueueTicketView>(`/student/queue-tickets/${id}/navigating`),
  checkIn: (id: string, body: { qr_code?: string; fix?: Record<string, unknown> } = {}) =>
    api.post<QueueTicketView>(`/student/queue-tickets/${id}/check-in`, body),
  proximityCheck: (id: string, body: { fix?: Record<string, unknown>; qr_code?: string }) =>
    api.post<{ within: boolean; distance_m: number; radius_m: number }>(`/student/queues/${id}/proximity-check`, body),
};

/* ---------------------------------------------------------------------- offices */

export const officeApi = {
  list: () => api.get<{ offices: OfficeSummary[] }>('/student/offices'),
  detail: (idOrCode: string) => api.get<OfficeSummary>(`/student/offices/${idOrCode}`),
  request: (officeId: string, body: { subject: string; notes?: string; qr_code?: string; fix?: Record<string, unknown> }) => {
    const key = newIdempotencyKey('office');
    return api.post<OfficeTicketView>(`/student/offices/${officeId}/tickets`, { ...body, idempotency_key: key }, { 'idempotency-key': key });
  },
  ticket: (id: string) => api.get<OfficeTicketView>(`/student/office-tickets/${id}`),
  history: (id: string) => api.get<{ events: { type: string; created_at: string; metadata: Record<string, unknown> | null }[] }>(`/student/office-tickets/${id}/history`),
  cancel: (id: string) => api.post<OfficeTicketView>(`/student/office-tickets/${id}/cancel`),
  checkIn: (id: string, body: { qr_code?: string; fix?: Record<string, unknown> } = {}) =>
    api.post<OfficeTicketView>(`/student/office-tickets/${id}/check-in`, body),
  // "I can see the queue, I am two minutes away" — a mobile-only signal, because it is about walking.
  approaching: (id: string) => api.post<OfficeTicketView>(`/student/office-tickets/${id}/approaching`),
};

/* ------------------------------------------------------------------- engagement */

export const engagementApi = {
  events: (params?: { per_page?: number }) => api.get<EventsPayload>('/campus/events', params),
  announcements: (params?: { per_page?: number }) => api.get<Paginated<Announcement>>('/campus/announcements', params),
  register: (id: string) => api.post<{ registration: { id: string } }>(`/student/events/${id}/register`, {}),
  unregister: (id: string) => api.delete<void>(`/student/events/${id}/register`),
};

/* ------------------------------------------------------------------- navigation */

export interface MobileRouteStep {
  index: number;
  instruction: string;
  kind: string;
  distance_m: number;
  floor_id?: string | null;
  floor_name?: string | null;
  node_id?: string | null;
}

export interface MobileRoute {
  steps: MobileRouteStep[];
  distance_m: number;
  duration_s: number;
  accessible: boolean;
  uses_stairs: boolean;
  origin: { label: string };
  destination: { label: string };
}

export interface NavigationSessionState {
  session_id: string;
  started_at: string;
  route: MobileRoute;
  destination_label: string;
}

export interface NavigationProgress {
  position: Position;
  navigation: {
    off_route: boolean;
    distance_from_route_m: number;
    tolerance_m: number;
    progress: number;
    remaining_m: number;
    current_step_index: number;
    instruction: string;
    arrived: boolean;
    recalculated: boolean;
    grace_seconds_remaining: number | null;
  };
}

/**
 * Live wayfinding. This whole group is the mobile half of navigation: a session you start where you are
 * standing, position pushed as you move, off-route recalculation, arrival. The web client may only
 * *preview* a route (`/campus/navigation/route`); starting a session requires `navigation.live`, which is
 * registered for this platform alone.
 */
export const navigationApi = {
  start: (body: { to_room_code?: string; to_room_id?: string; accessible?: boolean; from_node_id?: string }) =>
    api.post<NavigationSessionState>('/student/navigation/sessions', body),
  active: () => api.get<{ session: NavigationSessionState | null; position: Position | null }>('/student/navigation/sessions/active'),
  history: () => api.get<{ sessions: unknown[] }>('/student/navigation/sessions'),
  updatePosition: (sessionId: string, body: { lat: number; lng: number; accuracy_m?: number | null; source?: string }) =>
    api.post<NavigationProgress>(`/student/navigation/sessions/${sessionId}/position`, body),
  /**
   * Pause or resume the walk on the server, not just the timer on the screen.
   *
   * A student who stops at the vending machine should not be scored as dawdling, and a queue that is
   * watching their "navigating" ticket should not keep the place warm forever, so the state lives on the
   * session and this call is what moves it.
   */
  update: (sessionId: string, body: { action: 'pause' | 'resume' | 'reroute' | 'change_destination'; to_room_code?: string; accessible?: boolean }) =>
    api.patch<{ session: NavigationSessionState }>(`/student/navigation/sessions/${sessionId}`, body),
  complete: (sessionId: string) => api.post<{ status: string }>(`/student/navigation/sessions/${sessionId}/complete`),
  abandon: (sessionId: string) => api.post<{ status: string }>(`/student/navigation/sessions/${sessionId}/abandon`),
};

/* -------------------------------------------------------------------- assistant */

export const assistantApi = {
  send: (body: { message: string; conversation_id?: string; context?: { screen?: string; room?: string } }) => api.post<AiReply>('/ai/chat', body),
  conversations: () => api.get<{ conversations: { id: string; title: string | null; message_count?: number }[] }>('/ai/conversations'),
  /**
   * Which tools the assistant may offer *this role on this platform*. The suggestion chips on the
   * assistant screen come from here, so a phone is offered "start navigation" and never "configure a
   * queue", and a staff phone is offered neither — that difference is a server answer, not a client if.
   */
  capabilities: () => api.get<{ platform: string; role: string; tools: { id: string; label: string; needs: string }[]; note: string }>('/ai/capabilities'),
};

/* ---------------------------------------------------------------------- staff */

/**
 * Staff quick actions — the entire mobile surface for an operator.
 *
 * Call the next ticket, call a named ticket, check a student in on the word of the person at the desk,
 * admit, complete, mark a no-show, open or close a line, and verify who a registration number belongs to.
 * Nothing here configures a service, browses a timetable, or reads a student's history: those are web
 * console actions (`/staff/*` on the desktop) and the API will not accept them from this app's tokens
 * unless the permission registry says the platform allows them.
 */
export const staffApi = {
  dashboard: () => api.get<StaffMobileDashboard>('/staff/dashboard'),
  queues: () => api.get<{ queues: StaffMobileDashboard['queues'] }>('/staff/queues'),
  queueLine: (id: string) => api.get<StaffQueueLinePayload>(`/staff/queues/${id}/line`),
  callNext: (id: string) => api.post<{ called: StaffQueueLineRow }>(`/staff/queues/${id}/call-next`),
  setQueueOpen: (id: string, isOpen: boolean) => api.post<{ queue: { id: string; is_open: boolean } }>(`/staff/queues/${id}/open`, { is_open: isOpen }),
  callTicket: (ticketId: string) => api.post<{ ticket: StaffQueueLineRow }>(`/staff/queue-tickets/${ticketId}/call`),
  checkInTicket: (ticketId: string) => api.post<{ ticket: StaffQueueLineRow }>(`/staff/queue-tickets/${ticketId}/check-in`),
  admitTicket: (ticketId: string) => api.post<{ ticket: StaffQueueLineRow }>(`/staff/queue-tickets/${ticketId}/admit`),
  completeTicket: (ticketId: string) => api.post<{ ticket: StaffQueueLineRow }>(`/staff/queue-tickets/${ticketId}/complete`),
  noShowTicket: (ticketId: string, reason?: string) => api.post<{ ticket: StaffQueueLineRow }>(`/staff/queue-tickets/${ticketId}/no-show`, { reason }),
  offices: () => api.get<{ offices: StaffMobileDashboard['offices'] }>('/staff/offices'),
  officeLine: (id: string) => api.get<StaffOfficeLinePayload>(`/staff/offices/${id}/line`),
  officeCallNext: (id: string) => api.post<{ called: StaffOfficeLineRow }>(`/staff/offices/${id}/call-next`),
  officeCheckIn: (ticketId: string) => api.post<{ ticket: StaffOfficeLineRow }>(`/staff/office-tickets/${ticketId}/check-in`),
  officeStartService: (ticketId: string) => api.post<{ ticket: StaffOfficeLineRow }>(`/staff/office-tickets/${ticketId}/start-service`),
  officeNoShow: (ticketId: string) => api.post<{ ticket: StaffOfficeLineRow }>(`/staff/office-tickets/${ticketId}/no-show`),
  officeCallTicket: (ticketId: string) => api.post<{ ticket: StaffOfficeLineRow }>(`/staff/office-tickets/${ticketId}/call`),
  officeComplete: (ticketId: string) => api.post<{ ticket: StaffOfficeLineRow }>(`/staff/office-tickets/${ticketId}/complete`),
  /** Verification, not surveillance: who this number belongs to and what they have outstanding. */
  studentLookup: (registrationNo: string) => api.get<StaffStudentLookup>(`/staff/students/${encodeURIComponent(registrationNo)}`),
};

/* ---------------------------------------------------------------------- admin */

/**
 * Administration on a phone: look, and acknowledge. No editing — `GET /admin/alerts` and
 * `GET /admin/monitoring/summary` are the reads, `POST /admin/alerts/ack` is the only write, and the API
 * refuses everything else from this client because the admin console routes are web-scoped.
 */
export const adminApi = {
  alerts: () => api.get<{ alerts: AdminAlert[]; counts: { critical: number; warning: number; acknowledged: number }; generated_at: string }>('/admin/alerts'),
  acknowledge: (fingerprint: string, note?: string) => api.post<{ acknowledged: string }>('/admin/alerts/ack', { fingerprint, note: note ?? null }),
  monitoring: () => api.get<AdminMobileMonitoring>('/admin/monitoring/summary'),
};

export type { ServiceWindow };
