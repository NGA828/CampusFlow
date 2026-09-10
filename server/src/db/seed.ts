/**
 * Development seed data (PROMPT §63).
 *
 * Everything here is realistic but fictional: a five-building campus with floor plans,
 * rooms, QR anchors, a navigation graph, courses, enrolments, a master timetable,
 * admission queues, five administrative offices with service windows, events,
 * announcements and a week of historical queue activity so analytics screens show real
 * aggregates instead of placeholder charts.
 *
 * Exported so both `npm run db:seed` and the test suite can build a known campus at
 * different scales. Seeding is idempotent: the previous dataset is truncated first.
 */
import type { Db } from './client.js';
import { hashPassword } from '../lib/security.js';
import { campusParts } from '../lib/clock.js';

export const DEMO_PASSWORD = 'CampusFlow2026!';
const CAMPUS = { lat: 52.244, lng: 4.452, name: 'Northfield University' };

interface SeedBuilding {
  code: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  hasElevator: boolean;
  floors: { level: number; name: string; width: number; height: number }[];
  status?: 'operational' | 'limited' | 'closed' | 'maintenance';
}

interface SeedRoom {
  building: string;
  floor: number;
  code: string;
  name: string;
  type: 'lecture' | 'lab' | 'study' | 'office' | 'library' | 'auditorium' | 'meeting' | 'service' | 'other';
  capacity: number;
  x: number;
  y: number;
  w: number;
  h: number;
  admission?: boolean;
  amenities?: string[];
  accessibility?: string[];
  description?: string;
}

const BUILDINGS: SeedBuilding[] = [
  {
    code: 'A',
    name: 'Halden Hall',
    description: 'Engineering and computing: lecture theatres, hardware labs and the robotics workshop.',
    lat: 52.24465,
    lng: 4.45015,
    hasElevator: true,
    floors: [
      { level: 0, name: 'Ground floor', width: 56, height: 34 },
      { level: 1, name: 'First floor', width: 56, height: 34 },
      { level: 2, name: 'Second floor', width: 56, height: 34 },
    ],
  },
  {
    code: 'B',
    name: 'Brixner Building',
    description: 'Sciences: chemistry, physics and biology teaching labs with shared study rooms.',
    lat: 52.24405,
    lng: 4.4532,
    hasElevator: true,
    floors: [
      { level: 0, name: 'Ground floor', width: 48, height: 30 },
      { level: 1, name: 'First floor', width: 48, height: 30 },
    ],
  },
  {
    code: 'C',
    name: 'Caven Library & Study Centre',
    description: 'Library, quiet study rooms and group work pods with controlled admission.',
    lat: 52.24335,
    lng: 4.45195,
    hasElevator: true,
    floors: [
      { level: 0, name: 'Ground floor', width: 44, height: 28 },
      { level: 1, name: 'Study level', width: 44, height: 28 },
    ],
  },
  {
    code: 'D',
    name: 'Dunmore Administration',
    description: 'Student services, registrar and the principal’s office.',
    lat: 52.2439,
    lng: 4.44955,
    hasElevator: false,
    floors: [
      { level: 0, name: 'Ground floor', width: 40, height: 26 },
      { level: 1, name: 'First floor', width: 40, height: 26 },
    ],
  },
  {
    code: 'E',
    name: 'Ellsworth Student Union',
    description: 'Canteen, student association desks and event spaces.',
    lat: 52.2429,
    lng: 4.4538,
    hasElevator: false,
    floors: [{ level: 0, name: 'Ground floor', width: 36, height: 24 }],
    status: 'limited',
  },
];

const ROOMS: SeedRoom[] = [
  // Halden Hall — Engineering & Computing
  { building: 'A', floor: 0, code: 'A101', name: 'Lecture Theatre 1', type: 'lecture', capacity: 180, x: 6, y: 6, w: 20, h: 12, amenities: ['projector', 'hearing_loop'], accessibility: ['step_free', 'reserved_seating'] },
  { building: 'A', floor: 0, code: 'A104', name: 'Robotics Workshop', type: 'lab', capacity: 32, x: 32, y: 6, w: 16, h: 12, admission: true, amenities: ['power', 'tools'], accessibility: ['step_free'] },
  { building: 'A', floor: 0, code: 'A112', name: 'Student Project Room', type: 'study', capacity: 12, x: 6, y: 22, w: 10, h: 8, admission: true, amenities: ['whiteboard', 'monitor'] },
  { building: 'A', floor: 1, code: 'A201', name: 'Computing Lab 1', type: 'lab', capacity: 40, x: 6, y: 6, w: 18, h: 10, amenities: ['workstations'], accessibility: ['step_free', 'adjustable_desk'] },
  { building: 'A', floor: 1, code: 'A204', name: 'Software Studio', type: 'lab', capacity: 28, x: 30, y: 6, w: 16, h: 10, admission: true, amenities: ['power', 'whiteboard'] },
  { building: 'A', floor: 1, code: 'A210', name: 'Seminar Room 2', type: 'meeting', capacity: 20, x: 6, y: 22, w: 12, h: 8, amenities: ['video_conf'] },
  { building: 'A', floor: 2, code: 'A301', name: 'Networks Lab', type: 'lab', capacity: 30, x: 8, y: 6, w: 18, h: 10, amenities: ['rack_access'] },
  { building: 'A', floor: 2, code: 'A305', name: 'Staff Offices', type: 'office', capacity: 8, x: 34, y: 6, w: 14, h: 10 },
  { building: 'A', floor: 2, code: 'A312', name: 'Quiet Study', type: 'study', capacity: 16, x: 10, y: 22, w: 14, h: 8, admission: true },

  // Brixner Building — Sciences
  { building: 'B', floor: 0, code: 'B101', name: 'Chemistry Lab', type: 'lab', capacity: 36, x: 6, y: 6, w: 18, h: 10, amenities: ['fume_hood'], accessibility: ['step_free'] },
  { building: 'B', floor: 0, code: 'B110', name: 'Science Lecture Hall', type: 'lecture', capacity: 140, x: 28, y: 6, w: 16, h: 12, amenities: ['projector'] },
  { building: 'B', floor: 1, code: 'B201', name: 'Physics Lab', type: 'lab', capacity: 30, x: 6, y: 6, w: 16, h: 10, amenities: ['optical_bench'] },
  { building: 'B', floor: 1, code: 'B204', name: 'Group Study Room', type: 'study', capacity: 15, x: 26, y: 6, w: 12, h: 9, admission: true, amenities: ['whiteboard', 'display'], description: 'Bookable group study room with a wall display — controlled admission during exam weeks.' },
  { building: 'B', floor: 1, code: 'B208', name: 'Microscopy Suite', type: 'lab', capacity: 18, x: 6, y: 20, w: 14, h: 8, admission: true, amenities: ['microscopes'] },
  { building: 'B', floor: 1, code: 'B212', name: 'Tutorial Room', type: 'meeting', capacity: 24, x: 26, y: 20, w: 12, h: 8, amenities: ['whiteboard'] },

  // Caven Library & Study Centre
  { building: 'C', floor: 0, code: 'C101', name: 'Library Reading Room', type: 'library', capacity: 120, x: 6, y: 6, w: 22, h: 14, amenities: ['silent_zone'], accessibility: ['step_free'] },
  { building: 'C', floor: 0, code: 'C108', name: 'Help Desk', type: 'service', capacity: 6, x: 32, y: 6, w: 10, h: 8 },
  { building: 'C', floor: 0, code: 'C112', name: 'Group Pod 1', type: 'study', capacity: 8, x: 6, y: 22, w: 8, h: 6, admission: true, amenities: ['display'] },
  { building: 'C', floor: 1, code: 'C201', name: 'Silent Study', type: 'study', capacity: 60, x: 6, y: 6, w: 20, h: 12, amenities: ['silent_zone', 'task_light'] },
  { building: 'C', floor: 1, code: 'C205', name: 'Group Pod 2', type: 'study', capacity: 10, x: 30, y: 6, w: 10, h: 8, admission: true, amenities: ['display', 'whiteboard'] },
  { building: 'C', floor: 1, code: 'C210', name: 'Media Booth', type: 'study', capacity: 6, x: 6, y: 20, w: 8, h: 7, admission: true, amenities: ['microphone', 'camera'] },

  // Dunmore Administration
  { building: 'D', floor: 0, code: 'D-101', name: "Principal's Office", type: 'office', capacity: 6, x: 6, y: 5, w: 12, h: 8 },
  { building: 'D', floor: 0, code: 'D-102', name: "Secretary's Office", type: 'office', capacity: 4, x: 20, y: 5, w: 10, h: 8 },
  { building: 'D', floor: 0, code: 'D-110', name: 'Student Affairs', type: 'office', capacity: 10, x: 6, y: 17, w: 14, h: 8 },
  { building: 'D', floor: 0, code: 'D-118', name: 'Registrar', type: 'office', capacity: 12, x: 24, y: 17, w: 12, h: 8 },
  { building: 'D', floor: 1, code: 'D-230', name: "Dean's Office", type: 'office', capacity: 6, x: 8, y: 6, w: 12, h: 8 },
  { building: 'D', floor: 1, code: 'D-240', name: 'Board Room', type: 'meeting', capacity: 18, x: 24, y: 6, w: 12, h: 9, amenities: ['video_conf'] },

  // Ellsworth Student Union
  { building: 'E', floor: 0, code: 'E101', name: 'Canteen', type: 'other', capacity: 220, x: 5, y: 5, w: 24, h: 14 },
  { building: 'E', floor: 0, code: 'E110', name: 'Student Association Desk', type: 'service', capacity: 8, x: 6, y: 22, w: 10, h: 6 },
  { building: 'E', floor: 0, code: 'E120', name: 'Event Hall', type: 'auditorium', capacity: 150, x: 20, y: 21, w: 14, h: 10, amenities: ['stage', 'sound_system'] },
];

