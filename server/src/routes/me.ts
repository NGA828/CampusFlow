import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { created, noContent, ok, paginate } from '../lib/respond.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { studentTimetable, todayOverview, nextClass, groupByDay } from '../services/timetable.js';
import { activeTicketForStudent, ticketView } from '../services/queues.js';
import { activeOfficeTicket, officeStatus, officeTicketView, officeTicketHistory } from '../services/offices.js';
import { currentPosition } from '../services/positioning.js';
import { markAllRead, markRead, unreadCount } from '../services/notifications.js';
import { ctxOf } from '../http/context.js';

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  department: z.string().trim().max(120).nullable().optional(),
  avatar_url: z.string().trim().url().nullable().optional().or(z.literal('').transform(() => null)),
  locale: z.enum(['en']).optional(),
});

const deviceSchema = z.object({
  platform: z.enum(['ios', 'android', 'web']),
  token: z.string().trim().min(8).max(400),
});

const notificationsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(50).default(20),
  unread: z.coerce.boolean().optional(),
});

export async function registerMeRoutes(app: FastifyInstance): Promise<void> {
  app.patch('/me', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const input = parse(profileSchema, request.body ?? {});
    const columns = Object.keys(input);
    if (columns.length === 0) throw ApiError.badRequest('No profile fields were provided.');
    const row = await ctx.db.one<Record<string, unknown>>(
      `UPDATE users SET ${columns.map((column, index) => `${column} = $${index + 2}`).join(', ')}, updated_at = now()
        WHERE id = $1
        RETURNING id, name, email, role_code, registration_no, department, phone, avatar_url, locale`,
      [principal.id, ...columns.map((column) => (input as Record<string, unknown>)[column])],
    );
    return ok(reply, row, 'Profile updated.');
  });

  app.post('/me/devices', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    requirePermission(ctx, 'profile.manage.own');
    const input = parse(deviceSchema, request.body ?? {});
    await ctx.db.query(
      `INSERT INTO device_tokens (user_id, platform, token) VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, last_seen_at = now()`,
      [principal.id, input.platform, input.token],
    );
    return created(reply, { registered: true }, 'Device registered for notifications.');
  });

  app.delete('/me/devices/:token', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const { token } = request.params as { token: string };
    await ctx.db.query('DELETE FROM device_tokens WHERE token = $1 AND user_id = $2', [token, principal.id]);
    return noContent(reply);
  });

  app.get('/me/notifications', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const query = parse(notificationsQuery, request.query ?? {});
    const offset = (query.page - 1) * query.per_page;
    const filter = query.unread ? 'AND read_at IS NULL' : '';

    const totalRow = await ctx.db.one<{ total: string }>(
      `SELECT count(*)::text AS total FROM notifications WHERE user_id = $1 ${filter}`,
      [principal.id],
    );
    const rows = await ctx.db.query(
      `SELECT id, type, title, body, data, priority, read_at, created_at FROM notifications
        WHERE user_id = $1 ${filter}
        ORDER BY created_at DESC LIMIT ${query.per_page} OFFSET ${offset}`,
      [principal.id],
    );

    return ok(reply, {
      ...paginate(rows, Number(totalRow?.total ?? 0), query.page, query.per_page),
      unread: await unreadCount(ctx.db, principal.id),
    });
  });

  app.post('/me/notifications/:id/read', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const { id } = request.params as { id: string };
    const updated = await markRead(ctx.db, principal.id, id);
    if (!updated) throw ApiError.notFound('Notification not found.');
    return ok(reply, { unread: await unreadCount(ctx.db, principal.id) }, 'Notification marked as read.');
  });

  app.post('/me/notifications/read-all', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const count = await markAllRead(ctx.db, principal.id);
    return ok(reply, { marked: count, unread: 0 }, count === 0 ? 'Nothing to mark.' : `${count} notifications marked as read.`);
  });

  app.get('/me/timetable', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    requirePermission(ctx, 'timetable.view.own');
    const query = parse(
      z.object({ week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), term: z.string().trim().max(20).optional() }),
      request.query ?? {},
    );
    const timetable = await studentTimetable(ctx.db, principal.id, query);
    return ok(reply, { ...timetable, days: groupByDay(timetable.entries) });
  });

  app.get('/me/timetable/today', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    requirePermission(ctx, 'timetable.view.own');
    return ok(reply, await todayOverview(ctx.db, principal.id));
  });

  app.get('/me/next-class', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    requirePermission(ctx, 'timetable.view.own');
    return ok(reply, { next_class: await nextClass(ctx.db, principal.id) });
  });

  app.get('/me/dashboard', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);

    const [today, next] = await Promise.all([
      todayOverview(ctx.db, principal.id),
      nextClass(ctx.db, principal.id),
    ]);

    const ticket = await activeTicketForStudent(ctx.db, principal.id);
    const queueTicket = ticket ? await ticketView(ctx.db, ticket) : null;

    const officeTicket = await activeOfficeTicket(ctx.db, principal.id);
    const office = officeTicket
      ? officeTicketView(ctx.db, officeTicket.id)
      : null;

    const announcements = await ctx.db.query(
      `SELECT id, title, body, priority, published_at, is_pinned FROM announcements
        WHERE published_at <= now() AND (expires_at IS NULL OR expires_at > now())
        ORDER BY is_pinned DESC, published_at DESC LIMIT 4`,
    );
    const events = await ctx.db.query(
      `SELECT id, title, category, starts_at, ends_at, venue, building_id FROM events
        WHERE status = 'published' AND starts_at > now() ORDER BY starts_at LIMIT 4`,
    );
    const notifications = await ctx.db.query(
      `SELECT id, type, title, body, data, priority, read_at, created_at FROM notifications
        WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [principal.id],
    );

    const buildingStatus = await ctx.db.query<{ id: string; code: string; name: string; status: string }>(
      `SELECT id, code, name, status FROM buildings WHERE status <> 'operational' ORDER BY code`,
    );

    return ok(reply, {
      user: { id: principal.id, name: principal.name, role: principal.role, department: principal.department },
      today,
      next_class: next,
      queue_ticket: queueTicket,
      office_ticket: office ? await office : null,
      notifications,
      unread_notifications: await unreadCount(ctx.db, principal.id),
      announcements,
      events,
      building_alerts: buildingStatus,
      position: await currentPosition(ctx.db, principal.id),
    });
  });

  app.get('/me/queue-tickets/active', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const ticket = await activeTicketForStudent(ctx.db, principal.id);
    if (!ticket) return ok(reply, { ticket: null });
    return ok(reply, { ticket: await ticketView(ctx.db, ticket) });
  });

  app.get('/me/office-tickets/active', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const ticket = await activeOfficeTicket(ctx.db, principal.id);
    if (!ticket) return ok(reply, { ticket: null });
    return ok(reply, { ticket: await officeTicketView(ctx.db, ticket.id) });
  });

  app.get('/me/office-tickets', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const history = await officeTicketHistory(ctx.db, principal.id);
    return ok(reply, { tickets: history });
  });

  app.get('/me/office-tickets/:id', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const { id } = request.params as { id: string };
    const view = await officeTicketView(ctx.db, id);
    if (view.ticket.student_id !== principal.id && principal.role === 'student') {
      throw ApiError.forbidden('You can only view your own tickets.');
    }
    return ok(reply, view);
  });

  // Convenience alias used by the office screens to render opening hours + live queue.
  app.get('/me/offices/summary', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requireAuth(ctx);
    const offices = await ctx.db.query('SELECT id, code, name FROM administrative_offices WHERE is_active ORDER BY name');
    const summaries = [];
    for (const office of offices as { id: string }[]) {
      summaries.push(await officeStatus(ctx.db, office.id));
    }
    return ok(reply, { offices: summaries });
  });
}
