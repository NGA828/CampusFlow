/**
 * API contracts for the web and mobile clients.
 *
 * Field names are the web-client contract for the authoritative Laravel API. Anything
 * optional is genuinely optional in the API.
 */

export type Role = 'visitor' | 'student' | 'staff' | 'admin';
export type UUID = string;

export interface StaffAssignment {
  id: UUID;
  scope_type: 'building' | 'room' | 'office' | 'queue';
  scope_id: UUID;
  scope_label?: string | null;
  scope_name?: string | null;
  user_id?: UUID;
  user_name?: string;
  user_email?: string;
  role_in_scope: string;
  can_manage_timetable: boolean;
  can_publish_content: boolean;
  can_call_tickets: boolean;
}

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
  email_verified_at: string | null;
  last_login_at: string | null;
  created_at: string;
  permissions: string[];
  assignments?: StaffAssignment[];
}

export interface SessionInfo {
  token: string;
  expires_at: string;
  user: User;
}

/* --------------------------------------------------------------------- campus */

export interface Building {
  id: UUID;
  code: string;
  name: string;
  description: string | null;
  campus_name: string | null;
  address: string | null;
  lat: number;
  lng: number;
  footprint: [number, number][] | null;
  has_elevator: boolean;
  is_public: boolean;
  status: 'operational' | 'limited' | 'closed' | 'maintenance';
  opening_hours: Record<string, string> | null;
  floor_count?: number;
  room_count?: number;
  floors?: Floor[];
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
  /** Current Laravel room payload; older clients may expose room_type/amenities. */
  type?: string;
  features?: string[];
  id: UUID;
  building_id: UUID;
  floor_id: UUID;
  code: string;
  name: string;
  room_type: 'lecture' | 'lab' | 'study' | 'office' | 'library' | 'auditorium' | 'meeting' | 'service' | 'other';
  capacity: number;
  description: string | null;
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
  floor_level?: number;
  floor_name?: string;
}

/**
 * One day in one room, as `GET /campus/rooms/{room}` and `/availability` compute it.
 *
 * There is no `opens_at`/`closes_at` here because a room has no opening hours in this campus's data
 * model — hours belong to a building or a service desk. What a room can answer truthfully is what is
 * scheduled in it, whether that is happening right now, and when the next gap opens.
 */
export interface RoomAvailability {
  room_id: UUID;
  date: string;
  is_open: boolean;
  is_available_now: boolean;
  next_free_at: string | null;
  current_session: { course_code: string | null; course_title: string | null; starts_at: string; ends_at: string; session_type: string } | null;
  /** The day's sessions, in order — `busy.length` is how many, and each block names the course. */
  busy: { starts_at: string; ends_at: string; course_code: string | null; course_title: string | null; session_type: string }[];
  free_slots: { starts_at: string; ends_at: string }[];
  session_count: number;
  /** Presence, not seats: `inside` is the admission queue's count, `capacity` its admission limit. */
  occupancy: { inside: number; capacity: number } | null;
  queue: { id: UUID; waiting: number; requires_proximity: boolean; is_active: boolean } | null;
  reason: string | null;
  headline: string;
}

/** A single day from the seven-day strip: the same truth, without the labels of who is inside. */
export interface RoomDayAvailability {
  date: string;
  status: string;
  is_free: boolean;
  is_free_now: boolean | null;
  busy_until: string | null;
  session_count: number;
  sessions: { type: string; starts_at: string; ends_at: string; course_code?: string; course_title?: string; lecturer_name?: string }[];
  reason: string | null;
}

/**
 * `GET /campus/rooms/{room}` — the room, today, the week ahead and the seven-day strip.
 *
 * The shape is `{ room, availability, days, week }` rather than a flat room object with fields bolted on,
 * so both clients read the availability block from one place: the phone shows the headline and the free
 * slots, the browser shows the same plus the pattern table, and neither invents a day.
 */
