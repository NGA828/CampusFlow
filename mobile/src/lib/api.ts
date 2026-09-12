/**
 * The single HTTP client for the CampusFlow mobile app.
 *
 * Mirrors the web client: every request goes through `EXPO_PUBLIC_API_URL`, the
 * `{ success, data, message }` envelope is unwrapped here, and mutations that must not run twice
 * carry an idempotency key. No screen calls `fetch`/`axios` directly.
 */
import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type {
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
  Room,
  RoomDetail,
  ServiceWindow,
  SessionInfo,
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

const http = axios.create({
  baseURL: API_BASE,
  timeout: 20_000,
  headers: { accept: 'application/json' },
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
  me: () => api.get<{ user: User }>('/auth/me'),
  updateProfile: (body: { name?: string; phone?: string | null; department?: string | null }) => api.patch<{ user: User }>('/me', body),
};

/* ---------------------------------------------------------------------- student */

export const meApi = {
  dashboard: () => api.get<DashboardPayload>('/me/dashboard'),
  timetable: () => api.get<TimetableWeek>('/me/timetable'),
  queueTicket: () => api.get<{ ticket: QueueTicketView | null }>('/me/queue-tickets/active'),
  officeTicket: () => api.get<{ ticket: OfficeTicketView | null }>('/me/office-tickets/active'),
  officeSummaries: () => api.get<{ offices: OfficeSummary[] }>('/me/offices/summary'),
  notifications: (params?: { per_page?: number }) => api.get<{ items: NotificationRow[]; unread: number }>('/me/notifications', params),
  readNotification: (id: string) => api.post<{ unread: number }>(`/me/notifications/${id}/read`),
  readAllNotifications: () => api.post<{ unread: number }>('/me/notifications/read-all'),
  registerDevice: (body: { token: string; platform: 'ios' | 'android' | 'web' }) => api.post<{ registered: boolean }>('/me/devices', body),
};

/* ----------------------------------------------------------------------- campus */

export const campusApi = {
  buildings: () => api.get<{ buildings: Building[] }>('/buildings'),
  building: (idOrCode: string) => api.get<{ building: Building; floors: Floor[]; rooms: Room[] }>(`/buildings/${idOrCode}`),
  rooms: (params?: { q?: string; per_page?: number }) => api.get<Paginated<Room>>('/rooms', params),
  room: (idOrCode: string) => api.get<RoomDetail>(`/rooms/${idOrCode}`),
};

/* --------------------------------------------------------------------- position */

export const positioningApi = {
  scan: (body: { payload?: string; code?: string }) => api.post<{ position: Position }>('/positioning/scan', body),
  current: () => api.get<{ position: Position | null }>('/positioning/current'),
  update: (body: { lat: number; lng: number; accuracy_m?: number | null; source?: string }) => api.post<{ position: Position }>('/positioning/position', body),
  anchors: () => api.get<{ anchors: { id: string; code: string; label: string; building_code?: string; floor_name?: string }[] }>('/positioning/anchors'),
};

/* ----------------------------------------------------------------------- queues */

export const queueApi = {
  list: () => api.get<{ queues: QueueListItem[] }>('/queues'),
  detail: (id: string) => api.get<{ queue: QueueListItem; my_ticket_id: string | null; counts: { waiting: number; in_service: number } }>(`/queues/${id}`),
  roomQueue: (roomId: string) => api.get<{ queue: QueueListItem; my_ticket_id: string | null }>(`/rooms/${roomId}/queue`),
  join: (queueId: string, body: { qr_code?: string; fix?: Record<string, unknown> } = {}) =>
    api.post<{ ticket: { id: string; ticket_number: string } }>(`/queues/${queueId}/tickets`, body, { 'idempotency-key': newIdempotencyKey('join') }),
  ticket: (id: string) => api.get<{ ticket: QueueTicketView }>(`/queue-tickets/${id}`),
  cancel: (id: string) => api.post<{ ticket: QueueTicketView }>(`/queue-tickets/${id}/cancel`),
  checkIn: (id: string, body: { qr_code?: string; fix?: Record<string, unknown> } = {}) => api.post<{ ticket: QueueTicketView }>(`/queue-tickets/${id}/check-in`, body),
  proximityCheck: (id: string, body: { fix?: Record<string, unknown>; qr_code?: string }) => api.post<{ within: boolean; distance_m: number; radius_m: number }>(`/queues/${id}/proximity-check`, body),
};

/* ---------------------------------------------------------------------- offices */

export const officeApi = {
  list: () => api.get<{ offices: OfficeSummary[]; my_ticket: OfficeTicketView | null }>('/offices'),
  detail: (idOrCode: string) => api.get<OfficeSummary & { my_ticket: OfficeTicketView | null }>(`/offices/${idOrCode}`),
  request: (officeId: string, body: { subject: string; notes?: string; qr_code?: string; fix?: Record<string, unknown> }) =>
    api.post<OfficeTicketView>(`/offices/${officeId}/tickets`, body, { 'idempotency-key': newIdempotencyKey('office') }),
  ticket: (id: string) => api.get<OfficeTicketView>(`/office-tickets/${id}`),
  cancel: (id: string) => api.post<OfficeTicketView>(`/office-tickets/${id}/cancel`),
  checkIn: (id: string, body: { qr_code?: string; fix?: Record<string, unknown> } = {}) => api.post<OfficeTicketView>(`/office-tickets/${id}/check-in`, body),
};

/* ------------------------------------------------------------------- engagement */

export const engagementApi = {
  events: (params?: { per_page?: number }) => api.get<EventsPayload>('/events', params),
  announcements: (params?: { per_page?: number }) => api.get<Paginated<Announcement>>('/announcements', params),
  register: (id: string) => api.post<{ registration: { id: string } }>(`/events/${id}/register`, {}),
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

export const navigationApi = {
  start: (body: { to_room_code?: string; to_room_id?: string; accessible?: boolean; from_node_id?: string }) =>
    api.post<NavigationSessionState>('/navigation/sessions', body),
  active: () => api.get<{ session: NavigationSessionState | null; position: Position | null }>('/navigation/sessions/active'),
  updatePosition: (sessionId: string, body: { lat: number; lng: number; accuracy_m?: number | null; source?: string }) =>
    api.post<NavigationProgress>(`/navigation/sessions/${sessionId}/position`, body),
  complete: (sessionId: string) => api.post<{ status: string }>(`/navigation/sessions/${sessionId}/complete`),
  abandon: (sessionId: string) => api.post<{ status: string }>(`/navigation/sessions/${sessionId}/abandon`),
};

/* -------------------------------------------------------------------- assistant */

export const assistantApi = {
  send: (body: { message: string; conversation_id?: string }) => api.post<AiReply>('/ai/messages', body),
  tools: () => api.get<{ provider: string; model: string | null; tools: { name: string; description: string }[] }>('/ai/tools'),
};

export type { ServiceWindow };
