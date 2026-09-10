import type { Db } from '../db/client.js';
import { ApiError } from '../lib/errors.js';
import { addDays, campusParts, fromMinutes, isoWeekdayFromDate, startOfWeek, toMinutes, weekDates } from '../lib/clock.js';

/**
 * Personalised timetable (PROMPT §12).
 *
 * The student's timetable is derived — never stored per student. Enrolments are joined to
 * the master timetable entries published by staff, so a room change made by a department
 * is immediately visible to every enrolled student, and a student can never be shown a
 * class they are not enrolled in.
 */

export interface TimetableEntryView {
  id: string;
  course_id: string;
  course_code: string;
  course_title: string;
  course_colour: string;
  department: string;
  session_type: string;
  day_of_week: number;
  date: string | null;
  starts_at: string;
  ends_at: string;
  starts_at_iso: string | null;
  ends_at_iso: string | null;
  room_id: string | null;
  room_code: string | null;
  room_name: string | null;
  building_id: string | null;
  building_code: string | null;
  building_name: string | null;
  floor_id: string | null;
  floor_name: string | null;
  floor_level: number | null;
  lecturer: string | null;
  note: string | null;
  is_now: boolean;
  is_next: boolean;
  minutes_until: number | null;
}

const ENTRY_SELECT = `
  SELECT t.id, t.course_id, t.day_of_week, t.session_type, t.notes AS note,
         to_char(t.starts_at, 'HH24:MI') AS starts_at,
         to_char(t.ends_at, 'HH24:MI') AS ends_at,
         c.code AS course_code, c.title AS course_title, c.colour AS course_colour, c.department,
         r.id AS room_id, r.code AS room_code, r.name AS room_name,
         b.id AS building_id, b.code AS building_code, b.name AS building_name,
         f.id AS floor_id, f.name AS floor_name, f.level AS floor_level,
         lecturer.name AS lecturer
    FROM timetable_entries t
    JOIN courses c ON c.id = t.course_id
    LEFT JOIN rooms r ON r.id = t.room_id
    LEFT JOIN buildings b ON b.id = r.building_id
    LEFT JOIN floors f ON f.id = r.floor_id
    LEFT JOIN users lecturer ON lecturer.id = t.staff_id
`;

export interface TimetableQuery {
  term?: string;
  week?: string; // ISO date inside the desired week
  date?: string;
  courseId?: string;
}

async function currentTerm(db: Db): Promise<string> {
  const row = await db.one<{ code: string }>('SELECT code FROM terms WHERE is_current ORDER BY starts_on DESC LIMIT 1');
  if (row) return row.code;
  const fallback = await db.one<{ code: string }>('SELECT code FROM terms ORDER BY starts_on DESC LIMIT 1');
  if (!fallback) throw ApiError.unavailable('No academic term has been configured yet.');
  return fallback.code;
}

export async function studentTimetable(
  db: Db,
  studentId: string,
  query: TimetableQuery = {},
): Promise<{ term: string; week_start: string; dates: string[]; entries: TimetableEntryView[]; today: TimetableEntryView[]; next: TimetableEntryView | null }> {
  const term = query.term ?? (await currentTerm(db));
  const now = campusParts();
  const weekStart = startOfWeek(query.week ?? now.date);
  const dates = weekDates(weekStart);
  const dateSet = new Set(dates);

  const rows = await db.query<Omit<TimetableEntryView, 'date' | 'starts_at_iso' | 'ends_at_iso' | 'is_now' | 'is_next' | 'minutes_until'>>(
    `${ENTRY_SELECT}
      JOIN enrollments e ON e.course_id = t.course_id AND e.term_code = t.term_code
      WHERE e.student_id = $1 AND t.term_code = $2 AND e.status IN ('enrolled', 'completed')`,
    [studentId, term],
  );

  const dayCounters = new Map<number, number>();
  const entries: TimetableEntryView[] = rows.map((row) => {
    const index = dayCounters.get(row.day_of_week) ?? 0;
    dayCounters.set(row.day_of_week, index + 1);
    const date = dates[row.day_of_week - 1] ?? null;
    return {
      ...row,
      date,
      starts_at_iso: date ? `${date}T${row.starts_at}:00` : null,
      ends_at_iso: date ? `${date}T${row.ends_at}:00` : null,
      is_now: false,
      is_next: false,
      minutes_until: null,
    } satisfies TimetableEntryView;
  });

  const withFlags = entries
    .filter((entry) => !entry.date || dateSet.has(entry.date))
    .map((entry) => {
      if (!entry.date) return entry;
      const startMinutes = toMinutes(entry.starts_at);
      const endMinutes = toMinutes(entry.ends_at);
      const isNow = entry.date === now.date && now.minutes >= startMinutes && now.minutes < endMinutes;
      const minutesUntil = entry.date === now.date ? startMinutes - now.minutes : null;
      return { ...entry, is_now: isNow, minutes_until: minutesUntil };
    })
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.starts_at.localeCompare(b.starts_at));

  const today = withFlags.filter((entry) => entry.date === now.date);
  const nextCandidate =
    withFlags.find((entry) => entry.date === now.date && toMinutes(entry.starts_at) >= now.minutes) ??
    withFlags.find((entry) => (entry.date ?? '') > now.date) ??
    null;

  const next = nextCandidate ? { ...nextCandidate, is_next: true } : null;
  const finalEntries = withFlags.map((entry) => (next && entry.id === next.id ? { ...entry, is_next: true } : entry));

  return { term, week_start: weekStart, dates, entries: finalEntries, today: finalFlags(today), next };
}

