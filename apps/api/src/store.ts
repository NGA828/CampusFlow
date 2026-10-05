import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Announcement, Booking, CampusEvent, Notification, PublicUser, Session, User } from './types.ts';

/**
 * Runtime state.
 *
 * The preview keeps everything in memory: restarting the API resets accounts,
 * bookings and notifications to the seed below. That is a deliberate limitation of
 * this environment (no database server is available here), and it is stated in the
 * API's own `/health` payload rather than hidden, so nobody mistakes the preview for
 * durable storage.
 */

export const users = new Map<string, User>();
export const sessions = new Map<string, Session>();
export const bookings = new Map<string, Booking>();
export const notifications = new Map<string, Notification>();
export const events = new Map<string, CampusEvent>();
export const announcements = new Map<string, Announcement>();

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
