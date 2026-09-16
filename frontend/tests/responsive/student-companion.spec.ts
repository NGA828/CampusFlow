import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const screenDir = resolve(__dirname, '../../../.cache/companion-pass/screens');
import { companionSession, conversationId } from './student-companion-fixtures';

const cases = [
  { slug: 'queues', path: '/student/services/queues', title: 'Room queues', ready: 'Waiting for your turn.' },
  { slug: 'assistant', path: '/student/assistant', title: 'Campus assistant', ready: 'Where do we go from here?' },
  { slug: 'account', path: '/account', title: 'Your account', ready: 'Personal details' },
  { slug: 'notifications', path: '/notifications', title: 'Notifications', ready: 'Your room ticket has been called' },
];
for (const width of [320, 768, 1440]) for (const screen of cases) {
  test(`${screen.slug} has a purpose-built, contained layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await companionSession(page); await page.goto(screen.path);
    await expect(page.getByRole('heading', { name: screen.title, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: screen.ready, exact: true })).toBeVisible();
    if (screen.slug === 'assistant') await expect(page.getByRole('button', { name: 'Plan your day What’s on my timetable?' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    if (width === 320 && screen.slug === 'account') expect((await page.getByRole('heading', { name: 'Amina Yusuf', exact: true }).boundingBox())!.width).toBeGreaterThan(150);
    if (width === 320 && screen.slug === 'queues') expect((await page.getByRole('heading', { name: 'Learning commons', exact: true }).boundingBox())!.width).toBeGreaterThan(140);
    if (width === 320 && screen.slug === 'assistant') {
      expect((await page.getByRole('button', { name: 'Send question' }).boundingBox())!.height).toBeLessThanOrEqual(48);
      expect((await page.getByLabel('Your question', { exact: true }).boundingBox())!.y).toBeLessThan(900);
    }
    await page.evaluate(() => document.fonts.ready);
    mkdirSync(screenDir, { recursive: true });
    await page.screenshot({ path: `${screenDir}/${screen.slug}-${width}.png`, fullPage: true, animations: 'disabled' });
    expect(errors).toEqual([]);
  });
}
for (const role of ['staff', 'admin'] as const) for (const path of ['/account', '/notifications']) {
  test(`${role} can reach the genuine shared ${path} page without a student redirect`, async ({ page }) => {
    await companionSession(page, role); await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole('heading', { name: path === '/account' ? 'Your account' : 'Your updates', exact: true })).toBeVisible();
    if (path === '/account') {
      await expect(page.getByRole('heading', { name: 'Assigned scopes · 1' })).toBeVisible();
      await expect(page.getByText('Science & design', { exact: true })).toBeVisible();
      await page.getByText('Session permissions · 32', { exact: true }).click();
      await expect(page.getByText('fixture.permission.28', { exact: true })).toBeVisible();
    } else {
      await expect(page.getByRole('link', { name: 'Open queue board', exact: true })).toHaveAttribute('href', role === 'staff' ? '/staff/queues' : '/admin/services');
      await expect(page.getByRole('region', { name: 'Notification inbox' }).locator('a[href^="/student/"]')).toHaveCount(0);
    }
  });
}

test('profile updates use the confirmed response without a fragile second principal read', async ({ page }) => {
  const state = await companionSession(page);
  let reads = 0;
  await page.route('**/api/v1/me', route => {
    if (route.request().method() === 'GET' && ++reads > 1) return route.fulfill({ status: 503, json: { success: false, message: 'Profile refresh unavailable.' } });
    return route.fallback();
  });
  await page.goto('/account'); await page.getByLabel('Full name', { exact: true }).fill('Amina Yusuf Nkolo');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'profile changes have been saved' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Amina Yusuf Nkolo' })).toBeVisible();
  expect(reads).toBe(1);
  expect(state.requests.find(r => r.method === 'PATCH' && r.path === '/me')?.body).toMatchObject({ name: 'Amina Yusuf Nkolo', phone: '+237 6 00 00 00 00', department: 'Computer Science' });
});

test('rejected profile save retains edits, never registers a simulated push device', async ({ page }) => {
  const state = await companionSession(page);
  await page.route('**/api/v1/me', route => route.request().method() === 'PATCH' ? route.fulfill({ status: 422, json: { success: false, message: 'This name is not accepted.' } }) : route.fallback());
  await page.goto('/account'); await page.getByLabel('Full name', { exact: true }).fill('Retain this draft');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: /.+/ })).toContainText('This name is not accepted.');
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Retain this draft');
  await expect(page.getByText('Your profile changes have been saved.')).toBeHidden();
  await page.getByText('Notifications on this browser', { exact: true }).click();
  await expect(page.getByText(/Browser push delivery is not currently configured/)).toBeVisible();
  expect(state.requests.some(r => r.path === '/me/devices')).toBe(false);
});

async function fillPassword(page: Page, confirm = 'newpass8') {
  await page.getByLabel('Current password', { exact: true }).fill('current-secret');
  await page.getByLabel('New password', { exact: true }).fill('newpass8');
  await page.getByLabel('Confirm new password', { exact: true }).fill(confirm);
}
test('eight-character password change sends confirmation and ends this session', async ({ page }) => {
  const state = await companionSession(page); await page.goto('/account'); await fillPassword(page);
  await page.getByRole('button', { name: 'Change password & sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(state.requests.find(r => r.path === '/auth/password')?.body).toEqual({ current_password: 'current-secret', password: 'newpass8', password_confirmation: 'newpass8' });
  expect(await page.evaluate(() => localStorage.getItem('campusflow.token'))).toBeNull();
});
test('password mismatch never sends and unconfirmed success never logs out', async ({ page }) => {
  const state = await companionSession(page); await page.goto('/account'); await fillPassword(page, 'mismatch');
  await page.getByRole('button', { name: 'Change password & sign out' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /.+/ })).toContainText('do not match');
  expect(state.requests.some(r => r.path === '/auth/password')).toBe(false);
  await page.getByLabel('Confirm new password', { exact: true }).fill('newpass8');
  await page.route('**/api/v1/auth/password', route => route.fulfill({ json: { success: true, data: { changed: false } } }));
  await page.getByRole('button', { name: 'Change password & sign out' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /.+/ })).toContainText('did not confirm');
  await expect(page).toHaveURL(/\/account$/);
  expect(state.requests.some(r => r.path === '/auth/logout')).toBe(false);
});

test('notification read failures preserve unread and pending controls serialize mutations', async ({ page }) => {
  const state = await companionSession(page);
  let release = () => {}; const gate = new Promise<void>(resolve => { release = resolve; }); let calls = 0;
  await page.route('**/api/v1/me/notifications/n1/read', async route => { calls++; await gate; return route.fulfill({ status: 503, json: { success: false, message: 'Read status was not saved.' } }); });
  await page.goto('/notifications');
  const read = page.getByRole('button', { name: 'Mark Your room ticket has been called as read' });
  await read.evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click(); });
  await expect(page.getByRole('button', { name: 'Mark all as read', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Refresh inbox' })).toBeDisabled();
  release(); await expect(page.getByRole('alert').filter({ hasText: /.+/ })).toContainText('Read status was not saved.');
  await expect(page.getByText('2 unread overall', { exact: true })).toBeVisible(); expect(calls).toBe(1);
  expect(state.notifications[0].read_at).toBeNull();
});

test('notification pagination uses actual metadata; global read applies beyond this page', async ({ page }) => {
  const state = await companionSession(page);
  state.notifications.push(...Array.from({ length: 20 }, (_, index) => ({ ...state.notifications[0], id: `extra-${index}`, title: `Additional update ${index}` })));
  await page.goto('/notifications'); await expect(page.getByText('Page 1 of 2 · 24 total')).toBeVisible();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText('Page 2 of 2 · 24 total')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Additional update 19', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mark all as read', exact: true }).click();
  await expect(page.getByText('0 unread overall')).toBeVisible(); expect(state.notifications.filter(n => !n.read_at)).toHaveLength(0);
  await page.getByRole('button', { name: 'Previous page' }).click();
  await page.getByRole('button', { name: 'Unread on this page' }).click();
  await expect(page.getByRole('heading', { name: 'No unread updates on this page' })).toBeVisible();
});

test('notification initial failure is not an empty success and has a real retry', async ({ page }) => {
  await companionSession(page); let failed = true;
  await page.route('**/api/v1/me/notifications?*', route => failed ? route.fulfill({ status: 503, json: { success: false, message: 'Inbox is unavailable.' } }) : route.fallback());
  await page.goto('/notifications'); await expect(page.getByRole('alert').filter({ hasText: /.+/ })).toContainText('Inbox is unavailable.');
  await expect(page.getByRole('heading', { name: 'No notifications yet' })).toBeHidden();
  failed = false; await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your room ticket has been called' })).toBeVisible();
});

test('notification search is local, unknown types remain readable and no navigation link is dead', async ({ page }) => {
  const state = await companionSession(page);
  state.notifications.push({ ...state.notifications[0], id: 'unknown', type: 'unknown.message', title: 'A custom campus update' }, { ...state.notifications[0], id: 'route', type: 'navigation.started', title: 'Route session started' });
  await page.goto('/notifications'); await expect(page.getByRole('link', { name: 'Open campus map' })).toHaveAttribute('href', '/student/campus/map');
  await page.getByLabel('Search this notification page').fill('custom');
  await expect(page.getByRole('heading', { name: 'A custom campus update' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Notification inbox' }).getByRole('link')).toHaveCount(0);
});

test('raw active queue ticket is hydrated and server web capabilities gate arrival actions', async ({ page }) => {
  const state = await companionSession(page); state.ticket.ticket.status = 'called'; state.ticket.people_ahead = 0;
  await page.goto('/student/services/queues'); await expect(page.getByText('B-024', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your number has been called.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check in', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'I’m on my way' })).toBeHidden();
  expect(state.requests.some(r => r.path === '/student/queue-tickets/t1')).toBe(true);
  await expect(page.getByText('You are next', { exact: false })).toBeHidden();
});

test('queue cancellation failure keeps ticket; confirmed cancellation becomes receipt and allows another join', async ({ page }) => {
  await companionSession(page); let reject = true;
  await page.route('**/api/v1/student/queue-tickets/t1/cancel', route => reject ? route.fulfill({ status: 409, json: { success: false, message: 'Ticket changed. Refresh and retry.' } }) : route.fallback());
  await page.goto('/student/services/queues'); await page.getByRole('button', { name: 'Cancel ticket', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: /.+/ })).toContainText('Ticket changed.');
  await expect(page.getByRole('heading', { name: 'Waiting for your turn.' })).toBeVisible();
  reject = false; await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'This ticket was cancelled.' })).toBeVisible();
  await expect(page.getByText('Estimated wait', { exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Join queue · A101', exact: true }).click();
  await expect(page.getByText('A-012', { exact: true })).toBeVisible();
});

test('ambiguous queue join retries reuse idempotency and consume direct view/replay', async ({ page }) => {
  const state = await companionSession(page); state.active = false; state.queues[0].my_ticket_id = null;
  const keys: string[] = []; let fail = true;
  await page.route('**/api/v1/student/queues/q2/tickets', route => {
    const body = route.request().postDataJSON(); keys.push(body.idempotency_key);
    expect(route.request().headers()['idempotency-key']).toBe(body.idempotency_key);
    if (fail) { fail = false; return route.fulfill({ status: 503, json: { success: false, message: 'Ticket result is temporarily unavailable.' } }); }
    return route.fallback();
  });
  await page.goto('/student/services/queues'); await page.getByRole('button', { name: 'Join queue · A101', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: /.+/ })).toContainText('temporarily unavailable');
  await page.getByRole('button', { name: 'Join queue · A101', exact: true }).click();
  await expect(page.getByText('A-012', { exact: true })).toBeVisible();
  expect(keys.length).toBe(2); expect(keys[0]).toBe(keys[1]); expect(keys[0].length).toBeGreaterThan(8);
});

test('denied required location never sends a queue request or an invented fix', async ({ page }) => {
  const state = await companionSession(page); state.active = false; state.queues[0].my_ticket_id = null;
  await page.addInitScript(() => Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: (_ok: unknown, fail: (error: unknown) => void) => fail({ code: 1 }) } }));
  await page.goto('/student/services/queues'); await page.getByRole('button', { name: 'Use location & join · B204' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /.+/ })).toContainText('Location could not be obtained');
  expect(state.requests.filter(r => r.path.endsWith('/tickets') && r.method === 'POST')).toHaveLength(0);
});

test('positive arrival capability sends consented location and serializes ticket controls', async ({ page }) => {
  const state = await companionSession(page); state.ticket.can_check_in = true; state.ticket.ticket.status = 'called';
  await page.addInitScript(() => Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: (ok: (position: unknown) => void) => ok({ coords: { latitude: 3.86, longitude: 11.51, accuracy: 9 } }) } }));
  let release = () => {}; const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/student/queue-tickets/t1/check-in', async route => { await gate; return route.fallback(); });
  await page.goto('/student/services/queues'); await page.getByRole('button', { name: 'Use location & check in' }).click();
  await expect(page.getByRole('button', { name: 'Cancel ticket', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Join queue · A101', exact: true })).toBeDisabled();
  release(); await expect(page.getByRole('heading', { name: 'Your arrival is confirmed.' })).toBeVisible();
  expect(state.requests.find(r => r.path.endsWith('/check-in'))?.body).toEqual({ fix: { lat: 3.86, lng: 11.51, accuracy_m: 9, source: 'gps' } });
});

test('a late initial active read cannot erase a newly confirmed ticket', async ({ page }) => {
  await companionSession(page); let release = () => {}; const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/student/queue-tickets/active', async route => { await gate; return route.fulfill({ json: { success: true, data: { ticket: null } } }); });
  await page.goto('/student/services/queues'); await page.getByRole('button', { name: 'Join queue · A101', exact: true }).click();
  await expect(page.getByText('A-012', { exact: true })).toBeVisible(); release();
  await expect(page.getByRole('heading', { name: 'Waiting for your turn.' })).toBeVisible();
  await expect(page.getByText('A-012', { exact: true })).toBeVisible();
});

test('queue read failure, empty board and full capacity do not masquerade as joinable', async ({ page }) => {
  const state = await companionSession(page); state.active = false; state.queues[1].max_capacity = 3;
  await page.goto('/student/services/queues'); await expect(page.getByRole('button', { name: 'Join queue · A101', exact: true })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'No active room ticket' })).toBeVisible();
  await page.route('**/api/v1/student/queues/board', route => route.fulfill({ status: 503, json: { success: false, message: 'Board unavailable.' } }));
  await page.getByRole('button', { name: 'Refresh board' }).click(); await expect(page.getByRole('alert').filter({ hasText: /.+/ })).toContainText('Board unavailable.');
  await expect(page.getByRole('heading', { name: 'No room queues available' })).toBeHidden();
  await page.unroute('**/api/v1/student/queues/board'); state.queues = [];
  await page.getByRole('button', { name: 'Try again', exact: true }).click(); await expect(page.getByRole('heading', { name: 'No room queues available' })).toBeVisible();
});

test('assistant opens actual nested history and retains every metadata field', async ({ page }) => {
  await companionSession(page); await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/student/assistant'); await page.getByRole('button', { name: /Planning my campus morning/ }).click();
  await expect(page.getByRole('log')).toContainText('The interaction design studio has 3 students waiting.');
  await page.getByRole('log').getByText('Response details', { exact: true }).last().click();
  await expect(page.getByRole('log').getByText('authorized', { exact: true })).toBeVisible();
  await expect(page.getByRole('log').getByText('true', { exact: true })).toBeVisible();
});

test('assistant preserves failed draft, new conversation carries it without mixing a late response', async ({ page }) => {
  const state = await companionSession(page); let release = () => {}; const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/ai/chat', async route => { await gate; return route.fulfill({ status: 503, json: { success: false, message: 'The assistant is temporarily unavailable.' } }); });
  await page.goto('/student/assistant'); await page.getByLabel('Your question', { exact: true }).fill('Help me with my timetable');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByRole('button', { name: '+ New conversation', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Planning my campus morning/ })).toBeDisabled();
  release(); await expect(page.getByRole('alert').filter({ hasText: /.+/ })).toContainText('Your draft is kept.');
  await expect(page.getByLabel('Your question', { exact: true })).toHaveValue('Help me with my timetable');
  await expect(page.getByRole('log')).not.toContainText('Sending your message');
  await page.getByRole('button', { name: '+ New conversation', exact: true }).click();
  await expect(page.getByLabel('Your question', { exact: true })).toHaveValue('Help me with my timetable');
  expect(state.requests.filter(r => r.path === '/ai/chat')).toHaveLength(0); // rejected by the failure override, not auto-retried
});

test('assistant suggested actions use canonical web routes and reject unsafe/platform-mismatched links', async ({ page }) => {
  const state = await companionSession(page);
  await page.route('**/api/v1/ai/chat', route => route.fulfill({ json: { success: true, data: { conversation_id: conversationId, message: state.conversations[0].messages[1], suggested_actions: [{ label: 'Queue board', href: '/student/queues' }, { label: 'Office services', href: '/student/offices' }, { label: 'Bad action', href: 'javascript:alert(1)' }, { label: 'Other workspace', href: '/admin/users' }, { label: 'Mobile navigation', href: '/navigate/B204' }, { label: 'External action', href: '//evil.invalid' }] } } }));
  await page.goto('/student/assistant'); await page.getByLabel('Your question', { exact: true }).fill('How busy are the room queues?'); await page.getByRole('button', { name: 'Send question' }).click();
  const log = page.getByRole('log');
  await expect(log.getByRole('link', { name: 'Queue board', exact: true })).toHaveAttribute('href', '/student/services/queues');
  await expect(log.getByRole('link', { name: 'Office services', exact: true })).toHaveAttribute('href', '/student/services/offices');
  await expect(log.getByRole('link')).toHaveCount(2);
  await expect(log.getByText('Some suggested actions are not available in this web workspace.')).toBeVisible();
  await expect(page.getByLabel('Your question', { exact: true })).toHaveValue('');
});

test('assistant opening locks send/new, deletion is deliberate and confirmed', async ({ page }) => {
  const state = await companionSession(page); let release = () => {}; const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/v1/ai/conversations/${conversationId}`, async route => { if (route.request().method() === 'GET') await gate; return route.fallback(); });
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/student/assistant');
  await page.getByRole('button', { name: /Planning my campus morning/ }).click();
  await expect(page.getByText('Opening conversation…')).toBeVisible();
  await expect(page.getByRole('button', { name: '+ New conversation', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Your question', { exact: true })).toBeDisabled();
  release(); await expect(page.getByRole('button', { name: 'Delete conversation', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete conversation', exact: true }).click();
  expect(state.requests.some(r => r.method === 'DELETE')).toBe(false);
  await page.getByRole('button', { name: 'Keep conversation' }).click();
  await page.getByRole('button', { name: 'Delete conversation', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm deletion' }).click();
  await expect(page.getByRole('heading', { name: 'Where do we go from here?' })).toBeVisible(); expect(state.conversations).toHaveLength(0);
});

test('assistant starter prompts follow server capabilities; mobile library is collapsible', async ({ page }) => {
  const state = await companionSession(page); state.capabilities.tools = [state.capabilities.tools[0]];
  await page.setViewportSize({ width: 320, height: 900 }); await page.goto('/student/assistant');
  await expect(page.getByRole('button', { name: 'Plan your day What’s on my timetable?' })).toBeVisible();
  await expect(page.getByRole('button', { name: /How busy are the room queues/ })).toBeHidden();
  await expect(page.getByRole('button', { name: /Planning my campus morning/ })).toBeHidden();
  await page.getByText('Recent conversations', { exact: true }).click();
  await expect(page.getByRole('button', { name: /Planning my campus morning/ })).toBeVisible();
  await page.getByText('Recent conversations', { exact: true }).click();
  await page.getByRole('button', { name: 'Plan your day What’s on my timetable?' }).click();
  await expect(page.getByLabel('Your question', { exact: true })).toHaveValue('What is on my timetable?');
  expect(state.requests.some(r => r.path === '/ai/chat')).toBe(false);
});

test('empty notifications and assistant library have truthful states', async ({ page }) => {
  const state = await companionSession(page); state.notifications = []; state.conversations = [];
  await page.goto('/notifications'); await expect(page.getByRole('heading', { name: 'No notifications yet' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark all as read', exact: true })).toBeDisabled();
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/student/assistant'); await page.getByText('Recent conversations', { exact: true }).click();
  await expect(page.getByText('No saved conversations yet. Your first successful exchange will appear here.')).toBeVisible();
});

test('incomplete queue replies and assistant replies never become confirmed success', async ({ page }) => {
  const state = await companionSession(page); state.active = false;
  await page.route('**/api/v1/student/queues/q2/tickets', route => route.fulfill({ json: { success: true, data: { ticket: { id: 'incomplete' } } } }));
  await page.goto('/student/services/queues'); await page.getByRole('button', { name: 'Join queue · A101', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: /.+/ })).toContainText('did not confirm a complete queue ticket');
  await expect(page.getByText('Your ticket is confirmed.', { exact: false })).toBeHidden();
  await page.route('**/api/v1/ai/chat', route => route.fulfill({ json: { success: true, data: { conversation_id: conversationId } } }));
  await page.goto('/student/assistant'); await page.getByLabel('Your question', { exact: true }).fill('My timetable'); await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /.+/ })).toContainText('response was incomplete');
  await expect(page.getByLabel('Your question', { exact: true })).toHaveValue('My timetable');
});

test('confirmed notification reads update the shell badge without navigation', async ({ page }) => {
  await companionSession(page); await page.goto('/notifications');
  const bell = page.getByRole('button', { name: 'Notifications', exact: true });
  await expect(bell.locator('span')).toHaveText('2');
  await page.getByRole('button', { name: 'Mark all as read', exact: true }).click();
  await expect(page.getByText('0 unread overall')).toBeVisible();
  await expect(bell.locator('span')).toHaveCount(0);
});

test('pending profile save locks both security and identity forms', async ({ page }) => {
  await companionSession(page); let release = () => {}; const gate = new Promise<void>(resolve => { release = resolve; }); let calls = 0;
  await page.route('**/api/v1/me', async route => {
    if (route.request().method() === 'PATCH') { calls++; await gate; }
    return route.fallback();
  });
  await page.goto('/account'); await page.getByLabel('Full name', { exact: true }).fill('Amina N. Yusuf');
  const save = page.getByRole('button', { name: 'Save changes', exact: true });
  await save.evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click(); });
  await expect(page.getByLabel('Full name', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Current password', { exact: true })).toBeDisabled();
  release(); await expect(page.getByRole('heading', { name: 'Amina N. Yusuf', exact: true })).toBeVisible(); expect(calls).toBe(1);
});

test('assistant library/tool failures remain independent of the composer', async ({ page }) => {
  await companionSession(page); await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route('**/api/v1/ai/conversations', route => route.fulfill({ status: 503, json: { success: false, message: 'Conversation library unavailable.' } }));
  await page.route('**/api/v1/ai/capabilities', route => route.fulfill({ status: 503, json: { success: false, message: 'Tool registry unavailable.' } }));
  await page.goto('/student/assistant');
  await expect(page.getByRole('alert').filter({ hasText: 'Conversation library unavailable.' })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'Tool registry unavailable.' })).toBeVisible();
  await expect(page.getByText('No saved conversations yet.', { exact: false })).toBeHidden();
  await page.getByLabel('Your question', { exact: true }).fill('What is on my timetable?');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByRole('log')).toContainText('The interaction design studio has 3 students waiting.');
});

test('long assistant data stays complete and contained on a narrow screen', async ({ page }) => {
  const state = await companionSession(page); await page.setViewportSize({ width: 320, height: 1000 });
  await page.route('**/api/v1/ai/chat', route => route.fulfill({ json: { success: true, data: { conversation_id: conversationId, message: { ...state.conversations[0].messages[1], data: { ...Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`field_${index}`, `Campus detail ${index}`])), final_field: 'A'.repeat(250) } } } } }));
  await page.goto('/student/assistant'); await page.getByLabel('Your question', { exact: true }).fill('Describe the campus'); await page.getByRole('button', { name: 'Send question' }).click();
  await page.getByRole('log').getByText('Returned campus data', { exact: true }).click();
  await expect(page.getByRole('log').getByText('final field', { exact: true })).toBeVisible();
  await expect(page.getByRole('log').getByText('Campus detail 7', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});

test('ticket loading, read failure and independent history failure are not empty receipts', async ({ page }) => {
  await companionSession(page); let release = () => {}; const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/student/queue-tickets/active', async route => { await gate; return route.fulfill({ status: 503, json: { success: false, message: 'Active ticket unavailable.' } }); });
  await page.goto('/student/services/queues');
  await expect(page.getByRole('complementary', { name: 'Your ticket' })).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('heading', { name: 'No active room ticket' })).toBeHidden();
  release(); await expect(page.getByRole('alert').filter({ hasText: 'Active ticket unavailable.' })).toBeVisible();
  await page.route('**/api/v1/student/queue-tickets/t1/history', route => route.fulfill({ status: 503, json: { success: false, message: 'Ticket history unavailable.' } }));
  await page.getByRole('button', { name: 'View ticket · B204', exact: true }).click();
  await expect(page.getByText('B-024', { exact: true })).toBeVisible();
  await page.getByText('Ticket history', { exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Ticket history unavailable.' })).toBeVisible();
  await expect(page.getByText('No history events were returned for this ticket.')).toBeHidden();
});

test('account respects platform-filtered session permissions across a confirmed profile update', async ({ page }) => {
  const state = await companionSession(page);
  await page.route('**/api/v1/me', route => route.request().method() === 'GET' ? route.fulfill({ json: { success: true, data: { user: state.user, assignments: [], platform: 'web', permissions: ['campus.read'] } } }) : route.fallback());
  await page.goto('/account'); await page.getByText('Session permissions · 1', { exact: true }).click();
  await expect(page.getByText('campus.read', { exact: true })).toBeVisible();
  await expect(page.getByText('fixture.permission.28', { exact: true })).toBeHidden();
  await page.getByLabel('Full name', { exact: true }).fill('Amina N. Yusuf');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Amina N. Yusuf', exact: true })).toBeVisible();
  await expect(page.getByText('Session permissions · 1', { exact: true })).toBeVisible();
});
