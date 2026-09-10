import type { Db } from '../db/client.js';
import { ApiError } from '../lib/errors.js';
import { emitToAdmins, emitToQueue, emitToStaff, emitToUser } from '../realtime/bus.js';
import { notify } from './notifications.js';
import { campusParts, toMinutes } from '../lib/clock.js';
import { distanceMeters } from '../lib/geo.js';

/**
 * Controlled room admission queues (PROMPT §19–§23).
 *
 * Every state transition below runs inside a transaction that starts by locking the queue
 * row (`SELECT ... FOR UPDATE`). Positions are allocated by the database, never by the
 * client, and two partial unique indexes make duplicate positions and duplicate active
 * tickets structurally impossible.
 */

export const LINE_STATUSES = ['QUEUE_PENDING', 'WAITING', 'CALLED', 'NAVIGATING', 'APPROACHING', 'CHECK_IN_WINDOW'] as const;
export const OCCUPYING_STATUSES = ['CALLED', 'NAVIGATING', 'APPROACHING', 'CHECK_IN_WINDOW', 'CHECKED_IN', 'ADMITTED'] as const;
export const ACTIVE_STATUSES = [...LINE_STATUSES, 'CHECKED_IN', 'ADMITTED'] as const;
export const CANCELLABLE_STATUSES = ['QUEUE_PENDING', 'WAITING', 'CALLED', 'NAVIGATING', 'APPROACHING', 'CHECK_IN_WINDOW'] as const;

export interface QueueRow {
  id: string;
  room_id: string;
  is_active: boolean;
  max_size: number;
  waitlist_limit: number;
  admission_capacity: number;
  avg_service_seconds: number;
  proximity_radius_m: number;
  requires_proximity_to_join: boolean;
  check_in_window_seconds: number;
  grace_period_seconds: number;
  max_active_tickets_per_student: number;
  opens_at: string | null;
  closes_at: string | null;
  notes: string | null;
  room_code: string;
  room_name: string;
  room_capacity: number;
  requires_admission: boolean;
  building_id: string;
  building_code: string;
  building_name: string;
  floor_id: string;
  floor_name: string;
  floor_level: number;
  room_lat: number | null;
  room_lng: number | null;
  room_plan_x: number;
  room_plan_y: number;
}

export interface TicketRow {
  id: string;
  queue_id: string;
  room_id: string;
  student_id: string;
  ticket_number: string;
  sequence_no: number;
  position: number;
  status: string;
  priority: number;
  eta_seconds: number | null;
  issued_at: string;
  called_at: string | null;
  check_in_deadline: string | null;
  checked_in_at: string | null;
  admitted_at: string | null;
  no_show_at: string | null;
  cancelled_at: string | null;
  expired_at: string | null;
  completed_at: string | null;
  join_distance_m: number | null;
  student_name?: string;
  student_email?: string;
  student_registration_no?: string | null;
}

const QUEUE_SELECT = `
  SELECT q.*, r.code AS room_code, r.name AS room_name, r.capacity AS room_capacity,
         r.requires_admission, r.building_id, r.floor_id,
         r.lat AS room_lat, r.lng AS room_lng, r.plan_x AS room_plan_x, r.plan_y AS room_plan_y,
         b.code AS building_code, b.name AS building_name,
         f.name AS floor_name, f.level AS floor_level
    FROM room_queues q
    JOIN rooms r ON r.id = q.room_id
    JOIN buildings b ON b.id = r.building_id
    JOIN floors f ON f.id = r.floor_id
`;

const inList = (values: readonly string[]) => values.map((value) => `'${value}'`).join(', ');

export async function getQueue(db: Db, queueIdOrRoomId: string): Promise<QueueRow> {
  const queue = await db.one<QueueRow>(
    `${QUEUE_SELECT} WHERE q.id::text = $1 OR q.room_id::text = $1`,
    [queueIdOrRoomId],
  );
  if (!queue) throw ApiError.notFound('This room does not have an admission queue configured.');
  return queue;
}

async function lockQueue(db: Db, queueId: string): Promise<QueueRow> {
  const locked = await db.one<{ id: string }>('SELECT id FROM room_queues WHERE id = $1 FOR UPDATE', [queueId]);
  if (!locked) throw ApiError.notFound('Queue not found.');
  return getQueue(db, queueId);
}

export interface QueueCounts {
  waiting: number;
  line: number;
  occupying: number;
  checked_in: number;
  admitted: number;
}

export async function queueCounts(db: Db, queueId: string): Promise<QueueCounts> {
  const row = await db.one<Record<string, string>>(
    `SELECT
        count(*) FILTER (WHERE status IN ('QUEUE_PENDING', 'WAITING'))::text AS waiting,
        count(*) FILTER (WHERE status IN (${inList(LINE_STATUSES)}))::text AS line,
        count(*) FILTER (WHERE status IN (${inList(OCCUPYING_STATUSES)}))::text AS occupying,
        count(*) FILTER (WHERE status = 'CHECKED_IN')::text AS checked_in,
        count(*) FILTER (WHERE status = 'ADMITTED')::text AS admitted
       FROM queue_tickets WHERE queue_id = $1`,
    [queueId],
  );
  return {
    waiting: Number(row?.waiting ?? 0),
    line: Number(row?.line ?? 0),
    occupying: Number(row?.occupying ?? 0),
    checked_in: Number(row?.checked_in ?? 0),
    admitted: Number(row?.admitted ?? 0),
  };
}

/** Historical mean service duration, used to improve the deterministic wait estimate. */
export async function averageServiceSeconds(db: Db, queueId: string, fallback: number): Promise<number> {
  const row = await db.one<{ avg_seconds: string | null; samples: string }>(
    `SELECT avg(extract(epoch FROM (completed_at - checked_in_at)))::text AS avg_seconds,
            count(*)::text AS samples
       FROM queue_tickets
      WHERE queue_id = $1 AND status = 'COMPLETED'
        AND checked_in_at IS NOT NULL AND completed_at IS NOT NULL
        AND completed_at > now() - interval '30 days'`,
    [queueId],
  );
  const samples = Number(row?.samples ?? 0);
  if (samples < 5 || !row?.avg_seconds) return fallback;
  const average = Number(row.avg_seconds);
  // Blend observed behaviour with the configured default so a single odd day cannot
  // distort the estimate.
  return Math.round((average * 0.7 + fallback * 0.3) / 5) * 5;
}

