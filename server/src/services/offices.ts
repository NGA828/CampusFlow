import type { Db } from '../db/client.js';
import { ApiError } from '../lib/errors.js';
import { emitToAdmins, emitToOffice, emitToStaff, emitToUser } from '../realtime/bus.js';
import { notify } from './notifications.js';
import { campusParts, fromMinutes, isoWeekdayFromDate, toMinutes } from '../lib/clock.js';

/**
 * Administrative office ticketing (PROMPT §24–§27, §81).
 *
 * Office tickets are a separate workflow from room admission: the office publishes
 * service windows with their own capacity, tickets carry an expected service window, and
 * the queue advances through REQUESTED → WAITING → CALLED → IN_SERVICE → COMPLETED.
 * Position allocation uses the same transactional guarantees as room queues.
 */

export const OFFICE_LINE_STATUSES = ['REQUESTED', 'TICKET_ASSIGNED', 'WAITING', 'APPROACHING', 'CALLED', 'CHECK_IN_WINDOW'] as const;
export const OFFICE_ACTIVE_STATUSES = [...OFFICE_LINE_STATUSES, 'CHECKED_IN', 'IN_SERVICE'] as const;
export const OFFICE_CANCELLABLE = ['REQUESTED', 'TICKET_ASSIGNED', 'WAITING', 'APPROACHING', 'CALLED', 'CHECK_IN_WINDOW'] as const;

const inList = (values: readonly string[]) => values.map((value) => `'${value}'`).join(', ');

export interface OfficeRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  building_id: string;
  floor_id: string;
  room_id: string | null;
  ticket_prefix: string;
  service_duration_minutes: number;
  concurrent_capacity: number;
  daily_capacity: number;
  check_in_radius_m: number;
  grace_period_seconds: number;
  requires_proximity_to_request: boolean;
  requires_appointment: boolean;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
  building_code: string;
  building_name: string;
  floor_name: string;
  floor_level: number;
  room_code: string | null;
  room_name: string | null;
  room_lat: number | null;
  room_lng: number | null;
  room_plan_x: number | null;
  room_plan_y: number | null;
}

export interface OfficeTicketRow {
  id: string;
  office_id: string;
  student_id: string;
  ticket_number: string;
  sequence_no: number;
  position: number;
  status: string;
  subject: string;
  notes: string | null;
  priority: number;
  eta_seconds: number | null;
  window_starts_at: string | null;
  window_ends_at: string | null;
  requested_at: string;
  called_at: string | null;
  check_in_deadline: string | null;
  checked_in_at: string | null;
  service_started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  no_show_at: string | null;
  expired_at: string | null;
  service_minutes: number | null;
  handled_by: string | null;
  student_name?: string;
  student_email?: string;
  student_registration_no?: string | null;
}

const OFFICE_SELECT = `
  SELECT o.*, b.code AS building_code, b.name AS building_name,
         f.name AS floor_name, f.level AS floor_level,
         r.code AS room_code, r.name AS room_name, r.lat AS room_lat, r.lng AS room_lng,
         r.plan_x AS room_plan_x, r.plan_y AS room_plan_y
    FROM administrative_offices o
    JOIN buildings b ON b.id = o.building_id
    JOIN floors f ON f.id = o.floor_id
    LEFT JOIN rooms r ON r.id = o.room_id
`;

export interface ServiceWindow {
  id: string;
  office_id: string;
  day_of_week: number;
  opens_at: string;
  closes_at: string;
  capacity: number;
  avg_service_minutes: number;
  is_active: boolean;
}

export async function listOffices(db: Db): Promise<(OfficeRow & { waiting: number; in_service: number; next_slot: string | null })[]> {
  const now = campusParts();
  const offices = await db.query<OfficeRow & { waiting: number; in_service: number }>(
    `${OFFICE_SELECT}
      ORDER BY o.name`,
  );
  const counts = await db.query<{ office_id: string; waiting: string; in_service: string }>(
    `SELECT office_id,
            count(*) FILTER (WHERE status IN ('REQUESTED','TICKET_ASSIGNED','WAITING','APPROACHING'))::text AS waiting,
            count(*) FILTER (WHERE status IN ('CHECKED_IN','IN_SERVICE'))::text AS in_service
       FROM office_tickets GROUP BY office_id`,
  );
  const windows = await db.query<ServiceWindow>(
    `SELECT id, office_id, day_of_week, to_char(opens_at, 'HH24:MI') AS opens_at,
            to_char(closes_at, 'HH24:MI') AS closes_at, capacity, avg_service_minutes, is_active
       FROM office_service_windows WHERE day_of_week = $1 AND is_active ORDER BY opens_at`,
    [now.dayOfWeek],
  );

  const countsByOffice = new Map(counts.map((row) => [row.office_id, row]));
  const windowsByOffice = new Map<string, ServiceWindow[]>();
  for (const window of windows) {
    windowsByOffice.set(window.office_id, [...(windowsByOffice.get(window.office_id) ?? []), window]);
  }

  return offices.map((office) => {
    const todayWindows = windowsByOffice.get(office.id) ?? [];
    const upcoming = todayWindows.find((window) => toMinutes(window.closes_at) > now.minutes) ?? null;
    const countRow = countsByOffice.get(office.id);
    return {
      ...office,
      waiting: Number(countRow?.waiting ?? 0),
      in_service: Number(countRow?.in_service ?? 0),
      next_slot: upcoming ? upcoming.opens_at : null,
    };
  });
}

export async function getOffice(db: Db, idOrCode: string): Promise<OfficeRow> {
  const office = await db.one<OfficeRow>(
    `${OFFICE_SELECT} WHERE o.id::text = $1 OR upper(o.code) = upper($1)`,
    [idOrCode],
  );
  if (!office) throw ApiError.notFound('Office not found.');
  return office;
}

