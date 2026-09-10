import type { Db } from '../db/client.js';
import { ApiError } from '../lib/errors.js';
import { campusParts, fromMinutes, isoWeekdayFromDate, toMinutes } from '../lib/clock.js';

export interface BuildingRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  campus_name: string;
  address: string | null;
  lat: number;
  lng: number;
  footprint: [number, number][];
  has_elevator: boolean;
  is_public: boolean;
  opening_hours: Record<string, unknown>;
  status: string;
  floors_count?: number;
  rooms_count?: number;
}

export interface RoomRow {
  id: string;
  code: string;
  name: string;
  room_type: string;
  capacity: number;
  description: string | null;
  requires_admission: boolean;
  admission_policy: Record<string, unknown>;
  plan_x: number;
  plan_y: number;
  plan_w: number;
  plan_h: number;
  lat: number | null;
  lng: number | null;
  amenities: string[];
  accessibility: string[];
  status: string;
  photo_url: string | null;
  building_id: string;
  building_code: string;
  building_name: string;
  floor_id: string;
  floor_level: number;
  floor_name: string;
}

export interface BusySlot {
  room_id: string;
  starts_at: string;
  ends_at: string;
  course_code: string | null;
  course_title: string | null;
  session_type: string;
  reason: 'class' | 'queue' | 'maintenance' | 'reserved';
  lecturer: string | null;
}

export interface RoomAvailability {
  room_id: string;
  date: string;
  is_open: boolean;
  opens_at: string | null;
  closes_at: string | null;
  is_available_now: boolean;
  next_free_at: string | null;
  current_session: BusySlot | null;
  busy: BusySlot[];
  free_slots: { starts_at: string; ends_at: string }[];
  occupancy: { admitted: number; capacity: number };
  queue: { id: string | null; waiting: number; requires_proximity: boolean; is_active: boolean };
  headline: string;
}

const DEFAULT_OPEN = '08:00';
const DEFAULT_CLOSE = '20:00';

export async function listBuildings(db: Db): Promise<BuildingRow[]> {
  return db.query<BuildingRow>(
    `SELECT b.*,
            (SELECT count(*)::int FROM floors f WHERE f.building_id = b.id) AS floors_count,
            (SELECT count(*)::int FROM rooms r WHERE r.building_id = b.id) AS rooms_count
       FROM buildings b
      ORDER BY b.code`,
  );
}

export async function getBuilding(db: Db, idOrCode: string): Promise<BuildingRow> {
  const building = await db.one<BuildingRow>(
    `SELECT b.*,
            (SELECT count(*)::int FROM floors f WHERE f.building_id = b.id) AS floors_count,
            (SELECT count(*)::int FROM rooms r WHERE r.building_id = b.id) AS rooms_count
       FROM buildings b
      WHERE b.id::text = $1 OR upper(b.code) = upper($1)`,
    [idOrCode],
  );
  if (!building) throw ApiError.notFound('Building not found.');
  return building;
}

export interface FloorRow {
  id: string;
  building_id: string;
  level: number;
  name: string;
  plan_width: number;
  plan_height: number;
  plan_units: string;
  plan_image_url: string | null;
  rooms_count?: number;
}

export async function listFloors(db: Db, buildingId: string): Promise<FloorRow[]> {
  return db.query<FloorRow>(
    `SELECT f.*, (SELECT count(*)::int FROM rooms r WHERE r.floor_id = f.id) AS rooms_count
       FROM floors f WHERE f.building_id = $1 ORDER BY f.level`,
    [buildingId],
  );
}

export interface RoomSearchParams {
  q?: string;
  building_id?: string;
  floor_id?: string;
  building_code?: string;
  room_type?: string;
  min_capacity?: number;
  requires_admission?: boolean;
  available_at?: string; // HH:MM
  date?: string; // YYYY-MM-DD
  available_now?: boolean;
  page?: number;
  per_page?: number;
  limit?: number;
}

const ROOM_SELECT = `
  SELECT r.*, b.code AS building_code, b.name AS building_name,
         f.level AS floor_level, f.name AS floor_name
    FROM rooms r
    JOIN buildings b ON b.id = r.building_id
    JOIN floors f ON f.id = r.floor_id
`;

