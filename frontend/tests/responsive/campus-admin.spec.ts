import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { campusAdminSession, uuid } from "./campus-admin-fixtures";
async function goFloors(page: Page) {
  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { name: "Learning centre", exact: true }),
    })
    .getByRole("button", { name: "Open floors" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ground learning floor", exact: true }),
  ).toBeVisible();
}
async function goRooms(page: Page) {
  await goFloors(page);
  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        name: "Ground learning floor",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Open rooms" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Interaction design studio",
      exact: true,
    }),
  ).toBeVisible();
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
}
async function capture(page: Page, name: string, width: number) {
  mkdirSync("../.cache/campus-admin-pass/screens", { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  if ((await page.getByRole("dialog").count()) === 0)
    await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `../.cache/campus-admin-pass/screens/${name}-${width}.png`,
    fullPage: true,
    animations: "disabled",
  });
}
for (const width of [320, 768, 1440])
  test(`campus hierarchy and editor reflow at ${width}`, async ({ page }) => {
    test.setTimeout(60000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: width === 320 ? 700 : 1000 });
    const state = await campusAdminSession(page);
    await page.goto("/admin/campus");
    await expect(
      page.getByRole("heading", { name: "Learning centre", exact: true }),
    ).toBeVisible();
    await noOverflow(page);
    await capture(page, "buildings", width);
    await goFloors(page);
    await noOverflow(page);
    await capture(page, "floors", width);
    await page.getByRole("button", { name: "Edit A-G", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Edit floor" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByLabel("Plan width (m)", { exact: true }),
    ).toHaveValue("40");
    await expect(
      dialog.getByText("Parent location is fixed", { exact: false }),
    ).toBeVisible();
    await capture(page, "floor-editor", width);
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
      page.viewportSize()!.height + 1,
    );
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Edit A-G", exact: true }),
    ).toBeFocused();
    await page
      .getByRole("article")
      .filter({
        has: page.getByRole("heading", {
          name: "Ground learning floor",
          exact: true,
        }),
      })
      .getByRole("button", { name: "Open rooms" })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Interaction design studio",
        exact: true,
      }),
    ).toBeVisible();
    await noOverflow(page);
    await capture(page, "rooms", width);
    await page.getByRole("button", { name: "Edit A-001", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Edit room" })).toBeVisible();
    await capture(page, "room-editor", width);
    await noOverflow(page);
    await page.keyboard.press("Tab");
    expect(
      await page
        .getByRole("dialog")
        .evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
    await page.keyboard.press("Escape");
    state.rooms = [];
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'No records on this page' })).toBeVisible();
    await capture(page, 'empty', width);
    await noOverflow(page);
    state.readStatus = 503;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(page.getByText('Campus directory unavailable (503).', { exact: true })).toBeVisible();
    await capture(page, 'error', width);
    await noOverflow(page);
    expect(errors).toEqual([]);
  });

