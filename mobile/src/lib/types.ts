/**
 * Types shared by the CampusFlow mobile screens.
 *
 * These mirror the API contracts used by the web app (`frontend/lib/api/types.ts`); the mobile
 * client is deliberately thin and only declares what the screens consume.
 */

export type UUID = string;
export type Role = 'visitor' | 'student' | 'staff' | 'admin';

export interface User {
  id: UUID;
  name: string;
  email: string;
  role_code: Role;
  status: string;
  registration_no: string | null;
  department: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  permissions: string[];
}

export interface SessionInfo {
  token: string;
  expires_at: string;
  user: User;
}

export interface Building {
  id: UUID;
  code: string;
  name: string;
  description: string | null;
  campus_name: string | null;
  lat: number;
  lng: number;
  footprint: [number, number][] | null;
  has_elevator: boolean;
  is_public: boolean;
  status: 'operational' | 'limited' | 'closed' | 'maintenance';
  floor_count?: number;
  room_count?: number;
}

export interface Floor {
  id: UUID;
  building_id: UUID;
  level: number;
  name: string;
  plan_width: number;
  plan_height: number;
  plan_units: string;
}

export interface Room {
  id: UUID;
  building_id: UUID;
  floor_id: UUID;
  code: string;
  name: string;
  room_type: string;
  capacity: number;
  requires_admission: boolean;
  plan_x: number;
  plan_y: number;
  plan_w: number;
  plan_h: number;
  lat: number | null;
  lng: number | null;
  amenities: string[];
  accessibility: string[];
  status: string;
  building_code?: string;
  building_name?: string;
  floor_name?: string;
  floor_level?: number;
}

export interface RoomAvailability {
  is_open: boolean;
  is_available_now: boolean;
  next_free_at: string | null;
  current_session: { course_code: string; course_title: string; ends_at: string } | null;
  busy: boolean;
  free_slots: { starts_at: string; ends_at: string }[];
  occupancy: { enrolled: number; capacity: number } | null;
  headline: string;
}

export interface RoomDetail {
  room: Room;
  availability: RoomAvailability;
  week: { day_of_week: number; starts_at: string; ends_at: string; course_code: string; course_title: string; session_type: string }[];
}

export interface TimetableEntry {
  id: UUID;
  day_of_week: number;
  session_type: string;
  starts_at: string;
  ends_at: string;
  course_code: string;
  course_title: string;
  course_colour: string | null;
  room_id: UUID | null;
  room_code: string | null;
  room_name: string | null;
  building_code: string | null;
  floor_name: string | null;
  lecturer: string | null;
  date: string;
  starts_at_iso: string;
  ends_at_iso: string;
  is_now: boolean;
  is_next: boolean;
  minutes_until: number | null;
}

export interface TimetableWeek {
  term: string;
  week_start: string;
  dates: string[];
  entries: TimetableEntry[];
}

export interface QueueListItem {
  id: UUID;
  room_id: UUID;
  is_active: boolean;
  admission_capacity: number;
  avg_service_seconds: number;
  proximity_radius_m: number;
  requires_proximity_to_join: boolean;
  check_in_window_seconds: number;
  opens_at: string | null;
  closes_at: string | null;
  notes: string | null;
  room_code: string;
  room_name: string;
  building_code: string;
  building_name: string;
  floor_name: string;
  waiting: number;
  serving: number;
  my_ticket_id: UUID | null;
}

export interface QueueTicket {
  id: UUID;
  ticket_number: string;
  position: number;
  status: string;
  issued_at: string;
  called_at: string | null;
  eta_seconds: number | null;
  room_code?: string;
  room_name?: string;
}

export interface QueueTicketView {
  ticket: QueueTicket;
  queue: {
    id: UUID;
    room_id: UUID;
    is_active: boolean;
    admission_capacity: number;
    avg_service_seconds: number;
    proximity_radius_m: number;
    requires_proximity_to_join: boolean;
    check_in_window_seconds: number;
    grace_period_seconds: number;
    room_code?: string;
    room_name?: string;
    building_code?: string;
    floor_name?: string;
  };
  people_ahead: number;
  counts: { waiting: number; in_service: number };
  eta_seconds: number;
  expected_service_at: string;
  check_in_deadline: string | null;
  seconds_until_deadline: number | null;
  can_check_in: boolean;
  can_cancel: boolean;
}

