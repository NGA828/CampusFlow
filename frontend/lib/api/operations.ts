/** Adapt the routed Laravel projections once, at the API boundary. */
import { ApiError } from "./client";
import type {
  QueueLineRow,
  StaffQueueDetail,
  StaffQueueRow,
  StudentDashboard,
} from "./types";
type Row = Record<string, unknown>;
function record(v: unknown): Row {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new ApiError(502, "The service returned an incomplete response.");
  return v as Row;
}
function number(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0)
    throw new ApiError(502, "The service returned an invalid queue count.");
  return v;
}
const text = (v: unknown, fallback = "") =>
  typeof v === "string" ? v : fallback;
export function operationTicket(value: unknown): QueueLineRow {
  const v = record(value);
  if (!v.id || !v.status)
    throw new ApiError(502, "The ticket response could not be verified.");
  return {
    ...v,
    id: text(v.id),
    ticket_number: text(v.ticket_number, "Ticket"),
    position: number(v.position),
    status: text(v.status).toUpperCase(),
    student_name: text(v.student_name ?? v.user_name, "Student"),
    student_email: text(v.student_email ?? v.user_email),
    issued_at: text(v.issued_at ?? v.joined_at),
    called_at: v.called_at as string | null,
    check_in_deadline: v.check_in_deadline as string | null,
    checked_in_at: v.checked_in_at as string | null,
    checked_in: !!v.checked_in_at,
    eta_seconds: null,
    wait_seconds: typeof v.wait_seconds === "number" ? v.wait_seconds : 0,
  };
}
export function operationQueue(value: unknown, counts?: Row): StaffQueueRow {
  const v = record(value);
  const active = v.is_active ?? v.is_open;
  if (!(v.queue_id ?? v.id) || typeof active !== "boolean")
    throw new ApiError(502, "The queue response could not be verified.");
  return {
    ...v,
    queue_id: text(v.queue_id ?? v.id),
    room_id: text(v.room_id),
    room_code: text(v.room_code, "Room"),
    room_name: text(v.room_name, "Room queue"),
    building_code: text(v.building_code ?? v.building),
    floor_name: text(v.floor_name),
    is_active: active,
    admission_capacity: number(v.admission_capacity ?? v.capacity),
    occupying: number(v.occupying ?? v.current_count),
    waiting: number(counts?.waiting ?? v.waiting),
    checked_in: number(counts?.checked_in ?? v.checked_in),
    max_size:
      v.max_size === null || v.max_capacity === null
        ? null
        : number(v.max_size ?? v.max_capacity),
    avg_service_seconds: number(
      v.avg_service_seconds ??
        (typeof v.avg_service_minutes === "number"
          ? v.avg_service_minutes * 60
          : undefined),
    ),
    proximity_radius_m: number(v.proximity_radius_m),
    requires_proximity_to_join:
      (v.requires_proximity_to_join ?? v.join_requires_proximity) === true,
    current: v.current ? operationTicket(v.current) : null,
  };
}
export function operationQueues(value: unknown) {
  const v = record(value);
  if (!Array.isArray(v.queues))
    throw new ApiError(502, "The queue list could not be verified.");
  return { queues: v.queues.map((q) => operationQueue(q)) };
}
export function operationLine(value: unknown): StaffQueueDetail {
  const v = record(value);
  const c = record(v.counts);
  if (!Array.isArray(v.line))
    throw new ApiError(502, "The queue line could not be verified.");
  return {
    queue: operationQueue(v.queue, c),
    line: v.line.map(operationTicket),
    counts: {
      waiting: number(c.waiting),
      called: number(c.called),
      checked_in: number(c.checked_in),
    } as StaffQueueDetail["counts"],
  };
}
export function dashboardProjection(value: StudentDashboard): StudentDashboard {
  const entry = (v: StudentDashboard["today"]["entries"][number]) => {
    const raw = v as unknown as Row;
    return {
      ...v,
      course_title: text(raw.course_title ?? raw.course_name),
      session_type: text(raw.session_type ?? raw.type),
    };
  };
  if (
    !value?.today ||
    !value.user ||
    typeof value.user.name !== "string" ||
    !Array.isArray(value.today.entries) ||
    ![
      value.quick_actions,
      value.building_alerts,
      value.announcements,
      value.events,
      value.notifications,
    ].every(Array.isArray)
  )
    throw new ApiError(502, "Your daily schedule could not be verified.");
  return {
    ...value,
    today: { ...value.today, entries: value.today.entries.map(entry) },
    next_class: value.next_class ? entry(value.next_class) : null,
  };
}
