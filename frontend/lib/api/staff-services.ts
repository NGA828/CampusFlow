import { ApiError } from "./client";
import type { Room, Paginated, ServiceWindow } from "./types";
type Row = Record<string, unknown>;
const bad = () =>
  new ApiError(
    502,
    "The staff service returned an incomplete response. Please refresh.",
  );
function obj(v: unknown): Row {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw bad();
  return v as Row;
}
function list(v: unknown): unknown[] {
  if (!Array.isArray(v)) throw bad();
  return v;
}
function str(v: unknown, fallback = "") {
  return typeof v === "string" ? v : fallback;
}
function count(v: unknown) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw bad();
  return v;
}
function id(v: unknown) {
  if (typeof v !== "string" || !v) throw bad();
  return v;
}
export interface Desk {
  id: string;
  code: string;
  name: string;
  description: string;
  active: boolean;
  enabled: boolean | null;
  room: string;
  location: string;
  waiting: number | null;
  serving: number | null;
  completed: number | null;
  capacity: number;
  duration: number;
  prefix: string;
  radius: number;
}
export interface DeskTicket {
  id: string;
  number: string;
  name: string;
  email: string;
  subject: string;
  status: string;
  position: number;
  joined: string;
  called: string;
  started: string;
}
export interface DeskLine {
  office: Desk;
  line: DeskTicket[];
  windows: ServiceWindow[];
  counts: { waiting: number; called: number; in_service: number };
}
function desk(value: unknown): Desk {
  const v = obj(value);
  if (typeof v.is_active !== "boolean") throw bad();
  return {
    id: id(v.id ?? v.office_id),
    code: str(v.code),
    name: str(v.name, "Office"),
    description: str(v.description),
    active: v.is_active,
    enabled: typeof v.is_open === "boolean" ? v.is_open : null,
    room: str(v.room_code),
    location: [v.building_code, v.floor_name].filter(Boolean).join(" · "),
    waiting: v.waiting === undefined ? null : count(v.waiting),
    serving:
      v.serving === undefined && v.in_service === undefined
        ? null
        : count(v.serving ?? v.in_service),
    completed:
      v.completed_today === undefined ? null : count(v.completed_today),
    capacity: count(v.concurrent_capacity),
    duration: count(v.service_duration_minutes ?? v.avg_service_minutes),
    prefix: str(v.ticket_prefix),
    radius: count(v.check_in_radius_m),
  };
}
export function desksProjection(value: unknown) {
  return { offices: list(obj(value).offices).map(desk) };
}
export function deskLineProjection(value: unknown): DeskLine {
  const v = obj(value),
    counts = obj(v.counts);
  return {
    office: desk(v.office),
    counts: {
      waiting: count(counts.waiting),
      called: count(counts.called),
      in_service: count(counts.in_service),
    },
    windows: list(v.windows).map((value) => {
      const w = obj(value);
      const day = count(w.day_of_week);
      if (
        !Number.isInteger(day) ||
        day > 6 ||
        typeof w.is_active !== "boolean" ||
        !/^([01]\d|2[0-3]):[0-5]\d/.test(str(w.opens_at)) ||
        !/^([01]\d|2[0-3]):[0-5]\d/.test(str(w.closes_at))
      )
        throw bad();
      return {
        ...w,
        id: id(w.id),
        day_of_week: day,
        opens_at: str(w.opens_at),
        closes_at: str(w.closes_at),
        capacity: count(w.capacity),
        is_active: w.is_active,
      } as ServiceWindow;
    }),
    line: list(v.line).map((value) => {
      const t = obj(value);
      return {
        id: id(t.id),
        number: str(t.ticket_number),
        name: str(t.user_name ?? t.student_name, "Student"),
        email: str(t.user_email ?? t.student_email),
        subject: str(t.subject, "No subject provided"),
        status: str(t.status).toUpperCase(),
        position: count(t.position),
        joined: str(t.joined_at ?? t.requested_at),
        called: str(t.called_at),
        started: str(t.service_started_at),
      };
    }),
  };
}
export type ManagedRoom = Room & { can_update_status: boolean };
export function managedRoomsProjection(value: unknown): Paginated<ManagedRoom> {
  const v = obj(value),
    m = obj(v.meta);
  const page = count(m.current_page ?? m.page),
    pages = count(m.last_page ?? m.total_pages),
    per = count(m.per_page),
    total = count(m.total);
  if (
    !Number.isInteger(page) ||
    !Number.isInteger(pages) ||
    page < 1 ||
    pages < 1 ||
    per < 1
  )
    throw bad();
  return {
    items: list(v.items).map((value) => {
      const r = obj(value);
      return {
        ...r,
        id: id(r.id),
        room_type: r.room_type ?? r.type ?? "other",
        can_update_status: r.can_update_status === true,
      } as ManagedRoom;
    }),
    meta: { page, total_pages: pages, per_page: per, total },
  };
}
export interface TeachingEntry {
  id: string;
  course_id: string;
  course_code: string;
  title: string;
  term: string;
  room_id: string | null;
  room_code: string;
  room_name: string;
  building: string;
  type: string;
  day: number;
  start: string;
  end: string;
}
export interface TeachingData {
  entries: TeachingEntry[];
  can_manage: boolean;
  courses: { id: string; code: string; name: string }[];
  rooms: { id: string; code: string; name: string }[];
  terms: { code: string; name: string }[];
  term: string;
}
export function teachingEntry(value: unknown): TeachingEntry {
  const v = obj(value);
  const day = count(v.day_of_week);
  if (
    !Number.isInteger(day) ||
    day > 6 ||
    !/^\d{2}:\d{2}/.test(str(v.starts_at)) ||
    !/^\d{2}:\d{2}/.test(str(v.ends_at))
  )
    throw bad();
  return {
    id: id(v.id),
    course_id: id(v.course_id),
    course_code: str(v.course_code),
    title: str(v.course_name ?? v.course_title),
    term: str(v.term_code),
    room_id: typeof v.room_id === "string" ? v.room_id : null,
    room_code: str(v.room_code),
    room_name: str(v.room_name),
    building: str(v.building_code),
    type: str(v.type ?? v.session_type),
    day,
    start: str(v.starts_at).slice(0, 5),
    end: str(v.ends_at).slice(0, 5),
  };
}
export function teachingProjection(value: unknown): TeachingData {
  const v = obj(value);
  if (typeof v.can_manage !== "boolean") throw bad();
  return {
    entries: list(v.entries).map(teachingEntry),
    can_manage: v.can_manage,
    courses: list(v.courses).map((value) => {
      const c = obj(value);
      return { id: id(c.id), code: str(c.code), name: str(c.name ?? c.title) };
    }),
    rooms: list(v.rooms).map((value) => {
      const r = obj(value);
      return { id: id(r.id), code: str(r.code), name: str(r.name) };
    }),
    terms: Array.isArray(v.terms)
      ? v.terms.map((value) => {
          const t = obj(value);
          return { code: id(t.code), name: str(t.name) };
        })
      : [],
    term: str(v.term_code),
  };
}
export function verifyOfficeMutation(
  value: unknown,
  expected: string,
  ticketId?: string,
) {
  const t = obj(value);
  if (
    !t.id ||
    (ticketId && t.id !== ticketId) ||
    str(t.status).toUpperCase() !== expected
  )
    throw new ApiError(
      502,
      "The ticket change could not be confirmed. Review the refreshed line before trying again.",
    );
}