function finalFlags(entries: TimetableEntryView[]): TimetableEntryView[] {
  return entries.map((entry) => ({
    ...entry,
    is_now: entry.is_now,
  }));
}

export async function nextClass(db: Db, studentId: string): Promise<TimetableEntryView | null> {
  const now = campusParts();
  // Look ahead through the current day and the next six days using the weekly pattern.
  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(now.date, offset);
    const dayOfWeek = isoWeekdayFromDate(date);
    const rows = await db.query<Omit<TimetableEntryView, 'date' | 'starts_at_iso' | 'ends_at_iso' | 'is_now' | 'is_next' | 'minutes_until'>>(
      `${ENTRY_SELECT}
        JOIN enrollments e ON e.course_id = t.course_id AND e.term_code = t.term_code
       WHERE e.student_id = $1 AND t.day_of_week = $2 AND e.status = 'enrolled'
         AND t.term_code = (SELECT code FROM terms WHERE is_current ORDER BY starts_on DESC LIMIT 1)
       ORDER BY t.starts_at`,
      [studentId, dayOfWeek],
    );
    const candidate = rows.find((row) => offset > 0 || toMinutes(row.starts_at) >= now.minutes);
    if (candidate) {
      return {
        ...candidate,
        date,
        starts_at_iso: `${date}T${candidate.starts_at}:00`,
        ends_at_iso: `${date}T${candidate.ends_at}:00`,
        is_now: false,
        is_next: true,
        minutes_until: offset === 0 ? toMinutes(candidate.starts_at) - now.minutes : null,
      };
    }
  }
  return null;
}

export interface TodayOverview {
  date: string;
  day_of_week: number;
  entries: TimetableEntryView[];
  next: TimetableEntryView | null;
  now_entry: TimetableEntryView | null;
  free_after: string | null;
}

export async function todayOverview(db: Db, studentId: string): Promise<TodayOverview> {
  const now = campusParts();
  const rows = await db.query<Omit<TimetableEntryView, 'date' | 'starts_at_iso' | 'ends_at_iso' | 'is_now' | 'is_next' | 'minutes_until'>>(
    `${ENTRY_SELECT}
      JOIN enrollments e ON e.course_id = t.course_id AND e.term_code = t.term_code
     WHERE e.student_id = $1 AND t.day_of_week = $2 AND e.status = 'enrolled'
       AND t.term_code = (SELECT code FROM terms WHERE is_current ORDER BY starts_on DESC LIMIT 1)
     ORDER BY t.starts_at`,
    [studentId, now.dayOfWeek],
  );

  const entries: TimetableEntryView[] = rows.map((row) => ({
    ...row,
    date: now.date,
    starts_at_iso: `${now.date}T${row.starts_at}:00`,
    ends_at_iso: `${now.date}T${row.ends_at}:00`,
    is_now: now.minutes >= toMinutes(row.starts_at) && now.minutes < toMinutes(row.ends_at),
    is_next: false,
    minutes_until: toMinutes(row.starts_at) - now.minutes,
  }));

  const next = entries.find((entry) => !entry.is_now && toMinutes(entry.starts_at) >= now.minutes) ?? null;
  const nowEntry = entries.find((entry) => entry.is_now) ?? null;
  const last = entries[entries.length - 1];
  const freeAfter = last ? last.ends_at : null;

  return {
    date: now.date,
    day_of_week: now.dayOfWeek,
    entries: entries.map((entry) => (next && entry.id === next.id ? { ...entry, is_next: true } : entry)),
    next,
    now_entry: nowEntry,
    free_after: freeAfter,
  };
}

export interface StaffTimetableQuery {
  term?: string;
  courseId?: string;
  roomId?: string;
  dayOfWeek?: number;
}

export async function staffTimetable(db: Db, staffId: string, query: StaffTimetableQuery = {}) {
  const term = query.term ?? (await currentTerm(db));
  const rows = await db.query(
    `${ENTRY_SELECT}
      WHERE t.term_code = $1
        AND (t.staff_id = $2 OR EXISTS (SELECT 1 FROM course_staff cs WHERE cs.course_id = t.course_id AND cs.user_id = $2))
        ${query.courseId ? 'AND t.course_id = $4' : ''}
        ${query.roomId ? `AND t.room_id = ${query.courseId ? '$5' : '$4'}` : ''}
        ${query.dayOfWeek ? `AND t.day_of_week = ${query.courseId && query.roomId ? '$6' : query.courseId || query.roomId ? '$5' : '$4'}` : ''}
      ORDER BY t.day_of_week, t.starts_at`,
    [term, staffId, ...(query.courseId ? [query.courseId] : []), ...(query.roomId ? [query.roomId] : []), ...(query.dayOfWeek ? [query.dayOfWeek] : [])]
      .filter(Boolean)
      .slice(0, 6),
  );
  return { term, entries: rows };
}

/** Weekly grid used by both the student and staff timetable screens. */
export function groupByDay(entries: TimetableEntryView[]): { day_of_week: number; date: string | null; entries: TimetableEntryView[] }[] {
  const days = [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
    day_of_week: dayOfWeek,
    date: entries.find((entry) => entry.day_of_week === dayOfWeek)?.date ?? null,
    entries: entries.filter((entry) => entry.day_of_week === dayOfWeek).sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
  }));
  return days;
}

export function dayLabel(dayOfWeek: number): string {
  return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][dayOfWeek - 1] ?? 'Day';
}

export { fromMinutes };
