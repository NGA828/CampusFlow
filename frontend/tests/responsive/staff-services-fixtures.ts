import type { Page } from "@playwright/test";
import { webSession } from "./web-visual-fixtures";
export async function staffServicesSession(page: Page) {
  await webSession(page, "staff");
  const writes: {
    path: string;
    method: string;
    body: Record<string, unknown>;
  }[] = [];
  const office = {
    id: "o1",
    code: "SA",
    name: "Student affairs",
    description: "Student records, registration and everyday campus support.",
    room_code: "C101",
    building_code: "C",
    floor_name: "Ground floor",
    is_active: true,
    is_open: false,
    concurrent_capacity: 3,
    service_duration_minutes: 10,
    ticket_prefix: "SA",
    check_in_radius_m: 75,
    completed_today: 8,
  };
  const tickets = [
    {
      id: "ot1",
      ticket_number: "SA-009",
      user_name: "Amina Yusuf",
      user_email: "amina@example.test",
      subject: "Enrolment verification letter",
      status: "called",
    },
    {
      id: "ot2",
      ticket_number: "SA-010",
      user_name: "Alex Rivera",
      user_email: "alex@example.test",
      subject: "Update student registration record",
      status: "in_service",
    },
    {
      id: "ot3",
      ticket_number: "SA-011",
      user_name: "Samuel Njoya",
      user_email: "samuel@example.test",
      subject: "Semester registration support",
      status: "waiting",
    },
    {
      id: "ot4",
      ticket_number: "SA-012",
      user_name: "Leila Mensah",
      user_email: "leila@example.test",
      subject: "Request a student status letter",
      status: "waiting",
    },
  ].map((t, i) => ({
    ...t,
    position: i + 1,
    joined_at: "2026-09-15T09:40:00Z",
    called_at: i < 2 ? "2026-09-15T09:58:00Z" : null,
    service_started_at: i === 1 ? "2026-09-15T10:00:00Z" : null,
  }));
  const windows = [
    {
      id: "w1",
      day_of_week: 1,
      opens_at: "08:00",
      closes_at: "12:00",
      capacity: 24,
      avg_service_minutes: 10,
      is_active: true,
      status: "active",
    },
    {
      id: "w2",
      day_of_week: 3,
      opens_at: "13:00",
      closes_at: "16:00",
      capacity: 18,
      avg_service_minutes: 10,
      is_active: true,
      status: "active",
    },
    {
      id: "w3",
      day_of_week: 0,
      opens_at: "10:00",
      closes_at: "12:00",
      capacity: 10,
      avg_service_minutes: 10,
      is_active: false,
      status: "inactive",
    },
  ];
  const rooms = [
    {
      id: "r1",
      code: "A101",
      name: "Learning commons",
      type: "study",
      capacity: 40,
      status: "available",
      can_update_status: true,
    },
    {
      id: "r2",
      code: "B204",
      name: "Interaction design studio",
      type: "lab",
      capacity: 30,
      status: "occupied",
      can_update_status: true,
    },
    {
      id: "r3",
      code: "C301",
      name: "Faculty meeting room",
      type: "meeting",
      capacity: 18,
      status: "maintenance",
      can_update_status: false,
    },
    {
      id: "r4",
      code: "A203",
      name: "Seminar room",
      type: "lecture",
      capacity: 28,
      status: "available",
      can_update_status: true,
    },
    {
      id: "r5",
      code: "B105",
      name: "Computing laboratory",
      type: "lab",
      capacity: 36,
      status: "closed",
      can_update_status: false,
    },
  ].map((r) => ({
    ...r,
    building_code: r.code[0],
    floor_name: r.code.startsWith("A") ? "Ground floor" : "First floor",
    requires_admission: r.id === "r1",
  }));
  const courses = [
    { id: "c1", code: "CS204", name: "Interaction design" },
    { id: "c2", code: "CS210", name: "Data structures" },
    { id: "c3", code: "CS301", name: "Research seminar" },
  ];
  const term = {
    code: "2026-1",
    name: "First semester 2026",
    is_current: true,
  };
  const entries = [
    {
      id: "e1",
      course_id: "c1",
      course_code: "CS204",
      course_name: "Interaction design",
      type: "lecture",
      day_of_week: 1,
      starts_at: "09:00:00",
      ends_at: "10:30:00",
      room_id: "r1",
      room_code: "A101",
      room_name: "Learning commons",
      building_code: "A",
      term_code: term.code,
    },
    {
      id: "e2",
      course_id: "c2",
      course_code: "CS210",
      course_name: "Data structures",
      type: "lab",
      day_of_week: 3,
      starts_at: "14:00:00",
      ends_at: "16:00:00",
      room_id: "r2",
      room_code: "B204",
      room_name: "Interaction design studio",
      building_code: "B",
      term_code: term.code,
    },
    {
      id: "e3",
      course_id: "c3",
      course_code: "CS301",
      course_name: "Research seminar",
      type: "seminar",
      day_of_week: 0,
      starts_at: "10:00:00",
      ends_at: "11:00:00",
      room_id: null as string | null,
      room_code: null as string | null,
      room_name: null as string | null,
      building_code: null as string | null,
      term_code: term.code,
    },
  ];
  const config = { can_manage: true };
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", ""),
      method = route.request().method();
    const ok = (data: unknown) =>
      route.fulfill({ json: { success: true, data } });
    if (method !== "GET") {
      const body = route.request().postDataJSON() ?? {};
      writes.push({ path, method, body });
      if (path === "/staff/offices/o1/call-next") {
        const t = tickets.find((t) => t.status === "waiting")!;
        t.status = "called";
        return ok({ called: t });
      }
      const ticketMatch = path.match(
        /^\/staff\/office-tickets\/([^/]+)\/(check-in|start-service|complete|no-show)$/,
      );
      if (ticketMatch) {
        const t = tickets.find((t) => t.id === ticketMatch[1])!;
        t.status =
          ticketMatch[2] === "complete"
            ? "completed"
            : ticketMatch[2] === "no-show"
              ? "no_show"
              : "in_service";
        if (t.status === "in_service")
          t.service_started_at = "2026-09-15T10:02:00Z";
        return ok({ ticket: t });
      }
      if (path.startsWith("/staff/rooms/") && method === "PATCH") {
        const r = rooms.find((r) => r.id === path.split("/").pop())!;
        if (!r.can_update_status)
          return route.fulfill({
            status: 403,
            json: { success: false, message: "Outside your room assignment." },
          });
        r.status = body.status;
        return ok({ room: r, changed: true });
      }
      if (path.startsWith("/staff/timetable/") && method === "DELETE") {
        const index = entries.findIndex((e) => e.id === path.split("/").pop());
        entries.splice(index, 1);
        return route.fulfill({
          json: { success: true, message: "Timetable entry deleted" },
        });
      }
      if (
        (path === "/staff/timetable" && method === "POST") ||
        (path.startsWith("/staff/timetable/") && method === "PATCH")
      ) {
        const prior = entries.find((e) => e.id === path.split("/").pop());
        const c = courses.find(
            (c) => c.id === (prior?.course_id ?? body.course_id),
          )!,
          r = rooms.find((r) => r.id === body.room_id);
        const entry = {
          id: prior?.id ?? "e-new",
          course_id: c.id,
          course_code: c.code,
          course_name: c.name,
          type: body.type,
          term_code: prior?.term_code ?? body.term_code,
          day_of_week: body.day_of_week,
          starts_at: body.starts_at,
          ends_at: body.ends_at,
          room_id: body.room_id,
          room_code: r?.code ?? null,
          room_name: r?.name ?? null,
          building_code: r?.building_code ?? null,
        };
        if (prior) Object.assign(prior, entry);
        else entries.push(entry);
        return ok({ entry });
      }
    }
    const counts = {
      waiting: tickets.filter((t) => t.status === "waiting").length,
      called: tickets.filter((t) => t.status === "called").length,
      in_service: tickets.filter((t) => t.status === "in_service").length,
    };
    if (path === "/staff/offices")
      return ok({
        offices: [
          { ...office, waiting: counts.waiting, serving: counts.in_service },
          {
            ...office,
            id: "o2",
            code: "FIN",
            name: "Finance office",
            description: "Fees, account queries and financial clearance.",
            room_code: "C102",
            completed_today: 4,
            waiting: 3,
            serving: 1,
          },
          {
            ...office,
            id: "o3",
            code: "LIB",
            name: "Library services",
            description:
              "Access to collections, research materials and library accounts.",
            room_code: "A101",
            building_code: "A",
            completed_today: 0,
            waiting: 0,
            serving: 0,
            is_active: false,
          },
        ],
      });
    if (path === "/staff/offices/o1/line")
      return ok({
        office,
        line: tickets.filter(
          (t) => !["completed", "no_show"].includes(t.status),
        ),
        counts,
        windows,
      });
    if (path === "/staff/rooms") {
      const url = new URL(route.request().url());
      const q = (url.searchParams.get("q") ?? "").toLowerCase(),
        p = Number(url.searchParams.get("page") || 1);
      const found = rooms.filter((r) =>
        `${r.code} ${r.name}`.toLowerCase().includes(q),
      );
      return ok({
        items: found.slice((p - 1) * 3, p * 3),
        meta: {
          current_page: p,
          last_page: Math.max(1, Math.ceil(found.length / 3)),
          per_page: 3,
          total: found.length,
        },
      });
    }
    if (path === "/staff/timetable")
      return ok({
        entries: entries.filter(
          (e) =>
            e.term_code ===
            (new URL(route.request().url()).searchParams.get("term_code") ||
              term.code),
        ),
        ...config,
        courses,
        rooms: rooms.map((r) => ({ id: r.id, code: r.code, name: r.name })),
        terms: [term, { code: "2026-2", name: "Second semester 2026" }],
        term_code:
          new URL(route.request().url()).searchParams.get("term_code") ||
          term.code,
      });
    return route.fallback();
  });
  return { writes, office, tickets, windows, rooms, courses, entries, config };
}
