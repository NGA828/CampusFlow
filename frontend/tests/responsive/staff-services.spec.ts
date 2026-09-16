import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { staffServicesSession } from "./staff-services-fixtures";
const output = resolve(
  __dirname,
  "../../../.cache/staff-services-pass/screens",
);
const cases = [
  {
    slug: "offices",
    path: "/staff/offices",
    title: "Office services",
    ready: "Student affairs",
    api: "/staff/offices",
  },
  {
    slug: "desk",
    path: "/staff/offices/o1",
    title: "Student affairs",
    ready: "Desk worklist",
    api: "/staff/offices/o1/line",
  },
  {
    slug: "rooms",
    path: "/staff/rooms",
    title: "Room management",
    ready: "Campus room directory",
    api: "/staff/rooms*",
  },
  {
    slug: "timetable",
    path: "/staff/timetable",
    title: "Teaching timetable",
    ready: "Your teaching week",
    api: "/staff/timetable",
  },
];
for (const width of [320, 768, 1440])
  for (const screen of cases)
    test(`${screen.slug} has a contained usable layout at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await staffServicesSession(page);
      await page.goto(screen.path);
      await expect(
        page.getByRole("heading", { name: screen.title, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: screen.ready, exact: true }),
      ).toBeVisible();
      if (screen.slug === "desk") {
        await page
          .getByRole("button", { name: "SA-009 · Amina Yusuf", exact: true })
          .click();
        await expect(
          page.getByRole("complementary", { name: "Selected service request" }),
        ).toBeFocused();
      }
      if (screen.slug === "rooms") {
        await page.getByRole("button", { name: "Review A101 status" }).click();
        await expect(
          page.getByRole("complementary", { name: "Room status workspace" }),
        ).toBeFocused();
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBe(0);
      if (width === 320)
        expect((await page.locator("h1").boundingBox())!.width).toBeGreaterThan(
          180,
        );
      await page.evaluate(async () => {
        await document.fonts.ready;
        window.scrollTo({ top: 0, behavior: "instant" });
      });
      mkdirSync(output, { recursive: true });
      await page.screenshot({
        path: `${output}/${screen.slug}-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
      expect(errors).toEqual([]);
    });
