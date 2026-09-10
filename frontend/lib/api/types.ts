/**
 * Shared API contract types.
 *
 * These types mirror the backend JSON contract defined in `docs/API.md`.
 * The frontend and mobile apps consume exactly these shapes; the backend is
 * the authoritative source of truth.
 */

/** Standard envelope used by every CampusFlow API response. */
export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  /** Field-level validation errors, keyed by request field name. */
  errors?: Record<string, string[]>;
}

export interface Paginated<T> {
  data: T[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
}

export type Role = "visitor" | "student" | "staff" | "administrator";

export interface StudentProfile {
  id: string;
  matric_no: string;
  program: string;
  level: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  student?: StudentProfile;
}

export interface Session {
  token: string;
  user: User;
}

export type RoomType =
  | "classroom"
  | "lab"
  | "office"
  | "study"
  | "library"
  | "hall";

export interface BuildingSummary {
  id: string;
  name: string;
  short: string;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  building: BuildingSummary;
  floor: number;
  capacity: number;
  type: RoomType;
  status: "available" | "occupied" | "restricted";
}

export interface Course {
  id: string;
  code: string;
  name: string;
}

export type ClassSessionType = "lecture" | "lab" | "tutorial";

export interface ClassSession {
  id: string;
  course: Course;
  room: Room;
  starts_at: string; // ISO-8601
  ends_at: string; // ISO-8601
  instructor: string;
  type: ClassSessionType;
}

export interface NextClass extends ClassSession {
  minutes_until_start: number;
}

export type QueueTicketStatus = "waiting" | "approaching" | "called";

export interface OfficeSummary {
  id: string;
  name: string;
  building: string;
}

export interface QueueTicketSummary {
  id: string;
  ticket_no: string;
  office: OfficeSummary;
  position: number;
  people_ahead: number;
  estimated_wait_minutes: number;
  expected_window: string;
  status: QueueTicketStatus;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  category: string;
  published_at: string;
}

export interface CampusEvent {
  id: string;
  title: string;
  venue: string;
  starts_at: string;
  ends_at: string;
  category: string;
}

export interface DashboardPayload {
  greeting: string;
  today_count: number;
  next_class: NextClass | null;
  today_classes: ClassSession[];
  queue_ticket: QueueTicketSummary | null;
  announcements: Announcement[];
  nearby_rooms: Room[];
}

export interface TimetablePayload {
  date: string; // YYYY-MM-DD
  classes: ClassSession[];
}