function roomFilters(params: RoomSearchParams): { where: string[]; values: unknown[] } {
  const where: string[] = ["r.status <> 'closed'"];
  const values: unknown[] = [];
  const push = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (params.q) {
    const like = `%${params.q.toLowerCase()}%`;
    where.push(`(lower(r.code) LIKE ${push(like)} OR lower(r.name) LIKE $${values.length} OR lower(b.name) LIKE $${values.length})`);
  }
  if (params.building_id) where.push(`r.building_id = ${push(params.building_id)}`);
  if (params.building_code) where.push(`upper(b.code) = upper(${push(params.building_code)})`);
  if (params.floor_id) where.push(`r.floor_id = ${push(params.floor_id)}`);
  if (params.room_type) where.push(`r.room_type = ${push(params.room_type)}`);
  if (params.min_capacity !== undefined) where.push(`r.capacity >= ${push(params.min_capacity)}`);
  if (params.requires_admission !== undefined) where.push(`r.requires_admission = ${push(params.requires_admission)}`);

  return { where, values };
}

export async function searchRooms(
  db: Db,
  params: RoomSearchParams,
): Promise<{ rooms: RoomRow[]; total: number }> {
  const { where, values } = roomFilters(params);
  const perPage = Math.min(100, params.per_page ?? params.limit ?? 20);
  const page = Math.max(1, params.page ?? 1);
  const offset = (page - 1) * perPage;

  const countRow = await db.one<{ total: string }>(
    `SELECT count(*)::text AS total FROM rooms r
       JOIN buildings b ON b.id = r.building_id
       JOIN floors f ON f.id = r.floor_id
      WHERE ${where.join(' AND ')}`,
    values,
  );

  const rooms = await db.query<RoomRow>(
    `${ROOM_SELECT}
      WHERE ${where.join(' AND ')}
      ORDER BY b.code, f.level, r.code
      LIMIT ${perPage} OFFSET ${offset}`,
    values,
  );

  return { rooms, total: Number(countRow?.total ?? 0) };
}

export async function getRoom(db: Db, idOrCode: string): Promise<RoomRow> {
  const room = await db.one<RoomRow>(
    `${ROOM_SELECT} WHERE r.id::text = $1 OR lower(r.code) = lower($1) ORDER BY b.code LIMIT 1`,
    [idOrCode],
  );
  if (!room) throw ApiError.notFound('Room not found.');
  return room;
}

/**
 * Availability engine (PROMPT §18).
 *
 * A room is never described by a manually edited boolean: availability is derived from
 * the master timetable, the weekly opening rules, live admission state and maintenance
 * status. Everything below is computed from authoritative rows.
 */
