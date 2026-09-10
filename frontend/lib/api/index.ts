/**
 * Typed endpoint functions. Components import these instead of raw fetch().
 * Each maps 1:1 to a documented endpoint in `docs/API.md`.
 */

import { apiRequest } from "./client";
import type {
  DashboardPayload,
  Paginated,
  Room,
  Session,
  TimetablePayload,
  User,
} from "./types";

export interface LoginCredentials {
  email: string;
  password: string;
}

export const authApi = {
  login: (credentials: LoginCredentials) =>
    apiRequest<Session>("/auth/login", { method: "POST", body: credentials }),

  logout: () => apiRequest<null>("/auth/logout", { method: "POST" }),

  me: () => apiRequest<User>("/me"),
};

export const studentApi = {
  dashboard: () => apiRequest<DashboardPayload>("/student/dashboard"),

  timetable: (date?: string) =>
    apiRequest<TimetablePayload>(
      `/student/timetable${date ? `?date=${date}` : ""}`,
    ),
};

export const roomsApi = {
  search: (query?: string) =>
    apiRequest<Paginated<Room>>(`/rooms${query ? `?query=${encodeURIComponent(query)}` : ""}`),
};