export interface RoomDetail {
  room: Room;
  availability: RoomAvailability;
  days: Record<string, RoomDayAvailability>;
  week: { id: UUID; day_of_week: number; starts_at: string; ends_at: string; course_code: string | null; course_title: string | null; session_type: string }[];
}

export interface NavigationNode {
  id: UUID;
  code: string;
  label: string;
  kind: 'corridor' | 'entrance' | 'stairs' | 'elevator' | 'room' | 'junction' | 'outdoor' | 'service';
  building_id: UUID | null;
  floor_id: UUID | null;
  floor_level?: number | null;
  plan_x: number | null;
  plan_y: number | null;
  lat: number | null;
  lng: number | null;
  is_accessible: boolean;
  is_active: boolean;
}

export interface NavigationEdge {
  id: UUID;
  from_node_id: UUID;
  to_node_id: UUID;
  kind: 'corridor' | 'stairs' | 'elevator' | 'ramp' | 'outdoor' | 'door' | 'service';
  distance_m: number;
  bidirectional: boolean;
  is_accessible: boolean;
  is_active: boolean;
  floor_change: boolean;
}

export interface QrNode {
  id: UUID;
  code: string;
  label: string;
  building_id: UUID;
  floor_id: UUID;
  room_id: UUID | null;
  nav_node_id: UUID | null;
  plan_x: number;
  plan_y: number;
  lat: number;
  lng: number;
  version: number;
  is_active: boolean;
  scans_count?: number;
  last_scanned_at?: string | null;
  building_code?: string;
  building_name?: string;
  floor_name?: string;
  floor_level?: number;
  room_code?: string | null;
  room_name?: string | null;
  office_id?: UUID | null;
  office_name?: string | null;
}

export interface Geofence {
  id: UUID;
  name: string;
  target_type: 'room' | 'office' | 'building' | 'qr_node';
  target_id: UUID;
  center_lat: number;
  center_lng: number;
  radius_m: number;
  purpose: 'queue_join' | 'check_in' | 'presence' | 'navigation';
  is_active: boolean;
}

export interface FloorPlanPayload {
  floor: Floor;
  building: Pick<Building, 'id' | 'code' | 'name' | 'lat' | 'lng' | 'has_elevator'> & { floor_count?: number };
  rooms: Room[];
  qr_nodes: QrNode[];
  navigation_nodes: NavigationNode[];
  navigation_edges: NavigationEdge[];
  geofences: Geofence[];
  busy: Record<string, { starts_at: string; ends_at: string; course_code?: string }[]>;
}

export interface Position {
  id?: UUID;
  user_id?: UUID;
  lat: number;
  lng: number;
  plan_x: number | null;
  plan_y: number | null;
  building_id: UUID | null;
  floor_id: UUID | null;
  nav_node_id?: UUID | null;
  qr_node_id?: UUID | null;
  source: string;
  accuracy_m: number | null;
  updated_at: string;
  expires_at?: string;
  building_code?: string | null;
  building_name?: string | null;
  floor_name?: string | null;
  floor_level?: number | null;
}

/* ---------------------------------------------------------------- navigation */

export interface RouteStep {
  index: number;
  instruction: string;
  kind: string;
  distance_m: number;
  duration_s: number;
  floor_id?: UUID | null;
  floor_name?: string | null;
  compass?: string | null;
}

export interface RouteLeg {
  floor_id: UUID | null;
  floor_name: string | null;
  floor_level: number | null;
  building_code: string | null;
  distance_m: number;
  duration_s: number;
  points: { x: number; y: number }[];
  geo: { lat: number; lng: number }[];
}

export interface Route {
  nodes: NavigationNode[];
  steps: RouteStep[];
  legs: RouteLeg[];
  transitions: { kind: string; instruction: string; floor_name?: string | null; distance_m?: number }[];
  distance_m: number;
  duration_s: number;
  accessible: boolean;
  uses_stairs: boolean;
  origin: { label: string; node?: NavigationNode | null };
  destination: { label: string; node?: NavigationNode | null; room_id?: UUID | null };
}

