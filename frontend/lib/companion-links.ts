import type { Role } from './api/types';

/** The assistant still emits two old web paths. Map only known, equivalent read destinations. */
export function assistantWebHref(href: string): string | null {
  if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//') || /[\\\u0000-\u0020]/.test(href)) return null;
  const url = new URL(href, 'https://campusflow.invalid');
  if (url.origin !== 'https://campusflow.invalid') return null;
  const aliases: Record<string, string> = { '/student/queues': '/student/services/queues', '/student/offices': '/student/services/offices' };
  const path = aliases[url.pathname] ?? url.pathname;
  const exact = ['/student/dashboard', '/student/timetable', '/student/announcements', '/student/notifications', '/student/campus/map', '/student/campus/events', '/student/campus/rooms', '/student/services/queues', '/student/services/offices'];
  if (!exact.includes(path) && !/^\/student\/campus\/rooms\/[^/]+$/.test(path) && !/^\/student\/services\/offices\/(?:tickets\/)?[^/]+$/.test(path)) return null;
  return `${path}${url.search}${url.hash}`;
}

export function notificationHref(type: string, role: Role): string | null {
  const category = type.split('.')[0];
  const destinations: Partial<Record<Role, Record<string, string>>> = {
    student: { queue: '/student/services/queues', office: '/student/services/offices', navigation: '/student/campus/map', event: '/student/campus/events', class: '/student/timetable', announcement: '/student/announcements' },
    staff: { queue: '/staff/queues', office: '/staff/offices', class: '/staff/timetable', event: '/staff/content', announcement: '/staff/content' },
    admin: { queue: '/admin/services', office: '/admin/services', class: '/admin/academics' },
  };
  return destinations[role]?.[category] ?? null;
}
