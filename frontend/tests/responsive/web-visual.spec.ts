import { test, expect } from '@playwright/test';
import { webSession } from './web-visual-fixtures';

const screens = [
  { name: 'login', path: '/login', role: null, ready: 'Welcome back.' },
  { name: 'student-dashboard', path: '/student/dashboard', role: 'student', ready: 'Today’s agenda' },
  { name: 'student-map', path: '/student/campus/map', role: 'student', ready: 'Learning centre' },
  { name: 'student-queues', path: '/student/services/queues', role: 'student', ready: 'B-024' },
  { name: 'student-offices', path: '/student/services/offices', role: 'student', ready: 'Student affairs' },
  { name: 'student-assistant', path: '/student/assistant', role: 'student', ready: 'Where do we go from here?' },
  { name: 'student-timetable', path: '/student/timetable', role: 'student', ready: 'CS204' },
  { name: 'staff-dashboard', path: '/staff/dashboard', role: 'staff', ready: 'People first. One next step at a time.' },
  { name: 'admin-dashboard', path: '/admin/dashboard', role: 'admin', ready: 'The infrastructure behind the day.' },
  { name: 'admin-alerts', path: '/admin/alerts', role: 'admin', ready: 'A queue needs attention' },
  { name: 'admin-users', path: '/admin/users', role: 'admin', ready: 'nadia' },
  { name: 'notifications', path: '/notifications', role: 'student', ready: 'Your campus day is ready' },
] as const;