export async function getRoomAvailability(
  db: Db,
  roomId: string,
  options: { date?: string; fromTime?: string } = {},
): Promise<RoomAvailability> {
  const room = await db.one<RoomRow>(`${ROOM_SELECT} WHERE r.id = $1`, [roomId]);
  if (!room) throw ApiError.notFound('Room not found.');

  const date = options.date ?? campusParts().date;
  const dayOfWeek = isoWeekdayFromDate(date);

  const busy = await db.query<BusySlot>(
    `SELECT r.id AS room_id,
            to_char(t.starts_at, 'HH24:MI') AS starts_at,
            to_char(t.ends_at, 'HH24:MI') AS ends_at,
            c.code AS course_code, c.title AS course_title, t.session_type,
            'class' AS reason, lecturer.name AS lecturer
       FROM timetable_entries t
       JOIN rooms r ON r.id = t.room_id
       JOIN courses c ON c.id = t.course_id
       LEFT JOIN users lecturer ON lecturer.id = t.staff_id
      WHERE t.room_id = $1 AND t.day_of_week = $2
      ORDER BY t.starts_at`,
    [roomId, dayOfWeek],
  );

  const rules = await db.query<{ opens_at: string; closes_at: string; kind: string; notes: string | null }>(
    `SELECT to_char(opens_at, 'HH24:MI') AS opens_at, to_char(closes_at, 'HH24:MI') AS closes_at, kind, notes
       FROM room_availability_rules
      WHERE room_id = $1 AND day_of_week = $2 AND kind <> 'closed'
      ORDER BY opens_at`,
    [roomId, dayOfWeek],
  );

  const occupancyRow = await db.one<{ admitted: string }>(
    `SELECT count(*)::text AS admitted FROM queue_tickets
      WHERE room_id = $1 AND status IN ('CHECKED_IN', 'ADMITTED')`,
    [roomId],
  );

  const queueRow = await db.one<{
    id: string;
    waiting: string;
    requires_proximity_to_join: boolean;
    is_active: boolean;
  }>(
    `SELECT q.id, q.requires_proximity_to_join, q.is_active,
            (SELECT count(*)::text FROM queue_tickets t
              WHERE t.queue_id = q.id AND t.status IN ('QUEUE_PENDING','WAITING')) AS waiting
       FROM room_queues q WHERE q.room_id = $1`,
    [roomId],
  );

  const opensAt = rules.length ? rules[0]!.opens_at : DEFAULT_OPEN;
  const closesAt = rules.length ? rules[rules.length - 1]!.closes_at : DEFAULT_CLOSE;
  const now = campusParts();
  const referenceMinutes = options.fromTime ? toMinutes(options.fromTime) : now.minutes;
  const isSameDay = date === now.date;

  const busyRanges = busy.map((slot) => ({ start: toMinutes(slot.starts_at), end: toMinutes(slot.ends_at) }));
  const openMinutes = toMinutes(opensAt);
  const closeMinutes = toMinutes(closesAt);

  const freeSlots: { starts_at: string; ends_at: string }[] = [];
  let cursor = openMinutes;
  for (const range of busyRanges) {
    if (range.start > cursor) freeSlots.push({ starts_at: fromMinutes(cursor), ends_at: fromMinutes(range.start) });
    cursor = Math.max(cursor, range.end);
  }
  if (cursor < closeMinutes) freeSlots.push({ starts_at: fromMinutes(cursor), ends_at: fromMinutes(closeMinutes) });

  const currentSession = isSameDay
    ? busy.find((slot) => toMinutes(slot.starts_at) <= referenceMinutes && toMinutes(slot.ends_at) > referenceMinutes) ?? null
    : null;

  const nextFree = isSameDay
    ? freeSlots.find((slot) => toMinutes(slot.starts_at) <= referenceMinutes && toMinutes(slot.ends_at) > referenceMinutes)?.starts_at ??
      freeSlots.find((slot) => toMinutes(slot.starts_at) > referenceMinutes)?.starts_at ??
      null
    : freeSlots[0]?.starts_at ?? null;

  const isWithinOpening = isSameDay
    ? referenceMinutes >= openMinutes && referenceMinutes < closeMinutes && rules.length > 0
    : true;
  const isOpen = room.status !== 'closed' && room.status !== 'maintenance' && isWithinOpening;

  // Occupancy from the queue engine: admission-controlled rooms report live occupancy,
  // while rooms where the timetable is the only authority report its remaining capacity.
  const inUseNow = Boolean(currentSession) || (room.requires_admission && Number(occupancyRow?.admitted ?? 0) >= room.capacity);
  const isAvailableNow = isOpen && !inUseNow && room.status === 'available';

  const headline = !isOpen
    ? room.status === 'maintenance'
      ? 'Closed for maintenance'
      : `Closed today · opens ${opensAt}`
    : currentSession
      ? `${currentSession.course_code ?? 'Class'} until ${currentSession.ends_at}`
      : room.requires_admission && Number(queueRow?.waiting ?? 0) > 0
        ? `Available · ${queueRow?.waiting} in admission queue`
        : nextFree && toMinutes(nextFree) > referenceMinutes
          ? `Free from ${nextFree}`
          : 'Available now';

  return {
    room_id: room.id,
    date,
    is_open: isOpen,
    opens_at: rules.length ? opensAt : DEFAULT_OPEN,
    closes_at: rules.length ? closesAt : DEFAULT_CLOSE,
    is_available_now: isAvailableNow,
    next_free_at: isAvailableNow ? null : nextFree,
    current_session: currentSession,
    busy,
    free_slots: freeSlots,
    occupancy: { admitted: Number(occupancyRow?.admitted ?? 0), capacity: room.capacity },
    queue: {
      id: queueRow?.id ?? null,
      waiting: Number(queueRow?.waiting ?? 0),
      requires_proximity: queueRow?.requires_proximity_to_join ?? false,
      is_active: queueRow?.is_active ?? false,
    },
    headline,
  };
}

