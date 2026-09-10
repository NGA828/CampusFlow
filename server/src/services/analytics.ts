import type { Db } from '../db/client.js';
import { campusParts } from '../lib/clock.js';

/**
 * Analytics (PROMPT §84). Every figure below is an aggregate over live rows — there are no
 * sample series and no fabricated charts. Where a metric would be meaningless with no data
 * (for example average wait time before any ticket has been called) the API returns null
 * so the UI can show an honest empty state.
 */

export interface AnalyticsOverview {
  generated_at: string;
  users: { students: number; staff: number; admins: number; total: number; active_7d: number };
  campus: { buildings: number; floors: number; rooms: number; total_capacity: number; qr_nodes: number; navigation_nodes: number; navigation_edges: number };
  queues: {
    configured: number;
    active: number;
    waiting_now: number;
    issued_today: number;
    issued_7d: number;
    called_today: number;
    average_wait_minutes: number | null;
    average_service_minutes: number | null;
    no_show_rate_7d: number | null;
    busiest_rooms: { room_id: string; room_code: string; room_name: string; building_code: string; tickets: number }[];
    hourly_volume: { hour: string; tickets: number }[];
  };
  offices: {
    configured: number;
    open_now: number;
    issued_today: number;
    completed_today: number;
    waiting_now: number;
    average_service_minutes: number | null;
    average_wait_minutes: number | null;
    no_show_rate_7d: number | null;
    busiest: { office_id: string; name: string; tickets: number; completed: number; avg_service_minutes: number | null }[];
  };
  navigation: {
    sessions_today: number;
    sessions_7d: number;
    completion_rate_7d: number | null;
    off_route_events_7d: number;
    recalculations_7d: number;
    average_distance_m: number | null;
    popular_destinations: { label: string; count: number }[];
  };
  engagement: { events_upcoming: number; announcements_active: number; notifications_7d: number };
  utilisation: { room_id: string; room_code: string; room_name: string; building_code: string; booked_hours: number; utilisation: number }[];
}

const num = (value: unknown): number => Number(value ?? 0);
const nullable = (value: unknown): number | null => (value === null || value === undefined ? null : Math.round(Number(value) * 10) / 10);

