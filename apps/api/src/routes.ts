import { randomUUID } from 'node:crypto';
import { BUILDINGS, NAV_EDGES, NAV_NODES, QR_ANCHORS, ROOMS, buildingById, floorName, roomById } from './data/campus.ts';
import { UNIVERSITIES, findUniversity } from './data/universities.ts';
import { HttpError, Router, bool, isoDate, optionalStr, requireRole, requireUser, str } from './http.ts';
import { findRoute } from './routing.ts';
import {
  DATA_FILE,
  DEMO_PASSWORD,
  announcements,
  bookings,
  createSession,
  events,
  hashPassword,
  notifications,
  notify,
  publicUser,
  sessionByRefreshToken,
  sessionByToken,
  sessions,
  userByEmail,
  users,
  verifyPassword,
} from './store.ts';
import type { Booking, User } from './types.ts';

export const router = new Router();

/* ---------------------------------------------------------------------- system */

router.get('/api/v1/health', () => ({
  status: 'ok',
  storage: `json-file: ${DATA_FILE} (written after every mutation; sessions are not persisted)`,
  universities: UNIVERSITIES.length,
  indoorCampuses: UNIVERSITIES.filter((university) => university.indoorMappingPriority === 1).map((u) => u.slug),
  time: new Date().toISOString(),
}));

/* ---------------------------------------------------------------- directory */

router.get('/api/v1/universities', (ctx) => {
  const query = ctx.url.searchParams.get('q')?.trim().toLowerCase() ?? '';
  const type = ctx.url.searchParams.get('type')?.trim().toUpperCase() ?? '';
  const items = UNIVERSITIES.filter((university) => {
    const matchesQuery =
      !query ||
      [university.name, university.shortName, university.neighbourhood ?? '', university.city]
        .join(' ')
        .toLowerCase()
        .includes(query);
    const matchesType = !type || university.type === type;
    return matchesQuery && matchesType;
  });
  return {
    coverage: 'yaounde-public-private-and-specialist-directory',
    note: 'Coordinates locate each institution in the city; only IAI Cameroun is mapped indoors.',
    total: items.length,
    items,
  };
});

router.get('/api/v1/universities/:slug', (ctx) => {
  const university = findUniversity(ctx.params.slug!);
  if (!university) throw new HttpError(404, 'That institution is not in the directory.');
  const campusBuildings = BUILDINGS.filter((building) => building.universitySlug === university.slug);
  return {
    university,
    buildings: campusBuildings,
    hasIndoorMap: campusBuildings.length > 0,
  };
});

router.get('/api/v1/universities/:slug/campus', (ctx) => {
  const university = findUniversity(ctx.params.slug!);
  if (!university) throw new HttpError(404, 'That institution is not in the directory.');
  const campusBuildings = BUILDINGS.filter((building) => building.universitySlug === university.slug);
  if (campusBuildings.length === 0) {
    throw new HttpError(404, `${university.shortName} is not mapped indoors yet. IAI Cameroun is the pilot campus.`);
  }
  const ids = new Set(campusBuildings.map((building) => building.id));
  return {
    university,
    buildings: campusBuildings,
    rooms: ROOMS.filter((room) => ids.has(room.buildingId)),
    anchors: QR_ANCHORS.filter((anchor) => ids.has(anchor.buildingId)),
    nodes: NAV_NODES.filter((node) => ids.has(node.buildingId)),
    edges: NAV_EDGES,
  };
});

router.get('/api/v1/rooms', (ctx) => {
  const bookableOnly = ctx.url.searchParams.get('bookable') === 'true';
  const items = ROOMS.filter((room) => (bookableOnly ? room.bookable : true)).map((room) => ({
    ...room,
    buildingName: buildingById(room.buildingId)?.name ?? 'Bâtiment',
    buildingCode: buildingById(room.buildingId)?.code ?? '',
    floorName: floorName(room.buildingId, room.floorId),
  }));
  return { total: items.length, items };
});

/* --------------------------------------------------------------------- auth */

function sessionPayload(user: User) {
  const session = createSession(user.id);
  return {
    token: session.token,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
    user: publicUser(user),
  };
}

