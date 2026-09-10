import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { emitToUser } from '../realtime/bus.js';
import { ApiError } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { created, ok } from '../lib/respond.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { calculateRoute, evaluateRoutePosition, resolveNodeForRoom, type Route } from '../services/navigation.js';
import { currentPosition, updatePosition } from '../services/positioning.js';
import { ctxOf } from '../http/context.js';

const destinationSchema = z
  .object({
    to_room_id: z.string().uuid().optional(),
    to_room_code: z.string().trim().max(20).optional(),
    to_node_id: z.string().uuid().optional(),
    from_node_id: z.string().uuid().optional(),
    accessible: z.coerce.boolean().default(false),
  })
  .refine((value) => Boolean(value.to_room_id ?? value.to_room_code ?? value.to_node_id), {
    message: 'Provide a destination room or node.',
    path: ['to_room_id'],
  });

export async function registerNavigationRoutes(app: FastifyInstance): Promise<void> {
  app.post('/navigation/route', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    requirePermission(ctx, 'navigation.use');
    const input = parse(destinationSchema, request.body ?? {});

    const roomId = input.to_room_id ?? (input.to_room_code ? await resolveRoomIdFromCode(ctx.db, input.to_room_code) : undefined);
    const position = roomId || input.to_node_id ? await currentPosition(ctx.db, principal.id) : null;

    const { route, destination_label } = await calculateRoute(ctx.db, {
      toRoomId: roomId,
      toNodeId: input.to_node_id,
      fromNodeId: input.from_node_id,
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
      accessible: input.accessible,
    });

    return ok(reply, { route, destination_label, origin: route.origin, destination: route.destination });
  });

  /** Start a navigation session: the route is persisted and progress is tracked server-side. */
  app.post('/navigation/sessions', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    requirePermission(ctx, 'navigation.use');
    const input = parse(destinationSchema, request.body ?? {});

    const roomId = input.to_room_id ?? (input.to_room_code ? await resolveRoomIdFromCode(ctx.db, input.to_room_code) : undefined);
    const position = await currentPosition(ctx.db, principal.id);
    if (!position && !input.from_node_id) {
      return reply.status(409).send({
        success: false,
        message: 'Scan a QR anchor first so I know where you are starting from.',
        code: 'NO_POSITION',
      });
    }

    const { route, destination_label } = await calculateRoute(ctx.db, {
      toRoomId: roomId,
      toNodeId: input.to_node_id,
      fromNodeId: input.from_node_id,
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
      accessible: input.accessible,
    });

    const session = await ctx.db.one<{ id: string; started_at: string }>(
      `INSERT INTO navigation_sessions
         (user_id, origin_node_id, destination_node_id, destination_room_id, destination_label,
          requires_accessible, route, distance_m, duration_seconds, status, last_position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10)
       RETURNING id, started_at`,
      [
        principal.id,
        route.origin.id,
        route.destination.id,
        roomId ?? null,
        destination_label,
        input.accessible,
        JSON.stringify(route),
        route.distance_m,
        route.duration_seconds,
        position ? JSON.stringify({ lat: position.lat, lng: position.lng, floor_id: position.floor_id }) : null,
      ],
    );

    await ctx.db.query(`INSERT INTO navigation_events (session_id, type, payload) VALUES ($1, 'started', $2)`, [
      session!.id,
      JSON.stringify({ destination: destination_label, distance_m: route.distance_m, accessible: input.accessible }),
    ]);

    emitToUser(principal.id, 'navigation.started', {
      session_id: session!.id,
      destination: destination_label,
      distance_m: route.distance_m,
      duration_seconds: route.duration_seconds,
    });

    return created(reply, { session_id: session!.id, started_at: session!.started_at, route, destination_label }, 'Navigation started.');
  });

  app.get('/navigation/sessions/active', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const session = await ctx.db.one<{
      id: string;
      route: Route;
      status: string;
      distance_m: number;
      duration_seconds: number;
      destination_label: string;
      current_step_index: number;
      off_route_events: number;
      recalculations: number;
      started_at: string;
      requires_accessible: boolean;
    }>(
      `SELECT id, route, status, distance_m, duration_seconds, destination_label, current_step_index,
              off_route_events, recalculations, started_at, requires_accessible
         FROM navigation_sessions WHERE user_id = $1 AND status = 'active' ORDER BY started_at DESC LIMIT 1`,
      [principal.id],
    );
    if (!session) return ok(reply, { session: null });

    const position = await currentPosition(ctx.db, principal.id);
    const evaluation = position
      ? evaluateRoutePosition(session.route, {
          lat: position.lat,
          lng: position.lng,
          plan_x: position.plan_x,
          plan_y: position.plan_y,
          floor_id: position.floor_id,
        })
      : null;

    const deviation = await ctx.db.one(
      `SELECT id, status, detections, max_distance_m, first_detected_at
         FROM navigation_deviations WHERE session_id = $1 AND resolved_at IS NULL LIMIT 1`,
      [session.id],
    );

    return ok(reply, { session, evaluation, deviation, position });
  });

  /** Live position update for the active walk — also drives off-route handling. */
  app.post('/navigation/sessions/:id/position', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    requirePermission(ctx, 'navigation.use');
    const { id } = request.params as { id: string };

    const session = await ctx.db.one<{ id: string; user_id: string; status: string }>(
      'SELECT id, user_id, status FROM navigation_sessions WHERE id = $1',
      [id],
    );
    if (!session) throw ApiError.notFound('Navigation session not found.');
    if (session.user_id !== principal.id) throw ApiError.forbidden('This navigation session belongs to another user.');
    if (session.status !== 'active') throw ApiError.conflict('This navigation session is no longer active.');

    const input = parse(
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        accuracy_m: z.number().nullable().optional(),
        source: z.enum(['gps', 'manual', 'simulated']).default('gps'),
        plan_x: z.number().nullable().optional(),
        plan_y: z.number().nullable().optional(),
        floor_id: z.string().uuid().nullable().optional(),
      }),
      request.body ?? {},
    );

    const result = await updatePosition(ctx.db, principal.id, input);
    return ok(reply, result);
  });

  app.post('/navigation/sessions/:id/complete', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const { id } = request.params as { id: string };
    const session = await ctx.db.one<{ id: string; user_id: string; status: string }>(
      'SELECT id, user_id, status FROM navigation_sessions WHERE id = $1',
      [id],
    );
    if (!session) throw ApiError.notFound('Navigation session not found.');
    if (session.user_id !== principal.id) throw ApiError.forbidden('This navigation session belongs to another user.');

    await ctx.db.query(
      `UPDATE navigation_sessions SET status = 'completed', ended_at = now(), updated_at = now() WHERE id = $1`,
      [id],
    );
    await ctx.db.query(`INSERT INTO navigation_events (session_id, type, payload) VALUES ($1, 'completed', '{}'::jsonb)`, [id]);
    return ok(reply, { status: 'completed' }, 'Navigation completed.');
  });

  app.post('/navigation/sessions/:id/abandon', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const { id } = request.params as { id: string };
    const input = parse(z.object({ reason: z.string().trim().max(200).optional() }), request.body ?? {});

    const session = await ctx.db.one<{ id: string; user_id: string }>(
      'SELECT id, user_id FROM navigation_sessions WHERE id = $1',
      [id],
    );
    if (!session) throw ApiError.notFound('Navigation session not found.');
    if (session.user_id !== principal.id) throw ApiError.forbidden('This navigation session belongs to another user.');

    // Abandonment is only ever an explicit user action (PROMPT §16).
    await ctx.db.query(`UPDATE navigation_sessions SET status = 'abandoned', ended_at = now(), updated_at = now() WHERE id = $1`, [id]);
    await ctx.db.query(`INSERT INTO navigation_events (session_id, type, payload) VALUES ($1, 'abandoned', $2)`, [
      id,
      JSON.stringify({ reason: input.reason ?? 'user_cancelled' }),
    ]);
    return ok(reply, { status: 'abandoned' }, 'Navigation stopped.');
  });

  app.get('/navigation/sessions', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const sessions = await ctx.db.query(
      `SELECT id, destination_label, status, distance_m, duration_seconds, recalculations,
              off_route_events, started_at, ended_at
         FROM navigation_sessions WHERE user_id = $1 ORDER BY started_at DESC LIMIT 25`,
      [principal.id],
    );
    return ok(reply, { sessions });
  });

  app.get('/navigation/nodes/:id', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requireAuth(ctx);
    const { id } = request.params as { id: string };
    const node = await ctx.db.one(
      `SELECT n.id, n.code, n.label, n.kind, n.plan_x, n.plan_y, n.lat, n.lng, n.is_accessible,
              n.floor_id, n.building_id, f.name AS floor_name, b.code AS building_code
         FROM navigation_nodes n
         LEFT JOIN floors f ON f.id = n.floor_id
         LEFT JOIN buildings b ON b.id = n.building_id
        WHERE n.id::text = $1 OR upper(n.code) = upper($1)`,
      [id],
    );
    if (!node) throw ApiError.notFound('Navigation node not found.');
    return ok(reply, { node });
  });

  app.get('/navigation/nodes/:id/room', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requireAuth(ctx);
    const { id } = request.params as { id: string };
    return ok(reply, { node: await resolveNodeForRoom(ctx.db, id) });
  });
}

async function resolveRoomIdFromCode(db: Parameters<typeof resolveNodeForRoom>[0], code: string): Promise<string> {
  const room = await db.one<{ id: string }>('SELECT id FROM rooms WHERE lower(code) = lower($1)', [code]);
  if (!room) {
    throw new (await import('../lib/errors.js')).ApiError(404, `No room matches the code ${code}.`, { code: 'ROOM_NOT_FOUND' });
  }
  return room.id;
}
