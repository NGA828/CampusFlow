import { test, expect, type Page } from '@playwright/test';
import { mobileSession } from './mobile-fixtures';

export const mobileScreens = [
  { slug: 'login', path: '/login', role: null, text: 'Welcome back' },
  { slug: 'student-today', path: '/student', role: 'student', text: 'Interaction design' },
  { slug: 'student-scan', path: '/student/scan', role: 'student', text: 'Scan. Locate. Go.' },
  { slug: 'student-map', path: '/student/map', role: 'student', text: 'Your next place, found.' },
  { slug: 'student-line', path: '/student/queue', role: 'student', text: 'Your place in line.' },
  { slug: 'student-more', path: '/student/more', role: 'student', text: 'A little more, for you.' },
  { slug: 'staff-line', path: '/staff', role: 'staff', text: 'Keep campus moving.' },
  { slug: 'staff-desk', path: '/staff/desk', role: 'staff', text: 'A smoother handover.' },
  { slug: 'staff-more', path: '/staff/more', role: 'staff', text: 'The person behind the desk.' },
  { slug: 'admin-monitoring', path: '/admin', role: 'admin', text: 'Campus, at a glance.' },
  { slug: 'admin-alerts', path: '/admin/alerts', role: 'admin', text: 'Know what needs you.' },
] as const;

async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const escaped = await page.locator('[role="button"], input').evaluateAll((nodes) => nodes.filter((node) => {
    const box = node.getBoundingClientRect();
    return box.width > 0 && (box.left < -1 || box.right > innerWidth + 1);
  }).map((node) => node.textContent));
  expect(escaped).toEqual([]);
}