for (const screen of cases)
  test(`${screen.slug} shows scope rejection without fake success data`, async ({
    page,
  }) => {
    await staffServicesSession(page);
    await page.route(`**/api/v1${screen.api}`, (r) =>
      r.fulfill({
        status: 403,
        json: {
          success: false,
          message: "This resource is outside your assignment.",
        },
      }),
    );
    await page.goto(screen.path);
    await expect(
      page.getByText("This resource is outside your assignment.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Retry|Try again/ }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: screen.ready, exact: true }),
    ).toHaveCount(0);
  });
test("office search filters desks without inventing open-now status", async ({
  page,
}) => {
  await staffServicesSession(page);
  await page.goto("/staff/offices");
  await page.getByLabel("Find a service desk").fill("finance");
  await expect(
    page.getByRole("heading", { name: "Finance office" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Student affairs" }),
  ).toHaveCount(0);
  await page.getByLabel("Find a service desk").fill("missing desk");
  await expect(
    page.getByRole("heading", { name: "No desks match your search" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(
    page.getByText("Inactive office", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Open now", { exact: true })).toHaveCount(0);
});
test("office check-in starts service directly and completion uses a separate review", async ({
  page,
}) => {
  const f = await staffServicesSession(page);
  await page.goto("/staff/offices/o1");
  await page.getByRole("button", { name: "SA-009 · Amina Yusuf" }).click();
  await page.getByRole("button", { name: "Check in & start service" }).click();
  expect(f.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Confirm & start service" }).click();
  await page
    .getByRole("button", { name: "Complete service", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm completion" }).click();
  await expect(
    page.getByRole("button", { name: "SA-009 · Amina Yusuf" }),
  ).toHaveCount(0);
  expect(f.writes.map((w) => w.path.split("/").pop())).toEqual([
    "check-in",
    "complete",
  ]);
});
test("office windows retain weekday labels rather than all becoming today", async ({
  page,
}) => {
  await staffServicesSession(page);
  await page.goto("/staff/offices/o1");
  await expect(
    page.getByText("Monday · 08:00–12:00", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Wednesday · 13:00–16:00", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Sunday · 10:00–12:00", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Today's service windows", { exact: true }),
  ).toHaveCount(0);
});
test("one global office Call next does not call the selected later student", async ({
  page,
}) => {
  const f = await staffServicesSession(page);
  await page.goto("/staff/offices/o1");
  await page.getByRole("button", { name: "SA-012 · Leila Mensah" }).click();
  await expect(
    page.getByRole("button", { name: "Call next", exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Call next", exact: true }).click();
  await expect(
    page.getByText("The next waiting office ticket was called.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(f.tickets.find((t) => t.id === "ot3")!.status).toBe("called");
  expect(f.tickets.find((t) => t.id === "ot4")!.status).toBe("waiting");
});
test("office no-show reason is explicit and a rejected write leaves the request active", async ({
  page,
}) => {
  await staffServicesSession(page);
  await page.route("**/staff/office-tickets/ot1/no-show", (r) =>
    r.fulfill({
      status: 422,
      json: {
        success: false,
        message: "This ticket changed. Refresh the line.",
      },
    }),
  );
  await page.goto("/staff/offices/o1");
  await page.getByRole("button", { name: "SA-009 · Amina Yusuf" }).click();
  await page.getByRole("button", { name: "Mark no-show" }).click();
  await page.getByLabel("Reason (optional)").fill("Student did not arrive");
  await page.getByRole("button", { name: "Confirm no-show" }).click();
  await expect(
    page.getByText("This ticket changed. Refresh the line.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "SA-009 · Amina Yusuf" }),
  ).toBeVisible();
});
test("room update changes only status after deliberate save", async ({
  page,
}) => {
  const f = await staffServicesSession(page);
  await page.goto("/staff/rooms");
  await page.getByRole("button", { name: "Review A101 status" }).click();
  await page
    .getByRole("combobox", { name: "New room status" })
    .selectOption("maintenance");
  expect(f.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Save room status" }).click();
  await expect(
    page.getByText("A101 status confirmed: maintenance.", { exact: true }),
  ).toBeVisible();
  expect(f.writes[0].body).toEqual({ status: "maintenance" });
});
test("visible rooms outside the write scope remain view-only", async ({
  page,
}) => {
  const f = await staffServicesSession(page);
  await page.goto("/staff/rooms");
  await page.getByRole("button", { name: "Review C301 status" }).click();
  await expect(
    page.getByText(
      "You can view this room, but your account is not permitted to update its status.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save room status" }),
  ).toHaveCount(0);
  expect(f.writes).toHaveLength(0);
});
test("room pagination and search use server pages and reset selection", async ({
  page,
}) => {
  await staffServicesSession(page);
  await page.goto("/staff/rooms");
  await page.getByRole("button", { name: "Review A101 status" }).click();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(
    page.getByRole("heading", { name: "Seminar room", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "New room status" }),
  ).toHaveCount(0);
  await page.getByLabel("Search campus rooms").fill("Design");
  await page.getByRole("button", { name: "Search rooms", exact: true }).click();
  await expect(
    page.getByText("1 results · page 1 of 1", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled();
});
test("room failure never confirms a changed status and the draft survives", async ({
  page,
}) => {
  const f = await staffServicesSession(page);
  await page.route("**/api/v1/staff/rooms/r1", (r) =>
    r.fulfill({
      status: 403,
      json: { success: false, message: "Your assignment has changed." },
    }),
  );
  await page.goto("/staff/rooms");
  await page.getByRole("button", { name: "Review A101 status" }).click();
  await page
    .getByRole("combobox", { name: "New room status" })
    .selectOption("closed");
  await page.getByRole("button", { name: "Save room status" }).click();
  await expect(
    page.getByText("Your assignment has changed.", { exact: true }).first(),
  ).toBeVisible();
  expect(f.rooms[0].status).toBe("available");
  await expect(
    page.getByRole("combobox", { name: "New room status" }),
  ).toHaveValue("closed");
});
test("teaching Sunday zero is visible and all seven day filters work locally", async ({
  page,
}) => {
  await staffServicesSession(page);
  await page.goto("/staff/timetable");
  await expect(
    page.getByRole("heading", {
      name: "CS301 · Research seminar",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sunday", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "CS301 · Research seminar",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "CS204 · Interaction design",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Saturday", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No sessions in this view" }),
  ).toBeVisible();
});
test("new teaching session sends supported fields with seconds and Sunday zero", async ({
  page,
}) => {
  const f = await staffServicesSession(page);
  await page.goto("/staff/timetable");
  await page.getByRole("button", { name: "Add session", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Course", exact: true })
    .selectOption("c1");
  await page
    .getByRole("combobox", { name: "Day", exact: true })
    .selectOption("0");
  await page.getByLabel("Start time", { exact: true }).fill("13:00");
  await page.getByLabel("End time", { exact: true }).fill("14:00");
  await page.getByRole("button", { name: "Save session" }).click();
  await expect(
    page.getByText("Teaching session published.", { exact: true }),
  ).toBeVisible();
  expect(f.writes[0].body).toEqual({
    course_id: "c1",
    term_code: "2026-1",
    room_id: null,
    type: "lecture",
    day_of_week: 0,
    starts_at: "13:00:00",
    ends_at: "14:00:00",
  });
});
test("teaching edits preserve immutable course and term", async ({ page }) => {
  const f = await staffServicesSession(page);
  await page.goto("/staff/timetable");
  await page.getByRole("button", { name: "Edit CS204 Monday 09:00" }).click();
  await expect(
    page.getByRole("combobox", { name: "Course", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Session type" })
    .selectOption("tutorial");
  await page.getByRole("button", { name: "Save session" }).click();
  await expect(
    page.getByText("Teaching session updated.", { exact: true }),
  ).toBeVisible();
  expect(f.writes[0].method).toBe("PATCH");
  expect(f.writes[0].body).toEqual({
    room_id: "r1",
    type: "tutorial",
    day_of_week: 1,
    starts_at: "09:00:00",
    ends_at: "10:30:00",
  });
});
test("teaching save failure retains the draft and invalid end times do not send a request", async ({
  page,
}) => {
  const f = await staffServicesSession(page);
  await page.route("**/api/v1/staff/timetable/e1", (r) =>
    r.fulfill({
      status: 422,
      json: {
        success: false,
        message: "The room is unavailable for this session.",
      },
    }),
  );
  await page.goto("/staff/timetable");
  await page.getByRole("button", { name: "Edit CS204 Monday 09:00" }).click();
  await page.getByLabel("End time", { exact: true }).fill("08:30");
  await page.getByRole("button", { name: "Save session" }).click();
  await expect(
    page.getByText("End time must be later than start time on the same day.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(f.writes).toHaveLength(0);
  await page.getByLabel("End time", { exact: true }).fill("11:00");
  await page.getByRole("button", { name: "Save session" }).click();
  await expect(
    page
      .getByText("The room is unavailable for this session.", { exact: true })
      .first(),
  ).toBeVisible();
  await expect(page.getByLabel("End time", { exact: true })).toHaveValue(
    "11:00",
  );
});
test("teaching removal requires review and removes only the selected session", async ({
  page,
}) => {
  const f = await staffServicesSession(page);
  await page.goto("/staff/timetable");
  await page.getByRole("button", { name: "Remove CS301 Sunday 10:00" }).click();
  expect(f.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Confirm removal" }).click();
  await expect(
    page.getByText("Teaching session removed.", { exact: true }),
  ).toBeVisible();
  expect(f.entries.map((e) => e.id)).toEqual(["e1", "e2"]);
});
test("read-only teaching data does not expose mutation controls", async ({
  page,
}) => {
  const f = await staffServicesSession(page);
  f.config.can_manage = false;
  await page.goto("/staff/timetable");
  await expect(
    page.getByText("Read-only timetable", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add session", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Edit CS/ })).toHaveCount(0);
});
test("unknown teaching catalogues explain why publishing is unavailable", async ({
  page,
}) => {
  const f = await staffServicesSession(page);
  f.courses.splice(0);
  await page.goto("/staff/timetable");
  await page.getByRole("button", { name: "Add session", exact: true }).click();
  await expect(
    page.getByText("Course or term choices are unavailable.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save session" }),
  ).toBeDisabled();
});
for (const screen of cases)
  test(`${screen.slug} has an honest empty state`, async ({ page }) => {
    const f = await staffServicesSession(page);
    if (screen.slug === "offices")
      await page.route("**/api/v1/staff/offices", (r) =>
        r.fulfill({ json: { success: true, data: { offices: [] } } }),
      );
    if (screen.slug === "desk") f.tickets.splice(0);
    if (screen.slug === "rooms") f.rooms.splice(0);
    if (screen.slug === "timetable") f.entries.splice(0);
    await page.goto(screen.path);
    await expect(
      page.getByRole("heading", {
        name: {
          offices: "No offices in your operating scope",
          desk: "No active office tickets",
          rooms: "No rooms published",
          timetable: "No sessions in this view",
        }[screen.slug],
        exact: true,
      }),
    ).toBeVisible();
  });
test("a pending office call is locked against duplicate clicks", async ({
  page,
}) => {
  await staffServicesSession(page);
  let release = () => {};
  const gate = new Promise<void>((r) => {
    release = r;
  });
  let calls = 0;
  await page.route("**/api/v1/staff/offices/o1/call-next", async (r) => {
    calls++;
    await gate;
    await r.fallback();
  });
  await page.goto("/staff/offices/o1");
  const button = page.getByRole("button", { name: "Call next", exact: true });
  await button.evaluate((b) => {
    (b as HTMLButtonElement).click();
    (b as HTMLButtonElement).click();
  });
  await expect(button).toBeDisabled();
  expect(calls).toBe(1);
  release();
  await expect(
    page.getByText("The next waiting office ticket was called.", {
      exact: true,
    }),
  ).toBeVisible();
});
test("malformed room pagination is an error, not an invented first page", async ({
  page,
}) => {
  await staffServicesSession(page);
  await page.route("**/api/v1/staff/rooms*", (r) =>
    r.fulfill({
      json: { success: true, data: { items: [], meta: { total: 0 } } },
    }),
  );
  await page.goto("/staff/rooms");
  await expect(
    page.getByText(
      "The staff service returned an incomplete response. Please refresh.",
      { exact: true },
    ),
  ).toBeVisible();
});
test("narrow office selection focuses its brief and returns to the worklist", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await staffServicesSession(page);
  await page.goto("/staff/offices/o1");
  await page.getByRole("button", { name: "SA-009 · Amina Yusuf" }).click();
  await expect(
    page.getByRole("complementary", { name: "Selected service request" }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Check in & start service" }),
  ).toBeInViewport();
  await page.getByRole("link", { name: "Back to worklist ↓" }).click();
  await expect(
    page.getByRole("heading", { name: "Desk worklist" }),
  ).toBeInViewport();
});
test("a new session in another term is followed into its published term and day", async ({
  page,
}) => {
  await staffServicesSession(page);
  await page.goto("/staff/timetable");
  await page.getByRole("button", { name: "Add session", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Course", exact: true })
    .selectOption("c1");
  await page
    .getByRole("combobox", { name: "Term", exact: true })
    .selectOption("2026-2");
  await page
    .getByRole("combobox", { name: "Day", exact: true })
    .selectOption("0");
  await page.getByRole("button", { name: "Save session" }).click();
  await expect(
    page.getByRole("combobox", { name: "Teaching term", exact: true }),
  ).toHaveValue("2026-2");
  await expect(
    page.getByRole("button", { name: "Sunday", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("heading", {
      name: "CS204 · Interaction design",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "CS210 · Data structures", exact: true }),
  ).toHaveCount(0);
});
for (const screen of cases)
  test(`${screen.slug} keeps a pending read distinct from an empty result`, async ({
    page,
  }) => {
    await staffServicesSession(page);
    let release = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    await page.route(`**/api/v1${screen.api}`, async (route) => {
      await gate;
      await route.fallback();
    });
    await page.goto(screen.path);
    await expect(
      page.getByRole("heading", {
        name: screen.slug === "desk" ? "Office console" : screen.title,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: screen.ready, exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Add session", exact: true }),
    ).toHaveCount(0);
    release();
    await expect(
      page.getByRole("heading", { name: screen.ready, exact: true }),
    ).toBeVisible();
  });
test("a different ticket in a success response cannot confirm the selected request", async ({
  page,
}) => {
  await staffServicesSession(page);
  await page.route("**/api/v1/staff/office-tickets/ot1/check-in", (r) =>
    r.fulfill({
      json: {
        success: true,
        data: { ticket: { id: "other-ticket", status: "in_service" } },
      },
    }),
  );
  await page.goto("/staff/offices/o1");
  await page.getByRole("button", { name: "SA-009 · Amina Yusuf" }).click();
  await page.getByRole("button", { name: "Check in & start service" }).click();
  await page.getByRole("button", { name: "Confirm & start service" }).click();
  await expect(
    page.getByText("The ticket change could not be confirmed.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Check in & start service" }),
  ).toBeVisible();
});
