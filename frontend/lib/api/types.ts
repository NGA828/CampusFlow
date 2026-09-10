/**
 * API contracts for the web and mobile clients.
 *
 * Field names mirror the Fastify serialisers in `server/src/routes/*` exactly — the
 * screens never guess. Anything optional is genuinely optional in the API.
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

export interface RoomAvailability {
  room_id: UUID;
  date: string;
  is_open: boolean;
  opens_at: string | null;
  closes_at: string | null;
  is_available_now: boolean;
  next_free_at: string | null;
  current_session: { course_code: string; course_title: string; starts_at: string; ends_at: string; session_type: string } | null;
  busy: { starts_at: string; ends_at: string; course_code?: string; course_title?: string; session_type?: string }[];
  free_slots: { starts_at: string; ends_at: string }[];
  occupancy: { admitted: number; capacity: number };
  queue: { id: UUID | null; waiting: number; requires_proximity: boolean; is_active: boolean };
  headline: string;
}

export interface RoomDetail {
  room: Room;
  availability: RoomAvailability;
  week: { day_of_week: number; starts_at: string; ends_at: string; course_code: string; course_title: string; session_type: string }[];
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
  kind: 'corridor' | 'stairs' | 'elevator' | 'ramp' | 'outdoor' | 'door';
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

export interface NavigationStart {
  session_id: UUID;
  started_at: string;
  route: Route;
  destination_label: string;
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

export interface NavigationUpdate {
  position: Position;
  navigation: NavigationWalking | null;
  promoted_tickets?: { ticket_id: UUID; ticket_number: string }[];
}

export interface NavigationDeviation {
  id: UUID;
  status: string;
  detections: number;
  max_distance_m: number;
  first_detected_at: string;
}

export interface ActiveNavigationSession {
  id: UUID;
  route: Route;
  status: string;
  distance_m: number;
  duration_seconds: number;
  destination_label: string;
  current_step_index: number;
  off_route_events: number;
  recalculations: number;
  started_at: string;
  requires_accessible: boolean;
}

export interface NavigationActive {
  session: ActiveNavigationSession | null;
  evaluation: RouteProgress | null;
  deviation: NavigationDeviation | null;
  position: Position | null;
}

export interface NavigationSession {
  id: UUID;
  user_id?: UUID;
  status: 'active' | 'arrived' | 'completed' | 'abandoned' | 'expired';
  destination_label: string;
  destination_room_id: UUID | null;
  distance_m: number;
  duration_s: number;
  route: Route;
  started_at: string;
  ended_at?: string | null;
  last_position_at: string | null;
  off_route_count: number;
  recalculations: number;
  progress: RouteProgress | null;
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
  can_cancel: boolean;
}

export interface QueueListItem {
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
  building_id: UUID;
  floor_id: UUID | null;
  room_id: UUID | null;
  ticket_prefix: string;
  service_duration_minutes: number;
  concurrent_capacity: number;
  daily_capacity: number | null;
  check_in_radius_m: number;
  grace_period_seconds: number;
  requires_proximity_to_request: boolean;
  requires_appointment: boolean;
  contact_email: string | null;
  contact_phone?: string | null;
  is_active: boolean;
  building_code?: string;
  building_name?: string;
  room_code?: string | null;
  room_name?: string | null;
  room_lat?: number | null;
  room_lng?: number | null;
  room_plan_x?: number | null;
  room_plan_y?: number | null;
  floor_name?: string | null;
  floor_level?: number | null;
  /** Live figures resolved by the list endpoint. */
  waiting?: number;
  in_service?: number;
  is_open_now?: boolean;
  opens_at?: string | null;
  closes_at?: string | null;
  next_opening?: string | null;
  average_service_minutes?: number;
  estimated_wait_minutes?: number;
  next_ticket_number?: string;
  today_windows?: ServiceWindow[];
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
  term: string;
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

export interface DashboardPayload {
  user: { id: UUID; name: string; role: Role; department: string | null };
  today: TodayOverview;
  next_class: TimetableEntry | null;
  queue_ticket: QueueTicketView | null;
  office_ticket: OfficeTicketView | null;
  notifications: NotificationRow[];
  unread_notifications: number;
  announcements: Pick<Announcement, 'id' | 'title' | 'body' | 'priority' | 'published_at' | 'is_pinned'>[];
  events: Pick<CampusEvent, 'id' | 'title' | 'category' | 'starts_at' | 'ends_at' | 'venue' | 'building_id'>[];
  building_alerts: { id: UUID; code: string; name: string; status: string }[];
  position: Position | null;
}

/* ---------------------------------------------------------------- engagement */

export interface Announcement {
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
  data: Record<string, unknown> | null;
  actions: { label: string; href: string; kind?: string }[] | null;
  tool_calls: AiToolCall[] | null;
  created_at: string;
}

export interface AiReply {
  conversation_id: UUID;
  provider: 'deterministic' | 'llm';
  model: string | null;
  intent: string;
  message: AiMessage;
  latency_ms: number;
}

export interface AiConversation {
  id: UUID;
  title: string;
  created_at: string;
  updated_at: string;
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
  max_size: number;
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