test.describe('Web workspace redesign', () => {
  for (const width of [320, 768, 1440]) for (const screen of screens) {
    test(`${screen.name} at ${width}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 900 });
      if (screen.role) await webSession(page, screen.role);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(screen.path);
      await expect(page.locator('main h1')).toBeVisible();
      if (screen.name === 'admin-users') await expect(page.getByRole('table')).toContainText('Nadia Mensah');
      else await expect(page.getByText(screen.ready, { exact: false }).first()).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await page.evaluate(() => document.fonts.ready);
      if (screen.name === 'student-assistant' && width === 1440) {
        const composer = await page.getByLabel('Your question', { exact: true }).boundingBox();
        expect(composer).not.toBeNull();
        expect(composer!.y + composer!.height).toBeLessThanOrEqual(1000);
      }
      if (width === 1440 || width === 320) await page.screenshot({ path: testInfo.outputPath(`${screen.name}-${width}.png`) });
      expect(errors).toEqual([]);
    });
  }

  test('login exposes passwords on request and reports API rejection', async ({ page }) => {
    await page.goto('/login');
    await page.getByText('Explore with a demo account', { exact: true }).click();
    await page.getByRole('button', { name: 'Use Student demo account', exact: true }).click();
    await expect(page.getByLabel('Email address')).toHaveValue('student@campusflow.edu');
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Show password', exact: true }).click();
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
    await page.route('**/api/v1/auth/login', (route) => route.fulfill({ status: 401, json: { success: false, message: 'These credentials are not valid.' } }));
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'These credentials' })).toContainText('These credentials are not valid.');
    await expect(page).toHaveURL(/login/);
  });

  test('severity filtering and acknowledgement keep the server in charge', async ({ page }) => {
    await webSession(page, 'admin');
    await page.goto('/admin/alerts');
    await page.getByRole('button', { name: /^Critical/ }).click();
    await expect(page.getByText('A queue needs attention', { exact: true })).toBeVisible();
    await expect(page.getByText('An anchor needs verification', { exact: true })).toBeHidden();
    await page.getByLabel('Acknowledgement note for A queue needs attention').fill('Reviewed by the service team.');
    await page.getByRole('button', { name: 'Mute this condition', exact: true }).click();
    await expect(page.getByText('No critical conditions', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^Warning/ }).click();
    await expect(page.getByText('An anchor needs verification', { exact: true })).toBeVisible();
  });

  test('a failed notification read never clears the unread state', async ({ page }) => {
    await webSession(page, 'student');
    await page.route('**/api/v1/me/notifications/read-all', (route) => route.fulfill({ status: 503, json: { success: false, message: 'Please try again.' } }));
    await page.goto('/student/dashboard');
    await page.getByRole('button', { name: 'Notifications', exact: true }).click();
    await page.getByRole('button', { name: 'Mark all read', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Could not mark' })).toContainText('Could not mark notifications as read.');
    await expect(page.getByRole('button', { name: 'Mark all read', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('region', { name: 'Recent notifications' })).toBeHidden();
  });

  for (const role of ['student', 'staff', 'admin'] as const) {
    test(`${role} dashboard failure remains an error, not a zero-data success`, async ({ page }) => {
      await webSession(page, role, true);
      await page.goto(`/${role}/dashboard`);
      await expect(page.getByText('The campus service is temporarily unavailable.', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /Retry|Try again/ }).first()).toBeVisible();
      await expect(page.locator('[data-ui="stat"]')).toHaveCount(0);
    });
  }

  test('workspace animation honours reduced motion', async ({ page }) => {
    await webSession(page, 'admin');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/admin/dashboard');
    await expect(page.getByText('The infrastructure behind the day.', { exact: true })).toBeVisible();
    expect(await page.locator('main > div').evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
  });
  test('map links preserve the requested destination and reject incomplete routes', async ({ page }) => {
    await webSession(page, 'student');
    await page.goto('/student/campus/map?route=B204');
    await page.getByRole('link', { name: 'Plan a route →', exact: true }).click();
    await expect(page.getByLabel('Destination room code')).toHaveValue('B204');
    await page.getByLabel('Starting anchor').selectOption('node1');
    await page.route('**/api/v1/campus/navigation/route', (route) => route.fulfill({ json: { success: true, data: { route: { nodes: [], edges: [], total_distance_m: 0 }, destination_label: 'B204' } } }));
    await page.getByRole('button', { name: 'Preview route', exact: true }).click();
    await expect(page.getByText('The navigation service returned an incomplete route.', { exact: false })).toBeVisible();
    await expect(page.getByText('Route type', { exact: true })).toBeHidden();
  });

  test('web route preview starts at an explicitly shared browser location and draws the snap to the walking path', async ({ page }) => {
    await webSession(page, 'student');
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: 3.86305, longitude: 11.51205 });
    let submitted: Record<string, unknown> | null = null;
    const start = { id: 'origin-node', label: 'Learning centre entrance', type: 'entrance', building_id: 'b1', floor_id: null, lat: 3.863, lng: 11.512, plan_x: null, plan_y: null };
    const destination = { id: 'destination-node', label: 'Science entrance', type: 'entrance', building_id: 'b2', floor_id: null, lat: 3.864, lng: 11.514, plan_x: null, plan_y: null };
    await page.route('**/api/v1/campus/navigation/route', async (request) => {
      submitted = request.request().postDataJSON();
      await request.fulfill({ json: { success: true, data: { route: {
        nodes: [start, destination],
        steps: [
          { index: 0, node_id: start.id, instruction: 'Start at the Learning centre entrance', kind: 'start', distance_m: 0, floor_id: null },
          { index: 1, node_id: destination.id, instruction: 'Arrive at the Science entrance', kind: 'arrive', distance_m: 80, floor_id: null },
        ],
        legs: [{ floor_id: null, floor_name: 'Campus grounds', floor_level: 0, building_code: null, distance_m: 80, duration_s: 67, points: [], geo: [{ lat: 3.863, lng: 11.512 }, { lat: 3.864, lng: 11.514 }] }],
        transitions: [], distance_m: 80, duration_s: 67, accessible: false, uses_stairs: false,
        origin: { label: start.label, node: start }, destination: { label: destination.label, node: destination },
      }, destination_label: destination.label } } });
    });

    await page.goto('/student/campus/map?route=B204');
    await page.getByRole('link', { name: 'Plan a route →', exact: true }).click();
    await page.getByRole('button', { name: 'Use my current location', exact: true }).click();
    await expect(page.getByText(/Using one-time browser fix/)).toBeVisible();
    await page.getByLabel('Destination room code').fill('B204');
    await page.getByRole('button', { name: 'Preview route', exact: true }).click();

    await expect(page.getByTestId('outdoor-route')).toBeVisible();
    await expect(page.getByTestId('route-origin-snap')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Your current location' })).toBeVisible();
    expect(submitted).toMatchObject({ from_lat: 3.86305, from_lng: 11.51205, to_room_code: 'B204' });
  });

  test('outdoor-only route previews render instead of waiting for an indoor plan', async ({ page }) => {
    await webSession(page, 'student');
    await page.goto('/student/campus/map?route=B204');
    await page.getByLabel('Starting anchor').selectOption('node1');
    await page.route('**/api/v1/campus/navigation/route', (route) => route.fulfill({ json: { success: true, data: { route: {
      nodes: [], steps: [], transitions: [], origin: { label: 'Learning centre entrance' }, destination: { label: 'Science entrance' }, accessible: true, uses_stairs: false, distance_m: 80, duration_s: 90,
      legs: [{ floor_id: null, distance_m: 80, points: [], geo: [{ lat: 3.863, lng: 11.512 }, { lat: 3.864, lng: 11.514 }] }],
    }, destination_label: 'Science entrance' } } }));
    await page.getByRole('button', { name: 'Preview route', exact: true }).click();
    await expect(page.getByText('Science entrance', { exact: true })).toBeVisible();
    await expect(page.getByText('Step-free', { exact: true })).toBeVisible();
  });

  test('an unconfigured building shows an empty state, not a perpetual skeleton', async ({ page }) => {
    await webSession(page, 'student');
    await page.goto('/student/campus/map');
    await page.getByRole('button', { name: 'Explore floors & rooms', exact: true }).press('Enter');
    await expect(page.getByText('No indoor floors published', { exact: true })).toBeVisible();
  });

});
