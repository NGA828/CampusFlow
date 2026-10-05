import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Announcement, Booking, CampusEvent, Notification, PublicUser, Session, User } from './types.ts';

/**
 * Runtime state.
 *
 * Records live in memory and are mirrored to a JSON file after every mutation, so an
 * account created or a room booked survives a restart of the API. No database server
 * can be installed in this environment; a single file written atomically is the
 * honest substitute, and `/health` reports which file is in use.
 *
 * Sessions are deliberately *not* persisted: a restart should end everyone's session
 * rather than resurrect tokens from disk.
 */

export const users = new Map<string, User>();
export const sessions = new Map<string, Session>();
export const bookings = new Map<string, Booking>();
export const notifications = new Map<string, Notification>();
export const events = new Map<string, CampusEvent>();
export const announcements = new Map<string, Announcement>();

/* ------------------------------------------------------------- persistence */

export const DATA_FILE = resolve(process.env.CAMPUSFLOW_DATA_FILE ?? resolve(process.cwd(), '../../.data/campusflow.json'));

interface Snapshot {
  version: 1;
  users: User[];
  bookings: Booking[];
  notifications: Notification[];
  events: CampusEvent[];
  announcements: Announcement[];
}

let persistenceEnabled = true;

/** Write the whole snapshot through a temporary file, so a crash cannot truncate it. */
export function persist(): void {
  if (!persistenceEnabled) return;
  const snapshot: Snapshot = {
    version: 1,
    users: [...users.values()],
    bookings: [...bookings.values()],
    notifications: [...notifications.values()],
    events: [...events.values()],
    announcements: [...announcements.values()],
  };
  try {
    mkdirSync(dirname(DATA_FILE), { recursive: true });
    const temporary = `${DATA_FILE}.tmp`;
    writeFileSync(temporary, JSON.stringify(snapshot, null, 2), 'utf8');
    renameSync(temporary, DATA_FILE);
  } catch (error) {
    // Losing durability must never take the API down — but it must be visible.
    console.error('[api] could not write the data file; continuing in memory only', error);
    persistenceEnabled = false;
  }
}

function restore(): boolean {
  if (!existsSync(DATA_FILE)) return false;
  try {
    const snapshot = JSON.parse(readFileSync(DATA_FILE, 'utf8')) as Snapshot;
    if (snapshot.version !== 1 || !Array.isArray(snapshot.users) || snapshot.users.length === 0) return false;
    users.clear();
    bookings.clear();
    notifications.clear();
    events.clear();
    announcements.clear();
    for (const user of snapshot.users) users.set(user.id, user);
    for (const booking of snapshot.bookings ?? []) bookings.set(booking.id, booking);
    for (const notification of snapshot.notifications ?? []) notifications.set(notification.id, notification);
    for (const event of snapshot.events ?? []) events.set(event.id, event);
    for (const announcement of snapshot.announcements ?? []) announcements.set(announcement.id, announcement);
    return true;
  } catch (error) {
    console.error('[api] the data file could not be read; starting from the seed instead', error);
    return false;
  }
}

/** Tests run against a throwaway store; nothing they create touches the data file. */
export function disablePersistence(): void {
  persistenceEnabled = false;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, digest] = stored.split(':');
  if (!salt || !digest) return false;
  const expected = Buffer.from(digest, 'hex');
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function publicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, createdAt: _createdAt, ...rest } = user;
  return rest;
}

export function userByEmail(email: string): User | undefined {
  const needle = email.trim().toLowerCase();
  return [...users.values()].find((user) => user.email === needle);
}

const SESSION_HOURS = 12;

export function createSession(userId: string): Session {
  const session: Session = {
    token: randomBytes(32).toString('base64url'),
    refreshToken: randomBytes(32).toString('base64url'),
    userId,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_HOURS * 3_600_000).toISOString(),
  };
  sessions.set(session.token, session);
  return session;
}

export function sessionByToken(token: string): Session | undefined {
  const session = sessions.get(token);
  if (!session) return undefined;
  if (Date.parse(session.expiresAt) < Date.now()) {
    sessions.delete(token);
    return undefined;
  }
  return session;
}

export function sessionByRefreshToken(refreshToken: string): Session | undefined {
  return [...sessions.values()].find((session) => session.refreshToken === refreshToken);
}

export function notify(userId: string, kind: Notification['kind'], title: string, body: string): Notification {
  const notification: Notification = {
    id: randomUUID(),
    userId,
    kind,
    title,
    body,
    createdAt: new Date().toISOString(),
    readAt: null,
  };
  notifications.set(notification.id, notification);
  return notification;
}