export async function officeWindows(db: Db, officeId: string): Promise<ServiceWindow[]> {
  return db.query<ServiceWindow>(
    `SELECT id, office_id, day_of_week, to_char(opens_at, 'HH24:MI') AS opens_at,
            to_char(closes_at, 'HH24:MI') AS closes_at, capacity, avg_service_minutes, is_active
       FROM office_service_windows WHERE office_id = $1 ORDER BY day_of_week, opens_at`,
    [officeId],
  );
}

export interface OfficeStatus {
  office: OfficeRow;
  windows: ServiceWindow[];
  today_windows: ServiceWindow[];
  is_open_now: boolean;
  opens_at: string | null;
  closes_at: string | null;
  next_opening: string | null;
  counts: { waiting: number; in_service: number; completed_today: number; checked_in: number };
  average_service_minutes: number;
  next_ticket_number: string;
  estimated_wait_minutes: number;
  expected_window: { starts_at: string; ends_at: string } | null;
  daily_capacity_used: number;
  daily_capacity: number;
  staff: { id: string; name: string; role: string }[];
}

export async function officeStatus(db: Db, officeId: string): Promise<OfficeStatus> {
  const office = await getOffice(db, officeId);
  const windows = await officeWindows(db, office.id);
  const now = campusParts();
  const todayWindows = windows.filter((window) => window.day_of_week === now.dayOfWeek && window.is_active);

  const countsRow = await db.one<Record<string, string>>(
    `SELECT count(*) FILTER (WHERE status IN ('REQUESTED','TICKET_ASSIGNED','WAITING','APPROACHING'))::text AS waiting,
            count(*) FILTER (WHERE status IN ('CHECKED_IN','IN_SERVICE'))::text AS in_service,
            count(*) FILTER (WHERE status = 'CHECKED_IN')::text AS checked_in,
            count(*) FILTER (WHERE status = 'COMPLETED' AND completed_at::date = CURRENT_DATE)::text AS completed_today,
            count(*) FILTER (WHERE requested_at::date = CURRENT_DATE AND status <> 'CANCELLED')::text AS issued_today
       FROM office_tickets WHERE office_id = $1`,
    [office.id],
  );

  const historical = await db.one<{ avg_minutes: string | null; samples: string }>(
    `SELECT avg(service_minutes)::text AS avg_minutes, count(*)::text AS samples
       FROM office_tickets
      WHERE office_id = $1 AND status = 'COMPLETED' AND service_minutes IS NOT NULL
        AND completed_at > now() - interval '30 days'`,
    [office.id],
  );
  const samples = Number(historical?.samples ?? 0);
  const averageServiceMinutes =
    samples >= 5 && historical?.avg_minutes
      ? Math.round(Number(historical.avg_minutes) * 0.7 + Number(office.service_duration_minutes) * 0.3)
      : Number(office.service_duration_minutes);

  const isOpenNow = todayWindows.some(
    (window) => now.minutes >= toMinutes(window.opens_at) && now.minutes < toMinutes(window.closes_at),
  );
  const currentWindow = todayWindows.find(
    (window) => now.minutes >= toMinutes(window.opens_at) && now.minutes < toMinutes(window.closes_at),
  );
  const upcomingWindow =
    todayWindows.find((window) => toMinutes(window.opens_at) > now.minutes) ?? null;

  const staff = await db.query<{ id: string; name: string; role: string }>(
    `SELECT u.id, u.name, s.role FROM office_staff s JOIN users u ON u.id = s.user_id WHERE s.office_id = $1`,
    [office.id],
  );

  const waiting = Number(countsRow?.waiting ?? 0);
  const concurrent = Math.max(1, Number(office.concurrent_capacity));
  const estimatedWaitMinutes = Math.ceil((waiting * averageServiceMinutes) / concurrent);

  const nextSequence = Number(
    (await db.one<{ counter: string }>('SELECT counter::text FROM office_counters WHERE office_id = $1', [office.id]))?.counter ?? 0,
  ) + 1;
  const nextTicketNumber = `${office.ticket_prefix}-${String(nextSequence).padStart(3, '0')}`;

  let expectedWindow: { starts_at: string; ends_at: string } | null = null;
  if (isOpenNow && currentWindow) {
    const startMinutes = Math.min(
      now.minutes + estimatedWaitMinutes,
      toMinutes(currentWindow.closes_at) - averageServiceMinutes,
    );
    const clampedStart = Math.max(now.minutes, startMinutes);
    expectedWindow = {
      starts_at: `${now.date}T${fromMinutes(clampedStart)}:00`,
      ends_at: `${now.date}T${fromMinutes(clampedStart + averageServiceMinutes)}:00`,
    };
  }

  return {
    office,
    windows,
    today_windows: todayWindows,
    is_open_now: isOpenNow,
    opens_at: currentWindow?.opens_at ?? upcomingWindow?.opens_at ?? null,
    closes_at: currentWindow?.closes_at ?? null,
    next_opening:
      !isOpenNow && upcomingWindow
        ? `Opens today at ${upcomingWindow.opens_at}`
        : !isOpenNow && todayWindows.length === 0
          ? nextWeekdayHint(windows, now.dayOfWeek)
          : null,
    counts: {
      waiting,
      in_service: Number(countsRow?.in_service ?? 0),
      checked_in: Number(countsRow?.checked_in ?? 0),
      completed_today: Number(countsRow?.completed_today ?? 0),
    },
    average_service_minutes: averageServiceMinutes,
    next_ticket_number: nextTicketNumber,
    estimated_wait_minutes: estimatedWaitMinutes,
    expected_window: expectedWindow,
    daily_capacity_used: Number(countsRow?.issued_today ?? 0),
    daily_capacity: Number(office.daily_capacity),
    staff,
  };
}