export async function isQueueOpen(queue: QueueRow): Promise<{ open: boolean; reason?: string }> {
  if (!queue.is_active) return { open: false, reason: 'This queue is currently closed.' };
  const now = campusParts();
  if (queue.opens_at && queue.closes_at) {
    const minutes = now.minutes;
    if (minutes < toMinutes(queue.opens_at) || minutes >= toMinutes(queue.closes_at)) {
      return { open: false, reason: `The queue accepts requests between ${queue.opens_at.slice(0, 5)} and ${queue.closes_at.slice(0, 5)}.` };
    }
  }
  return { open: true };
}

/* ------------------------------------------------------------------ proximity */

export interface ProximityVerdict {
  verified: boolean;
  distance_m: number | null;
  radius_m: number;
  source: string | null;
  reason?: string;
}

/**
 * Proximity check used for both joining and check-in. The distance is computed with
 * `cf_distance_m` inside PostgreSQL when a geographic fix is available; indoor QR fixes
 * are compared in floor-plan space because that is the authoritative indoor geometry.
 */
export async function checkProximity(
  db: Db,
  params: {
    userId: string;
    room: { lat: number | null; lng: number | null; plan_x: number; plan_y: number; floor_id: string; id: string };
    radiusM: number;
    fix?: { lat?: number | null; lng?: number | null; plan_x?: number | null; plan_y?: number | null; floor_id?: string | null; qr_node_id?: string | null; source?: string };
    qrCode?: string;
  },
): Promise<ProximityVerdict> {
  let fix = params.fix ?? null;

  if (!fix && params.qrCode) {
    const node = await db.one<{ id: string; lat: number | null; lng: number | null; plan_x: number; plan_y: number; floor_id: string; room_id: string | null }>(
      'SELECT id, lat, lng, plan_x, plan_y, floor_id, room_id FROM qr_nodes WHERE upper(code) = upper($1) AND is_active',
      [params.qrCode],
    );
    if (!node) {
      return { verified: false, distance_m: null, radius_m: params.radiusM, source: null, reason: 'Unknown or inactive QR anchor.' };
    }
    fix = {
      lat: node.lat,
      lng: node.lng,
      plan_x: Number(node.plan_x),
      plan_y: Number(node.plan_y),
      floor_id: node.floor_id,
      qr_node_id: node.id,
      source: 'qr',
    };
  }

  if (!fix) {
    const stored = await db.one<{
      lat: number;
      lng: number;
      plan_x: number | null;
      plan_y: number | null;
      floor_id: string | null;
      qr_node_id: string | null;
      source: string;
      age_seconds: string;
    }>(
      `SELECT p.lat, p.lng, p.floor_id, p.qr_node_id, p.source,
              CASE WHEN n.plan_x IS NOT NULL THEN n.plan_x ELSE NULL END AS plan_x,
              CASE WHEN n.plan_y IS NOT NULL THEN n.plan_y ELSE NULL END AS plan_y,
              extract(epoch FROM (now() - p.updated_at))::text AS age_seconds
         FROM user_positions p
         LEFT JOIN navigation_nodes n ON n.id = p.nav_node_id
        WHERE p.user_id = $1 AND p.expires_at > now()`,
      [params.userId],
    );
    if (!stored) {
      return {
        verified: false,
        distance_m: null,
        radius_m: params.radiusM,
        source: null,
        reason: 'No recent position fix. Scan the QR anchor at the location to confirm where you are.',
      };
    }
    fix = {
      lat: Number(stored.lat),
      lng: Number(stored.lng),
      plan_x: stored.plan_x === null ? null : Number(stored.plan_x),
      plan_y: stored.plan_y === null ? null : Number(stored.plan_y),
      floor_id: stored.floor_id,
      qr_node_id: stored.qr_node_id,
      source: stored.source,
    };
  }

  // Indoor comparison in plan space when the fix belongs to the room's floor.
  if (fix.plan_x != null && fix.plan_y != null && fix.floor_id === params.room.floor_id) {
    const distance = Math.hypot(Number(fix.plan_x) - Number(params.room.plan_x), Number(fix.plan_y) - Number(params.room.plan_y));
    return {
      verified: distance <= params.radiusM,
      distance_m: Math.round(distance * 10) / 10,
      radius_m: params.radiusM,
      source: fix.source ?? 'position',
      reason: distance <= params.radiusM ? undefined : 'You are too far from the room to continue.',
    };
  }

  if (fix.lat != null && fix.lng != null && params.room.lat != null && params.room.lng != null) {
    const row = await db.one<{ distance: string }>(
      'SELECT cf_distance_m($1::float8, $2::float8, $3::float8, $4::float8)::text AS distance',
      [Number(fix.lat), Number(fix.lng), Number(params.room.lat), Number(params.room.lng)],
    );
    const distance = Number(row?.distance ?? Number.POSITIVE_INFINITY);
    return {
      verified: distance <= params.radiusM,
      distance_m: Math.round(distance * 10) / 10,
      radius_m: params.radiusM,
      source: fix.source ?? 'position',
      reason: distance <= params.radiusM ? undefined : 'You are too far from the room to continue.',
    };
  }

  if (fix.lat != null && fix.lng != null && params.room.lat == null) {
    // Indoor room without own coordinates: fall back to the building-level geofence.
    const building = await db.one<{ lat: number; lng: number; code: string }>(
      `SELECT b.lat, b.lng, b.code FROM rooms r JOIN buildings b ON b.id = r.building_id WHERE r.id = $1`,
      [params.room.id],
    );
    if (building) {
      const distance = distanceMeters(
        { lat: Number(fix.lat), lng: Number(fix.lng) },
        { lat: Number(building.lat), lng: Number(building.lng) },
      );
      return {
        verified: distance <= 150,
        distance_m: Math.round(distance * 10) / 10,
        radius_m: 150,
        source: fix.source ?? 'position',
        reason: distance <= 150 ? undefined : `You are not in ${building.code} yet.`,
      };
    }
  }

  return {
    verified: false,
    distance_m: null,
    radius_m: params.radiusM,
    source: fix.source ?? null,
    reason: 'Your position could not be verified for this location.',
  };
}

