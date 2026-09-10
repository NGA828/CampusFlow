import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parse } from '../lib/validate.js';
import { ok } from '../lib/respond.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { config } from '../config.js';
import { currentPosition, scanQr, updatePosition } from '../services/positioning.js';
import { ctxOf } from '../http/context.js';

const scanSchema = z.object({
  payload: z.string().trim().min(4).max(500).optional(),
  code: z.string().trim().min(2).max(120).optional(),
});

const positionSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy_m: z.number().min(0).max(5000).nullable().optional(),
  source: z.enum(['gps', 'manual', 'simulated']).default('gps'),
  building_id: z.string().uuid().nullable().optional(),
  floor_id: z.string().uuid().nullable().optional(),
  plan_x: z.number().nullable().optional(),
  plan_y: z.number().nullable().optional(),
});

export async function registerPositioningRoutes(app: FastifyInstance): Promise<void> {
  /**
   * QR scan: the payload is validated against the anchor table (existence, active flag,
   * signature and version) before a position is established.
   */
  app.post('/positioning/scan', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    requirePermission(ctx, 'navigation.use');
    const input = parse(scanSchema, request.body ?? {});
    const payload = input.payload ?? input.code;
    if (!payload) {
      return reply.status(422).send({
        success: false,
        message: 'The given data was invalid.',
        errors: { payload: ['Provide the scanned QR payload.'] },
        code: 'VALIDATION_ERROR',
      });
    }

    const result = await scanQr(ctx.db, principal.id, payload);
    return ok(reply, result, `Position established at ${result.qr_node.label}.`);
  });

  /** Explicit position update (GPS outdoors, or a manual "you are here" fix indoors). */
  app.post('/positioning/position', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    requirePermission(ctx, 'navigation.use');
    const input = parse(positionSchema, request.body ?? {});

    if (input.source === 'simulated' && !config.dev.positionSimulator) {
      return reply.status(403).send({
        success: false,
        message: 'The position simulator is disabled in this environment.',
        code: 'SIMULATOR_DISABLED',
      });
    }

    const result = await updatePosition(ctx.db, principal.id, input);
    return ok(reply, result);
  });

  app.get('/positioning/current', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    return ok(reply, { position: await currentPosition(ctx.db, principal.id) });
  });

  /** Anchor metadata for a code typed in manually (no signature required to read a label). */
  app.get('/positioning/anchors/:code', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requireAuth(ctx);
    const { code } = request.params as { code: string };
    const anchor = await ctx.db.one(
      `SELECT q.id, q.code, q.label, q.version, q.is_active, q.plan_x, q.plan_y,
              b.code AS building_code, f.name AS floor_name, f.level AS floor_level,
              r.code AS room_code, r.name AS room_name
         FROM qr_nodes q
         JOIN buildings b ON b.id = q.building_id
         JOIN floors f ON f.id = q.floor_id
         LEFT JOIN rooms r ON r.id = q.room_id
        WHERE upper(q.code) = upper($1)`,
      [code],
    );
    if (!anchor) {
      return reply.status(404).send({ success: false, message: 'No anchor matches that code.', code: 'NOT_FOUND' });
    }
    return ok(reply, { anchor });
  });

  app.get('/positioning/anchors', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    await requireAuth(ctx);
    const anchors = await ctx.db.query(
      `SELECT q.id, q.code, q.label, q.floor_id, q.building_id, q.room_id, q.plan_x, q.plan_y,
              q.is_active, q.scans_count, q.last_scanned_at, b.code AS building_code, f.name AS floor_name
         FROM qr_nodes q
         JOIN buildings b ON b.id = q.building_id
         JOIN floors f ON f.id = q.floor_id
        ORDER BY b.code, f.level, q.code`,
    );
    return ok(reply, { anchors });
  });
}
