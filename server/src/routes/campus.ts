import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parse } from '../lib/validate.js';
import { ok, paginate } from '../lib/respond.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import {
  floorAvailability,
  getBuilding,
  getFloorPlan,
  getRoom,
  getRoomAvailability,
  listBuildings,
  listFloors,
  searchRooms,
} from '../services/campus.js';
import { ctxOf } from '../http/context.js';

const roomQuery = z.object({
  q: z.string().trim().max(120).optional(),
  building_id: z.string().uuid().optional(),
  building_code: z.string().trim().max(8).optional(),
  floor_id: z.string().uuid().optional(),
  room_type: z.enum(['lecture', 'lab', 'study', 'office', 'library', 'auditorium', 'meeting', 'service', 'other']).optional(),
  min_capacity: z.coerce.number().int().min(0).max(2000).optional(),
  requires_admission: z.coerce.boolean().optional(),
  available_now: z.coerce.boolean().optional(),
  available_at: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(60).default(24),
});

/**
 * Campus read API. Building and room data is available to every authenticated user (and
 * to visitors for the public subset), while anything spatial-editing related lives in the
 * admin routes.
 */
export async function registerCampusRoutes(app: FastifyInstance): Promise<void> {
  app.get('/buildings', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const buildings = await listBuildings(ctx.db);
    return ok(reply, { buildings });
  });

  app.get('/buildings/:idOrCode', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const { idOrCode } = request.params as { idOrCode: string };
    const building = await getBuilding(ctx.db, idOrCode);
    const floors = await listFloors(ctx.db, building.id);
    return ok(reply, { building, floors });
  });

  app.get('/buildings/:id/floors', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const { id } = request.params as { id: string };
    const building = await getBuilding(ctx.db, id);
    return ok(reply, { floors: await listFloors(ctx.db, building.id) });
  });

  app.get('/floors/:id/plan', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requireAuth(ctx);
    const { id } = request.params as { id: string };
    const query = parse(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }), request.query ?? {});
    const plan = await getFloorPlan(ctx.db, id, query.date);
    return ok(reply, { ...plan, busy: plan.busy });
  });

  app.get('/rooms', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const query = parse(roomQuery, request.query ?? {});
    const { rooms, total } = await searchRooms(ctx.db, {
      q: query.q,
      building_id: query.building_id,
      building_code: query.building_code,
      floor_id: query.floor_id,
      room_type: query.room_type,
      min_capacity: query.min_capacity,
      requires_admission: query.requires_admission,
      available_at: query.available_at,
      date: query.date,
      page: query.page,
      per_page: query.per_page,
    });

    // Availability summaries are computed in one batch per room; capacity filters are
    // applied before the summaries so the list only carries what the client will render.
    const withAvailability = [];
    for (const room of rooms) {
      const availability = await getRoomAvailability(ctx.db, room.id, { date: query.date, fromTime: query.available_at });
      if (query.available_now && !availability.is_available_now) continue;
      withAvailability.push({ ...room, availability });
    }

    return ok(reply, {
      ...paginate(withAvailability, total, query.page, query.per_page),
      query: { ...query },
    });
  });

  app.get('/rooms/:idOrCode', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const { idOrCode } = request.params as { idOrCode: string };
    const room = await getRoom(ctx.db, idOrCode);
    const availability = await getRoomAvailability(ctx.db, room.id);
    const week = await ctx.db.query(
      `SELECT t.day_of_week, to_char(t.starts_at, 'HH24:MI') AS starts_at, to_char(t.ends_at, 'HH24:MI') AS ends_at,
              c.code AS course_code, c.title AS course_title, t.session_type
         FROM timetable_entries t
         JOIN courses c ON c.id = t.course_id
        WHERE t.room_id = $1
        ORDER BY t.day_of_week, t.starts_at`,
      [room.id],
    );
    return ok(reply, { room, availability, week });
  });

  app.get('/rooms/:id/availability', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const { id } = request.params as { id: string };
    const query = parse(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        from: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      }),
      request.query ?? {},
    );
    const room = await getRoom(ctx.db, id);
    const availability = await getRoomAvailability(ctx.db, room.id, { date: query.date, fromTime: query.from });
    return ok(reply, availability);
  });

  app.get('/floors/:id/availability', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requireAuth(ctx);
    const { id } = request.params as { id: string };
    const query = parse(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }), request.query ?? {});
    const map = await floorAvailability(ctx.db, id, query.date);
    return ok(reply, { busy: Object.fromEntries(map) });
  });

  /** Public landing-page payload: campus facts that carry no personal data. */
  app.get('/public/overview', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const [counts, buildings, events, announcements] = await Promise.all([
      ctx.db.one<Record<string, string>>(
        `SELECT
            (SELECT count(*) FROM buildings)::text AS buildings,
            (SELECT count(*) FROM rooms)::text AS rooms,
            (SELECT count(*) FROM administrative_offices WHERE is_active)::text AS offices,
            (SELECT coalesce(sum(capacity), 0) FROM rooms)::text AS seats`,
      ),
      ctx.db.query('SELECT id, code, name, description, lat, lng, status FROM buildings ORDER BY code'),
      ctx.db.query(
        `SELECT id, title, description, category, starts_at, ends_at, venue, building_id FROM events
          WHERE status = 'published' AND starts_at > now() ORDER BY starts_at LIMIT 3`,
      ),
      ctx.db.query(
        `SELECT id, title, body, priority, published_at FROM announcements
          WHERE published_at <= now() AND (expires_at IS NULL OR expires_at > now())
            AND '["all"]'::jsonb <@ audience
          ORDER BY is_pinned DESC, published_at DESC LIMIT 3`,
      ),
    ]);

    return ok(reply, {
      stats: {
        buildings: Number(counts?.buildings ?? 0),
        rooms: Number(counts?.rooms ?? 0),
        offices: Number(counts?.offices ?? 0),
        seats: Number(counts?.seats ?? 0),
      },
      buildings,
      events,
      announcements,
      campus: {
        name: 'Northfield University',
        timezone: process.env.CAMPUS_TIMEZONE ?? 'UTC',
      },
    });
  });

  app.get('/health', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const started = Date.now();
    const row = await ctx.db.one<{ version: string }>('SELECT version() AS version');
    return ok(reply, {
      status: 'ok',
      database: {
        engine: String(row?.version ?? '').split(' ').slice(0, 2).join(' '),
        latency_ms: Date.now() - started,
      },
      time: new Date().toISOString(),
    });
  });

  void requirePermission;
}
