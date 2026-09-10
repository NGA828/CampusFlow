import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { created, ok } from '../lib/respond.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { withIdempotency } from '../lib/idempotency.js';
import {
  checkIn,
  checkProximity,
  getQueue,
  getTicket,
  joinQueue,
  LINE_STATUSES,
  markNavigating,
  cancelTicket,
  queueCounts,
  ticketView,
  type TicketView,
} from '../services/queues.js';
import { getRoomAvailability } from '../services/campus.js';
import { ctxOf } from '../http/context.js';

const fixSchema = z
  .object({
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
    plan_x: z.number().nullable().optional(),
    plan_y: z.number().nullable().optional(),
    floor_id: z.string().uuid().nullable().optional(),
    source: z.enum(['qr', 'gps', 'manual', 'simulated']).optional(),
  })
  .optional();

const joinSchema = z.object({
  qr_code: z.string().trim().max(200).optional(),
  fix: fixSchema,
});

async function queueSnapshot(db: Parameters<typeof queueCounts>[0], queueId: string, viewerId: string) {
  const queue = await getQueue(db, queueId);
  const counts = await queueCounts(db, queue.id);
  const availability = await getRoomAvailability(db, queue.room_id);

  const line = await db.query<{ position: number; status: string; issued_at: string; called_at: string | null; eta_seconds: number | null }>(
    `SELECT position, status, issued_at, called_at, eta_seconds FROM queue_tickets
      WHERE queue_id = $1 AND status IN (${LINE_STATUSES.map((status) => `'${status}'`).join(', ')})
      ORDER BY position`,
    [queue.id],
  );

  const mine = await db.one(
    `SELECT id FROM queue_tickets WHERE queue_id = $1 AND student_id = $2
      AND status IN ('QUEUE_PENDING','WAITING','CALLED','NAVIGATING','APPROACHING','CHECK_IN_WINDOW','CHECKED_IN','ADMITTED')
      ORDER BY issued_at DESC LIMIT 1`,
    [queue.id, viewerId],
  );

  return {
    queue: {
      id: queue.id,
      room_id: queue.room_id,
      is_active: queue.is_active,
      max_size: queue.max_size,
      admission_capacity: queue.admission_capacity,
      avg_service_seconds: queue.avg_service_seconds,
      proximity_radius_m: queue.proximity_radius_m,
      requires_proximity_to_join: queue.requires_proximity_to_join,
      check_in_window_seconds: queue.check_in_window_seconds,
      grace_period_seconds: queue.grace_period_seconds,
      opens_at: queue.opens_at,
      closes_at: queue.closes_at,
      notes: queue.notes,
    },
    room: {
      id: queue.room_id,
      code: queue.room_code,
      name: queue.room_name,
      capacity: queue.room_capacity,
      building_id: queue.building_id,
      building_code: queue.building_code,
      building_name: queue.building_name,
      floor_id: queue.floor_id,
      floor_name: queue.floor_name,
      floor_level: queue.floor_level,
      plan_x: queue.room_plan_x,
      plan_y: queue.room_plan_y,
    },
    counts,
    availability,
    // Anonymous line: positions and waits only — never names or ticket numbers of others.
    line: line.map((row) => ({
      position: row.position,
      status: row.status,
      eta_seconds: row.eta_seconds,
      issued_at: row.issued_at,
      called_at: row.called_at,
    })),
    my_ticket_id: mine?.id ?? null,
  };
}