export async function analyticsOverview(db: Db): Promise<AnalyticsOverview> {
  const now = campusParts();

  const users = await db.one<Record<string, string>>(
    `SELECT
        count(*) FILTER (WHERE role_code = 'student')::text AS students,
        count(*) FILTER (WHERE role_code = 'staff')::text AS staff,
        count(*) FILTER (WHERE role_code = 'admin')::text AS admins,
        count(*)::text AS total,
        count(*) FILTER (WHERE last_login_at > now() - interval '7 days')::text AS active_7d
       FROM users WHERE status = 'active'`,
  );

  const campus = await db.one<Record<string, string>>(
    `SELECT
        (SELECT count(*) FROM buildings)::text AS buildings,
        (SELECT count(*) FROM floors)::text AS floors,
        (SELECT count(*) FROM rooms)::text AS rooms,
        (SELECT coalesce(sum(capacity), 0) FROM rooms)::text AS total_capacity,
        (SELECT count(*) FROM qr_nodes)::text AS qr_nodes,
        (SELECT count(*) FROM navigation_nodes WHERE is_active)::text AS navigation_nodes,
        (SELECT count(*) FROM navigation_edges WHERE is_active)::text AS navigation_edges`,
  );

  const queues = await db.one<Record<string, string | null>>(
    `SELECT
        (SELECT count(*) FROM room_queues)::text AS configured,
        (SELECT count(*) FROM room_queues WHERE is_active)::text AS active,
        (SELECT count(*) FROM queue_tickets WHERE status IN ('QUEUE_PENDING','WAITING'))::text AS waiting_now,
        (SELECT count(*) FROM queue_tickets WHERE issued_at::date = CURRENT_DATE)::text AS issued_today,
        (SELECT count(*) FROM queue_tickets WHERE issued_at > now() - interval '7 days')::text AS issued_7d,
        (SELECT count(*) FROM queue_tickets WHERE called_at::date = CURRENT_DATE)::text AS called_today,
        (SELECT avg(extract(epoch FROM (called_at - issued_at)) / 60) FROM queue_tickets
          WHERE called_at IS NOT NULL AND called_at > now() - interval '7 days')::text AS average_wait_minutes,
        (SELECT avg(extract(epoch FROM (completed_at - checked_in_at)) / 60) FROM queue_tickets
          WHERE status = 'COMPLETED' AND completed_at IS NOT NULL AND checked_in_at IS NOT NULL
            AND completed_at > now() - interval '7 days')::text AS average_service_minutes,
        (SELECT CASE WHEN count(*) FILTER (WHERE status IN ('NO_SHOW','EXPIRED')) = 0 THEN NULL
                     ELSE round(100.0 * count(*) FILTER (WHERE status IN ('NO_SHOW','EXPIRED')) /
                                nullif(count(*) FILTER (WHERE called_at IS NOT NULL), 0), 1) END
           FROM queue_tickets WHERE issued_at > now() - interval '7 days')::text AS no_show_rate_7d`,
  );

  const busiestRooms = await db.query<{ room_id: string; room_code: string; room_name: string; building_code: string; tickets: string }>(
    `SELECT r.id AS room_id, r.code AS room_code, r.name AS room_name, b.code AS building_code, count(t.id)::text AS tickets
       FROM queue_tickets t
       JOIN rooms r ON r.id = t.room_id
       JOIN buildings b ON b.id = r.building_id
      WHERE t.issued_at > now() - interval '7 days'
      GROUP BY r.id, r.code, r.name, b.code
      ORDER BY count(t.id) DESC LIMIT 6`,
  );

  const hourly = await db.query<{ hour: string; tickets: string }>(
    `SELECT to_char(date_trunc('hour', issued_at), 'HH24:00') AS hour, count(*)::text AS tickets
       FROM queue_tickets
      WHERE issued_at > now() - interval '7 days'
      GROUP BY date_trunc('hour', issued_at)
      ORDER BY date_trunc('hour', issued_at)`,
  );

  // Volume by hour-of-day across the last seven days reads better than 168 raw buckets.
  const hourlyByHour = new Map<string, number>();
  for (const row of hourly) {
    hourlyByHour.set(row.hour, (hourlyByHour.get(row.hour) ?? 0) + num(row.tickets));
  }

  const officesRow = await db.one<Record<string, string | null>>(
    `SELECT
        (SELECT count(*) FROM administrative_offices)::text AS configured,
        (SELECT count(*) FROM administrative_offices WHERE is_active)::text AS open_now,
        (SELECT count(*) FROM office_tickets WHERE requested_at::date = CURRENT_DATE)::text AS issued_today,
        (SELECT count(*) FROM office_tickets WHERE status = 'COMPLETED' AND completed_at::date = CURRENT_DATE)::text AS completed_today,
        (SELECT count(*) FROM office_tickets WHERE status IN ('REQUESTED','TICKET_ASSIGNED','WAITING','APPROACHING','CALLED','CHECK_IN_WINDOW'))::text AS waiting_now,
        (SELECT avg(service_minutes) FROM office_tickets WHERE status = 'COMPLETED' AND service_minutes IS NOT NULL
           AND completed_at > now() - interval '30 days')::text AS average_service_minutes,
        (SELECT avg(extract(epoch FROM (called_at - requested_at)) / 60) FROM office_tickets
           WHERE called_at IS NOT NULL AND called_at > now() - interval '7 days')::text AS average_wait_minutes,
        (SELECT CASE WHEN count(*) FILTER (WHERE status IN ('NO_SHOW','EXPIRED')) = 0 THEN NULL
                     ELSE round(100.0 * count(*) FILTER (WHERE status IN ('NO_SHOW','EXPIRED')) /
                                nullif(count(*) FILTER (WHERE called_at IS NOT NULL), 0), 1) END
           FROM office_tickets WHERE requested_at > now() - interval '7 days')::text AS no_show_rate_7d`,
  );

  const busiestOffices = await db.query<{ office_id: string; name: string; tickets: string; completed: string; avg_service_minutes: string | null }>(
    `SELECT o.id AS office_id, o.name,
            count(t.id)::text AS tickets,
            count(t.id) FILTER (WHERE t.status = 'COMPLETED')::text AS completed,
            avg(t.service_minutes)::text AS avg_service_minutes
       FROM administrative_offices o
       LEFT JOIN office_tickets t ON t.office_id = o.id AND t.requested_at > now() - interval '7 days'
      GROUP BY o.id, o.name
      ORDER BY count(t.id) DESC LIMIT 6`,
  );

  const navigation = await db.one<Record<string, string | null>>(
    `SELECT
        (SELECT count(*) FROM navigation_sessions WHERE started_at::date = CURRENT_DATE)::text AS sessions_today,
        (SELECT count(*) FROM navigation_sessions WHERE started_at > now() - interval '7 days')::text AS sessions_7d,
        (SELECT CASE WHEN count(*) = 0 THEN NULL
                     ELSE round(100.0 * count(*) FILTER (WHERE status IN ('arrived','completed')) / count(*), 1) END
           FROM navigation_sessions WHERE started_at > now() - interval '7 days')::text AS completion_rate_7d,
        (SELECT count(*) FROM navigation_events WHERE type = 'off_route' AND created_at > now() - interval '7 days')::text AS off_route_events_7d,
        (SELECT count(*) FROM navigation_events WHERE type = 'recalculated' AND created_at > now() - interval '7 days')::text AS recalculations_7d,
        (SELECT avg(distance_m) FROM navigation_sessions WHERE started_at > now() - interval '7 days')::text AS average_distance_m`,
  );

  const destinations = await db.query<{ label: string; count: string }>(
    `SELECT destination_label AS label, count(*)::text AS count
       FROM navigation_sessions
      WHERE started_at > now() - interval '30 days'
      GROUP BY destination_label ORDER BY count(*) DESC LIMIT 6`,
  );

  const engagement = await db.one<Record<string, string>>(
    `SELECT
        (SELECT count(*) FROM events WHERE starts_at > now())::text AS events_upcoming,
        (SELECT count(*) FROM announcements WHERE published_at <= now()
           AND (expires_at IS NULL OR expires_at > now()))::text AS announcements_active,
        (SELECT count(*) FROM notifications WHERE created_at > now() - interval '7 days')::text AS notifications_7d`,
  );

  // Utilisation compares timetabled hours against the opening window for the current day.
  const utilisation = await db.query<{ room_id: string; room_code: string; room_name: string; building_code: string; booked_hours: string }>(
    `SELECT r.id AS room_id, r.code AS room_code, r.name AS room_name, b.code AS building_code,
            coalesce(sum(extract(epoch FROM (t.ends_at - t.starts_at)) / 3600), 0)::text AS booked_hours
       FROM rooms r
       JOIN buildings b ON b.id = r.building_id
       LEFT JOIN timetable_entries t ON t.room_id = r.id AND t.day_of_week = $1
      GROUP BY r.id, r.code, r.name, b.code
      HAVING coalesce(sum(extract(epoch FROM (t.ends_at - t.starts_at)) / 3600), 0) > 0
      ORDER BY coalesce(sum(extract(epoch FROM (t.ends_at - t.starts_at)) / 3600), 0) DESC
      LIMIT 8`,
    [now.dayOfWeek],
  );

  const openHours = 12; // 08:00–20:00 default teaching window

  return {
    generated_at: new Date().toISOString(),
    users: {
      students: num(users?.students),
      staff: num(users?.staff),
      admins: num(users?.admins),
      total: num(users?.total),
      active_7d: num(users?.active_7d),
    },
    campus: {
      buildings: num(campus?.buildings),
      floors: num(campus?.floors),
      rooms: num(campus?.rooms),
      total_capacity: num(campus?.total_capacity),
      qr_nodes: num(campus?.qr_nodes),
      navigation_nodes: num(campus?.navigation_nodes),
      navigation_edges: num(campus?.navigation_edges),
    },
    queues: {
      configured: num(queues?.configured),
      active: num(queues?.active),
      waiting_now: num(queues?.waiting_now),
      issued_today: num(queues?.issued_today),
      issued_7d: num(queues?.issued_7d),
      called_today: num(queues?.called_today),
      average_wait_minutes: nullable(queues?.average_wait_minutes),
      average_service_minutes: nullable(queues?.average_service_minutes),
      no_show_rate_7d: nullable(queues?.no_show_rate_7d),
      busiest_rooms: busiestRooms.map((row) => ({
        room_id: row.room_id,
        room_code: row.room_code,
        room_name: row.room_name,
        building_code: row.building_code,
        tickets: num(row.tickets),
      })),
      hourly_volume: [...hourlyByHour.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([hour, tickets]) => ({ hour, tickets })),
    },
    offices: {
      configured: num(officesRow?.configured),
      open_now: num(officesRow?.open_now),
      issued_today: num(officesRow?.issued_today),
      completed_today: num(officesRow?.completed_today),
      waiting_now: num(officesRow?.waiting_now),
      average_service_minutes: nullable(officesRow?.average_service_minutes),
      average_wait_minutes: nullable(officesRow?.average_wait_minutes),
      no_show_rate_7d: nullable(officesRow?.no_show_rate_7d),
      busiest: busiestOffices.map((row) => ({
        office_id: row.office_id,
        name: row.name,
        tickets: num(row.tickets),
        completed: num(row.completed),
        avg_service_minutes: nullable(row.avg_service_minutes),
      })),
    },
    navigation: {
      sessions_today: num(navigation?.sessions_today),
      sessions_7d: num(navigation?.sessions_7d),
      completion_rate_7d: nullable(navigation?.completion_rate_7d),
      off_route_events_7d: num(navigation?.off_route_events_7d),
      recalculations_7d: num(navigation?.recalculations_7d),
      average_distance_m: nullable(navigation?.average_distance_m),
      popular_destinations: destinations.map((row) => ({ label: row.label, count: num(row.count) })),
    },
    engagement: {
      events_upcoming: num(engagement?.events_upcoming),
      announcements_active: num(engagement?.announcements_active),
      notifications_7d: num(engagement?.notifications_7d),
    },
    utilisation: utilisation.map((row) => {
      const booked = Math.round(Number(row.booked_hours) * 10) / 10;
      return {
        room_id: row.room_id,
        room_code: row.room_code,
        room_name: row.room_name,
        building_code: row.building_code,
        booked_hours: booked,
        utilisation: Math.min(100, Math.round((booked / openHours) * 100)),
      };
    }),
  };
}

/** Compact KPI strip for the admin dashboard landing view. */
export async function dashboardKpis(db: Db) {
  const overview = await analyticsOverview(db);
  return {
    generated_at: overview.generated_at,
    students: overview.users.students,
    staff: overview.users.staff,
    waiting_now: overview.queues.waiting_now,
    issued_today: overview.queues.issued_today,
    office_waiting_now: overview.offices.waiting_now,
    office_completed_today: overview.offices.completed_today,
    navigation_sessions_today: overview.navigation.sessions_today,
    average_wait_minutes: overview.queues.average_wait_minutes,
    no_show_rate_7d: overview.queues.no_show_rate_7d,
    rooms: overview.campus.rooms,
    buildings: overview.campus.buildings,
  };
}