/* --------------------------------------------------------------------- numbering */

async function allocateSequence(db: Db, queueId: string, dateISO: string): Promise<number> {
  const row = await db.one<{ counter: number }>(
    `INSERT INTO queue_counters (queue_id, issued_date, counter)
     VALUES ($1, $2::date, 1)
     ON CONFLICT (queue_id) DO UPDATE
        SET counter = CASE WHEN queue_counters.issued_date = $2::date THEN queue_counters.counter + 1 ELSE 1 END,
            issued_date = $2::date,
            updated_at = now()
     RETURNING counter`,
    [queueId, dateISO],
  );
  return Number(row?.counter ?? 1);
}

async function nextLinePosition(db: Db, queueId: string): Promise<number> {
  const row = await db.one<{ next: string }>(
    `SELECT (coalesce(max(position), 0) + 1)::text AS next
       FROM queue_tickets
      WHERE queue_id = $1 AND status IN (${inList(LINE_STATUSES)})`,
    [queueId],
  );
  return Number(row?.next ?? 1);
}

/**
 * Compact the line so positions stay contiguous. Moves happen in two phases to avoid
 * transient collisions with the unique position index.
 */
export async function renumberLine(db: Db, queueId: string): Promise<Map<string, number>> {
  const rows = await db.query<{ id: string }>(
    `SELECT id FROM queue_tickets
      WHERE queue_id = $1 AND status IN (${inList(LINE_STATUSES)})
      ORDER BY priority DESC, issued_at ASC, sequence_no ASC`,
    [queueId],
  );
  const mapping = new Map<string, number>();
  rows.forEach((row, index) => mapping.set(row.id, index + 1));
  if (mapping.size === 0) return mapping;

  await db.query(
    `UPDATE queue_tickets SET position = position + 10000, updated_at = now()
      WHERE queue_id = $1 AND status IN (${inList(LINE_STATUSES)})`,
    [queueId],
  );
  for (const [ticketId, position] of mapping) {
    await db.query('UPDATE queue_tickets SET position = $1, updated_at = now() WHERE id = $2', [position, ticketId]);
  }
  return mapping;
}

export interface JoinOptions {
  roomId?: string;
  queueId?: string;
  qrCode?: string;
  fix?: { lat?: number | null; lng?: number | null; plan_x?: number | null; plan_y?: number | null; floor_id?: string | null; source?: string };
}

export interface JoinResult {
  ticket: TicketRow;
  queue: QueueRow;
  counts: QueueCounts;
  proximity: ProximityVerdict | null;
}

export async function joinQueue(db: Db, userId: string, options: JoinOptions): Promise<JoinResult> {
  return db.tx(async (tx) => {
    const queue = await getQueue(tx, options.queueId ?? options.roomId!);
    await lockQueue(tx, queue.id);

    const open = await isQueueOpen(queue);
    if (!open.open) throw ApiError.conflict(open.reason ?? 'The queue is closed.', 'QUEUE_CLOSED');

    const existing = await tx.one<TicketRow>(
      `SELECT * FROM queue_tickets
        WHERE queue_id = $1 AND student_id = $2 AND status IN (${inList(ACTIVE_STATUSES)})`,
      [queue.id, userId],
    );
    if (existing) {
      throw new ApiError(409, 'You already hold an active ticket for this room.', {
        code: 'ALREADY_IN_QUEUE',
      });
    }

    // Ghost-ticket protection: a student may only hold a limited number of live tickets.
    const activeCount = await tx.one<{ count: string }>(
      `SELECT count(*)::text AS count FROM queue_tickets
        WHERE student_id = $1 AND status IN (${inList(ACTIVE_STATUSES)})`,
      [userId],
    );
    if (Number(activeCount?.count ?? 0) >= queue.max_active_tickets_per_student) {
      throw new ApiError(409,
        `You already hold ${activeCount?.count} active room tickets. Cancel one before joining another queue.`,
        { code: 'TOO_MANY_ACTIVE_TICKETS' },
      );
    }

    const counts = await queueCounts(tx, queue.id);
    if (counts.line + counts.occupying >= queue.max_size) {
      throw new ApiError(409, 'This queue is full. Try again later or choose another room.', { code: 'QUEUE_FULL' });
    }

    let proximity: ProximityVerdict | null = null;
    if (queue.requires_proximity_to_join) {
      proximity = await checkProximity(tx, {
        userId,
        room: {
          id: queue.room_id,
          lat: queue.room_lat === null ? null : Number(queue.room_lat),
          lng: queue.room_lng === null ? null : Number(queue.room_lng),
          plan_x: Number(queue.room_plan_x),
          plan_y: Number(queue.room_plan_y),
          floor_id: queue.floor_id,
        },
        radiusM: Number(queue.proximity_radius_m),
        fix: options.fix,
        qrCode: options.qrCode,
      });
      if (!proximity.verified) {
        throw new ApiError(422, proximity.reason ?? 'You must be near the room to join this queue.', {
          code: 'PROXIMITY_REQUIRED',
        });
      }
    }

    const now = campusParts();
    const sequence = await allocateSequence(tx, queue.id, now.date);
    const position = await nextLinePosition(tx, queue.id);
    const average = await averageServiceSeconds(tx, queue.id, Number(queue.avg_service_seconds));
    const peopleAhead = counts.waiting;
    const etaSeconds = Math.ceil(peopleAhead / Number(queue.admission_capacity)) * average;

    const ticketNumber = `${queue.room_code}-${String(sequence).padStart(3, '0')}`;
    const ticket = await tx.one<TicketRow>(
      `INSERT INTO queue_tickets
         (queue_id, room_id, student_id, ticket_number, sequence_no, position, status, eta_seconds,
          join_distance_m, join_source)
       VALUES ($1, $2, $3, $4, $5, $6, 'WAITING', $7, $8, $9)
       RETURNING *`,
      [
        queue.id,
        queue.room_id,
        userId,
        ticketNumber,
        sequence,
        position,
        etaSeconds,
        proximity?.distance_m ?? null,
        proximity?.source ?? null,
      ],
    );

    await tx.query(
      `INSERT INTO queue_events (queue_id, ticket_id, type, actor_id, metadata)
       VALUES ($1, $2, 'ticket.issued', $3, $4)`,
      [queue.id, ticket!.id, userId, JSON.stringify({ position, ticket_number: ticketNumber, proximity: proximity ?? null })],
    );

    const after = await queueCounts(tx, queue.id);

    await notify(tx, {
      userId,
      type: 'queue.ticket_issued',
      title: `Ticket ${ticketNumber} confirmed`,
      body: `You are number ${position} in the queue for ${queue.room_name} (${queue.room_code}). Estimated wait ${Math.ceil(etaSeconds / 60)} minutes.`,
      data: { ticket_id: ticket!.id, room_id: queue.room_id, queue_id: queue.id, position },
      priority: 'normal',
    });

    emitToQueue(queue.id, 'queue.ticket_issued', {
      ticket_number: ticketNumber,
      position,
      waiting: after.waiting,
    });
    emitToUser(userId, 'queue.position_updated', {
      ticket_id: ticket!.id,
      position,
      people_ahead: Math.max(0, position - 1),
      waiting: after.waiting,
      eta_seconds: etaSeconds,
    });
    emitToStaff('queue.changed', { queue_id: queue.id, room_code: queue.room_code, counts: after });

    return { ticket: ticket!, queue, counts: after, proximity };
  });
}

