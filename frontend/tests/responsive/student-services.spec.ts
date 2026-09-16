import { test, expect } from "@playwright/test";
import {
  servicesSession,
  serviceSummary,
  serviceView,
  serviceTicket,
} from "./student-services-fixtures";

const pages = [
  {
    name: "timetable",
    path: "/student/timetable",
    ready: "Interaction design",
  },
  {
    name: "offices",
    path: "/student/services/offices",
    ready: "Dean’s office",
  },
  {
    name: "office-detail",
    path: "/student/services/offices/SA?request=1",
    ready: "Tell the desk what you need",
  },
  {
    name: "office-ticket",
    path: "/student/services/offices/tickets/t1",
    ready: "SA-017",
  },
];
test.describe("Individual student service pages", () => {
  for (const width of [320, 768, 1440])
    for (const screen of pages)
      test(`${screen.name} at ${width}`, async ({ page }, testInfo) => {
        await page.setViewportSize({
          width,
          height: width === 1440 ? 1000 : 900,
        });
        await servicesSession(page);
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto(screen.path);
        await expect(
          page.getByText(screen.ready, { exact: true }).first(),
        ).toBeVisible();
        await expect
          .poll(() =>
            page.evaluate(
              () => document.documentElement.scrollWidth - innerWidth,
            ),
          )
          .toBeLessThanOrEqual(1);
        await expect(page.locator("main h1")).toHaveCount(1);
        await page.evaluate(() => document.fonts.ready);
        if (width !== 768)
          await page.screenshot({
            path: testInfo.outputPath(`${screen.name}-${width}.png`),
            fullPage: true,
          });
        expect(errors).toEqual([]);
      });
  for (const screen of pages)
    test(`${screen.name} does not present a failed read as success`, async ({
      page,
    }) => {
      await servicesSession(page, "error");
      await page.goto(screen.path);
      await expect(
        page
          .locator("main")
          .getByText("The campus service is temporarily unavailable.")
          .first(),
      ).toBeVisible();
      await expect(page.getByText(screen.ready, { exact: true })).toBeHidden();
    });
  test("office directory filters real offices and reads flat ticket history", async ({
    page,
  }) => {
    await servicesSession(page);
    await page.goto("/student/services/offices");
    await expect(
      page.getByRole("complementary", { name: "Your office visits" }),
    ).toContainText("SA-017");
    await expect(
      page.getByText("Student record update", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Open now", exact: true }).click();
    await expect(page.getByText("Dean’s office", { exact: true })).toBeHidden();
    await page.getByLabel("Search offices").fill("transcripts");
    await expect(page.locator("article")).toHaveCount(1);
    await expect(page.locator("article")).toContainText("Registrar");
    await expect(
      page.locator("article").getByRole("link", { name: "Request a ticket" }),
    ).toHaveCount(0);
    await page.getByLabel("Search offices").fill("no matching office");
    await expect(page.getByText("No offices match this view")).toBeVisible();
  });
  test("office history failure leaves browsing usable without a false empty history", async ({
    page,
  }) => {
    await servicesSession(page);
    await page.route("**/api/v1/student/office-tickets", (r) =>
      r.fulfill({
        status: 503,
        json: { success: false, message: "Visit history is unavailable." },
      }),
    );
    await page.goto("/student/services/offices");
    await expect(page.getByText("Visit history is unavailable.")).toBeVisible();
    await expect(
      page.getByText("Dean’s office", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("No office tickets yet.", { exact: false }),
    ).toBeHidden();
  });
  test("empty offices and visits have independent truthful messages", async ({
    page,
  }) => {
    await servicesSession(page, "empty");
    await page.goto("/student/services/offices");
    await expect(page.getByText("No offices match this view")).toBeVisible();
    await expect(
      page.getByText("No office tickets yet.", { exact: false }),
    ).toBeVisible();
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  });
  test("request failure preserves text and successful confirmation opens the returned ticket", async ({
    page,
  }) => {
    await servicesSession(page);
    await page.route("**/api/v1/student/offices/o1/tickets", (r) =>
      r.fulfill({
        status: 422,
        json: { success: false, message: "The desk cannot issue this ticket." },
      }),
    );
    await page.goto("/student/services/offices/SA?request=1");
    await page
      .getByLabel("Reason for your visit", { exact: true })
      .fill("Enrolment correction");
    await page
      .getByLabel("Additional context (optional)", { exact: true })
      .fill("Please check my new courses.");
    await page
      .getByRole("button", { name: "Confirm request", exact: true })
      .click();
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "The desk cannot issue this ticket.",
    );
    await expect(
      page.getByLabel("Reason for your visit", { exact: true }),
    ).toHaveValue("Enrolment correction");
    await expect(page).toHaveURL(/offices\/SA\?request=1/);
    await page.unroute("**/api/v1/student/offices/o1/tickets");
    await page
      .getByRole("button", { name: "Confirm request", exact: true })
      .click();
    await expect(page).toHaveURL(/tickets\/new-ticket/);
    await expect(
      page.getByText("SA-018", { exact: true }).first(),
    ).toBeVisible();
  });
  test("an ambiguous request retry keeps the same idempotency key", async ({
    page,
  }) => {
    await servicesSession(page);
    const keys: string[] = [];
    await page.route("**/api/v1/student/offices/o1/tickets", (r) => {
      keys.push(r.request().headers()["idempotency-key"]);
      return r.fulfill({
        status: 503,
        json: { success: false, message: "The response was interrupted." },
      });
    });
    await page.goto("/student/services/offices/SA?request=1");
    await page
      .getByLabel("Reason for your visit", { exact: true })
      .fill("Enrolment correction");
    for (let i = 0; i < 2; i++) {
      await page
        .getByRole("button", { name: "Confirm request", exact: true })
        .click();
      await expect(page.locator("main").getByRole("alert")).toContainText(
        "The response was interrupted.",
      );
    }
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
  });
  test("an unrelated global active ticket cannot replace the selected office request", async ({
    page,
  }) => {
    await servicesSession(page);
    let activeReads = 0;
    page.on("request", (r) => {
      if (r.url().endsWith("/office-tickets/active")) activeReads++;
    });
    await page.goto("/student/services/offices/SA?request=1");
    await expect(
      page.getByLabel("Reason for your visit", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("WRONG-001")).toBeHidden();
    expect(activeReads).toBe(0);
    await page.route("**/api/v1/student/offices/SA", (r) =>
      r.fulfill({
        json: {
          success: true,
          data: { ...serviceSummary, my_ticket: serviceTicket },
        },
      }),
    );
    await page
      .getByRole("button", { name: "Refresh office", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "Open your ticket" }),
    ).toHaveAttribute("href", "/student/services/offices/tickets/t1");
    await expect(
      page.getByLabel("Reason for your visit", { exact: true }),
    ).toBeHidden();
  });
  test("appointment offices show requirements instead of a non-functional booking flow", async ({
    page,
  }) => {
    await servicesSession(page);
    await page.route("**/api/v1/student/offices/SA", (r) =>
      r.fulfill({
        json: {
          success: true,
          data: {
            ...serviceSummary,
            office: { ...serviceSummary.office, requires_appointment: true },
          },
        },
      }),
    );
    await page.goto("/student/services/offices/SA?request=1");
    await expect(
      page.getByText("This office serves by appointment.", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Confirm request" }),
    ).toBeHidden();
    await expect(
      page.getByRole("link", { name: "affairs@example.test" }),
    ).toHaveAttribute("href", "mailto:affairs%40example.test");
    await expect(page.getByText("Sunday", { exact: true })).toBeVisible();
    await expect(page.getByText("Tuesday", { exact: true })).toBeVisible();
  });
  test("denied browser location never invents a position or successful ticket", async ({
    page,
  }) => {
    await servicesSession(page);
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "geolocation", {
        value: {
          getCurrentPosition: (_ok: unknown, fail: (e: unknown) => void) =>
            fail({ code: 1 }),
        },
        configurable: true,
      }),
    );
    await page.route("**/api/v1/student/offices/SA", (r) =>
      r.fulfill({
        json: {
          success: true,
          data: {
            ...serviceSummary,
            office: {
              ...serviceSummary.office,
              requires_proximity_to_request: true,
            },
          },
        },
      }),
    );
    let body: Record<string, unknown> = {};
    await page.route("**/api/v1/student/offices/o1/tickets", (r) => {
      body = r.request().postDataJSON();
      return r.fulfill({
        status: 403,
        json: { success: false, message: "Location verification is required." },
      });
    });
    await page.goto("/student/services/offices/SA?request=1");
    await page
      .getByLabel("Reason for your visit", { exact: true })
      .fill("Enrolment correction");
    await page
      .getByRole("button", { name: "Confirm request", exact: true })
      .click();
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "Location verification is required.",
    );
    expect(body.fix).toBeUndefined();
    await expect(page).toHaveURL(/offices\/SA/);
  });
  test("ticket capabilities—not status guesses—control arrival buttons", async ({
    page,
  }) => {
    await servicesSession(page);
    await page.route("**/api/v1/student/office-tickets/t1", (r) =>
      r.fulfill({
        json: {
          success: true,
          data: {
            ...serviceView,
            ticket: { ...serviceTicket, status: "CALLED" },
            status_label: "Called",
            check_in_deadline: "2026-09-15T10:05:00Z",
          },
        },
      }),
    );
    await page.goto("/student/services/offices/tickets/t1");
    await expect(
      page.getByText("The office has called your number."),
    ).toBeVisible();
    await expect(
      page.getByText("Check-in deadline:", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "I am on my way", exact: true }),
    ).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Check in at the office" }),
    ).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Cancel ticket", exact: true }),
    ).toBeVisible();
  });
  test("cancellation is deliberate, rejected changes are not applied, confirmed tickets become receipts", async ({
    page,
  }) => {
    await servicesSession(page);
    await page.route("**/api/v1/student/office-tickets/t1/cancel", (r) =>
      r.fulfill({
        status: 409,
        json: {
          success: false,
          message: "The office could not cancel this ticket.",
        },
      }),
    );
    await page.goto("/student/services/offices/tickets/t1");
    await page
      .getByRole("button", { name: "Cancel ticket", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Cancel this ticket" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Keep my ticket", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Cancel this ticket" }),
    ).toBeHidden();
    await page
      .getByRole("button", { name: "Cancel ticket", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm cancellation", exact: true })
      .click();
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "The office could not cancel this ticket.",
    );
    await expect(
      page.getByRole("heading", { name: "Your office ticket" }),
    ).toBeVisible();
    await page.unroute("**/api/v1/student/office-tickets/t1/cancel");
    await page
      .getByRole("button", { name: "Confirm cancellation", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your visit record" }),
    ).toBeVisible();
    await expect(page.getByText("People ahead", { exact: true })).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Cancel ticket", exact: true }),
    ).toBeHidden();
    await page
      .getByRole("button", { name: "Refresh ticket", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your visit record" }),
    ).toBeVisible();
  });
  test("ticket history failure can retry without replacing confirmed ticket state", async ({
    page,
  }) => {
    await servicesSession(page);
    await page.route("**/api/v1/student/office-tickets/t1/history", (r) =>
      r.fulfill({
        status: 503,
        json: { success: false, message: "Timeline unavailable." },
      }),
    );
    await page.goto("/student/services/offices/tickets/t1");
    await expect(page.getByText("Timeline unavailable.")).toBeVisible();
    await expect(
      page.getByText("SA-017", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("No events have been recorded yet."),
    ).toBeHidden();
    await page.unroute("**/api/v1/student/office-tickets/t1/history");
    await page
      .getByRole("region", { name: "Ticket timeline" })
      .getByRole("button", { name: /retry|try again/i })
      .click();
    await expect(
      page.getByText("Ticket requested", { exact: true }),
    ).toBeVisible();
  });
  test("the timetable includes early, late, weekend and overlapping sessions without hiding details", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await servicesSession(page);
    await page.goto("/student/timetable");
    const board = page.getByRole("region", {
      name: "Weekly timetable, scroll horizontally for more days",
    });
    await expect(
      board.getByRole("heading", { name: "MAT140", exact: true }),
    ).toBeVisible();
    await expect(
      board.getByRole("heading", { name: "CS299", exact: true }),
    ).toBeVisible();
    await expect(
      board.getByRole("heading", { name: "CS204", exact: true }),
    ).toBeVisible();
    await expect(
      board.getByRole("heading", { name: "CS220", exact: true }),
    ).toBeVisible();
    const unknown = board
      .locator("article")
      .filter({ hasText: "Networks workshop" });
    await expect(unknown).toContainText("Room to be announced");
    await expect(unknown.getByRole("link")).toHaveCount(0);
    const detail = board.getByText("Session details for CS204 on 2026-09-15", {
      exact: true,
    });
    await detail.focus();
    await page.keyboard.press("Enter");
    await expect(board.locator("details[open]")).toContainText("Dr. Adebayo");
    await page.getByRole("button", { name: "Next week", exact: true }).click();
    await expect(page.getByText("No sessions this week")).toBeVisible();
    await expect(board).toBeHidden();
    await page.getByRole("button", { name: "This week", exact: true }).click();
    await expect(
      board.getByRole("heading", { name: "CS204", exact: true }),
    ).toBeVisible();
  });
});

test("closed status is advisory while the backend-defined capacity rule is respected", async ({
  page,
}) => {
  await servicesSession(page);
  await page.route("**/api/v1/student/offices/SA", (r) =>
    r.fulfill({
      json: { success: true, data: { ...serviceSummary, is_open_now: false } },
    }),
  );
  await page.goto("/student/services/offices/SA?request=1");
  await expect(
    page.getByText("This office is closed right now.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm request" }),
  ).toBeVisible();
  await page.unroute("**/api/v1/student/offices/SA");
  await page.route("**/api/v1/student/offices/SA", (r) =>
    r.fulfill({
      json: {
        success: true,
        data: {
          ...serviceSummary,
          daily_capacity: 18,
          daily_capacity_used: 18,
        },
      },
    }),
  );
  await page
    .getByRole("button", { name: "Refresh office", exact: true })
    .click();
  await expect(
    page.getByText("Today’s ticket capacity has been reached.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm request" }),
  ).toBeHidden();
});

