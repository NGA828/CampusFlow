import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { created, ok } from '../lib/respond.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { withIdempotency } from '../lib/idempotency.js';
import {
  activeOfficeTicket,
  cancelOfficeTicket,
  getOffice,
  getOfficeTicket,
  listOffices,
  markOfficeApproaching,
  officeCheckIn,
  officeStatus,
  officeTicketView,
  requestOfficeTicket,
} from '../services/offices.js';
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

const requestSchema = z.object({
  subject: z.string().trim().min(3, 'Describe your request in a few words.').max(180),
  notes: z.string().trim().max(500).optional(),
  qr_code: z.string().trim().max(200).optional(),
  fix: fixSchema,
});

/** Administrative office ticketing (PROMPT §24–§27). */
export async function registerOfficeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/offices', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const offices = await listOffices(ctx.db);

    // Opening state is computed per office from its service windows.
    const statuses = [];
    for (const office of offices) {
      const status = await officeStatus(ctx.db, office.id);
      statuses.push({
        ...office,
        is_open_now: status.is_open_now,
        opens_at: status.opens_at,
        closes_at: status.closes_at,
        next_opening: status.next_opening,
        average_service_minutes: status.average_service_minutes,
        estimated_wait_minutes: status.estimated_wait_minutes,
        next_ticket_number: status.next_ticket_number,
        today_windows: status.today_windows,
      });
    }

    const mine = await activeOfficeTicket(ctx.db, principal.id);
    return ok(reply, {
      offices: statuses,
      my_ticket: mine ? await officeTicketView(ctx.db, mine.id) : null,
    });
  });

  app.get('/offices/:idOrCode', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const { idOrCode } = request.params as { idOrCode: string };
    const office = await getOffice(ctx.db, idOrCode);
    const status = await officeStatus(ctx.db, office.id);
    const mine = await activeOfficeTicket(ctx.db, principal.id);

    return ok(reply, {
      ...status,
      my_ticket: mine && mine.office_id === office.id ? await officeTicketView(ctx.db, mine.id) : null,
      today_in_line: await ctx.db.query<{ position: number; status: string }>(
        `SELECT position, status FROM office_tickets
          WHERE office_id = $1 AND status IN ('REQUESTED','TICKET_ASSIGNED','WAITING','APPROACHING','CALLED','CHECK_IN_WINDOW')
          ORDER BY position`,
        [office.id],
      ),
    });
  });

  app.post('/offices/:id/tickets', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    requirePermission(ctx, 'office.request');
    const { id } = request.params as { id: string };
    const input = parse(requestSchema, request.body ?? {});
    const office = await getOffice(ctx.db, id);

    const result = await withIdempotency(
      ctx.db,
      {
        key: request.headers['idempotency-key'] as string | undefined,
        userId: principal.id,
        endpoint: 'POST /offices/:id/tickets',
        payload: { office: office.id, ...input },
      },
      async () => {
        const { ticket } = await requestOfficeTicket(ctx.db, principal.id, {
          officeId: office.id,
          subject: input.subject,
          notes: input.notes,
          qrCode: input.qr_code,
          fix: input.fix,
        });
        const view = await officeTicketView(ctx.db, ticket.id);
        return { status: 201, body: { ticket: view } };
      },
    );

    if (result.status === 201 && !result.replayed) {
      return created(reply, result.body, `Ticket issued by ${office.name}.`);
    }
    return ok(reply, result.body, result.replayed ? 'This request was already processed.' : 'Ticket issued.');
  });

  app.get('/office-tickets/:id', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const { id } = request.params as { id: string };
    const ticket = await getOfficeTicket(ctx.db, id);
    if (ticket.student_id !== principal.id && principal.role === 'student') {
      throw ApiError.forbidden('You can only view your own tickets.');
    }
    return ok(reply, await officeTicketView(ctx.db, id));
  });

  app.post('/office-tickets/:id/cancel', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const { id } = request.params as { id: string };
    const input = parse(z.object({ reason: z.string().trim().max(200).optional() }), request.body ?? {});
    const ticket = await cancelOfficeTicket(
      ctx.db,
      { id: principal.id, isStaff: principal.role === 'staff', isAdmin: principal.role === 'admin' },
      id,
      input.reason,
    );
    return ok(reply, { ticket }, 'Office ticket cancelled.');
  });

  app.post('/office-tickets/:id/check-in', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const { id } = request.params as { id: string };
    const input = parse(z.object({ qr_code: z.string().trim().max(200).optional(), fix: fixSchema }), request.body ?? {});
    const result = await officeCheckIn(
      ctx.db,
      { id: principal.id, isStaff: principal.role === 'staff', isAdmin: principal.role === 'admin' },
      id,
      { qrCode: input.qr_code, fix: input.fix },
    );
    return ok(reply, result, 'Checked in at the office.');
  });

  app.post('/office-tickets/:id/approaching', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const { id } = request.params as { id: string };
    const ticket = await markOfficeApproaching(ctx.db, principal.id, id);
    return ok(reply, { ticket }, 'Marked as approaching.');
  });

  app.get('/office-tickets/:id/history', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const { id } = request.params as { id: string };
    const ticket = await getOfficeTicket(ctx.db, id);
    if (ticket.student_id !== principal.id && principal.role === 'student') {
      throw ApiError.forbidden('You can only view your own tickets.');
    }
    const events = await ctx.db.query(
      `SELECT type, metadata, created_at FROM office_ticket_events WHERE ticket_id = $1 ORDER BY created_at`,
      [id],
    );
    return ok(reply, { events });
  });
}