function nextWeekdayHint(windows: ServiceWindow[], todayDow: number): string | null {
  const active = windows.filter((window) => window.is_active);
  if (active.length === 0) return null;
  const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  for (let offset = 1; offset <= 7; offset += 1) {
    const dow = ((todayDow - 1 + offset) % 7) + 1;
    const window = active.find((candidate) => candidate.day_of_week === dow);
    if (window) return `Opens ${names[dow - 1]} at ${window.opens_at}`;
  }
  return null;
}

/* ------------------------------------------------------------------- numbering */

async function allocateOfficeSequence(db: Db, officeId: string, dateISO: string): Promise<number> {
  const row = await db.one<{ counter: number }>(
    `INSERT INTO office_counters (office_id, issued_date, counter)
     VALUES ($1, $2::date, 1)
     ON CONFLICT (office_id) DO UPDATE
        SET counter = CASE WHEN office_counters.issued_date = $2::date THEN office_counters.counter + 1 ELSE 1 END,
            issued_date = $2::date,
            updated_at = now()
     RETURNING counter`,
    [officeId, dateISO],
  );
  return Number(row?.counter ?? 1);
}

async function nextOfficePosition(db: Db, officeId: string): Promise<number> {
  const row = await db.one<{ next: string }>(
    `SELECT (coalesce(max(position), 0) + 1)::text AS next FROM office_tickets
      WHERE office_id = $1 AND status IN (${inList(OFFICE_LINE_STATUSES)})`,
    [officeId],
  );
  return Number(row?.next ?? 1);
}

export async function renumberOfficeLine(db: Db, officeId: string): Promise<Map<string, number>> {
  const rows = await db.query<{ id: string }>(
    `SELECT id FROM office_tickets
      WHERE office_id = $1 AND status IN (${inList(OFFICE_LINE_STATUSES)})
      ORDER BY priority DESC, requested_at ASC, sequence_no ASC`,
    [officeId],
  );
  const mapping = new Map<string, number>();
  rows.forEach((row, index) => mapping.set(row.id, index + 1));
  if (mapping.size === 0) return mapping;
  await db.query(
    `UPDATE office_tickets SET position = position + 10000, updated_at = now()
      WHERE office_id = $1 AND status IN (${inList(OFFICE_LINE_STATUSES)})`,
    [officeId],
  );
  for (const [ticketId, position] of mapping) {
    await db.query('UPDATE office_tickets SET position = $1, updated_at = now() WHERE id = $2', [position, ticketId]);
  }
  return mapping;
}

/* ------------------------------------------------------------------ ticket flow */

export interface RequestTicketOptions {
  officeId: string;
  subject: string;
  notes?: string;
  qrCode?: string;
  fix?: { lat?: number | null; lng?: number | null; plan_x?: number | null; plan_y?: number | null; floor_id?: string | null; source?: string };
}

export interface OfficeTicketView {
  ticket: OfficeTicketRow;
  office: OfficeRow;
  people_ahead: number;
  counts: { waiting: number; in_service: number };
  eta_seconds: number;
  expected_window: { starts_at: string; ends_at: string } | null;
  seconds_until_deadline: number | null;
  can_check_in: boolean;
  can_cancel: boolean;
  status_label: string;
}

