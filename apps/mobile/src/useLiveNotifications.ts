import { useEffect, useRef } from 'react';
import { api } from './api';
import { notify, requestNotificationPermission } from './notify';
import type { NotificationItem } from './types';

/**
 * Live guidance while the app is open.
 *
 * The API already fans a notification out to every concerned student when a room
 * request is decided or an announcement is published; this poll turns those into
 * device notifications. Whatever is already unread at sign-in is remembered, not
 * replayed — a student opening the app must not be buried under old alerts.
 */
const INTERVAL_MS = 25_000;

export function useLiveNotifications(enabled: boolean, onChange?: () => void) {
  const seen = useRef<Set<string> | null>(null);
  const changed = useRef(onChange);
  changed.current = onChange;

  useEffect(() => {
    if (!enabled) {
      seen.current = null;
      return;
    }

    let stopped = false;
    void requestNotificationPermission();

    const poll = async () => {
      try {
        const payload = await api<{ notifications: NotificationItem[] }>('/notifications');
        if (stopped) return;
        const unread = payload.notifications.filter((item) => !item.readAt);

        if (seen.current === null) {
          seen.current = new Set(unread.map((item) => item.id));
          return;
        }

        const fresh = unread.filter((item) => !seen.current?.has(item.id));
        for (const item of fresh) {
          seen.current.add(item.id);
          await notify(item.title, item.body);
        }
        if (fresh.length) changed.current?.();
      } catch {
        /* a failed poll is not worth interrupting the student for; the next one retries */
      }
    };

    void poll();
    const timer = setInterval(() => void poll(), INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [enabled]);
}
