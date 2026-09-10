import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { created, noContent, ok } from '../lib/respond.js';
import { requireRole, type Principal, type RequestContext } from '../middleware/auth.js';
import { canOperateQueue } from '../middleware/auth.js';
import { campusParts, toMinutes } from '../lib/clock.js';
import {
  admit,
  callNext,
  checkIn,
  completeService,
  completeService as completeRoomService,
  getQueue,
  markNoShow,
  queueCounts,
  queueLineDetail,
  staffQueueBoard,
} from '../services/queues.js';
import {
  callNextOfficeTicket,
  completeOfficeService,
  getOffice,
  markOfficeNoShow,
  officeCheckIn,
  officeCounts,
  officeStaffBoard,
  officeTicketLine,
  startOfficeService,
} from '../services/offices.js';
import { ctxOf } from '../http/context.js';
import { audit } from '../lib/respond.js';

/**
 * Staff operations (PROMPT §8, §82, §83).
 *
 * Every action is scoped: an administrator may operate anything, while a staff member is
 * limited to the buildings, rooms, queues and offices recorded in `staff_assignments`.
 */

async function staffScopes(ctx: RequestContext, principal: Principal): Promise<{ queueIds: string[]; officeIds: string[] }> {
  if (principal.role === 'admin') {
    const queues = await ctx.db.query<{ id: string }>('SELECT id FROM room_queues');
    const offices = await ctx.db.query<{ id: string }>('SELECT id FROM administrative_offices');
    return { queueIds: queues.map((row) => row.id), officeIds: offices.map((row) => row.id) };
  }

  const assignments = principal.assignments.filter((assignment) => assignment.can_call_tickets);
  const queueIds = new Set<string>();
  const officeIds = new Set<string>();

  for (const assignment of assignments) {
    if (assignment.scope_type === 'queue') queueIds.add(assignment.scope_id);
    if (assignment.scope_type === 'office') officeIds.add(assignment.scope_id);
  }

  const buildingIds = assignments.filter((a) => a.scope_type === 'building').map((a) => a.scope_id);
  const roomIds = assignments.filter((a) => a.scope_type === 'room').map((a) => a.scope_id);

  if (buildingIds.length || roomIds.length) {
    const queues = await ctx.db.query<{ id: string }>(
      `SELECT q.id FROM room_queues q
         JOIN rooms r ON r.id = q.room_id
        WHERE r.building_id = ANY($1::uuid[]) OR r.id = ANY($2::uuid[])`,
      [buildingIds.length ? buildingIds : null, roomIds.length ? roomIds : null],
    ).catch(async () => {
      // PGlite cannot infer the type of a NULL array literal; fall back to two queries.
      const byBuilding = buildingIds.length
        ? await ctx.db.query<{ id: string }>(
            `SELECT q.id FROM room_queues q JOIN rooms r ON r.id = q.room_id WHERE r.building_id = ANY($1::uuid[])`,
            [buildingIds],
          )
        : [];
      const byRoom = roomIds.length
        ? await ctx.db.query<{ id: string }>(
            `SELECT q.id FROM room_queues q JOIN rooms r ON r.id = q.room_id WHERE r.id = ANY($1::uuid[])`,
            [roomIds],
          )
        : [];
      return [...byBuilding, ...byRoom];
    });
    for (const row of queues) queueIds.add(row.id);

    const offices = await ctx.db.query<{ id: string }>(
      `SELECT o.id FROM administrative_offices o WHERE o.building_id = ANY($1::uuid[])`,
      [buildingIds.length ? buildingIds : []],
    );
    for (const row of offices) officeIds.add(row.id);
  }

  return { queueIds: [...queueIds], officeIds: [...officeIds] };
}

async function assertQueueAccess(ctx: RequestContext, queueId: string): Promise<{ principal: Principal; roomId: string; buildingId: string }> {
  const principal = requireRole(ctx, 'staff');
  const queue = await getQueue(ctx.db, queueId);
  const allowed = await canOperateQueue(ctx, {
    queue_id: queue.id,
    room_id: queue.room_id,
    building_id: queue.building_id,
  });
  if (!allowed) throw ApiError.forbidden('You are not assigned to operate this queue.');
  return { principal, roomId: queue.room_id, buildingId: queue.building_id };
}