test("buildings save blank coordinates as null and confirm real fields", async ({
  page,
}) => {
  const state = await campusAdminSession(page);
  await page.goto("/admin/campus");
  await page.getByRole("button", { name: "New building", exact: true }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Code", { exact: true }).fill("NEW");
  await d.getByLabel("Name", { exact: true }).fill("New teaching wing");
  await d.getByLabel("Address", { exact: true }).fill("North campus");
  await d.getByRole("button", { name: "Save record" }).click();
  await expect(d).toHaveCount(0);
  expect(state.writes[0].body).toMatchObject({
    code: "NEW",
    name: "New teaching wing",
    address: "North campus",
    lat: null,
    lng: null,
  });
  expect(state.writes[0].body).not.toHaveProperty("campus_name");
});

test("zero coordinates remain zero and only changed fields are patched", async ({
  page,
}) => {
  const state = await campusAdminSession(page);
  state.buildings[0].lat = 0;
  state.buildings[0].lng = 0;
  await page.goto("/admin/campus");
  await page.getByRole("button", { name: "Edit A", exact: true }).click();
  const d = page.getByRole("dialog");
  await expect(d.getByLabel("Latitude", { exact: true })).toHaveValue("0");
  await d.getByLabel("Name", { exact: true }).fill("Learning commons");
  await d.getByRole("button", { name: "Save record" }).click();
  await expect(d).toHaveCount(0);
  expect(state.writes[0].body).toEqual({ name: "Learning commons" });
});

test("floor creation uses required code, selected parent, and metre fields", async ({
  page,
}) => {
  const state = await campusAdminSession(page);
  await page.goto("/admin/campus");
  await goFloors(page);
  await page.getByRole("button", { name: "New floor", exact: true }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Name", { exact: true }).fill("New basement");
  await d.getByRole("button", { name: "Save record" }).click();
  expect(state.writes).toHaveLength(0);
  await d.getByLabel("Code", { exact: true }).fill("A-B2");
  await d.getByLabel("Level", { exact: true }).fill("-2");
  await d.getByLabel("Plan width (m)", { exact: true }).fill("45.5");
  await d.getByRole("button", { name: "Save record" }).click();
  await expect(d).toHaveCount(0);
  expect(state.writes[0].body).toMatchObject({
    building_id: uuid(1),
    code: "A-B2",
    level: -2,
    plan_width_m: 45.5,
    plan_height_m: null,
  });
  expect(state.writes[0].body).not.toHaveProperty("plan_width");
});

test("room creation stores type and area, never unsupported rectangle or building fields", async ({
  page,
}) => {
  const state = await campusAdminSession(page);
  await page.goto("/admin/campus");
  await goRooms(page);
  await page.getByRole("button", { name: "New room", exact: true }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Code", { exact: true }).fill("A-010");
  await d.getByLabel("Name", { exact: true }).fill("Seminar room");
  await d.getByLabel("Room type", { exact: true }).selectOption("seminar");
  await d.getByLabel("Area (m²)", { exact: true }).fill("28.5");
  await d.getByLabel("Plan x (m)", { exact: true }).fill("0");
  await d.getByLabel("Plan y (m)", { exact: true }).fill("12");
  await d.getByRole("button", { name: "Save record" }).click();
  await expect(d).toHaveCount(0);
  expect(state.writes[0].body).toMatchObject({
    floor_id: uuid(102),
    type: "seminar",
    area_m2: 28.5,
    plan_x: 0,
    plan_y: 12,
    lat: null,
    lng: null,
  });
  for (const key of ["building_id", "room_type", "plan_w", "plan_h"])
    expect(state.writes[0].body).not.toHaveProperty(key);
});

test("room policy edit preserves unedited geometry, features and access rules", async ({
  page,
}) => {
  const state = await campusAdminSession(page);
  await page.goto("/admin/campus");
  await goRooms(page);
  await page.getByRole("button", { name: "Edit A-001", exact: true }).click();
  const d = page.getByRole("dialog");
  await expect(d.getByLabel("Plan x (m)", { exact: true })).toHaveValue("0");
  await d
    .getByLabel("Admission ticket required", { exact: true })
    .selectOption("false");
  await d.getByRole("button", { name: "Save record" }).click();
  await expect(d).toHaveCount(0);
  expect(state.writes[0].body).toEqual({ requires_admission: false });
  expect(state.rooms[0].features).toEqual(["projector"]);
  expect(state.rooms[0].access_rule).toEqual({
    allowed_roles: ["student", "staff"],
  });
});

test("a parent beyond the first page is selectable without a truncated dropdown", async ({
  page,
}) => {
  const state = await campusAdminSession(page, true);
  await page.goto("/admin/campus");
  await expect(page.getByText("12 shown · 14 matching records")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "West annex", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { name: "West annex", exact: true }),
    })
    .getByRole("button", { name: "Open floors" })
    .click();
  await expect(
    page.getByRole("heading", { name: "West ground floor", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New floor" }).click();
  await expect(page.getByRole("dialog")).toContainText("West annex");
  expect(
    state.reads.some((r) => r.kind === "buildings" && r.query.page === "2"),
  ).toBe(true);
  expect(state.reads.at(-1)?.query.building_id).toBe(uuid(14));
});

test("scoped server search handles level zero and cross-campus browse", async ({
  page,
}) => {
  const state = await campusAdminSession(page);
  await page.goto("/admin/campus");
  await goFloors(page);
  await page.getByLabel("Search floors", { exact: true }).fill("0");
  await expect(page.getByRole("article")).toHaveCount(1);
  expect(state.reads.at(-1)?.query).toMatchObject({
    q: "0",
    building_id: uuid(1),
    page: "1",
  });
  await page
    .getByRole("button", { name: "Clear context", exact: true })
    .click();
  await expect(page.getByRole("article")).toHaveCount(5);
  await page
    .getByRole("button", { name: "Rooms directory", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Materials laboratory", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "New room" })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Browse floors" }),
  ).toBeVisible();
});

for (const kind of ["buildings", "floors", "rooms"] as const)
  for (const status of [403, 409, 422, 429, 503])
    test(`${kind} write ${status} retains its editor and draft`, async ({
      page,
    }) => {
      const state = await campusAdminSession(page);
      state.writeStatus = status;
      await page.goto("/admin/campus");
      if (kind === "floors") await goFloors(page);
      if (kind === "rooms") await goRooms(page);
      await page
        .getByRole("button", {
          name:
            kind === "buildings"
              ? "Edit A"
              : kind === "floors"
                ? "Edit A-G"
                : "Edit A-001",
          exact: true,
        })
        .click();
      const d = page.getByRole("dialog");
      await d.getByLabel("Name", { exact: true }).fill("Retain this draft");
      await d.getByRole("button", { name: "Save record" }).click();
      await expect(d.getByRole("alert")).toContainText("Keep your draft");
      await expect(d.getByLabel("Name", { exact: true })).toHaveValue(
        "Retain this draft",
      );
      expect(state.writes).toHaveLength(1);
    });
for (const mode of ["wrong-id", "wrong-field", "missing-response"])
  test(`${mode} cannot confirm a save`, async ({ page }) => {
    const state = await campusAdminSession(page);
    state.reply = (r) =>
      mode === "wrong-id"
        ? { ...r, id: uuid(888) }
        : mode === "wrong-field"
          ? { ...r, name: "Ignored" }
          : {};
    await page.goto("/admin/campus");
    await page.getByRole("button", { name: "Edit A", exact: true }).click();
    const d = page.getByRole("dialog");
    await d.getByLabel("Name", { exact: true }).fill("Unconfirmed draft");
    await d.getByRole("button", { name: "Save record" }).click();
    await expect(d.getByRole("alert")).toBeVisible();
    await expect(d.getByLabel("Name", { exact: true })).toHaveValue(
      "Unconfirmed draft",
    );
    await expect(
      page.getByRole("status").filter({ hasText: "Saved record confirmed" }),
    ).toHaveCount(0);
  });

test("deletion requires confirmation, preserves refusal, and validates identity", async ({
  page,
}) => {
  const state = await campusAdminSession(page);
  state.writeStatus = 409;
  await page.goto("/admin/campus");
  await page.getByRole("button", { name: "Remove A", exact: true }).click();
  const d = page.getByRole("dialog");
  await expect(d).toContainText("Child records are not deleted");
  expect(state.writes).toHaveLength(0);
  await d.getByRole("button", { name: "Remove record" }).click();
  await expect(d.getByRole("alert")).toBeVisible();
  state.writeStatus = 200;
  state.deletionReply = { deleted: uuid(888) };
  await d.getByRole("button", { name: "Remove record" }).click();
  await expect(d.getByRole("alert")).toContainText("did not confirm removal");
  await d.getByRole("button", { name: "Cancel", exact: true }).click();
});

test("successful unused-record removal is server confirmed", async ({
  page,
}) => {
  const state = await campusAdminSession(page);
  await page.goto("/admin/campus");
  await page.getByRole("button", { name: "Remove C", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Remove record" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Student services", exact: true }),
  ).toHaveCount(0);
  expect(state.writes[0].method).toBe("DELETE");
});

test("double submit locks mutation and prevents escape from a saving draft", async ({
  page,
}) => {
  const state = await campusAdminSession(page);
  state.delayWrite = 650;
  await page.goto("/admin/campus");
  await page.getByRole("button", { name: "Edit A", exact: true }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Name", { exact: true }).fill("Confirmed once");
  await d.getByRole("button", { name: "Save record" }).evaluate((el) => {
    (el as HTMLButtonElement).click();
    (el as HTMLButtonElement).click();
  });
  await page.keyboard.press("Escape");
  await expect(d).toBeVisible();
  await expect(d.getByRole("button", { name: "Save record" })).toBeDisabled();
  await expect(d).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
});
for (const mode of ["empty", "error", "loading", "malformed"])
  test(`${mode} directory does not invent records`, async ({ page }) => {
    const state = await campusAdminSession(page);
    if (mode === "empty") state.buildings = [];
    if (mode === "error") state.readStatus = 503;
    if (mode === "loading") state.delayRead = 750;
    if (mode === "malformed")
      state.readPayload = { items: [], meta: { current_page: 1 } };
    await page.goto("/admin/campus");
    if (mode === "empty")
      await expect(
        page.getByRole("heading", { name: "No records on this page" }),
      ).toBeVisible();
    else if (mode === "loading") {
      await expect(page.getByLabel("Loading workspace")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "New building" }),
      ).toBeDisabled();
      await expect(
        page.getByRole("heading", { name: "Learning centre", exact: true }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole("button", { name: "Try again" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "No records on this page" }),
      ).toHaveCount(0);
      state.readStatus = 200;
      state.readPayload = undefined;
      await page.getByRole("button", { name: "Try again" }).click();
      await expect(
        page.getByRole("heading", { name: "Learning centre", exact: true }),
      ).toBeVisible();
    }
  });

test("a network error keeps the room draft", async ({ page }) => {
  await campusAdminSession(page);
  await page.goto("/admin/campus");
  await goRooms(page);
  await page.route("**/api/v1/admin/rooms/*", (route) => route.abort("failed"));
  await page.getByRole("button", { name: "Edit A-001", exact: true }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Name", { exact: true }).fill("Offline draft");
  await d.getByRole("button", { name: "Save record" }).click();
  await expect(d.getByRole("alert")).toContainText("unreachable");
  await expect(d.getByLabel("Name", { exact: true })).toHaveValue(
    "Offline draft",
  );
});

test("401 redirects to login rather than displaying actionable records", async ({
  page,
}) => {
  const state = await campusAdminSession(page);
  state.readStatus = 401;
  await page.goto("/admin/campus");
  await expect(page).toHaveURL(/login/);
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
});

for (const kind of ["floors", "rooms"] as const)
  test(`${kind} read failure remains recoverable and is not an empty directory`, async ({
    page,
  }) => {
    const state = await campusAdminSession(page);
    await page.goto("/admin/campus");
    if (kind === "floors") await goFloors(page);
    else await goRooms(page);
    state.readStatus = 503;
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(
      page.getByText("Campus directory unavailable (503).", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "No records on this page" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: `New ${kind === "floors" ? "floor" : "room"}`,
      }),
    ).toBeDisabled();
    state.readStatus = 200;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("article")).not.toHaveCount(0);
  });

test("same record identity with a different parent cannot confirm an edit", async ({
  page,
}) => {
  const state = await campusAdminSession(page);
  state.reply = (r) => ({ ...r, floor_id: uuid(114) });
  await page.goto("/admin/campus");
  await goRooms(page);
  await page.getByRole("button", { name: "Edit A-001", exact: true }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Name", { exact: true }).fill("Do not move this room");
  await d.getByRole("button", { name: "Save record" }).click();
  await expect(d.getByRole("alert")).toContainText("did not confirm");
  await expect(d.getByLabel("Name", { exact: true })).toHaveValue(
    "Do not move this room",
  );
});

test("duplicate records in a malformed directory are not editable", async ({
  page,
}) => {
  const state = await campusAdminSession(page);
  state.readPayload = {
    items: [state.buildings[0], state.buildings[0]],
    meta: { current_page: 1, per_page: 12, total: 2, last_page: 1 },
  };
  await page.goto("/admin/campus");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit A", exact: true }),
  ).toHaveCount(0);
});