export interface ServiceWindow {
  id: UUID;
  office_id: UUID;
  day_of_week: number;
  opens_at: string;
  closes_at: string;
  capacity: number;
  avg_service_minutes: number;
  is_active: boolean;
}

export interface Office {
  id: UUID;
  code: string;
  name: string;
  description: string | null;
  ticket_prefix: string;
  service_duration_minutes: number;
  concurrent_capacity: number;
  daily_capacity: number | null;
  check_in_radius_m: number;
  requires_proximity_to_request: boolean;
  requires_appointment: boolean;
  contact_email: string | null;
  building_code?: string;
  building_name?: string;
  room_code?: string | null;
  floor_name?: string | null;
  waiting?: number;
  in_service?: number;
  is_open_now?: boolean;
  opens_at?: string | null;
  closes_at?: string | null;
}

export interface OfficeSummary {
  office: Office;
  windows: ServiceWindow[];
  today_windows: ServiceWindow[];
  is_open_now: boolean;
  opens_at: string | null;
  closes_at: string | null;
  next_opening: string | null;
  counts: { waiting: number; in_service: number; checked_in: number; completed_today: number };
  average_service_minutes: number;
  next_ticket_number: string;
  estimated_wait_minutes: number;
  expected_window: { starts_at: string; ends_at: string } | null;
  daily_capacity_used: number;
  daily_capacity: number | null;
  staff: { id: UUID; name: string; role: string }[];
}

export interface OfficeTicket {
  id: UUID;
  ticket_number: string;
  subject: string;
  status: string;
  position: number;
  issued_at: string;
  eta_seconds: number | null;
  expected_service_at: string | null;
}

export interface OfficeTicketView {
  ticket: OfficeTicket;
  office: Office;
  people_ahead: number;
  counts: { waiting: number; in_service: number };
  eta_seconds: number;
  expected_window: { starts_at: string; ends_at: string } | null;
  seconds_until_deadline: number | null;
  can_check_in: boolean;
  can_cancel: boolean;
  status_label: string;
}

export interface NotificationRow {
  id: UUID;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  priority: string;
  read_at: string | null;
  created_at: string;
}

export interface Announcement {
  id: UUID;
  title: string;
  body: string;
  priority: 'normal' | 'high' | 'urgent';
  is_pinned: boolean;
  building_code?: string | null;
  author_name?: string | null;
  published_at: string | null;
}

export interface CampusEvent {
  id: UUID;
  title: string;
  description: string | null;
  category: string;
  starts_at: string;
  ends_at: string | null;
  venue: string | null;
  building_code?: string | null;
  room_code?: string | null;
  status: string;
  registered?: boolean;
}

export interface Position {
  lat: number;
  lng: number;
  plan_x: number | null;
  plan_y: number | null;
  building_id: UUID | null;
  floor_id: UUID | null;
  source: string;
  accuracy_m: number | null;
  updated_at: string;
  building_name?: string | null;
  floor_name?: string | null;
}

export interface DashboardPayload {
  user: { id: UUID; name: string; role: Role; department: string | null };
  today: { date: string; entries: TimetableEntry[] };
  next_class: TimetableEntry | null;
  queue_ticket: QueueTicketView | null;
  office_ticket: OfficeTicketView | null;
  notifications: NotificationRow[];
  unread_notifications: number;
  announcements: Announcement[];
  events: CampusEvent[];
  building_alerts: { id: UUID; code: string; name: string; status: string }[];
  position: Position | null;
}

export interface AiMessage {
  id: UUID;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  tool_calls?: { name: string; ok: boolean }[] | null;
}

export interface AiReply {
  conversation_id: UUID;
  provider: 'deterministic' | 'llm';
  model: string | null;
  intent: string;
  message: AiMessage;
  latency_ms: number;
}

export interface Paginated<T> {
  items: T[];
  meta: { page: number; per_page: number; total: number; total_pages: number };
}

export interface EventsPayload {
  items: CampusEvent[];
  meta: { page: number; per_page: number; total: number; total_pages: number };
  upcoming?: CampusEvent[];
}
