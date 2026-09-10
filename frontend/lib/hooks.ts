'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from './api/client';

/** Fetch + loading/error state with automatic cancellation on unmount. */
export function useAsync<T>(factory: (signal: AbortSignal) => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const factoryRef = useRef(factory);
  factoryRef.current = factory;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);

    factoryRef
      .current(controller.signal)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((caught: unknown) => {
        if (!active || (caught as Error)?.name === 'AbortError') return;
        setError(caught instanceof ApiError ? caught.message : 'The request failed. Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  return { data, error, loading, reload, setData };
}

/** Debounce any value — used by the room and user search fields. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Live countdown (seconds) refreshed on an interval — used by check-in windows. */
export function useCountdown(iso: string | null | undefined): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!iso) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [iso]);
  if (!iso) return null;
  return Math.max(0, Math.round((new Date(iso).getTime() - now) / 1000));
}

/** Ticking clock for "x minutes ago" labels and waiting-room dashboards. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const list = window.matchMedia(query);
    setMatches(list.matches);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener('change', listener);
    return () => list.removeEventListener('change', listener);
  }, [query]);
  return matches;
}

/** Browser geolocation, used by the campus map and outdoor navigation. */
export function useGeolocation() {
  const [position, setPosition] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const watchRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    setWatching(false);
  }, []);

  const start = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('This device does not expose a location sensor.');
      return;
    }
    setWatching(true);
    setError(null);
    watchRef.current = navigator.geolocation.watchPosition(
      (result) => setPosition({ lat: result.coords.latitude, lng: result.coords.longitude, accuracy: result.coords.accuracy }),
      (caught) => {
        setError(caught.message || 'Location permission was denied.');
        setWatching(false);
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    );
  }, []);

  useEffect(() => stop, [stop]);

  return { position, error, watching, start, stop };
}

/** Formats a duration in seconds as "12 min" / "1 h 05". */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—';
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total}s`;
  const minutes = Math.round(total / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} h ${String(rest).padStart(2, '0')}`;
}

export function formatDistance(meters: number | null | undefined): string {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatClock(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(value: string | Date | null | undefined, options: Intl.DateTimeFormatOptions = {}): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', ...options });
}

export function relativeTime(value: string | null | undefined, now = new Date()): string {
  if (!value) return '—';
  const date = new Date(value);
  const diff = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diff);
  const suffix = diff >= 0 ? 'from now' : 'ago';
  if (abs < 60) return diff >= 0 ? 'in a moment' : 'just now';
  if (abs < 3600) return `${Math.round(abs / 60)} min ${suffix}`;
  if (abs < 86_400) return `${Math.round(abs / 3600)} h ${suffix}`;
  return `${Math.round(abs / 86_400)} d ${suffix}`;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function useDayNames() {
  return useMemo(() => DAY_NAMES, []);
}

export function dayName(dayOfWeek: number): string {
  // 1 = Monday … 7 = Sunday (ISO weekday used across the API).
  return DAY_NAMES[dayOfWeek === 7 ? 0 : dayOfWeek] ?? '';
}

export function dayShort(dayOfWeek: number): string {
  return dayName(dayOfWeek).slice(0, 3);
}

export const STATUS_TONES: Record<string, 'neutral' | 'brand' | 'success' | 'warning' | 'danger'> = {
  QUEUE_PENDING: 'neutral',
  WAITING: 'brand',
  CALLED: 'warning',
  NAVIGATING: 'brand',
  APPROACHING: 'warning',
  CHECK_IN_WINDOW: 'warning',
  CHECKED_IN: 'success',
  ADMITTED: 'success',
  COMPLETED: 'success',
  NO_SHOW: 'danger',
  CANCELLED: 'neutral',
  EXPIRED: 'neutral',
  REQUESTED: 'neutral',
  TICKET_ASSIGNED: 'brand',
  IN_SERVICE: 'success',
};

export function statusLabel(status: string): string {
  return status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}
