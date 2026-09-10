import type { Db } from '../db/client.js';
import { emitToUser } from '../realtime/bus.js';
import { config } from '../config.js';

export interface NotificationInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  dedupeKey?: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  priority: string;
  read_at: string | null;
  created_at: string;
}

/**
 * Create a notification, push it over the realtime channel and (when configured with
 * Expo credentials) forward it to registered mobile devices. A dedupe key makes
 * scheduled notifications idempotent — a class reminder is sent once per class per day.
 */
export async function notify(db: Db, input: NotificationInput): Promise<NotificationRow | null> {
  const data = { ...(input.data ?? {}) };
  if (input.dedupeKey) data.dedupe_key = input.dedupeKey;

  const rows = await db.query<NotificationRow>(
    `INSERT INTO notifications (user_id, type, title, body, data, priority)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, type, ((data ->> 'dedupe_key')))
       WHERE (data ->> 'dedupe_key') IS NOT NULL
       DO NOTHING
     RETURNING id, user_id, type, title, body, data, priority, read_at, created_at`,
    [input.userId, input.type, input.title, input.body, JSON.stringify(data), input.priority ?? 'normal'],
  );

  const notification = rows[0];
  if (!notification) return null;

  emitToUser(input.userId, 'notification.created', {
    notification: {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      priority: notification.priority,
      created_at: notification.created_at,
    },
  });

  if (config.push.enabled) {
    void sendPushToUser(db, input.userId, notification).catch(() => {
      /* push failures are non-fatal: the in-app notification is authoritative */
    });
  }

  return notification;
}

/** Expo push delivery. No-op unless EXPO_PUSH_ENABLED and at least one device token exist. */
async function sendPushToUser(db: Db, userId: string, notification: NotificationRow): Promise<void> {
  const tokens = await db.query<{ token: string }>('SELECT token FROM device_tokens WHERE user_id = $1', [userId]);
  if (tokens.length === 0) return;

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(config.push.expoAccessToken ? { authorization: `Bearer ${config.push.expoAccessToken}` } : {}),
    },
    body: JSON.stringify(
      tokens.map((token) => ({
        to: token.token,
        title: notification.title,
        body: notification.body,
        sound: notification.priority === 'urgent' ? 'default' : undefined,
        data: { type: notification.type, ...notification.data },
      })),
    ),
  });

  if (!response.ok) {
    throw new Error(`Expo push failed with status ${response.status}`);
  }
}

export async function markRead(db: Db, userId: string, notificationId: string): Promise<boolean> {
  const rows = await db.query<{ id: string }>(
    `UPDATE notifications SET read_at = now()
      WHERE id = $1 AND user_id = $2 AND read_at IS NULL
      RETURNING id`,
    [notificationId, userId],
  );
  return rows.length > 0;
}

export async function markAllRead(db: Db, userId: string): Promise<number> {
  const rows = await db.query<{ id: string }>(
    'UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL RETURNING id',
    [userId],
  );
  return rows.length;
}

export async function unreadCount(db: Db, userId: string): Promise<number> {
  const row = await db.one<{ count: string }>(
    'SELECT count(*)::text AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL',
    [userId],
  );
  return Number(row?.count ?? 0);
}
