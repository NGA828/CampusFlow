#!/usr/bin/env node
/**
 * API contract check — the role × platform split, enforced by a script instead of by review.
 *
 * Four things are verified, in this order:
 *
 *  1. **Existence.** Every endpoint either client calls is served by a route. A screen must not discover a
 *     404, and a renamed route segment must not be left behind in a client.
 *  2. **Handler.** Every route names a controller method that actually exists — the failure mode of a
 *     refactor that moves a method into a trait and forgets the route file.
 *  3. **Platform.** `backend/app/Support/Access/Permissions.php` records which platforms each capability may
 *     be exercised from. A route gated by a mobile-only permission may not be called by the web client, and
 *     a route gated by a web-only permission may not be called by the phone. The rule is *read from the
 *     registry*, never restated here, so this check cannot drift away from the server.
 *  4. **Coverage.** Every route is reachable from at least one client, or is explicitly allow-listed with a
 *     reason. A backend verb with no screen in front of it is unfinished work, not a spare part.
 *
 *   node scripts/check-api-contract.mjs
 *
 * The exit code is non-zero on any violation, so this can run in CI and in a pre-commit hook.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFileSync(join(root, relative), 'utf8');
const relative = (absolute) => absolute.slice(root.length + 1);

const API_SOURCE = 'backend/routes/api.php';
const APP_SOURCE = 'backend/bootstrap/app.php';
const PERMISSIONS_SOURCE = 'backend/app/Support/Access/Permissions.php';
const CONTROLLER_DIRS = ['', 'Auth', 'Student', 'Campus', 'Admin', 'Staff', 'Concerns'];

const VERBS = ['get', 'post', 'patch', 'put', 'delete'];

/** `{room}` and `${id}` both become `{}`, so a client literal and a route pattern can be compared. */
function normalize(path) {
  const open = path.replace(/\$\{[^}]*\}/g, '{}').replace(/\{[^}]*\}/g, '{}');
  return (open.startsWith('/') ? open : `/${open}`).replace(/\/{2,}/g, '/').replace(/\/+$/, '');
}

/**
 * Parse `routes/api.php`, carrying the guard stack (prefix + middleware) through nested groups.
 *
 * Brace counting is enough here because the file is written one statement per block, and it keeps this
 * checker honest as routes move between trees — which is exactly the moment a client would break.
 */
/** The API is mounted under a version prefix (`api/v1`), which both sides of this check must agree on. */
export function apiPrefix() {
  const match = read(APP_SOURCE).match(/apiPrefix:\s*'([^']*)'/);
  return match ? match[1].replace(/^\/|\/$/g, '') : 'api';
}

export function parseRoutes(source, base = 'api') {
  // Block comments first: the file opens with a prose map of the whole tree, and its braces would
  // otherwise shift the depth counter that group tracking depends on.
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const routes = [];
  const stack = [];
  let depth = 0;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\/\/.*$/, '');

    const routeMatch = line.match(/Route::((?:middleware\([^)]*\)\s*->\s*)?)(get|post|patch|put|delete)\(\s*'([^']*)'/i);
    if (routeMatch) {
      const inlineMiddleware = routeMatch[1] ? routeMatch[1] : '';
      const full = [base, ...stack.map((group) => group.prefix), routeMatch[3]].join('/');
      const roles = new Set();
      const permissions = new Set();
      for (const group of stack) {
        group.roles.forEach((role) => roles.add(role));
        group.permissions.forEach((permission) => permissions.add(permission));
      }
      const blob = inlineMiddleware.match(/middleware\(([^)]*)\)/)?.[1] ?? '';
      (blob.match(/role:([\w,]+)/)?.[1] ?? '').split(',').filter(Boolean).forEach((role) => roles.add(role));
      for (const match of blob.matchAll(/permission:([\w.]+)/g)) permissions.add(match[1]);

      routes.push({
        verb: routeMatch[2].toLowerCase(),
        path: normalize(full),
        roles: [...roles],
        permissions: [...permissions],
        handler: handlerOf(line),
        line: line.trim(),
      });
    }

    depth += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;

    const opensGroup = /->group\(\s*function/.test(line) || /Route::group\(/.test(line);
    if (opensGroup) {
      const blob = line.match(/middleware\(\[([^\]]*)\]\)/)?.[1] ?? line.match(/middleware\(\s*'([^']*)'\s*\)/)?.[1] ?? '';
      stack.push({
        prefix: (line.match(/(?:->|::)prefix\(\s*'([^']*)'\s*\)/) ?? [])[1] ?? '',
        depth,
        roles: (blob.match(/role:([\w,]+)/)?.[1] ?? '').split(',').filter(Boolean),
        permissions: [...blob.matchAll(/permission:([\w.]+)/g)].map((match) => match[1]),
      });
    }

    while (stack.length && depth < stack[stack.length - 1].depth) stack.pop();
  }

  return routes;
}