interface SeedCourse {
  code: string;
  title: string;
  department: string;
  credits: number;
  colour: string;
  lecturer: string; // user key
}

const COURSES: SeedCourse[] = [
  { code: 'CS201', title: 'Data Structures & Algorithms', department: 'Computer Science', credits: 6, colour: '#2F4FE3', lecturer: 'ravi' },
  { code: 'CS310', title: 'Database Systems', department: 'Computer Science', credits: 6, colour: '#7A3FE0', lecturer: 'ravi' },
  { code: 'CS340', title: 'Mobile & Ubiquitous Computing', department: 'Computer Science', credits: 5, colour: '#1D9BF0', lecturer: 'ravi' },
  { code: 'MATH204', title: 'Linear Algebra', department: 'Mathematics', credits: 6, colour: '#0E9F6E', lecturer: 'lena' },
  { code: 'PHYS101', title: 'Mechanics & Thermodynamics', department: 'Physics', credits: 6, colour: '#E3A008', lecturer: 'yusuf' },
  { code: 'PHYS220', title: 'Experimental Physics', department: 'Physics', credits: 4, colour: '#D97706', lecturer: 'yusuf' },
  { code: 'ENG150', title: 'Technical Writing', department: 'Languages', credits: 3, colour: '#DB2777', lecturer: 'lena' },
  { code: 'BUS220', title: 'Campus Entrepreneurship', department: 'Business', credits: 4, colour: '#0891B2', lecturer: 'lena' },
];

interface SeedUser {
  key: string;
  name: string;
  email: string;
  role: 'admin' | 'staff' | 'student';
  registrationNo?: string;
  department?: string;
}

const USERS: SeedUser[] = [
  { key: 'admin', name: 'Amara Osei', email: 'admin@campusflow.dev', role: 'admin', department: 'Facilities & IT' },
  { key: 'ravi', name: 'Dr Ravi Menon', email: 'ravi.menon@campusflow.dev', role: 'staff', registrationNo: 'STF-1001', department: 'Computer Science' },
  { key: 'lena', name: 'Prof. Lena Fischer', email: 'lena.fischer@campusflow.dev', role: 'staff', registrationNo: 'STF-1002', department: 'Mathematics' },
  { key: 'yusuf', name: 'Dr Yusuf Karim', email: 'yusuf.karim@campusflow.dev', role: 'staff', registrationNo: 'STF-1003', department: 'Physics' },
  { key: 'priya', name: 'Priya Raman', email: 'priya.raman@campusflow.dev', role: 'staff', registrationNo: 'STF-1004', department: 'Student Services' },
  { key: 'marcus', name: 'Marcus Bell', email: 'marcus.bell@campusflow.dev', role: 'staff', registrationNo: 'STF-1005', department: 'Student Services' },
  { key: 'staff', name: 'Priya Raman', email: 'staff@campusflow.dev', role: 'staff', registrationNo: 'STF-1006', department: 'Student Services' },
  { key: 'sofia', name: 'Sofia Alvarez', email: 'student@campusflow.dev', role: 'student', registrationNo: '2026-0101', department: 'Computer Science' },
  { key: 'jonas', name: 'Jonas Weber', email: 'jonas.weber@campusflow.dev', role: 'student', registrationNo: '2026-0102', department: 'Computer Science' },
  { key: 'amara', name: 'Amara Nwosu', email: 'amara.nwosu@campusflow.dev', role: 'student', registrationNo: '2026-0103', department: 'Physics' },
  { key: 'tomas', name: 'Tomás Silva', email: 'tomas.silva@campusflow.dev', role: 'student', registrationNo: '2026-0104', department: 'Mathematics' },
  { key: 'hana', name: 'Hana Suzuki', email: 'hana.suzuki@campusflow.dev', role: 'student', registrationNo: '2026-0105', department: 'Computer Science' },
  { key: 'daniel', name: 'Daniel Costache', email: 'daniel.costache@campusflow.dev', role: 'student', registrationNo: '2026-0106', department: 'Business' },
];

const ENROLLMENTS: Record<string, string[]> = {
  sofia: ['CS201', 'CS310', 'CS340', 'MATH204', 'ENG150'],
  jonas: ['CS201', 'CS310', 'PHYS101', 'MATH204'],
  amara: ['PHYS101', 'PHYS220', 'MATH204'],
  tomas: ['MATH204', 'ENG150', 'BUS220'],
  hana: ['CS201', 'CS340', 'PHYS101', 'BUS220'],
  daniel: ['BUS220', 'ENG150', 'CS201'],
};

interface SeedEntry {
  course: string;
  room: string;
  staff: string;
  day: number; // 1 = Monday
  from: string;
  to: string;
  type?: 'lecture' | 'lab' | 'tutorial' | 'seminar';
}