function addUser(input: Omit<User, 'id' | 'passwordHash' | 'createdAt'> & { password: string }): User {
  const { password, ...rest } = input;
  const user: User = {
    ...rest,
    id: randomUUID(),
    email: rest.email.toLowerCase(),
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  users.set(user.id, user);
  return user;
}

/** The shared walkthrough password for the three seeded accounts. */
export const DEMO_PASSWORD = 'CampusFlow2026';

function iso(dayOffset: number, hour: number, minute = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

export function seed(): { student: User; staff: User; admin: User } {
  const student = addUser({
    name: 'Nadège Mbarga',
    email: 'etudiant@iaicameroun.cm',
    role: 'STUDENT',
    universitySlug: 'iai-cameroun',
    matricule: 'IAI-2026-0481',
    password: DEMO_PASSWORD,
  });
  const staff = addUser({
    name: 'M. Thierry Ndongo',
    email: 'scolarite@iaicameroun.cm',
    role: 'STAFF',
    universitySlug: 'iai-cameroun',
    matricule: null,
    password: DEMO_PASSWORD,
  });
  const admin = addUser({
    name: 'Mme Clarisse Abena',
    email: 'direction@iaicameroun.cm',
    role: 'ADMIN',
    universitySlug: 'iai-cameroun',
    matricule: null,
    password: DEMO_PASSWORD,
  });

  const seededEvents: CampusEvent[] = [
    {
      id: randomUUID(),
      universitySlug: 'iai-cameroun',
      title: 'Journée portes ouvertes — Centre d’Excellence',
      body: 'Présentation des laboratoires logiciels et systèmes, démonstrations des projets de fin de cycle.',
      venue: 'Centre d’Excellence Technologique',
      startsAt: iso(2, 9),
      endsAt: iso(2, 16),
    },
    {
      id: randomUUID(),
      universitySlug: 'iai-cameroun',
      title: 'Forum des stages et de l’emploi',
      body: 'Entretiens avec les entreprises partenaires. Les salles d’entretien du Bloc Administratif sont réservables.',
      venue: 'Bloc Administratif',
      startsAt: iso(5, 8, 30),
      endsAt: iso(5, 15),
    },
    {
      id: randomUUID(),
      universitySlug: 'enspy',
      title: 'Conférence — ingénierie et villes durables',
      body: 'Conférence publique ouverte aux étudiants des établissements partenaires de Yaoundé.',
      venue: 'Amphi 500, Melen',
      startsAt: iso(7, 14),
      endsAt: iso(7, 17),
    },
  ];
  for (const event of seededEvents) events.set(event.id, event);

  const seededAnnouncements: Announcement[] = [
    {
      id: randomUUID(),
      universitySlug: 'iai-cameroun',
      title: 'Retrait des cartes d’étudiant',
      body: 'Les cartes sont disponibles au guichet de la scolarité (S01) de 8h à 15h, du lundi au vendredi.',
      priority: 'HIGH',
      publishedAt: iso(-1, 8),
      authorId: staff.id,
    },
    {
      id: randomUUID(),
      universitySlug: 'iai-cameroun',
      title: 'Maintenance du laboratoire Systèmes (L02)',
      body: 'Le laboratoire L02 sera fermé mercredi matin. Les séances sont déplacées en L01.',
      priority: 'NORMAL',
      publishedAt: iso(-2, 17),
      authorId: staff.id,
    },
    {
      id: randomUUID(),
      universitySlug: 'iai-cameroun',
      title: 'Dépôt des rapports de stage',
      body: 'Dépôt au Bureau des Stages (S02) jusqu’au 30 du mois. Prenez rendez-vous depuis CampusFlow.',
      priority: 'URGENT',
      publishedAt: iso(0, 7, 30),
      authorId: admin.id,
    },
  ];
  for (const announcement of seededAnnouncements) announcements.set(announcement.id, announcement);

  const booking: Booking = {
    id: randomUUID(),
    roomId: 'r-adm-s03',
    studentId: student.id,
    purpose: 'Entretien de suivi de stage avec le Bureau des Stages',
    startsAt: iso(1, 10),
    endsAt: iso(1, 11),
    status: 'APPROVED',
    decidedBy: staff.id,
    decisionNote: 'Confirmé. Présentez-vous dix minutes avant.',
    createdAt: iso(-1, 12),
  };
  bookings.set(booking.id, booking);

  notify(student.id, 'BOOKING', 'Demande de salle approuvée', `Salle d’Entretien 1 — ${new Date(booking.startsAt).toLocaleString('fr-FR')}`);
  notify(student.id, 'ANNOUNCEMENT', 'Dépôt des rapports de stage', 'Nouvelle annonce urgente de la direction.');

  return { student, staff, admin };
}

/**
 * Boot the store: reuse the data file when it holds a usable snapshot, otherwise seed
 * the walkthrough campus and write the first one.
 */
export function initialise(): { restored: boolean } {
  if (restore()) return { restored: true };
  seed();
  persist();
  return { restored: false };
}
