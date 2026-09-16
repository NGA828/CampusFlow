import type { Page } from "@playwright/test";
import { webSession } from "./web-visual-fixtures";
export async function operationsSession(
  page: Page,
  role: "student" | "staff" | "admin" = "student",
) {
  await webSession(page, role);
  const requests: { path: string; body: Record<string, unknown> }[] = [];
  const queue = {
    id: "q1",
    room_id: "r1",
    room_code: "A101",
    room_name: "Learning commons",
    building_code: "A",
    floor_name: "Ground floor",
    is_open: true,
    capacity: 12,
    max_capacity: null as number | null,
    current_count: 1,
    avg_service_minutes: 6,
    proximity_radius_m: 30,
    join_requires_proximity: true,
    waiting: 2,
    checked_in: 1,
    called: 1,
  };
  const tickets = [
    {
      id: "t1",
      ticket_number: "A-021",
      position: 1,
      user_name: "Amina Yusuf",
      user_email: "amina@example.test",
      status: "called",
    },
    {
      id: "t2",
      ticket_number: "A-022",
      position: 2,
      user_name: "Alex Rivera",
      user_email: "alex@example.test",
      status: "checked_in",
    },
    {
      id: "t3",
      ticket_number: "A-023",
      position: 3,
      user_name: "Sarah Okafor",
      user_email: "sarah@example.test",
      status: "admitted",
    },
    {
      id: "t4",
      ticket_number: "A-024",
      position: 4,
      user_name: "Samuel Njoya",
      user_email: "samuel@example.test",
      status: "waiting",
    },
    {
      id: "t5",
      ticket_number: "A-025",
      position: 5,
      user_name: "Leila Mensah",
      user_email: "leila@example.test",
      status: "waiting",
    },
  ].map((t) => ({
    ...t,
    queue_id: "q1",
    joined_at: "2026-09-15T09:40:00Z",
    called_at: t.status === "called" ? "2026-09-15T09:58:00Z" : null,
    checked_in_at: t.status === "checked_in" ? "2026-09-15T10:00:00Z" : null,
    check_in_deadline: t.status === "called" ? "2026-09-15T10:15:00Z" : null,
  }));
  const buildings = [
    {
      id: "b1",
      code: "A",
      name: "Learning centre",
      lat: 3.863,
      lng: 11.512,
      footprint: [
        [11.5118, 3.8628],
        [11.5123, 3.8628],
        [11.5123, 3.8632],
        [11.5118, 3.8632],
      ],
      status: "operational",
    },
    {
      id: "b2",
      code: "B",
      name: "Science & design",
      lat: 3.864,
      lng: 11.514,
      footprint: [
        [11.5138, 3.8638],
        [11.5143, 3.8638],
        [11.5143, 3.8642],
        [11.5138, 3.8642],
      ],
      status: "operational",
    },
  ];
  const floors = [
    {
      id: "f1",
      building_id: "b1",
      name: "Ground floor",
      level: 0,
      plan_width_m: 40,
      plan_height_m: 30,
    },
    {
      id: "f2",
      building_id: "b1",
      name: "First floor",
      level: 1,
      plan_width_m: 40,
      plan_height_m: 30,
    },
  ];
  const rooms = [
    {
      id: "r1",
      floor_id: "f1",
      code: "A101",
      name: "Learning commons",
      type: "study",
      capacity: 40,
      status: "available",
      plan_x: 2,
      plan_y: 3,
    },
    {
      id: "r2",
      floor_id: "f1",
      code: "A102",
      name: "Seminar room",
      type: "meeting",
      capacity: 18,
      status: "occupied",
      plan_x: 23,
      plan_y: 3,
    },
    {
      id: "r3",
      floor_id: "f1",
      code: "A103",
      name: "Quiet study",
      type: "library",
      capacity: 24,
      status: "available",
      plan_x: 2,
      plan_y: 17,
    },
  ];
  const entry = {
    id: "c1",
    course_code: "CS204",
    course_name: "Interaction design",
    type: "lecture",
    day_of_week: 2,
    starts_at: "11:00:00",
    ends_at: "12:30:00",
    room_code: "A101",
    building_code: "A",
    room_id: "r1",
    minutes_until: 60,
  };
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    const method = route.request().method();
    const ok = (data: unknown) =>
      route.fulfill({ json: { success: true, data } });
    if (method === "POST") {
      requests.push({ path, body: route.request().postDataJSON() ?? {} });
      if (path === "/staff/queues/q1/open") {
        queue.is_open = route.request().postDataJSON().is_open;
        return ok({ queue });
      }
      if (path === "/staff/queues/q1/call-next") {
        const t = tickets.find((t) => t.status === "waiting");
        if (!t)
          return route.fulfill({
            status: 422,
            json: { success: false, message: "No waiting tickets" },
          });
        t.status = "called";
        return ok({ called: t });
      }
      const matched = path.match(
        /^\/staff\/queue-tickets\/([^/]+)\/(check-in|admit|complete|no-show)$/,
      );
      if (matched) {
        const t = tickets.find((t) => t.id === matched[1])!;
        if (matched[2] === "admit") queue.current_count++;
        if (matched[2] === "complete" && t.status === "admitted")
          queue.current_count--;
        t.status = {
          "check-in": "checked_in",
          admit: "admitted",
          complete: "completed",
          "no-show": "no_show",
        }[matched[2]]!;
        return ok({ ticket: t });
      }
    }
    const counts = {
      waiting: tickets.filter((t) => t.status === "waiting").length,
      called: tickets.filter((t) => t.status === "called").length,
      checked_in: tickets.filter((t) => t.status === "checked_in").length,
    };
    if (path === "/staff/queues")
      return ok({
        queues: [
          { ...queue, ...counts },
          {
            ...queue,
            id: "q2",
            room_code: "B204",
            room_name: "Design studio",
            building_code: "B",
            is_open: false,
            waiting: 0,
            checked_in: 0,
            current_count: 0,
          },
        ],
      });
    if (path === "/staff/queues/q1/line")
      return ok({
        queue,
        line: tickets.filter(
          (t) => !["completed", "no_show"].includes(t.status),
        ),
        counts,
      });
    if (path === "/student/dashboard")
      return ok({
        user: { id: "review-user", name: "Amina Yusuf", role: "student" },
        term: { name: "First semester", code: "2026-1" },
        today: {
          date: "2026-09-15",
          remaining: 2,
          entries: [
            entry,
            {
              ...entry,
              id: "c2",
              course_code: "CS210",
              course_name: "Data structures",
              starts_at: "14:00:00",
              ends_at: "15:30:00",
              room_code: "B204",
              building_code: "B",
            },
          ],
        },
        next_class: entry,
        queue_ticket: {
          ticket: { id: "t1", ticket_number: "A-021", status: "called" },
          queue: { room_code: "A101", room_name: "Learning commons" },
          people_ahead: 0,
        },
        office_ticket: {
          ticket: { id: "ot1", ticket_number: "SA-009", status: "waiting" },
          office: { name: "Student affairs" },
          status_label: "Waiting",
        },
        notifications: [
          {
            id: "n1",
            title: "Your room ticket has been called",
            body: "Check your ticket for its check-in window.",
          },
        ],
        unread_notifications: 1,
        building_alerts: [],
        announcements: [
          {
            id: "a1",
            title: "A new space to study",
            body: "The learning centre welcomes students throughout the week. Bring your student ID for room access.",
            priority: "normal",
          },
          {
            id: "a2",
            title: "Semester registration closes Friday",
            body: "Visit student affairs if you need help with your registration.",
            priority: "high",
          },
        ],
        events: [
          {
            id: "e1",
            title: "Design for a better campus",
            starts_at: "2026-09-18T14:00:00Z",
            venue: "Science auditorium",
          },
        ],
        campus_snapshot: { enrolled_courses: 5 },
        quick_actions: [
          { id: "map", label: "Explore campus", href: "/student/campus/map" },
          { id: "rooms", label: "Find a room", href: "/student/campus/rooms" },
        ],
      });
    if (path === "/campus/buildings") return ok({ buildings });
    if (path === "/campus/buildings/b1")
      return ok({ building: buildings[0], floors, rooms });
    if (path === "/campus/buildings/b2")
      return ok({ building: buildings[1], floors: [], rooms: [] });
    if (path === "/campus/floors/f1/plan")
      return ok({
        building: buildings[0],
        floor: floors[0],
        rooms,
        free_now: ["r1", "r3"],
      });
    if (path === "/campus/floors/f2/plan")
      return ok({
        building: buildings[0],
        floor: floors[1],
        rooms: [],
        free_now: [],
      });
    return route.fallback();
  });
  return { queue, tickets, requests, entry, buildings };
}
