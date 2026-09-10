/**
 * DEVELOPMENT-ONLY mock API.
 *
 * ⚠️ This module is NOT production functionality. It exists so the web app
 * can be designed and demoed before the Laravel backend is reachable from
 * this environment. It implements the same envelope + contract documented in
 * `docs/API.md`, so switching to the live backend is a configuration change
 * (set NEXT_PUBLIC_API_URL) — no component code changes.
 *
 * The backend remains the authoritative source of truth for every business
 * decision; this mock never makes one.
 */

import type {
  ApiEnvelope,
  ClassSession,
  DashboardPayload,
  Room,
  Session,
  TimetablePayload,
  User,
} from "./types";

const LATENCY_MS = 350;
const delay = (ms = LATENCY_MS) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const ok = <T>(data: T, message?: string): ApiEnvelope<T> => ({
  success: true,
  data,
  message,
});

const fail = (
  status: number,
  message: string,
  errors?: Record<string, string[]>,
): { status: number; body: ApiEnvelope<never> } => ({
  status,
  body: { success: false, message, errors },
});

/* ------------------------------------------------------------------ */
/* Seed data                                                           */
/* ------------------------------------------------------------------ */

const DEMO_ACCOUNTS: Array<{ email: string; password: string; user: User }> = [
  {
    email: "greyson@campusflow.app",
    password: "campusflow",
    user: {
      id: "usr_stu_1",
      name: "Greyson Okoro",
      email: "greyson@campusflow.app",
      role: "student",
      student: {
        id: "stu_1",
        matric_no: "CF/22/0417",
        program: "B.Sc. Computer Science",
        level: "300 Level",
      },
    },
  },
  {
    email: "staff@campusflow.app",
    password: "campusflow",
    user: {
      id: "usr_stf_1",
      name: "Mrs. A. Bello",
      email: "staff@campusflow.app",
      role: "staff",
    },
  },
  {
    email: "admin@campusflow.app",
    password: "campusflow",
    user: {
      id: "usr_adm_1",
      name: "Dr. C. Nwachukwu",
      email: "admin@campusflow.app",
      role: "administrator",
    },
  },
];

const ENG = { id: "bld_eng", name: "Engineering Building", short: "ENG" };
const ADM = { id: "bld_adm", name: "Administration Building", short: "ADM" };
const SCI = { id: "bld_sci", name: "Science Building", short: "SCI" };
const LIB = { id: "bld_lib", name: "University Library", short: "LIB" };

const ROOMS: Room[] = [
  { id: "rm_b204", code: "B204", name: "Lecture Theatre B204", building: ENG, floor: 2, capacity: 30, type: "classroom", status: "occupied" },
  { id: "rm_a102", code: "A102", name: "Lecture Room A102", building: SCI, floor: 1, capacity: 60, type: "classroom", status: "available" },
  { id: "rm_l3", code: "L3", name: "Computer Lab L3", building: ENG, floor: 3, capacity: 25, type: "lab", status: "available" },
  { id: "rm_sr12", code: "SR12", name: "Study Room 12", building: LIB, floor: 1, capacity: 12, type: "study", status: "available" },
  { id: "rm_hall", code: "MH1", name: "Main Hall", building: ADM, floor: 0, capacity: 400, type: "hall", status: "restricted" },
];

const COURSES = {
  csc301: { id: "crs_csc301", code: "CSC 301", name: "Database Systems" },
  se401: { id: "crs_se401", code: "SE 401", name: "Software Engineering" },
  csc201: { id: "crs_csc201", code: "CSC 201", name: "Data Structures" },
  mth201: { id: "crs_mth201", code: "MTH 201", name: "Linear Algebra II" },
};

