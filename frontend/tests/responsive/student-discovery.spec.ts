import { test, expect } from "@playwright/test";
import { discoverySession } from "./student-discovery-fixtures";

const screens = [
  {
    name: "rooms",
    path: "/student/campus/rooms",
    ready: "Interaction design studio",
    empty: "No rooms match those filters",
  },
  {
    name: "room-detail",
    path: "/student/campus/rooms/B204",
    ready: "A little space before your next class.",
    empty: null,
  },
  {
    name: "events",
    path: "/student/campus/events",
    ready: "Ideas that shape tomorrow",
    empty: "No events match this view",
  },
  {
    name: "announcements",
    path: "/student/announcements",
    ready: "A new chapter for the learning centre",
    empty: "No notices in this view",
  },
];

test.describe("Individual student discovery redesign", () => {
  for (const width of [320, 768, 1440])
    for (const screen of screens) {
      test(`${screen.name} at ${width}`, async ({ page }, testInfo) => {
        await page.setViewportSize({
          width,
          height: width === 1440 ? 1000 : 900,
        });
        await discoverySession(page);
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
        expect(await page.locator("main h1").count()).toBe(1);
        await page.evaluate(() => document.fonts.ready);
        if (width !== 768)
          await page.screenshot({
            path: testInfo.outputPath(`${screen.name}-${width}.png`),
            fullPage: true,
          });
        expect(errors).toEqual([]);
      });
    }
  for (const screen of screens) {
    test(`${screen.name} handles failure without claiming empty success`, async ({
      page,
    }) => {
      await discoverySession(page, "error");
      await page.goto(screen.path);
      await expect(
        page.getByText(
          "The discovery service is unavailable. Try again shortly.",
        ),
      ).toBeVisible();
      await expect(page.getByText(screen.ready, { exact: true })).toBeHidden();
      if (screen.empty)
        await expect(
          page.getByText(screen.empty, { exact: true }),
        ).toBeHidden();
      await page.getByRole("button", { name: /retry|try again/i }).click();
      await expect(
        page.getByText(
          "The discovery service is unavailable. Try again shortly.",
        ),
      ).toBeVisible();
    });
    if (screen.empty)
      test(`${screen.name} handles empty results`, async ({ page }) => {
        await discoverySession(page, "empty");
        await page.goto(screen.path);
        await expect(
          page.getByText(screen.empty!, { exact: true }),
        ).toBeVisible();
        await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
      });
  }
  test("room search, type, admission and Laravel pagination actually work", async ({
    page,
  }) => {
    await discoverySession(page);
    await page.goto("/student/campus/rooms");
    await expect(page.getByText("Page 1 of 2")).toBeVisible();
    await page.getByRole("button", { name: "Next page", exact: true }).click();
    await expect(page.getByText("Page 2 of 2")).toBeVisible();
    const typeRequest = page.waitForRequest(
      (r) =>
        r.url().includes("/campus/rooms?") &&
        new URL(r.url()).searchParams.get("type") === "lab",
    );
    await page
      .getByRole("combobox", { name: "Room type", exact: true })
      .selectOption("lab");
    expect(new URL((await typeRequest).url()).searchParams.get("page")).toBe(
      "1",
    );
    await expect(
      page.getByText("Learning commons", { exact: true }),
    ).toBeHidden();
    await page.getByLabel("Search rooms", { exact: true }).fill("B204");
    await expect(
      page.getByText("Computer laboratory", { exact: true }),
    ).toBeHidden();
    await expect(
      page.getByText("Interaction design studio", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "Admission", exact: true })
      .selectOption("true");
    await expect(
      page.getByText("Interaction design studio", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Minimum seats on this page").fill("100");
    await expect(page.getByText("No rooms match those filters")).toBeVisible();
    await page
      .getByRole("button", { name: "Reset filters", exact: true })
      .click();
    await expect(
      page.getByText("Learning commons", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "List view" }).click();
    await expect(
      page.getByRole("button", { name: "List view" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Show free rooms first")).toBeHidden();
  });
  test("room queue read failure is unknown, not no queue", async ({ page }) => {
    await discoverySession(page);
    await page.route("**/api/v1/student/queues/board", (route) =>
      route.fulfill({
        status: 503,
        json: { success: false, message: "Queue data unavailable" },
      }),
    );
    await page.goto("/student/campus/rooms");
    await expect(page.locator("article").first()).toContainText("Unavailable");
    await expect(page.getByText("No queue listed")).toHaveCount(0);
  });
  test("room detail switches schedule and surfaces queue rejection", async ({
    page,
  }) => {
    await discoverySession(page);
    await page.route("**/api/v1/student/queues/*/tickets", (route) =>
      route.fulfill({
        status: 403,
        json: {
          success: false,
          message: "You must be near this room to join.",
        },
      }),
    );
    await page.goto("/student/campus/rooms/B204");
    await page.getByRole("button", { name: "This week", exact: true }).click();
    await expect(
      page.getByText("Recurring sessions from the master timetable.", {
        exact: false,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Join queue", exact: true }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "You must be near this room to join.",
    );
    await expect(
      page.getByText("You joined the queue. Follow your ticket below."),
    ).toBeHidden();
    await expect(
      page.getByRole("link", { name: "Open in the campus map" }),
    ).toHaveAttribute("href", "/student/campus/map?route=B204");
  });
  test("closed room with session count but no busy blocks does not crash", async ({
    page,
  }) => {
    await discoverySession(page);
    await page.route("**/api/v1/campus/rooms/B204", async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: {
            room: {
              id: "r1",
              code: "B204",
              name: "Closed room",
              type: "lab",
              capacity: 30,
            },
            availability: {
              date: "2026-09-15",
              is_open: false,
              is_available_now: false,
              session_count: 2,
              busy: [],
              free_slots: [],
              headline: "Closed for maintenance",
              occupancy: null,
              queue: null,
            },
            week: [],
            days: {},
          },
        },
      });
    });
    await page.goto("/student/campus/rooms/B204");
    await expect(page.getByText("Closed", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Session details are not available."),
    ).toBeVisible();
    await expect(page.getByText("In use", { exact: true })).toBeHidden();
  });
  test("event category, time and personal registration filters use real loaded data", async ({
    page,
  }) => {
    await discoverySession(page);
    await page.goto("/student/campus/events");
    await expect(
      page.getByText("Ideas that shape tomorrow", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Welcome to the new term", { exact: true }),
    ).toBeHidden();
    await page.getByRole("button", { name: "hackathon", exact: true }).click();
    await expect(
      page.getByText("Ideas that shape tomorrow", { exact: true }),
    ).toBeHidden();
    await expect(
      page.getByText("Build something together", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "All categories", exact: true })
      .click();
    await page
      .getByRole("button", { name: "My registrations", exact: true })
      .click();
    await expect(
      page.getByText("Build something together", { exact: true }),
    ).toBeVisible();
    await expect(page.locator("article")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Past events", exact: true })
      .click();
    await expect(
      page.getByText("Welcome to the new term", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Register", exact: true }),
    ).toHaveCount(0);
  });
  test("registration waits for the API, preserves rejection and accepts confirmed mutations", async ({
    page,
  }) => {
    await discoverySession(page);
    await page.route("**/api/v1/student/events/e1/register", (route) =>
      route.fulfill({
        status: 409,
        json: { success: false, message: "Registration has closed." },
      }),
    );
    await page.goto("/student/campus/events");
    const feature = page
      .locator("article")
      .filter({
        has: page.getByRole("heading", { name: "Ideas that shape tomorrow" }),
      });
    await feature
      .getByRole("button", { name: "Register", exact: true })
      .click();
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "Registration has closed.",
    );
    await expect(feature.getByText("Registered", { exact: true })).toBeHidden();
    await page.unroute("**/api/v1/student/events/e1/register");
    await feature
      .getByRole("button", { name: "Register", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "You are registered" }),
    ).toBeVisible();
    await expect(
      feature.getByRole("button", { name: "Cancel registration" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Refresh events", exact: true })
      .click();
    await expect(
      feature.getByRole("button", { name: "Cancel registration" }),
    ).toBeVisible();
    await feature.getByRole("button", { name: "Cancel registration" }).click();
    await expect(
      feature.getByRole("button", { name: "Register", exact: true }),
    ).toBeVisible();
  });
  test("notices separate pins and support keyboard disclosure, priority and full-text search", async ({
    page,
  }) => {
    await discoverySession(page);
    await page.goto("/student/announcements");
    await expect(
      page.getByRole("region", { name: "Pinned notices" }),
    ).toContainText("A new chapter for the learning centre");
    const disclosure = page.getByText("Read full notice", { exact: false });
    await disclosure.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("details[open]")).toContainText(
      "Full access details",
    );
    await page.getByRole("button", { name: "Urgent", exact: true }).click();
    await expect(
      page.getByText("Water maintenance at Science & design", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("A new chapter for the learning centre", { exact: true }),
    ).toBeHidden();
    await page
      .getByRole("button", { name: "All notices", exact: true })
      .click();
    await page
      .getByLabel("Search announcements on this page")
      .fill("recycling");
    await expect(
      page.getByText("Small steps, a greener campus", { exact: true }),
    ).toBeVisible();
    await expect(page.locator("article")).toHaveCount(1);
  });
  test("notices remain plain text, never injected markup", async ({ page }) => {
    await discoverySession(page);
    await page.route("**/api/v1/campus/announcements?*", (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            items: [
              {
                id: "unsafe",
                title: "Safety notice",
                body: '<img src=x onerror="window.injected=true">',
                priority: "normal",
              },
            ],
            meta: { page: 1, total_pages: 1, total: 1, per_page: 30 },
          },
        },
      }),
    );
    await page.goto("/student/announcements");
    await expect(
      page.getByText('<img src=x onerror="window.injected=true">', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator("article img")).toHaveCount(0);
  });
});