export interface RouteProgress {
  off_route: boolean;
  distance_from_route_m: number;
  tolerance_m: number;
  progress: number;
  travelled_m: number;
  remaining_m: number;
  current_step: RouteStep | null;
  current_step_index: number;
  arrived: boolean;
  floor_id: UUID | null;
  should_recalculate?: boolean;
  off_route_seconds?: number;
}

export interface NavigationWalking {
  session_id: UUID;
  off_route: boolean;
  distance_from_route_m: number;
  tolerance_m: number;
  progress: number;
  remaining_m: number;
  current_step_index: number;
  instruction: string | null;
  arrived: boolean;
  recalculated: boolean;
  grace_seconds_remaining: number | null;
}

export interface NavigationDeviation {
  id: UUID;
  status: string;
  detections: number;
  max_distance_m: number;
  first_detected_at: string;
}

/* -------------------------------------------------------------------- queues */

export interface QueueCounts {
  waiting: number;
  occupying?: number;
  line?: number;
  checked_in?: number;
  serving?: number;
  capacity?: number;
  admission_capacity?: number;
  estimate_seconds?: number;
}

export interface QueueTicket {
  id: UUID;
  queue_id: UUID;
  room_id: UUID;
  student_id?: UUID;
  ticket_number: string;
  sequence_no?: number;
  position: number;
  status: string;
  priority?: number;
  issued_at: string;
  called_at: string | null;
  check_in_deadline: string | null;
  checked_in_at: string | null;
  admitted_at: string | null;
  no_show_at?: string | null;
  cancelled_at?: string | null;
  expired_at?: string | null;
  completed_at?: string | null;
  eta_seconds: number | null;
  room_code?: string;
  room_name?: string;
  building_code?: string | null;
  floor_name?: string | null;
  student_name?: string;
}

export interface QueueTicketView {
  ticket: QueueTicket;
  queue: {
    id: UUID;
    room_id: UUID;
    is_active: boolean;
    max_size: number;
    admission_capacity: number;
    avg_service_seconds: number;
    proximity_radius_m: number;
    requires_proximity_to_join: boolean;
    check_in_window_seconds: number;
    grace_period_seconds: number;
    opens_at: string | null;
    closes_at: string | null;
    notes: string | null;
    room_code: string;
    room_name: string;
    room_capacity?: number;
    building_id?: UUID;
    building_code?: string;
    building_name?: string;
    floor_id?: UUID;
    floor_name?: string;
    floor_level?: number;
    room_plan_x?: number;
    room_plan_y?: number;
  };
  people_ahead: number;
  counts: QueueCounts;
  eta_seconds: number;
  expected_service_at: string;
  check_in_deadline: string | null;
  seconds_until_deadline: number | null;
  can_check_in: boolean;
  can_navigate?: boolean;
  can_cancel: boolean;
}

export interface QueueListItem {
  max_capacity?: number | null;
  id: UUID;
  room_id: UUID;
  is_active: boolean;
  max_size: number;
  admission_capacity: number;
  avg_service_seconds: number;
  proximity_radius_m: number;
  requires_proximity_to_join: boolean;
  check_in_window_seconds: number;
  grace_period_seconds: number;
  opens_at: string | null;
  closes_at: string | null;
  notes: string | null;
  room_code: string;
  room_name: string;
  room_capacity: number;
  plan_x: number;
  plan_y: number;
  building_id: UUID;
  building_code: string;
  building_name: string;
  floor_id: UUID;
  floor_name: string;
  floor_level: number;
  waiting: number;
  serving: number;
  my_ticket_id: UUID | null;
}

