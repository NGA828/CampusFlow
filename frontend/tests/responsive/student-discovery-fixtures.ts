import type { Page } from "@playwright/test";
import { webSession } from "./web-visual-fixtures";

// Review-only data. Laravel wire names are deliberately retained to test the API boundary.
export async function discoverySession(
  page: Page,
  mode: "success" | "empty" | "error" = "success",
) {
  await webSession(page, "student");
  const rooms = [
    {
      id: "r1",
      code: "B204",
      name: "Interaction design studio",
      type: "lab",
      capacity: 30,
      building_name: "Science & design",
      building_code: "B",
      floor_name: "First floor",
      requires_admission: true,
      features: ["projector", "whiteboard"],
      status: "operational",
    },
    {
      id: "r2",
      code: "A101",
      name: "Learning commons",
      type: "study",
      capacity: 64,
      building_name: "Learning centre",
      building_code: "A",
      floor_name: "Ground floor",
      requires_admission: false,
      features: ["power_outlets", "wifi"],
      status: "operational",
    },
    {
      id: "r3",
      code: "A203",
      name: "Seminar room",
      type: "meeting",
      capacity: 18,
      building_name: "Learning centre",
      building_code: "A",
      floor_name: "Second floor",
      requires_admission: false,
      features: ["whiteboard"],
      status: "operational",
    },
    {
      id: "r4",
      code: "B105",
      name: "Computer laboratory",
      type: "lab",
      capacity: 40,
      building_name: "Science & design",
      building_code: "B",
      floor_name: "Ground floor",
      requires_admission: true,
      features: ["computers", "projector"],
      status: "operational",
    },
  ];
  const events = [
    {
      id: "e1",
      title: "Ideas that shape tomorrow",
      category: "academic",
      description:
        "Join students and researchers for an afternoon of fresh ideas, thoughtful questions and conversations across disciplines.",
      venue: "Learning centre auditorium",
      room_id: "r2",
      room_code: "A101",
      starts_at: "2026-09-16T14:00:00Z",
      ends_at: "2026-09-16T17:00:00Z",
      capacity: 120,
      status: "published",
      is_registered: false,
    },
    {
      id: "e2",
      title: "Build something together",
      category: "hackathon",
      description:
        "A hands-on student hackathon. Bring a curious mind and meet your next project team.",
      venue: "Interaction design studio",
      starts_at: "2026-09-18T09:00:00Z",
      ends_at: "2026-09-18T17:00:00Z",
      capacity: 40,
      status: "published",
      is_registered: true,
    },
    {
      id: "e3",
      title: "A conversation about your next chapter",
      category: "career",
      description:
        "Meet graduates and hear about their first steps beyond university.",
      venue: "Student services hall",
      starts_at: "2026-09-20T10:00:00Z",
      ends_at: "2026-09-20T12:00:00Z",
      capacity: null,
      status: "published",
      is_registered: false,
    },
    {
      id: "e4",
      title: "Welcome to the new term",
      category: "social",
      description: "A gathering to welcome our campus community.",
      venue: "Campus green",
      starts_at: "2026-09-10T10:00:00Z",
      ends_at: "2026-09-10T12:00:00Z",
      capacity: null,
      status: "published",
      is_registered: false,
    },
  ];
  const notices = [
    {
      id: "a1",
      title: "A new chapter for the learning centre",
      body: "Your favourite place to focus now has more room for collaboration. The learning centre has opened a shared study area on the ground floor.\n\nBring your student card, choose a quiet desk or meet your project group. Please keep walkways clear and leave the space ready for the next person. Full access details are available from the learning centre team.",
      priority: "normal",
      is_pinned: true,
      published_at: "2026-09-15T08:00:00Z",
      expires_at: null,
      target_roles: ["student"],
    },
    {
      id: "a2",
      title: "Water maintenance at Science & design",
      body: "Water supply will be interrupted on Wednesday morning while the facilities team completes essential maintenance. Please use the facilities in the learning centre during this period.",
      priority: "urgent",
      published_at: "2026-09-15T09:00:00Z",
      expires_at: "2026-09-17T17:00:00Z",
      target_roles: ["student", "staff"],
    },
    {
      id: "a3",
      title: "Check your timetable before Monday",
      body: "Room allocations for the new teaching week have been updated. Check your personal timetable before travelling to your next session.",
      priority: "high",
      published_at: "2026-09-14T09:00:00Z",
      expires_at: null,
    },
    {
      id: "a4",
      title: "Small steps, a greener campus",
      body: "Reusable water bottles and clearly sorted recycling make a difference. Thank you for helping look after our shared campus.",
      priority: "normal",
      published_at: "2026-09-13T09:00:00Z",
      expires_at: null,
    },
  ];
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    const ok = (data: unknown) =>
      route.fulfill({ json: { success: true, data } });
    if (
      !path.startsWith("/campus/rooms") &&
      !path.startsWith("/campus/events") &&
      !path.startsWith("/campus/announcements") &&
      !path.startsWith("/student/events")
    )
      return route.fallback();
    if (mode === "error")
      return route.fulfill({
        status: 503,
        json: {
          success: false,
          message: "The discovery service is unavailable. Try again shortly.",
        },
      });
    if (path === "/campus/rooms") {
      const q = url.searchParams.get("q")?.toLowerCase();
      const items =
        mode === "empty"
          ? []
          : rooms.filter(
              (r) =>
                (!q || `${r.name} ${r.code}`.toLowerCase().includes(q)) &&
                (!url.searchParams.get("type") ||
                  r.type === url.searchParams.get("type")) &&
                (!url.searchParams.get("admission_required") ||
                  r.requires_admission),
            );
      return ok({
        items,
        meta: {
          current_page: Number(url.searchParams.get("page") ?? 1),
          last_page: 2,
          total: 16,
          per_page: 12,
        },
      });
    }
    if (path === "/campus/rooms/B204")
      return ok({
        room: rooms[0],
        availability: {
          room_id: "r1",
          date: "2026-09-15",
          is_open: true,
          is_available_now: true,
          next_free_at: null,
          headline: "A little space before your next class.",
          reason: null,
          current_session: null,
          session_count: 2,
          busy: [
            {
              starts_at: "11:00",
              ends_at: "12:30",
              course_code: "CS204",
              course_title: "Interaction design",
              session_type: "lecture",
            },
            {
              starts_at: "14:00",
              ends_at: "15:30",
              course_code: "CS210",
              course_title: "Data structures",
              session_type: "lab",
            },
          ],
          free_slots: [
            { starts_at: "08:00", ends_at: "11:00" },
            { starts_at: "12:30", ends_at: "14:00" },
            { starts_at: "15:30", ends_at: "18:00" },
          ],
          occupancy: { inside: 4, capacity: 10 },
          queue: {
            id: "q1",
            waiting: 6,
            requires_proximity: true,
            is_active: true,
          },
        },
        week: [
          {
            id: "w1",
            day_of_week: 2,
            starts_at: "11:00",
            ends_at: "12:30",
            course_code: "CS204",
            course_title: "Interaction design",
            session_type: "lecture",
          },
          {
            id: "w2",
            day_of_week: 4,
            starts_at: "14:00",
            ends_at: "15:30",
            course_code: "CS210",
            course_title: "Data structures",
            session_type: "lab",
          },
        ],
        days: {},
      });
    if (path === "/campus/events")
      return ok({
        items: mode === "empty" ? [] : events,
        meta: { page: 1, total_pages: 1, total: events.length, per_page: 40 },
      });
    if (path === "/campus/announcements")
      return ok({
        items: mode === "empty" ? [] : notices,
        meta: { page: 1, total_pages: 1, total: notices.length, per_page: 30 },
      });
    const event = events.find(
      (e) => path === `/student/events/${e.id}/register`,
    );
    if (event) {
      event.is_registered = route.request().method() !== "DELETE";
      return ok({ id: "registration", event_id: event.id });
    }
    return route.fallback();
  });
}
