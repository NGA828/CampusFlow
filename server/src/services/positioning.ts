import { createHmac } from 'node:crypto';
import type { Db } from '../db/client.js';
import { ApiError } from '../lib/errors.js';
import { emitToUser } from '../realtime/bus.js';
import { reconcileTicketsForPosition } from './queues.js';
import { evaluateRoutePosition, findPath, loadGraph, buildRoute, resolveNearestNode, OFF_ROUTE_GRACE_SECONDS } from './navigation.js';
import { distanceMeters } from '../lib/geo.js';
import { planToLatLng } from './navigation.js';

/**
 * QR-assisted indoor positioning (PROMPT §14, §87).
 *
 * A QR code carries a signed payload: `CF1|<code>|<version>|<signature>`. The signature is
 * derived from a per-node secret that never leaves the server, so a student cannot
 * fabricate a position by editing the QR contents — an unknown, inactive, version-mismatched
 * or incorrectly signed payload is rejected outright.
 */

export const QR_PAYLOAD_VERSION = 'CF1';

export function buildQrPayload(node: { code: string; version: number; secret: string }): string {
  const signature = signPayload(node.code, node.version, node.secret);
  return `${QR_PAYLOAD_VERSION}|${node.code}|${node.version}|${signature}`;
}

export function signPayload(code: string, version: number, secret: string): string {
  return createHmac('sha256', secret).update(`${code}:${version}`).digest('base64url').slice(0, 16);
}

export interface ParsedQr {
  code: string;
  version: number | null;
  signature: string | null;
  legacy: boolean;
}

/** Accepts the signed payload, a JSON envelope, or a bare code printed on a door plate. */
export function parseQrPayload(raw: string): ParsedQr {
  const value = raw.trim();
  if (!value) throw ApiError.validation({ qr: ['A QR payload is required.'] });

  if (value.startsWith('{')) {
    try {
      const parsed = JSON.parse(value) as { code?: string; v?: number; version?: number; sig?: string; signature?: string };
      if (!parsed.code) throw new Error('missing code');
      return {
        code: parsed.code,
        version: parsed.version ?? parsed.v ?? null,
        signature: parsed.signature ?? parsed.sig ?? null,
        legacy: false,
      };
    } catch {
      throw ApiError.validation({ qr: ['The QR payload is not valid JSON.'] });
    }
  }

  if (value.startsWith(`${QR_PAYLOAD_VERSION}|`)) {
    const [, code, version, signature] = value.split('|');
    if (!code) throw ApiError.validation({ qr: ['The QR payload is incomplete.'] });
    return { code, version: version ? Number(version) : null, signature: signature ?? null, legacy: false };
  }

  return { code: value.toUpperCase(), version: null, signature: null, legacy: true };
}

export interface PositionFix {
  lat: number;
  lng: number;
  plan_x: number | null;
  plan_y: number | null;
  building_id: string | null;
  floor_id: string | null;
  qr_node_id: string | null;
  nav_node_id: string | null;
  source: 'qr' | 'gps' | 'manual' | 'simulated';
  accuracy_m: number | null;
  updated_at: string;
  expires_at: string;
  label: string | null;
  floor_name: string | null;
  building_code: string | null;
  room_id: string | null;
  room_code: string | null;
  office_id: string | null;
}

// Room and office context is resolved separately (QR anchors, not navigation nodes,
// reference rooms), which keeps this query portable across spatial backends.
const SIMPLE_POSITION_SELECT = `
  SELECT p.lat, p.lng, p.source, p.accuracy_m, p.updated_at, p.expires_at,
         p.building_id, p.floor_id, p.qr_node_id, p.nav_node_id,
         n.plan_x, n.plan_y, n.label,
         f.name AS floor_name, b.code AS building_code
    FROM user_positions p
    LEFT JOIN navigation_nodes n ON n.id = p.nav_node_id
    LEFT JOIN floors f ON f.id = p.floor_id
    LEFT JOIN buildings b ON b.id = p.building_id
   WHERE p.user_id = $1
`;

