import { test, expect, type Page, type Locator } from '@playwright/test';

const sizes = [
  [320, 568], [360, 640], [390, 844], [430, 932], [768, 1024],
  [1024, 768], [1280, 800], [1920, 1080], [844, 390],
];
const longName = 'Alexandria-Marie VeryLongCampusDepartmentNameWithoutSpaces';

async function noPageOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}
async function insideViewport(page: Page, target: Locator) {
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
}

// Isolated layout fixtures only. These never enter app/runtime code and do not test API authorization.
async function session(page: Page, role: 'student' | 'staff' | 'admin') {
  await page.addInitScript(() => localStorage.setItem('campusflow.token', 'responsive-test-only'));
  const user = { id: 'layout-user', name: longName, email: 'layout@example.test', role_code: role, permissions: [], is_active: true };
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    const data: Record<string, unknown> = {
      '/me': { user, assignments: [] },
      '/me/notifications': { items: [{ id: 'notice', title: longName, body: 'A long notification that must wrap within the viewport. '.repeat(8), created_at: new Date().toISOString(), read_at: null }], unread: 1 },
      '/admin/users': { items: [user], meta: { page: 1, per_page: 25, total: 60, total_pages: 3 } },
      '/admin/staff-assignments': { assignments: [] },
      '/campus/buildings': { buildings: [] },
      '/student/dashboard': { user, today: { entries: [] }, next_class: null, queue_ticket: null, office_ticket: null, quick_actions: [], notifications: [], building_alerts: [], announcements: [], events: [], unread_notifications: 1 },
      '/student/queues/board': { queues: [] },
      '/student/offices': { offices: [] },
      '/staff/rooms': { rooms: [] },
      '/student/timetable': { week_start: '2026-09-14', week_end: '2026-09-20', entries: [{ id: 'class', date: '2026-09-15', starts_at: '09:00', ends_at: '10:00', starts_at_iso: '2026-09-15T09:00:00Z', ends_at_iso: '2026-09-15T10:00:00Z', course_code: 'CS101', course_title: longName, room_code: 'B204', session_type: 'lecture' }] },
    };
    if (path in data) await route.fulfill({ json: { success: true, data: data[path] } });
    else await route.fulfill({ status: 503, json: { success: false, message: 'Layout test: this resource is intentionally unavailable.' } });
  });
}

for (const [width, height] of sizes) {
  test(`public pages reflow at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    for (const path of ['/', '/login', '/register']) {
      await page.goto(path);
      await expect(page.locator('h1:visible').first()).toBeVisible();
      await noPageOverflow(page);
    }
  });

  test(`admin table, navigation, notification and modal at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await session(page, 'admin');
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: 'Users & roles' })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    expect((await page.locator('thead').boundingBox())!.height).toBeLessThan(72);
    await noPageOverflow(page);
    const region = page.getByRole('region', { name: 'Data table, scroll horizontally for more columns' });
    await expect(region).toHaveAttribute('tabindex', '0');
    if (width < 768) {
      expect(await region.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
      await region.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
      expect(await region.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    }
    await page.getByRole('button', { name: 'Notifications', exact: true }).click();
    await insideViewport(page, page.getByRole('region', { name: 'Recent notifications' }));
    await noPageOverflow(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('region', { name: 'Recent notifications' })).toBeHidden();
    if (width < 1024) {
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await expect(page.getByRole('navigation', { name: 'Workspace navigation' })).toBeVisible();
      await noPageOverflow(page);
      await page.keyboard.press('Escape');
    }
    const trigger = page.getByRole('button', { name: 'New user' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Create a user' });
    await expect(dialog).toBeVisible();
    await insideViewport(page, dialog);
    const name = dialog.getByLabel('Full name', { exact: true });
    await name.pressSequentially('Responsive layout test');
    await expect(name).toHaveValue('Responsive layout test');
    await expect(name).toBeFocused();
    await insideViewport(page, dialog.getByRole('button', { name: 'Create user', exact: true }));
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
  });
}

test('student screens reflow and week grid scrolls when explicitly selected on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await session(page, 'student');
  for (const path of ['/student/dashboard', '/student/services/offices', '/student/assistant', '/student/campus/map', '/student/timetable']) {
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
    await noPageOverflow(page);
  }
  await page.getByRole('button', { name: 'Week grid' }).click();
  const grid = page.getByRole('region', { name: 'Weekly timetable, scroll horizontally for more days' });
  await expect(grid).toBeVisible();
  expect(await grid.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await noPageOverflow(page);
});

test('staff shell responds to live resizing and 200% text', async ({ page }) => {
  await session(page, 'staff');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/staff/rooms');
  await expect(page.locator('main h1')).toBeVisible();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  await noPageOverflow(page);
});

test('touch targets and form font sizes on a tablet', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 }, hasTouch: true });
  const page = await context.newPage();
  await page.goto('/login');
  const email = page.getByLabel('Email address', { exact: true });
  await expect(email).toBeVisible();
  expect(await email.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  const box = await page.getByRole('button', { name: 'Sign in', exact: true }).boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await context.close();
});
