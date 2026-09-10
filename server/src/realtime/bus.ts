import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Db } from '../db/client.js';
import { config } from '../config.js';
import { resolvePrincipal, type Principal } from '../middleware/auth.js';

/**
 * Realtime fan-out (PROMPT §22, §40).
 *
 * Channels are authorised on subscribe:
 *   user:<uuid>            — always available to the authenticated user
 *   student:queues:<uuid>  — the caller's own active queue tickets
 *   queue:<uuid>           — students with an active ticket in that queue, scoped staff, admins
 *   office:<uuid>          — students with an active office ticket, scoped staff, admins
 *   staff:ops              — scoped staff and admins (operational dashboards)
 *   admin:ops              — administrators
 *
 * Private ticket data is never broadcast on a shared channel: shared channels carry only
 * aggregate queue state, everything student-specific goes to `user:<uuid>`.
 */

export interface RealtimeEvent {
  channel: string;
  event: string;
  payload: Record<string, unknown>;
  at: string;
}

type Connection = {
  socket: WebSocket;
  principal: Principal | null;
  channels: Set<string>;
  alive: boolean;
};

const connections = new Map<string, Connection>();
let heartbeat: NodeJS.Timeout | null = null;

function send(socket: WebSocket, message: unknown): void {
  if (socket.readyState !== socket.OPEN) return;
  try {
    socket.send(JSON.stringify(message));
  } catch {
    /* dropped connection — the heartbeat will clean it up */
  }
}

export function userChannel(userId: string): string {
  return `user:${userId}`;
}

export function queueChannel(queueId: string): string {
  return `queue:${queueId}`;
}

export function officeChannel(officeId: string): string {
  return `office:${officeId}`;
}

export const STAFF_CHANNEL = 'staff:ops';
export const ADMIN_CHANNEL = 'admin:ops';

async function channelsFor(db: Db, principal: Principal): Promise<Set<string>> {
  const channels = new Set<string>([userChannel(principal.id)]);

  const activeTickets = await db.query<{ queue_id: string }>(
    `SELECT DISTINCT queue_id FROM queue_tickets
      WHERE student_id = $1
        AND status IN ('QUEUE_PENDING','WAITING','CALLED','NAVIGATING','APPROACHING','CHECK_IN_WINDOW','CHECKED_IN')`,
    [principal.id],
  );
  for (const row of activeTickets) channels.add(queueChannel(row.queue_id));

  const officeTickets = await db.query<{ office_id: string }>(
    `SELECT DISTINCT office_id FROM office_tickets
      WHERE student_id = $1
        AND status IN ('REQUESTED','TICKET_ASSIGNED','WAITING','APPROACHING','CALLED','CHECK_IN_WINDOW','CHECKED_IN','IN_SERVICE')`,
    [principal.id],
  );
  for (const row of officeTickets) channels.add(officeChannel(row.office_id));

  if (principal.role === 'admin') {
    channels.add(ADMIN_CHANNEL);
    channels.add(STAFF_CHANNEL);
  } else if (principal.role === 'staff') {
    channels.add(STAFF_CHANNEL);
    for (const assignment of principal.assignments) {
      if (!assignment.can_call_tickets) continue;
      if (assignment.scope_type === 'queue') channels.add(queueChannel(assignment.scope_id));
      if (assignment.scope_type === 'office') channels.add(officeChannel(assignment.scope_id));
    }
    const scoped = await db.query<{ id: string }>(
      `SELECT q.id FROM room_queues q
         JOIN rooms r ON r.id = q.room_id
         JOIN staff_assignments a ON a.user_id = $1 AND a.can_call_tickets
        WHERE (a.scope_type = 'building' AND a.scope_id = r.building_id)
           OR (a.scope_type = 'room' AND a.scope_id = r.id)`,
      [principal.id],
    );
    for (const row of scoped) channels.add(queueChannel(row.id));
    const scopedOffices = await db.query<{ id: string }>(
      `SELECT o.id FROM administrative_offices o
         JOIN staff_assignments a ON a.user_id = $1 AND a.can_call_tickets
        WHERE (a.scope_type = 'building' AND a.scope_id = o.building_id)
           OR (a.scope_type = 'office' AND a.scope_id = o.id)`,
      [principal.id],
    );
    for (const row of scopedOffices) channels.add(officeChannel(row.id));
  }

  return channels;
}

