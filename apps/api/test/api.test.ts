import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { before, test } from 'node:test';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { router } from '../src/routes.ts';
import { BUILDINGS, LANDMARKS, NAV_NODES, ROOMS, floorsOfBuilding, insideCampus } from '../src/data/campus.ts';
import { DEMO_PASSWORD, disablePersistence, seed } from '../src/store.ts';

/**
 * The route table is exercised directly: the handlers receive the same context the
 * server builds, so these tests cover authorisation and the booking rules rather than
 * HTTP plumbing.
 */

interface Call {
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
  token?: string;
}

async function call<T>({ method, path, body, token }: Call): Promise<{ status: number; payload: T }> {
  const url = new URL(`http://test${path}`);
  const match = router.match(method, url.pathname);
  assert.ok(match, `no route for ${method} ${url.pathname}`);
  const res = { statusCode: 200 } as ServerResponse;
  const req = { headers: token ? { authorization: `Bearer ${token}` } : {} } as unknown as IncomingMessage;
  const { resolveUser } = await import('../src/http.ts');
  try {
    const payload = (await match.handler({ req, res, url, params: match.params, body: body ?? null, user: resolveUser(req) })) as T;
    return { status: res.statusCode, payload };
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return { status, payload: { error: (error as Error).message } as T };
  }
}

let studentToken = '';
let staffToken = '';

before(async () => {
  // These tests must never touch the real data file.
  disablePersistence();
  seed();
  const student = await call<{ token: string }>({
    method: 'POST',
    path: '/api/v1/auth/login',
    body: { email: 'etudiant@iaicameroun.cm', password: DEMO_PASSWORD },
  });
  studentToken = student.payload.token;
  const staff = await call<{ token: string }>({
    method: 'POST',
    path: '/api/v1/auth/login',
    body: { email: 'scolarite@iaicameroun.cm', password: DEMO_PASSWORD },
  });
  staffToken = staff.payload.token;
});

test('the directory lists Yaoundé institutions with IAI first', async () => {
  const { payload } = await call<{ total: number; items: { slug: string; indoorMappingPriority: number | null }[] }>({
    method: 'GET',
    path: '/api/v1/universities',
  });
  assert.equal(payload.total, 20);
  assert.equal(payload.items[0]?.slug, 'iai-cameroun');
  assert.equal(payload.items[0]?.indoorMappingPriority, 1);
  for (const slug of ['enspy', 'emia']) {
    assert.ok(payload.items.some((item) => item.slug === slug), `${slug} must be listed`);
  }
});

test('a wrong password is rejected with the same message as an unknown address', async () => {
  const wrongPassword = await call<{ error: string }>({
    method: 'POST',
    path: '/api/v1/auth/login',
    body: { email: 'etudiant@iaicameroun.cm', password: 'not-the-password' },
  });
  const unknownUser = await call<{ error: string }>({
    method: 'POST',
    path: '/api/v1/auth/login',
    body: { email: 'nobody@iaicameroun.cm', password: DEMO_PASSWORD },
  });
  assert.equal(wrongPassword.status, 401);
  assert.equal(wrongPassword.payload.error, unknownUser.payload.error);
});

test('the student session resolves from the bearer token alone — no cookie involved', async () => {
  const { status, payload } = await call<{ user: { email: string; role: string } }>({
    method: 'GET',
    path: '/api/v1/auth/me',
    token: studentToken,
  });
  assert.equal(status, 200);
  assert.equal(payload.user.role, 'STUDENT');
  assert.equal(payload.user.email, 'etudiant@iaicameroun.cm');
});

test('an anonymous request cannot read a session', async () => {
  const { status } = await call({ method: 'GET', path: '/api/v1/auth/me' });
  assert.equal(status, 401);
});