const TIMETABLE: SeedEntry[] = [
  { course: 'CS201', room: 'A101', staff: 'ravi', day: 1, from: '09:00', to: '10:30' },
  { course: 'CS201', room: 'A201', staff: 'ravi', day: 3, from: '11:00', to: '12:30', type: 'lab' },
  { course: 'CS310', room: 'A110', staff: 'ravi', day: 2, from: '13:00', to: '14:30' },
  { course: 'CS310', room: 'A204', staff: 'ravi', day: 4, from: '09:00', to: '10:30', type: 'lab' },
  { course: 'CS340', room: 'A210', staff: 'ravi', day: 4, from: '14:00', to: '15:30' },
  { course: 'CS340', room: 'A301', staff: 'ravi', day: 5, from: '10:00', to: '11:30', type: 'lab' },
  { course: 'MATH204', room: 'B110', staff: 'lena', day: 1, from: '11:00', to: '12:30' },
  { course: 'MATH204', room: 'B212', staff: 'lena', day: 3, from: '09:00', to: '10:00', type: 'tutorial' },
  { course: 'MATH204', room: 'B110', staff: 'lena', day: 4, from: '11:00', to: '12:30' },
  { course: 'PHYS101', room: 'B110', staff: 'yusuf', day: 2, from: '09:00', to: '10:30' },
  { course: 'PHYS101', room: 'B201', staff: 'yusuf', day: 4, from: '13:00', to: '15:00', type: 'lab' },
  { course: 'PHYS101', room: 'B110', staff: 'yusuf', day: 5, from: '09:00', to: '10:30' },
  { course: 'PHYS220', room: 'B101', staff: 'yusuf', day: 3, from: '14:00', to: '17:00', type: 'lab' },
  { course: 'ENG150', room: 'D-240', staff: 'lena', day: 2, from: '15:00', to: '16:30' },
  { course: 'ENG150', room: 'D-240', staff: 'lena', day: 4, from: '15:30', to: '17:00' },
  { course: 'BUS220', room: 'E120', staff: 'lena', day: 1, from: '15:00', to: '17:00' },
  { course: 'BUS220', room: 'E110', staff: 'lena', day: 5, from: '13:00', to: '14:30', type: 'seminar' },
];

interface SeedOffice {
  code: string;
  name: string;
  room: string;
  prefix: string;
  duration: number;
  capacity: number;
  dailyCapacity: number;
  radius: number;
  grace: number;
  proximity: boolean;
  staff: string[];
}

const OFFICES: SeedOffice[] = [
  { code: 'PRINCIPAL', name: "Principal's Office", room: 'D-101', prefix: 'P', duration: 12, capacity: 1, dailyCapacity: 12, radius: 45, grace: 300, proximity: true, staff: ['priya'] },
  { code: 'SECRETARY', name: "Secretary's Office", room: 'D-102', prefix: 'S', duration: 8, capacity: 2, dailyCapacity: 40, radius: 45, grace: 240, proximity: false, staff: ['staff'] },
  { code: 'AFFAIRS', name: 'Student Affairs Office', room: 'D-110', prefix: 'SA', duration: 10, capacity: 3, dailyCapacity: 60, radius: 60, grace: 300, proximity: false, staff: ['marcus', 'staff'] },
  { code: 'DEAN', name: "Dean's Office", room: 'D-230', prefix: 'D', duration: 15, capacity: 1, dailyCapacity: 10, radius: 45, grace: 420, proximity: true, staff: ['priya'] },
  { code: 'REGISTRAR', name: 'Registrar', room: 'D-118', prefix: 'R', duration: 9, capacity: 2, dailyCapacity: 80, radius: 60, grace: 300, proximity: false, staff: ['marcus'] },
];

/* ----------------------------------------------------------------- helpers */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(20260910);

function rectangleFootprint(lat: number, lng: number, widthM: number, depthM: number): [number, number][] {
  const dLat = depthM / 2 / 111_320;
  const dLng = widthM / 2 / (111_320 * Math.cos((lat * Math.PI) / 180));
  return [
    [Number((lng - dLng).toFixed(6)), Number((lat - dLat).toFixed(6))],
    [Number((lng + dLng).toFixed(6)), Number((lat - dLat).toFixed(6))],
    [Number((lng + dLng).toFixed(6)), Number((lat + dLat).toFixed(6))],
    [Number((lng - dLng).toFixed(6)), Number((lat + dLat).toFixed(6))],
    [Number((lng - dLng).toFixed(6)), Number((lat - dLat).toFixed(6))],
  ];
}

function planToLatLng(lat: number, lng: number, x: number, y: number) {
  return {
    lat: Number((lat - y / 111_320).toFixed(6)),
    lng: Number((lng + x / (111_320 * Math.cos((lat * Math.PI) / 180))).toFixed(6)),
  };
}

async function insert<T extends Record<string, unknown>>(
  db: Db,
  sql: string,
  params: unknown[],
): Promise<T> {
  const row = await db.one<T>(sql, params);
  if (!row) throw new Error(`seed insert returned no row: ${sql.slice(0, 60)}`);
  return row;
}

/* -------------------------------------------------------------------- main */

export interface SeedOptions {
  /** Password given to every demo account. */
  password?: string;
  /** Progress printer. Defaults to silence so tests stay quiet. */
  log?: (message: string) => void;
  /** Skip the week of historical queue activity (faster test databases). */
  activityDays?: number;
}

export interface SeedSummary {
  users: number;
  rooms: number;
  navigation_nodes: number;
  navigation_edges: number;
  qr_nodes: number;
  queues: number;
  offices: number;
  queue_tickets: number;
  office_tickets: number;
  password: string;
}

