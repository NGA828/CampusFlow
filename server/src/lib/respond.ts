import type { FastifyReply } from 'fastify';
import type { Db } from '../db/client.js';
import type { RequestContext } from '../middleware/auth.js';

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}

export function ok<T>(reply: FastifyReply, data: T, message?: string, status = 200) {
  const payload: ApiEnvelope<T> = { success: true, data };
  if (message) payload.message = message;
  return reply.status(status).send(payload);
}

export function created<T>(reply: FastifyReply, data: T, message = 'Created successfully.') {
  return ok(reply, data, message, 201);
}

export function noContent(reply: FastifyReply) {
  return reply.status(204).send();
}

export interface PageMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export function paginate<T>(rows: T[], total: number, page: number, perPage: number) {
  return {
    items: rows,
    meta: {
      page,
      per_page: perPage,
      total,
      total_pages: Math.max(1, Math.ceil(total / perPage)),
    } satisfies PageMeta,
  };
}

/** Append to the audit trail. Used by every administrative or queue-state mutation. */
export async function audit(
  ctx: RequestContext,
  action: string,
  entity?: { type?: string; id?: string; metadata?: Record<string, unknown> },
): Promise<void> {
  try {
    await ctx.db.query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata, ip)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        ctx.principal?.id ?? null,
        action,
        entity?.type ?? null,
        entity?.id ?? null,
        JSON.stringify(entity?.metadata ?? {}),
        ctx.ip ?? null,
      ],
    );
  } catch {
    /* auditing must never break the request path */
  }
}