test('a student can request an administrative room and staff decide it', async () => {
  const startsAt = new Date(Date.now() + 86_400_000).toISOString();
  const endsAt = new Date(Date.now() + 90_000_000).toISOString();
  const created = await call<{ booking: { id: string; status: string } }>({
    method: 'POST',
    path: '/api/v1/bookings',
    token: studentToken,
    body: { roomId: 'r-adm-d11', purpose: 'Entretien de stage', startsAt, endsAt },
  });
  assert.equal(created.status, 201);
  assert.equal(created.payload.booking.status, 'PENDING');

  // The same slot cannot be taken twice while a request is live.
  const clash = await call<{ error: string }>({
    method: 'POST',
    path: '/api/v1/bookings',
    token: studentToken,
    body: { roomId: 'r-adm-d11', purpose: 'Deuxième demande', startsAt, endsAt },
  });
  assert.equal(clash.status, 409);

  // A student may not decide their own request.
  const selfApproval = await call({
    method: 'POST',
    path: `/api/v1/bookings/${created.payload.booking.id}/decision`,
    token: studentToken,
    body: { status: 'APPROVED' },
  });
  assert.equal(selfApproval.status, 403);

  const decision = await call<{ booking: { status: string } }>({
    method: 'POST',
    path: `/api/v1/bookings/${created.payload.booking.id}/decision`,
    token: staffToken,
    body: { status: 'APPROVED', note: 'Confirmé.' },
  });
  assert.equal(decision.payload.booking.status, 'APPROVED');
});

test('a lecture room cannot be booked by a student', async () => {
  const { status } = await call({
    method: 'POST',
    path: '/api/v1/bookings',
    token: studentToken,
    body: {
      roomId: 'r-ped-a01',
      purpose: 'Révisions',
      startsAt: new Date(Date.now() + 172_800_000).toISOString(),
      endsAt: new Date(Date.now() + 176_400_000).toISOString(),
    },
  });
  assert.equal(status, 422);
});

test('scanning a QR anchor fixes an indoor position', async () => {
  const { payload } = await call<{ position: { nodeId: string; floorName: string } }>({
    method: 'POST',
    path: '/api/v1/positioning/scan',
    token: studentToken,
    body: { code: 'IAI-ADM-HALL' },
  });
  assert.equal(payload.position.nodeId, 'n-adm0-hall');
  assert.match(payload.position.floorName, /Rez-de-chaussée/);
});

test('an unknown anchor is refused rather than guessed', async () => {
  const { status } = await call({
    method: 'POST',
    path: '/api/v1/positioning/scan',
    token: studentToken,
    body: { code: 'NOT-AN-ANCHOR' },
  });
  assert.equal(status, 404);
});

test('a step-free route to the first floor uses the lift, never the stairs', async () => {
  const { payload } = await call<{ route: { steps: { edgeKind: string | null }[] } }>({
    method: 'POST',
    path: '/api/v1/navigation/route',
    token: studentToken,
    body: { from: 'IAI-ADM-ENT', to: 'r-adm-d11', stepFree: true },
  });
  const kinds = payload.route.steps.map((step) => step.edgeKind);
  assert.ok(kinds.includes('LIFT'), 'the step-free route must use the lift');
  assert.ok(!kinds.includes('STAIRS'), 'the step-free route must avoid stairs');
});

test('routing between buildings crosses the courtyard and reports a distance', async () => {
  const { payload } = await call<{ route: { totalDistanceMetres: number; steps: unknown[] } }>({
    method: 'POST',
    path: '/api/v1/navigation/route',
    token: studentToken,
    body: { from: 'IAI-PED-ENT', to: 'r-cet-bib' },
  });
  assert.ok(payload.route.totalDistanceMetres > 0);
  assert.ok(payload.route.steps.length > 3);
});