router.post('/api/v1/auth/register', (ctx) => {
  const name = str(ctx.body, 'name', { min: 2, max: 120 });
  const email = str(ctx.body, 'email', { min: 5, max: 160 }).toLowerCase();
  const password = str(ctx.body, 'password', { min: 8, max: 200 });
  const universitySlug = str(ctx.body, 'universitySlug', { min: 2, max: 80 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(422, 'Enter a valid email address.', { email: 'invalid' });
  if (!findUniversity(universitySlug)) throw new HttpError(422, 'Choose an institution from the directory.', { universitySlug: 'unknown' });
  if (userByEmail(email)) throw new HttpError(409, 'An account already exists for this email address.');

  // Public registration always creates a student; staff and administrator accounts
  // are issued by an administrator, never claimed on a sign-up form.
  const user: User = {
    id: randomUUID(),
    name,
    email,
    role: 'STUDENT',
    universitySlug,
    matricule: optionalStr(ctx.body, 'matricule'),
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  users.set(user.id, user);
  notify(user.id, 'ANNOUNCEMENT', 'Bienvenue sur CampusFlow', 'Votre compte étudiant est actif. Explorez votre campus et réservez une salle administrative.');
  ctx.res.statusCode = 201;
  return sessionPayload(user);
});

router.post('/api/v1/auth/login', (ctx) => {
  const email = str(ctx.body, 'email', { min: 5, max: 160 }).toLowerCase();
  const password = str(ctx.body, 'password', { min: 1, max: 200 });
  const user = userByEmail(email);
  // One message for both failures: never reveal whether an address is registered.
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new HttpError(401, 'These credentials do not match our records.');
  }
  return sessionPayload(user);
});

router.post('/api/v1/auth/refresh', (ctx) => {
  const refreshToken = str(ctx.body, 'refreshToken', { min: 10, max: 200 });
  const session = sessionByRefreshToken(refreshToken);
  if (!session) throw new HttpError(401, 'This session can no longer be refreshed. Sign in again.');
  const user = users.get(session.userId);
  if (!user) throw new HttpError(401, 'This account is no longer available.');
  sessions.delete(session.token);
  return sessionPayload(user);
});

router.post('/api/v1/auth/logout', (ctx) => {
  const header = ctx.req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const session = sessionByToken(header.slice(7).trim());
    if (session) sessions.delete(session.token);
  }
  return { signedOut: true };
});

router.get('/api/v1/auth/me', (ctx) => ({ user: requireUser(ctx) }));

/** The walkthrough accounts, so the sign-in screen never has to hardcode them. */
router.get('/api/v1/auth/demo-accounts', () => ({
  password: DEMO_PASSWORD,
  accounts: [...users.values()]
    .filter((user) => user.email.endsWith('@iaicameroun.cm'))
    .map((user) => ({ role: user.role, email: user.email, name: user.name })),
}));

/* ----------------------------------------------------------------- content */

router.get('/api/v1/events', (ctx) => {
  const slug = ctx.url.searchParams.get('university');
  const items = [...events.values()]
    .filter((event) => !slug || event.universitySlug === slug)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return { total: items.length, items };
});

router.get('/api/v1/announcements', (ctx) => {
  const slug = ctx.url.searchParams.get('university');
  const items = [...announcements.values()]
    .filter((announcement) => !slug || announcement.universitySlug === slug)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return { total: items.length, items };
});

router.post('/api/v1/announcements', (ctx) => {
  const author = requireRole(ctx, 'STAFF', 'ADMIN');
  const priority = (optionalStr(ctx.body, 'priority') ?? 'NORMAL').toUpperCase();
  if (!['NORMAL', 'HIGH', 'URGENT'].includes(priority)) throw new HttpError(422, 'Priority must be NORMAL, HIGH or URGENT.');
  const announcement = {
    id: randomUUID(),
    universitySlug: author.universitySlug,
    title: str(ctx.body, 'title', { min: 4, max: 160 }),
    body: str(ctx.body, 'body', { min: 4, max: 2000 }),
    priority: priority as 'NORMAL' | 'HIGH' | 'URGENT',
    publishedAt: new Date().toISOString(),
    authorId: author.id,
  };
  announcements.set(announcement.id, announcement);
  for (const user of users.values()) {
    if (user.role === 'STUDENT' && user.universitySlug === announcement.universitySlug) {
      notify(user.id, 'ANNOUNCEMENT', announcement.title, announcement.body.slice(0, 140));
    }
  }
  ctx.res.statusCode = 201;
  return { announcement };
});

/* ----------------------------------------------------------- notifications */

router.get('/api/v1/notifications', (ctx) => {
  const user = requireUser(ctx);
  const items = [...notifications.values()]
    .filter((notification) => notification.userId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { total: items.length, unread: items.filter((item) => !item.readAt).length, items };
});

router.post('/api/v1/notifications/:id/read', (ctx) => {
  const user = requireUser(ctx);
  const notification = notifications.get(ctx.params.id!);
  if (!notification || notification.userId !== user.id) throw new HttpError(404, 'Notification not found.');
  notification.readAt = notification.readAt ?? new Date().toISOString();
  return { notification };
});

/* --------------------------------------------------------------- bookings */

function bookingView(booking: Booking) {
  const room = roomById(booking.roomId);
  const student = users.get(booking.studentId);
  return {
    ...booking,
    room: room
      ? {
          id: room.id,
          code: room.code,
          name: room.name,
          capacity: room.capacity,
          buildingName: buildingById(room.buildingId)?.name ?? '',
          floorName: floorName(room.buildingId, room.floorId),
          nodeId: room.nodeId,
        }
      : null,
    student: student ? { id: student.id, name: student.name, matricule: student.matricule } : null,
  };
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return Date.parse(aStart) < Date.parse(bEnd) && Date.parse(bStart) < Date.parse(aEnd);
}

router.get('/api/v1/bookings', (ctx) => {
  const user = requireUser(ctx);
  const items = [...bookings.values()]
    .filter((booking) => (user.role === 'STUDENT' ? booking.studentId === user.id : true))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map(bookingView);
  return { total: items.length, items };
});

router.post('/api/v1/bookings', (ctx) => {
  const student = requireRole(ctx, 'STUDENT');
  const roomId = str(ctx.body, 'roomId', { min: 2, max: 60 });
  const purpose = str(ctx.body, 'purpose', { min: 6, max: 400 });
  const startsAt = isoDate(ctx.body, 'startsAt');
  const endsAt = isoDate(ctx.body, 'endsAt');

  const room = roomById(roomId);
  if (!room) throw new HttpError(404, 'That room is not in the campus model.');
  if (!room.bookable) throw new HttpError(422, 'This room cannot be requested by students.', { roomId: 'not-bookable' });
  if (Date.parse(endsAt) <= Date.parse(startsAt)) throw new HttpError(422, 'The end time must be after the start time.', { endsAt: 'invalid' });
  if (Date.parse(startsAt) < Date.now()) throw new HttpError(422, 'Choose a time in the future.', { startsAt: 'past' });

  // A declined or cancelled request frees the slot; anything still live holds it.
  const clash = [...bookings.values()].find(
    (booking) =>
      booking.roomId === roomId &&
      (booking.status === 'PENDING' || booking.status === 'APPROVED') &&
      overlaps(startsAt, endsAt, booking.startsAt, booking.endsAt),
  );
  if (clash) throw new HttpError(409, 'This room is already requested for that time. Choose another slot.');

  const booking: Booking = {
    id: randomUUID(),
    roomId,
    studentId: student.id,
    purpose,
    startsAt,
    endsAt,
    status: 'PENDING',
    decidedBy: null,
    decisionNote: null,
    createdAt: new Date().toISOString(),
  };
  bookings.set(booking.id, booking);
  notify(student.id, 'BOOKING', 'Demande envoyée', `${room.name} — en attente de validation par la scolarité.`);
  for (const user of users.values()) {
    if (user.role === 'STAFF' && user.universitySlug === student.universitySlug) {
      notify(user.id, 'BOOKING', 'Nouvelle demande de salle', `${student.name} — ${room.name}`);
    }
  }
  ctx.res.statusCode = 201;
  return { booking: bookingView(booking) };
});

router.post('/api/v1/bookings/:id/decision', (ctx) => {
  const decider = requireRole(ctx, 'STAFF', 'ADMIN');
  const booking = bookings.get(ctx.params.id!);
  if (!booking) throw new HttpError(404, 'Booking not found.');
  if (booking.status !== 'PENDING') throw new HttpError(409, 'This request has already been decided.');
  const status = str(ctx.body, 'status', { min: 7, max: 8 }).toUpperCase();
  if (status !== 'APPROVED' && status !== 'DECLINED') throw new HttpError(422, 'Status must be APPROVED or DECLINED.');
  booking.status = status;
  booking.decidedBy = decider.id;
  booking.decisionNote = optionalStr(ctx.body, 'note');
  notify(
    booking.studentId,
    'BOOKING',
    status === 'APPROVED' ? 'Demande de salle approuvée' : 'Demande de salle refusée',
    `${roomById(booking.roomId)?.name ?? 'Salle'} — ${booking.decisionNote ?? 'Aucune note.'}`,
  );
  return { booking: bookingView(booking) };
});

router.post('/api/v1/bookings/:id/cancel', (ctx) => {
  const user = requireUser(ctx);
  const booking = bookings.get(ctx.params.id!);
  if (!booking) throw new HttpError(404, 'Booking not found.');
  if (user.role === 'STUDENT' && booking.studentId !== user.id) throw new HttpError(403, 'You can only cancel your own request.');
  if (booking.status === 'CANCELLED') return { booking: bookingView(booking) };
  booking.status = 'CANCELLED';
  return { booking: bookingView(booking) };
});

/* ------------------------------------------------- positioning & navigation */

router.post('/api/v1/positioning/scan', (ctx) => {
  requireUser(ctx);
  const code = str(ctx.body, 'code', { min: 3, max: 60 }).toUpperCase();
  const anchor = QR_ANCHORS.find((item) => item.code === code);
  if (!anchor) throw new HttpError(404, 'This QR anchor is not recognised on the IAI campus.');
  const node = NAV_NODES.find((item) => item.id === anchor.nodeId)!;
  return {
    anchor,
    position: {
      nodeId: node.id,
      label: node.label,
      buildingId: node.buildingId,
      buildingName: buildingById(node.buildingId)?.name ?? '',
      floorName: floorName(node.buildingId, node.floorId),
      coordinates: node.coordinates,
      fixedAt: new Date().toISOString(),
      source: 'QR_ANCHOR',
    },
    roomsOnThisFloor: ROOMS.filter((room) => room.floorId === anchor.floorId).map((room) => ({ id: room.id, code: room.code, name: room.name })),
  };
});

/** Accepts a node id, a room id, or a QR anchor code at either end of the route. */
function resolveNode(value: string): string | null {
  if (NAV_NODES.some((node) => node.id === value)) return value;
  const room = roomById(value);
  if (room) return room.nodeId;
  const anchor = QR_ANCHORS.find((item) => item.code === value.toUpperCase());
  return anchor ? anchor.nodeId : null;
}

router.post('/api/v1/navigation/route', (ctx) => {
  requireUser(ctx);
  const from = resolveNode(str(ctx.body, 'from', { min: 2, max: 80 }));
  const to = resolveNode(str(ctx.body, 'to', { min: 2, max: 80 }));
  if (!from) throw new HttpError(422, 'The starting point is not on the campus map.', { from: 'unknown' });
  if (!to) throw new HttpError(422, 'The destination is not on the campus map.', { to: 'unknown' });
  const route = findRoute(from, to, bool(ctx.body, 'stepFree'));
  if (!route) {
    throw new HttpError(409, bool(ctx.body, 'stepFree') ? 'No step-free route connects those two points.' : 'No route connects those two points.');
  }
  return { route };
});

/* ------------------------------------------------------------------- admin */

router.get('/api/v1/admin/users', (ctx) => {
  requireRole(ctx, 'ADMIN');
  const items = [...users.values()].map(publicUser);
  return { total: items.length, items };
});

router.post('/api/v1/admin/users', (ctx) => {
  const admin = requireRole(ctx, 'ADMIN');
  const role = str(ctx.body, 'role', { min: 4, max: 10 }).toUpperCase();
  if (!['STUDENT', 'STAFF', 'ADMIN'].includes(role)) throw new HttpError(422, 'Role must be STUDENT, STAFF or ADMIN.');
  const email = str(ctx.body, 'email', { min: 5, max: 160 }).toLowerCase();
  if (userByEmail(email)) throw new HttpError(409, 'An account already exists for this email address.');
  const user: User = {
    id: randomUUID(),
    name: str(ctx.body, 'name', { min: 2, max: 120 }),
    email,
    role: role as User['role'],
    universitySlug: optionalStr(ctx.body, 'universitySlug') ?? admin.universitySlug,
    matricule: optionalStr(ctx.body, 'matricule'),
    passwordHash: hashPassword(str(ctx.body, 'password', { min: 8, max: 200 })),
    createdAt: new Date().toISOString(),
  };
  users.set(user.id, user);
  ctx.res.statusCode = 201;
  return { user: publicUser(user) };
});