test("a replayed request with a raw ticket opens the canonical ticket page", async ({
  page,
}) => {
  await servicesSession(page);
  await page.route("**/api/v1/student/offices/o1/tickets", (r) =>
    r.fulfill({
      json: { success: true, data: { ticket: serviceTicket, replayed: true } },
    }),
  );
  await page.goto("/student/services/offices/SA?request=1");
  await page
    .getByLabel("Reason for your visit", { exact: true })
    .fill("Enrolment correction");
  await page
    .getByRole("button", { name: "Confirm request", exact: true })
    .click();
  await expect(page).toHaveURL(/tickets\/t1/);
  await expect(page.getByText("SA-017", { exact: true }).first()).toBeVisible();
});

test("allowed check-in waits for server confirmation and disables concurrent actions", async ({
  page,
}) => {
  await servicesSession(page);
  await page.route("**/api/v1/student/office-tickets/t1", (r) =>
    r.fulfill({
      json: { success: true, data: { ...serviceView, can_check_in: true } },
    }),
  );
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    "**/api/v1/student/office-tickets/t1/check-in",
    async (r) => {
      await gate;
      await r.fulfill({
        json: {
          success: true,
          data: {
            ...serviceView,
            ticket: { ...serviceTicket, status: "in_service" },
            status_label: "In service",
            can_check_in: false,
          },
        },
      });
    },
  );
  await page.goto("/student/services/offices/tickets/t1");
  await page
    .getByRole("button", { name: "Check in at the office", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Cancel ticket", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Refresh ticket", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: "Your visit is in progress." }),
  ).toBeHidden();
  release();
  await expect(
    page.getByRole("heading", { name: "Your visit is in progress." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Check in at the office", exact: true }),
  ).toBeHidden();
});

test.describe("Local calendar dates", () => {
  test.use({ timezoneId: "Africa/Douala" });
  test("week selection does not shift to Sunday near local midnight", async ({
    page,
  }) => {
    await servicesSession(page);
    await page.clock.setFixedTime(new Date("2026-09-14T23:30:00Z"));
    const request = page.waitForRequest((r) =>
      r.url().includes("/student/timetable?"),
    );
    await page.goto("/student/timetable");
    expect(new URL((await request).url()).searchParams.get("week")).toBe(
      "2026-09-14",
    );
    await expect(
      page.getByText("Interaction design", { exact: true }).first(),
    ).toBeVisible();
  });
});