export interface QueueSnapshot {
  queue: QueueListItem;
  room: Room;
  counts: QueueCounts;
  availability: RoomAvailability;
  line: { position: number; status: string; eta_seconds: number | null; issued_at: string; called_at: string | null }[];
  my_ticket_id: UUID | null;
}

/* ------------------------------------------------------------------- offices */

export interface ServiceWindow {
  id: UUID;
  office_id: UUID;
  name: string;
  label: string;
  day_of_week: number;
  opens_at: string;
  closes_at: string;
  capacity: number;
  avg_service_minutes: number;
  is_active: boolean;
  status: string;
  served_by?: string | null;
}


export interface Office {
  id: UUID;
  code: string;
  name: string;
  description: string | null;
  building_id: UUID | null;
  floor_id: UUID | null;
  room_id: UUID | null;
  ticket_prefix: string;
  /**
   * `avg_service_minutes` in storage; the console calls it service duration. The model exposes both
   * names so an admin edit and a student wait estimate can never be reading different numbers.
   */
  service_duration_minutes: number;
  avg_service_minutes?: number;
  concurrent_capacity: number;
  daily_capacity: number | null;
  check_in_radius_m: number;
  grace_period_seconds: number;
  requires_proximity_to_request: boolean;
  requires_appointment: boolean;
  contact_email: string | null;
  contact_phone?: string | null;
  is_active: boolean;
  is_open: boolean;
  opening_hours: string | null;
  building_code?: string | null;
  building_name?: string | null;
  room_code?: string | null;
  room_name?: string | null;
  room_lat?: number | null;
  room_lng?: number | null;
  floor_name?: string | null;
  /** Live figures resolved by the list and detail endpoints. */
  waiting?: number;
  in_service?: number;
  daily_capacity_used?: number;
}


/**
 * `GET /student/offices` and `GET /student/offices/{code}` — the shape built once by
 * `BuildsOfficeSummaries` on the server.
 *
 * Every field here is persisted state: windows come from `office_service_windows`, counts from the
 * live line, the capacity figures from the office's own configuration. The client no longer receives a
 * suggested "expected window" invented at render time, and there is no field the API does not compute.
 */
/**
 * Admin console row for an office: the stored configuration plus the live figures the operator needs to
 * judge whether the desk is actually running (`GET /admin/offices`).
 */
export type AdminOfficeRow = Office & {
  is_open_now: boolean;
  waiting: number;
  in_service: number;
  estimated_wait_minutes: number;
};

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
  daily_capacity: number | null;
  daily_capacity_used: number;
  grace_period_seconds: number;
  requires_appointment: boolean;
  staff: { id: UUID; name: string; role: string }[];
  my_ticket: OfficeTicket | null;
  /** Detail endpoint only: today's line, numbers and states, never student names. */
  today_in_line?: { position: number; ticket_number: string; status: string; called_at: string | null }[];
}


export interface OfficeTicket {
  /** Raw Laravel ticket timestamps and directory identity. */
  joined_at?: string | null;
  issued_at?: string | null;
  office_name?: string | null;
  office_code?: string | null;
  id: UUID;
  office_id: UUID;
  student_id: UUID;
  ticket_number: string;
  sequence_no?: number;
  position: number;
  status: string;
  subject: string | null;
  notes: string | null;
  requested_at: string;
  called_at: string | null;
  check_in_deadline: string | null;
  checked_in_at: string | null;
  service_started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  no_show_at: string | null;
  expired_at?: string | null;
  service_minutes: number | null;
  window_starts_at: string | null;
  window_ends_at: string | null;
  eta_seconds: number | null;
  handled_by?: UUID | null;
  office?: Office;
  student_name?: string;
}

