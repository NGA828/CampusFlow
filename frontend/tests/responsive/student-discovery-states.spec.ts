import { test, expect, type Page } from '@playwright/test';
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { discoverySession } from './student-discovery-fixtures';
import { staffServicesSession } from './staff-services-fixtures';
import { alertsSession } from './alerts-fixtures';
import { campusAdminSession } from './campus-admin-fixtures';

// Full-page capture forces an additional compositor/layout pass. Like Playwright's screenshot
// assertions, wait for three identical captures before comparing cold and client-navigation states.
async function stableLanding(page: Page, output: string) {
  let previous: Buffer | undefined;
  let consecutive = 0;
  await expect.poll(async () => {
    const current = await page.screenshot({ fullPage: true, animations: 'disabled' });
    consecutive = previous?.equals(current) ? consecutive + 1 : 1;
    previous = current;
    return consecutive >= 3;
  }, { timeout: 60000, intervals: [100], message: 'Landing raster should settle before comparison' }).toBe(true);
  writeFileSync(output, previous!);
  return previous!;
}


test('narrow room filters are keyboard-accessible and do not bury search', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await discoverySession(page);
  await page.goto('/student/campus/rooms');
  const toggle = page.getByRole('button', { name: 'Filter rooms', exact: true });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('combobox', { name: 'Room type' })).toBeHidden();
  const search = await page.getByLabel('Search rooms', { exact: true }).boundingBox();
  expect(search!.y + search!.height).toBeLessThan(800);
  await toggle.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('combobox', { name: 'Room type' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Room type' }).selectOption('lab');
  await toggle.click();
  await expect(page.getByText('Learning commons', { exact: true })).toBeHidden();
  await expect(page.getByText('Interaction design studio', { exact: true })).toBeVisible();
});

test('a pending room read has a loading state and honours reduced motion', async ({ page }) => {
  await discoverySession(page);
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/campus/rooms?*', async route => { await gate; await route.fallback(); });
  await page.goto('/student/campus/rooms');
  await expect(page.getByRole('region', { name: 'Room results' })).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByText('No rooms match those filters')).toBeHidden();
  expect(await page.locator('main').evaluate(el => [...el.querySelectorAll('*')].filter(n => getComputedStyle(n).animationName.includes('arrive')).length)).toBe(0);
  release();
  await expect(page.getByText('Interaction design studio', { exact: true })).toBeVisible();
});

test('malformed pagination is an error, not an invented single page', async ({ page }) => {
  await discoverySession(page);
  await page.route('**/api/v1/campus/rooms?*', route => route.fulfill({ json: { success: true, data: { items: [], meta: { total: 120 } } } }));
  await page.goto('/student/campus/rooms');
  await expect(page.getByText('The rooms service returned invalid pagination.')).toBeVisible();
  await expect(page.getByText('No rooms match those filters')).toBeHidden();
});

test('queue success needs a successful API write and keeps its idempotency key', async ({ page }) => {
  await discoverySession(page);
  let key = '';
  await page.route('**/api/v1/student/queues/q1/tickets', route => {
    key = route.request().postDataJSON().idempotency_key;
    return route.fulfill({ json: { success: true, data: { ticket: { id: 'confirmed-ticket', queue_id: 'q1', ticket_number: 'B-025', status: 'waiting' }, queue: { id: 'q1', room_code: 'B204', room_name: 'Interaction design studio' }, people_ahead: 4, eta_seconds: 1200, can_check_in: false, can_cancel: true } } });
  });
  await page.goto('/student/campus/rooms/B204');
  await page.getByRole('button', { name: 'Join queue', exact: true }).click();
  await expect(page.getByText('You joined the queue. Follow your ticket below.')).toBeVisible();
  expect(key.length).toBeGreaterThan(5);
  await expect(page.getByRole('button', { name: 'Join queue', exact: true })).toBeHidden();
});

