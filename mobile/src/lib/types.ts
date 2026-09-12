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

/**
 * One day in one room, as `GET /campus/rooms/{room}` computes it. No `opens_at`/`closes_at`: a room has no
 * opening hours in this campus, only a schedule — so what a student is told is whether the room is free
 * right now, what is in it, and when the next gap opens.
 */
export interface RoomAvailability {
  room_id: UUID;
  date: string;
  is_open: boolean;
  is_available_now: boolean;
  next_free_at: string | null;
  current_session: { course_code: string | null; course_title: string | null; starts_at: string; ends_at: string; session_type: string } | null;
  busy: { starts_at: string; ends_at: string; course_code: string | null; course_title: string | null; session_type: string }[];
  free_slots: { starts_at: string; ends_at: string }[];
  session_count: number;
  /** Presence from the admission queue, not seat count: `inside` is who the campus believes is in the room. */
  occupancy: { inside: number; capacity: number } | null;
  queue: { id: UUID; waiting: number; requires_proximity: boolean; is_active: boolean } | null;
  reason: string | null;
  headline: string;
}

export interface RoomDetail {
  room: Room;
  availability: RoomAvailability;
  week: { id: UUID; day_of_week: number; starts_at: string; ends_at: string; course_code: string | null; course_title: string | null; session_type: string }[];
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

/**
 * One line on the campus board — `GET /campus/queues`, `GET /campus/queues/{id}`, and the same object
 * embedded in a student's ticket view.
 *
 * The queue's own policy (radius, capacity, windows, no-show grace) is included because a student deciding
 * where to stand needs to know why a join was refused before they walk across campus for it.
 */
export interface QueueListItem {
  id: UUID;
  room_id: UUID;
  is_open: boolean;
  capacity: number;
  max_capacity: number | null;
  current_count: number;
  available: number;
  call_window_minutes: number | null;
  no_show_grace_minutes: number | null;
  proximity_radius_m: number;
  join_requires_proximity: boolean;
  allow_multiple_active_tickets: boolean;
  avg_service_minutes: number | null;
  mode: string | null;
  welcome_message: string | null;
  is_active: boolean;
  admission_capacity: number;
  avg_service_seconds: number;
  requires_proximity_to_join: boolean;
  check_in_window_seconds: number;
  room_code: string | null;
  room_name: string | null;
  building_code: string | null;
  building_name: string | null;
  floor_name: string | null;
  waiting: number;
  serving: number;
  my_ticket_id: UUID | null;
}

/** `GET /campus/rooms/{room}/queue` — the line outside a specific door. */
export interface RoomQueueSnapshot {
  queue: QueueListItem;
  room: Room;
  active_waiting: number;
  current_occupancy: number;
  max_capacity: number | null;
  my_ticket: QueueTicket | null;
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
  /** This caller's live ticket for that desk, if they hold one — the board and the desk screen read the same field. */
  my_ticket: OfficeTicketView | null;
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
  term: { code: string; name: string } | null;
  campus_snapshot: { open_queues: number; rooms_in_queue: number; enrolled_courses: number };
  /**
   * The verbs the server is willing to honour for this principal *on this platform*. The phone renders
   * its action sheet from this list — it never decides for itself that a student may do something.
   */
  quick_actions: { id: string; label: string; href: string; kind: string }[];
}

/** What an operator sees when they open the app standing in a corridor. */
/**
 * Staff mobile dashboard — `GET /staff/dashboard`.
 *
 * Note what is *not* here: no student timetable, no navigation, no QR "scan to see where a student is".
 * A staff phone answers one question — where is my line, and who do I call next — and this payload is
 * exactly that. The same role on the web console (`/staff/queues`, `/staff/analytics`) gets the operational
 * depth: history, windows, capacity, staffing.
 */
export interface StaffMobileDashboard {
  scopes: { queues: number; offices: number };
  queues: StaffQueueCard[];
  offices: StaffOfficeCard[];
  pending_queue_actions: StaffQueueAction[];
  pending_office_actions: StaffOfficeAction[];
  teaching_today: unknown[];
  kpis: { served_today: number; waiting_now: number; offices_open: number };
  campus_time: { date: string; dayOfWeek: number; time: string; minutes: number };
}

/** One room line the operator owns, with the ticket currently at the desk. */
export interface StaffQueueCard {
  queue_id: UUID;
  room_id: UUID | null;
  room_code: string | null;
  room_name: string | null;
  building_code: string | null;
  floor_name: string | null;
  is_active: boolean;
  admission_capacity: number;
  avg_service_seconds: number;
  max_size: number | null;
  proximity_radius_m: number | null;
  requires_proximity_to_join: boolean;
  waiting: number;
  occupying: number;
  checked_in: number;
  current: {
    id: UUID;
    ticket_number: string;
    position: number;
    status: string;
    student_name: string;
    issued_at: string | null;
    called_at: string | null;
    check_in_deadline: string | null;
    checked_in_at: string | null;
    eta_seconds: number | null;
    wait_seconds: number;
    checked_in: boolean;
  } | null;
}

/** One office line the operator is rostered on. */
export interface StaffOfficeCard {
  office_id: UUID;
  name: string;
  code: string;
  ticket_prefix: string;
  concurrent_capacity: number;
  service_duration_minutes: number;
  check_in_radius_m: number;
  is_active: boolean;
  building_code: string | null;
  floor_name: string | null;
  room_code: string | null;
  waiting: number;
  in_service: number;
  completed_today: number;
  current: {
    id: UUID;
    ticket_number: string;
    position: number;
    status: string;
    student_name: string;
    subject: string | null;
    requested_at: string | null;
    called_at: string | null;
    check_in_deadline: string | null;
    checked_in_at: string | null;
    service_started_at: string | null;
    wait_seconds: number;
    checked_in: boolean;
    service_minutes: number;
  } | null;
}

/** A ticket waiting on a decision from the person at the desk. */
export interface StaffQueueAction {
  id: UUID;
  ticket_number: string;
  status: string;
  position: number;
  check_in_deadline: string | null;
  student_name: string;
  room_code: string | null;
  room_name: string | null;
  queue_id: UUID;
}

export interface StaffOfficeAction {
  id: UUID;
  ticket_number: string;
  status: string;
  position: number;
  check_in_deadline: string | null;
  subject: string | null;
  student_name: string;
  office_id?: UUID;
  office_name?: string | null;
}

/**
 * A queue line, exactly as `GET /staff/queues/{id}/line` returns it: the queue configuration, the people in
 * it, and the counts that drive the header. Identity fields are present because the operator is calling
 * these students by name — a staff phone never browses a student's history from here.
 */
export interface StaffQueueLineRow {
  id: UUID;
  queue_id: UUID;
  room_id: UUID | null;
  room_code: string | null;
  room_name: string | null;
  position: number;
  status: string;
  join_source: string | null;
  joined_at: string | null;
  called_at: string | null;
  checked_in_at: string | null;
  admitted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  ticket_number: string;
  check_in_deadline: string | null;
  seconds_until_deadline: number | null;
  can_check_in: boolean;
  can_cancel: boolean;
  user_name: string | null;
  user_email: string | null;
}

export interface StaffQueueLinePayload {
  queue: {
    id: UUID;
    room_id: UUID;
    is_open: boolean;
    capacity: number;
    max_capacity: number | null;
    current_count: number;
    available: number;
    call_window_minutes: number | null;
    no_show_grace_minutes: number | null;
    proximity_radius_m: number | null;
    join_requires_proximity: boolean;
    allow_multiple_active_tickets: boolean;
    avg_service_minutes: number | null;
    mode: string | null;
    welcome_message: string | null;
    room_code: string | null;
    room_name: string | null;
  };
  line: StaffQueueLineRow[];
  counts: { waiting: number; called: number; checked_in: number };
}

export interface StaffOfficeLineRow {
  id: UUID;
  office_id: UUID;
  office_name: string | null;
  office_code: string | null;
  ticket_number: string;
  subject: string | null;
  notes: string | null;
  status: string;
  window_id: UUID | null;
  sequence_no: number | null;
  position: number;
  join_source: string | null;
  joined_at: string | null;
  called_at: string | null;
  service_started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  user_name: string | null;
  user_email: string | null;
}

export interface StaffOfficeLinePayload {
  office: {
    id: UUID;
    code: string;
    name: string;
    is_open: boolean;
    status: string;
    ticket_prefix: string;
    avg_service_minutes: number | null;
    service_duration_minutes: number;
    daily_capacity: number | null;
    requires_proximity_to_request: boolean;
    grace_period_seconds: number;
    building_code: string | null;
    floor_name: string | null;
    room_code: string | null;
  };
  line: StaffOfficeLineRow[];
  windows: ServiceWindow[];
  counts: { waiting: number; called: number; in_service: number };
}

/** `GET /staff/students/{registrationNo}` — verification, not browsing. */
export interface StaffStudentLookup {
  student: {
    name: string;
    registration_no: string | null;
    program: string | null;
    department: string | null;
    year_level: string | null;
    status: string | null;
  };
  queue_tickets: { ticket_number: string; status: string; room_code: string | null; position: number }[];
  office_tickets: { ticket_number: string; status: string; office: string | null }[];
}

/** The whole of administration on a phone: what is wrong, and whether you have looked at it yet. */
export interface AdminMobileMonitoring {
  generated_at: string;
  queues: { open: number; waiting_now: number; issued_today: number; served_today: number; no_show_rate_today: number | null };
  offices: { open: number; waiting_now: number; completed_today: number };
  platform: { active_queues: number; navigation_today: number; unacknowledged_alerts: number; users: number };
}

export interface AdminAlert {
  key: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  target?: string;
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