export async function requestOfficeTicket(
  db: Db,
  studentId: string,
  options: RequestTicketOptions,
): Promise<{ ticket: OfficeTicketRow; office: OfficeRow }> {
  return db.tx(async (tx) => {
    const office = await getOffice(tx, options.officeId);
    await tx.query('SELECT id FROM administrative_offices WHERE id = $1 FOR UPDATE', [office.id]);

    if (!office.is_active) throw ApiError.conflict('This office is not accepting requests right now.', 'OFFICE_CLOSED');

    const existing = await tx.one<OfficeTicketRow>(
      `SELECT * FROM office_tickets
        WHERE office_id = $1 AND student_id = $2 AND status IN (${inList(OFFICE_ACTIVE_STATUSES)})`,
      [office.id, studentId],
    );
    if (existing) {
      throw new ApiError(409, `You already hold ticket ${existing.ticket_number} for ${office.name}.`, {
        code: 'ALREADY_HAS_TICKET',
      });
    }

    // Daily capacity and service windows are configured by administrators.
    const capacityRow = await tx.one<{ issued: string }>(
      `SELECT count(*)::text AS issued FROM office_tickets
        WHERE office_id = $1 AND requested_at::date = CURRENT_DATE AND status <> 'CANCELLED'`,
      [office.id],
    );
    if (Number(capacityRow?.issued ?? 0) >= Number(office.daily_capacity)) {
      throw ApiError.conflict(
        `${office.name} has reached its daily capacity of ${office.daily_capacity} tickets. Please try again tomorrow.`,
        'DAILY_CAPACITY_REACHED',
      );
    }

    const now = campusParts();
    const windows = (await officeWindows(tx, office.id)).filter(
      (window) => window.day_of_week === now.dayOfWeek && window.is_active,
    );
    const openWindow = windows.find(
      (window) => now.minutes >= toMinutes(window.opens_at) && now.minutes < toMinutes(window.closes_at),
    );
    if (!openWindow) {
      const hint = await nextWindowHint(tx, office.id, now.dayOfWeek);
      throw ApiError.conflict(
        `${office.name} is closed. ${hint ?? 'No service windows are configured for today.'}`,
        'OUTSIDE_SERVICE_HOURS',
      );
    }

    if (office.requires_proximity_to_request) {
      const fix = options.fix ?? (await storedFix(tx, studentId));
      const verified = await verifyOfficeProximity(tx, office, fix, Number(office.check_in_radius_m));
      if (!verified.verified) {
        throw new ApiError(422, verified.reason ?? 'You must be at the office to request a ticket.', {
          code: 'PROXIMITY_REQUIRED',
        });
      }
    }

    const sequence = await allocateOfficeSequence(tx, office.id, now.date);
    const position = await nextOfficePosition(tx, office.id);
    const status = await officeStatus(tx, office.id);
    const ticketNumber = `${office.ticket_prefix}-${String(sequence).padStart(3, '0')}`;

    const ticket = await tx.one<OfficeTicketRow>(
      `INSERT INTO office_tickets
         (office_id, student_id, ticket_number, sequence_no, position, status, subject, notes, eta_seconds,
          window_starts_at, window_ends_at)
       VALUES ($1, $2, $3, $4, $5, 'WAITING', $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        office.id,
        studentId,
        ticketNumber,
        sequence,
        position,
        options.subject,
        options.notes ?? null,
        status.estimated_wait_minutes * 60,
        status.expected_window?.starts_at ?? null,
        status.expected_window?.ends_at ?? null,
      ],
    );

    await tx.query(
      `INSERT INTO office_ticket_events (office_id, ticket_id, type, actor_id, metadata)
       VALUES ($1, $2, 'ticket.requested', $3, $4)`,
      [office.id, ticket!.id, studentId, JSON.stringify({ position, ticket_number: ticketNumber, subject: options.subject })],
    );

    await notify(tx, {
      userId: studentId,
      type: 'office.ticket_assigned',
      title: `Ticket ${ticketNumber} · ${office.name}`,
      body: `You are number ${position} in the queue. Estimated wait ${status.estimated_wait_minutes} minutes${
        status.expected_window ? ` · expected service ${formatWindow(status.expected_window)}` : ''
      }.`,
      data: {
        ticket_id: ticket!.id,
        office_id: office.id,
        position,
        estimated_wait_minutes: status.estimated_wait_minutes,
      },
    });

    const counts = await officeCounts(tx, office.id);
    emitToOffice(office.id, 'office.ticket_requested', { ticket_number: ticketNumber, position, waiting: counts.waiting });
    emitToUser(studentId, 'office.position_updated', {
      ticket_id: ticket!.id,
      position,
      people_ahead: Math.max(0, position - 1),
      eta_seconds: status.estimated_wait_minutes * 60,
    });
    emitToStaff('office.changed', { office_id: office.id, counts });

    return { ticket: ticket!, office };
  });
}

function formatWindow(window: { starts_at: string; ends_at: string }): string {
  const time = (iso: string) => iso.slice(11, 16);
  return `${time(window.starts_at)}–${time(window.ends_at)}`;
}

async function nextWindowHint(db: Db, officeId: string, todayDow: number): Promise<string | null> {
  const windows = await officeWindows(db, officeId);
  return nextWeekdayHint(windows, todayDow);
}

async function storedFix(db: Db, userId: string) {
  const row = await db.one<{ lat: number; lng: number; plan_x: number | null; plan_y: number | null; floor_id: string | null; source: string }>(
    `SELECT p.lat, p.lng, p.floor_id, p.source, n.plan_x, n.plan_y
       FROM user_positions p LEFT JOIN navigation_nodes n ON n.id = p.nav_node_id
      WHERE p.user_id = $1 AND p.expires_at > now()`,
    [userId],
  );
  if (!row) return null;
  return {
    lat: Number(row.lat),
    lng: Number(row.lng),
    plan_x: row.plan_x === null ? null : Number(row.plan_x),
    plan_y: row.plan_y === null ? null : Number(row.plan_y),
    floor_id: row.floor_id,
    source: row.source,
  };
}

async function verifyOfficeProximity(
  db: Db,
  office: OfficeRow,
  fix: { lat?: number | null; lng?: number | null; plan_x?: number | null; plan_y?: number | null; floor_id?: string | null; source?: string } | null,
  radiusM: number,
): Promise<{ verified: boolean; distance_m: number | null; reason?: string }> {
  if (!fix) {
    return { verified: false, distance_m: null, reason: 'No recent position fix. Scan the QR anchor at the office door.' };
  }
  if (fix.plan_x != null && fix.plan_y != null && fix.floor_id === office.floor_id && office.room_plan_x != null) {
    const distance = Math.hypot(Number(fix.plan_x) - Number(office.room_plan_x), Number(fix.plan_y) - Number(office.room_plan_y));
    return {
      verified: distance <= radiusM,
      distance_m: Math.round(distance * 10) / 10,
      reason: distance <= radiusM ? undefined : `You are ${Math.round(distance)} m from ${office.name}.`,
    };
  }
  if (fix.lat != null && fix.lng != null) {
    const officeLat = office.room_lat ?? null;
    const officeLng = office.room_lng ?? null;
    if (officeLat !== null && officeLng !== null) {
      const row = await db.one<{ distance: string }>(
        'SELECT cf_distance_m($1::float8, $2::float8, $3::float8, $4::float8)::text AS distance',
        [Number(fix.lat), Number(fix.lng), Number(officeLat), Number(officeLng)],
      );
      const distance = Number(row?.distance ?? Number.POSITIVE_INFINITY);
      return {
        verified: distance <= radiusM,
        distance_m: Math.round(distance * 10) / 10,
        reason: distance <= radiusM ? undefined : `You are ${Math.round(distance)} m from ${office.name}.`,
      };
    }
  }
  return { verified: false, distance_m: null, reason: 'Your position could not be verified for this office.' };
}

export async function officeCounts(db: Db, officeId: string): Promise<{ waiting: number; in_service: number; checked_in: number }> {
  const row = await db.one<Record<string, string>>(
    `SELECT count(*) FILTER (WHERE status IN ('REQUESTED','TICKET_ASSIGNED','WAITING','APPROACHING'))::text AS waiting,
            count(*) FILTER (WHERE status IN ('CHECKED_IN','IN_SERVICE'))::text AS in_service,
            count(*) FILTER (WHERE status = 'CHECKED_IN')::text AS checked_in
       FROM office_tickets WHERE office_id = $1`,
    [officeId],
  );
  return {
    waiting: Number(row?.waiting ?? 0),
    in_service: Number(row?.in_service ?? 0),
    checked_in: Number(row?.checked_in ?? 0),
  };
}

export async function getOfficeTicket(db: Db, ticketId: string): Promise<OfficeTicketRow & { office: OfficeRow }> {
  const ticket = await db.one<OfficeTicketRow>('SELECT * FROM office_tickets WHERE id = $1', [ticketId]);
  if (!ticket) throw ApiError.notFound('Office ticket not found.');
  const office = await getOffice(db, ticket.office_id);
  return { ...ticket, office };
}

export async function activeOfficeTicket(db: Db, studentId: string): Promise<(OfficeTicketRow & { office: OfficeRow }) | null> {
  const ticket = await db.one<OfficeTicketRow>(
    `SELECT * FROM office_tickets
      WHERE student_id = $1 AND status IN (${inList(OFFICE_ACTIVE_STATUSES)})
      ORDER BY requested_at DESC LIMIT 1`,
    [studentId],
  );
  if (!ticket) return null;
  const office = await getOffice(db, ticket.office_id);
  return { ...ticket, office };
}

export async function officeTicketView(db: Db, ticketId: string): Promise<OfficeTicketView> {
  const ticket = await getOfficeTicket(db, ticketId);
  const counts = await officeCounts(db, ticket.office_id);
  const average = Number(ticket.office.service_duration_minutes);

  const aheadRow = await db.one<{ ahead: string }>(
    `SELECT count(*)::text AS ahead FROM office_tickets
      WHERE office_id = $1 AND status IN (${inList(OFFICE_LINE_STATUSES)}) AND position < $2`,
    [ticket.office_id, ticket.position],
  );
  const peopleAhead = ['IN_SERVICE', 'CHECKED_IN', 'COMPLETED'].includes(ticket.status)
    ? 0
    : Number(aheadRow?.ahead ?? 0);
  const concurrent = Math.max(1, Number(ticket.office.concurrent_capacity));
  const etaSeconds = Math.ceil((peopleAhead * average * 60) / concurrent);

  const deadline = ticket.check_in_deadline ? new Date(ticket.check_in_deadline).getTime() : null;

  return {
    ticket,
    office: ticket.office,
    people_ahead: peopleAhead,
    counts: { waiting: counts.waiting, in_service: counts.in_service },
    eta_seconds: etaSeconds,
    expected_window:
      ticket.window_starts_at && ticket.window_ends_at
        ? { starts_at: ticket.window_starts_at, ends_at: ticket.window_ends_at }
        : null,
    seconds_until_deadline: deadline === null ? null : Math.max(0, Math.round((deadline - Date.now()) / 1000)),
    can_check_in: ['APPROACHING', 'CALLED', 'CHECK_IN_WINDOW'].includes(ticket.status),
    can_cancel: (OFFICE_CANCELLABLE as readonly string[]).includes(ticket.status),
    status_label: labelForStatus(ticket.status),
  };
}

function labelForStatus(status: string): string {
  const labels: Record<string, string> = {
    REQUESTED: 'Request received',
    TICKET_ASSIGNED: 'Ticket assigned',
    WAITING: 'Waiting',
    APPROACHING: 'Your turn is approaching',
    CALLED: "It's your turn",
    CHECK_IN_WINDOW: 'Check in now',
    CHECKED_IN: 'Checked in',
    IN_SERVICE: 'In service',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    NO_SHOW: 'Missed',
    EXPIRED: 'Expired',
  };
  return labels[status] ?? status;
}

async function transitionOffice(
  db: Db,
  ticketId: string,
  allowedFrom: readonly string[],
  to: string,
  patch: Record<string, unknown>,
  eventType: string,
  actorId: string | null,
): Promise<OfficeTicketRow> {
  const ticket = await db.one<OfficeTicketRow>('SELECT * FROM office_tickets WHERE id = $1 FOR UPDATE', [ticketId]);
  if (!ticket) throw ApiError.notFound('Office ticket not found.');
  if (!allowedFrom.includes(ticket.status)) {
    throw ApiError.conflict(
      `This action is not available while the ticket is ${ticket.status.replaceAll('_', ' ').toLowerCase()}.`,
      'INVALID_TRANSITION',
    );
  }
  const columns = Object.keys(patch);
  const assignments = columns.map((column, index) => `${column} = $${index + 2}`).join(', ');
  const updated = await db.one<OfficeTicketRow>(
    `UPDATE office_tickets SET ${columns.length ? `${assignments}, ` : ''}status = $${columns.length + 2}, updated_at = now()
      WHERE id = $1 RETURNING *`,
    [ticketId, ...columns.map((column) => patch[column]), to],
  );
  await db.query(
    `INSERT INTO office_ticket_events (office_id, ticket_id, type, actor_id, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [ticket.office_id, ticketId, eventType, actorId, JSON.stringify({ from: ticket.status, to })],
  );
  return updated!;
}

export async function cancelOfficeTicket(
  db: Db,
  actor: { id: string; isStaff: boolean; isAdmin: boolean },
  ticketId: string,
  reason?: string,
): Promise<OfficeTicketRow> {
  return db.tx(async (tx) => {
    const preview = await getOfficeTicket(tx, ticketId);
    if (!actor.isStaff && !actor.isAdmin && preview.student_id !== actor.id) {
      throw ApiError.forbidden('You can only cancel your own ticket.');
    }
    await tx.query('SELECT id FROM administrative_offices WHERE id = $1 FOR UPDATE', [preview.office_id]);
    const ticket = await transitionOffice(
      tx,
      ticketId,
      OFFICE_CANCELLABLE,
      'CANCELLED',
      { cancelled_at: new Date() },
      'ticket.cancelled',
      actor.id,
    );
    const mapping = await renumberOfficeLine(tx, ticket.office_id);
    const counts = await officeCounts(tx, ticket.office_id);

    await notify(tx, {
      userId: ticket.student_id,
      type: 'office.ticket_cancelled',
      title: `Ticket ${ticket.ticket_number} cancelled`,
      body: reason ?? `Your ticket for ${preview.office.name} was cancelled.`,
      data: { ticket_id: ticket.id, office_id: ticket.office_id },
    });
    emitToOffice(ticket.office_id, 'office.ticket_cancelled', { ticket_number: ticket.ticket_number, positions: Object.fromEntries(mapping) });
    emitToUser(ticket.student_id, 'office.ticket_cancelled', { ticket_id: ticket.id });
    emitToStaff('office.changed', { office_id: ticket.office_id, counts });
    return ticket;
  });
}

export async function callNextOfficeTicket(
  db: Db,
  actorId: string,
  officeId: string,
  options: { ticketId?: string } = {},
): Promise<{ called: OfficeTicketRow; counts: { waiting: number; in_service: number; checked_in: number } }> {
  return db.tx(async (tx) => {
    const office = await getOffice(tx, officeId);
    await tx.query('SELECT id FROM administrative_offices WHERE id = $1 FOR UPDATE', [office.id]);

    const counts = await officeCounts(tx, office.id);
    if (counts.in_service >= Number(office.concurrent_capacity)) {
      throw ApiError.conflict(
        `All ${office.concurrent_capacity} service slot(s) at ${office.name} are occupied. Complete a service first.`,
        'CAPACITY_REACHED',
      );
    }

    const candidate = options.ticketId
      ? await tx.one<OfficeTicketRow>('SELECT * FROM office_tickets WHERE id = $1 AND office_id = $2 FOR UPDATE', [
          options.ticketId,
          office.id,
        ])
      : await tx.one<OfficeTicketRow>(
          `SELECT * FROM office_tickets
            WHERE office_id = $1 AND status IN ('REQUESTED','TICKET_ASSIGNED','WAITING','APPROACHING')
            ORDER BY priority DESC, position ASC, requested_at ASC LIMIT 1 FOR UPDATE`,
          [office.id],
        );
    if (!candidate) throw ApiError.conflict('There is nobody waiting at this office.', 'QUEUE_EMPTY');

    const now = new Date();
    const windowSeconds = Number(office.grace_period_seconds) + 180;
    const deadline = new Date(now.getTime() + windowSeconds * 1000);

    const called = await transitionOffice(
      tx,
      candidate.id,
      ['REQUESTED', 'TICKET_ASSIGNED', 'WAITING', 'APPROACHING'],
      'CALLED',
      { called_at: now, check_in_deadline: deadline },
      'ticket.called',
      actorId,
    );

    await notify(tx, {
      userId: called.student_id,
      type: 'office.ticket_called',
      title: `It's your turn · ${office.name}`,
      body: `Ticket ${called.ticket_number} is being called. Please check in at ${office.name} within ${Math.round(windowSeconds / 60)} minutes.`,
      data: {
        ticket_id: called.id,
        office_id: office.id,
        check_in_deadline: deadline.toISOString(),
        action: 'navigate',
      },
      priority: 'urgent',
    });

    const after = await officeCounts(tx, office.id);
    emitToOffice(office.id, 'office.ticket_called', {
      ticket_number: called.ticket_number,
      check_in_deadline: deadline.toISOString(),
      waiting: after.waiting,
    });
    emitToUser(called.student_id, 'office.ticket_called', {
      ticket_id: called.id,
      ticket_number: called.ticket_number,
      office_name: office.name,
      check_in_deadline: deadline.toISOString(),
    });
    emitToStaff('office.changed', { office_id: office.id, counts: after, called: called.ticket_number });

    return { called, counts: after };
  });
}

export async function officeCheckIn(
  db: Db,
  actor: { id: string; isStaff: boolean; isAdmin: boolean },
  ticketId: string,
  options: { qrCode?: string; fix?: { lat?: number | null; lng?: number | null; plan_x?: number | null; plan_y?: number | null; floor_id?: string | null; source?: string } } = {},
): Promise<{ ticket: OfficeTicketRow; verification: { method: string; distance_m: number | null; verified: boolean } }> {
  return db.tx(async (tx) => {
    const preview = await getOfficeTicket(tx, ticketId);
    if (!actor.isStaff && !actor.isAdmin && preview.student_id !== actor.id) {
      throw ApiError.forbidden('You can only check in your own ticket.');
    }
    await tx.query('SELECT id FROM administrative_offices WHERE id = $1 FOR UPDATE', [preview.office_id]);

    let method: 'qr' | 'geofence' | 'staff' = actor.isStaff || actor.isAdmin ? 'staff' : 'geofence';
    let distance: number | null = null;
    let verified = actor.isStaff || actor.isAdmin;

    if (!verified) {
      let fix = options.fix ?? null;
      if (!fix && options.qrCode) {
        const node = await tx.one<{ lat: number | null; lng: number | null; plan_x: number; plan_y: number; floor_id: string; id: string }>(
          'SELECT id, lat, lng, plan_x, plan_y, floor_id FROM qr_nodes WHERE upper(code) = upper($1) AND is_active',
          [options.qrCode],
        );
        if (node) {
          fix = {
            lat: node.lat,
            lng: node.lng,
            plan_x: Number(node.plan_x),
            plan_y: Number(node.plan_y),
            floor_id: node.floor_id,
            source: 'qr',
          };
          method = 'qr';
        }
      }
      if (!fix) fix = await storedFix(tx, preview.student_id);
      const verdict = await verifyOfficeProximity(tx, preview.office, fix, Number(preview.office.check_in_radius_m));
      verified = verdict.verified;
      distance = verdict.distance_m;
      if (!verified) {
        throw new ApiError(409, verdict.reason ?? 'You must be at the office to check in.', { code: 'NOT_AT_LOCATION' });
      }
    }

    const ticket = await transitionOffice(
      tx,
      preview.id,
      ['CALLED', 'CHECK_IN_WINDOW', 'APPROACHING', 'WAITING', 'REQUESTED', 'TICKET_ASSIGNED'],
      'CHECKED_IN',
      { checked_in_at: new Date() },
      'student.checked_in',
      actor.id,
    );

    await tx.query(
      `INSERT INTO office_check_ins (ticket_id, method, verified, lat, lng, distance_m, qr_node_id)
       VALUES ($1, $2, $3, $4, $5, $6, NULL)`,
      [ticket.id, method, verified, options.fix?.lat ?? null, options.fix?.lng ?? null, distance],
    );

    const mapping = await renumberOfficeLine(tx, ticket.office_id);
    await notify(tx, {
      userId: ticket.student_id,
      type: 'office.checked_in',
      title: `Checked in · ${preview.office.name}`,
      body: 'You are checked in. Please wait to be called for service.',
      data: { ticket_id: ticket.id, office_id: ticket.office_id },
    });
    emitToOffice(ticket.office_id, 'office.checked_in', {
      ticket_number: ticket.ticket_number,
      positions: Object.fromEntries(mapping),
    });
    emitToStaff('office.changed', { office_id: ticket.office_id, counts: await officeCounts(tx, ticket.office_id) });
    emitToUser(ticket.student_id, 'office.position_updated', { ticket_id: ticket.id, position: 0 });
    return { ticket, verification: { method, distance_m: distance, verified } };
  });
}

export async function startOfficeService(db: Db, actorId: string, ticketId: string): Promise<OfficeTicketRow> {
  return db.tx(async (tx) => {
    const preview = await getOfficeTicket(tx, ticketId);
    const ticket = await transitionOffice(
      tx,
      ticketId,
      ['CHECKED_IN', 'CALLED', 'CHECK_IN_WINDOW'],
      'IN_SERVICE',
      { service_started_at: new Date(), handled_by: actorId },
      'service.started',
      actorId,
    );
    await notify(tx, {
      userId: ticket.student_id,
      type: 'office.in_service',
      title: 'Your service has started',
      body: `${preview.office.name} has started serving ticket ${ticket.ticket_number}.`,
      data: { ticket_id: ticket.id, office_id: ticket.office_id },
      priority: 'high',
    });
    emitToOffice(ticket.office_id, 'office.in_service', { ticket_number: ticket.ticket_number });
    emitToUser(ticket.student_id, 'office.in_service', { ticket_id: ticket.id });
    emitToStaff('office.changed', { office_id: ticket.office_id, counts: await officeCounts(tx, ticket.office_id) });
    return ticket;
  });
}

export async function completeOfficeService(db: Db, actorId: string, ticketId: string, notes?: string): Promise<OfficeTicketRow> {
  return db.tx(async (tx) => {
    const preview = await getOfficeTicket(tx, ticketId);
    const startedAt = preview.service_started_at ? new Date(preview.service_started_at).getTime() : Date.now();
    const serviceMinutes = Math.max(1, Math.round((Date.now() - startedAt) / 60_000));
    const ticket = await transitionOffice(
      tx,
      ticketId,
      ['IN_SERVICE', 'CHECKED_IN'],
      'COMPLETED',
      { completed_at: new Date(), service_minutes: serviceMinutes, notes: notes ?? preview.notes },
      'service.completed',
      actorId,
    );
    await notify(tx, {
      userId: ticket.student_id,
      type: 'office.completed',
      title: 'Service completed',
      body: `Your visit to ${preview.office.name} is complete. Thank you.`,
      data: { ticket_id: ticket.id, office_id: ticket.office_id },
    });
    emitToOffice(ticket.office_id, 'office.completed', { ticket_number: ticket.ticket_number });
    emitToUser(ticket.student_id, 'office.completed', { ticket_id: ticket.id });
    emitToStaff('office.changed', { office_id: ticket.office_id, counts: await officeCounts(tx, ticket.office_id) });
    emitToAdmins('office.changed', { office_id: ticket.office_id });
    return ticket;
  });
}

export async function markOfficeNoShow(db: Db, actorId: string, ticketId: string, reason?: string): Promise<OfficeTicketRow> {
  return db.tx(async (tx) => {
    const preview = await getOfficeTicket(tx, ticketId);
    const ticket = await transitionOffice(
      tx,
      ticketId,
      ['CALLED', 'CHECK_IN_WINDOW', 'APPROACHING', 'WAITING', 'REQUESTED', 'TICKET_ASSIGNED'],
      'NO_SHOW',
      { no_show_at: new Date() },
      'ticket.no_show',
      actorId,
    );
    const mapping = await renumberOfficeLine(tx, ticket.office_id);
    await notify(tx, {
      userId: ticket.student_id,
      type: 'office.no_show',
      title: `Ticket ${ticket.ticket_number} marked as missed`,
      body: reason ?? `You did not appear for your appointment at ${preview.office.name}. Request a new ticket when you are ready.`,
      data: { ticket_id: ticket.id, office_id: ticket.office_id },
      priority: 'high',
    });
    emitToOffice(ticket.office_id, 'office.no_show', { ticket_number: ticket.ticket_number, positions: Object.fromEntries(mapping) });
    emitToStaff('office.changed', { office_id: ticket.office_id, counts: await officeCounts(tx, ticket.office_id) });
    return ticket;
  });
}

export async function markOfficeApproaching(db: Db, userId: string, ticketId: string): Promise<OfficeTicketRow> {
  const preview = await getOfficeTicket(db, ticketId);
  if (preview.student_id !== userId) throw ApiError.forbidden('You can only update your own ticket.');
  return transitionOffice(db, ticketId, ['WAITING', 'REQUESTED', 'TICKET_ASSIGNED'], 'APPROACHING', {}, 'ticket.approaching', userId);
}

export async function officeTicketHistory(db: Db, studentId: string, limit = 20): Promise<OfficeTicketRow[]> {
  return db.query<OfficeTicketRow>(
    `SELECT t.*, o.name AS office_name FROM office_tickets t
       JOIN administrative_offices o ON o.id = t.office_id
      WHERE t.student_id = $1
      ORDER BY t.requested_at DESC LIMIT $2`,
    [studentId, limit],
  );
}

export async function officeTicketLine(db: Db, officeId: string): Promise<OfficeTicketRow[]> {
  return db.query<OfficeTicketRow>(
    `SELECT t.*, u.name AS student_name, u.registration_no AS student_registration_no, u.email AS student_email
       FROM office_tickets t JOIN users u ON u.id = t.student_id
      WHERE t.office_id = $1
        AND t.status IN (${inList([...OFFICE_LINE_STATUSES, 'CHECKED_IN', 'IN_SERVICE'])})
      ORDER BY CASE WHEN t.status IN ('IN_SERVICE', 'CHECKED_IN') THEN 0 ELSE 1 END, t.position`,
    [officeId],
  );
}

/** Sweep expired office tickets, mirroring the room-queue scheduler. */
export async function sweepOfficeTickets(db: Db): Promise<number> {
  const overdue = await db.query<OfficeTicketRow & { office_name: string }>(
    `SELECT t.*, o.name AS office_name FROM office_tickets t
       JOIN administrative_offices o ON o.id = t.office_id
      WHERE t.status IN ('CALLED', 'CHECK_IN_WINDOW', 'APPROACHING')
        AND t.check_in_deadline IS NOT NULL
        AND t.check_in_deadline + make_interval(secs => o.grace_period_seconds::int) < now()`,
  );

  for (const ticket of overdue) {
    await db.tx(async (tx) => {
      await tx.query('SELECT id FROM administrative_offices WHERE id = $1 FOR UPDATE', [ticket.office_id]);
      await transitionOffice(tx, ticket.id, ['CALLED', 'CHECK_IN_WINDOW', 'APPROACHING'], 'EXPIRED', { expired_at: new Date() }, 'ticket.expired', null);
      const mapping = await renumberOfficeLine(tx, ticket.office_id);
      await notify(tx, {
        userId: ticket.student_id,
        type: 'office.ticket_expired',
        title: `Ticket ${ticket.ticket_number} expired`,
        body: `You did not check in at ${ticket.office_name} in time. Request a new ticket when you are available.`,
        data: { ticket_id: ticket.id, office_id: ticket.office_id },
        priority: 'high',
      });
      emitToOffice(ticket.office_id, 'office.ticket_expired', {
        ticket_number: ticket.ticket_number,
        positions: Object.fromEntries(mapping),
      });
      emitToUser(ticket.student_id, 'office.ticket_expired', { ticket_id: ticket.id });
    });
  }

  return overdue.length;
}

/** Staff board: every office the actor may operate, with live queue state. */
export async function officeStaffBoard(db: Db, officeIds: string[] = []): Promise<unknown[]> {
  const rows = await db.query<Record<string, unknown>>(
    `SELECT o.id AS office_id, o.name, o.code, o.ticket_prefix, o.concurrent_capacity,
            o.service_duration_minutes, o.check_in_radius_m, o.is_active,
            b.code AS building_code, f.name AS floor_name, r.code AS room_code,
            (SELECT count(*)::int FROM office_tickets t
              WHERE t.office_id = o.id AND t.status IN ('REQUESTED','TICKET_ASSIGNED','WAITING','APPROACHING')) AS waiting,
            (SELECT count(*)::int FROM office_tickets t
              WHERE t.office_id = o.id AND t.status IN ('CHECKED_IN','IN_SERVICE')) AS in_service,
            (SELECT count(*)::int FROM office_tickets t
              WHERE t.office_id = o.id AND t.status = 'COMPLETED' AND t.completed_at::date = CURRENT_DATE) AS completed_today,
            (SELECT json_build_object(
                      'ticket_id', t.id, 'ticket_number', t.ticket_number, 'status', t.status,
                      'position', t.position, 'subject', t.subject, 'student_name', u.name,
                      'student_registration_no', u.registration_no, 'requested_at', t.requested_at,
                      'check_in_deadline', t.check_in_deadline, 'service_started_at', t.service_started_at)
               FROM office_tickets t JOIN users u ON u.id = t.student_id
              WHERE t.office_id = o.id AND t.status IN ('IN_SERVICE','CHECKED_IN','CALLED','CHECK_IN_WINDOW','APPROACHING')
              ORDER BY CASE WHEN t.status = 'IN_SERVICE' THEN 0 WHEN t.status = 'CHECKED_IN' THEN 1 ELSE 2 END, t.position
              LIMIT 1) AS current
       FROM administrative_offices o
       JOIN buildings b ON b.id = o.building_id
       JOIN floors f ON f.id = o.floor_id
       LEFT JOIN rooms r ON r.id = o.room_id
      ${officeIds.length ? 'WHERE o.id = ANY($1::uuid[])' : ''}
      ORDER BY o.name`,
    officeIds.length ? [officeIds] : [],
  );
  return rows;
}