export interface OfficeTicketView {
  check_in_deadline?: string | null;
  ticket: OfficeTicket;
  office: Office;
  people_ahead: number;
  counts: { waiting: number; in_service: number };
  eta_seconds: number;
  expected_window: { starts_at: string; ends_at: string } | null;
  seconds_until_deadline: number | null;
  /**
   * Capability flags, resolved server-side through the ticket's policy — they fold in role, ownership
   * *and* platform. A screen renders its buttons from these rather than guessing from `status`, which
   * is how the web office screen ends up without a check-in control while the phone has one.
   */
  can_check_in: boolean;
  can_approaching?: boolean;
  can_cancel: boolean;
  status_label: string;
}

/* ------------------------------------------------------------------ academic */

export interface TimetableEntry {
  id: UUID;
  course_id: UUID;
  day_of_week: number;
  session_type: string;
  note: string | null;
  starts_at: string;
  ends_at: string;
  course_code: string;
  course_title: string;
  course_colour: string | null;
  department: string | null;
  room_id: UUID | null;
  room_code: string | null;
  room_name: string | null;
  building_id: UUID | null;
  building_code: string | null;
  building_name: string | null;
  floor_id: UUID | null;
  floor_name: string | null;
  floor_level: number | null;
  lecturer: string | null;
  enrolled?: number;
  date: string;
  starts_at_iso: string;
  ends_at_iso: string;
  is_now: boolean;
  is_next: boolean;
  minutes_until: number | null;
}

export interface TimetableWeek {
  term: { code: string; name: string; starts_at?: string | null; ends_at?: string | null } | null;
  week_start: string;
  dates: string[];
  entries: TimetableEntry[];
}

export interface TodayOverview {
  date: string;
  day_of_week: number;
  entries: TimetableEntry[];
  now_entry: TimetableEntry | null;
  next: TimetableEntry | null;
  free_after: string | null;
}

export interface QuickAction {
  id: string;
  label: string;
  href: string;
  kind: 'navigation' | 'positioning' | 'queue' | 'office' | 'academic' | string;
}

export interface StudentToday {
  date: string;
  entries: TimetableEntry[];
  remaining: number;
}



/**
 * The student web dashboard's contract — `GET /student/dashboard`.
 *
 * There is no shared `DashboardPayload` any more. Staff and admin have their own shapes
 * (`StaffDashboard`, `AdminDashboard`) and no client type is allowed to be "whatever the endpoint
 * decided to return for my role". `quick_actions` is computed server-side from role + platform +
 * permissions, so the browser renders exactly the verbs a student may perform on the web.
 */
export interface StudentDashboard {
  user: { id: UUID; name: string; role: Role; registration_no: string | null; program: string | null; department: string | null };
  term: { code: string; name: string } | null;
  today: StudentToday;
  next_class: (TimetableEntry & { minutes_until: number | null }) | null;
  /**
   * Full ticket views — the same objects `GET /student/queue-tickets/{id}` returns, composed by the
   * shared `BuildsQueueViews` / `BuildsOfficeSummaries` traits. The dashboard is therefore never a
   * stale snapshot: the countdown it shows is the countdown the ticket screen shows.
   */
  queue_ticket: QueueTicketView | null;
  office_ticket: OfficeTicketView | null;
  notifications: NotificationRow[];
  unread_notifications: number;
  announcements: Pick<Announcement, 'id' | 'title' | 'body' | 'priority' | 'published_at' | 'is_pinned'>[];
  events: Pick<CampusEvent, 'id' | 'title' | 'starts_at' | 'venue' | 'category'>[];
  campus_snapshot: { open_queues: number; rooms_in_queue: number; enrolled_courses: number };
  building_alerts: { id: UUID; code: string; name: string; status: string }[];
  position: Position | null;
  quick_actions: QuickAction[];
}

export interface AiCapabilities {
  platform: string;
  role: string;
  tools: { id: string; label: string; needs: string }[];
  tool_count: number;
  total_tools: number;
  note: string;
}

/* ---------------------------------------------------------------- engagement */