export async function activeTicketForStudent(db: Db, studentId: string): Promise<(TicketRow & { queue: QueueRow }) | null> {
  const row = await db.one<TicketRow & { queue: QueueRow }>(
    `SELECT t.*, row_to_json(q)::jsonb || jsonb_build_object(
              'room_code', r.code, 'room_name', r.name, 'room_capacity', r.capacity,
              'building_id', r.building_id, 'floor_id', r.floor_id, 'requires_admission', r.requires_admission,
              'room_lat', r.lat, 'room_lng', r.lng, 'room_plan_x', r.plan_x, 'room_plan_y', r.plan_y,
              'building_code', b.code, 'building_name', b.name,
              'floor_name', f.name, 'floor_level', f.level
            ) AS queue
       FROM queue_tickets t
       JOIN room_queues q ON q.id = t.queue_id
       JOIN rooms r ON r.id = t.room_id
       JOIN buildings b ON b.id = r.building_id
       JOIN floors f ON f.id = r.floor_id
      WHERE t.student_id = $1 AND t.status IN (${inList(ACTIVE_STATUSES)})
      ORDER BY t.issued_at DESC LIMIT 1`,
    [studentId],
  );
  return row ?? null;
}

export async function getTicket(db: Db, ticketId: string): Promise<TicketRow & { queue: QueueRow }> {
  const row = await db.one<TicketRow & { queue: QueueRow }>(
    `SELECT t.*, row_to_json(q)::jsonb || jsonb_build_object(
              'room_code', r.code, 'room_name', r.name, 'room_capacity', r.capacity,
              'building_id', r.building_id, 'floor_id', r.floor_id, 'requires_admission', r.requires_admission,
              'room_lat', r.lat, 'room_lng', r.lng, 'room_plan_x', r.plan_x, 'room_plan_y', r.plan_y,
              'building_code', b.code, 'building_name', b.name,
              'floor_name', f.name, 'floor_level', f.level
            ) AS queue
       FROM queue_tickets t
       JOIN room_queues q ON q.id = t.queue_id
       JOIN rooms r ON r.id = t.room_id
       JOIN buildings b ON b.id = r.building_id
       JOIN floors f ON f.id = r.floor_id
      WHERE t.id = $1`,
    [ticketId],
  );
  if (!row) throw ApiError.notFound('Ticket not found.');
  return row;
}

export interface TicketView {
  ticket: TicketRow;
  queue: QueueRow;
  people_ahead: number;
  counts: QueueCounts;
  eta_seconds: number;
  expected_service_at: string | null;
  check_in_deadline: string | null;
  seconds_until_deadline: number | null;
  can_check_in: boolean;
  can_cancel: boolean;
}

export async function ticketView(db: Db, ticket: TicketRow & { queue?: QueueRow }): Promise<TicketView> {
  const queue = (ticket as { queue?: QueueRow }).queue ?? (await getQueue(db, ticket.queue_id));
  const counts = await queueCounts(db, ticket.queue_id);
  const average = await averageServiceSeconds(db, ticket.queue_id, Number(queue.avg_service_seconds));

  const aheadRow = await db.one<{ ahead: string }>(
    `SELECT count(*)::text AS ahead FROM queue_tickets
      WHERE queue_id = $1 AND status IN (${inList(LINE_STATUSES)})
        AND position < $2`,
    [ticket.queue_id, ticket.position],
  );
  const peopleAhead = ticket.status === 'ADMITTED' || ticket.status === 'CHECKED_IN' ? 0 : Number(aheadRow?.ahead ?? 0);
  const etaSeconds =
    ticket.status === 'CALLED' || ticket.status === 'CHECK_IN_WINDOW'
      ? 0
      : Math.ceil(peopleAhead / Math.max(1, Number(queue.admission_capacity))) * average;

  const deadline = ticket.check_in_deadline ? new Date(ticket.check_in_deadline).getTime() : null;
  const secondsUntilDeadline = deadline === null ? null : Math.max(0, Math.round((deadline - Date.now()) / 1000));

  return {
    ticket,
    queue,
    people_ahead: peopleAhead,
    counts,
    eta_seconds: etaSeconds,
    expected_service_at:
      ticket.status === 'CALLED' || ticket.status === 'CHECK_IN_WINDOW' || ticket.status === 'CHECKED_IN'
        ? new Date().toISOString()
        : new Date(Date.now() + etaSeconds * 1000).toISOString(),
    check_in_deadline: ticket.check_in_deadline,
    seconds_until_deadline: secondsUntilDeadline,
    can_check_in: ['CALLED', 'CHECK_IN_WINDOW', 'APPROACHING', 'NAVIGATING'].includes(ticket.status),
    can_cancel: (CANCELLABLE_STATUSES as readonly string[]).includes(ticket.status),
  };
}

/* ---------------------------------------------------------------- transitions */