export async function currentPosition(db: Db, userId: string): Promise<PositionFix | null> {
  const row = await db.one<Record<string, unknown>>(SIMPLE_POSITION_SELECT, [userId]);
  if (!row) return null;

  const qrNode = row.qr_node_id
    ? await db.one<{ id: string; room_id: string | null; label: string }>(
        'SELECT id, room_id, label FROM qr_nodes WHERE id = $1',
        [String(row.qr_node_id)],
      )
    : null;

  const room = qrNode?.room_id
    ? await db.one<{ id: string; code: string }>('SELECT id, code FROM rooms WHERE id = $1', [qrNode.room_id])
    : null;

  const office =
    room?.id ? await db.one<{ id: string }>('SELECT id FROM administrative_offices WHERE room_id = $1 LIMIT 1', [room.id]) : null;

  const expiresAt = new Date(String(row.expires_at));
  if (expiresAt.getTime() < Date.now()) return null;

  return {
    lat: Number(row.lat),
    lng: Number(row.lng),
    plan_x: row.plan_x === null || row.plan_x === undefined ? null : Number(row.plan_x),
    plan_y: row.plan_y === null || row.plan_y === undefined ? null : Number(row.plan_y),
    building_id: (row.building_id as string) ?? null,
    floor_id: (row.floor_id as string) ?? null,
    qr_node_id: (row.qr_node_id as string) ?? null,
    nav_node_id: (row.nav_node_id as string) ?? null,
    source: (row.source as PositionFix['source']) ?? 'manual',
    accuracy_m: row.accuracy_m === null || row.accuracy_m === undefined ? null : Number(row.accuracy_m),
    updated_at: new Date(String(row.updated_at)).toISOString(),
    expires_at: expiresAt.toISOString(),
    label: (row.label as string) ?? qrNode?.label ?? null,
    floor_name: (row.floor_name as string) ?? null,
    building_code: (row.building_code as string) ?? null,
    room_id: room?.id ?? null,
    room_code: room?.code ?? null,
    office_id: office?.id ?? null,
  };
}

export interface ScanResult {
  position: PositionFix;
  qr_node: {
    id: string;
    code: string;
    label: string;
    version: number;
    scans_count: number;
    building_code: string;
    building_name: string;
    floor_name: string;
    floor_level: number;
    plan_x: number;
    plan_y: number;
    room_id: string | null;
    room_code: string | null;
    room_name: string | null;
    office_id: string | null;
    office_name: string | null;
  };
  promoted_tickets: string[];
}