test.describe('Mobile visual redesign', () => {
  test.skip(!process.env.RESPONSIVE_MOBILE_URL, 'Export and serve the Expo mobile web client first.');
  for (const width of [320, 390, 768, 844]) {
    for (const screen of mobileScreens) {
      test(`${screen.slug} reflows at ${width}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: width === 844 ? 390 : 844 });
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        if (screen.role) await mobileSession(page, screen.role);
        await page.goto(process.env.RESPONSIVE_MOBILE_URL + screen.path);
        await expect(page.getByText(screen.text, { exact: true }).first()).toBeVisible();
        // Wait for actual fixture content, not only the static heading.
        if (screen.slug === 'student-map') await expect(page.getByText('Around campus', { exact: true })).toBeVisible();
        if (screen.slug === 'admin-alerts') await expect(page.getByText('A queue needs attention', { exact: true })).toBeVisible();
        const ready: Record<string, string> = { 'student-line': 'B-024', 'staff-line': '9 people waiting', 'staff-desk': 'B-024', 'staff-more': 'Your desk assignment', 'admin-monitoring': '3 alerts need review' };
        if (ready[screen.slug]) await expect(page.getByText(ready[screen.slug], { exact: true }).first()).toBeVisible();
        await fits(page);
        if (width === 390) await page.screenshot({ path: testInfo.outputPath(`${screen.slug}.png`) });
        expect(errors).toEqual([]);
      });
    }
  }

  test('login disclosure, password reveal and unsuccessful sign-in stay honest', async ({ page }) => {
    await page.goto(process.env.RESPONSIVE_MOBILE_URL + '/login');
    await page.getByRole('button', { name: 'Demo accounts', exact: true }).click();
    await page.getByRole('button', { name: 'Student · student@campusflow.edu', exact: true }).click();
    const password = page.getByLabel('Password', { exact: true });
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Show password', exact: true }).click();
    await expect(password).toHaveJSProperty('type', 'text');
    await page.getByRole('button', { name: 'Hide password', exact: true }).click();
    await page.route('**/api/v1/auth/login', (route) => route.fulfill({ status: 401, json: { success: false, message: 'These credentials are not valid.' } }));
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('These credentials are not valid.');
    await expect(page).toHaveURL(/login/);
  });

  test('manual QR validation confirms only after the API response', async ({ page }) => {
    const requests = await mobileSession(page, 'student');
    await page.goto(process.env.RESPONSIVE_MOBILE_URL + '/student/scan');
    await expect(page.getByText('Position fixed', { exact: true })).toBeHidden();
    await page.getByRole('button', { name: 'Enter code manually', exact: true }).click();
    await page.getByLabel('Anchor code', { exact: true }).fill('QR-B-ENTRANCE');
    await page.getByRole('button', { name: 'Validate code', exact: true }).click();
    await expect(page.getByText('Position fixed', { exact: true })).toBeVisible();
    expect(requests.some((r) => r.path === '/student/positioning/scan' && r.method === 'POST')).toBe(true);
  });

  test('one-letter building codes open room results instead of a hard-coded destination', async ({ page }) => {
    await mobileSession(page, 'student');
    await page.goto(process.env.RESPONSIVE_MOBILE_URL + '/student/map');
    await page.getByRole('button', { name: 'Explore A rooms', exact: true }).click();
    await expect(page.getByLabel('Search rooms', { exact: true })).toHaveValue('A');
    await expect(page.getByText('A101 · Learning studio', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    await expect(page.getByText('Around campus', { exact: true })).toBeVisible();
  });

  test('alert filters and acknowledgement preserve the backend flow', async ({ page }) => {
    const requests = await mobileSession(page, 'admin');
    await page.goto(process.env.RESPONSIVE_MOBILE_URL + '/admin/alerts');
    await page.getByRole('button', { name: 'critical alerts', exact: true }).click();
    await expect(page.getByText('A queue needs attention', { exact: true })).toBeVisible();
    await expect(page.getByText('An anchor needs verification', { exact: true })).toBeHidden();
    await page.getByRole('button', { name: 'Mute this condition', exact: true }).click();
    await expect(page.getByText('No critical conditions', { exact: true })).toBeVisible();
    expect(requests.some((r) => r.path === '/admin/alerts/ack' && r.method === 'POST')).toBe(true);
  });

  for (const screen of mobileScreens.filter((screen) => screen.role && !['student-more'].includes(screen.slug))) {
    test(`${screen.slug} handles unavailable data without a false all-clear`, async ({ page }) => {
      await mobileSession(page, screen.role!, true);
      await page.goto(process.env.RESPONSIVE_MOBILE_URL + screen.path);
      // Scan has no read dependency; its request is tested through the manual validation control.
      if (screen.slug === 'student-scan') {
        await page.getByRole('button', { name: 'Enter code manually', exact: true }).click();
        await page.getByLabel('Anchor code', { exact: true }).fill('QR-UNKNOWN');
        await page.getByRole('button', { name: 'Validate code', exact: true }).click();
      }
      await expect(page.getByText('The campus service is temporarily unavailable.', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('No conditions to review', { exact: true })).toBeHidden();
      await expect(page.getByText('No unacknowledged alerts', { exact: true })).toBeHidden();
    });
  }
  test('staff identity verification renders the returned record', async ({ page }) => {
    const requests = await mobileSession(page, 'staff');
    await page.goto(process.env.RESPONSIVE_MOBILE_URL + '/staff/desk');
    await page.getByLabel('Student registration number', { exact: true }).fill('STU-001');
    await page.getByRole('button', { name: 'Look up', exact: true }).click();
    await expect(page.getByText('Campus record found · active', { exact: true })).toBeVisible();
    expect(requests.some((r) => r.path === '/staff/students/STU-001')).toBe(true);
  });

  test('a delayed room search cannot overwrite a newer result', async ({ page }) => {
    await mobileSession(page, 'student');
    let finishOld!: () => Promise<void>;
    await page.route('**/api/v1/campus/rooms?**', async (route) => {
      if (new URL(route.request().url()).searchParams.get('q') === 'old') {
        finishOld = async () => { await route.fulfill({ json: { success: true, data: { items: [{ id: 'old', code: 'OLD', name: 'Outdated result' }] } } }); };
      } else await route.fulfill({ json: { success: true, data: { items: [{ id: 'new', code: 'NEW', name: 'Current result' }] } } });
    });
    await page.goto(process.env.RESPONSIVE_MOBILE_URL + '/student/map');
    const search = page.getByLabel('Search rooms', { exact: true });
    await search.fill('old');
    await expect.poll(() => Boolean(finishOld)).toBe(true);
    await search.fill('new');
    await expect(page.getByText('NEW · Current result', { exact: true })).toBeVisible();
    await finishOld();
    await expect(page.getByText('OLD · Outdated result', { exact: true })).toBeHidden();
    await expect(page.getByText('NEW · Current result', { exact: true })).toBeVisible();
  });

  for (const preference of ['reduce', 'no-preference'] as const) {
    test(`tab navigation honours ${preference} motion preference`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: preference });
      await mobileSession(page, 'student');
      await page.addInitScript(() => {
        const samples: number[] = [];
        Object.assign(window, { motionSamples: samples });
        function measure() {
          document.querySelectorAll('[data-testid="screen-entrance"]').forEach((node) => {
            const style = getComputedStyle(node);
            if (node.getBoundingClientRect().height > 0) samples.push(Number(style.opacity));
          });
          requestAnimationFrame(measure);
        }
        requestAnimationFrame(measure);
      });
      await page.goto(process.env.RESPONSIVE_MOBILE_URL + '/student/more');
      await expect(page.getByText('A little more, for you.', { exact: true })).toBeVisible();
      await page.getByText('Map', { exact: true }).last().click();
      await expect(page.getByText('Your next place, found.', { exact: true })).toBeVisible();
      await expect(page.getByTestId('screen-entrance').filter({ visible: true }).last()).toHaveCSS('opacity', '1');
      const samples = await page.evaluate(() => (window as unknown as { motionSamples: number[] }).motionSamples);
      expect(samples.length).toBeGreaterThan(0);
      if (preference === 'reduce') expect(samples.every((value) => value === 1)).toBe(true);
      else expect(samples.some((value) => value > 0 && value < 1)).toBe(true);
    });
  }

});
