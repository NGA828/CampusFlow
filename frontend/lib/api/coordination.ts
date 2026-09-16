import { ApiError } from "./client";
import type {
  AdminUser,
  PageMeta,
  Role,
  StaffDashboard,
  AdminDashboard,
} from "./types";
type Row = Record<string, unknown>;
export const invalidWorkspace = () =>
  new ApiError(
    502,
    "The workspace returned an incomplete response. Refresh before continuing.",
  );
export function record(v: unknown): Row {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw invalidWorkspace();
  return v as Row;
}
export function rows(v: unknown): unknown[] {
  if (!Array.isArray(v)) throw invalidWorkspace();
  return v;
}
export function text(v: unknown, fallback = "") {
  return typeof v === "string" ? v : fallback;
}
export function identity(v: unknown) {
  const s = typeof v === "string" || typeof v === "number" ? String(v) : "";
  if (!s) throw invalidWorkspace();
  return s;
}
export function metric(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}
export function pageMeta(v: unknown): PageMeta {
  const r = record(v);
  const p = metric(r.page ?? r.current_page),
    n = metric(r.per_page),
    t = metric(r.total),
    last = metric(r.total_pages ?? r.last_page);
  if (
    p === null ||
    n === null ||
    t === null ||
    last === null ||
    ![p, n, t, last].every(Number.isInteger) ||
    p < 1 ||
    n < 1 ||
    last < 1
  )
    throw invalidWorkspace();
  return { page: p, per_page: n, total: t, total_pages: last };
}
export function person(v: unknown): AdminUser {
  const r = record(v);
  const role = text(r.role ?? r.role_code);
  if (!["student", "staff", "admin", "visitor"].includes(role))
    throw invalidWorkspace();
  return {
    id: identity(r.id),
    name: identity(r.name),
    email: identity(r.email),
    role_code: role as Role,
    status: text(r.status, r.is_active === true ? "active" : "unknown"),
    registration_no: text(r.registration_no) || null,
    department: text(r.department) || null,
    created_at: text(r.created_at),
    last_login_at: text(r.last_login_at) || null,
  };
}
export function peoplePage(v: unknown) {
  const r = record(v);
  return { items: rows(r.items).map(person), meta: pageMeta(r.meta) };
}
export function personResult(v: unknown) {
  const r = record(v);
  return {
    user: person(r.user),
    password: typeof r.password === "string" ? r.password : undefined,
    changed: r.changed === true,
  };
}
export interface ScopeAssignment {
  id: string;
  user_id: string;
  user_name: string;
  scope_type: string;
  scope_id: string;
  role_in_scope: string;
  can_call_tickets: boolean;
  can_manage_timetable: boolean;
  can_publish_content: boolean;
}
export interface ScopeDirectory {
  assignments: ScopeAssignment[];
  people: { id: string; name: string; email: string }[];
  scopes: Record<string, { id: string; label: string }[]>;
}
export function scopeDirectory(v: unknown): ScopeDirectory {
  const r = record(v);
  const scopes: ScopeDirectory["scopes"] = {};
  if (r.scopes)
    for (const [k, list] of Object.entries(record(r.scopes)))
      scopes[k] = rows(list).map((v) => {
        const x = record(v);
        return { id: identity(x.id), label: identity(x.label) };
      });
  return {
    scopes,
    people: r.people
      ? rows(r.people).map((v) => {
          const x = record(v);
          return {
            id: identity(x.id),
            name: identity(x.name),
            email: text(x.email),
          };
        })
      : [],
    assignments: rows(r.assignments).map((v) => {
      const x = record(v);
      return {
        id: identity(x.id),
        user_id: identity(x.user_id),
        user_name: text(x.user_name, text(x.user ? record(x.user).name : null)),
        scope_type: identity(x.scope_type),
        scope_id: text(x.scope_id),
        role_in_scope: text(x.role_in_scope),
        can_call_tickets: x.can_call_tickets === true,
        can_manage_timetable: x.can_manage_timetable === true,
        can_publish_content: x.can_publish_content === true,
      };
    }),
  };
}
export interface Publication {
  id: string;
  title: string;
  body: string;
  category: string;
  priority: string;
  starts_at: string;
  ends_at: string;
  venue: string;
  capacity: number | null;
  target_roles: string[];
  published_at: string;
  can_manage: boolean;
}
export function publication(v: unknown, kind: "event" | "notice"): Publication {
  const r = record(v);
  return {
    id: identity(r.id),
    title: identity(r.title),
    body: text(kind === "event" ? r.description : r.body),
    category: text(r.category),
    priority: text(r.priority, "normal"),
    starts_at: text(r.starts_at),
    ends_at: text(r.ends_at),
    venue: text(r.venue),
    capacity: metric(r.capacity),
    target_roles:
      r.target_roles === null || r.target_roles === undefined
        ? ["all"]
        : rows(r.target_roles).map((v) => identity(v)),
    published_at: text(r.published_at),
    can_manage: kind === "notice" || r.can_manage === true,
  };
}
export function staffOverview(v: unknown): StaffDashboard {
  const r = record(v);
  for (const k of [
    "queues",
    "offices",
    "pending_queue_actions",
    "pending_office_actions",
    "teaching_today",
  ])
    rows(r[k]);
  const k = record(r.kpis);
  if (
    ["served_today", "waiting_now", "offices_open"].some(
      (x) => metric(k[x]) === null,
    )
  )
    throw invalidWorkspace();
  record(r.campus_time);
  record(r.scopes);
  return v as StaffDashboard;
}
export function adminOverview(v: unknown): AdminDashboard {
  const r = record(v);
  for (const k of ["live_queues", "buildings", "recent_audit"]) rows(r[k]);
  record(r.kpis);
  const o = record(r.overview);
  for (const k of ["users", "queues", "offices", "navigation", "engagement"])
    record(o[k]);
  return {
    ...r,
    recent_audit: rows(r.recent_audit).map((v) => {
      const a = record(v);
      return { ...a, entity_type: text(a.subject_type ?? a.entity_type) };
    }),
  } as unknown as AdminDashboard;
}
export function confirmPerson(
  value: AdminUser,
  id: string,
  expected: Partial<AdminUser>,
) {
  if (
    value.id !== id ||
    Object.entries(expected).some(([k, v]) => value[k as keyof AdminUser] !== v)
  )
    throw new ApiError(
      502,
      "The account change could not be confirmed. Refresh before retrying.",
    );
}
