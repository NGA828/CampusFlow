/**
 * CampusFlow design tokens for the mobile app — the same palette as `frontend/app/globals.css`
 * so the two clients look like one product.
 */
import { Platform, type TextStyle } from 'react-native';

export const colors = {
  ink50: '#f6f7fb',
  ink100: '#eceefa',
  ink200: '#d7dbeb',
  ink300: '#b3bad3',
  ink400: '#8590b0',
  ink500: '#5c6788',
  ink600: '#424c6b',
  ink700: '#2c3450',
  ink800: '#1b2138',
  ink900: '#101527',
  ink950: '#080b17',
  brand50: '#eef1ff',
  brand100: '#dfe4ff',
  brand300: '#9ea9ff',
  brand500: '#5b5ff2',
  brand600: '#4340e0',
  brand700: '#3730bb',
  signal100: '#ffedc7',
  signal400: '#f9a92c',
  signal700: '#934c0b',
  mint100: '#cdf3ea',
  mint500: '#129a84',
  mint600: '#0b7a69',
  mint700: '#0b6155',
  coral100: '#ffdde0',
  coral500: '#dd3746',
  coral600: '#b92233',
  white: '#ffffff',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 32 } as const;
export const radius = { control: 11, card: 16, pill: 999 } as const;

export const font = {
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.4 } satisfies TextStyle,
  h2: { fontSize: 19, fontWeight: '700' } satisfies TextStyle,
  h3: { fontSize: 15.5, fontWeight: '600' } satisfies TextStyle,
  body: { fontSize: 14.5, lineHeight: 21 } satisfies TextStyle,
  small: { fontSize: 12.5, lineHeight: 18 } satisfies TextStyle,
  tiny: { fontSize: 11, letterSpacing: 0.4 } satisfies TextStyle,
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) } satisfies TextStyle,
};

export const shadow = {
  card: {
    shadowColor: '#101527',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
} as const;

export function formatClock(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function relativeTime(value: string | null | undefined): string {
  if (!value) return '—';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return value;
  const diff = Date.now() - then;
  const minutes = Math.round(diff / 60_000);
  if (Math.abs(minutes) < 1) return 'just now';
  if (Math.abs(minutes) < 60) return minutes > 0 ? `${minutes} min ago` : `in ${-minutes} min`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return hours > 0 ? `${hours} h ago` : `in ${-hours} h`;
  const days = Math.round(hours / 24);
  return days > 0 ? `${days} d ago` : `in ${-days} d`;
}

export function countdown(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds < 0) return '—';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes >= 60) return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function dayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek % 7] ?? `Day ${dayOfWeek}`;
}