function handlerOf(line) {
  const match = line.match(/\[(\w+)::class,\s*'(\w+)'\]/);
  if (match) return { class: match[1], method: match[2] };
  const invokable = line.match(/,\s*(\w+)::class\s*\)/);
  return invokable ? { class: invokable[1], method: '__invoke' } : null;
}

export function controllerFile(className) {
  for (const dir of CONTROLLER_DIRS) {
    const candidate = join(root, 'backend/app/Http/Controllers', dir, `${className}.php`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Capability → platforms, read out of `Permissions::GRANTS`.
 *
 * `self::QR_SCAN => ['mobile']` becomes `qr.scan → ['mobile']`, which needs the constant table from the same
 * file. Anything the registry does not mention is treated as platform-neutral, matching the server: an
 * unlisted permission is not a mobile-only capability.
 */
export function parsePlatformCeilings(source) {
  const constants = {};
  for (const match of source.matchAll(/public const (\w+)\s*=\s*'([\w.]+)'/g)) constants[match[1]] = match[2];

  const grantsStart = source.indexOf('public const GRANTS');
  const grants = source.slice(grantsStart, source.indexOf('\n    ];', grantsStart));

  // Role → permission → platforms. A ceiling is a property of the pair: `queue.operate.assigned` is
  // mobile-capable for staff and web-only for administrators, and reading the registry as one flat table
  // would report staff mobile as a violation of a rule that only constrains admins.
  const ceilings = {};
  let role = null;

  for (const rawLine of grants.split('\n')) {
    const line = rawLine.trim();
    const roleStart = line.match(/^self::(\w+)\s*=>\s*\[$/);

    if (roleStart) {
      role = constants[`ROLE_${roleStart[1]}`] ?? roleStart[1].toLowerCase();
      ceilings[role] = {};
      continue;
    }

    if (!role) continue;
    if (line.startsWith(']') || line.startsWith('),')) { role = null; continue; }

    const grant = line.match(/^self::(\w+)\s*=>\s*\[([^\]]*)\]/);
    if (!grant) continue;

    const permission = constants[grant[1]];
    if (!permission) continue;

    ceilings[role][permission] = grant[2]
      .split(',')
      .map((entry) => entry.trim().replace(/^'|'$/g, ''))
      .filter((entry) => entry === 'web' || entry === 'mobile');
  }

  return ceilings;
}

const API_BASE = apiPrefix();

export function parseClientCalls(source) {
  const calls = new Set();
  const QUOTES = ["`", "'", '"'];

  const record = (verb, index) => {
    if (index === -1 || index >= source.length) return;
    const quote = source[index];
    if (!QUOTES.includes(quote)) return;
    const end = source.indexOf(quote, index + 1);
    if (end === -1) return;
    const path = source.slice(index + 1, end);
    if (path.includes('\n') || !path.startsWith('/')) return;
    calls.add(`${verb.toUpperCase()} /${API_BASE}${normalize(path)}`);
  };

  const skipGeneric = (from) => {
    if (source[from] !== '<') return from;
    let depth = 0;
    for (let i = from; i < source.length; i += 1) {
      const char = source[i];
      if (char === '<') depth += 1;
      else if (char === '>') {
        depth -= 1;
        if (depth === 0) return i + 1;
      }
    }
    return -1;
  };

  const openParen = (from) => {
    let cursor = from;
    while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
    return source[cursor] === '(' ? cursor + 1 : -1;
  };

  const firstArg = (from) => {
    let cursor = from;
    while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
    return cursor;
  };

  for (const match of source.matchAll(/\b(?:api|http)\.(get|post|patch|put|delete)/g)) {
    let cursor = skipGeneric(match.index + match[0].length);
    cursor = openParen(cursor);
    if (cursor === -1) continue;
    record(match[1], firstArg(cursor));
  }

  // `request<SessionInfo>('/auth/login', { method: 'POST' })` — the helper the auth layer uses, where the
  // verb lives in the options object instead of the method name.
  for (const match of source.matchAll(/\brequest(?:Json)?</g)) {
    let cursor = skipGeneric(match.index + match[0].length - 1);
    cursor = openParen(cursor);
    if (cursor === -1) continue;
    const start = firstArg(cursor);
    const window = source.slice(start, start + 400);
    const method = window.match(/method:\s*'(\w+)'/);
    // A `request()` call with an explicit method is *that* verb only; the GET default applies to the
    // single-argument form, or a browser would appear to call `GET /auth/login` next to `POST /auth/login`.
    record(method ? method[1] : 'get', start);
  }

  return [...calls].sort();
}


/**
 * The third client: the PHP feature tests.
 *
 * Tests call the API with literal paths, and this is the surface most likely to go on politely asserting
 * against a renamed route — a test that hits a 404 while expecting a 404 proves nothing. Their call sites
 * are resolved against the same route table the apps are. There is deliberately no platform ceiling here:
 * a test has to call a mobile-only endpoint from a plain client to demonstrate the refusal.
 */
export function parseTestCalls(source, base = 'api/v1') {
  const calls = [];
  for (const match of source.matchAll(/->(get|post|patch|put|delete)Json\(\s*(['"])((?:\/api|\/health)[^'"]*)\2/g)) {
    const [, verb, , raw] = match;
    // Query strings are noise for route matching, and `'/api/v1/rooms/' . $id` is a path we can only
    // resolve by prefix — so a literal ending in `/` is recorded as a prefix and matched loosely below.
    const path = (raw.startsWith('/api') ? raw : `/${base}${raw}`).split('?')[0];
    if (path === `/${base}`) continue; // `'/api/v1' . $path` — the whole path is runtime-built
    calls.push({ verb: verb.toUpperCase(), path: normalize(path), prefix: path.endsWith('/') });
  }
  return calls;
}

function walkPhp(dir, found = []) {
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkPhp(full, found);
    else if (full.endsWith('.php')) found.push(full);
  }
  return found;
}

/* ───────────────────────────────────────────────────────────────────────── run */

const apiSource = read(API_SOURCE);
const routes = parseRoutes(apiSource, apiPrefix());
const ceilings = parsePlatformCeilings(read(PERMISSIONS_SOURCE));
const index = new Map(routes.map((route) => [`${route.verb.toUpperCase()} ${route.path}`, route]));

const clients = {
  web: { source: read('frontend/lib/api/endpoints.ts'), prefix: 'web' },
  mobile: { source: read('mobile/src/lib/api.ts'), prefix: 'mobile' },
};

const problems = [];

// 1 + 2 — handlers, then existence.
for (const route of routes) {
  if (!route.handler) continue;
  const file = controllerFile(route.handler.class);
  if (!file) {
    problems.push(`route ${route.verb.toUpperCase()} ${route.path} names ${route.handler.class}, which has no controller file`);
    continue;
  }
  if (!new RegExp(`function ${route.handler.method}\\b`).test(readFileSync(file, 'utf8'))) {
    problems.push(`route ${route.verb.toUpperCase()} ${route.path} → ${route.handler.class}::${route.handler.method}() does not exist`);
  }
}

const byClient = {};
for (const [name, client] of Object.entries(clients)) byClient[name] = parseClientCalls(client.source);

for (const [name, calls] of Object.entries(byClient)) {
  for (const call of calls) {
    const route = index.get(call);
    if (!route) {
      problems.push(`${name} client calls ${call}, which no route serves`);
      continue;
    }
    // 3 — platform, straight from the registry: the permission must be exercisable from this client's
    // platform by at least one role the route admits.
    for (const permission of route.permissions) {
      const holders = (route.roles.length ? route.roles : Object.keys(ceilings)).filter((role) => ceilings[role]?.[permission]);
      if (holders.length === 0) continue;

      const possible = holders.flatMap((role) => ceilings[role][permission]);
      if (possible.length === 0) continue;

      const byRole = holders
        .filter((role) => !ceilings[role][permission].includes(name))
        .map((role) => `${role}: ${ceilings[role][permission].join('+')}`);

      if (byRole.length === holders.length) {
        problems.push(
          `${name} client calls ${call}, but ${permission} is exercisable only from ${[...new Set(possible)].join(' or ')} on this route — that capability belongs to the other platform`,
        );
      }
    }
  }
}

// 3b — the tests are a client too.
const testCalls = walkPhp(join(root, 'backend/tests'))
  .flatMap((file) => parseTestCalls(readFileSync(file, 'utf8')).map((call) => ({ ...call, file: relative(file) })));

for (const { verb, path, prefix, file } of testCalls) {
  const call = `${verb} ${path}`;
  const served = prefix
    ? [...index.keys()].some((key) => key.startsWith(`${verb} ${path}/`))
    : index.has(call);
  if (!served) problems.push(`${file} asserts on ${call}, which no route serves`);
}

// 4 — coverage.
const covered = new Set([...byClient.web, ...byClient.mobile]);
const testOnly = new Set(testCalls.filter((call) => !call.prefix).map((call) => `${call.verb} ${call.path}`));
const allowList = new Map([
  // No screen calls these; each has a reason to exist.
  ['GET /api/v1/campus/academic/courses', 'course catalogue is read through a room, a timetable entry or the admin tables'],
  ['GET /api/v1/staff/queues/{}', 'single-line read for an operator: it is the by-id access check the visibility tests assert, and the deep link a call notification opens'],
  ['PATCH /api/v1/student/navigation/sessions/{}', 'pause and resume are mobile-only, so the web client must not grow a button for them'],
  ['GET /api/v1/health', 'the status page and the mobile splash both read the health probe; it has no role tree on purpose'],
  ['GET /api/v1/campus/academic/terms', 'terms arrive inside every payload that needs one'],
  ['GET /api/v1/student/enrolments', 'the enrolment list is embedded in the web timetable payload'],
  ['GET /api/v1/campus/navigation/edges', 'edges arrive inside a route or a floor plan; the raw table is for debugging'],
  ['GET /api/v1/campus/navigation/nodes', 'same: nodes are embedded, not listed, by the screens'],
  ['GET /api/v1/campus/floors/{}/availability', 'free-room search covers this and the screens use that'],
  ['GET /api/v1/public/health', 'the status page reads /api/health, which lives outside this tree'],
  ['POST /api/v1/queue/tickets/{}/call', 'operator call actions are reached from the staff line screens with the same shape'],
]);

const orphans = [...new Set(routes.map((route) => `${route.verb.toUpperCase()} ${route.path}`))]
  .filter((key) => !covered.has(key))
  .filter((key) => !allowList.has(key))
  // A route only a test calls is still stranded: the verb exists, but no screen renders it. It is listed
  // with that said, rather than quietly allowed.
  .map((key) => (testOnly.has(key) ? `${key}  (called by tests only — no client screen uses it)` : key))
  .sort();

console.log(
  `routes ${routes.length} · web calls ${byClient.web.length} · mobile calls ${byClient.mobile.length} · test calls ${testCalls.length} · ` +
    `ceiling ${Object.values(ceilings).reduce((sum, role) => sum + Object.keys(role).length, 0)} role-permission pairs · orphans ${orphans.length} · problems ${problems.length}`,
);

if (orphans.length) {
  console.log('\nRoutes no client calls (add a screen or allow-list the reason):');
  for (const orphan of orphans) console.log(`  ${orphan}`);
}

if (problems.length) {
  console.log('\nViolations:');
  for (const problem of problems) console.log(`  ✗ ${problem}`);
  process.exitCode = 1;
} else if (orphans.length) {
  process.exitCode = 1;
} else {
  console.log('\n✓ both clients speak only to routes that exist, each stays inside its own platform, and no route is stranded');
}