export async function scanQr(
  db: Db,
  userId: string,
  payload: string,
  options: { allowLegacy?: boolean } = {},
): Promise<ScanResult> {
  const parsed = parseQrPayload(payload);
  const node = await db.one<{
    id: string;
    code: string;
    label: string;
    version: number;
    secret: string;
    is_active: boolean;
    scans_count: number;
    building_id: string;
    floor_id: string;
    room_id: string | null;
    nav_node_id: string | null;
    plan_x: number;
    plan_y: number;
    lat: number | null;
    lng: number | null;
    building_code: string;
    building_name: string;
    floor_name: string;
    floor_level: number;
    room_code: string | null;
    room_name: string | null;
    office_id: string | null;
    office_name: string | null;
  }>(
    `SELECT q.*, b.code AS building_code, b.name AS building_name, f.name AS floor_name, f.level AS floor_level,
            r.code AS room_code, r.name AS room_name, o.id AS office_id, o.name AS office_name
       FROM qr_nodes q
       JOIN buildings b ON b.id = q.building_id
       JOIN floors f ON f.id = q.floor_id
       LEFT JOIN rooms r ON r.id = q.room_id
       LEFT JOIN administrative_offices o ON o.room_id = q.room_id
      WHERE upper(q.code) = upper($1)`,
    [parsed.code],
  );

  if (!node) throw new ApiError(422, 'This QR code is not recognised on campus.', { code: 'QR_UNKNOWN' });
  if (!node.is_active) throw new ApiError(422, 'This QR anchor has been deactivated. Use a nearby anchor.', { code: 'QR_INACTIVE' });

  const signedPayload = parsed.signature !== null;
  if (signedPayload) {
    const expected = signPayload(node.code, node.version, node.secret);
    if (expected !== parsed.signature) {
      throw new ApiError(422, 'This QR code failed its integrity check. It may have been altered.', { code: 'QR_SIGNATURE_INVALID' });
    }
    if (parsed.version !== null && Number(parsed.version) !== Number(node.version)) {
      throw new ApiError(422, 'This QR code is out of date. Ask an administrator to reprint the anchor.', { code: 'QR_VERSION_MISMATCH' });
    }
  } else if (!options.allowLegacy && Number(node.version) > 1) {
    throw new ApiError(422, 'This QR anchor requires a signed code. Rescan using the current code.', { code: 'QR_UNSIGNED' });
  }

  // Geographic coordinates: stored on the anchor, otherwise derived from the plan.
  let lat = node.lat === null ? null : Number(node.lat);
  let lng = node.lng === null ? null : Number(node.lng);
  if (lat === null || lng === null) {
    const building = await db.one<{ lat: number; lng: number }>('SELECT lat, lng FROM buildings WHERE id = $1', [node.building_id]);
    if (building) {
      const reference = { lat: Number(building.lat), lng: Number(building.lng) };
      const point = planToLatLng(reference, { x: Number(node.plan_x), y: Number(node.plan_y) });
      lat = point.lat;
      lng = point.lng;
    }
  }
  if (lat === null || lng === null) {
    throw ApiError.unavailable('This anchor has no usable coordinates configured.');
  }

  const navNode = node.nav_node_id
    ? { id: node.nav_node_id }
    : (await db.one<{ id: string }>(
        `SELECT id FROM navigation_nodes
          WHERE floor_id = $1 AND is_active
          ORDER BY ((plan_x - $2) * (plan_x - $2) + (plan_y - $3) * (plan_y - $3)) LIMIT 1`,
        [node.floor_id, Number(node.plan_x), Number(node.plan_y)],
      )) ?? null;

  await db.query(
    `INSERT INTO user_positions (user_id, lat, lng, accuracy_m, source, qr_node_id, nav_node_id, building_id, floor_id, updated_at, expires_at)
     VALUES ($1, $2, $3, 5, 'qr', $4, $5, $6, $7, now(), now() + interval '30 minutes')
     ON CONFLICT (user_id) DO UPDATE
        SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, accuracy_m = EXCLUDED.accuracy_m, source = 'qr',
            qr_node_id = EXCLUDED.qr_node_id, nav_node_id = EXCLUDED.nav_node_id,
            building_id = EXCLUDED.building_id, floor_id = EXCLUDED.floor_id,
            updated_at = now(), expires_at = now() + interval '30 minutes'`,
    [userId, lat, lng, node.id, navNode?.id ?? null, node.building_id, node.floor_id],
  );

  await db.query('UPDATE qr_nodes SET scans_count = scans_count + 1, last_scanned_at = now() WHERE id = $1', [node.id]);

  const position = await currentPosition(db, userId);
  const promoted = await reconcileTicketsForPosition(db, userId, {
    lat: position?.lat ?? lat,
    lng: position?.lng ?? lng,
    plan_x: Number(node.plan_x),
    plan_y: Number(node.plan_y),
    floor_id: node.floor_id,
    building_id: node.building_id,
  });

  emitToUser(userId, 'position.updated', {
    position: {
      lat: position?.lat ?? lat,
      lng: position?.lng ?? lng,
      plan_x: Number(node.plan_x),
      plan_y: Number(node.plan_y),
      floor_id: node.floor_id,
      building_code: node.building_code,
      floor_name: node.floor_name,
      label: node.label,
      source: 'qr',
    },
  });

  const result: ScanResult = {
    position: position ?? {
      lat,
      lng,
      plan_x: Number(node.plan_x),
      plan_y: Number(node.plan_y),
      building_id: node.building_id,
      floor_id: node.floor_id,
      qr_node_id: node.id,
      nav_node_id: navNode?.id ?? null,
      source: 'qr',
      accuracy_m: 5,
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      label: node.label,
      floor_name: node.floor_name,
      building_code: node.building_code,
      room_id: node.room_id,
      room_code: node.room_code,
      office_id: node.office_id,
    },
    qr_node: {
      id: node.id,
      code: node.code,
      label: node.label,
      version: Number(node.version),
      scans_count: Number(node.scans_count) + 1,
      building_code: node.building_code,
      building_name: node.building_name,
      floor_name: node.floor_name,
      floor_level: Number(node.floor_level),
      plan_x: Number(node.plan_x),
      plan_y: Number(node.plan_y),
      room_id: node.room_id,
      room_code: node.room_code,
      room_name: node.room_name,
      office_id: node.office_id,
      office_name: node.office_name,
    },
    promoted_tickets: promoted.promoted,
  };

  return result;
}

