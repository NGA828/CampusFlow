import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { operationsSession } from "./campus-operations-fixtures";
const screens = resolve(__dirname, "../../../.cache/operations-pass/screens");
const cases = [
  {
    slug: "dashboard",
    path: "/student/dashboard",
    role: "student",
    title: "Hello, Amina.",
    ready: "Today’s agenda",
  },
  {
    slug: "map",
    path: "/student/campus/map",
    role: "student",
    title: "Campus map",
    ready: "Learning centre",
  },
  {
    slug: "staff-queues",
    path: "/staff/queues",
    role: "staff",
    title: "Room queues",
    ready: "Your queue directory",
  },
  {
    slug: "staff-queue",
    path: "/staff/queues/q1",
    role: "staff",
    title: "A101 queue",
    ready: "Current line",
  },
] as const;
for (const width of [320, 768, 1440])
  for (const screen of cases)
    test(`${screen.slug} is usable at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await operationsSession(page, screen.role);
      await page.goto(screen.path);
      await expect(
        page.getByRole("heading", { name: screen.title, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: screen.ready, exact: true }),
      ).toBeVisible();
      if (screen.slug === "staff-queue") {
        await page.getByRole("button", { name: /A-022/ }).click();
        await expect(
          page.getByRole("button", { name: "Admit to room", exact: true }),
        ).toBeVisible();
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBeLessThanOrEqual(0);
      if (width === 320)
        expect((await page.locator("h1").boundingBox())!.width).toBeGreaterThan(
          180,
        );
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.images].map((i) => i.decode().catch(() => {})),
        );
        window.scrollTo(0, 0);
      });
      mkdirSync(screens, { recursive: true });
      await page.screenshot({
        path: `${screens}/${screen.slug}-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
      expect(errors).toEqual([]);
    });
