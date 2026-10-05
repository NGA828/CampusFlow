/**
 * End-to-end smoke test for the student app.
 *
 * There is no Android or iOS toolchain in CI, so the app is exercised through its web
 * build: a real DOM, the real production bundle, the real API. It signs in, scans an
 * anchor, asks the server for a route and files a room request — the four things a
 * student actually does — and fails loudly if any of them stops working.
 *
 *   npm run build:web && npm run serve:web   # in one terminal
 *   npm run smoke:web                        # in another
 *
 * WebGL does not exist in jsdom, so the map is expected to fall back to its message;
 * that fallback is itself asserted, because a student with an old handset gets it too.
 */
import { JSDOM, VirtualConsole } from 'jsdom';

const APP = process.env.SMOKE_APP_URL ?? 'http://127.0.0.1:8081';
const API = process.env.SMOKE_API_URL ?? 'http://127.0.0.1:4000/api/v1';

const PURPOSE = 'Entretien de verification automatique CampusFlow';
const failures = [];
const log = (step, detail) => console.log(`  ${step}${detail ? ` — ${detail}` : ''}`);

function expect(label, condition, haystack = '') {
  if (condition) {
    log(`ok   ${label}`);
  } else {
    failures.push(label);
    log(`FAIL ${label}`, haystack.slice(0, 200));
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const html = await (await fetch(`${APP}/`)).text();
const bundlePath = html.match(/src="([^"]+index-[^"]+\.js)"/)?.[1];
if (!bundlePath) {
  console.error('No bundle found in index.html. Run: npm run build:web');
  process.exit(1);
}
const bundle = await (await fetch(APP + bundlePath)).text();

const dom = new JSDOM(html.replace(/<script[^>]*><\/script>/g, ''), {
  url: `${APP}/`,
  pretendToBeVisual: true,
  runScripts: 'outside-only',
  virtualConsole: new VirtualConsole(),
});
const { window } = dom;
const D = window.document;

// Browser capabilities jsdom does not implement. Each one stands in for a device
// that genuinely lacks it, so the app must cope with all of them.
window.fetch = (input, init) => fetch(String(input), init);
window.URL.createObjectURL = () => 'blob:stub';
window.URL.revokeObjectURL = () => {};
window.HTMLCanvasElement.prototype.getContext = () => null;
window.navigator.mediaDevices = { getUserMedia: async () => { throw new Error('no camera'); } };
window.navigator.geolocation = {
  getCurrentPosition: (_ok, fail) => fail?.({ code: 1, message: 'denied' }),
  watchPosition: (_ok, fail) => { fail?.({ code: 1, message: 'denied' }); return 1; },
  clearWatch: () => {},
};

const errors = [];
window.onerror = (message) => errors.push(String(message));
window.addEventListener('unhandledrejection', (event) => errors.push(`rejection: ${event.reason}`));

window.eval(bundle);

const text = () => (D.body.textContent || '').replace(/\s+/g, ' ');

async function press(label) {
  const target = [...D.querySelectorAll('[role="button"], [role="tab"], [tabindex]')].find((element) =>
    (element.textContent || '').includes(label),
  );
  if (!target) {
    failures.push(`press "${label}" (not found)`);
    log(`FAIL press "${label}"`, 'control not found');
    return false;
  }
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    target.dispatchEvent(new window.MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  }
  await wait(1400);
  return true;
}

function type(value) {
  const field = [...D.querySelectorAll('input[type=text], textarea')].find((element) => (element.placeholder || '').length > 3);
  if (!field) {
    failures.push('purpose field');
    return;
  }
  const proto = field.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(field, value);
  field.dispatchEvent(new window.Event('input', { bubbles: true }));
}

console.log(`CampusFlow student app — web smoke test\n  app ${APP}\n  api ${API}\n`);

await wait(2500);
expect('the sign-in screen offers the demo student', text().includes('Continue as Nadège'), text());

await press('Continue as Nadège');
expect('signing in reaches the student’s day', text().includes('Prochains rendez-vous'), text());
expect('the feed carries real notifications', text().includes('Notifications'), text());

await press('Scanner');
await press('Entrée du Bloc Administratif');
expect('an anchor fixes the indoor position', text().includes('Position : Entrée Administration'), text());

await press('Carte');
await wait(1000);
expect('a device without WebGL still gets the screen', text().includes('Carte indisponible'), text());
await press('A101 — Salle du Conseil');
await press('Calculer');
await wait(1200);
expect('the server returns walkable steps', /Entrez : Salle du Conseil/.test(text()), text());

await press('Salles');
await wait(1000);
type(PURPOSE);
await press('Envoyer la demande');
await wait(1500);
expect('a room request is filed and pending', text().includes('Demande envoyée') && text().includes('PENDING'), text());

expect('no uncaught errors', errors.length === 0, errors.join(' | '));

// The test must be repeatable: the request it just filed is withdrawn through the API,
// otherwise the next run collides with its own booking and reports a false failure.
try {
  const login = await (
    await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'etudiant@iaicameroun.cm', password: 'CampusFlow2026' }),
    })
  ).json();
  const auth = { authorization: `Bearer ${login.token}` };
  const { items } = await (await fetch(`${API}/bookings`, { headers: auth })).json();
  for (const booking of items.filter((item) => item.purpose === PURPOSE && item.status === 'PENDING')) {
    await fetch(`${API}/bookings/${booking.id}/cancel`, { method: 'POST', headers: auth });
  }
  log('ok   the test withdrew its own request');
} catch {
  log('warn could not withdraw the test request; cancel it by hand before re-running');
}

console.log(failures.length ? `\n${failures.length} failed: ${failures.join(', ')}` : '\nAll checks passed.');
process.exit(failures.length ? 1 : 0);
