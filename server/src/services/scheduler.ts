import type { Db } from '../db/client.js';
import { config } from '../config.js';
import { sweepExpiredTickets } from './queues.js';
import { sweepOfficeTickets } from './offices.js';
import { notify } from './notifications.js';
import { campusParts, toMinutes } from '../lib/clock.js';

/**
 * Background work (PROMPT §23, §28).
 *
 * CampusFlow keeps scheduled work in-process for a single-node deployment; the same jobs
 * are registered with the framework scheduler in the Laravel deployment
 * (docs/architecture.md). Everything here is idempotent, so running the sweep twice never
 * double-notifies a student.
 */

export interface SchedulerHandle {
  stop(): void;
  runOnce(): Promise<void>;
}

export interface SchedulerStats {
  last_ticket_sweep: string | null;
  last_reminder_sweep: string | null;
  expired_tickets: number;
  reminders_sent: number;
  ticks: number;
}

const stats: SchedulerStats = {
  last_ticket_sweep: null,
  last_reminder_sweep: null,
  expired_tickets: 0,
  reminders_sent: 0,
  ticks: 0,
};

export function schedulerStats(): SchedulerStats {
  return { ...stats };
}

export const CLASS_REMINDER_MINUTES = 15;

/**
 * Class reminders: one notification per timetable entry per student per day, fifteen
 * minutes before the session starts, using a dedupe key so repeated sweeps are safe.
 */
export async function sendClassReminders(db: Db): Promise<number> {
  const now = campusParts();
  const rows = await db.query<{
    entry_id: string;
    starts_at: string;
    course_code: string;
    course_title: string;
    room_code: string | null;
    room_name: string | null;
    building_code: string | null;
    student_id: string;
    room_id: string | null;
    minutes_until: string;
  }>(
    `SELECT t.id AS entry_id, to_char(t.starts_at, 'HH24:MI') AS starts_at,
            c.code AS course_code, c.title AS course_title,
            r.code AS room_code, r.name AS room_name, b.code AS building_code, r.id AS room_id,
            e.student_id,
            (extract(epoch FROM (t.starts_at - current_time::time)) / 60)::text AS minutes_until
       FROM timetable_entries t
       JOIN courses c ON c.id = t.course_id
       JOIN enrollments e ON e.course_id = t.course_id AND e.term_code = t.term_code AND e.status = 'enrolled'
       LEFT JOIN rooms r ON r.id = t.room_id
       LEFT JOIN buildings b ON b.id = r.building_id
      WHERE t.day_of_week = $1
        AND t.starts_at > current_time::time
        AND t.starts_at <= current_time::time + make_interval(mins => $2::int)`,
    [now.dayOfWeek, CLASS_REMINDER_MINUTES],
  );

  let sent = 0;
  for (const row of rows) {
    const minutesUntil = Math.max(1, Math.round(Number(row.minutes_until)));
    const notification = await notify(db, {
      userId: row.student_id,
      type: 'class.reminder',
      title: `${row.course_code} starts in ${minutesUntil} minutes`,
      body: `${row.course_title}${row.room_code ? ` · ${row.room_name} (${row.room_code})` : ''}${
        row.building_code ? ` · ${row.building_code}` : ''
      }`,
      data: {
        dedupe_key: `class-reminder:${row.entry_id}:${now.date}`,
        entry_id: row.entry_id,
        room_id: row.room_id,
        starts_at: `${now.date}T${row.starts_at}:00`,
        action: 'navigate',
      },
      priority: 'high',
    });
    if (notification) sent += 1;
  }
  stats.reminders_sent += sent;
  stats.last_reminder_sweep = new Date().toISOString();
  return sent;
}

/** Queue and office ticket sweeps. */
export async function sweepTickets(db: Db): Promise<{ expired: number; noShows: number; ghosts: number; office: number }> {
  const roomSweep = await sweepExpiredTickets(db);
  const officeExpired = await sweepOfficeTickets(db);
  stats.last_ticket_sweep = new Date().toISOString();
  stats.expired_tickets += roomSweep.expired + roomSweep.ghosts + officeExpired;
  stats.ticks += 1;
  return { ...roomSweep, office: officeExpired };
}

export function startScheduler(db: Db, log: (message: string) => void): SchedulerHandle {
  if (!config.scheduler.enabled) {
    log('scheduler disabled');
    return { stop() {}, async runOnce() {} };
  }

  const ticketTimer = setInterval(() => {
    void sweepTickets(db).catch((error) => log(`ticket sweep failed: ${String(error)}`));
  }, config.scheduler.ticketExpiryIntervalMs);

  const reminderTimer = setInterval(() => {
    void sendClassReminders(db)
      .then((sent) => {
        if (sent > 0) log(`sent ${sent} class reminders`);
      })
      .catch((error) => log(`reminder sweep failed: ${String(error)}`));
  }, config.scheduler.classReminderIntervalMs);

  // Run immediately once so a freshly started server is in a consistent state.
  void sweepTickets(db).catch(() => {});
  void sendClassReminders(db).catch(() => {});

  log(
    `scheduler started (ticket sweep ${config.scheduler.ticketExpiryIntervalMs}ms, reminders ${config.scheduler.classReminderIntervalMs}ms)`,
  );

  return {
    stop() {
      clearInterval(ticketTimer);
      clearInterval(reminderTimer);
    },
    async runOnce() {
      await sweepTickets(db);
      await sendClassReminders(db);
    },
  };
}

/** Warn students whose called ticket is about to expire ("approaching" reminder). */
export async function sendCheckInWarnings(db: Db): Promise<number> {
  const rows = await db.query<{ id: string; student_id: string; ticket_number: string; room_code: string; seconds_left: string }>(
    `SELECT t.id, t.student_id, t.ticket_number, r.code AS room_code,
            extract(epoch FROM (t.check_in_deadline - now()))::text AS seconds_left
       FROM queue_tickets t
       JOIN rooms r ON r.id = t.room_id
      WHERE t.status IN ('CALLED', 'CHECK_IN_WINDOW')
        AND t.check_in_deadline IS NOT NULL
        AND t.check_in_deadline BETWEEN now() AND now() + interval '90 seconds'`,
  );
  let sent = 0;
  for (const row of rows) {
    const notification = await notify(db, {
      userId: row.student_id,
      type: 'queue.check_in_warning',
      title: 'Check in now',
      body: `Your ticket ${row.ticket_number} for ${row.room_code} expires in under 90 seconds.`,
      data: { dedupe_key: `checkin-warning:${row.id}`, ticket_id: row.id },
      priority: 'urgent',
    });
    if (notification) sent += 1;
  }
  return sent;
}

export { toMinutes };