async function transition(
  db: Db,
  ticketId: string,
  allowedFrom: readonly string[],
  to: string,
  patch: Record<string, unknown>,
  eventType: string,
  actorId: string | null,
): Promise<TicketRow> {
  const ticket = await db.one<TicketRow>('SELECT * FROM queue_tickets WHERE id = $1 FOR UPDATE', [ticketId]);
  if (!ticket) throw ApiError.notFound('Ticket not found.');
  if (!allowedFrom.includes(ticket.status)) {
    throw ApiError.conflict(
      `This action is not available while the ticket is ${ticket.status.replaceAll('_', ' ').toLowerCase()}.`,
      'INVALID_TRANSITION',
    );
  }

  const columns = Object.keys(patch);
  const assignments = columns.map((column, index) => `${column} = $${index + 2}`).join(', ');
  const updated = await db.one<TicketRow>(
    `UPDATE queue_tickets SET ${assignments}, status = $${columns.length + 2}, updated_at = now()
      WHERE id = $1 RETURNING *`,
    [ticketId, ...columns.map((column) => patch[column]), to],
  );

  await db.query(
    `INSERT INTO queue_events (queue_id, ticket_id, type, actor_id, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [ticket.queue_id, ticketId, eventType, actorId, JSON.stringify({ from: ticket.status, to })],
  );

  return updated!;
}

export async function cancelTicket(
  db: Db,
  actor: { id: string; isStaff: boolean; isAdmin: boolean },
  ticketId: string,
  reason?: string,
): Promise<TicketRow> {
  return db.tx(async (tx) => {
    const preview = await getTicket(tx, ticketId);
    if (!actor.isStaff && !actor.isAdmin && preview.student_id !== actor.id) {
      throw ApiError.forbidden('You can only cancel your own ticket.');
    }
    await lockQueue(tx, preview.queue_id);

    const ticket = await transition(
      tx,
      ticketId,
      CANCELLABLE_STATUSES,
      'CANCELLED',
      { cancelled_at: new Date() },
      'ticket.cancelled',
      actor.id,
    );
    const mapping = await renumberLine(tx, ticket.queue_id);
    const counts = await queueCounts(tx, ticket.queue_id);

    await notify(tx, {
      userId: ticket.student_id,
      type: 'queue.ticket_cancelled',
      title: `Ticket ${ticket.ticket_number} cancelled`,
      body: reason ? `Your ticket was cancelled: ${reason}` : 'Your queue ticket was cancelled.',
      data: { ticket_id: ticket.id, queue_id: ticket.queue_id },
    });

    emitToQueue(ticket.queue_id, 'ticket.cancelled', {
      ticket_number: ticket.ticket_number,
      waiting: counts.waiting,
      positions: Object.fromEntries(mapping),
    });
    emitToUser(ticket.student_id, 'queue.ticket_cancelled', { ticket_id: ticket.id });
    emitToStaff('queue.changed', { queue_id: ticket.queue_id, counts });

    return ticket;
  });
}

export interface CallNextResult {
  called: TicketRow | null;
  counts: QueueCounts;
  message: string;
}

export async function callNext(
  db: Db,
  actorId: string,
  queueId: string,
  options: { ticketId?: string; autoRenumber?: boolean } = {},
): Promise<CallNextResult> {
  return db.tx(async (tx) => {
    const queue = await lockQueue(tx, queueId);
    const counts = await queueCounts(tx, queue.id);

    if (counts.occupying >= Number(queue.admission_capacity)) {
      throw ApiError.conflict(
        `The room is at its admission capacity (${queue.admission_capacity}). Complete or clear a student first.`,
        'CAPACITY_REACHED',
      );
    }

    const candidate = options.ticketId
      ? await tx.one<TicketRow>('SELECT * FROM queue_tickets WHERE id = $1 AND queue_id = $2 FOR UPDATE', [
          options.ticketId,
          queue.id,
        ])
      : await tx.one<TicketRow>(
          `SELECT * FROM queue_tickets
            WHERE queue_id = $1 AND status IN ('QUEUE_PENDING', 'WAITING')
            ORDER BY priority DESC, position ASC, issued_at ASC
            LIMIT 1 FOR UPDATE`,
          [queue.id],
        );

    if (!candidate) throw ApiError.conflict('There is nobody waiting in this queue.', 'QUEUE_EMPTY');
    if (!['QUEUE_PENDING', 'WAITING', 'APPROACHING', 'NAVIGATING'].includes(candidate.status)) {
      throw ApiError.conflict('This student is already being served.', 'ALREADY_CALLED');
    }

    const now = new Date();
    const windowSeconds = Number(queue.check_in_window_seconds) + Number(queue.grace_period_seconds);
    const deadline = new Date(now.getTime() + windowSeconds * 1000);

    const called = await transition(
      tx,
      candidate.id,
      ['QUEUE_PENDING', 'WAITING', 'APPROACHING', 'NAVIGATING'],
      'CALLED',
      { called_at: now, check_in_deadline: deadline },
      'ticket.called',
      actorId,
    );

    await notify(tx, {
      userId: called.student_id,
      type: 'queue.ticket_called',
      title: `It's your turn — ${queue.room_code}`,
      body: `Ticket ${called.ticket_number} was called. Check in within ${Math.round(windowSeconds / 60)} minutes at ${queue.room_name}.`,
      data: {
        ticket_id: called.id,
        queue_id: queue.id,
        room_id: queue.room_id,
        check_in_deadline: deadline.toISOString(),
        action: 'navigate',
      },
      priority: 'urgent',
    });

    const after = await queueCounts(tx, queue.id);
    emitToQueue(queue.id, 'ticket.called', {
      ticket_number: called.ticket_number,
      position: called.position,
      check_in_deadline: deadline.toISOString(),
      waiting: after.waiting,
    });
    emitToUser(called.student_id, 'queue.ticket_called', {
      ticket_id: called.id,
      ticket_number: called.ticket_number,
      check_in_deadline: deadline.toISOString(),
      room_code: queue.room_code,
      room_name: queue.room_name,
    });
    emitToStaff('queue.changed', { queue_id: queue.id, counts: after, called: called.ticket_number });

    return {
      called,
      counts: after,
      message: `Called ${called.ticket_number}.`,
    };
  });
}

