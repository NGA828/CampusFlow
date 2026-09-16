import type { Page } from "@playwright/test";
import { webSession } from "./web-visual-fixtures";

// Isolated, fictional review data using the Laravel payloads, including raw history rows.
export const serviceOffice = {
  id: "o1",
  code: "SA",
  name: "Student affairs",
  description:
    "Student records, enrolment support and everyday campus questions.",
  room_id: "r1",
  room_code: "C101",
  building_code: "C",
  building_name: "Student services",
  floor_name: "Ground floor",
  requires_appointment: false,
  requires_proximity_to_request: false,
  concurrent_capacity: 2,
  service_duration_minutes: 10,
  check_in_radius_m: 75,
  contact_email: "affairs@example.test",
  contact_phone: null,
  is_active: true,
  is_open: true,
};
export const serviceSummary = {
  office: serviceOffice,
  is_open_now: true,
  opens_at: "2026-09-15T08:00:00Z",
  closes_at: "2026-09-15T16:00:00Z",
  counts: { waiting: 4, in_service: 2, checked_in: 0, completed_today: 12 },
  estimated_wait_minutes: 20,
  average_service_minutes: 10,
  next_ticket_number: "SA-018",
  next_opening: null,
  expected_window: {
    starts_at: "2026-09-15T10:20:00Z",
    ends_at: "2026-09-15T10:30:00Z",
  },
  daily_capacity: 50,
  daily_capacity_used: 18,
  my_ticket: null,
  staff: [{ id: "s1", name: "Daniel Nwosu", role: "Service desk" }],
  windows: [
    {
      id: "win1",
      day_of_week: 2,
      opens_at: "08:00:00",
      closes_at: "16:00:00",
      capacity: 50,
      avg_service_minutes: 10,
    },
    {
      id: "win2",
      day_of_week: 0,
      opens_at: "09:00:00",
      closes_at: "12:00:00",
      capacity: 20,
      avg_service_minutes: 15,
    },
  ],
  today_in_line: [
    {
      position: 1,
      ticket_number: "SA-015",
      status: "in_service",
      called_at: "2026-09-15T09:55:00Z",
    },
    {
      position: 2,
      ticket_number: "SA-016",
      status: "waiting",
      called_at: null,
    },
  ],
  today_windows: [],
};
export const serviceTicket = {
  id: "t1",
  office_id: "o1",
  office_name: "Student affairs",
  office_code: "SA",
  ticket_number: "SA-017",
  subject: "Enrolment correction",
  notes: "Please review the course allocation for my new term.",
  joined_at: "2026-09-15T09:40:00Z",
  issued_at: "2026-09-15T09:40:00Z",
  position: 3,
  status: "waiting",
  called_at: null,
};
export const serviceView = {
  ticket: serviceTicket,
  office: serviceOffice,
  people_ahead: 2,
  eta_seconds: 1200,
  counts: { waiting: 4, in_service: 2 },
  expected_window: {
    starts_at: "2026-09-15T10:20:00Z",
    ends_at: "2026-09-15T10:30:00Z",
  },
  check_in_deadline: null,
  seconds_until_deadline: null,
  can_check_in: false,
  can_approaching: false,
  can_cancel: true,
  status_label: "Waiting",
};
export const teachingEntries = [
  {
    id: "c1",
    date: "2026-09-14",
    course_code: "CS201",
    course_title: "Data structures",
    starts_at: "09:00",
    ends_at: "10:30",
    session_type: "lecture",
    room_code: "A103",
    lecturer: "Dr. Okafor",
  },
  {
    id: "c2",
    date: "2026-09-15",
    course_code: "CS204",
    course_title: "Interaction design",
    starts_at: "11:00",
    ends_at: "12:30",
    session_type: "lecture",
    room_code: "B204",
    lecturer: "Dr. Adebayo",
  },
  {
    id: "c3",
    date: "2026-09-15",
    course_code: "CS220",
    course_title: "Design lab",
    starts_at: "11:30",
    ends_at: "13:00",
    session_type: "lab",
    room_code: "B105",
    lecturer: "Dr. Adebayo",
  },
  {
    id: "c4",
    date: "2026-09-16",
    course_code: "MAT140",
    course_title: "Linear algebra",
    starts_at: "07:00",
    ends_at: "08:00",
    session_type: "tutorial",
    room_code: "A201",
    lecturer: "Dr. Osei",
  },
  {
    id: "c5",
    date: "2026-09-17",
    course_code: "CS210",
    course_title: "Networks workshop",
    starts_at: "14:00",
    ends_at: "16:00",
    session_type: "lab",
    room_code: null,
    lecturer: "Dr. Okafor",
  },
  {
    id: "c6",
    date: "2026-09-20",
    course_code: "CS299",
    course_title: "Evening project review",
    starts_at: "21:00",
    ends_at: "22:00",
    session_type: "tutorial",
    room_code: "B204",
    lecturer: "Dr. Adebayo",
  },
].map((e) => ({
  ...e,
  starts_at_iso: `${e.date}T${e.starts_at}:00Z`,
  ends_at_iso: `${e.date}T${e.ends_at}:00Z`,
  building_name: "Science & design",
  note: "Check the published timetable for any changes.",
}));