test('only an administrator can list accounts', async () => {
  const asStudent = await call({ method: 'GET', path: '/api/v1/admin/users', token: studentToken });
  assert.equal(asStudent.status, 403);
  const admin = await call<{ token: string }>({
    method: 'POST',
    path: '/api/v1/auth/login',
    body: { email: 'direction@iaicameroun.cm', password: DEMO_PASSWORD },
  });
  const asAdmin = await call<{ total: number }>({ method: 'GET', path: '/api/v1/admin/users', token: admin.payload.token });
  assert.equal(asAdmin.status, 200);
  assert.ok(asAdmin.payload.total >= 3);
});

test('every mapped feature lies inside the surveyed campus perimeter', () => {
  // The perimeter is OSM way 455178620; the layout inside it is modelled from
  // photographs. A node outside the fence would be a modelling mistake, and would
  // send a student across somebody else's land.
  for (const node of NAV_NODES) {
    assert.ok(insideCampus(node.coordinates), `${node.id} (${node.label}) is outside the campus perimeter`);
  }
  for (const landmark of LANDMARKS) {
    assert.ok(insideCampus(landmark.coordinates), `${landmark.id} is outside the campus perimeter`);
  }
  for (const building of BUILDINGS) {
    for (const point of building.footprint ?? []) {
      assert.ok(insideCampus(point), `${building.code} has a corner outside the campus perimeter`);
    }
  }
});

test('the campus payload carries the perimeter, the footprints and the landmarks', async () => {
  const { status, payload } = await call<{
    boundary: { ring: unknown[]; source: string; areaHectares: number };
    buildings: { code: string; footprint: unknown[] | null }[];
    landmarks: { id: string; name: string }[];
  }>({ method: 'GET', path: '/api/v1/universities/iai-cameroun/campus' });

  assert.equal(status, 200);
  assert.equal(payload.boundary.source, 'OSM');
  assert.ok(payload.boundary.ring.length >= 5);
  assert.ok(payload.boundary.areaHectares > 1);
  assert.ok(payload.buildings.every((building) => Array.isArray(building.footprint)));
  assert.ok(payload.landmarks.some((landmark) => landmark.id === 'lm-flags'));
});

test('a visitor can be routed from the main gate to a room indoors', async () => {
  const { payload } = await call<{ route: { steps: { edgeKind: string | null; instruction: string }[] } }>({
    method: 'POST',
    path: '/api/v1/navigation/route',
    token: studentToken,
    body: { from: 'lm-gate', to: 'r-adm-d11' },
  });
  const kinds = payload.route.steps.map((step) => step.edgeKind);
  assert.ok(kinds.includes('PATH'), 'the route must start outdoors');
  assert.ok(kinds.includes('DOOR'), 'the route must enter the building');
  assert.ok(kinds.includes('STAIRS') || kinds.includes('LIFT'), 'the council room is upstairs');
});