function isoAt(date: Date, hours: number, minutes = 0): string {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

function classesFor(date: Date): ClassSession[] {
  return [
    { id: "cls_1", course: COURSES.csc301, room: ROOMS[0], starts_at: isoAt(date, 9), ends_at: isoAt(date, 10), instructor: "Prof. D. Adeyemi", type: "lecture" },
    { id: "cls_2", course: COURSES.se401, room: ROOMS[1], starts_at: isoAt(date, 11), ends_at: isoAt(date, 12, 30), instructor: "Dr. K. Mensah", type: "lecture" },
    { id: "cls_3", course: COURSES.csc201, room: ROOMS[2], starts_at: isoAt(date, 13), ends_at: isoAt(date, 14, 30), instructor: "Prof. D. Adeyemi", type: "lab" },
    { id: "cls_4", course: COURSES.mth201, room: ROOMS[1], starts_at: isoAt(date, 15), ends_at: isoAt(date, 16, 30), instructor: "Dr. L. Obi", type: "tutorial" },
  ];
}

function greetingFor(now: Date): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/* ------------------------------------------------------------------ */
/* In-memory session (mirrors auth behaviour, dev-only)                */
/* ------------------------------------------------------------------ */

let currentUser: User | null = null;

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

type MockResult = { status: number; body: ApiEnvelope<unknown> };

async function route(path: string, options: { method?: string; body?: unknown }): Promise<MockResult> {
  const method = options.method ?? "GET";
  const [pathname, queryString] = path.split("?");
  const query = new URLSearchParams(queryString ?? "");

  await delay();

  /* ---- Auth ---- */
  if (method === "POST" && pathname === "/auth/login") {
    const { email, password } = (options.body ?? {}) as { email?: string; password?: string };
    if (!email || !password) {
      return fail(422, "Email and password are required.", {
        email: !email ? ["Email is required."] : [],
        password: !password ? ["Password is required."] : [],
      });
    }
    const account = DEMO_ACCOUNTS.find((a) => a.email === email.toLowerCase());
    if (!account || account.password !== password) {
      return fail(401, "These credentials do not match our records.");
    }
    currentUser = account.user;
    const session: Session = { token: `demo-token-${account.user.role}`, user: account.user };
    return { status: 200, body: ok(session, "Signed in successfully.") };
  }

  if (method === "GET" && pathname === "/me") {
    if (!currentUser) return fail(401, "Unauthenticated.");
    return { status: 200, body: ok(currentUser) };
  }

  if (method === "POST" && pathname === "/auth/logout") {
    currentUser = null;
    return { status: 200, body: ok(null, "Signed out.") };
  }

  /* ---- Student: dashboard ---- */
  if (method === "GET" && pathname === "/student/dashboard") {
    if (!currentUser) return fail(401, "Unauthenticated.");

    const now = new Date();
    const classes = classesFor(now);
    const next = classes.find((c) => new Date(c.ends_at).getTime() > now.getTime()) ?? null;
    const nextClass = next
      ? {
          ...next,
          minutes_until_start: Math.max(
            0,
            Math.round((new Date(next.starts_at).getTime() - now.getTime()) / 60000),
          ),
        }
      : null;

    const payload: DashboardPayload = {
      greeting: greetingFor(now),
      today_count: classes.length,
      next_class: nextClass,
      today_classes: classes,
      queue_ticket: {
        id: "tkt_1",
        ticket_no: "P-024",
        office: { id: "off_principal", name: "Principal's Office", building: "Administration Building" },
        position: 3,
        people_ahead: 2,
        estimated_wait_minutes: 12,
        expected_window: "11:40 AM – 11:50 AM",
        status: "approaching",
      },
      announcements: [
        {
          id: "ann_1",
          title: "Mid-semester exams begin Monday",
          body: "All 300-level exams start at 9:00 AM sharp. Arrive 15 minutes early at your assigned room.",
          category: "Academics",
          published_at: new Date(now.getTime() - 2 * 3600_000).toISOString(),
        },
        {
          id: "ann_2",
          title: "Library extended hours",
          body: "The main library now stays open until 10:00 PM on weekdays.",
          category: "Facilities",
          published_at: new Date(now.getTime() - 26 * 3600_000).toISOString(),
        },
      ],
      nearby_rooms: [ROOMS[3], ROOMS[2], ROOMS[1]],
    };

    return { status: 200, body: ok(payload) };
  }

  /* ---- Student: timetable ---- */
  if (method === "GET" && pathname === "/student/timetable") {
    if (!currentUser) return fail(401, "Unauthenticated.");
    const dateParam = query.get("date");
    const date = dateParam ? new Date(`${dateParam}T00:00:00`) : new Date();
    const payload: TimetablePayload = {
      date: dateParam ?? new Date().toISOString().slice(0, 10),
      classes: classesFor(date),
    };
    return { status: 200, body: ok(payload) };
  }

  /* ---- Rooms: search ---- */
  if (method === "GET" && pathname === "/rooms") {
    const q = (query.get("query") ?? "").toLowerCase();
    const results = ROOMS.filter(
      (r) =>
        !q ||
        r.code.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.building.name.toLowerCase().includes(q),
    );
    return {
      status: 200,
      body: ok({ data: results, meta: { current_page: 1, per_page: 20, total: results.length, last_page: 1 } }),
    };
  }

  return fail(404, `Mock route not implemented: ${method} ${pathname}`);
}

export async function mockRequest<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const result = await route(path, options);
  if (result.status >= 400) {
    const { ApiError } = await import("./client");
    throw new ApiError(result.body.message ?? "Request failed", result.status, result.body.errors);
  }
  return (result.body as ApiEnvelope<T>).data as T;
}
