import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { alertsSession, sampleAlerts } from "./alerts-fixtures";

for (const width of [320, 768, 1440]) {
  test(`alert triage, keyboard review and draft retention at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: width === 320 ? 700 : 1000 });
    const state = await alertsSession(page);
    await page.goto("/admin/alerts");
    await expect(
      page.getByRole("heading", { name: "Operational alerts" }),
    ).toBeVisible();
    await expect(page.locator("article h3").first()).toHaveText(
      sampleAlerts[1].title,
    );
    await expect(page.locator("dl dd")).toHaveText(["1", "2", "12"]);
    const note = page.getByRole("textbox");
    await note.fill("Ask the service team before reopening.");
    const second = page.getByRole("button", {
      name: `Inspect ${sampleAlerts[0].title}`,
    });
    await second.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("complementary", {
        name: `Review ${sampleAlerts[0].title}`,
      }),
    ).toBeFocused();
    await expect(note).toHaveValue("");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Spatial configuration" }),
    ).toBeFocused();
    await page
      .getByRole("button", { name: `Inspect ${sampleAlerts[1].title}` })
      .click();
    await expect(note).toHaveValue("Ask the service team before reopening.");
    await expect(page.locator("#condition-review")).toHaveCount(1);
    await expect(page.locator("#acknowledgement-note")).toHaveCount(1);
    if (width <= 900) {
      // The source/keyboard order, not just CSS order, follows the selected record.
      expect(
        await page
          .locator("#condition-review")
          .evaluate((el) => el.previousElementSibling?.tagName),
      ).toBe("ARTICLE");
      const card = await page.locator("article").first().boundingBox(),
        panel = await page.locator("#condition-review").boundingBox();
      expect(panel!.y).toBeGreaterThan(card!.y);
      expect(panel!.y - card!.y - card!.height).toBeLessThan(30);
    }
    await page.getByRole("button", { name: /^Critical/ }).click();
    await expect(page.locator("article")).toHaveCount(1);
    await page.getByRole("button", { name: /^Warning/ }).click();
    await expect(page.locator("article")).toHaveCount(2);
    await page.getByRole("button", { name: /^Information/ }).click();
    await expect(page.locator("article")).toHaveCount(1);
    await page.getByRole("button", { name: /^All conditions/ }).click();
    expect(state.writes).toHaveLength(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => document.fonts.ready);
    mkdirSync("../.cache/alerts-pass/screens", { recursive: true });
    await page.screenshot({
      path: `../.cache/alerts-pass/screens/triage-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
  test(`empty and failed snapshots are honest at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await alertsSession(page);
    state.alerts = [];
    await page.goto("/admin/alerts");
    await expect(
      page.getByRole("heading", { name: "No conditions to review" }),
    ).toBeVisible();
    await expect(
      page.getByText("This is not a campus-wide health guarantee", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(page.locator("dl dd")).toHaveText(["0", "0", "12"]);
    await page.screenshot({
      path: `../.cache/alerts-pass/screens/empty-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    state.readStatus = 503;
    await page.getByRole("button", { name: "Re-check", exact: true }).click();
    await expect(
      page.getByText("Alert snapshot unavailable (503).", { exact: true }),
    ).toBeVisible();
    await expect(page.locator("dl dd")).toHaveText(["—", "—", "—"]);
    await expect(
      page.getByRole("button", { name: "Mute this condition" }),
    ).toHaveCount(0);
    await page.screenshot({
      path: `../.cache/alerts-pass/screens/error-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    state.readStatus = 200;
    state.alerts = structuredClone(sampleAlerts);
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.locator("article")).toHaveCount(4);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
  });
}

test("exact fingerprint confirmation refreshes without a local mute override", async ({
  page,
}) => {
  const state = await alertsSession(page);
  state.keepAfterAck = true;
  await page.goto("/admin/alerts");
  const note = page.getByRole("textbox");
  await note.fill("  Confirmed with the desk.  ");
  await page.getByRole("button", { name: "Mute this condition" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Acknowledgement recorded" }),
  ).toBeVisible();
  await expect(page.locator("article")).toHaveCount(4); // The latest server response remains authoritative.
  expect(state.writes).toEqual([
    { fingerprint: sampleAlerts[1].key, note: "Confirmed with the desk." },
  ]);
  await expect(note).toHaveValue("");
  state.alerts[1] = {
    ...sampleAlerts[1],
    key: "office_closed:o1:changed",
    title: "7 tickets remain at closed offices",
  };
  await page.getByRole("button", { name: "Re-check" }).click();
  await expect(
    page.getByRole("heading", { name: "7 tickets remain at closed offices" }),
  ).toBeVisible();
  await expect(page.locator("article")).toHaveCount(4);
});

test("successful mute does not claim resolution and filter empty state can recover", async ({
  page,
}) => {
  const state = await alertsSession(page);
  await page.goto("/admin/alerts");
  await page.getByRole("button", { name: /^Critical/ }).click();
  await page.getByRole("button", { name: "Mute this condition" }).click();
  await expect(
    page.getByRole("heading", { name: "No critical conditions" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "underlying condition has not been resolved" }),
  ).toBeVisible();
  expect(state.writes[0].note).toBeNull();
  await page.getByRole("button", { name: "Show all conditions" }).click();
  await expect(page.locator("article")).toHaveCount(3);
});

for (const status of [403, 404, 409, 422, 429, 500, 503])
  test(`acknowledgement ${status} preserves the note and condition`, async ({
    page,
  }) => {
    const state = await alertsSession(page);
    state.writeStatus = status;
    await page.goto("/admin/alerts");
    await page.getByRole("textbox").fill("Keep this review note.");
    await page.getByRole("button", { name: "Mute this condition" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "could not be saved" }),
    ).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveValue(
      "Keep this review note.",
    );
    await expect(page.locator("article")).toHaveCount(4);
    await expect(
      page.getByText("Acknowledgement recorded for this fingerprint.", {
        exact: false,
      }),
    ).toHaveCount(0);
    expect(state.writes).toHaveLength(1);
  });

for (const response of [{}, { acknowledged: "another-fingerprint" }])
  test(`incomplete mutation confirmation ${JSON.stringify(response)} cannot clear a draft`, async ({
    page,
  }) => {
    const state = await alertsSession(page);
    state.ackPayload = response;
    await page.goto("/admin/alerts");
    await page.getByRole("textbox").fill("Pending confirmation.");
    await page.getByRole("button", { name: "Mute this condition" }).click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "did not confirm this condition" }),
    ).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveValue(
      "Pending confirmation.",
    );
  });

for (const malformed of [
  "missing-list",
  "duplicate-key",
  "bad-severity",
  "bad-date",
  "missing-count",
])
  test(`malformed ${malformed} does not become a healthy empty feed`, async ({
    page,
  }) => {
    const state = await alertsSession(page);
    const payload = {
      alerts: structuredClone(sampleAlerts),
      counts: { acknowledged: 12 },
      generated_at: state.generated_at,
    } as Record<string, unknown>;
    if (malformed === "missing-list") delete payload.alerts;
    if (malformed === "duplicate-key")
      payload.alerts = [sampleAlerts[0], sampleAlerts[0]];
    if (malformed === "bad-severity")
      payload.alerts = [{ ...sampleAlerts[0], severity: "urgent" }];
    if (malformed === "bad-date") payload.generated_at = "never";
    if (malformed === "missing-count") payload.counts = {};
    state.readPayload = payload;
    await page.goto("/admin/alerts");
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "No conditions to review" }),
    ).toHaveCount(0);
    await expect(page.locator("dl dd")).toHaveText(["—", "—", "—"]);
  });

for (const target of [
  "javascript:alert(1)",
  "//evil.example",
  "https://evil.example",
  "/admin/services?redirect=evil",
])
  test(`untrusted target ${target} is not an actionable link`, async ({
    page,
  }) => {
    const state = await alertsSession(page);
    state.alerts = [{ ...sampleAlerts[1], target }];
    await page.goto("/admin/alerts");
    await expect(
      page.getByRole("complementary", {
        name: `Review ${sampleAlerts[1].title}`,
      }),
    ).toBeVisible();
    await expect(page.locator("#condition-review a")).toHaveCount(0);
    await expect(page.getByRole("textbox")).toBeVisible();
  });

test("pending acknowledgement locks double clicks, filters and refresh", async ({
  page,
}) => {
  const state = await alertsSession(page);
  state.delayWrite = 650;
  await page.goto("/admin/alerts");
  const submit = page.getByRole("button", { name: "Mute this condition" });
  await submit.evaluate((el) => {
    (el as HTMLButtonElement).click();
    (el as HTMLButtonElement).click();
  });
  await expect(submit).toBeDisabled();
  await expect(page.getByRole("button", { name: "Re-check" })).toBeDisabled();
  await expect(page.getByRole("button", { name: /^Warning/ })).toBeDisabled();
  await expect(
    page.getByRole("status").filter({ hasText: "Acknowledgement recorded" }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
});

test("loading never presents zero as a healthy report", async ({ page }) => {
  const state = await alertsSession(page);
  state.delayRead = 700;
  await page.goto("/admin/alerts");
  await expect(page.getByLabel("Loading workspace")).toBeVisible();
  await expect(page.locator("dl dd")).toHaveText(["—", "—", "—"]);
  await expect(page.getByRole("button", { name: "Re-check" })).toBeDisabled();
  await expect(page.locator("article")).toHaveCount(4);
});

test("network failure preserves the draft and server-denied reads offer retry", async ({
  page,
}) => {
  await alertsSession(page);
  await page.route("**/api/v1/admin/alerts/ack", (route) =>
    route.abort("failed"),
  );
  await page.goto("/admin/alerts");
  await page.getByRole("textbox").fill("Offline review stays here.");
  await page.getByRole("button", { name: "Mute this condition" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "unreachable" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveValue(
    "Offline review stays here.",
  );
  await page.route("**/api/v1/admin/alerts", (route) =>
    route.fulfill({
      status: 403,
      json: { success: false, message: "Monitoring permission denied." },
    }),
  );
  await page.getByRole("button", { name: "Re-check" }).click();
  await expect(
    page.getByText("Monitoring permission denied.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
});

test("long fingerprints and notes wrap, bounded notes survive a viewport change", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const state = await alertsSession(page);
  state.alerts = [
    {
      ...sampleAlerts[1],
      key: "x".repeat(160),
      title: "VeryLongUnbrokenCampusCondition".repeat(4),
    },
  ];
  await page.goto("/admin/alerts");
  const note = page.getByRole("textbox");
  await note.fill("n".repeat(300));
  await expect(note).toHaveAttribute("maxlength", "300");
  await page.getByText("Reported fingerprint", { exact: true }).click();
  await expect(
    page.locator("code").filter({ hasText: "x".repeat(160) }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByRole("textbox")).toHaveValue("n".repeat(300));
  await expect(page.locator("#condition-review")).toHaveCount(1);
});

test("a confirmed write followed by a failed refresh is not a healthy empty feed", async ({
  page,
}) => {
  const state = await alertsSession(page);
  await page.goto("/admin/alerts");
  await expect(page.getByRole("textbox")).toBeVisible();
  state.readStatus = 503;
  await page.getByRole("button", { name: "Mute this condition" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Acknowledgement recorded" }),
  ).toBeVisible();
  await expect(
    page.getByText("Alert snapshot unavailable (503).", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No conditions to review" }),
  ).toHaveCount(0);
  await expect(page.locator("dl dd")).toHaveText(["—", "—", "—"]);
  state.readStatus = 200;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator("article")).toHaveCount(3);
});

test("an expired-session response cannot display actionable alert data", async ({
  page,
}) => {
  const state = await alertsSession(page);
  state.readStatus = 401;
  await page.goto("/admin/alerts");
  await expect(page).toHaveURL(/login/);
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mute this condition" }),
  ).toHaveCount(0);
});