export interface UpdatePositionOptions {
  lat: number;
  lng: number;
  accuracy_m?: number | null;
  source?: 'gps' | 'manual' | 'simulated';
  building_id?: string | null;
  floor_id?: string | null;
  plan_x?: number | null;
  plan_y?: number | null;
}

export interface PositionUpdateResult {
  position: PositionFix | null;
  navigation: {
    session_id: string;
    off_route: boolean;
    distance_from_route_m: number;
    tolerance_m: number;
    progress: number;
    remaining_m: number;
    current_step_index: number;
    instruction: string | null;
    arrived: boolean;
    recalculated: boolean;
    grace_seconds_remaining: number | null;
  } | null;
  promoted_tickets: string[];
}

/**
 * Live position update. Also drives navigation progress, off-route detection with a grace
 * period, and automatic recalculation — the walk is never cancelled automatically.
 */
export async function updatePosition(
  db: Db,
  userId: string,
  options: UpdatePositionOptions,
): Promise<PositionUpdateResult> {
  if (!Number.isFinite(options.lat) || !Number.isFinite(options.lng)) {
    throw ApiError.validation({ lat: ['A valid latitude is required.'], lng: ['A valid longitude is required.'] });
  }

  const session = await db.one<{
    id: string;
    route: unknown;
    status: string;
    off_route_events: number;
    recalculations: number;
    destination_node_id: string | null;
    destination_room_id: string | null;
    requires_accessible: boolean;
    destination_label: string;
    last_position: unknown;
    last_position_at: string | null;
  }>(
    `SELECT id, route, status, off_route_events, recalculations, destination_node_id, destination_room_id,
            requires_accessible, destination_label, last_position, last_position_at
       FROM navigation_sessions WHERE user_id = $1 AND status = 'active' ORDER BY started_at DESC LIMIT 1`,
    [userId],
  );

  const resolvedFloor = options.floor_id ?? null;
  const navNode = resolvedFloor
    ? null
    : await db
        .one<{ id: string }>(
          `SELECT id FROM navigation_nodes WHERE is_active AND lat IS NOT NULL
            ORDER BY ((lat - $1) * (lat - $1) + (lng - $2) * (lng - $2)) LIMIT 1`,
          [options.lat, options.lng],
        )
        .catch(() => null);

  const floorForPosition =
    resolvedFloor ??
    (navNode
      ? (
          await db.one<{ floor_id: string | null; building_id: string | null }>(
            'SELECT floor_id, building_id FROM navigation_nodes WHERE id = $1',
            [navNode.id],
          )
        )?.floor_id ?? null
      : null);

  const buildingForPosition =
    options.building_id ??
    (floorForPosition
      ? (await db.one<{ building_id: string }>('SELECT building_id FROM floors WHERE id = $1', [floorForPosition]))?.building_id ?? null
      : null);

  await db.query(
    `INSERT INTO user_positions (user_id, lat, lng, accuracy_m, source, nav_node_id, building_id, floor_id, updated_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now() + interval '10 minutes')
     ON CONFLICT (user_id) DO UPDATE
        SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, accuracy_m = EXCLUDED.accuracy_m, source = EXCLUDED.source,
            nav_node_id = EXCLUDED.nav_node_id, building_id = EXCLUDED.building_id, floor_id = EXCLUDED.floor_id,
            qr_node_id = NULL, updated_at = now(), expires_at = now() + interval '10 minutes'`,
    [
      userId,
      options.lat,
      options.lng,
      options.accuracy_m ?? null,
      options.source ?? 'gps',
      navNode?.id ?? null,
      buildingForPosition,
      floorForPosition,
    ],
  );

  const promoted = await reconcileTicketsForPosition(db, userId, {
    lat: options.lat,
    lng: options.lng,
    plan_x: options.plan_x ?? null,
    plan_y: options.plan_y ?? null,
    floor_id: floorForPosition,
    building_id: buildingForPosition,
  });

  let navigation: PositionUpdateResult['navigation'] = null;

  if (session) {
    const route = session.route as import('./navigation.js').Route;
    const evaluation = evaluateRoutePosition(route, {
      lat: options.lat,
      lng: options.lng,
      plan_x: options.plan_x ?? null,
      plan_y: options.plan_y ?? null,
      floor_id: floorForPosition,
    });

    let recalculated = false;
    let graceRemaining: number | null = null;

    if (evaluation.off_route) {
      const deviation = await db.one<{ id: string; first_detected_at: string; detections: number; status: string; max_distance_m: number }>(
        `SELECT id, first_detected_at, detections, status, max_distance_m
           FROM navigation_deviations WHERE session_id = $1 AND resolved_at IS NULL
          ORDER BY first_detected_at DESC LIMIT 1`,
        [session.id],
      );

      if (!deviation) {
        const created = await db.one<{ id: string }>(
          `INSERT INTO navigation_deviations (session_id, detections, max_distance_m, status)
           VALUES ($1, 1, $2, 'grace') RETURNING id`,
          [session.id, evaluation.distance_from_route_m],
        );
        await db.query(
          `INSERT INTO navigation_events (session_id, type, payload) VALUES ($1, 'off_route', $2)`,
          [session.id, JSON.stringify({ distance_m: evaluation.distance_from_route_m, tolerance_m: evaluation.tolerance_m })],
        );
        emitToUser(userId, 'navigation.off_route', {
          session_id: session.id,
          distance_m: evaluation.distance_from_route_m,
          tolerance_m: evaluation.tolerance_m,
          grace_seconds: OFF_ROUTE_GRACE_SECONDS,
          message: 'You seem to have left the route. Continue for a moment and we will guide you back.',
        });
        graceRemaining = OFF_ROUTE_GRACE_SECONDS;
        void created;
      } else {
        const elapsedSeconds = (Date.now() - new Date(deviation.first_detected_at).getTime()) / 1000;
        const detections = Number(deviation.detections) + 1;
        await db.query(
          `UPDATE navigation_deviations SET detections = $1, last_detected_at = now(),
                  max_distance_m = greatest(max_distance_m, $2) WHERE id = $3`,
          [detections, evaluation.distance_from_route_m, deviation.id],
        );

        if (elapsedSeconds >= OFF_ROUTE_GRACE_SECONDS || detections >= 3) {
          // Grace period elapsed: recalculate from the nearest node, keeping the same
          // destination and accessibility preference.
          const graph = await loadGraph(db);
          const nearest = await resolveNearestNode(db, {
            lat: options.lat,
            lng: options.lng,
            plan_x: options.plan_x ?? null,
            plan_y: options.plan_y ?? null,
            floor_id: floorForPosition,
          }).catch(() => null);

          if (nearest && session.destination_node_id) {
            const path = findPath(graph, nearest.id, session.destination_node_id, {
              accessibleOnly: session.requires_accessible,
            });
            if (path) {
              const rebuilt = await buildRoute(db, path, graph, {
                accessibleOnly: session.requires_accessible,
                destinationLabel: session.destination_label,
              });
              await db.query(
                `UPDATE navigation_sessions
                    SET route = $2, distance_m = $3, duration_seconds = $4, recalculations = recalculations + 1,
                        current_step_index = 0, last_position = $5, last_position_at = now(), updated_at = now()
                  WHERE id = $1`,
                [session.id, JSON.stringify(rebuilt), rebuilt.distance_m, rebuilt.duration_seconds, JSON.stringify({ lat: options.lat, lng: options.lng })],
              );
              await db.query(`UPDATE navigation_deviations SET resolved_at = now(), resolution = 'recalculated', status = 'resolved' WHERE id = $1`, [deviation.id]);
              await db.query(
                `INSERT INTO navigation_events (session_id, type, payload) VALUES ($1, 'recalculated', $2)`,
                [session.id, JSON.stringify({ distance_m: rebuilt.distance_m, steps: rebuilt.steps.length })],
              );
              await notifyRecalculated(db, userId, rebuilt.distance_m);
              emitToUser(userId, 'navigation.recalculated', {
                session_id: session.id,
                distance_m: rebuilt.distance_m,
                duration_seconds: rebuilt.duration_seconds,
                steps: rebuilt.steps,
              });
              recalculated = true;
            }
          } else if (nearest) {
            await db.query(`UPDATE navigation_deviations SET status = 'escalated' WHERE id = $1`, [deviation.id]);
          }
        } else {
          graceRemaining = Math.max(0, Math.round(OFF_ROUTE_GRACE_SECONDS - elapsedSeconds));
          emitToUser(userId, 'navigation.off_route', {
            session_id: session.id,
            distance_m: evaluation.distance_from_route_m,
            tolerance_m: evaluation.tolerance_m,
            grace_seconds: graceRemaining,
            message: 'Still off route. We will recalculate in a moment.',
          });
        }
      }
    } else {
      const open = await db.one<{ id: string }>(
        `SELECT id FROM navigation_deviations WHERE session_id = $1 AND resolved_at IS NULL LIMIT 1`,
        [session.id],
      );
      if (open) {
        await db.query(
          `UPDATE navigation_deviations SET resolved_at = now(), resolution = 'back_on_route', status = 'resolved' WHERE id = $1`,
          [open.id],
        );
        emitToUser(userId, 'navigation.back_on_route', { session_id: session.id });
      }
    }

    if (evaluation.arrived && !recalculated) {
      await db.query(
        `UPDATE navigation_sessions SET status = 'arrived', ended_at = now(), updated_at = now() WHERE id = $1`,
        [session.id],
      );
      await db.query(`INSERT INTO navigation_events (session_id, type, payload) VALUES ($1, 'arrived', '{}'::jsonb)`, [session.id]);
      emitToUser(userId, 'navigation.arrived', { session_id: session.id, destination: session.destination_label });
    } else if (!recalculated) {
      await db.query(
        `UPDATE navigation_sessions SET current_step_index = $2, off_route_events = off_route_events + $3,
                last_position = $4, last_position_at = now(), updated_at = now() WHERE id = $1`,
        [
          session.id,
          evaluation.current_step_index,
          evaluation.off_route ? 1 : 0,
          JSON.stringify({ lat: options.lat, lng: options.lng }),
        ],
      );
    }

    navigation = {
      session_id: session.id,
      off_route: evaluation.off_route,
      distance_from_route_m: evaluation.distance_from_route_m,
      tolerance_m: evaluation.tolerance_m,
      progress: evaluation.progress,
      remaining_m: evaluation.remaining_m,
      current_step_index: evaluation.current_step_index,
      instruction: evaluation.current_step?.instruction ?? null,
      arrived: evaluation.arrived,
      recalculated,
      grace_seconds_remaining: graceRemaining,
    };
  }

  return { position: await currentPosition(db, userId), navigation, promoted_tickets: promoted.promoted };
}

async function notifyRecalculated(db: Db, userId: string, distance: number): Promise<void> {
  const { notify } = await import('./notifications.js');
  await notify(db, {
    userId,
    type: 'navigation.recalculated',
    title: 'Route recalculated',
    body: `We updated your route. ${Math.round(distance)} m to your destination.`,
    data: { dedupe_key: undefined },
  });
}

/** Distance between two position fixes, used by the mobile client for update throttling. */
export function fixDistance(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  return distanceMeters(a, b);
}
