import type { Db } from '../../db/client.js';
import { ApiError } from '../../lib/errors.js';
import type { Principal } from '../../middleware/auth.js';
import { roleAtLeast } from '../../policies/rbac.js';
import { getRoom, getRoomAvailability, searchRooms } from '../campus.js';
import { nextClass, todayOverview, studentTimetable } from '../timetable.js';
import { calculateRoute } from '../navigation.js';
import { currentPosition } from '../positioning.js';
import { activeTicketForStudent, getQueue, joinQueue, cancelTicket, ticketView } from '../queues.js';
import { activeOfficeTicket, cancelOfficeTicket, getOffice, officeStatus, officeTicketView, requestOfficeTicket } from '../offices.js';
import { campusParts } from '../../lib/clock.js';

/**
 * CampusFlow AI tool layer (PROMPT §31, §33).
 *
 * The assistant never touches PostgreSQL. It can only call the operations below, which are
 * thin wrappers around the same services the REST API uses — including their authorization
 * rules and their transactional guarantees. A student asking for another student's data,
 * or for an administrative change, has no tool that could satisfy the request and is
 * refused explicitly.
 */

export interface ToolResult {
  data: unknown;
  summary: string;
  actions?: { label: string; href: string; kind?: string }[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
  /** Roles that may invoke the tool. */
  roles: ('visitor' | 'student' | 'staff' | 'admin')[];
  handler: (db: Db, principal: Principal, args: Record<string, unknown>) => Promise<ToolResult>;
}

const roomCodePattern = /^[A-Z]{1,3}\s?\d{1,4}(-[A-Z0-9]{1,4})?$/i;

function requireStudentScope(principal: Principal, targetUserId?: string): void {
  if (targetUserId && targetUserId !== principal.id && !roleAtLeast(principal.role, 'staff')) {
    throw ApiError.forbidden('You can only view your own records.');
  }
}

function formatMinutes(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return 'unknown';
  const minutes = Math.max(0, Math.round(seconds / 60));
  if (minutes < 1) return 'less than a minute';
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hour(s)` : `${hours} hour(s) ${rest} minutes`;
}

export const TOOLS: ToolDefinition[] = [
  {
    name: 'get_student_schedule',
    description: "Get the signed-in student's timetable for a day (defaults to today).",
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'ISO date (YYYY-MM-DD). Defaults to today.' },
        scope: { type: 'string', description: 'today or week', enum: ['today', 'week'] },
      },
    },
    roles: ['student', 'staff', 'admin'],
    async handler(db, principal, args) {
      requireStudentScope(principal);
      if (args.scope === 'week' || args.date) {
        const timetable = await studentTimetable(db, principal.id, { date: args.date as string | undefined, week: args.date as string | undefined });
        return {
          data: { term: timetable.term, entries: timetable.entries, next: timetable.next },
          summary:
            timetable.entries.length === 0
              ? 'You have no scheduled classes in that week.'
              : `You have ${timetable.entries.length} scheduled session(s) that week.`,
          actions: [{ label: 'Open timetable', href: '/timetable' }],
        };
      }
      const today = await todayOverview(db, principal.id);
      return {
        data: today,
        summary:
          today.entries.length === 0
            ? 'You have no classes scheduled today.'
            : `You have ${today.entries.length} session(s) today${
                today.next ? `, next is ${today.next.course_code} at ${today.next.starts_at}` : ''
              }.`,
        actions: [{ label: 'Open timetable', href: '/timetable' }],
      };
    },
  },
  {
    name: 'get_next_class',
    description: 'Get the next upcoming class for the signed-in student, including room and building.',
    parameters: { type: 'object', properties: {} },
    roles: ['student', 'staff', 'admin'],
    async handler(db, principal) {
      requireStudentScope(principal);
      const entry = await nextClass(db, principal.id);
      if (!entry) {
        return { data: null, summary: 'You have no upcoming classes in the next seven days.' };
      }
      return {
        data: entry,
        summary: `${entry.course_code} ${entry.course_title} on ${entry.date} at ${entry.starts_at}${
          entry.room_code ? ` in ${entry.room_name} (${entry.room_code})${entry.building_code ? `, ${entry.building_code}` : ''}` : ''
        }.`,
        actions: [
          { label: 'Navigate there', href: entry.room_id ? `/navigate?to=${entry.room_id}` : '/timetable' },
          { label: 'Open timetable', href: '/timetable' },
        ],
      };
    },
  },
  {
    name: 'get_room_details',
    description: 'Look up a room by its code (for example B204) with location, capacity and current availability.',
    parameters: {
      type: 'object',
      properties: { code: { type: 'string', description: 'Room code, e.g. B204' } },
      required: ['code'],
    },
    roles: ['student', 'staff', 'admin'],
    async handler(db, principal, args) {
      const code = String(args.code ?? '').trim();
      if (!code) throw ApiError.badRequest('A room code is required.');
      const room = await getRoom(db, code);
      const availability = await getRoomAvailability(db, room.id);
      return {
        data: { room, availability },
        summary: `${room.name} (${room.code}) — ${room.building_name}, ${room.floor_name}. Capacity ${room.capacity}. ${availability.headline}.`,
        actions: [
          { label: 'Open room', href: `/rooms/${room.id}` },
          { label: 'Navigate there', href: `/navigate?to=${room.id}` },
        ],
      };
    },
  },
  {
    name: 'search_available_rooms',
    description: 'Find available rooms matching a capacity, building, type or time.',
    parameters: {
      type: 'object',
      properties: {
        min_capacity: { type: 'number', description: 'Minimum number of people' },
        building_code: { type: 'string', description: 'Building code such as A, B, C' },
        room_type: { type: 'string', description: 'lecture, lab, study, meeting, library, office, auditorium, service, other' },
        available_now: { type: 'boolean', description: 'Only rooms free right now' },
        limit: { type: 'number', description: 'Maximum number of results (default 5)' },
      },
    },
    roles: ['student', 'staff', 'admin'],
    async handler(db, principal, args) {
      const { rooms } = await searchRooms(db, {
        min_capacity: args.min_capacity === undefined ? undefined : Number(args.min_capacity),
        building_code: args.building_code ? String(args.building_code) : undefined,
        room_type: args.room_type ? String(args.room_type) : undefined,
        per_page: Math.min(20, Number(args.limit ?? 5)),
      });

      const enriched: { room: unknown; availability: unknown }[] = [];
      for (const room of rooms) {
        const availability = await getRoomAvailability(db, room.id);
        if (args.available_now === true && !availability.is_available_now) continue;
        enriched.push({ room, availability });
        if (enriched.length >= Number(args.limit ?? 5)) break;
      }

      return {
        data: { rooms: enriched },
        summary:
          enriched.length === 0
            ? 'No rooms match those criteria right now.'
            : `Found ${enriched.length} room(s): ${enriched
                .map((entry) => (entry.room as { code: string }).code)
                .join(', ')}.`,
        actions: [{ label: 'Open room search', href: '/rooms' }],
      };
    },
  },
  {
    name: 'get_current_position',
    description: 'Report the last known indoor position of the signed-in user (from the last QR scan or GPS fix).',
    parameters: { type: 'object', properties: {} },
    roles: ['student', 'staff', 'admin'],
    async handler(db, principal) {
      requireStudentScope(principal);
      const position = await currentPosition(db, principal.id);
      if (!position) {
        return {
          data: null,
          summary: 'I do not have a recent position for you. Scan a CampusFlow QR anchor and I will know where you are.',
          actions: [{ label: 'Scan QR code', href: '/scan' }],
        };
      }
      return {
        data: position,
        summary: `You were last located at ${position.label ?? 'an anchor'}${position.building_code ? ` in ${position.building_code}` : ''}${
          position.floor_name ? `, ${position.floor_name}` : ''
        } (${new Date(position.updated_at).toISOString().slice(11, 16)} UTC).`,
        actions: [
          { label: 'Open campus map', href: '/map' },
          { label: 'Scan QR code', href: '/scan' },
        ],
      };
    },
  },
  {
    name: 'calculate_route',
    description: 'Calculate a walking route to a room or office, optionally preferring an accessible path.',
    parameters: {
      type: 'object',
      properties: {
        room_code: { type: 'string', description: 'Destination room code, e.g. B204' },
        office_code: { type: 'string', description: 'Destination administrative office code' },
        accessible: { type: 'boolean', description: 'Prefer step-free route' },
      },
    },
    roles: ['student', 'staff', 'admin'],
    async handler(db, principal, args) {
      requireStudentScope(principal);
      let roomId: string | undefined;
      if (args.room_code && roomString(args.room_code)) {
        const room = await getRoom(db, String(args.room_code));
        roomId = room.id;
      } else if (args.office_code) {
        const office = await getOffice(db, String(args.office_code));
        if (!office.room_id) throw ApiError.unavailable('That office has no room assigned for navigation yet.');
        roomId = office.room_id;
      }
      if (!roomId) throw ApiError.badRequest('Tell me where you want to go (a room code such as B204, or an office).');

      const position = await currentPosition(db, principal.id);
      const { route, destination_label } = await calculateRoute(db, {
        toRoomId: roomId,
        fromPosition: position
          ? {
              lat: position.lat,
              lng: position.lng,
              plan_x: position.plan_x,
              plan_y: position.plan_y,
              floor_id: position.floor_id,
              nav_node_id: position.nav_node_id,
            }
          : undefined,
        accessible: Boolean(args.accessible),
      });

      return {
        data: { route, destination_label },
        summary: `Route to ${destination_label}: about ${route.distance_m} m, roughly ${Math.max(
          1,
          Math.round(route.duration_seconds / 60),
        )} minutes with ${route.steps.length} steps${route.transitions.length ? `, including ${route.transitions.length} floor change(s)` : ''}.`,
        actions: [{ label: 'Start navigation', href: `/navigate?to=${roomId}` }],
      };
    },
  },
  {
    name: 'get_queue_status',
    description: 'Report the signed-in student\'s active room queue ticket: position, people ahead and estimated wait.',
    parameters: { type: 'object', properties: {} },
    roles: ['student', 'staff', 'admin'],
    async handler(db, principal) {
      requireStudentScope(principal);
      const ticket = await activeTicketForStudent(db, principal.id);
      if (!ticket) {
        return {
          data: null,
          summary: 'You do not have an active room queue ticket.',
          actions: [{ label: 'Find a room', href: '/rooms' }],
        };
      }
      const view = await ticketView(db, ticket);
      return {
        data: {
          ticket_number: view.ticket.ticket_number,
          status: view.ticket.status,
          position: view.ticket.position,
          people_ahead: view.people_ahead,
          eta_seconds: view.eta_seconds,
          room: { code: view.queue.room_code, name: view.queue.room_name, building: view.queue.building_code },
          check_in_deadline: view.check_in_deadline,
        },
        summary: `Ticket ${view.ticket.ticket_number} for ${view.queue.room_name} (${view.queue.room_code}) is ${view.ticket.status.toLowerCase().replaceAll(
          '_',
          ' ',
        )}. Position ${view.ticket.position} with ${view.people_ahead} ahead — estimated wait ${formatMinutes(view.eta_seconds)}.`,
        actions: [{ label: 'Open queue', href: '/queue' }],
      };
    },
  },
  {
    name: 'join_queue',
    description: 'Join the controlled admission queue for a room.',
    parameters: {
      type: 'object',
      properties: { room_code: { type: 'string', description: 'Room code, e.g. B204' } },
      required: ['room_code'],
    },
    roles: ['student', 'staff', 'admin'],
    async handler(db, principal, args) {
      const code = String(args.room_code ?? '').trim();
      if (!roomString(code)) throw ApiError.badRequest('Which room do you want to join?');
      const room = await getRoom(db, code);
      if (!room.requires_admission) {
        return {
          data: { room },
          summary: `${room.name} (${room.code}) does not require queue admission — you can walk straight in when it is free.`,
          actions: [{ label: 'Open room', href: `/rooms/${room.id}` }],
        };
      }
      const queue = await getQueue(db, room.id);
      const position = await currentPosition(db, principal.id);
      const { ticket, counts } = await joinQueue(db, principal.id, {
        queueId: queue.id,
        fix: position
          ? { lat: position.lat, lng: position.lng, plan_x: position.plan_x, plan_y: position.plan_y, floor_id: position.floor_id, source: position.source }
          : undefined,
      });
      return {
        data: { ticket, counts },
        summary: `You joined the queue for ${queue.room_name} (${queue.room_code}). Ticket ${ticket.ticket_number}, position ${ticket.position}.`,
        actions: [{ label: 'Open queue', href: '/queue' }],
      };
    },
  },
  {
    name: 'cancel_queue_ticket',
    description: 'Cancel the signed-in student\'s active room queue ticket.',
    parameters: { type: 'object', properties: {} },
    roles: ['student', 'staff', 'admin'],
    async handler(db, principal) {
      const ticket = await activeTicketForStudent(db, principal.id);
      if (!ticket) return { data: null, summary: 'You do not have an active queue ticket to cancel.' };
      const cancelled = await cancelTicket(db, { id: principal.id, isStaff: false, isAdmin: false }, ticket.id, 'Cancelled from the AI assistant');
      return {
        data: cancelled,
        summary: `Ticket ${cancelled.ticket_number} has been cancelled.`,
        actions: [{ label: 'Find another room', href: '/rooms' }],
      };
    },
  },
  {
    name: 'get_office_details',
    description: 'Look up an administrative office: opening hours, live queue and expected service window.',
    parameters: {
      type: 'object',
      properties: { code: { type: 'string', description: 'Office code or name, e.g. PRINCIPAL or Registrar' } },
      required: ['code'],
    },
    roles: ['student', 'staff', 'admin'],
    async handler(db, principal, args) {
      const status = await officeStatus(db, String(args.code ?? ''));
      return {
        data: status,
        summary: `${status.office.name} is ${status.is_open_now ? 'open now' : status.next_opening ?? 'currently closed'}. ${
          status.counts.waiting
        } waiting, average service ${status.average_service_minutes} minutes, estimated wait ${status.estimated_wait_minutes} minutes.`,
        actions: [{ label: 'Open office', href: `/offices/${status.office.id}` }],
      };
    },
  },
  {
    name: 'request_office_ticket',
    description: 'Request a numbered ticket for an administrative office (Principal, Registrar, Student Affairs…).',
    parameters: {
      type: 'object',
      properties: {
        office_code: { type: 'string', description: 'Office code, e.g. PRINCIPAL' },
        subject: { type: 'string', description: 'Short reason for the visit' },
      },
      required: ['office_code', 'subject'],
    },
    roles: ['student', 'staff', 'admin'],
    async handler(db, principal, args) {
      const office = await getOffice(db, String(args.office_code ?? ''));
      const position = await currentPosition(db, principal.id);
      const { ticket } = await requestOfficeTicket(db, principal.id, {
        officeId: office.id,
        subject: String(args.subject ?? 'Visit').slice(0, 180),
        fix: position
          ? { lat: position.lat, lng: position.lng, plan_x: position.plan_x, plan_y: position.plan_y, floor_id: position.floor_id, source: position.source }
          : undefined,
      });
      return {
        data: ticket,
        summary: `Ticket ${ticket.ticket_number} issued for ${office.name}. Position ${ticket.position}.`,
        actions: [{ label: 'Open office ticket', href: `/offices/${office.id}` }],
      };
    },
  },
  {
    name: 'get_office_ticket_status',
    description: 'Report the signed-in student\'s active administrative office ticket and expected service window.',
    parameters: { type: 'object', properties: {} },
    roles: ['student', 'staff', 'admin'],
    async handler(db, principal) {
      const ticket = await activeOfficeTicket(db, principal.id);
      if (!ticket) {
        return {
          data: null,
          summary: 'You do not have an active office ticket.',
          actions: [{ label: 'Open offices', href: '/offices' }],
        };
      }
      const view = await officeTicketView(db, ticket.id);
      return {
        data: view,
        summary: `Ticket ${ticket.ticket_number} at ${ticket.office.name}: ${view.status_label}. Position ${ticket.position}, ${view.people_ahead} ahead, estimated wait ${formatMinutes(
          view.eta_seconds,
        )}${view.expected_window ? `, expected service ${view.expected_window.starts_at.slice(11, 16)}–${view.expected_window.ends_at.slice(11, 16)}` : ''}.`,
        actions: [
          { label: 'Open ticket', href: `/offices/${ticket.office_id}` },
          { label: 'Navigate there', href: `/navigate?to=${ticket.office.room_id ?? ''}` },
        ],
      };
    },
  },
  {
    name: 'cancel_office_ticket',
    description: 'Cancel the signed-in student\'s active administrative office ticket.',
    parameters: { type: 'object', properties: {} },
    roles: ['student', 'staff', 'admin'],
    async handler(db, principal) {
      const ticket = await activeOfficeTicket(db, principal.id);
      if (!ticket) return { data: null, summary: 'You do not have an active office ticket to cancel.' };
      const cancelled = await cancelOfficeTicket(db, { id: principal.id, isStaff: false, isAdmin: false }, ticket.id, 'Cancelled from the AI assistant');
      return { data: cancelled, summary: `Office ticket ${cancelled.ticket_number} cancelled.` };
    },
  },
  {
    name: 'get_events',
    description: 'List upcoming campus events.',
    parameters: { type: 'object', properties: { limit: { type: 'number', description: 'How many events (default 5)' } } },
    roles: ['visitor', 'student', 'staff', 'admin'],
    async handler(db, _principal, args) {
      const limit = Math.min(20, Number(args.limit ?? 5));
      const events = await db.query<{ id: string; title: string; starts_at: string; venue: string | null; category: string }>(
        `SELECT id, title, starts_at, venue, category FROM events
          WHERE status = 'published' AND starts_at > now() ORDER BY starts_at LIMIT $1`,
        [limit],
      );
      return {
        data: events,
        summary: events.length === 0 ? 'There are no upcoming events.' : `${events.length} upcoming event(s), next: ${events[0]!.title}.`,
        actions: [{ label: 'Open events', href: '/events' }],
      };
    },
  },
  {
    name: 'get_announcements',
    description: 'List active campus announcements.',
    parameters: { type: 'object', properties: { limit: { type: 'number', description: 'How many announcements (default 5)' } } },
    roles: ['visitor', 'student', 'staff', 'admin'],
    async handler(db, _principal, args) {
      const limit = Math.min(20, Number(args.limit ?? 5));
      const announcements = await db.query<{ id: string; title: string; body: string; published_at: string; priority: string }>(
        `SELECT id, title, body, published_at, priority FROM announcements
          WHERE published_at <= now() AND (expires_at IS NULL OR expires_at > now())
          ORDER BY is_pinned DESC, published_at DESC LIMIT $1`,
        [limit],
      );
      return {
        data: announcements,
        summary:
          announcements.length === 0
            ? 'There are no active announcements.'
            : `${announcements.length} active announcement(s). Latest: ${announcements[0]!.title}.`,
        actions: [{ label: 'Open announcements', href: '/announcements' }],
      };
    },
  },
  {
    name: 'get_campus_map_summary',
    description: 'Describe the campus: buildings, floors and facilities available for navigation.',
    parameters: { type: 'object', properties: {} },
    roles: ['visitor', 'student', 'staff', 'admin'],
    async handler(db) {
      const buildings = await db.query<{ id: string; code: string; name: string; floors: string; rooms: string }>(
        `SELECT b.id, b.code, b.name,
                (SELECT count(*)::text FROM floors f WHERE f.building_id = b.id) AS floors,
                (SELECT count(*)::text FROM rooms r WHERE r.building_id = b.id) AS rooms
           FROM buildings b ORDER BY b.code`,
      );
      const parts = campusParts();
      return {
        data: { buildings, campus_time: parts },
        summary: `Campus has ${buildings.length} buildings: ${buildings.map((b) => `${b.code} — ${b.name}`).join(', ')}.`,
        actions: [{ label: 'Open campus map', href: '/map' }],
      };
    },
  },
];

function roomString(value: unknown): boolean {
  return roomCodePattern.test(String(value ?? '').trim());
}

export const TOOL_MAP = new Map(TOOLS.map((tool) => [tool.name, tool]));

export function toolsForRole(role: Principal['role']): ToolDefinition[] {
  return TOOLS.filter((tool) => tool.roles.includes(role));
}

export async function runTool(
  db: Db,
  principal: Principal,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const tool = TOOL_MAP.get(name);
  if (!tool) throw ApiError.badRequest(`Unknown assistant tool: ${name}.`);
  if (!tool.roles.includes(principal.role)) {
    throw ApiError.forbidden('Your account cannot use that assistant action.');
  }
  return tool.handler(db, principal, args);
}
