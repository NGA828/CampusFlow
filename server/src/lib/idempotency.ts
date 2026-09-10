import { ApiError } from './errors.js';
import { sha256 } from './security.js';
import type { Db } from '../db/client.js';

/**
 * Duplicate-submission protection (PROMPT §39).
 *
 * Clients may send `Idempotency-Key` on any state-changing request. The first successful
 * response is stored and replayed for 24 hours, so a double-tap on "Join queue" or a
 * retry after a flaky connection can never create a second ticket.
 */
export async function withIdempotency<T>(
  db: Db,
  params: { key: string | undefined; userId: string; endpoint: string; payload: unknown },
  handler: () => Promise<{ status: number; body: T }>,
): Promise<{ status: number; body: T; replayed: boolean }> {
  if (!params.key) {
    const result = await handler();
    return { ...result, replayed: false };
  }

  const requestHash = sha256(JSON.stringify(params.payload ?? {}));
  const existing = await db.one<{ request_hash: string; status_code: number; response: T }>(
    `SELECT request_hash, status_code, response FROM idempotency_keys
      WHERE key = $1 AND user_id = $2 AND expires_at > now()`,
    [params.key, params.userId],
  );

  if (existing) {
    if (existing.request_hash !== requestHash) {
      throw ApiError.conflict('This idempotency key was already used with a different payload.', 'IDEMPOTENCY_MISMATCH');
    }
    return { status: existing.status_code, body: existing.response, replayed: true };
  }

  const result = await handler();
  await db.query(
    `INSERT INTO idempotency_keys (key, user_id, endpoint, request_hash, status_code, response)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (key) DO NOTHING`,
    [params.key, params.userId, params.endpoint, requestHash, result.status, JSON.stringify(result.body)],
  );
  return { ...result, replayed: false };
}