/** Availability for every room on a floor — one query, no N+1. */
export async function floorAvailability(db: Db, floorId: string, date?: string): Promise<Map<string, BusySlot[]>> {
  const targetDate = date ?? campusParts().date;
  const dayOfWeek = isoWeekdayFromDate(targetDate);
  const rows = await db.query<BusySlot>(
    `SELECT t.room_id,
            to_char(t.starts_at, 'HH24:MI') AS starts_at,
            to_char(t.ends_at, 'HH24:MI') AS ends_at,
            c.code AS course_code, c.title AS course_title, t.session_type,
            'class' AS reason, lecturer.name AS lecturer
       FROM timetable_entries t
       JOIN courses c ON c.id = t.course_id
       LEFT JOIN users lecturer ON lecturer.id = t.staff_id
      WHERE t.room_id IN (SELECT id FROM rooms WHERE floor_id = $1)
        AND t.day_of_week = $2
      ORDER BY t.starts_at`,
    [floorId, dayOfWeek],
  );
  const map = new Map<string, BusySlot[]>();
  for (const row of rows) {
    map.set(row.room_id, [...(map.get(row.room_id) ?? []), row]);
  }
  return map;
}

export interface FloorPlanPayload {
  floor: FloorRow;
  building: Pick<BuildingRow, 'id' | 'code' | 'name' | 'lat' | 'lng' | 'has_elevator' | 'status' | 'is_public'>;
  rooms: RoomRow[];
  qr_nodes: {
    id: string;
    code: string;
    label: string;
    plan_x: number;
    plan_y: number;
    floor_id: string;
    room_id: string | null;
    is_active: boolean;
    scans_count: number;
    last_scanned_at: string | null;
  }[];
  navigation_nodes: {
    id: string;
    code: string;
    label: string;
    kind: string;
    plan_x: number | null;
    plan_y: number | null;
    is_accessible: boolean;
    is_active: boolean;
  }[];
  navigation_edges: {
    id: string;
    from_node_id: string;
    to_node_id: string;
    kind: string;
    distance_m: number;
    is_accessible: boolean;
    is_active: boolean;
    floor_change: boolean;
  }[];
  geofences: {
    id: string;
    name: string;
    target_type: string;
    target_id: string;
    radius_m: number;
    purpose: string;
    is_active: boolean;
  }[];
  busy: BusySlot[];
}

export async function getFloorPlan(db: Db, floorId: string, date?: string): Promise<FloorPlanPayload> {
  const floor = await db.one<FloorRow>('SELECT * FROM floors WHERE id = $1', [floorId]);
  if (!floor) throw ApiError.notFound('Floor not found.');
  const building = await getBuilding(db, floor.building_id);

  const rooms = await db.query<RoomRow>(`${ROOM_SELECT} WHERE r.floor_id = $1 ORDER BY r.code`, [floorId]);
  const qrNodes = await db.query<FloorPlanPayload['qr_nodes'][number]>(
    `SELECT id, code, label, plan_x, plan_y, floor_id, room_id, is_active, scans_count, last_scanned_at
       FROM qr_nodes WHERE floor_id = $1 ORDER BY code`,
    [floorId],
  );
  const nodes = await db.query<FloorPlanPayload['navigation_nodes'][number]>(
    `SELECT id, code, label, kind, plan_x, plan_y, is_accessible, is_active
       FROM navigation_nodes WHERE floor_id = $1 AND is_active ORDER BY code`,
    [floorId],
  );
  const edges = await db.query<FloorPlanPayload['navigation_edges'][number]>(
    `SELECT e.id, e.from_node_id, e.to_node_id, e.kind, e.distance_m, e.is_accessible, e.is_active, e.floor_change
       FROM navigation_edges e
       JOIN navigation_nodes n ON n.id = e.from_node_id
      WHERE n.floor_id = $1 AND e.is_active`,
    [floorId],
  );
  const geofences = await db.query<FloorPlanPayload['geofences'][number]>(
    `SELECT g.id, g.name, g.target_type, g.target_id, g.radius_m, g.purpose, g.is_active
       FROM geofences g
      WHERE g.is_active AND (
        (g.target_type = 'room' AND g.target_id IN (SELECT id FROM rooms WHERE floor_id = $1)) OR
        (g.target_type = 'qr_node' AND g.target_id IN (SELECT id FROM qr_nodes WHERE floor_id = $1))
      )`,
    [floorId],
  );

  const busyMap = await floorAvailability(db, floorId, date);

  return {
    floor,
    building: {
      id: building.id,
      code: building.code,
      name: building.name,
      lat: building.lat,
      lng: building.lng,
      has_elevator: building.has_elevator,
      status: building.status,
      is_public: building.is_public,
    },
    rooms,
    qr_nodes: qrNodes,
    navigation_nodes: nodes,
    navigation_edges: edges,
    geofences,
    busy: [...busyMap.values()].flat(),
  };
}
