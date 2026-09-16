import type { Page } from "@playwright/test";
import { webSession } from "./web-visual-fixtures";
export async function coordinationSession(
  page: Page,
  role: "staff" | "admin" = "staff",
) {
  await webSession(page, role);
  const writes: {
    path: string;
    body: Record<string, unknown>;
    method: string;
  }[] = [];
  const now = "2026-09-15T10:00:00Z";
  let people = [
    {
      id: "u1",
      name: "Alex Rivera",
      email: "alex@example.test",
      role: "staff",
      status: "active",
      department: "Design",
      registration_no: null,
    },
    {
      id: "u2",
      name: "Amina Yusuf",
      email: "amina@example.test",
      role: "student",
      status: "active",
      department: "Computer science",
      registration_no: "ST204",
    },
    {
      id: "review-user",
      name: "Nadia Mensah",
      email: "admin@example.test",
      role: "admin",
      status: "active",
      department: "Governance",
      registration_no: null,
    },
  ];
  let events = [
    {
      id: "e1",
      title: "Design futures workshop",
      description: "Bring your sketches and explore a more inclusive campus.",
      category: "academic",
      starts_at: "2026-09-18T10:00:00Z",
      ends_at: "2026-09-18T12:00:00Z",
      venue: "Learning commons · A101",
      capacity: 24,
      status: "published",
      can_manage: true,
    },
    {
      id: "e2",
      title: "Research conversations",
      description: "Meet campus researchers and ask about their work.",
      category: "career",
      starts_at: "2026-09-19T14:00:00Z",
      ends_at: null,
      venue: "Science atrium",
      capacity: null,
      status: "published",
      can_manage: false,
    },
    {
      id: "e3",
      title: "Campus welcome walk",
      description: "Discover places to learn together.",
      category: "social",
      starts_at: "2026-09-20T09:00:00Z",
      ends_at: null,
      venue: "Main entrance",
      capacity: 40,
      status: "published",
      can_manage: true,
    },
  ];
  let notices = [
    {
      id: "n1",
      title: "Staff briefing on Thursday",
      body: "Please review the revised service schedule before the briefing.",
      priority: "high",
      target_roles: ["staff"],
      published_at: now,
    },
    {
      id: "n2",
      title: "A quieter place to study",
      body: "The learning centre is available for individual study.",
      priority: "normal",
      target_roles: null,
      published_at: now,
    },
  ];
  let assignments = [
    {
      id: "as1",
      user_id: "u1",
      user: { name: "Alex Rivera" },
      scope_type: "room",
      scope_id: "r1",
      role_in_scope: "Service operator",
      can_call_tickets: true,
      can_manage_timetable: false,
      can_publish_content: false,
    },
  ];
  const catalogue = {
    people: [
      { id: "u1", name: "Alex Rivera", email: "alex@example.test" },
      {
        id: "u9",
        name: "Staff outside this user page",
        email: "offpage@example.test",
      },
    ],
    scopes: {
      building: [{ id: "b1", label: "A · Learning centre" }],
      floor: [{ id: "f1", label: "Ground floor" }],
      room: [{ id: "r1", label: "A101 · Learning commons" }],
      office: [{ id: "o1", label: "SA · Student affairs" }],
      course: [{ id: "c1", label: "CS204 · Interaction design" }],
    },
  };
  const queue = {
    queue_id: "q1",
    room_id: "r1",
    room_code: "A101",
    room_name: "Learning commons",
    building_code: "A",
    floor_name: "Ground floor",
    is_active: false,
    admission_capacity: 8,
    waiting: 4,
    occupying: 2,
    checked_in: 1,
    current: null,
  };
  const office = {
    office_id: "o1",
    name: "Student affairs",
    code: "SA",
    building_code: "C",
    floor_name: "Ground floor",
    room_code: "C101",
    is_active: true,
    waiting: 3,
    in_service: 1,
    completed_today: 8,
    current: null,
  };
  const dashboard = {
    scopes: { queues: 1, offices: 1 },
    queues: [queue],
    offices: [office],
    kpis: { served_today: 19, waiting_now: 7, offices_open: 1 },
    campus_time: {
      date: "2026-09-15",
      time: "10:00:00",
      minutes: 600,
      dayOfWeek: 2,
    },
    pending_queue_actions: [
      {
        id: "qt1",
        ticket_number: "Q-012",
        student_name: "Amina Yusuf",
        status: "checked_in",
        queue_id: "q1",
        room_code: "A101",
      },
    ],
    pending_office_actions: [
      {
        id: "ot1",
        ticket_number: "SA-009",
        student_name: "Leila Mensah",
        status: "in_service",
        office_name: "Student affairs",
        office_id: "o1",
      },
    ],
    teaching_today: [
      {
        id: "te1",
        course_code: "CS204",
        course_title: "Interaction design",
        starts_at: "11:00:00",
        ends_at: "12:30:00",
        room_code: "B204",
        session_type: "lecture",
      },
      {
        id: "te2",
        course_code: "CS210",
        course_title: "Data structures",
        starts_at: "14:00:00",
        ends_at: "15:30:00",
        room_code: "A101",
        session_type: "lab",
      },
    ],
  };
  const admin = {
    kpis: {
      generated_at: now,
      students: 1840,
      staff: 85,
      waiting_now: 28,
      office_waiting_now: 12,
      issued_today: 146,
      office_completed_today: 51,
      navigation_sessions_today: 204,
      rooms: 38,
      buildings: 3,
      average_wait_minutes: null,
      no_show_rate_7d: null,
    },
    overview: {
      users: {
        total: 1928,
        students: 1840,
        staff: 85,
        admins: 3,
        active_7d: 1200,
      },
      campus: { buildings: 3, rooms: 38, floors: 7 },
      queues: {
        configured: 12,
        active: 8,
        issued_7d: 834,
        busiest_rooms: [],
        hourly_volume: [],
        average_wait_minutes: null,
        no_show_rate_7d: null,
      },
      offices: { issued_today: 74, completed_today: 51 },
      navigation: { sessions_7d: 1402, completion_rate_7d: null },
      engagement: { events_upcoming: 6, notifications_7d: 492 },
    },
    live_queues: [
      queue,
      {
        ...queue,
        queue_id: "q2",
        room_code: "B204",
        room_name: "Interaction design studio",
        is_active: true,
        waiting: 6,
        occupying: 5,
        admission_capacity: 12,
      },
    ],
    buildings: [
      { id: "b1", code: "A", name: "Learning centre", status: "operational" },
      { id: "b2", code: "B", name: "Science & design", status: "operational" },
      { id: "b3", code: "C", name: "Student services", status: "maintenance" },
    ],
    recent_audit: [
      {
        id: 1,
        actor_name: "Nadia Mensah",
        action: "user.role.changed",
        subject_type: "User",
        created_at: now,
      },
      {
        id: 2,
        actor_name: "Daniel Nwosu",
        action: "queue.updated",
        subject_type: "RoomQueue",
        created_at: now,
      },
    ],
  };
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname.replace("/api/v1", ""),
      method = req.method();
    const ok = (data: unknown) =>
      route.fulfill({ json: { success: true, data } });
    if (method === "GET") {
      if (path === "/staff/dashboard") return ok(dashboard);
      if (path === "/admin/dashboard") return ok(admin);
      if (path === "/admin/users") {
        const q = (url.searchParams.get("q") || "").toLowerCase(),
          role = url.searchParams.get("role"),
          p = Number(url.searchParams.get("page") || 1);
        const list = people.filter(
          (u) =>
            (!role || u.role === role) &&
            `${u.name} ${u.email} ${u.registration_no || ""}`
              .toLowerCase()
              .includes(q),
        );
        return ok({
          items: list.slice((p - 1) * 2, p * 2),
          meta: {
            current_page: p,
            last_page: Math.max(1, Math.ceil(list.length / 2)),
            total: list.length,
            per_page: 2,
          },
        });
      }
      if (path === "/admin/staff-assignments")
        return ok({ assignments, ...catalogue });
      if (path === "/campus/events") {
        const p = Number(url.searchParams.get("page") || 1);
        return ok({
          items: events.slice((p - 1) * 2, p * 2),
          meta: {
            page: p,
            total_pages: Math.max(1, Math.ceil(events.length / 2)),
            total: events.length,
            per_page: 2,
          },
        });
      }
      if (path === "/staff/announcements")
        return ok({ announcements: notices });
      return route.fallback();
    }
    const body = (req.postData() ? req.postDataJSON() : {}) as Record<
      string,
      unknown
    >;
    if (!path.startsWith("/admin/") && !path.startsWith("/staff/"))
      return route.fallback();
    writes.push({ path, body, method });
    if (path === "/staff/events" && method === "POST") {
      const e = { ...events[0], ...body, id: "new-event", can_manage: true };
      events.push(e as (typeof events)[number]);
      return ok({ event: e });
    }
    if (path.startsWith("/staff/events/")) {
      const id = path.split("/").pop()!;
      if (method === "DELETE") {
        events = events.filter((e) => e.id !== id);
        return ok({});
      }
      const e = events.find((e) => e.id === id)!;
      Object.assign(e, body);
      return ok({ event: e });
    }
    if (path === "/staff/announcements") {
      const n = { ...body, id: "new-notice", published_at: now };
      notices.push(n as (typeof notices)[number]);
      return ok({ announcement: n });
    }
    if (path.startsWith("/staff/announcements/")) {
      notices = notices.filter((n) => n.id !== path.split("/").pop());
      return ok({});
    }
    if (path === "/admin/users") {
      const u = {
        ...body,
        id: "new-person",
        status: "active",
        registration_no: body.registration_no ?? null,
        department: body.department ?? null,
      };
      people.push(u as (typeof people)[number]);
      return ok({
        user: u,
        password: body.password ? null : "test-only-temporary-pass",
      });
    }
    if (path.endsWith("/reset-password"))
      return ok({ password: "test-only-reset-pass" });
    if (path.startsWith("/admin/users/")) {
      const id = path.split("/")[3],
        u = people.find((u) => u.id === id)!;
      if (method === "DELETE") {
        people = people.filter((p) => p.id !== id);
        return ok({});
      }
      Object.assign(u, body);
      return ok({ user: u, changed: true });
    }
    if (path === "/admin/staff-assignments") {
      const a = {
        ...body,
        id: "as-new",
        user: { name: "Staff outside this user page" },
      };
      assignments.push(a as (typeof assignments)[number]);
      return ok({ assignment: a });
    }
    if (path.startsWith("/admin/staff-assignments/")) {
      assignments = assignments.filter((a) => a.id !== path.split("/").pop());
      return ok({});
    }
    return route.fallback();
  });
  return { writes, dashboard, admin, catalogue };
}
