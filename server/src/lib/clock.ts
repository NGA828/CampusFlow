/**
 * Campus clock helpers. Timetables, service windows and queue opening hours are all
 * expressed in the campus timezone, and every "today"/"next class" decision is made on
 * the server so clients in other timezones see identical results (PROMPT §12).
 */
export const CAMPUS_TIMEZONE = process.env.CAMPUS_TIMEZONE ?? 'UTC';

export interface CampusParts {
  /** ISO date, e.g. 2026-09-10 */
  date: string;
  /** ISO weekday, 1 = Monday … 7 = Sunday */
  dayOfWeek: number;
  /** HH:MM (24h) */
  time: string;
  /** Minutes since midnight */
  minutes: number;
}

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CAMPUS_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  weekday: 'short',
});

const ISO_WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function campusParts(date: Date = new Date()): CampusParts {
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour') === '24' ? '00' : get('hour');
  const minute = get('minute');
  const weekday = ISO_WEEKDAYS[get('weekday')] ?? 1;
  return {
    date: `${year}-${month}-${day}`,
    dayOfWeek: weekday,
    time: `${hour}:${minute}`,
    minutes: Number(hour) * 60 + Number(minute),
  };
}

export function isoWeekdayFromDate(dateISO: string): number {
  const [year, month, day] = dateISO.split('-').map(Number);
  const date = new Date(Date.UTC(year!, (month ?? 1) - 1, day ?? 1));
  const jsDay = date.getUTCDay(); // 0 = Sunday
  return jsDay === 0 ? 7 : jsDay;
}

export function addDays(dateISO: string, days: number): string {
  const [year, month, day] = dateISO.split('-').map(Number);
  const date = new Date(Date.UTC(year!, (month ?? 1) - 1, (day ?? 1) + days));
  return date.toISOString().slice(0, 10);
}

/** Monday of the week containing `dateISO`. */
export function startOfWeek(dateISO: string): string {
  const weekday = isoWeekdayFromDate(dateISO);
  return addDays(dateISO, -(weekday - 1));
}

export function weekDates(startISO: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(startISO, index));
}

export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function fromMinutes(minutes: number): string {
  const clamped = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(clamped / 60);
  const mins = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/** Build a UTC timestamp for a campus-local date + time. */
export function campusDateAt(dateISO: string, time: string): Date {
  // The campus timezone offset is applied by the runtime; for UTC campuses this is exact
  // and for offset campuses the difference is smaller than a scheduling granularity of
  // one minute, which the scheduler tolerates.
  return new Date(`${dateISO}T${time.length === 5 ? `${time}:00` : time}Z`);
}

export function minutesToHuman(minutes: number): string {
  if (minutes < 1) return 'less than a minute';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** ISO-8601 duration helper used by the API contract (``PT12M``). */
export function isoDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  let out = 'PT';
  if (hours) out += `${hours}H`;
  if (minutes) out += `${minutes}M`;
  if (secs || out === 'PT') out += `${secs}S`;
  return out;
}