export async function registerQueueRoutes(app: FastifyInstance): Promise<void> {
  app.get('/rooms/:id/queue', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const { id } = request.params as { id: string };
    const queue = await getQueue(ctx.db, id);
    return ok(reply, await queueSnapshot(ctx.db, queue.id, principal.id));
  });

  /** Every active room queue, with room context and the caller's own active ticket. */
  app.get('/queues', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const queues = await ctx.db.query(
      `SELECT q.id, q.room_id, q.is_active, q.max_size, q.admission_capacity, q.avg_service_seconds,
              q.proximity_radius_m, q.requires_proximity_to_join, q.check_in_window_seconds,
              q.grace_period_seconds, q.opens_at, q.closes_at, q.notes,
              r.code AS room_code, r.name AS room_name, r.capacity AS room_capacity, r.plan_x, r.plan_y,
              b.id AS building_id, b.code AS building_code, b.name AS building_name,
              f.id AS floor_id, f.name AS floor_name, f.level AS floor_level,
              (SELECT count(*)::int FROM queue_tickets t
                WHERE t.queue_id = q.id AND t.status IN ('QUEUE_PENDING','WAITING')) AS waiting,
              (SELECT count(*)::int FROM queue_tickets t
                WHERE t.queue_id = q.id AND t.status IN ('CHECKED_IN','ADMITTED')) AS serving,
              (SELECT t.id FROM queue_tickets t
                WHERE t.queue_id = q.id AND t.student_id = $1
                  AND t.status IN ('QUEUE_PENDING','WAITING','CALLED','NAVIGATING','APPROACHING','CHECK_IN_WINDOW','CHECKED_IN','ADMITTED')
                ORDER BY t.issued_at DESC LIMIT 1) AS my_ticket_id
         FROM room_queues q
         JOIN rooms r ON r.id = q.room_id
         JOIN buildings b ON b.id = r.building_id
         JOIN floors f ON f.id = r.floor_id
        WHERE q.is_active
        ORDER BY b.code, r.code`,
      [principal.id],
    );
    return ok(reply, { queues });
  });

  app.get('/queues/:id', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const { id } = request.params as { id: string };
    const queue = await getQueue(ctx.db, id);
    return ok(reply, await queueSnapshot(ctx.db, queue.id, principal.id));
  });

  /** Join a controlled queue. Duplicate submissions are collapsed by the idempotency key. */
  app.post('/queues/:id/tickets', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    requirePermission(ctx, 'queue.join');
    const { id } = request.params as { id: string };
    const input = parse(joinSchema, request.body ?? {});
    const queue = await getQueue(ctx.db, id);

    const result = await withIdempotency(
      ctx.db,
      {
        key: request.headers['idempotency-key'] as string | undefined,
        userId: principal.id,
        endpoint: 'POST /queues/:id/tickets',
        payload: { queue: queue.id, ...input },
      },
      async () => {
        const joined = await joinQueue(ctx.db, principal.id, {
          queueId: queue.id,
          qrCode: input.qr_code,
          fix: input.fix,
        });
        const view = await ticketView(ctx.db, joined.ticket);
        return { status: 201, body: { ticket: view, counts: joined.counts, proximity: joined.proximity } };
      },
    );

    if (result.status === 201 && !result.replayed) {
      return created(reply, result.body, 'You joined the queue.');
    }
    return ok(reply, result.body, result.replayed ? 'This request was already processed.' : 'Queue ticket.');
  });

  app.get('/queue-tickets/:id', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const { id } = request.params as { id: string };
    const ticket = await getTicket(ctx.db, id);
    if (ticket.student_id !== principal.id && principal.role === 'student') {
      throw ApiError.forbidden('You can only view your own tickets.');
    }
    return ok(reply, await ticketView(ctx.db, ticket));
  });

  app.post('/queue-tickets/:id/cancel', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const { id } = request.params as { id: string };
    const input = parse(z.object({ reason: z.string().trim().max(200).optional() }), request.body ?? {});

    const ticket = await cancelTicket(
      ctx.db,
      { id: principal.id, isStaff: principal.role === 'staff', isAdmin: principal.role === 'admin' },
      id,
      input.reason,
    );
    return ok(reply, { ticket }, 'Ticket cancelled.');
  });

  app.post('/queue-tickets/:id/check-in', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const { id } = request.params as { id: string };
    const input = parse(joinSchema, request.body ?? {});

    const result = await checkIn(
      ctx.db,
      { id: principal.id, isStaff: principal.role === 'staff', isAdmin: principal.role === 'admin' },
      id,
      { qrCode: input.qr_code, fix: input.fix },
    );
    return ok(reply, result, 'Checked in. Please wait to be admitted.');
  });

  /** The student has started walking to the room. */
  app.post('/queue-tickets/:id/navigating', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const { id } = request.params as { id: string };
    const ticket = await markNavigating(ctx.db, principal.id, id);
    return ok(reply, { ticket }, 'On my way.');
  });

  /** Preview the proximity verdict before attempting to join (used by the mobile app). */
  app.post('/queues/:id/proximity-check', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const { id } = request.params as { id: string };
    const input = parse(joinSchema, request.body ?? {});
    const queue = await getQueue(ctx.db, id);

    const verdict = await checkProximity(ctx.db, {
      userId: principal.id,
      room: {
        id: queue.room_id,
        lat: queue.room_lat === null ? null : Number(queue.room_lat),
        lng: queue.room_lng === null ? null : Number(queue.room_lng),
        plan_x: Number(queue.room_plan_x),
        plan_y: Number(queue.room_plan_y),
        floor_id: queue.floor_id,
      },
      radiusM: Number(queue.proximity_radius_m),
      fix: input.fix,
      qrCode: input.qr_code,
    });
    return ok(reply, verdict);
  });

  app.get('/queue-tickets/:id/history', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const { id } = request.params as { id: string };
    const ticket = await getTicket(ctx.db, id);
    if (ticket.student_id !== principal.id && principal.role === 'student') {
      throw ApiError.forbidden('You can only view your own tickets.');
    }
    const events = await ctx.db.query(
      `SELECT type, metadata, created_at FROM queue_events WHERE ticket_id = $1 ORDER BY created_at`,
      [id],
    );
    return ok(reply, { events });
  });
}

export type { TicketView };