export async function servicesSession(
  page: Page,
  mode: "success" | "error" | "empty" = "success",
) {
  await webSession(page, "student");
  let current = { ...serviceView, ticket: { ...serviceTicket } };
  const events = [
    { type: "created", created_at: "2026-09-15T09:40:00Z", metadata: null },
  ];
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    if (
      !path.startsWith("/student/offices") &&
      !path.startsWith("/student/office-tickets") &&
      path !== "/student/timetable"
    )
      return route.fallback();
    if (mode === "error")
      return route.fulfill({
        status: 503,
        json: {
          success: false,
          message: "The campus service is temporarily unavailable.",
        },
      });
    const ok = (data: unknown) =>
      route.fulfill({ json: { success: true, data } });
    if (path === "/student/timetable") {
      const week = url.searchParams.get("week") ?? "2026-09-14";
      return ok({
        week_start: week,
        term: "Semester one · 2026/27",
        dates: [],
        entries:
          mode === "empty" || week !== "2026-09-14" ? [] : teachingEntries,
      });
    }
    if (path === "/student/offices")
      return ok({
        offices:
          mode === "empty"
            ? []
            : [
                serviceSummary,
                {
                  ...serviceSummary,
                  office: {
                    ...serviceOffice,
                    id: "o2",
                    code: "REG",
                    name: "Registrar",
                    description:
                      "Transcripts, degree records and official academic documents.",
                    room_code: "C102",
                    requires_appointment: true,
                  },
                  counts: { waiting: 3, in_service: 1 },
                  estimated_wait_minutes: 30,
                },
                {
                  ...serviceSummary,
                  office: {
                    ...serviceOffice,
                    id: "o3",
                    code: "DEAN",
                    name: "Dean’s office",
                    description:
                      "Academic guidance and faculty administration.",
                    room_code: "C201",
                  },
                  is_open_now: false,
                  next_opening: "2026-09-16T09:00:00Z",
                  estimated_wait_minutes: 0,
                  counts: { waiting: 0, in_service: 0 },
                },
              ],
      });
    if (path === "/student/offices/SA") return ok(serviceSummary);
    if (path === "/student/office-tickets")
      return ok({
        tickets:
          mode === "empty"
            ? []
            : [
                serviceTicket,
                {
                  ...serviceTicket,
                  id: "old",
                  ticket_number: "SA-004",
                  subject: "Student record update",
                  status: "completed",
                  joined_at: "2026-09-12T10:00:00Z",
                },
              ],
        total: 2,
      });
    if (path === "/student/office-tickets/active")
      return ok({
        ticket: {
          ...serviceTicket,
          office_id: "another-office",
          ticket_number: "WRONG-001",
        },
      });
    if (path === "/student/offices/o1/tickets") {
      const body = route.request().postDataJSON();
      current = {
        ...serviceView,
        ticket: {
          ...serviceTicket,
          id: "new-ticket",
          ticket_number: "SA-018",
          subject: body.subject,
          notes: body.notes ?? null,
        },
      };
      return ok(current);
    }
    if (path.endsWith("/history"))
      return ok({ events: mode === "empty" ? [] : events });
    if (path.endsWith("/cancel")) {
      current = {
        ...current,
        ticket: { ...current.ticket, status: "cancelled" },
        can_cancel: false,
        status_label: "Cancelled",
      };
      events.push({
        type: "cancelled",
        created_at: "2026-09-15T10:00:00Z",
        metadata: null,
      });
      return ok(current);
    }
    if (
      path === "/student/office-tickets/t1" ||
      path === "/student/office-tickets/new-ticket"
    )
      return ok(current);
    return route.fallback();
  });
}
