import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { coordinationSession } from "./coordination-fixtures";
const output = resolve(__dirname, "../../../.cache/coordination-pass/screens");
const screens = [
  {
    slug: "staff",
    path: "/staff/dashboard",
    role: "staff",
    title: "Service desk",
    ready: "Requests to review",
    api: "/staff/dashboard",
  },
  {
    slug: "content",
    path: "/staff/content",
    role: "staff",
    title: "Events & announcements",
    ready: "Design futures workshop",
    api: "/campus/events*",
  },
  {
    slug: "admin",
    path: "/admin/dashboard",
    role: "admin",
    title: "Administration",
    ready: "Room queue snapshot",
    api: "/admin/dashboard",
  },
  {
    slug: "users",
    path: "/admin/users",
    role: "admin",
    title: "Users & roles",
    ready: "People & account status",
    api: "/admin/users*",
  },
] as const;
for (const width of [320, 768, 1440])
  for (const screen of screens)
    test(`${screen.slug} reflows at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await coordinationSession(page, screen.role);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(screen.path);
      await expect(
        page.getByRole("heading", { name: screen.title, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: screen.ready, exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBe(0);
      mkdirSync(output, { recursive: true });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `${output}/${screen.slug}-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
      expect(errors).toEqual([]);
    });
for (const screen of screens) {
  test(`${screen.slug} keeps rejection separate from empty results`, async ({
    page,
  }) => {
    await coordinationSession(page, screen.role);
    await page.route(`**/api/v1${screen.api}`, (r) =>
      r.fulfill({
        status: 403,
        json: { success: false, message: "Scope denied for this review." },
      }),
    );
    await page.goto(screen.path);
    await expect(
      page.getByText("Scope denied for this review.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /No users match|No events on this page|No queue scopes|No configured queues/,
      }),
    ).toHaveCount(0);
  });
  test(`${screen.slug} has a distinct pending read`, async ({ page }) => {
    await coordinationSession(page, screen.role);
    let release = () => {};
    const gate = new Promise<void>((r) => (release = r));
    await page.route(`**/api/v1${screen.api}`, async (r) => {
      await gate;
      await r.fallback();
    });
    await page.goto(screen.path);
    await expect(
      page.getByLabel("Loading workspace", { exact: true }),
    ).toBeVisible();
    release();
    await expect(
      page.getByRole("heading", { name: screen.ready, exact: true }),
    ).toBeVisible();
  });
}
test("staff requests link to exact consoles, including in-service offices and closed queues", async ({
  page,
}) => {
  await coordinationSession(page);
  await page.goto("/staff/dashboard");
  await expect(
    page.getByRole("link", { name: "Review Q-012" }),
  ).toHaveAttribute("href", "/staff/queues/q1");
  await expect(
    page.getByRole("link", { name: "Review SA-009" }),
  ).toHaveAttribute("href", "/staff/offices/o1");
  await expect(
    page.getByText("Enabled offices", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Offices open", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: "CS204 · Interaction design",
      exact: true,
    }),
  ).toBeVisible();
});
test("admin shows raw audit subject and does not turn unavailable metrics into charts", async ({
  page,
}) => {
  await coordinationSession(page, "admin");
  await page.goto("/admin/dashboard");
  await expect(page.getByText("User ·", { exact: false })).toBeVisible();
  await expect(
    page.getByText("No queue activity recorded yet.", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Building status register" }),
  ).toBeVisible();
});
for (const slug of ["staff", "admin", "content", "users"] as const)
  test(`${slug} has an honest empty state`, async ({ page }) => {
    const f = await coordinationSession(
      page,
      slug === "admin" || slug === "users" ? "admin" : "staff",
    );
    if (slug === "staff") {
      Object.assign(f.dashboard, {
        queues: [],
        offices: [],
        pending_queue_actions: [],
        pending_office_actions: [],
        teaching_today: [],
      });
    }
    if (slug === "admin")
      Object.assign(f.admin, {
        live_queues: [],
        buildings: [],
        recent_audit: [],
      });
    if (slug === "content")
      await page.route("**/api/v1/campus/events*", (r) =>
        r.fulfill({
          json: {
            success: true,
            data: {
              items: [],
              meta: { page: 1, total: 0, total_pages: 1, per_page: 12 },
            },
          },
        }),
      );
    if (slug === "users")
      await page.route("**/api/v1/admin/users*", (r) =>
        r.fulfill({
          json: {
            success: true,
            data: {
              items: [],
              meta: { current_page: 1, total: 0, last_page: 1, per_page: 25 },
            },
          },
        }),
      );
    await page.goto(screens.find((s) => s.slug === slug)!.path);
    await expect(
      page.getByRole("heading", {
        name:
          slug === "staff"
            ? "No requests awaiting review"
            : slug === "admin"
              ? "No configured queues"
              : slug === "content"
                ? "No events on this page"
                : "No users match",
      }),
    ).toBeVisible();
  });
test("event publishes actual fields and preserves capacity", async ({
  page,
}) => {
  const f = await coordinationSession(page);
  await page.goto("/staff/content");
  await page.getByRole("button", { name: "New event", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Portfolio review");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Bring one project.");
  await page.getByLabel("Start time", { exact: true }).fill("2026-10-01T10:00");
  await page.getByLabel("End time (optional)").fill("2026-10-01T11:00");
  await page.getByLabel("Venue", { exact: true }).fill("Studio B204");
  await page.getByLabel("Capacity (optional)").fill("18");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(
    page.getByText("Publication confirmed.", { exact: false }),
  ).toBeVisible();
  expect(f.writes[0].body).toMatchObject({
    title: "Portfolio review",
    capacity: 18,
    description: "Bring one project.",
    venue: "Studio B204",
  });
  expect(Object.keys(f.writes[0].body)).not.toContain("registration_required");
  expect(String(f.writes[0].body.starts_at)).toMatch(/Z$/);
});
test("event edit sends a real PATCH and immutable ownership is not client input", async ({
  page,
}) => {
  const f = await coordinationSession(page);
  await page.goto("/staff/content");
  await page
    .getByRole("button", { name: "Edit Design futures workshop" })
    .click();
  await page.getByLabel("Title", { exact: true }).fill("Design futures lab");
  await page.getByRole("button", { name: "Save event changes" }).click();
  await expect(
    page.getByRole("heading", { name: "Design futures lab", exact: true }),
  ).toBeVisible();
  expect(f.writes[0].method).toBe("PATCH");
  expect(f.writes[0].path).toBe("/staff/events/e1");
  expect(f.writes[0].body).not.toHaveProperty("created_by");
});
test("notice sends server audience rather than ignored pin/building fields", async ({
  page,
}) => {
  const f = await coordinationSession(page);
  await page.goto("/staff/content");
  await page
    .getByRole("button", { name: "Announcements", exact: true })
    .click();
  await page.getByRole("button", { name: "New announcement" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Staff planning");
  await page
    .getByLabel("Message", { exact: true })
    .fill("Please review the schedule.");
  await page
    .getByRole("combobox", { name: "Audience", exact: true })
    .selectOption("staff");
  await page
    .getByRole("combobox", { name: "Priority", exact: true })
    .selectOption("high");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Staff planning", exact: true }),
  ).toBeVisible();
  expect(f.writes[0].body).toEqual({
    title: "Staff planning",
    body: "Please review the schedule.",
    priority: "high",
    target_roles: ["staff"],
  });
});
test("invalid event times do not write; rejected changes preserve the composer", async ({
  page,
}) => {
  const f = await coordinationSession(page);
  await page.goto("/staff/content");
  await page
    .getByRole("button", { name: "Edit Design futures workshop" })
    .click();
  await page.getByLabel("End time (optional)").fill("2026-09-17T09:00");
  await page.getByRole("button", { name: "Save event changes" }).click();
  await expect(
    page.getByText("Choose a valid start and an end later than the start."),
  ).toBeVisible();
  expect(f.writes).toHaveLength(0);
  await page.getByLabel("End time (optional)").fill("2026-09-18T13:00");
  await page.route("**/api/v1/staff/events/e1", (r) =>
    r.fulfill({
      status: 422,
      json: { success: false, message: "Publication rejected." },
    }),
  );
  await page.getByRole("button", { name: "Save event changes" }).click();
  await expect(
    page.getByText("Publication rejected.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("End time (optional)")).toHaveValue(
    "2026-09-18T13:00",
  );
});
test("event removal is deliberate and view-only authors have no edit action", async ({
  page,
}) => {
  const f = await coordinationSession(page);
  await page.goto("/staff/content");
  await expect(
    page.getByRole("button", { name: "Edit Research conversations" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Remove Design futures workshop" })
    .click();
  expect(f.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Confirm removal" }).click();
  await expect(
    page.getByRole("heading", { name: "Design futures workshop", exact: true }),
  ).toHaveCount(0);
  expect(f.writes[0].path).toBe("/staff/events/e1");
});
test("events follow actual server pages", async ({ page }) => {
  await coordinationSession(page);
  await page.goto("/staff/content");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Campus welcome walk", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Page 2 of 2", { exact: false })).toBeVisible();
});
test("user creation maps role and reveals generated password outside toasts", async ({
  page,
}) => {
  const f = await coordinationSession(page, "admin");
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "New user", exact: true }).click();
  const d = page.getByRole("dialog", { name: "Create a user" });
  await d.getByLabel("Full name", { exact: true }).fill("Zara Okafor");
  await d.getByLabel("Email", { exact: true }).fill("zara@example.test");
  await d
    .getByRole("combobox", { name: "Role", exact: true })
    .selectOption("staff");
  await d.getByRole("button", { name: "Create user", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Temporary password" }),
  ).toContainText("test-only-temporary-pass");
  expect(f.writes[0].body.role).toBe("staff");
  expect(f.writes[0].body).not.toHaveProperty("role_code");
  expect(
    await page.evaluate(() => Object.values(localStorage).join(" ")),
  ).not.toContain("test-only-temporary-pass");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByText("test-only-temporary-pass")).toHaveCount(0);
});
test("profile and role changes are separate, verified writes", async ({
  page,
}) => {
  const f = await coordinationSession(page, "admin");
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Review Alex Rivera" }).click();
  await page.getByLabel("Department", { exact: true }).fill("Design research");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(
    page.getByText("Profile changes confirmed.", { exact: true }),
  ).toBeVisible();
  expect(f.writes[0].body).toEqual({
    status: "active",
    department: "Design research",
  });
  await page.getByLabel("Account role").selectOption("admin");
  await page.getByRole("button", { name: "Review role change" }).click();
  expect(f.writes).toHaveLength(1);
  await page.getByRole("button", { name: "Confirm change" }).click();
  await expect(
    page.getByText("Role change confirmed.", { exact: true }),
  ).toBeVisible();
  expect(f.writes[1]).toMatchObject({
    path: "/admin/users/u1/role",
    body: { role: "admin" },
  });
});
test("role conflict stays in the review and cannot claim success", async ({
  page,
}) => {
  await coordinationSession(page, "admin");
  await page.route("**/api/v1/admin/users/u1/role", (r) =>
    r.fulfill({
      status: 409,
      json: { success: false, message: "Role change refused." },
    }),
  );
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Review Alex Rivera" }).click();
  await page.getByLabel("Account role").selectOption("admin");
  await page.getByRole("button", { name: "Review role change" }).click();
  await page.getByRole("button", { name: "Confirm change" }).click();
  await expect(page.getByRole("dialog")).toContainText("Role change refused.");
  await expect(
    page.getByText("Role change confirmed.", { exact: true }),
  ).toHaveCount(0);
});
test("password reset is reviewed and password is cleared on dismissal", async ({
  page,
}) => {
  const f = await coordinationSession(page, "admin");
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Review Alex Rivera" }).click();
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  expect(f.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Confirm change" }).click();
  await expect(
    page.getByRole("dialog", { name: "Temporary password" }),
  ).toContainText("test-only-reset-pass");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByText("test-only-reset-pass")).toHaveCount(0);
  expect(f.writes[0].path).toBe("/admin/users/u1/reset-password");
});
test("deactivation uses DELETE only after review and removes the account from the directory", async ({
  page,
}) => {
  const f = await coordinationSession(page, "admin");
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Review Alex Rivera" }).click();
  await page.getByRole("button", { name: "Deactivate", exact: true }).click();
  expect(f.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Confirm change" }).click();
  await expect(
    page.getByRole("button", { name: "Review Alex Rivera" }),
  ).toHaveCount(0);
  expect(f.writes[0]).toMatchObject({
    method: "DELETE",
    path: "/admin/users/u1",
  });
});
test("server role filter resets page and uses role not role_code", async ({
  page,
}) => {
  await coordinationSession(page, "admin");
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("table")).toContainText("Nadia Mensah");
  const req = page.waitForRequest(
    (r) =>
      r.url().includes("/admin/users?") &&
      new URL(r.url()).searchParams.get("role") === "staff",
  );
  await page.getByLabel("Filter by role").selectOption("staff");
  const url = new URL((await req).url());
  expect(url.searchParams.get("page")).toBe("1");
  expect(url.searchParams.has("role_code")).toBe(false);
  await expect(page.getByRole("table")).toContainText("Alex Rivera");
});
test("assignments select off-page staff and actual scope ids", async ({
  page,
}) => {
  const f = await coordinationSession(page, "admin");
  await page.goto("/admin/users");
  await page.getByLabel("Filter by role").selectOption("student");
  await page
    .getByRole("button", { name: "Staff assignments", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add assignment", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Staff member", exact: true })
    .selectOption("u9");
  await page
    .getByRole("combobox", { name: "Scope type", exact: true })
    .selectOption("course");
  await page
    .getByRole("combobox", { name: "Scope", exact: true })
    .selectOption("c1");
  await page
    .getByRole("dialog")
    .getByLabel("Timetable", { exact: true })
    .check();
  await page.getByRole("button", { name: "Save assignment" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Staff outside this user page",
      exact: true,
    }),
  ).toBeVisible();
  expect(f.writes[0].body).toMatchObject({
    user_id: "u9",
    scope_type: "course",
    scope_id: "c1",
    can_manage_timetable: true,
  });
});
test("assignment removal waits for review", async ({ page }) => {
  const f = await coordinationSession(page, "admin");
  await page.goto("/admin/users");
  await page
    .getByRole("button", { name: "Staff assignments", exact: true })
    .click();
  await page.getByRole("button", { name: "Remove assignment as1" }).click();
  expect(f.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Confirm change" }).click();
  await expect(
    page.getByRole("heading", { name: "No staff assignments" }),
  ).toBeVisible();
});
test("malformed users pagination is an error, not a fictional first page", async ({
  page,
}) => {
  await coordinationSession(page, "admin");
  await page.route("**/api/v1/admin/users*", (r) =>
    r.fulfill({ json: { success: true, data: { items: [], meta: {} } } }),
  );
  await page.goto("/admin/users");
  await expect(
    page.getByText("The workspace returned an incomplete response.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No users match" }),
  ).toHaveCount(0);
});
for (const width of [320, 768, 1440])
  test(`publication editor and account access workspaces focus and fit at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await coordinationSession(page);
    await page.goto("/staff/content");
    await page.getByRole("button", { name: "New event", exact: true }).click();
    await expect(
      page.getByRole("complementary", { name: "Publication workspace" }),
    ).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBe(0);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: `${output}/composer-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Discard draft" }).click();
    await page
      .getByRole("button", { name: "Announcements", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Staff briefing on Thursday" }),
    ).toBeVisible();
    await page.screenshot({
      path: `${output}/notices-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await coordinationSession(page, "admin");
    await page.goto("/admin/users");
    await page.getByRole("button", { name: "Review Alex Rivera" }).click();
    await expect(
      page.getByRole("complementary", { name: "Account access workspace" }),
    ).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBe(0);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: `${output}/access-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
  });
test("pending role confirmation is locked against duplicate clicks", async ({
  page,
}) => {
  const f = await coordinationSession(page, "admin");
  let release = () => {};
  const gate = new Promise<void>((r) => (release = r));
  await page.route("**/api/v1/admin/users/u1/role", async (r) => {
    await gate;
    await r.fallback();
  });
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Review Alex Rivera" }).click();
  await page.getByLabel("Account role").selectOption("admin");
  await page.getByRole("button", { name: "Review role change" }).click();
  const button = page.getByRole("button", { name: "Confirm change" });
  await button.evaluate((b) => {
    (b as HTMLButtonElement).click();
    (b as HTMLButtonElement).click();
  });
  await expect(button).toBeDisabled();
  release();
  await expect(
    page.getByText("Role change confirmed.", { exact: true }),
  ).toBeVisible();
  expect(f.writes.filter((w) => w.path.endsWith("/role"))).toHaveLength(1);
});
test("a mismatched account response does not confirm profile saving", async ({
  page,
}) => {
  await coordinationSession(page, "admin");
  await page.route("**/api/v1/admin/users/u1", (r) =>
    r.fulfill({
      json: {
        success: true,
        data: {
          user: {
            id: "other-user",
            name: "Someone else",
            email: "else@example.test",
            role: "staff",
            status: "active",
            department: "Design research",
          },
        },
      },
    }),
  );
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Review Alex Rivera" }).click();
  await page.getByLabel("Department", { exact: true }).fill("Design research");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(
    page.getByText("The account change could not be confirmed.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Profile changes confirmed.", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Department", { exact: true })).toHaveValue(
    "Design research",
  );
});