export async function attachRealtime(server: HttpServer, db: Db): Promise<() => Promise<void>> {
  const wss = new WebSocketServer({ server, path: '/api/ws', maxPayload: 64 * 1024 });

  wss.on('connection', (socket) => {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const connection: Connection = { socket, principal: null, channels: new Set(), alive: true };
    connections.set(id, connection);

    send(socket, { type: 'welcome', ts: new Date().toISOString(), requires_auth: true });

    socket.on('message', async (raw) => {
      let message: { type?: string; token?: string; channel?: string };
      try {
        message = JSON.parse(raw.toString());
      } catch {
        send(socket, { type: 'error', code: 'BAD_MESSAGE', message: 'Messages must be JSON.' });
        return;
      }

      if (message.type === 'auth') {
        if (!message.token) {
          send(socket, { type: 'error', code: 'MISSING_TOKEN', message: 'A bearer token is required.' });
          return;
        }
        const principal = await resolvePrincipal(db, message.token);
        if (!principal) {
          send(socket, { type: 'error', code: 'INVALID_TOKEN', message: 'Session is no longer valid.' });
          socket.close(4401, 'Unauthenticated');
          return;
        }
        connection.principal = principal;
        const allowed = await channelsFor(db, principal);
        for (const channel of allowed) connection.channels.add(channel);
        send(socket, {
          type: 'authenticated',
          user: { id: principal.id, name: principal.name, role: principal.role },
          channels: [...connection.channels],
        });
        return;
      }

      if (message.type === 'subscribe') {
        if (!connection.principal) {
          send(socket, { type: 'error', code: 'UNAUTHENTICATED', message: 'Authenticate before subscribing.' });
          return;
        }
        if (!message.channel) {
          send(socket, { type: 'error', code: 'MISSING_CHANNEL', message: 'A channel name is required.' });
          return;
        }
        if (!connection.channels.has(message.channel)) {
          send(socket, { type: 'error', code: 'FORBIDDEN_CHANNEL', message: 'You are not authorised for that channel.' });
          return;
        }
        connection.channels.add(message.channel);
        send(socket, { type: 'subscribed', channel: message.channel });
        return;
      }

      if (message.type === 'unsubscribe') {
        if (message.channel) connection.channels.delete(message.channel);
        send(socket, { type: 'unsubscribed', channel: message.channel });
        return;
      }

      if (message.type === 'ping') {
        connection.alive = true;
        send(socket, { type: 'pong', ts: new Date().toISOString() });
        return;
      }

      send(socket, { type: 'error', code: 'UNKNOWN_MESSAGE', message: 'Unsupported message type.' });
    });

    socket.on('pong', () => {
      connection.alive = true;
    });

    socket.on('close', () => connections.delete(id));
    socket.on('error', () => connections.delete(id));
  });

  heartbeat = setInterval(() => {
    for (const [id, connection] of connections) {
      if (!connection.alive) {
        connection.socket.terminate();
        connections.delete(id);
        continue;
      }
      connection.alive = false;
      try {
        connection.socket.ping();
      } catch {
        connections.delete(id);
      }
    }
  }, 30_000);

  return async () => {
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = null;
    for (const connection of connections.values()) connection.socket.close(1001, 'Server shutting down');
    connections.clear();
    await new Promise<void>((resolve) => wss.close(() => resolve()));
  };
}

function broadcast(channel: string, event: string, payload: Record<string, unknown>): void {
  const message: RealtimeEvent = { channel, event, payload, at: new Date().toISOString() };
  for (const connection of connections.values()) {
    if (!connection.channels.has(channel)) continue;
    send(connection.socket, { type: 'event', ...message });
  }
}

export function emitToChannel(channel: string, event: string, payload: Record<string, unknown> = {}): void {
  broadcast(channel, event, payload);
}

export function emitToUser(userId: string, event: string, payload: Record<string, unknown> = {}): void {
  broadcast(userChannel(userId), event, payload);
}

export function emitToUsers(userIds: string[], event: string, payload: Record<string, unknown> = {}): void {
  for (const userId of new Set(userIds)) emitToUser(userId, event, payload);
}

export function emitToQueue(queueId: string, event: string, payload: Record<string, unknown> = {}): void {
  broadcast(queueChannel(queueId), event, payload);
}

export function emitToOffice(officeId: string, event: string, payload: Record<string, unknown> = {}): void {
  broadcast(officeChannel(officeId), event, payload);
}

export function emitToStaff(event: string, payload: Record<string, unknown> = {}): void {
  broadcast(STAFF_CHANNEL, event, payload);
}

export function emitToAdmins(event: string, payload: Record<string, unknown> = {}): void {
  broadcast(ADMIN_CHANNEL, event, payload);
}

export function realtimeStats(): { connections: number; authenticated: number } {
  let authenticated = 0;
  for (const connection of connections.values()) if (connection.principal) authenticated += 1;
  return { connections: connections.size, authenticated };
}