test('loading signed-in page styles does not change the landing after client navigation', async ({ page }, testInfo) => {
  test.setTimeout(180000); // Three roles plus campus administration; retain three exact captures, allow slower renderer settling.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.clock.setFixedTime(new Date('2026-09-15T10:00:00Z'));
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  await page.evaluate(async () => { await document.fonts.ready; for (const image of document.images) image.loading = 'eager'; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
  const landingTitle = await page.locator('h1').textContent();
  await page.mouse.move(1439, 999);
  const cold = await stableLanding(page, testInfo.outputPath('landing-cold.png'));
  writeFileSync(testInfo.outputPath('landing-cold-dom.json'), JSON.stringify(await page.locator('[style]').evaluateAll(els => els.map(el => ({tag:el.tagName,style:el.getAttribute('style'),cls:el.getAttribute('class')}))), null, 2));
  await discoverySession(page);
  await page.route('**/api/v1/auth/logout', route => route.fulfill({ json: { success: true } }));
  await page.goto('/student/campus/rooms');
  await expect(page.getByText('Interaction design studio', { exact: true })).toBeVisible();
  // Load the service/timetable CSS module as well as the discovery module before leaving the workspace.
  await page.getByRole('link', { name: 'Timetable', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'CS204', exact: true })).toBeVisible();
  // The companion batch has its own scoped CSS; exercise its client load too.
  await page.getByRole('link', { name: 'AI assistant', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Campus assistant', exact: true })).toBeVisible();
  // Load fourth-batch scoped explorer/operations CSS before checking landing isolation.
  await page.getByRole('link', { name: 'Map & route preview', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Campus map', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/login/);
  // Load the fifth-batch module through a real client-side staff sign-in, preserving the earlier CSS.
  await staffServicesSession(page);
  await page.route('**/api/v1/auth/login', route => route.fulfill({ json: { success: true, data: { token: 'style-review-only', user: { id: 'review-user', name: 'Daniel Nwosu', email: 'staff@example.test', role: 'staff', permissions: [], is_active: true } } } }));
  await page.route('**/api/v1/auth/logout', route => route.fulfill({ json: { success: true } }));
  await page.getByLabel('Email address', { exact: true }).fill('staff@example.test');
  await page.getByLabel('Password', { exact: true }).fill('fixture-only-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/staff\/dashboard/);
  await page.locator('a[href="/staff/offices"]').first().click();
  await expect(page.getByRole('heading', { name: 'Office services', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Student affairs', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/login/);
  // The seventh individual page must not leak its scoped alert styles onto the landing.
  await alertsSession(page);
  await page.route('**/api/v1/auth/login', route => route.fulfill({ json: { success: true, data: { token: 'alert-style-review-only', user: { id: 'review-user', name: 'Nadia Mensah', email: 'admin@example.test', role: 'admin', permissions: [], is_active: true } } } }));
  await page.route('**/api/v1/auth/logout', route => route.fulfill({ json: { success: true } }));
  await page.getByLabel('Email address', { exact: true }).fill('admin@example.test');
  await page.getByLabel('Password', { exact: true }).fill('fixture-only-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/admin\/dashboard/);
  await page.locator('a[href="/admin/alerts"]').first().click();
  await expect(page.getByRole('heading', { name: 'Operational alerts', exact: true })).toBeVisible();
  await expect(page.locator('#condition-review')).toBeVisible();
  expect(await page.locator('#condition-review').evaluate(el => getComputedStyle(el).borderRadius)).toBe('14px');
  await campusAdminSession(page);
  await page.locator('a[href="/admin/campus"]').first().click();
  await expect(page.getByRole('heading', { name: 'Campus management', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Learning centre', exact: true })).toBeVisible();
  expect(await page.getByRole('heading', { name: 'Campus management', exact: true }).evaluate(el => getComputedStyle(el).color)).toBe('rgb(40, 60, 64)');
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await page.locator('a[href="/"]').first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('h1')).toHaveText(landingTitle!);
  await page.mouse.move(1439, 999);
  await page.evaluate(async () => { await document.fonts.ready; for (const image of document.images) image.loading = 'eager'; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
  const after = await stableLanding(page, testInfo.outputPath('landing-after.png'));
  writeFileSync(testInfo.outputPath('landing-after-dom.json'), JSON.stringify(await page.locator('[style]').evaluateAll(els => els.map(el => ({tag:el.tagName,style:el.getAttribute('style'),cls:el.getAttribute('class')}))), null, 2));
  const a = await sharp(cold).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(after).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  expect(a.info).toEqual(b.info);
  let differingChannels = 0;
  for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) differingChannels++;
  expect(differingChannels).toBe(0);
  writeFileSync(testInfo.outputPath('landing-style-isolation.json'), JSON.stringify({ date: '2026-09-16', comparison: 'Current cold landing vs landing after client navigation through discovery, timetable, companion, campus operations, staff services, coordination (staff dashboard), admin alerts, campus administration and logout', width: a.info.width, height: a.info.height, differingChannels }, null, 2));
});