export interface Announcement {
  target_roles?: string[] | null;
  id: UUID;
  title: string;
  body: string;
  audience?: string[];
  priority: 'normal' | 'high' | 'urgent';
  building_id: UUID | null;
  building_code?: string | null;
  author_id?: UUID | null;
  author_name?: string | null;
  is_pinned: boolean;
  published_at: string | null;
  expires_at: string | null;
  created_at?: string;
}

export interface CampusEvent {
  /** Registration state returned by the campus events controller. */
  is_registered?: boolean;
  id: UUID;
  title: string;
  description: string | null;
  category: 'academic' | 'career' | 'social' | 'sport' | 'wellbeing' | 'administrative';
  starts_at: string;
  ends_at: string | null;
  venue: string | null;
  building_id: UUID | null;
  building_code?: string | null;
  building_name?: string | null;
  room_id: UUID | null;
  room_code?: string | null;
  capacity: number | null;
  registration_required: boolean;
  registrations?: number;
  registered?: boolean;
  organiser_id: UUID | null;
  organiser_name?: string | null;
  status: string;
}

export interface EventsPayload {
  items: CampusEvent[];
  meta: PageMeta;
  registered_event_ids: UUID[];
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

export interface PageMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

/* ----------------------------------------------------------------- assistant */

export interface AiToolCall {
  name: string;
  ok: boolean;
  args?: Record<string, unknown>;
  error?: string;
}

export interface AiMessage {
  id: UUID;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  intent?: string | null;
  data?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  actions?: { label: string; href: string; kind?: string }[] | null;
  tool_calls?: AiToolCall[] | null;
  created_at: string;
}

export interface AiReply {
  conversation_id: UUID;
  provider?: 'deterministic' | 'llm';
  model?: string | null;
  intent?: string;
  message: AiMessage;
  suggested_actions?: AiMessage['actions'];
  latency_ms?: number;
}

export interface AiConversation {
  id: UUID;
  title: string;
  created_at: string;
  updated_at?: string;
  last_message_at?: string | null;
  message_count?: number;
}

/* --------------------------------------------------------------------- staff */

export interface QueueLineRow {
  id: UUID;
  ticket_number: string;
  position: number;
  status: string;
  student_name: string;
  student_email?: string;
  issued_at: string;
  called_at: string | null;
  check_in_deadline: string | null;
  checked_in_at: string | null;
  eta_seconds: number | null;
  wait_seconds: number;
  checked_in: boolean;
}

export interface StaffQueueRow {
  queue_id: UUID;
  room_id: UUID;
  room_code: string;
  room_name: string;
  building_code: string;
  floor_name: string;
  is_active: boolean;
  admission_capacity: number;
  avg_service_seconds: number;
  max_size: number | null;
  proximity_radius_m: number;
  requires_proximity_to_join: boolean;
  waiting: number;
  occupying: number;
  checked_in: number;
  current: QueueLineRow | null;
}

export interface StaffOfficeRow {
  office_id: UUID;
  name: string;
  code: string;
  ticket_prefix: string;
  concurrent_capacity: number;
  service_duration_minutes: number;
  check_in_radius_m: number;
  is_active: boolean;
  building_code: string;
  floor_name: string;
  room_code: string | null;
  waiting: number;
  in_service: number;
  completed_today: number;
  current: OfficeLineRow | null;
}

export interface OfficeLineRow {
  id: UUID;
  ticket_number: string;
  position: number;
  status: string;
  student_name: string;
  subject: string | null;
  requested_at: string;
  called_at: string | null;
  check_in_deadline: string | null;
  checked_in_at: string | null;
  service_started_at: string | null;
  wait_seconds: number;
  checked_in: boolean;
  service_minutes: number | null;
}

export interface StaffTimetableRow {
  id: UUID;
  day_of_week: number;
  starts_at: string;
  ends_at: string;
  session_type: string;
  week_pattern: string | null;
  group_code: string | null;
  notes: string | null;
  term_code: string;
  course_id: UUID;
  course_code: string;
  course_title: string;
  department: string | null;
  room_id: UUID | null;
  room_code: string | null;
  room_name: string | null;
  building_code: string | null;
  floor_name: string | null;
  enrolled: number;
}

export interface StaffCourseOption {
  id: UUID;
  code: string;
  title: string;
  department: string | null;
}

export interface StaffRoomOption {
  id: UUID;
  code: string;
  name: string;
}

export interface StaffPendingQueueRow {
  id: UUID;
  ticket_number: string;
  status: string;
  position: number;
  check_in_deadline: string | null;
  student_name: string;
  room_code: string;
  room_name: string;
  queue_id: UUID;
}

export interface StaffPendingOfficeRow {
  office_id?: UUID;
  id: UUID;
  ticket_number: string;
  status: string;
  position: number;
  check_in_deadline: string | null;
  subject: string | null;
  student_name: string;
  office_name: string;
}

export interface StaffTeachingRow {
  id: UUID;
  starts_at: string;
  ends_at: string;
  course_code: string;
  course_title: string;
  room_code: string | null;
  room_name: string | null;
  session_type: string;
}

export interface StaffDashboard {
  scopes: { queues: number; offices: number };
  queues: StaffQueueRow[];
  offices: StaffOfficeRow[];
  pending_queue_actions: StaffPendingQueueRow[];
  pending_office_actions: StaffPendingOfficeRow[];
  teaching_today: StaffTeachingRow[];
  kpis: { served_today: number; waiting_now: number; offices_open: number };
  campus_time: { date: string; dayOfWeek: number; time: string; minutes: number };
}

export interface StaffQueueDetail {
  queue: StaffQueueRow;
  line: QueueLineRow[];
  counts: QueueCounts;
}

export interface StaffOfficeDetail {
  office: StaffOfficeRow;
  line: OfficeLineRow[];
  counts: { waiting: number; checked_in: number; in_service: number };
  windows: ServiceWindow[];
}

/* --------------------------------------------------------------------- admin */

export interface AdminKpis {
  generated_at: string;
  students: number;
  staff: number;
  waiting_now: number;
  issued_today: number;
  office_waiting_now: number;
  office_completed_today: number;
  navigation_sessions_today: number;
  average_wait_minutes: number | null;
  no_show_rate_7d: number | null;
  rooms: number;
  buildings: number;
}

export interface AnalyticsOverview {
  generated_at: string;
  users: { students: number; staff: number; admins: number; total: number; active_7d: number };
  campus: {
    buildings: number;
    floors: number;
    rooms: number;
    total_capacity: number;
    qr_nodes: number;
    navigation_nodes: number;
    navigation_edges: number;
  };
  queues: {
    configured: number;
    active: number;
    waiting_now: number;
    issued_today: number;
    issued_7d: number;
    called_today: number;
    average_wait_minutes: number | null;
    average_service_minutes: number | null;
    no_show_rate_7d: number | null;
    busiest_rooms: { room_code: string; room_name: string; issued: number }[];
    hourly_volume: { hour: number; tickets: number }[];
  };
  offices: {
    configured: number;
    open_now: number;
    issued_today: number;
    completed_today: number;
    waiting_now: number;
    average_service_minutes: number | null;
    average_wait_minutes: number | null;
    no_show_rate_7d: number | null;
    busiest: { code: string; name: string; issued: number }[];
  };
  navigation: {
    sessions_today: number;
    sessions_7d: number;
    completion_rate_7d: number | null;
    off_route_events_7d: number;
    recalculations_7d: number;
    average_distance_m: number | null;
    popular_destinations: { label: string; sessions: number }[];
  };
  engagement: { events_upcoming: number; announcements_active: number; notifications_7d: number };
  utilisation: { room_id: UUID; room_code: string; room_name: string; building_code: string; booked_hours: number; utilisation: number }[];
}

/**
 * An operational condition the platform has noticed about itself.
 *
 * Alerts are *computed*, never stored: there is no `alerts` table, so an alert cannot fall out of date,
 * cannot be dismissed into a graveyard row, and cannot disagree with the state that produced it. The
 * `key` is the fingerprint of the condition, and it is what an acknowledgement mutes — the human act
 * persists, the condition stays derived.
 */
export interface AdminAlert {
  key: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  target?: string;
  count?: number;
}

export interface AdminMonitoring {
  generated_at: string;
  queues: { open: number; waiting_now: number; issued_today: number; served_today: number; no_show_rate_today: number | null };
  offices: { open: number; waiting_now: number; completed_today: number };
  platform: {
    active_queues: number;
    navigation_today: number;
    unacknowledged_alerts: number;
    users: number;
  };
}

export interface AdminRoleRegistry {
  roles: {
    code: string;
    label: string;
    users: number;
    home_route: string;
    permissions: string[];
    platforms: { web: string[]; mobile: string[] };
  }[];
  registry: { permission: string; label: string; description?: string; roles: string[]; platforms: string[] }[];
  assignments: { total: number; unassigned_staff: number };
  note?: string;
}

export interface AdminDashboard {
  kpis: AdminKpis;
  overview: AnalyticsOverview;
  live_queues: {
    queue_id: UUID;
    room_code: string;
    room_name: string;
    building_code: string;
    waiting: number;
    occupying: number;
    admission_capacity: number;
    is_active: boolean;
  }[];
  recent_audit: { id: number; action: string; entity_type: string | null; entity_id?: string | null; actor_name: string | null; created_at: string }[];
  buildings: { id: UUID; code: string; name: string; status: string; is_public: boolean }[];
}

export interface MapPayload {
  buildings: { id: UUID; code: string; name: string; lat: number; lng: number; footprint: [number, number][] | null; status: string }[];
  nodes: (NavigationNode & { floor_level?: number | null; floor_name?: string | null; building_code?: string | null })[];
  edges: NavigationEdge[];
  geofences: Geofence[];
  qr_nodes: (QrNode & { floor_name?: string; scans_count?: number })[];
}

export interface AuditLogRow {
  id: number;
  actor_id: UUID | null;
  actor_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}

export interface AdminUser {
  id: UUID;
  name: string;
  email: string;
  role_code: Role;
  status: string;
  registration_no: string | null;
  department: string | null;
  created_at: string;
  last_login_at: string | null;
  active_tokens?: number;
  assignments?: StaffAssignment[];
}

export interface Course {
  id: UUID;
  code: string;
  title: string;
  description: string | null;
  department: string | null;
  credits: number;
  colour: string | null;
  level: string | null;
  is_active: boolean;
  staff?: { id: UUID; name: string; role: string }[];
}

export interface Term {
  /** Terms are keyed by their human-readable code (e.g. 2026-FALL). */
  code: string;
  name: string;
  starts_on: string;
  ends_on: string;
  is_current: boolean;
}

export interface Enrollment {
  id: UUID;
  student_id: UUID;
  student_name?: string;
  course_id: UUID;
  course_code?: string;
  course_title?: string;
  term_code: string;
  status: string;
  created_at: string;
}

export interface RoomQueueConfig {
  id: UUID;
  room_id: UUID;
  is_active: boolean;
  max_size: number;
  admission_capacity: number;
  avg_service_seconds: number;
  proximity_radius_m: number;
  requires_proximity_to_join: boolean;
  check_in_window_seconds: number;
  grace_period_seconds: number;
  max_active_tickets_per_student?: number;
  opens_at: string | null;
  closes_at: string | null;
  notes: string | null;
  room_code?: string;
  room_name?: string;
  building_code?: string;
  floor_name?: string;
  waiting?: number;
}

export interface Setting {
  key: string;
  value: unknown;
  updated_at: string;
}

/** Envelope returned by the API. Unwrapped by `lib/api/client.ts`. */
export interface Envelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
  code?: string;
}