/** Point-in-polygon, so a room can be checked against the shell that contains it. */
function inside(ring: [number, number][], point: [number, number]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

test('every room number encodes its block, its floor and its side of the corridor', () => {
  for (const room of ROOMS) {
    assert.match(room.code, /^[PAC]\d{3}$/, `${room.id} does not follow BLOCK + FLOOR + NN`);

    const building = BUILDINGS.find((item) => item.id === room.buildingId)!;
    assert.equal(room.code[0], building.code[0], `${room.code} does not start with the ${building.code} block letter`);

    const floor = floorsOfBuilding(building.id).find((item) => item.id === room.floorId)!;
    assert.equal(
      Number(room.code[1]),
      floor.level,
      `${room.code} claims a floor digit that is not ${floor.level}`,
    );

    // Odd on the left of the corridor, even on the right: the two sides must both exist.
    const serial = Number(room.code.slice(2));
    assert.ok(serial > 0, `${room.code} has no serial number`);
  }

  for (const building of BUILDINGS) {
    for (const floor of floorsOfBuilding(building.id)) {
      const codes = ROOMS.filter((room) => room.floorId === floor.id).map((room) => Number(room.code.slice(2)));
      assert.ok(codes.some((serial) => serial % 2 === 1), `${building.code} ${floor.name} has no left-hand rooms`);
      assert.ok(codes.some((serial) => serial % 2 === 0), `${building.code} ${floor.name} has no right-hand rooms`);
    }
  }
});

test('every room is measured and fits inside its building', () => {
  for (const room of ROOMS) {
    assert.ok(room.widthMetres >= 4, `${room.code} is implausibly narrow`);
    assert.ok(room.depthMetres >= 4, `${room.code} is implausibly shallow`);
    assert.equal(room.areaSqMetres, Math.round(room.widthMetres * room.depthMetres));
    assert.equal(room.polygon.length, 5, `${room.code} is not a closed quadrilateral`);

    const building = BUILDINGS.find((item) => item.id === room.buildingId)!;
    for (const corner of room.polygon) {
      assert.ok(inside(building.footprint!, corner), `${room.code} has a corner outside ${building.code}`);
    }
  }
});

test('each floor has a corridor long enough for the rooms that open onto it', () => {
  for (const building of BUILDINGS) {
    for (const floor of floorsOfBuilding(building.id)) {
      const rooms = ROOMS.filter((room) => room.floorId === floor.id);
      assert.ok(floor.corridor.length >= 2, `${building.code} ${floor.name} has no corridor line`);
      assert.ok(floor.corridorLengthMetres > 10, `${building.code} ${floor.name} corridor is too short to be real`);

      for (const side of [1, 0]) {
        const frontage = rooms
          .filter((room) => Number(room.code.slice(2)) % 2 === side)
          .reduce((sum, room) => sum + room.widthMetres, 0);
        assert.ok(
          frontage <= floor.corridorLengthMetres,
          `${building.code} ${floor.name} has ${frontage} m of rooms on a ${floor.corridorLengthMetres} m corridor`,
        );
      }
    }
  }
});

test('a long corridor is one instruction, not one per door', async () => {
  const { payload } = await call<{
    route: { geometry: [number, number][]; steps: { edgeKind: string | null; instruction: string }[] };
  }>({
    method: 'POST',
    path: '/api/v1/navigation/route',
    token: studentToken,
    body: { from: 'n-ped0-entrance', to: 'r-ped-b12' },
  });

  const corridorSteps = payload.route.steps.filter((step) => step.edgeKind === 'CORRIDOR');
  assert.ok(corridorSteps.length <= 3, `the walk was broken into ${corridorSteps.length} corridor instructions`);
  assert.ok(corridorSteps.every((step) => step.instruction.startsWith('Suivez le couloir')));

  // The drawn line still follows every node, so it turns where the corridor turns.
  assert.ok(payload.route.geometry.length > payload.route.steps.length);
});

test('a session survives a restart of the API', () => {
  // The bug this pins: tokens used to live only in memory while everything else was
  // written to disk, so any restart — a deploy, a crash, a file saved in watch mode —
  // silently signed every student out in the middle of what they were doing.
  const dataFile = join(mkdtempSync(join(tmpdir(), 'campusflow-')), 'store.json');
  const run = (script: string) =>
    execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], {
      cwd: new URL('..', import.meta.url).pathname,
      env: { ...process.env, CAMPUSFLOW_DATA_FILE: dataFile },
      encoding: 'utf8',
    }).trim();

  const token = run(`
    const { initialise, createSession, users } = await import('./src/store.ts');
    initialise();
    const student = [...users.values()].find((user) => user.role === 'STUDENT');
    process.stdout.write(createSession(student.id).token);
  `);
  assert.ok(token.length > 20, 'no token was issued');

  const stillValid = run(`
    const { initialise, sessionByToken } = await import('./src/store.ts');
    initialise();
    process.stdout.write(sessionByToken(${JSON.stringify(token)}) ? 'yes' : 'no');
  `);
  assert.equal(stillValid, 'yes', 'the token did not survive the restart');
});
