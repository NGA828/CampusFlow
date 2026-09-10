import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { created, noContent, ok, paginate } from '../lib/respond.js';
import { requireAuth } from '../middleware/auth.js';
import { ctxOf } from '../http/context.js';

const eventQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(50).default(12),
  category: z.enum(['academic', 'career', 'social', 'sport', 'wellbeing', 'administrative']).optional(),
  past: z.coerce.boolean().default(false),
  building_id: z.string().uuid().optional(),
});

/** Events and announcements — readable by visitors, registered for by students. */
export async function registerEngagementRoutes(app: FastifyInstance): Promise<void> {
  app.get('/events', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const query = parse(eventQuery, request.query ?? {});
    const where: string[] = [`e.status = 'published'`, query.past ? `e.starts_at < now()` : `e.starts_at >= now()`];
    const values: unknown[] = [];
    if (query.category) {
      values.push(query.category);
      where.push(`e.category = $${values.length}`);
    }
    if (query.building_id) {
      values.push(query.building_id);
      where.push(`e.building_id = $${values.length}`);
    }

    const totalRow = await ctx.db.one<{ total: string }>(`SELECT count(*)::text AS total FROM events e WHERE ${where.join(' AND ')}`, values);
    const offset = (query.page - 1) * query.per_page;
    const events = await ctx.db.query(
      `SELECT e.*, b.code AS building_code, b.name AS building_name, r.code AS room_code,
              u.name AS organiser_name,
              (SELECT count(*)::int FROM event_registrations g WHERE g.event_id = e.id) AS registrations
         FROM events e
         LEFT JOIN buildings b ON b.id = e.building_id
         LEFT JOIN rooms r ON r.id = e.room_id
         LEFT JOIN users u ON u.id = e.organiser_id
        WHERE ${where.join(' AND ')}
        ORDER BY ${query.past ? 'e.starts_at DESC' : 'e.starts_at ASC'}
        LIMIT ${query.per_page} OFFSET ${offset}`,
      values,
    );

    const principal = request.cfContext?.principal;
    let registered: string[] = [];
    if (principal) {
      const rows = await ctx.db.query<{ event_id: string }>(
        'SELECT event_id FROM event_registrations WHERE user_id = $1',
        [principal.id],
      );
      registered = rows.map((row) => row.event_id);
    }

    return ok(reply, { ...paginate(events, Number(totalRow?.total ?? 0), query.page, query.per_page), registered_event_ids: registered });
  });

  app.get('/events/:id', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const { id } = request.params as { id: string };
    const event = await ctx.db.one(
      `SELECT e.*, b.code AS building_code, b.name AS building_name, r.code AS room_code,
              (SELECT count(*)::int FROM event_registrations g WHERE g.event_id = e.id) AS registrations
         FROM events e
         LEFT JOIN buildings b ON b.id = e.building_id
         LEFT JOIN rooms r ON r.id = e.room_id
        WHERE e.id::text = $1`,
      [id],
    );
    if (!event) throw ApiError.notFound('Event not found.');
    return ok(reply, { event });
  });

  app.post('/events/:id/register', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const { id } = request.params as { id: string };

    const event = await ctx.db.one<{ id: string; capacity: number | null; status: string; starts_at: string }>(
      'SELECT id, capacity, status, starts_at FROM events WHERE id = $1',
      [id],
    );
    if (!event) throw ApiError.notFound('Event not found.');
    if (event.status !== 'published') throw ApiError.conflict('This event is not open for registration.', 'EVENT_CLOSED');
    if (new Date(event.starts_at).getTime() < Date.now()) throw ApiError.conflict('This event has already taken place.', 'EVENT_PAST');

    if (event.capacity) {
      const countRow = await ctx.db.one<{ count: string }>('SELECT count(*)::text AS count FROM event_registrations WHERE event_id = $1', [id]);
      if (Number(countRow?.count ?? 0) >= event.capacity) {
        throw ApiError.conflict('This event is fully booked.', 'EVENT_FULL');
      }
    }

    await ctx.db.query(
      `INSERT INTO event_registrations (event_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [id, principal.id],
    );
    return created(reply, { registered: true }, 'You are registered for this event.');
  });

  app.delete('/events/:id/register', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const { id } = request.params as { id: string };
    await ctx.db.query('DELETE FROM event_registrations WHERE event_id = $1 AND user_id = $2', [id, principal.id]);
    return noContent(reply);
  });

  app.get('/announcements', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = request.cfContext?.principal;
    const query = parse(
      z.object({
        page: z.coerce.number().int().min(1).default(1),
        per_page: z.coerce.number().int().min(1).max(50).default(12),
      }),
      request.query ?? {},
    );

    const audience = principal?.role === 'staff' || principal?.role === 'admin' ? ['staff', 'all'] : principal ? ['students', 'all'] : ['all'];
    const offset = (query.page - 1) * query.per_page;

    const totalRow = await ctx.db.one<{ total: string }>(
      `SELECT count(*)::text AS total FROM announcements
        WHERE published_at <= now() AND (expires_at IS NULL OR expires_at > now())
          AND audience ?| $1::text[]`,
      [audience],
    );
    const rows = await ctx.db.query(
      `SELECT a.id, a.title, a.body, a.priority, a.is_pinned, a.published_at, a.expires_at,
              b.code AS building_code, u.name AS author_name
         FROM announcements a
         LEFT JOIN buildings b ON b.id = a.building_id
         LEFT JOIN users u ON u.id = a.author_id
        WHERE a.published_at <= now() AND (a.expires_at IS NULL OR a.expires_at > now())
          AND a.audience ?| $1::text[]
        ORDER BY a.is_pinned DESC, a.published_at DESC
        LIMIT ${query.per_page} OFFSET ${offset}`,
      [audience],
    );

    return ok(reply, paginate(rows, Number(totalRow?.total ?? 0), query.page, query.per_page));
  });

  app.get('/announcements/:id', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const { id } = request.params as { id: string };
    const announcement = await ctx.db.one(
      `SELECT a.*, b.code AS building_code, b.name AS building_name, u.name AS author_name
         FROM announcements a
         LEFT JOIN buildings b ON b.id = a.building_id
         LEFT JOIN users u ON u.id = a.author_id
        WHERE a.id = $1`,
      [id],
    );
    if (!announcement) throw ApiError.notFound('Announcement not found.');
    return ok(reply, { announcement });
  });
}
