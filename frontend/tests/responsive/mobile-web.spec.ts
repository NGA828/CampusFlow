import { test, expect } from '@playwright/test';

// Optional second client. Export Expo with EXPO_PUBLIC_API_URL=/api/v1, then serve its dist folder.
// This exercises React Native Web layout; it does NOT emulate native keyboards, safe areas or cameras.
test.describe('Expo rendered layout', () => {
  test.skip(!process.env.RESPONSIVE_MOBILE_URL, 'Set RESPONSIVE_MOBILE_URL to the served Expo web export.');
  for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [844, 390], [1280, 800]]) {
    test(`auth and student cards at ${width}×${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const base = process.env.RESPONSIVE_MOBILE_URL!;
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const assertFit = async () => {
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
        // ScrollView overflow doesn't necessarily propagate to the document on React Native Web.
        const clipped = await page.locator('[role="button"]').evaluateAll((elements) => elements.filter((el) => {
          const box = el.getBoundingClientRect();
          return box.width > 0 && (box.left < -1 || box.right > innerWidth + 1);
        }).length);
        expect(clipped).toBe(0);
      };
      await page.goto(`${base}/login`);
      await expect(page.getByLabel('Email address')).toBeVisible();
      await assertFit();
      await page.getByRole('button', { name: 'Demo accounts', exact: true }).click();
      const demo = page.getByRole('button', { name: 'Student · student@campusflow.edu' });
      await demo.scrollIntoViewIfNeeded();
      await expect(demo).toBeInViewport();
      expect((await demo.boundingBox())!.height).toBeGreaterThanOrEqual(48);
      await page.goto(`${base}/register`);
      await expect(page.getByLabel('Full name')).toBeVisible();
      await assertFit();
      const register = page.getByRole('button', { name: 'Create account', exact: true });
      await register.scrollIntoViewIfNeeded();
      await expect(register).toBeInViewport();

      const user = { id: 'layout', role_code: 'student', name: 'Alexandria VeryLongCampusDepartmentNameWithoutSpaces', email: 'layout@example.test', permissions: [] };
      await page.addInitScript(() => localStorage.setItem('campusflow.token', 'responsive-test-only'));
      await page.route('**/api/v1/**', async (route) => {
        const path = new URL(route.request().url()).pathname;
        let data: unknown;
        if (path === '/api/v1/me') data = { user, assignments: [] };
        else if (path === '/api/v1/student/dashboard') data = {
          user, today: { entries: [] }, next_class: {
            course_title: 'Responsive interfaces and inclusive campus systems', course_code: 'CS101',
            starts_at_iso: '2026-09-15T09:00:00Z', ends_at_iso: '2026-09-15T10:00:00Z', room_code: 'B204', minutes_until: 15,
          },
          unread_notifications: 12, building_alerts: [], announcements: [], events: [], position: null, queue_ticket: null, office_ticket: null,
        };
        else if (path === '/api/v1/student/queues/board') data = { queues: [] };
        else return route.fulfill({ status: 503, json: { success: false, message: 'Layout test: unavailable resource' } });
        await route.fulfill({ json: { success: true, data } });
      });
      await page.goto(`${base}/student`);
      await expect(page.getByText('Responsive interfaces and inclusive campus systems')).toBeVisible();
      await assertFit();
      await page.getByRole('button', { name: 'Navigate', exact: true }).scrollIntoViewIfNeeded();
      await expect(page.getByRole('button', { name: 'Navigate', exact: true })).toBeInViewport();
      await page.goto(`${base}/student/assistant`);
      await expect(page.getByLabel('Message', { exact: true })).toBeVisible();
      await assertFit();
      await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeInViewport();
      expect(errors).toEqual([]);
    });
  }
});
