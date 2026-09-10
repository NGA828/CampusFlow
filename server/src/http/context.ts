import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getDb, type Db } from '../db/client.js';
import { config } from '../config.js';
import { ApiError } from '../lib/errors.js';
import { loadPrincipal, type Principal, type RequestContext } from '../middleware/auth.js';

/**
 * Request plumbing shared by every route: database handle, caller identity, rate limiting
 * and a single place where the API error contract is enforced.
 */

declare module 'fastify' {
  interface FastifyRequest {
    cfContext?: RequestContext;
  }
}

export function ctxOf(request: FastifyRequest, reply: FastifyReply): RequestContext {
  if (!request.cfContext) {
    throw new Error('Request context was not initialised.');
  }
  request.cfContext.reply = reply;
  return request.cfContext;
}

export function principalOf(request: FastifyRequest): Principal | undefined {
  return request.cfContext?.principal;
}

interface RateBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateBucket>();

function rateLimitFor(url: string, method: string): number {
  if (url.startsWith(`${config.apiPrefix}/auth`)) return config.rateLimit.authMax;
  if (url.startsWith(`${config.apiPrefix}/ai`)) return config.rateLimit.mutationMax;
  if (method !== 'GET' && method !== 'HEAD') return config.rateLimit.mutationMax;
  return config.rateLimit.defaultMax;
}

function consumeRateLimit(key: string, max: number): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + config.rateLimit.windowSeconds * 1000 });
    return { allowed: true, retryAfter: 0 };
  }
  bucket.count += 1;
  if (bucket.count > max) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { allowed: true, retryAfter: 0 };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}, 60_000).unref?.();

export async function registerHttpPipeline(app: FastifyInstance): Promise<void> {
  const db: Db = await getDb();

  app.addHook('onRequest', async (request, reply) => {
    const context: RequestContext = { request, reply, db, ip: request.ip };
    request.cfContext = context;
    if (request.headers.authorization) {
      await loadPrincipal(context);
    }
  });

  app.addHook('onRequest', async (request, reply) => {
    // Health checks and the realtime handshake are exempt from rate limiting.
    if (request.url.startsWith('/api/ws') || request.url.endsWith('/health')) return;
    const max = rateLimitFor(request.url, request.method);
    const key = `${request.ip}:${request.url.split('?')[0]}`;
    const { allowed, retryAfter } = consumeRateLimit(key, max);
    if (!allowed) {
      reply.header('retry-after', String(retryAfter));
      throw ApiError.tooMany(`Too many requests. Try again in ${retryAfter} seconds.`);
    }
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      success: false,
      message: `No API route matches ${request.method} ${request.url}.`,
      code: 'NOT_FOUND',
    });
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.status).send({
        success: false,
        message: error.message,
        errors: error.errors,
        code: error.code,
      });
    }

    if ((error as { validation?: unknown }).validation) {
      return reply.status(422).send({
        success: false,
        message: 'The given data was invalid.',
        errors: { _: ['The request payload could not be parsed.'] },
        code: 'VALIDATION_ERROR',
      });
    }

    const status = (error as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) {
      request.log.error({ err: error }, 'unhandled error');
    }
    return reply.status(status >= 400 && status < 600 ? status : 500).send({
      success: false,
      message:
        status >= 500
          ? 'Something went wrong on our side. Please try again.'
          : ((error as Error).message ?? 'The request could not be completed.'),
      code: status >= 500 ? 'SERVER_ERROR' : 'REQUEST_ERROR',
    });
  });
}