async function assertOfficeAccess(ctx: RequestContext, officeId: string): Promise<{ principal: Principal; officeId: string }> {
  const principal = requireRole(ctx, 'staff');
  const office = await getOffice(ctx.db, officeId);
  const allowed = await canOperateQueue(ctx, {
    queue_id: office.id,
    room_id: office.room_id ?? office.id,
    building_id: office.building_id,
    office_id: office.id,
  });
  if (!allowed) throw ApiError.forbidden('You are not assigned to operate this office queue.');
  return { principal, officeId: office.id };
}

export async function registerStaffRoutes(app: FastifyInstance): Promise<void> {
  app.get('/staff/dashboard', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireRole(ctx, 'staff');
    const { queueIds, officeIds } = await staffScopes(ctx, principal);
    const now = campusParts();

    const [queuesBoard, officesBoard] = await Promise.all([
      staffQueueBoard(ctx.db, queueIds),
      officeStaffBoard(ctx.db, officeIds),
    ]);

    const pending = await ctx.db.query(
      `SELECT t.id, t.ticket_number, t.status, t.position, t.check_in_deadline, u.name AS student_name,
              r.code AS room_code, r.name AS room_name, q.id AS queue_id
         FROM queue_tickets t
         JOIN users u ON u.id = t.student_id
         JOIN room_queues q ON q.id = t.queue_id
         JOIN rooms r ON r.id = t.room_id
        WHERE q.id = ANY($1::uuid[])
          AND t.status IN ('CALLED','CHECK_IN_WINDOW','CHECKED_IN','APPROACHING')
        ORDER BY t.position LIMIT 12`,
      [queueIds],
    ).catch(() => [] as unknown[]);

    const officePending = await ctx.db.query(
      `SELECT t.id, t.ticket_number, t.status, t.position, t.check_in_deadline, t.subject,
              u.name AS student_name, o.name AS office_name
         FROM office_tickets t
         JOIN users u ON u.id = t.student_id
         JOIN administrative_offices o ON o.id = t.office_id
        WHERE o.id = ANY($1::uuid[])
          AND t.status IN ('CALLED','CHECK_IN_WINDOW','CHECKED_IN','IN_SERVICE','APPROACHING')
        ORDER BY CASE WHEN t.status = 'IN_SERVICE' THEN 0 ELSE 1 END, t.position LIMIT 12`,
      [officeIds],
    ).catch(() => [] as unknown[]);

    // Today's teaching load for this staff member.
    const teachingToday = await ctx.db.query(
      `SELECT t.id, to_char(t.starts_at, 'HH24:MI') AS starts_at, to_char(t.ends_at, 'HH24:MI') AS ends_at,
              c.code AS course_code, c.title AS course_title, r.code AS room_code, r.name AS room_name,
              t.session_type
         FROM timetable_entries t
         JOIN courses c ON c.id = t.course_id
         LEFT JOIN rooms r ON r.id = t.room_id
        WHERE t.staff_id = $1 AND t.day_of_week = $2
        ORDER BY t.starts_at`,
      [principal.id, now.dayOfWeek],
    );

    const servedToday = await ctx.db.one<{ served: string; waiting: string }>(
      `SELECT
          (SELECT count(*) FROM queue_tickets t JOIN room_queues q ON q.id = t.queue_id
            WHERE q.id = ANY($1::uuid[]) AND t.status IN ('COMPLETED','ADMITTED') AND t.checked_in_at::date = CURRENT_DATE)::text AS served,
          (SELECT count(*) FROM queue_tickets t JOIN room_queues q ON q.id = t.queue_id
            WHERE q.id = ANY($1::uuid[]) AND t.status IN ('QUEUE_PENDING','WAITING'))::text AS waiting`,
      [queueIds],
    ).catch(() => null);

    return ok(reply, {
      scopes: { queues: queueIds.length, offices: officeIds.length },
      queues: queuesBoard,
      offices: officesBoard,
      pending_queue_actions: pending,
      pending_office_actions: officePending,
      teaching_today: teachingToday,
      kpis: {
        served_today: Number(servedToday?.served ?? 0),
        waiting_now: Number(servedToday?.waiting ?? 0),
        offices_open: (officesBoard as { is_active?: boolean }[]).filter((office) => office.is_active).length,
      },
      campus_time: now,
    });
  });

  /* ------------------------------------------------------------- room queues */

  app.get('/staff/queues', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireRole(ctx, 'staff');
    const { queueIds } = await staffScopes(ctx, principal);
    return ok(reply, { queues: await staffQueueBoard(ctx.db, queueIds) });
  });

  app.get('/staff/queues/:id/line', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const { id } = request.params as { id: string };
    await assertQueueAccess(ctx, id);
    const queue = await getQueue(ctx.db, id);
    return ok(reply, {
      queue: {
        id: queue.id,
        room_code: queue.room_code,
        room_name: queue.room_name,
        building_code: queue.building_code,
        admission_capacity: queue.admission_capacity,
        check_in_window_seconds: queue.check_in_window_seconds,
        grace_period_seconds: queue.grace_period_seconds,
        proximity_radius_m: queue.proximity_radius_m,
      },
      counts: await queueCounts(ctx.db, queue.id),
      tickets: await queueLineDetail(ctx.db, queue.id),
    });
  });

  app.post('/staff/queues/:id/call-next', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const { id } = request.params as { id: string };
    const { principal } = await assertQueueAccess(ctx, id);
    const input = parse(z.object({ ticket_id: z.string().uuid().optional() }), request.body ?? {});
    const result = await callNext(ctx.db, principal.id, id, { ticketId: input.ticket_id });
    await audit(ctx, 'queue.call_next', { type: 'queue', id, metadata: { ticket: result.called?.ticket_number } });
    return ok(reply, result, result.message);
  });

  app.post('/staff/queue-tickets/:id/admit', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const { id } = request.params as { id: string };
    const ticket = await ctx.db.one<{ queue_id: string }>('SELECT queue_id FROM queue_tickets WHERE id = $1', [id]);
    if (!ticket) throw ApiError.notFound('Ticket not found.');
    const { principal } = await assertQueueAccess(ctx, ticket.queue_id);
    const updated = await admit(ctx.db, principal.id, id);
    await audit(ctx, 'queue.admit', { type: 'queue_ticket', id });
    return ok(reply, { ticket: updated }, 'Admission granted.');
  });

  app.post('/staff/queue-tickets/:id/complete', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const { id } = request.params as { id: string };
    const ticket = await ctx.db.one<{ queue_id: string }>('SELECT queue_id FROM queue_tickets WHERE id = $1', [id]);
    if (!ticket) throw ApiError.notFound('Ticket not found.');
    const { principal } = await assertQueueAccess(ctx, ticket.queue_id);
    const updated = await completeRoomService(ctx.db, principal.id, id);
    await audit(ctx, 'queue.complete', { type: 'queue_ticket', id });
    return ok(reply, { ticket: updated }, 'Visit completed.');
  });

  app.post('/staff/queue-tickets/:id/check-in', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const { id } = request.params as { id: string };
    const ticket = await ctx.db.one<{ queue_id: string }>('SELECT queue_id FROM queue_tickets WHERE id = $1', [id]);
    if (!ticket) throw ApiError.notFound('Ticket not found.');
    const { principal } = await assertQueueAccess(ctx, ticket.queue_id);
    const result = await checkIn(ctx.db, { id: principal.id, isStaff: true, isAdmin: principal.role === 'admin' }, id, {});
    await audit(ctx, 'queue.check_in', { type: 'queue_ticket', id });
    return ok(reply, result, 'Student checked in.');
  });

  app.post('/staff/queue-tickets/:id/no-show', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const { id } = request.params as { id: string };
    const input = parse(z.object({ reason: z.string().trim().max(200).optional() }), request.body ?? {});
    const ticket = await ctx.db.one<{ queue_id: string }>('SELECT queue_id FROM queue_tickets WHERE id = $1', [id]);
    if (!ticket) throw ApiError.notFound('Ticket not found.');
    const { principal } = await assertQueueAccess(ctx, ticket.queue_id);
    const updated = await markNoShow(ctx.db, principal.id, id, input.reason);
    await audit(ctx, 'queue.no_show', { type: 'queue_ticket', id, metadata: { reason: input.reason } });
    return ok(reply, { ticket: updated }, 'Marked as no-show.');
  });

  /* ------------------------------------------------------- administrative offices */

  app.get('/staff/offices', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireRole(ctx, 'staff');
    const { officeIds } = await staffScopes(ctx, principal);
    return ok(reply, { offices: await officeStaffBoard(ctx.db, officeIds) });
  });

  app.get('/staff/offices/:id/line', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const { id } = request.params as { id: string };
    await assertOfficeAccess(ctx, id);
    const office = await getOffice(ctx.db, id);
    return ok(reply, {
      office: {
        id: office.id,
        name: office.name,
        code: office.code,
        concurrent_capacity: office.concurrent_capacity,
        check_in_radius_m: office.check_in_radius_m,
        grace_period_seconds: office.grace_period_seconds,
        ticket_prefix: office.ticket_prefix,
      },
      counts: await officeCounts(ctx.db, office.id),
      tickets: await officeTicketLine(ctx.db, office.id),
    });
  });

  app.post('/staff/offices/:id/call-next', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const { id } = request.params as { id: string };
    const { principal } = await assertOfficeAccess(ctx, id);
    const input = parse(z.object({ ticket_id: z.string().uuid().optional() }), request.body ?? {});
    const result = await callNextOfficeTicket(ctx.db, principal.id, id, { ticketId: input.ticket_id });
    await audit(ctx, 'office.call_next', { type: 'office', id, metadata: { ticket: result.called.ticket_number } });
    return ok(reply, result, `Called ${result.called.ticket_number}.`);
  });

  app.post('/staff/office-tickets/:id/check-in', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const { id } = request.params as { id: string };
    const ticket = await ctx.db.one<{ office_id: string }>('SELECT office_id FROM office_tickets WHERE id = $1', [id]);
    if (!ticket) throw ApiError.notFound('Ticket not found.');
    const { principal } = await assertOfficeAccess(ctx, ticket.office_id);
    const result = await officeCheckIn(ctx.db, { id: principal.id, isStaff: true, isAdmin: principal.role === 'admin' }, id, {});
    await audit(ctx, 'office.check_in', { type: 'office_ticket', id });
    return ok(reply, result, 'Student checked in.');
  });

  app.post('/staff/office-tickets/:id/start-service', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const { id } = request.params as { id: string };
    const ticket = await ctx.db.one<{ office_id: string }>('SELECT office_id FROM office_tickets WHERE id = $1', [id]);
    if (!ticket) throw ApiError.notFound('Ticket not found.');
    const { principal } = await assertOfficeAccess(ctx, ticket.office_id);
    const updated = await startOfficeService(ctx.db, principal.id, id);
    await audit(ctx, 'office.start_service', { type: 'office_ticket', id });
    return ok(reply, { ticket: updated }, 'Service started.');
  });

  app.post('/staff/office-tickets/:id/complete', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const { id } = request.params as { id: string };
    const input = parse(z.object({ notes: z.string().trim().max(500).optional() }), request.body ?? {});
    const ticket = await ctx.db.one<{ office_id: string }>('SELECT office_id FROM office_tickets WHERE id = $1', [id]);
    if (!ticket) throw ApiError.notFound('Ticket not found.');
    const { principal } = await assertOfficeAccess(ctx, ticket.office_id);
    const updated = await completeOfficeService(ctx.db, principal.id, id, input.notes);
    await audit(ctx, 'office.complete', { type: 'office_ticket', id, metadata: { service_minutes: updated.service_minutes } });
    return ok(reply, { ticket: updated }, 'Service completed.');
  });

  app.post('/staff/office-tickets/:id/no-show', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const { id } = request.params as { id: string };
    const input = parse(z.object({ reason: z.string().trim().max(200).optional() }), request.body ?? {});
    const ticket = await ctx.db.one<{ office_id: string }>('SELECT office_id FROM office_tickets WHERE id = $1', [id]);
    if (!ticket) throw ApiError.notFound('Ticket not found.');
    const { principal } = await assertOfficeAccess(ctx, ticket.office_id);
    const updated = await markOfficeNoShow(ctx.db, principal.id, id, input.reason);
    await audit(ctx, 'office.no_show', { type: 'office_ticket', id, metadata: { reason: input.reason } });
    return ok(reply, { ticket: updated }, 'Marked as no-show.');
  });

  /* --------------------------------------------------------- timetable management */

  app.get('/staff/timetable', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireRole(ctx, 'staff');
    const query = parse(
      z.object({
        week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        course_id: z.string().uuid().optional(),
        room_id: z.string().uuid().optional(),
        day_of_week: z.coerce.number().int().min(1).max(7).optional(),
      }),
      request.query ?? {},
    );

    const where = ["c.is_active"];
    const values: unknown[] = [principal.id];
    if (query.course_id) {
      values.push(query.course_id);
      where.push(`t.course_id = $${values.length}`);
    }
    if (query.room_id) {
      values.push(query.room_id);
      where.push(`t.room_id = $${values.length}`);
    }
    if (query.day_of_week) {
      values.push(query.day_of_week);
      where.push(`t.day_of_week = $${values.length}`);
    }

    const entries = await ctx.db.query(
      `SELECT t.id, t.day_of_week, to_char(t.starts_at, 'HH24:MI') AS starts_at, to_char(t.ends_at, 'HH24:MI') AS ends_at,
              t.session_type, t.week_pattern, t.group_code, t.notes, t.term_code,
              c.id AS course_id, c.code AS course_code, c.title AS course_title, c.department,
              r.id AS room_id, r.code AS room_code, r.name AS room_name,
              b.code AS building_code, f.name AS floor_name,
              (SELECT count(*)::int FROM enrollments e
                WHERE e.course_id = t.course_id AND e.term_code = t.term_code AND e.status = 'enrolled') AS enrolled
         FROM timetable_entries t
         JOIN courses c ON c.id = t.course_id
         LEFT JOIN rooms r ON r.id = t.room_id
         LEFT JOIN buildings b ON b.id = r.building_id
         LEFT JOIN floors f ON f.id = r.floor_id
        WHERE (${where.join(' AND ')})
          AND ($1 = t.staff_id OR EXISTS (
                SELECT 1 FROM course_staff cs WHERE cs.course_id = t.course_id AND cs.user_id = $1))
        ORDER BY t.day_of_week, t.starts_at`,
      values,
    );

    const canManage = principal.role === 'admin' || principal.assignments.some((a) => a.can_manage_timetable);

    return ok(reply, {
      entries,
      can_manage: canManage,
      courses: await ctx.db.query(
        `SELECT c.id, c.code, c.title, c.department FROM courses c
          WHERE EXISTS (SELECT 1 FROM course_staff cs WHERE cs.course_id = c.id AND cs.user_id = $1)
             OR EXISTS (SELECT 1 FROM timetable_entries t WHERE t.course_id = c.id AND t.staff_id = $1)
          ORDER BY c.code`,
        [principal.id],
      ),
      rooms: await ctx.db.query(
        `SELECT id, code, name FROM rooms WHERE room_type IN ('lecture','lab','study','meeting','auditorium') ORDER BY code`,
      ),
    });
  });

  app.post('/staff/timetable', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireRole(ctx, 'staff');
    const canManage = principal.role === 'admin' || principal.assignments.some((a) => a.can_manage_timetable);
    if (!canManage) throw ApiError.forbidden('You are not authorised to publish timetable entries.');

    const input = parse(
      z.object({
        course_id: z.string().uuid(),
        room_id: z.string().uuid().nullable().optional(),
        term_code: z.string().trim().max(20).optional(),
        day_of_week: z.coerce.number().int().min(1).max(7),
        starts_at: z.string().regex(/^\d{2}:\d{2}$/),
        ends_at: z.string().regex(/^\d{2}:\d{2}$/),
        session_type: z.enum(['lecture', 'lab', 'tutorial', 'seminar', 'exam']).default('lecture'),
        group_code: z.string().trim().max(20).optional(),
        notes: z.string().trim().max(300).optional(),
      }),
      request.body ?? {},
    );

    if (toMinutes(input.ends_at) <= toMinutes(input.starts_at)) {
      throw ApiError.validation({ ends_at: ['The end time must be after the start time.'] });
    }

    const term =
      input.term_code ??
      (await ctx.db.one<{ code: string }>('SELECT code FROM terms WHERE is_current ORDER BY starts_on DESC LIMIT 1'))?.code;
    if (!term) throw ApiError.unavailable('No academic term is configured.');

    // Staff may only schedule courses they are attached to.
    const attached = await ctx.db.one<{ ok: boolean }>(
      `SELECT true AS ok WHERE EXISTS (SELECT 1 FROM course_staff cs WHERE cs.course_id = $1 AND cs.user_id = $2)
          OR $3`,
      [input.course_id, principal.id, principal.role === 'admin'],
    );
    if (!attached) throw ApiError.forbidden('You are not attached to that course.');

    if (input.room_id) {
      const conflict = await ctx.db.one<{ id: string }>(
        `SELECT id FROM timetable_entries
          WHERE room_id = $1 AND day_of_week = $2 AND term_code = $3
            AND (starts_at, ends_at) OVERLAPS ($4::time, $5::time)`,
        [input.room_id, input.day_of_week, term, input.starts_at, input.ends_at],
      );
      if (conflict) {
        throw ApiError.conflict('That room is already booked for an overlapping session.', 'ROOM_CONFLICT');
      }
    }

    const entry = await ctx.db.one(
      `INSERT INTO timetable_entries
         (course_id, room_id, staff_id, term_code, day_of_week, starts_at, ends_at, session_type, group_code, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, day_of_week, to_char(starts_at, 'HH24:MI') AS starts_at, to_char(ends_at, 'HH24:MI') AS ends_at, session_type`,
      [
        input.course_id,
        input.room_id ?? null,
        principal.id,
        term,
        input.day_of_week,
        input.starts_at,
        input.ends_at,
        input.session_type,
        input.group_code ?? null,
        input.notes ?? null,
        principal.id,
      ],
    );

    await audit(ctx, 'timetable.created', { type: 'timetable_entry', id: String(entry?.id), metadata: input });
    return created(reply, { entry }, 'Timetable entry published.');
  });

  app.patch('/staff/timetable/:id', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireRole(ctx, 'staff');
    const { id } = request.params as { id: string };
    const canManage = principal.role === 'admin' || principal.assignments.some((a) => a.can_manage_timetable);
    if (!canManage) throw ApiError.forbidden('You are not authorised to edit timetable entries.');

    const entry = await ctx.db.one<{ staff_id: string | null }>('SELECT staff_id FROM timetable_entries WHERE id = $1', [id]);
    if (!entry) throw ApiError.notFound('Timetable entry not found.');
    if (principal.role !== 'admin' && entry.staff_id !== principal.id) {
      throw ApiError.forbidden('You can only edit sessions you own.');
    }

    const input = parse(
      z.object({
        room_id: z.string().uuid().nullable().optional(),
        day_of_week: z.coerce.number().int().min(1).max(7).optional(),
        starts_at: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        ends_at: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        session_type: z.enum(['lecture', 'lab', 'tutorial', 'seminar', 'exam']).optional(),
        notes: z.string().trim().max(300).nullable().optional(),
      }),
      request.body ?? {},
    );
    const columns = Object.keys(input);
    if (columns.length === 0) throw ApiError.badRequest('No changes were provided.');

    const updated = await ctx.db.one(
      `UPDATE timetable_entries SET ${columns.map((column, index) => `${column} = $${index + 2}`).join(', ')}, updated_at = now()
        WHERE id = $1
        RETURNING id, day_of_week, to_char(starts_at, 'HH24:MI') AS starts_at, to_char(ends_at, 'HH24:MI') AS ends_at`,
      [id, ...columns.map((column) => (input as Record<string, unknown>)[column])],
    );
    await audit(ctx, 'timetable.updated', { type: 'timetable_entry', id, metadata: input });
    return ok(reply, { entry: updated }, 'Timetable entry updated.');
  });

  app.delete('/staff/timetable/:id', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireRole(ctx, 'staff');
    const { id } = request.params as { id: string };
    const canManage = principal.role === 'admin' || principal.assignments.some((a) => a.can_manage_timetable);
    if (!canManage) throw ApiError.forbidden('You are not authorised to remove timetable entries.');

    const entry = await ctx.db.one<{ staff_id: string | null }>('SELECT staff_id FROM timetable_entries WHERE id = $1', [id]);
    if (!entry) throw ApiError.notFound('Timetable entry not found.');
    if (principal.role !== 'admin' && entry.staff_id !== principal.id) {
      throw ApiError.forbidden('You can only remove sessions you own.');
    }
    await ctx.db.query('DELETE FROM timetable_entries WHERE id = $1', [id]);
    await audit(ctx, 'timetable.deleted', { type: 'timetable_entry', id });
    return noContent(reply);
  });

  /* ----------------------------------------------------- content management */

  app.post('/staff/events', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireRole(ctx, 'staff');
    if (!(principal.role === 'admin' || principal.assignments.some((a) => a.can_publish_content))) {
      throw ApiError.forbidden('You are not authorised to publish events.');
    }
    const input = parse(
      z.object({
        title: z.string().trim().min(3).max(160),
        description: z.string().trim().max(2000).optional(),
        category: z.enum(['academic', 'career', 'social', 'sport', 'wellbeing', 'administrative']).default('academic'),
        starts_at: z.string().min(10),
        ends_at: z.string().min(10).optional(),
        venue: z.string().trim().max(160).optional(),
        building_id: z.string().uuid().nullable().optional(),
        room_id: z.string().uuid().nullable().optional(),
        capacity: z.coerce.number().int().min(1).max(10000).nullable().optional(),
        registration_required: z.coerce.boolean().default(false),
        status: z.enum(['draft', 'published']).default('published'),
      }),
      request.body ?? {},
    );

    const event = await ctx.db.one(
      `INSERT INTO events (title, description, category, starts_at, ends_at, venue, building_id, room_id,
                           capacity, registration_required, organiser_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        input.title,
        input.description ?? null,
        input.category,
        input.starts_at,
        input.ends_at ?? null,
        input.venue ?? null,
        input.building_id ?? null,
        input.room_id ?? null,
        input.capacity ?? null,
        input.registration_required,
        principal.id,
        input.status,
      ],
    );
    await audit(ctx, 'event.created', { type: 'event', id: String(event?.id) });
    return created(reply, { event }, 'Event published.');
  });

  app.patch('/staff/events/:id', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireRole(ctx, 'staff');
    if (!(principal.role === 'admin' || principal.assignments.some((a) => a.can_publish_content))) {
      throw ApiError.forbidden('You are not authorised to edit events.');
    }
    const { id } = request.params as { id: string };
    const input = parse(
      z.object({
        title: z.string().trim().min(3).max(160).optional(),
        description: z.string().trim().max(2000).nullable().optional(),
        starts_at: z.string().min(10).optional(),
        ends_at: z.string().min(10).nullable().optional(),
        venue: z.string().trim().max(160).nullable().optional(),
        status: z.enum(['draft', 'published', 'cancelled']).optional(),
      }),
      request.body ?? {},
    );
    const columns = Object.keys(input);
    if (columns.length === 0) throw ApiError.badRequest('No changes were provided.');
    const event = await ctx.db.one(
      `UPDATE events SET ${columns.map((column, index) => `${column} = $${index + 2}`).join(', ')}, updated_at = now()
        WHERE id = $1 RETURNING *`,
      [id, ...columns.map((column) => (input as Record<string, unknown>)[column])],
    );
    if (!event) throw ApiError.notFound('Event not found.');
    await audit(ctx, 'event.updated', { type: 'event', id });
    return ok(reply, { event }, 'Event updated.');
  });

  app.delete('/staff/events/:id', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireRole(ctx, 'staff');
    if (!(principal.role === 'admin' || principal.assignments.some((a) => a.can_publish_content))) {
      throw ApiError.forbidden('You are not authorised to remove events.');
    }
    const { id } = request.params as { id: string };
    const deleted = await ctx.db.query('DELETE FROM events WHERE id = $1 RETURNING id', [id]);
    if (deleted.length === 0) throw ApiError.notFound('Event not found.');
    await audit(ctx, 'event.deleted', { type: 'event', id });
    return noContent(reply);
  });

  /** Announcements the caller can see: their own drafts plus everything published. */
  app.get('/staff/announcements', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireRole(ctx, 'staff');
    if (!(principal.role === 'admin' || principal.assignments.some((a) => a.can_publish_content))) {
      throw ApiError.forbidden('You are not authorised to manage announcements.');
    }
    const announcements = await ctx.db.query(
      `SELECT a.*, b.code AS building_code, u.name AS author_name
         FROM announcements a
         LEFT JOIN buildings b ON b.id = a.building_id
         LEFT JOIN users u ON u.id = a.author_id
        WHERE a.author_id = $1 OR a.published_at IS NOT NULL
        ORDER BY a.is_pinned DESC, COALESCE(a.published_at, a.created_at) DESC
        LIMIT 100`,
      [principal.id],
    );
    return ok(reply, { announcements });
  });

  app.post('/staff/announcements', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireRole(ctx, 'staff');
    if (!(principal.role === 'admin' || principal.assignments.some((a) => a.can_publish_content))) {
      throw ApiError.forbidden('You are not authorised to publish announcements.');
    }
    const input = parse(
      z.object({
        title: z.string().trim().min(3).max(160),
        body: z.string().trim().min(3).max(4000),
        audience: z.array(z.enum(['all', 'students', 'staff'])).min(1).default(['all']),
        priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
        building_id: z.string().uuid().nullable().optional(),
        is_pinned: z.coerce.boolean().default(false),
        expires_at: z.string().nullable().optional(),
      }),
      request.body ?? {},
    );
    const announcement = await ctx.db.one(
      `INSERT INTO announcements (title, body, audience, priority, building_id, author_id, is_pinned, expires_at, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now()) RETURNING *`,
      [
        input.title,
        input.body,
        JSON.stringify(input.audience),
        input.priority,
        input.building_id ?? null,
        principal.id,
        input.is_pinned,
        input.expires_at ?? null,
      ],
    );
    await audit(ctx, 'announcement.created', { type: 'announcement', id: String(announcement?.id) });
    return created(reply, { announcement }, 'Announcement published.');
  });

  app.delete('/staff/announcements/:id', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireRole(ctx, 'staff');
    if (!(principal.role === 'admin' || principal.assignments.some((a) => a.can_publish_content))) {
      throw ApiError.forbidden('You are not authorised to remove announcements.');
    }
    const { id } = request.params as { id: string };
    const deleted = await ctx.db.query('DELETE FROM announcements WHERE id = $1 RETURNING id', [id]);
    if (deleted.length === 0) throw ApiError.notFound('Announcement not found.');
    await audit(ctx, 'announcement.deleted', { type: 'announcement', id });
    return noContent(reply);
  });
}
