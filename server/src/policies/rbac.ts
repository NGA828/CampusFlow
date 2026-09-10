/**
 * Role-based access control (PROMPT §11, §33, §42).
 *
 * The matrix below is the single source of truth for permissions. It is seeded into the
 * database for auditability but is *not* read from the client, never trusted from a
 * request body, and always evaluated on the server.
 */

export const PERMISSIONS = {
  // Student-owned capabilities
  'timetable.view.own': 'View own personalised timetable',
  'room.search': 'Search rooms and availability',
  'queue.join': 'Join a controlled room queue',
  'queue.view.own': 'View own queue ticket',
  'office.request': 'Request an administrative office ticket',
  'office.view.own': 'View own office ticket',
  'navigation.use': 'Use QR positioning and live navigation',
  'assistant.use': 'Use the AI campus assistant',
  'notifications.view.own': 'View own notifications',
  'profile.manage.own': 'Manage own profile and devices',

  // Staff capabilities (scoped by staff_assignments where relevant)
  'timetable.manage': 'Manage authorised timetable entries',
  'content.publish': 'Publish events and announcements',
  'queue.operate': 'Operate room admission queues',
  'queue.monitor': 'Monitor room admission queues',
  'office.operate': 'Operate administrative office queues',
  'office.monitor': 'Monitor administrative office queues',

  // Administrator capabilities
  'users.manage': 'Manage users and roles',
  'campus.manage': 'Manage buildings, floors, rooms and floor plans',
  'spatial.manage': 'Manage QR anchors, navigation graph and geofences',
  'queues.manage': 'Configure queue rules and admission policies',
  'offices.manage': 'Configure administrative offices and service windows',
  'academics.manage': 'Manage courses, enrolments and master timetable',
  'events.manage': 'Manage all events and announcements',
  'analytics.view': 'View system analytics',
} as const;

export type Permission = keyof typeof PERMISSIONS;

export type RoleCode = 'visitor' | 'student' | 'staff' | 'admin';

export const ROLE_RANK: Record<RoleCode, number> = {
  visitor: 0,
  student: 10,
  staff: 20,
  admin: 30,
};

const STUDENT_PERMISSIONS: Permission[] = [
  'timetable.view.own',
  'room.search',
  'queue.join',
  'queue.view.own',
  'office.request',
  'office.view.own',
  'navigation.use',
  'assistant.use',
  'notifications.view.own',
  'profile.manage.own',
];

const STAFF_PERMISSIONS: Permission[] = [
  ...STUDENT_PERMISSIONS.filter((p) => p !== 'queue.join' && p !== 'office.request'),
  'timetable.manage',
  'content.publish',
  'queue.operate',
  'queue.monitor',
  'office.operate',
  'office.monitor',
];

const ADMIN_PERMISSIONS: Permission[] = Object.keys(PERMISSIONS) as Permission[];

export const ROLE_PERMISSIONS: Record<RoleCode, Permission[]> = {
  visitor: [],
  student: STUDENT_PERMISSIONS,
  staff: STAFF_PERMISSIONS,
  admin: ADMIN_PERMISSIONS,
};

export const ROLES: { code: RoleCode; name: string; description: string }[] = [
  { code: 'visitor', name: 'Visitor', description: 'Anonymous or pre-enrolment access to public campus information.' },
  { code: 'student', name: 'Student', description: 'Enrolled student using timetable, navigation, queues and office services.' },
  { code: 'staff', name: 'Staff', description: 'Lecturer or administrative officer operating authorised queues and content.' },
  { code: 'admin', name: 'Administrator', description: 'Full campus infrastructure, spatial configuration and analytics access.' },
];

export function permissionsForRole(role: RoleCode): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/** Role comparison is hierarchical: an admin satisfies a staff requirement. */
export function roleAtLeast(role: RoleCode, required: RoleCode): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required];
}