export interface CheckInResult {
  ticket: TicketRow;
  verification: { method: string; distance_m: number | null; verified: boolean };
  counts: QueueCounts;
}

export async function checkIn(
  db: Db,
  actor: { id: string; isStaff: boolean; isAdmin: boolean },
  ticketId: string,
  options: { qrCode?: string; fix?: { lat?: number | null; lng?: number | null; plan_x?: number | null; plan_y?: number | null; floor_id?: string | null; source?: string } } = {},
): Promise<CheckInResult> {
  return db.tx(async (tx) => {
    const preview = await getTicket(tx, ticketId);
    if (!actor.isStaff && !actor.isAdmin && preview.student_id !== actor.id) {
      throw ApiError.forbidden('You can only check in your own ticket.');
    }
    const queue = await lockQueue(tx, preview.queue_id);

    const allowed = actor.isStaff || actor.isAdmin
      ? ['CALLED', 'CHECK_IN_WINDOW', 'APPROACHING', 'NAVIGATING', 'WAITING']
      : ['CALLED', 'CHECK_IN_WINDOW', 'APPROACHING'];

    let distance: number | null = null;
    let verified = false;
    let method: 'qr' | 'geofence' | 'staff' = actor.isStaff || actor.isAdmin ? 'staff' : 'geofence';

    if (actor.isStaff || actor.isAdmin) {
      verified = true;
    } else {
      const proximity = await checkProximity(tx, {
        userId: preview.student_id,
        room: {
          id: queue.room_id,
          lat: queue.room_lat === null ? null : Number(queue.room_lat),
          lng: queue.room_lng === null ? null : Number(queue.room_lng),
          plan_x: Number(queue.room_plan_x),
          plan_y: Number(queue.room_plan_y),
          floor_id: queue.floor_id,
        },
        radiusM: Number(queue.proximity_radius_m),
        fix: options.fix,
        qrCode: options.qrCode,
      });
      distance = proximity.distance_m;
      verified = proximity.verified;
      if (options.qrCode) method = 'qr';
      if (!verified) {
        throw new ApiError(409, proximity.reason ?? 'You must be at the room to check in.', {
          code: 'NOT_AT_LOCATION',
          errors: { distance_m: [`Measured distance: ${proximity.distance_m ?? 'unknown'} m (allowed ${proximity.radius_m} m).`] },
        });
      }
    }

    const ticket = await transition(
      tx,
      preview.id,
      allowed,
      'CHECKED_IN',
      { checked_in_at: new Date() },
      'student.checked_in',
      actor.id,
    );

    await tx.query(
      `INSERT INTO queue_check_ins (ticket_id, method, verified, lat, lng, distance_m, qr_node_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        ticket.id,
        method,
        verified,
        options.fix?.lat ?? null,
        options.fix?.lng ?? null,
        distance,
        options.qrCode
          ? (await tx.one<{ id: string }>('SELECT id FROM qr_nodes WHERE upper(code) = upper($1)', [options.qrCode]))?.id ?? null
          : null,
      ],
    );

    const mapping = await renumberLine(tx, queue.id);
    const counts = await queueCounts(tx, queue.id);

    await notify(tx, {
      userId: ticket.student_id,
      type: 'queue.checked_in',
      title: `Checked in for ${queue.room_code}`,
      body: `You are checked in. ${queue.room_name} staff will admit you shortly.`,
      data: { ticket_id: ticket.id, queue_id: queue.id },
    });

    emitToQueue(queue.id, 'student.checked_in', {
      ticket_number: ticket.ticket_number,
      waiting: counts.waiting,
      positions: Object.fromEntries(mapping),
    });
    emitToStaff('queue.changed', { queue_id: queue.id, counts, checked_in: ticket.ticket_number });
    emitToUser(ticket.student_id, 'queue.position_updated', { ticket_id: ticket.id, position: 0, waiting: counts.waiting });

    return { ticket, verification: { method, distance_m: distance, verified }, counts };
  });
}

export async function admit(db: Db, actorId: string, ticketId: string): Promise<TicketRow> {
  return db.tx(async (tx) => {
    const preview = await getTicket(tx, ticketId);
    await lockQueue(tx, preview.queue_id);
    const ticket = await transition(
      tx,
      ticketId,
      ['CHECKED_IN', 'CALLED', 'CHECK_IN_WINDOW'],
      'ADMITTED',
      { admitted_at: new Date() },
      'student.admitted',
      actorId,
    );

    await notify(tx, {
      userId: ticket.student_id,
      type: 'queue.admitted',
      title: 'Admission granted',
      body: `You have been admitted to ${preview.queue.room_name}.`,
      data: { ticket_id: ticket.id, room_id: ticket.room_id },
      priority: 'high',
    });
    emitToQueue(ticket.queue_id, 'student.admitted', { ticket_number: ticket.ticket_number });
    emitToUser(ticket.student_id, 'queue.admitted', { ticket_id: ticket.id });
    emitToStaff('queue.changed', { queue_id: ticket.queue_id, counts: await queueCounts(tx, ticket.queue_id) });
    return ticket;
  });
}

export async function completeService(db: Db, actorId: string, ticketId: string): Promise<TicketRow> {
  return db.tx(async (tx) => {
    const preview = await getTicket(tx, ticketId);
    const ticket = await transition(
      tx,
      ticketId,
      ['ADMITTED', 'CHECKED_IN'],
      'COMPLETED',
      { completed_at: new Date() },
      'ticket.completed',
      actorId,
    );
    const counts = await queueCounts(tx, ticket.queue_id);
    emitToStaff('queue.changed', { queue_id: preview.queue_id, counts });
    emitToQueue(ticket.queue_id, 'ticket.completed', { ticket_number: ticket.ticket_number, waiting: counts.waiting });
    emitToAdmins('queue.changed', { queue_id: ticket.queue_id, counts });
    return ticket;
  });
}

export async function markNoShow(db: Db, actorId: string, ticketId: string, reason?: string): Promise<TicketRow> {
  return db.tx(async (tx) => {
    const preview = await getTicket(tx, ticketId);
    await lockQueue(tx, preview.queue_id);
    const ticket = await transition(
      tx,
      ticketId,
      ['CALLED', 'CHECK_IN_WINDOW', 'APPROACHING', 'NAVIGATING', 'QUEUE_PENDING', 'WAITING'],
      'NO_SHOW',
      { no_show_at: new Date() },
      'ticket.no_show',
      actorId,
    );
    const mapping = await renumberLine(tx, ticket.queue_id);
    const counts = await queueCounts(tx, ticket.queue_id);

    await notify(tx, {
      userId: ticket.student_id,
      type: 'queue.no_show',
      title: `Ticket ${ticket.ticket_number} marked as no-show`,
      body:
        reason ??
        `You did not check in for ${preview.queue.room_name} in time, so the queue has moved on. You can join again when you are ready.`,
      data: { ticket_id: ticket.id, queue_id: ticket.queue_id },
      priority: 'high',
    });
    emitToQueue(ticket.queue_id, 'ticket.no_show', { ticket_number: ticket.ticket_number, positions: Object.fromEntries(mapping) });
    emitToUser(ticket.student_id, 'queue.no_show', { ticket_id: ticket.id });
    emitToStaff('queue.changed', { queue_id: ticket.queue_id, counts });
    return ticket;
  });
}

export async function markNavigating(db: Db, userId: string, ticketId: string): Promise<TicketRow> {
  const preview = await getTicket(db, ticketId);
  if (preview.student_id !== userId) throw ApiError.forbidden('You can only update your own ticket.');
  const ticket = await transition(
    db,
    ticketId,
    ['WAITING', 'CALLED', 'CHECK_IN_WINDOW'],
    preview.status === 'CALLED' || preview.status === 'CHECK_IN_WINDOW' ? 'CHECK_IN_WINDOW' : 'NAVIGATING',
    {},
    'ticket.navigating',
    userId,
  );
  emitToStaff('queue.student_navigating', { queue_id: ticket.queue_id, ticket_number: ticket.ticket_number });
  return ticket;
}

/**
 * Reconcile a student's line tickets with a fresh position fix: appraise the approach and
 * promote the ticket to APPROACHING (or CHECK_IN_WINDOW when already called). This is how
 * "your turn is approaching" becomes real rather than a hard-coded script.
 */
export async function reconcileTicketsForPosition(
  db: Db,
  userId: string,
  fix: { lat?: number | null; lng?: number | null; plan_x?: number | null; plan_y?: number | null; floor_id?: string | null; building_id?: string | null },
): Promise<{ promoted: string[] }> {
  const tickets = await db.query<TicketRow & { proximity_radius_m: number; room_lat: number | null; room_lng: number | null; room_plan_x: number; room_plan_y: number; floor_id: string; room_id_join: string }>(
    `SELECT t.*, q.proximity_radius_m, r.lat AS room_lat, r.lng AS room_lng,
            r.plan_x AS room_plan_x, r.plan_y AS room_plan_y, r.floor_id, r.id AS room_id_join
       FROM queue_tickets t
       JOIN room_queues q ON q.id = t.queue_id
       JOIN rooms r ON r.id = t.room_id
      WHERE t.student_id = $1 AND t.status IN ('WAITING', 'NAVIGATING', 'CALLED', 'CHECK_IN_WINDOW')`,
    [userId],
  );

  const promoted: string[] = [];
  for (const ticket of tickets) {
    const radius = Number(ticket.proximity_radius_m);
    const proximity = await checkProximity(db, {
      userId,
      room: {
        id: ticket.room_id,
        lat: ticket.room_lat === null ? null : Number(ticket.room_lat),
        lng: ticket.room_lng === null ? null : Number(ticket.room_lng),
        plan_x: Number(ticket.room_plan_x),
        plan_y: Number(ticket.room_plan_y),
        floor_id: ticket.floor_id,
      },
      radiusM: radius,
      fix,
    });
    if (proximity.verified) {
      if (ticket.status === 'CALLED') {
        await transition(db, ticket.id, ['CALLED'], 'CHECK_IN_WINDOW', {}, 'ticket.arrived_at_room', null);
        promoted.push(ticket.id);
        emitToUser(userId, 'queue.arrived', { ticket_id: ticket.id, message: 'You are at the room. Check in now.' });
      } else if (ticket.status === 'WAITING' || ticket.status === 'NAVIGATING') {
        await transition(db, ticket.id, ['WAITING', 'NAVIGATING'], 'APPROACHING', {}, 'ticket.approaching', null);
        promoted.push(ticket.id);
        emitToUser(userId, 'queue.approaching', { ticket_id: ticket.id, message: 'You are close to the room.' });
      }
    }
  }
  return { promoted };
}

/* --------------------------------------------------------------- scheduler sweep */

export interface ExpirySweepResult {
  expired: number;
  noShows: number;
  ghosts: number;
}

/**
 * Queue timeout handling (PROMPT §20, §23). Called by the scheduler every few seconds:
 *  - a called ticket whose check-in deadline and grace period have elapsed is expired;
 *  - a waiting ticket whose holder has never been near the room beyond the configured
 *    ghost timeout is expired, which is what stops unlimited phantom tickets.
 */
export async function sweepExpiredTickets(db: Db): Promise<ExpirySweepResult> {
  const result: ExpirySweepResult = { expired: 0, noShows: 0, ghosts: 0 };

  const overdue = await db.query<TicketRow & { room_code: string; room_name: string; grace_period_seconds: number; queue_max_active: number }>(
    `SELECT t.*, r.code AS room_code, r.name AS room_name, q.grace_period_seconds
       FROM queue_tickets t
       JOIN rooms r ON r.id = t.room_id
       JOIN room_queues q ON q.id = t.queue_id
      WHERE t.status IN ('CALLED', 'CHECK_IN_WINDOW', 'APPROACHING', 'NAVIGATING')
        AND t.check_in_deadline IS NOT NULL
        AND t.check_in_deadline + make_interval(secs => q.grace_period_seconds::int) < now()`,
  );

  for (const ticket of overdue) {
    await db.tx(async (tx) => {
      await lockQueue(tx, ticket.queue_id);
      await transition(tx, ticket.id, ['CALLED', 'CHECK_IN_WINDOW', 'APPROACHING', 'NAVIGATING'], 'EXPIRED', { expired_at: new Date() }, 'ticket.expired', null);
      const mapping = await renumberLine(tx, ticket.queue_id);
      await notify(tx, {
        userId: ticket.student_id,
        type: 'queue.ticket_expired',
        title: `Ticket ${ticket.ticket_number} expired`,
        body: `You did not check in at ${ticket.room_name} in time. Join the queue again when you are on your way.`,
        data: { ticket_id: ticket.id, queue_id: ticket.queue_id },
        priority: 'high',
      });
      emitToQueue(ticket.queue_id, 'ticket.expired', { ticket_number: ticket.ticket_number, positions: Object.fromEntries(mapping) });
      emitToUser(ticket.student_id, 'queue.ticket_expired', { ticket_id: ticket.id });
      emitToStaff('queue.changed', { queue_id: ticket.queue_id, counts: await queueCounts(tx, ticket.queue_id) });
      void tx.query(
        `INSERT INTO queue_events (queue_id, ticket_id, type, metadata) VALUES ($1, $2, 'ticket.expired_sweep', $3)`,
        [ticket.queue_id, ticket.id, JSON.stringify({ reason: 'check_in_window_elapsed' })],
      );
    });
    result.expired += 1;
  }

  // Ghost tickets: proximity-controlled queues expire line tickets that never showed a
  // verified position fix for longer than the configured timeout.
  const ghostTimeoutRow = await db.one<{ value: string }>(
    `SELECT (value #>> '{}') AS value FROM settings WHERE key = 'queue.ghost_timeout_minutes'`,
  );
  const ghostTimeoutMinutes = ghostTimeoutRow?.value ? Number(ghostTimeoutRow.value) || 45 : 45;

  const ghosts = await db.query<TicketRow>(
    `SELECT t.* FROM queue_tickets t
       JOIN room_queues q ON q.id = t.queue_id
      WHERE q.requires_proximity_to_join
        AND t.status IN ('QUEUE_PENDING', 'WAITING')
        AND t.issued_at < now() - make_interval(mins => $1::int)
        AND NOT EXISTS (
          SELECT 1 FROM queue_check_ins c WHERE c.ticket_id = t.id AND c.verified
        )`,
    [ghostTimeoutMinutes],
  );

  for (const ticket of ghosts) {
    await db.tx(async (tx) => {
      await lockQueue(tx, ticket.queue_id);
      await transition(tx, ticket.id, ['QUEUE_PENDING', 'WAITING'], 'EXPIRED', { expired_at: new Date() }, 'ticket.expired_ghost', null);
      const mapping = await renumberLine(tx, ticket.queue_id);
      await notify(tx, {
        userId: ticket.student_id,
        type: 'queue.ticket_expired',
        title: `Ticket ${ticket.ticket_number} released`,
        body: 'The ticket was released because no arrival was detected. Join again when you are near the room.',
        data: { ticket_id: ticket.id, queue_id: ticket.queue_id },
      });
      emitToQueue(ticket.queue_id, 'ticket.expired', { ticket_number: ticket.ticket_number, positions: Object.fromEntries(mapping) });
      emitToUser(ticket.student_id, 'queue.ticket_expired', { ticket_id: ticket.id });
    });
    result.ghosts += 1;
  }

  return result;
}

/** Broadcast the current line so dashboards reflect another student's progress live. */
export async function broadcastQueueState(db: Db, queueId: string): Promise<void> {
  const counts = await queueCounts(db, queueId);
  const line = await db.query<{ id: string; position: number }>(
    `SELECT id, position FROM queue_tickets
      WHERE queue_id = $1 AND status IN (${inList(LINE_STATUSES)}) ORDER BY position`,
    [queueId],
  );
  emitToQueue(queueId, 'queue.state', { counts, line: Object.fromEntries(line.map((row) => [row.id, row.position])) });
}

export async function staffQueueBoard(db: Db, scopeIds: string[] = []): Promise<unknown[]> {
  const rows = await db.query<Record<string, unknown>>(
    `SELECT q.id AS queue_id, r.id AS room_id, r.code AS room_code, r.name AS room_name,
            b.code AS building_code, f.name AS floor_name, q.is_active, q.admission_capacity,
            q.avg_service_seconds, q.max_size, q.proximity_radius_m, q.requires_proximity_to_join,
            (SELECT count(*)::int FROM queue_tickets t WHERE t.queue_id = q.id AND t.status IN ('QUEUE_PENDING','WAITING')) AS waiting,
            (SELECT count(*)::int FROM queue_tickets t WHERE t.queue_id = q.id AND t.status IN (${inList(OCCUPYING_STATUSES)})) AS occupying,
            (SELECT count(*)::int FROM queue_tickets t WHERE t.queue_id = q.id AND t.status = 'CHECKED_IN') AS checked_in,
            (SELECT json_build_object(
                      'ticket_id', t.id, 'ticket_number', t.ticket_number, 'status', t.status,
                      'position', t.position, 'student_name', u.name,
                      'student_registration_no', u.registration_no,
                      'check_in_deadline', t.check_in_deadline, 'called_at', t.called_at)
               FROM queue_tickets t JOIN users u ON u.id = t.student_id
              WHERE t.queue_id = q.id AND t.status IN ('CALLED','CHECK_IN_WINDOW','APPROACHING')
              ORDER BY t.position LIMIT 1) AS current
       FROM room_queues q
       JOIN rooms r ON r.id = q.room_id
       JOIN buildings b ON b.id = r.building_id
       JOIN floors f ON f.id = r.floor_id
      ${scopeIds.length ? 'WHERE q.id = ANY($1::uuid[])' : ''}`,
    scopeIds.length ? [scopeIds] : [],
  );
  return rows;
}

export async function queueLineDetail(db: Db, queueId: string): Promise<TicketRow[]> {
  return db.query<TicketRow>(
    `SELECT t.*, u.name AS student_name, u.email AS student_email, u.registration_no AS student_registration_no
       FROM queue_tickets t
       JOIN users u ON u.id = t.student_id
      WHERE t.queue_id = $1 AND t.status IN (${inList([...LINE_STATUSES, 'CHECKED_IN', 'ADMITTED'])})
      ORDER BY CASE WHEN t.status IN ('CHECKED_IN', 'ADMITTED') THEN 0 ELSE 1 END, t.position`,
    [queueId],
  );
}