for (const screen of cases)
  test(`${screen.slug} shows service errors with a retry`, async ({ page }) => {
    await operationsSession(page, screen.role);
    const endpoint =
      screen.slug === "dashboard"
        ? "/student/dashboard"
        : screen.slug === "map"
          ? "/campus/buildings"
          : screen.slug === "staff-queues"
            ? "/staff/queues"
            : "/staff/queues/q1/line";
    await page.route(`**/api/v1${endpoint}`, (route) =>
      route.fulfill({
        status: 403,
        json: {
          success: false,
          message: "This resource is outside your assigned scope.",
        },
      }),
    );
    await page.goto(screen.path);
    await expect(
      page.getByText("This resource is outside your assigned scope.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Retry|Try again/ }).first(),
    ).toBeVisible();
  });
test("dashboard renders Laravel wall-clock names, later-day next class and office receipt link", async ({
  page,
}) => {
  const fixture = await operationsSession(page);
  fixture.entry.day_of_week = 3;
  fixture.entry.minutes_until = 1500;
  await page.goto("/student/dashboard");
  await expect(
    page
      .getByRole("heading", { name: "Interaction design", exact: true })
      .first(),
  ).toBeVisible();
  await expect(page.getByText("11:00 – 12:30", { exact: true })).toBeVisible();
  await expect(page.getByText("Wed · A101 · A", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open office ticket →" }),
  ).toHaveAttribute("href", "/student/services/offices/tickets/ot1");
  await expect(page.getByText(/Invalid Date|NaN/)).toHaveCount(0);
});
test("dashboard secondary queue failure does not erase the daily agenda", async ({
  page,
}) => {
  await operationsSession(page);
  await page.route("**/api/v1/student/queues/board", (r) =>
    r.fulfill({
      status: 503,
      json: { success: false, message: "Queue activity unavailable" },
    }),
  );
  await page.goto("/student/dashboard");
  await expect(
    page.getByRole("heading", { name: "Today’s agenda" }),
  ).toBeVisible();
  await expect(
    page.getByText("Queue activity unavailable", { exact: true }),
  ).toBeVisible();
});
test("indoor exploration never presents rooms from the previous building or floor", async ({
  page,
}) => {
  await operationsSession(page);
  await page.goto("/student/campus/map");
  await page.getByRole("button", { name: "Indoor", exact: true }).click();
  await page.getByRole("button", { name: /A101 · Learning commons/ }).click();
  await expect(
    page.getByRole("region", { name: "Selected room" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Floor", exact: true })
    .selectOption("f2");
  await expect(
    page.getByRole("heading", { name: "No rooms on this plan yet" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Selected room" })).toHaveCount(
    0,
  );
  await page
    .getByRole("combobox", { name: "Floor", exact: true })
    .selectOption("f1");
  await expect(
    page.getByRole("button", { name: /A101 · Learning commons/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /B · Science & design/ }).click();
  await expect(
    page.getByRole("heading", { name: "No indoor floors published" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /A101 · Learning commons/ }),
  ).toHaveCount(0);
});
test("position failure is not represented as no saved position", async ({
  page,
}) => {
  await operationsSession(page);
  await page.route("**/api/v1/student/positioning/current", (r) =>
    r.fulfill({
      status: 503,
      json: { success: false, message: "Position unavailable" },
    }),
  );
  await page.goto("/student/campus/map");
  await expect(
    page.getByText("Saved position unavailable.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("No saved position.", { exact: false }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Retry saved position" }).click();
});
test("zero latitude and longitude remain valid saved coordinates", async ({
  page,
}) => {
  await operationsSession(page);
  await page.route("**/api/v1/student/positioning/current", (r) =>
    r.fulfill({
      json: {
        success: true,
        data: {
          position: {
            lat: 0,
            lng: 0,
            building_name: "Equator campus",
            updated_at: "2026-09-15T09:00:00Z",
            plan_x: null,
            plan_y: null,
          },
        },
      },
    }),
  );
  await page.goto("/student/campus/map");
  await expect(
    page.locator('svg g[aria-label="Saved position"]'),
  ).toBeVisible();
});
test("queue directory searches closed lines and confirmed closing keeps the line accessible", async ({
  page,
}) => {
  const fixture = await operationsSession(page, "staff");
  await page.goto("/staff/queues");
  await page.getByLabel("Queue state").selectOption("closed");
  await expect(
    page.getByRole("heading", { name: "Design studio" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Learning commons" }),
  ).toHaveCount(0);
  await page.getByLabel("Queue state").selectOption("all");
  await page.getByRole("button", { name: "Close queue" }).click();
  await expect(
    page.getByText("A101 closed to new joins. Existing tickets remain."),
  ).toBeVisible();
  await expect(
    page
      .getByRole("article", { name: "A101 queue" })
      .getByRole("button", { name: "Open queue" }),
  ).toBeVisible();
  expect(fixture.requests.filter((r) => r.path.endsWith("/open"))).toHaveLength(
    1,
  );
  await page.getByLabel("Find a room").fill("no match");
  await expect(
    page.getByRole("heading", { name: "No matching queues" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(
    page.getByRole("heading", { name: "Learning commons" }),
  ).toBeVisible();
});
test("one Call next operates the server waiting order, not the selected person", async ({
  page,
}) => {
  const fixture = await operationsSession(page, "staff");
  await page.goto("/staff/queues/q1");
  await page.getByRole("button", { name: /A-025/ }).click();
  await expect(
    page.getByRole("button", { name: "Call next", exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Call next", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /A-024.*Called/ }),
  ).toBeVisible();
  expect(fixture.tickets.find((t) => t.id === "t5")!.status).toBe("waiting");
  expect(fixture.requests[0].path).toBe("/staff/queues/q1/call-next");
});
test("desk check-in, admission and completion each require confirmation and a server reply", async ({
  page,
}) => {
  const fixture = await operationsSession(page, "staff");
  await page.goto("/staff/queues/q1");
  await page.getByRole("button", { name: /A-021/ }).click();
  await page.getByRole("button", { name: "Confirm desk check-in" }).click();
  expect(fixture.requests).toHaveLength(0);
  await page
    .getByRole("button", { name: "Confirm check-in", exact: true })
    .click();
  await page.getByRole("button", { name: "Admit to room" }).click();
  await page.getByRole("button", { name: "Confirm admit" }).click();
  await page.getByRole("button", { name: "Complete service" }).click();
  await page.getByRole("button", { name: "Confirm complete" }).click();
  await expect(page.getByRole("button", { name: /A-021/ })).toHaveCount(0);
  expect(fixture.requests.map((r) => r.path.split("/").pop())).toEqual([
    "check-in",
    "admit",
    "complete",
  ]);
  expect(fixture.queue.current_count).toBe(1);
});
test("capacity rejection keeps a ticket checked in and reports the actual failure", async ({
  page,
}) => {
  const fixture = await operationsSession(page, "staff");
  await page.route("**/api/v1/staff/queue-tickets/t2/admit", (r) =>
    r.fulfill({
      status: 422,
      json: { success: false, message: "This room is at capacity." },
    }),
  );
  await page.goto("/staff/queues/q1");
  await page.getByRole("button", { name: /A-022/ }).click();
  await page.getByRole("button", { name: "Admit to room" }).click();
  await page.getByRole("button", { name: "Confirm admit" }).click();
  await expect(
    page.getByText("This room is at capacity.", { exact: true }),
  ).toBeVisible();
  expect(fixture.tickets[1].status).toBe("checked_in");
  await expect(
    page.getByRole("button", { name: "Admit to room" }),
  ).toBeVisible();
});
test("no-show has a review step and submits the optional reason", async ({
  page,
}) => {
  const fixture = await operationsSession(page, "staff");
  await page.goto("/staff/queues/q1");
  await page.getByRole("button", { name: /A-021/ }).click();
  await page.getByRole("button", { name: "Mark no-show" }).click();
  await page.getByLabel("Reason (optional)").fill("Student did not arrive");
  await page.getByRole("button", { name: "Confirm no-show" }).click();
  await expect(page.getByRole("button", { name: /A-021/ })).toHaveCount(0);
  expect(fixture.requests[0].body.reason).toBe("Student did not arrive");
});
test("rapid call clicks cannot dispatch two students while the request is pending", async ({
  page,
}) => {
  await operationsSession(page, "staff");
  let count = 0;
  let release = () => {};
  const gate = new Promise<void>((r) => {
    release = r;
  });
  await page.route("**/api/v1/staff/queues/q1/call-next", async (route) => {
    count++;
    await gate;
    await route.fallback();
  });
  await page.goto("/staff/queues/q1");
  const call = page.getByRole("button", { name: "Call next", exact: true });
  await call.evaluate((b) => {
    (b as HTMLButtonElement).click();
    (b as HTMLButtonElement).click();
  });
  await expect(call).toBeDisabled();
  expect(count).toBe(1);
  release();
  await expect(
    page.getByText("The next waiting student was called.", { exact: true }),
  ).toBeVisible();
});
test("an unconfirmed open response is a failure, not a success toast", async ({
  page,
}) => {
  await operationsSession(page, "staff");
  await page.route("**/api/v1/staff/queues/q1/open", (r) =>
    r.fulfill({
      json: { success: true, data: { queue: { id: "wrong", is_open: false } } },
    }),
  );
  await page.goto("/staff/queues");
  await page.getByRole("button", { name: "Close queue" }).click();
  await expect(
    page.getByText("The queue change could not be verified.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Close queue" })).toBeVisible();
});
test("raw floor metres and room types render without inventing room outlines", async ({
  page,
}) => {
  await operationsSession(page);
  await page.goto("/student/campus/map");
  await page.getByRole("button", { name: "Indoor", exact: true }).click();
  const plan = page.getByRole("img", {
    name: "Learning centre Ground floor floor plan",
  });
  await expect(plan).toHaveAttribute("viewBox", "0 0 40 30");
  expect(await plan.evaluate((svg) => svg.outerHTML.includes("NaN"))).toBe(
    false,
  );
  await page.getByRole("button", { name: /A101 · Learning commons/ }).click();
  await expect(
    page.getByText("study · 40 capacity", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Dots mark positions", { exact: false }),
  ).toBeVisible();
});
for (const screen of cases)
  test(`${screen.slug} distinguishes an empty success from a failed read`, async ({
    page,
  }) => {
    const fixture = await operationsSession(page, screen.role);
    if (screen.slug === "map")
      await page.route("**/api/v1/campus/buildings", (r) =>
        r.fulfill({ json: { success: true, data: { buildings: [] } } }),
      );
    if (screen.slug === "staff-queues")
      await page.route("**/api/v1/staff/queues", (r) =>
        r.fulfill({ json: { success: true, data: { queues: [] } } }),
      );
    if (screen.slug === "staff-queue") fixture.tickets.splice(0);
    if (screen.slug === "dashboard")
      await page.route("**/api/v1/student/dashboard", async (r) => {
        await r.fulfill({
          json: {
            success: true,
            data: {
              user: { name: "Amina" },
              today: { date: "2026-09-15", remaining: 0, entries: [] },
              next_class: null,
              queue_ticket: null,
              office_ticket: null,
              quick_actions: [],
              building_alerts: [],
              announcements: [],
              events: [],
              notifications: [],
              unread_notifications: 0,
            },
          },
        });
      });
    await page.goto(screen.path);
    await expect(
      page.getByRole("heading", {
        name: {
          map: "No campus buildings published",
          "staff-queues": "No queues assigned to you",
          "staff-queue": "Nobody is in the line",
          dashboard: "No classes scheduled today",
        }[screen.slug],
        exact: true,
      }),
    ).toBeVisible();
  });
test("an outstanding saved-position read stays loading rather than implying absence", async ({
  page,
}) => {
  await operationsSession(page);
  let release = () => {};
  const gate = new Promise<void>((r) => {
    release = r;
  });
  await page.route("**/api/v1/student/positioning/current", async (r) => {
    await gate;
    await r.fallback();
  });
  await page.goto("/student/campus/map");
  await expect(
    page.getByText("Loading saved position…", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No saved position.", { exact: false }),
  ).toHaveCount(0);
  release();
  await expect(
    page.getByText("No saved position.", { exact: false }),
  ).toBeVisible();
});
test("narrow queue controls and room identifiers remain legible instead of compressing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await operationsSession(page, "staff");
  await page.goto("/staff/queues");
  const state = page.getByRole("combobox", { name: "Queue state" });
  await expect(state).toBeVisible();
  expect((await state.boundingBox())!.width).toBeGreaterThan(180);
  const code = page.getByText("A101", { exact: true });
  expect(await code.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe(
    "nowrap",
  );
  await expect(
    page
      .getByRole("article", { name: "A101 queue" })
      .getByText("Open", { exact: true }),
  ).toHaveCSS("white-space", "nowrap");
});
test("selecting a narrow-screen ticket brings its action workspace into keyboard focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await operationsSession(page, "staff");
  await page.goto("/staff/queues/q1");
  await page.getByRole("button", { name: /A-022/ }).click();
  const panel = page.getByRole("region", { name: "Selected ticket actions" });
  await expect(panel).toBeFocused();
  await expect(
    panel.getByRole("button", { name: "Admit to room" }),
  ).toBeInViewport();
  await page.getByRole("link", { name: "Back to current line ↓" }).click();
  await expect(
    page.getByRole("heading", { name: "Current line", exact: true }),
  ).toBeInViewport();
});