export async function seedDatabase(db: Db, options: SeedOptions = {}): Promise<SeedSummary> {
  const log = options.log ?? (() => {});
  const password = options.password ?? DEMO_PASSWORD;

  log('clearing previous seed data');
  await db.exec(`
    TRUNCATE TABLE
      ai_messages, ai_conversations, notifications, device_tokens, event_registrations,
      queue_check_ins, queue_events, queue_tickets, queue_counters, room_queues,
      office_check_ins, office_ticket_events, office_tickets, office_counters, office_staff,
      office_service_windows, administrative_offices,
      navigation_events, navigation_deviations, navigation_sessions,
      idempotency_keys, user_positions,
      timetable_entries, enrollments, course_staff, courses, terms,
      geofences, navigation_edges, navigation_nodes, qr_nodes,
      room_availability_rules, rooms, floors, buildings,
      staff_assignments, password_reset_tokens, api_tokens, audit_logs, settings, users,
      announcements, events
    RESTART IDENTITY CASCADE;
  `);

  /* ------------------------------------------------------------- reference data */

  await db.query(
    `INSERT INTO roles (code, name, description, rank) VALUES
       ('visitor', 'Visitor', 'Public campus access', 0),
       ('student', 'Student', 'Enrolled student', 10),
       ('staff', 'Staff', 'Lecturer or administrative officer', 20),
       ('admin', 'Administrator', 'Campus administrator', 30)
     ON CONFLICT (code) DO NOTHING`,
  );

  const permissionCodes = [
    'timetable.view.own', 'room.search', 'queue.join', 'queue.view.own', 'office.request', 'office.view.own',
    'navigation.use', 'assistant.use', 'notifications.view.own', 'profile.manage.own',
    'timetable.manage', 'content.publish', 'queue.operate', 'queue.monitor', 'office.operate', 'office.monitor',
    'users.manage', 'campus.manage', 'spatial.manage', 'queues.manage', 'offices.manage', 'academics.manage',
    'events.manage', 'analytics.view',
  ];
  for (const code of permissionCodes) {
    await db.query('INSERT INTO permissions (code, description) VALUES ($1, $1) ON CONFLICT (code) DO NOTHING', [code]);
  }
  for (const [role, permissions] of Object.entries({
    student: ['timetable.view.own', 'room.search', 'queue.join', 'queue.view.own', 'office.request', 'office.view.own', 'navigation.use', 'assistant.use', 'notifications.view.own', 'profile.manage.own'],
    staff: ['timetable.view.own', 'room.search', 'queue.view.own', 'office.view.own', 'navigation.use', 'assistant.use', 'notifications.view.own', 'profile.manage.own', 'timetable.manage', 'content.publish', 'queue.operate', 'queue.monitor', 'office.operate', 'office.monitor'],
    admin: permissionCodes,
  })) {
    for (const permission of permissions) {
      await db.query(
        'INSERT INTO role_permissions (role_code, permission_code) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [role, permission],
      );
    }
  }

  await db.query(
    `INSERT INTO settings (key, value) VALUES
       ('queue.ghost_timeout_minutes', '45'::jsonb),
       ('queue.default_check_in_window_seconds', '300'::jsonb),
       ('campus.timezone', $1::jsonb),
       ('navigation.off_route_grace_seconds', '20'::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(process.env.CAMPUS_TIMEZONE ?? 'UTC')],
  );

  /* ------------------------------------------------------------------- users */

  log('creating users');
  const passwordHash = await hashPassword(password);
  const userIds = new Map<string, string>();
  for (const user of USERS) {
    const row = await insert<{ id: string }>(
      db,
      `INSERT INTO users (name, email, password_hash, role_code, registration_no, department, status, email_verified_at, last_login_at)
       VALUES ($1,$2,$3,$4,$5,$6,'active', now(), now() - interval '1 day')
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [user.name, user.email, passwordHash, user.role, user.registrationNo ?? null, user.department ?? null],
    );
    userIds.set(user.key, row.id);
  }

  /* --------------------------------------------------------------- buildings */

  log('creating buildings, floors and rooms');
  const buildingIds = new Map<string, string>();
  const floorIds = new Map<string, string>();
  for (const building of BUILDINGS) {
    const footprint = rectangleFootprint(building.lat, building.lng, 70, 55);
    const row = await insert<{ id: string }>(
      db,
      `INSERT INTO buildings (code, name, description, campus_name, address, lat, lng, footprint, has_elevator, is_public, opening_hours, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10,$11) RETURNING id`,
      [
        building.code,
        building.name,
        building.description,
        CAMPUS.name,
        `${building.code} Wing, ${CAMPUS.name}, Northfield`,
        building.lat,
        building.lng,
        JSON.stringify(footprint),
        building.hasElevator,
        JSON.stringify({
          monday: '07:30-21:00', tuesday: '07:30-21:00', wednesday: '07:30-21:00',
          thursday: '07:30-21:00', friday: '07:30-20:00', saturday: '09:00-17:00', sunday: 'closed',
        }),
        building.status ?? 'operational',
      ],
    );
    buildingIds.set(building.code, row.id);
    for (const floor of building.floors) {
      const floorRow = await insert<{ id: string }>(
        db,
        `INSERT INTO floors (building_id, level, name, plan_width, plan_height) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [row.id, floor.level, floor.name, floor.width, floor.height],
      );
      floorIds.set(`${building.code}-${floor.level}`, floorRow.id);
    }
  }

  const roomIds = new Map<string, string>();
  for (const room of ROOMS) {
    const buildingLat = BUILDINGS.find((building) => building.code === room.building)!.lat;
    const buildingLng = BUILDINGS.find((building) => building.code === room.building)!.lng;
    const centroid = planToLatLng(buildingLat, buildingLng, room.x + room.w / 2, room.y + room.h / 2);
    const row = await insert<{ id: string }>(
      db,
      `INSERT INTO rooms (building_id, floor_id, code, name, room_type, capacity, description, requires_admission,
                          plan_x, plan_y, plan_w, plan_h, lat, lng, amenities, accessibility, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'available') RETURNING id`,
      [
        buildingIds.get(room.building),
        floorIds.get(`${room.building}-${room.floor}`),
        room.code,
        room.name,
        room.type,
        room.capacity,
        room.description ?? null,
        room.admission ?? false,
        room.x,
        room.y,
        room.w,
        room.h,
        centroid.lat,
        centroid.lng,
        JSON.stringify(room.amenities ?? []),
        JSON.stringify(room.accessibility ?? ['step_free']),
      ],
    );
    roomIds.set(room.code, row.id);

    // Every room is open during teaching hours unless it has its own rules.
    for (let day = 1; day <= 5; day += 1) {
      await db.query(
        `INSERT INTO room_availability_rules (room_id, day_of_week, opens_at, closes_at, kind) VALUES ($1,$2,$3,$4,'open')`,
        [row.id, day, room.type === 'library' ? '08:00' : '08:00', room.type === 'service' ? '17:00' : '20:00'],
      );
    }
    if (room.type === 'library') {
      await db.query(`INSERT INTO room_availability_rules (room_id, day_of_week, opens_at, closes_at, kind) VALUES ($1,6,'09:00','17:00','open')`, [row.id]);
    }
  }

  /* ------------------------------------------------------------ navigation graph */

  log('building navigation graph, QR anchors and geofences');
  const nodeIds = new Map<string, string>();
  const nodeCoords = new Map<string, { lat: number | null; lng: number | null; floor: string | null; plan_x: number | null; plan_y: number | null }>();
  const qrNodeRows: { code: string; label: string; building: string; floor: number; x: number; y: number; room?: string; nodeKey: string }[] = [];

  async function addNode(params: {
    code: string;
    label: string;
    building: string;
    floor: number | null;
    kind: string;
    x?: number | null;
    y?: number | null;
    lat?: number | null;
    lng?: number | null;
    accessible?: boolean;
  }): Promise<string> {
    const row = await insert<{ id: string }>(
      db,
      `INSERT INTO navigation_nodes (code, label, building_id, floor_id, kind, plan_x, plan_y, lat, lng, is_accessible, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true) RETURNING id`,
      [
        params.code,
        params.label,
        buildingIds.get(params.building) ?? null,
        params.floor === null ? null : floorIds.get(`${params.building}-${params.floor}`),
        params.kind,
        params.x ?? null,
        params.y ?? null,
        params.lat ?? null,
        params.lng ?? null,
        params.accessible ?? true,
      ],
    );
    nodeIds.set(params.code, row.id);
    nodeCoords.set(params.code, {
      lat: params.lat ?? null,
      lng: params.lng ?? null,
      floor: params.floor === null ? null : `${params.building}-${params.floor}`,
      plan_x: params.x ?? null,
      plan_y: params.y ?? null,
    });
    return row.id;
  }

  async function addEdge(from: string, to: string, kind: string, options: { floorChange?: boolean; accessible?: boolean; distance?: number } = {}) {
    const a = nodeCoords.get(from)!;
    const b = nodeCoords.get(to)!;
    let distance = options.distance ?? 0;
    if (!options.distance) {
      if (a.plan_x !== null && b.plan_x !== null && a.plan_y !== null && b.plan_y !== null && a.floor === b.floor) {
        distance = Math.hypot(a.plan_x - b.plan_x, a.plan_y - b.plan_y);
      } else if (a.lat !== null && b.lat !== null && a.lng !== null && b.lng !== null) {
        const dLat = (b.lat - a.lat) * 111_320;
        const dLng = (b.lng - a.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
        distance = Math.hypot(dLat, dLng);
      } else {
        distance = options.floorChange ? 18 : 12;
      }
    }
    await db.query(
      `INSERT INTO navigation_edges (from_node_id, to_node_id, kind, distance_m, bidirectional, is_accessible, is_active, floor_change)
       VALUES ($1,$2,$3,$4,true,$5,true,$6) ON CONFLICT DO NOTHING`,
      [nodeIds.get(from), nodeIds.get(to), kind, Math.round(distance * 10) / 10, options.accessible ?? kind !== 'stairs', options.floorChange ?? false],
    );
  }

  // Indoor graph per building floor: a corridor spine with stairs, lift and room doors.
  for (const building of BUILDINGS) {
    const specs = BUILDINGS.find((candidate) => candidate.code === building.code)!;
    for (const floor of specs.floors) {
      const corridorY = floor.height / 2;
      const xs = [4, 14, 24, 34, floor.width - 6];
      xs.forEach((x, index) => {
        void addNode({
          code: `${specs.code}-F${floor.level}-C${index + 1}`,
          label: `${specs.name} ${floor.name} corridor ${index + 1}`,
          building: specs.code,
          floor: floor.level,
          kind: index === 0 ? 'junction' : 'corridor',
          x,
          y: corridorY,
        });
      });

      await addNode({
        code: `${specs.code}-F${floor.level}-ST`,
        label: `${specs.name} ${floor.name} stairs`,
        building: specs.code,
        floor: floor.level,
        kind: 'stairs',
        x: 2,
        y: 3,
        accessible: false,
      });
      if (specs.hasElevator) {
        await addNode({
          code: `${specs.code}-F${floor.level}-EL`,
          label: `${specs.name} ${floor.name} lift`,
          building: specs.code,
          floor: floor.level,
          kind: 'elevator',
          x: 2,
          y: 6,
          accessible: true,
        });
      }

      // Corridor chain.
      for (let index = 0; index < xs.length - 1; index += 1) {
        await addEdge(`${specs.code}-F${floor.level}-C${index + 1}`, `${specs.code}-F${floor.level}-C${index + 2}`, 'corridor');
      }
      await addEdge(`${specs.code}-F${floor.level}-C1`, `${specs.code}-F${floor.level}-ST`, 'door');
      if (specs.hasElevator) {
        await addEdge(`${specs.code}-F${floor.level}-C1`, `${specs.code}-F${floor.level}-EL`, 'door');
      }

      // Room door nodes, connected to the nearest corridor node.
      const floorRooms = ROOMS.filter((room) => room.building === specs.code && room.floor === floor.level);
      for (const room of floorRooms) {
        const doorX = room.x + room.w / 2;
        const doorY = room.y + room.h;
        await addNode({
          code: `${room.code}-DOOR`,
          label: `${room.name} (${room.code}) entrance`,
          building: specs.code,
          floor: floor.level,
          kind: room.type === 'office' || room.type === 'service' ? 'service' : 'room',
          x: doorX,
          y: Math.min(floor.height - 1, doorY),
        });
        let nearest = xs[0]!;
        let bestDistance = Number.POSITIVE_INFINITY;
        for (const x of xs) {
          const distance = Math.hypot(x - doorX, corridorY - doorY);
          if (distance < bestDistance) {
            bestDistance = distance;
            nearest = x;
          }
        }
        const nearestIndex = xs.indexOf(nearest) + 1;
        await addEdge(`${room.code}-DOOR`, `${specs.code}-F${floor.level}-C${nearestIndex}`, 'door');
      }
    }

    // Vertical connections between floors.
    for (let index = 0; index < specs.floors.length - 1; index += 1) {
      const lower = specs.floors[index]!;
      const upper = specs.floors[index + 1]!;
      await addEdge(`${specs.code}-F${lower.level}-ST`, `${specs.code}-F${upper.level}-ST`, 'stairs', {
        floorChange: true,
        accessible: false,
        distance: 16,
      });
      if (specs.hasElevator) {
        await addEdge(`${specs.code}-F${lower.level}-EL`, `${specs.code}-F${upper.level}-EL`, 'elevator', {
          floorChange: true,
          accessible: true,
          distance: 14,
        });
      }
    }

    // Outdoor entrance + connection to the campus plaza.
    const entrance = planToLatLng(specs.lat, specs.lng, specs.floors[0]!.width / 2, specs.floors[0]!.height + 6);
    await addNode({
      code: `${specs.code}-ENTRANCE`,
      label: `${specs.name} main entrance`,
      building: specs.code,
      floor: 0,
      kind: 'entrance',
      lat: entrance.lat,
      lng: entrance.lng,
      x: specs.floors[0]!.width / 2,
      y: specs.floors[0]!.height + 6,
    });
    await addEdge(`${specs.code}-ENTRANCE`, `${specs.code}-F0-C1`, 'door');

    qrNodeRows.push({
      code: `QR-${specs.code}-ENTRANCE`,
      label: `${specs.name} main entrance`,
      building: specs.code,
      floor: 0,
      x: specs.floors[0]!.width / 2,
      y: specs.floors[0]!.height + 6,
      nodeKey: `${specs.code}-ENTRANCE`,
    });
  }

  // Campus plaza links every building entrance (outdoor walking network).
  await addNode({ code: 'CAMPUS-PLAZA', label: 'Campus plaza', building: 'A', floor: null, kind: 'outdoor', lat: CAMPUS.lat, lng: CAMPUS.lng });
  for (const building of BUILDINGS) {
    await addEdge('CAMPUS-PLAZA', `${building.code}-ENTRANCE`, 'outdoor');
  }
  await addEdge('CAMPUS-PLAZA', 'E-ENTRANCE', 'outdoor', { distance: 60 });
  await addEdge('CAMPUS-PLAZA', 'C-ENTRANCE', 'outdoor', { distance: 95 });
  await addEdge('CAMPUS-PLAZA', 'D-ENTRANCE', 'outdoor', { distance: 80 });

  // QR anchors: entrances, one per corridor per floor, and outside every admission room.
  for (const building of BUILDINGS) {
    const specs = BUILDINGS.find((candidate) => candidate.code === building.code)!;
    for (const floor of specs.floors) {
      const floorRooms = ROOMS.filter((room) => room.building === specs.code && room.floor === floor.level);
      for (const room of floorRooms.filter((candidate) => candidate.admission)) {
        qrNodeRows.push({
          code: `QR-${room.code}-DOOR`,
          label: `${room.name} door`,
          building: specs.code,
          floor: floor.level,
          x: room.x + room.w / 2,
          y: Math.min(floor.height - 1, room.y + room.h),
          room: room.code,
          nodeKey: `${room.code}-DOOR`,
        });
      }
      qrNodeRows.push({
        code: `QR-${specs.code}-F${floor.level}-CORRIDOR`,
        label: `${specs.name} ${floor.name} corridor`,
        building: specs.code,
        floor: floor.level,
        x: 24,
        y: floor.height / 2,
        nodeKey: `${specs.code}-F${floor.level}-C3`,
      });
    }
  }
  for (const office of OFFICES) {
    const room = ROOMS.find((candidate) => candidate.code === office.room)!;
    const floor = BUILDINGS.find((building) => building.code === room.building)!.floors.find((f) => f.level === room.floor)!;
    qrNodeRows.push({
      code: `QR-${office.code}-DOOR`,
      label: `${office.name} reception`,
      building: room.building,
      floor: room.floor,
      x: room.x + room.w / 2,
      y: Math.min(floor.height - 1, room.y + room.h),
      room: office.room,
      nodeKey: `${office.room}-DOOR`,
    });
  }

  const qrNodeIds = new Map<string, string>();
  for (const anchor of qrNodeRows) {
    const buildingLat = BUILDINGS.find((building) => building.code === anchor.building)!.lat;
    const buildingLng = BUILDINGS.find((building) => building.code === anchor.building)!.lng;
    const geo = planToLatLng(buildingLat, buildingLng, anchor.x, anchor.y);
    const row = await insert<{ id: string }>(
      db,
      `INSERT INTO qr_nodes (code, label, building_id, floor_id, room_id, nav_node_id, plan_x, plan_y, lat, lng, secret, version, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,1,true) RETURNING id`,
      [
        anchor.code,
        anchor.label,
        buildingIds.get(anchor.building),
        floorIds.get(`${anchor.building}-${anchor.floor}`),
        anchor.room ? roomIds.get(anchor.room) ?? null : null,
        nodeIds.get(anchor.nodeKey) ?? null,
        anchor.x,
        anchor.y,
        geo.lat,
        geo.lng,
        `secret-${anchor.code.toLowerCase()}-${Math.floor(random() * 1e9).toString(36)}`,
      ],
    );
    qrNodeIds.set(anchor.code, row.id);
  }

  // Geofences: queue rooms use a queue_join purpose, offices use check_in.
  for (const room of ROOMS.filter((candidate) => candidate.admission)) {
    const building = BUILDINGS.find((candidate) => candidate.code === room.building)!;
    const geo = planToLatLng(building.lat, building.lng, room.x + room.w / 2, room.y + room.h / 2);
    await db.query(
      `INSERT INTO geofences (name, target_type, target_id, center_lat, center_lng, radius_m, purpose, is_active)
       VALUES ($1,'room',$2,$3,$4,$5,'queue_join',true)`,
      [`${room.code} admission zone`, roomIds.get(room.code), geo.lat, geo.lng, 90],
    );
  }
  for (const office of OFFICES) {
    const room = ROOMS.find((candidate) => candidate.code === office.room)!;
    const building = BUILDINGS.find((candidate) => candidate.code === room.building)!;
    const geo = planToLatLng(building.lat, building.lng, room.x + room.w / 2, room.y + room.h / 2);
    await db.query(
      `INSERT INTO geofences (name, target_type, target_id, center_lat, center_lng, radius_m, purpose, is_active)
       VALUES ($1,'office',$2,$3,$4,$5,'check_in',true)`,
      [`${office.name} check-in zone`, roomIds.get(office.room), geo.lat, geo.lng, office.radius],
    );
  }

  /* ---------------------------------------------------------------- academics */

  log('creating terms, courses, enrolments and the master timetable');
  await db.query(
    `INSERT INTO terms (code, name, starts_on, ends_on, is_current) VALUES
       ('2026-FALL', 'Autumn term 2026', '2026-09-01', '2026-12-18', true),
       ('2027-SPRING', 'Spring term 2027', '2027-02-01', '2027-06-11', false)`,
  );

  const courseIds = new Map<string, string>();
  for (const course of COURSES) {
    const row = await insert<{ id: string }>(
      db,
      `INSERT INTO courses (code, title, department, credits, colour, level, is_active)
       VALUES ($1,$2,$3,$4,$5,'undergraduate',true) RETURNING id`,
      [course.code, course.title, course.department, course.credits, course.colour],
    );
    courseIds.set(course.code, row.id);
    await db.query(
      `INSERT INTO course_staff (course_id, user_id, role) VALUES ($1,$2,'lecturer') ON CONFLICT DO NOTHING`,
      [row.id, userIds.get(course.lecturer)],
    );
  }

  for (const [studentKey, codes] of Object.entries(ENROLLMENTS)) {
    for (const code of codes) {
      await db.query(
        `INSERT INTO enrollments (student_id, course_id, term_code, status) VALUES ($1,$2,'2026-FALL','enrolled')
         ON CONFLICT DO NOTHING`,
        [userIds.get(studentKey), courseIds.get(code)],
      );
    }
  }

  for (const entry of TIMETABLE) {
    await db.query(
      `INSERT INTO timetable_entries (course_id, room_id, staff_id, term_code, day_of_week, starts_at, ends_at, session_type, created_by)
       VALUES ($1,$2,$3,'2026-FALL',$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
      [
        courseIds.get(entry.course),
        roomIds.get(entry.room) ?? null,
        userIds.get(entry.staff),
        entry.day,
        entry.from,
        entry.to,
        entry.type ?? 'lecture',
        userIds.get('admin'),
      ],
    );
  }

  /* ------------------------------------------------------------------- queues */

  log('configuring admission queues and administrative offices');
  // Study pods turn over quickly; labs and workshops hold their slots longer.
  const queueConfigs = ROOMS.filter((room) => room.admission).map((room) => ({
    code: room.code,
    maxSize: Math.max(12, Math.round(room.capacity * 1.5)),
    admission: room.type === 'study' ? 3 : 2,
    averageService: room.type === 'study' ? 1800 : room.code.startsWith('B') ? 2400 : 3600,
  }));

  const queueIds = new Map<string, string>();
  for (const config of queueConfigs) {
    const averageService = config.averageService;
    const row = await insert<{ id: string }>(
      db,
      `INSERT INTO room_queues (room_id, is_active, max_size, admission_capacity, avg_service_seconds, proximity_radius_m,
                                requires_proximity_to_join, check_in_window_seconds, grace_period_seconds,
                                max_active_tickets_per_student, opens_at, closes_at, notes)
       VALUES ($1, true, $2, $3, $4, 120, true, 300, 180, 3, '08:00', '20:00', $5) RETURNING id`,
      [
        roomIds.get(config.code),
        config.maxSize,
        config.admission,
        averageService,
        config.code.startsWith('C')
          ? 'Study pods require you to be in the building when you join.'
          : 'Admission is granted in order of arrival.',
      ],
    );
    queueIds.set(config.code, row.id);
  }

  const officeIds = new Map<string, string>();
  for (const office of OFFICES) {
    const room = ROOMS.find((candidate) => candidate.code === office.room)!;
    const row = await insert<{ id: string }>(
      db,
      `INSERT INTO administrative_offices (code, name, description, building_id, floor_id, room_id, ticket_prefix,
                                            service_duration_minutes, concurrent_capacity, daily_capacity,
                                            check_in_radius_m, grace_period_seconds, requires_proximity_to_request,
                                            requires_appointment, contact_email, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,false,$14,true) RETURNING id`,
      [
        office.code,
        office.name,
        `${office.name} — appointments, documents and student support.`,
        buildingIds.get(room.building),
        floorIds.get(`${room.building}-${room.floor}`),
        roomIds.get(office.room),
        office.prefix,
        office.duration,
        office.capacity,
        office.dailyCapacity,
        office.radius,
        office.grace,
        office.proximity,
        `${office.code.toLowerCase()}@campusflow.dev`,
      ],
    );
    officeIds.set(office.code, row.id);

    // Service windows: every weekday, shorter on Wednesday afternoons.
    for (let day = 1; day <= 5; day += 1) {
      const closesAt = day === 3 ? '12:30' : day === 5 ? '15:00' : '16:00';
      await db.query(
        `INSERT INTO office_service_windows (office_id, day_of_week, opens_at, closes_at, capacity, avg_service_minutes, is_active)
         VALUES ($1,$2,'08:30',$3,$4,$5,true)`,
        [row.id, day, closesAt, office.dailyCapacity, office.duration],
      );
    }
    for (const staffKey of office.staff) {
      await db.query(
        `INSERT INTO office_staff (office_id, user_id, role, is_primary) VALUES ($1,$2,'officer',$3) ON CONFLICT DO NOTHING`,
        [row.id, userIds.get(staffKey), staffKey === office.staff[0]],
      );
    }
  }

  /* --------------------------------------------------------- staff assignments */

  const staffAssignments: { user: string; scope: 'building' | 'room' | 'office' | 'queue'; value: string; timetable?: boolean; content?: boolean }[] = [
    { user: 'staff', scope: 'building', value: buildingIds.get('D')!, timetable: false, content: true },
    { user: 'priya', scope: 'office', value: officeIds.get('PRINCIPAL')!, content: false },
    { user: 'priya', scope: 'office', value: officeIds.get('DEAN')!, content: false },
    { user: 'marcus', scope: 'office', value: officeIds.get('AFFAIRS')!, content: true },
    { user: 'marcus', scope: 'office', value: officeIds.get('REGISTRAR')!, content: false },
    { user: 'ravi', scope: 'building', value: buildingIds.get('A')!, timetable: true, content: true },
    { user: 'lena', scope: 'building', value: buildingIds.get('B')!, timetable: true, content: false },
    { user: 'yusuf', scope: 'room', value: roomIds.get('B204')!, timetable: true, content: false },
  ];

  for (const assignment of staffAssignments) {
    await db.query(
      `INSERT INTO staff_assignments (user_id, scope_type, scope_id, role_in_scope, can_manage_timetable, can_publish_content, can_call_tickets)
       VALUES ($1,$2,$3,'operator',$4,$5,true) ON CONFLICT DO NOTHING`,
      [userIds.get(assignment.user), assignment.scope, assignment.value, assignment.timetable ?? false, assignment.content ?? false],
    );
  }

  /* -------------------------------------------------- historical queue activity */

  log('generating a week of queue and office service history');
  const studentKeys = ['sofia', 'jonas', 'amara', 'tomas', 'hana', 'daniel'];
  const queueCodes = [...queueIds.keys()];
  let ticketCounter = 0;

  const activityDays = options.activityDays ?? 7;
  for (let dayOffset = activityDays; dayOffset >= 1; dayOffset -= 1) {
    const issuedPerQueue = 2 + Math.floor(random() * 3);
    for (const code of queueCodes) {
      const queueId = queueIds.get(code)!;
      for (let index = 0; index < issuedPerQueue; index += 1) {
        ticketCounter += 1;
        const student = userIds.get(studentKeys[Math.floor(random() * studentKeys.length)]!)!;
        const issuedAt = `now() - interval '${dayOffset} days' + interval '${8 + index * 2} hours'`;
        const waited = 4 + Math.floor(random() * 26);
        const served = 6 + Math.floor(random() * 20);
        const roll = random();
        const status = roll < 0.72 ? 'COMPLETED' : roll < 0.86 ? 'NO_SHOW' : roll < 0.94 ? 'CANCELLED' : 'EXPIRED';

        await db.query(
          `INSERT INTO queue_tickets (queue_id, room_id, student_id, ticket_number, sequence_no, position, status,
                                      issued_at, called_at, check_in_deadline, checked_in_at, admitted_at, completed_at,
                                      no_show_at, cancelled_at, expired_at, eta_seconds)
           VALUES ($1, (SELECT room_id FROM room_queues WHERE id = $1), $2, $3, $4, $5, $6,
                   ${issuedAt}, ${issuedAt} + interval '${waited} minutes',
                   ${issuedAt} + interval '${waited + 6} minutes',
                   ${status === 'COMPLETED' ? `${issuedAt} + interval '${waited + 2} minutes'` : 'NULL'},
                   ${status === 'COMPLETED' ? `${issuedAt} + interval '${waited + 3} minutes'` : 'NULL'},
                   ${status === 'COMPLETED' ? `${issuedAt} + interval '${waited + 3 + served} minutes'` : 'NULL'},
                   ${status === 'NO_SHOW' ? `${issuedAt} + interval '${waited + 12} minutes'` : 'NULL'},
                   ${status === 'CANCELLED' ? `${issuedAt} + interval '3 minutes'` : 'NULL'},
                   ${status === 'EXPIRED' ? `${issuedAt} + interval '${waited + 12} minutes'` : 'NULL'},
                   ${(waited + 4) * 60})`,
          [queueId, student, `${code}-${String(index + 1 + dayOffset * 4).padStart(3, '0')}`, dayOffset * 10 + index + 1, index + 1, status],
        );
      }
    }
  }

  // Office service history.
  for (let dayOffset = Math.max(1, activityDays - 1); dayOffset >= 1; dayOffset -= 1) {
    for (const office of OFFICES) {
      const officeId = officeIds.get(office.code)!;
      const issued = 3 + Math.floor(random() * 6);
      for (let index = 0; index < issued; index += 1) {
        const student = userIds.get(studentKeys[Math.floor(random() * studentKeys.length)]!)!;
        const waited = 6 + Math.floor(random() * 30);
        const served = Math.max(4, office.duration + Math.floor(random() * 6) - 3);
        const status = random() < 0.82 ? 'COMPLETED' : random() < 0.6 ? 'NO_SHOW' : 'CANCELLED';
        await db.query(
          `INSERT INTO office_tickets (office_id, student_id, ticket_number, sequence_no, position, status, subject,
                                        requested_at, called_at, check_in_deadline, checked_in_at, service_started_at,
                                        completed_at, service_minutes, no_show_at, cancelled_at, handled_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,
                   now() - interval '${dayOffset} days' + interval '${8 + index} hours',
                   now() - interval '${dayOffset} days' + interval '${8 + index} hours' + interval '${waited} minutes',
                   now() - interval '${dayOffset} days' + interval '${8 + index} hours' + interval '${waited + 6} minutes',
                   ${status === 'COMPLETED' ? `now() - interval '${dayOffset} days' + interval '${8 + index} hours' + interval '${waited + 2} minutes'` : 'NULL'},
                   ${status === 'COMPLETED' ? `now() - interval '${dayOffset} days' + interval '${8 + index} hours' + interval '${waited + 3} minutes'` : 'NULL'},
                   ${status === 'COMPLETED' ? `now() - interval '${dayOffset} days' + interval '${8 + index} hours' + interval '${waited + 3 + served} minutes'` : 'NULL'},
                   ${status === 'COMPLETED' ? served : 'NULL'},
                   ${status === 'NO_SHOW' ? `now() - interval '${dayOffset} days' + interval '${8 + index} hours' + interval '${waited + 12} minutes'` : 'NULL'},
                   ${status === 'CANCELLED' ? `now() - interval '${dayOffset} days' + interval '${8 + index} hours' + interval '4 minutes'` : 'NULL'},
                   ${status === 'COMPLETED' ? `'${userIds.get(office.staff[0])}'` : 'NULL'})`,
          [officeId, student, `${office.prefix}-${String(index + 1 + dayOffset * 5).padStart(3, '0')}`, dayOffset * 10 + index + 1, index + 1, status, officeBrief(office.code)],
        );
      }
    }
  }

  function officeBrief(code: string): string {
    const briefs: Record<string, string> = {
      PRINCIPAL: 'Appeal against a grade decision',
      SECRETARY: 'Request an enrolment certificate',
      AFFAIRS: 'Discuss a timetable clash',
      DEAN: 'Research internship approval',
      REGISTRAR: 'Transcript request',
    };
    return briefs[code] ?? 'Student service request';
  }

  // Live tickets so the staff dashboards have something to act on immediately.
  const liveJonas = await insert<{ id: string }>(
    db,
    `INSERT INTO queue_tickets (queue_id, room_id, student_id, ticket_number, sequence_no, position, status, issued_at, eta_seconds)
     VALUES ($1, (SELECT room_id FROM room_queues WHERE id = $1), $2, $3, 901, 1, 'WAITING', now() - interval '6 minutes', 1500)
     RETURNING id`,
    [queueIds.get('B204')!, userIds.get('jonas')!, `B204-${String(901).padStart(3, '0')}`],
  );
  await db.query(
    `INSERT INTO queue_events (queue_id, ticket_id, type, actor_id, metadata) VALUES ($1,$2,'ticket.issued',$3,$4)`,
    [queueIds.get('B204')!, liveJonas.id, userIds.get('jonas'), JSON.stringify({ position: 1, seeded: true })],
  );

  const liveHana = await insert<{ id: string }>(
    db,
    `INSERT INTO queue_tickets (queue_id, room_id, student_id, ticket_number, sequence_no, position, status, issued_at, eta_seconds)
     VALUES ($1, (SELECT room_id FROM room_queues WHERE id = $1), $2, $3, 902, 2, 'WAITING', now() - interval '3 minutes', 2700)
     RETURNING id`,
    [queueIds.get('C112')!, userIds.get('hana')!, 'C112-902'],
  );
  void liveHana;

  const officeTicket = await insert<{ id: string }>(
    db,
    `INSERT INTO office_tickets (office_id, student_id, ticket_number, sequence_no, position, status, subject,
                                 requested_at, window_starts_at, window_ends_at, eta_seconds)
     VALUES ($1,$2,$3, 903, 1, 'WAITING', $4, now() - interval '8 minutes', now() + interval '12 minutes', now() + interval '22 minutes', 720)
     RETURNING id`,
    [officeIds.get('AFFAIRS')!, userIds.get('tomas')!, 'SA-903', 'Clarify my examination registration'],
  );
  await db.query(
    `INSERT INTO office_ticket_events (office_id, ticket_id, type, actor_id, metadata) VALUES ($1,$2,'ticket.requested',$3,$4)`,
    [officeIds.get('AFFAIRS')!, officeTicket.id, userIds.get('tomas'), JSON.stringify({ position: 1, seeded: true })],
  );

  /* ------------------------------------------------------ events & announcements */

  await db.query(
    `INSERT INTO events (title, description, category, starts_at, ends_at, venue, building_id, room_id, capacity,
                         registration_required, organiser_id, status) VALUES
       ('Campus Career Fair', 'Meet 24 employers from the region, bring your CV.', 'career',
        now() + interval '3 days' + interval '4 hours', now() + interval '3 days' + interval '9 hours',
        'Ellsworth Student Union, Event Hall', $1, $2, 150, true, $5, 'published'),
       ('Study Skills Workshop', 'Evidence-based techniques for exam preparation.', 'academic',
        now() + interval '1 day' + interval '2 hours', now() + interval '1 day' + interval '4 hours',
        'Caven Library, Group Pod 1', $3, $4, 30, true, $6, 'published'),
       ('Interfaculty Football', 'Staff vs students friendly match on the north field.', 'sport',
        now() + interval '5 days' + interval '5 hours', now() + interval '5 days' + interval '7 hours',
        'North Field', NULL, NULL, NULL, false, $6, 'published'),
       ('Wellbeing Drop-in', 'No appointment needed — talk to a student counsellor.', 'wellbeing',
        now() + interval '2 days' + interval '1 hour', now() + interval '2 days' + interval '4 hours',
        'Dunmore Administration, D-110', $1, NULL, 40, false, $6, 'published')`,
    [
      buildingIds.get('E'),
      roomIds.get('E120'),
      buildingIds.get('C'),
      roomIds.get('C112'),
      userIds.get('admin'),
      userIds.get('marcus'),
    ],
  );

  await db.query(
    `INSERT INTO announcements (title, body, audience, priority, building_id, author_id, is_pinned, published_at)
     VALUES
       ('Library extends opening hours during exams', 'Caven Library is open until 23:00 from Monday. Group pods can be reserved through CampusFlow.', '["all"]', 'normal', $1, $4, true, now() - interval '1 day'),
       ('Lift maintenance in Halden Hall', 'The Halden Hall lift is being serviced on Friday between 08:00 and 12:00. Accessible routes via Brixner are available.', '["all"]', 'high', $2, $4, false, now() - interval '5 hours'),
       ('Course registration closes Friday', 'Add or drop courses before 17:00 on Friday. The registrar handles exceptions in person.', '["students"]', 'urgent', $3, $5, true, now() - interval '3 hours'),
       ('New queue rules for study pods', 'Study pods now require you to be inside the building when you join the queue. This reduces no-shows.', '["students","staff"]', 'normal', $1, $4, false, now() - interval '2 days')`,
    [
      buildingIds.get('C'),
      buildingIds.get('A'),
      buildingIds.get('D'),
      userIds.get('admin'),
      userIds.get('marcus'),
    ],
  );

  /* ----------------------------------------------------------- notifications */

  for (const [studentKey, message] of [
    ['sofia', { type: 'system.welcome', title: 'Welcome to CampusFlow', body: 'Scan a QR anchor on campus to share your location, then ask the assistant for directions.' }],
    ['sofia', { type: 'class.reminder', title: 'CS310 starts in 15 minutes', body: 'Database Systems · B204? No — check your timetable for the exact room.' }],
    ['jonas', { type: 'queue.ticket_issued', title: 'Ticket B204-901 confirmed', body: 'You are number 1 in the queue for B204. Estimated wait 25 minutes.' }],
    ['tomas', { type: 'office.ticket_assigned', title: 'Ticket SA-903 · Student Affairs Office', body: 'You are number 1 in the queue. Estimated wait 12 minutes.' }],
  ] as const) {
    await db.query(
      `INSERT INTO notifications (user_id, type, title, body, data, priority, created_at)
       VALUES ($1,$2,$3,$4,$5,'normal', now() - interval '1 hour')`,
      [userIds.get(studentKey), message.type, message.title, message.body, JSON.stringify({ seeded: true })],
    );
  }

  /* ------------------------------------------------------------- audit trail */

  await db.query(
    `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata, created_at) VALUES
       ($1,'seed.initialised','system', NULL, $2, now()),
       ($1,'building.created','building',$3,$4, now() - interval '2 hours'),
       ($1,'offices.updated','office',$5,$6, now() - interval '1 hour')`,
    [
      userIds.get('admin'),
      JSON.stringify({ buildings: BUILDINGS.length, rooms: ROOMS.length, courses: COURSES.length }),
      buildingIds.get('A'),
      JSON.stringify({ code: 'A', name: 'Halden Hall' }),
      officeIds.get('AFFAIRS'),
      JSON.stringify({ concurrent_capacity: 3 }),
    ],
  );

  const counts = await db.one<Record<string, string>>(
    `SELECT
        (SELECT count(*) FROM users)::text AS users,
        (SELECT count(*) FROM rooms)::text AS rooms,
        (SELECT count(*) FROM navigation_nodes)::text AS nodes,
        (SELECT count(*) FROM navigation_edges)::text AS edges,
        (SELECT count(*) FROM qr_nodes)::text AS qr_nodes,
        (SELECT count(*) FROM room_queues)::text AS queues,
        (SELECT count(*) FROM administrative_offices)::text AS offices,
        (SELECT count(*) FROM queue_tickets)::text AS queue_tickets,
        (SELECT count(*) FROM office_tickets)::text AS office_tickets`,
  );

  const campus = campusParts();
  const summary: SeedSummary = {
    users: Number(counts?.users ?? 0),
    rooms: Number(counts?.rooms ?? 0),
    navigation_nodes: Number(counts?.nodes ?? 0),
    navigation_edges: Number(counts?.edges ?? 0),
    qr_nodes: Number(counts?.qr_nodes ?? 0),
    queues: Number(counts?.queues ?? 0),
    offices: Number(counts?.offices ?? 0),
    queue_tickets: Number(counts?.queue_tickets ?? 0),
    office_tickets: Number(counts?.office_tickets ?? 0),
    password,
  };

  log('done');
  log(
    `${summary.users} users · ${summary.rooms} rooms · ${summary.navigation_nodes} nav nodes · ${summary.navigation_edges} edges · ` +
      `${summary.qr_nodes} QR anchors · ${summary.queues} queues · ${summary.offices} offices · ` +
      `${summary.queue_tickets} room tickets · ${summary.office_tickets} office tickets`,
  );
  log(`campus time is ${campus.time} on ${campus.date} (weekday ${campus.dayOfWeek} · timezone ${process.env.CAMPUS_TIMEZONE ?? 'UTC'})`);
  log(`demo accounts (password ${password}): student@campusflow.dev · staff@campusflow.dev · admin@campusflow.dev`);

  return summary;
}
