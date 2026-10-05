import type { IncomingMessage, ServerResponse } from 'node:http';
import { publicUser, sessionByToken, users } from './store.ts';
import type { PublicUser, Role } from './types.ts';

/** Small routing + request helpers, so the route table in `index.ts` stays readable. */

export interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  params: Record<string, string>;
  body: unknown;
  user: PublicUser | null;
}

export class HttpError extends Error {
  status: number;
  details: Record<string, string> | null;

  constructor(status: number, message: string, details: Record<string, string> | null = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function send(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

export async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 512 * 1024) throw new HttpError(413, 'Request body is too large.');
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'The request body is not valid JSON.');
  }
}

export function resolveUser(req: IncomingMessage): PublicUser | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const session = sessionByToken(header.slice(7).trim());
  if (!session) return null;
  const user = users.get(session.userId);
  return user ? publicUser(user) : null;
}

export function requireUser(ctx: Ctx): PublicUser {
  if (!ctx.user) throw new HttpError(401, 'Sign in to continue.');
  return ctx.user;
}

export function requireRole(ctx: Ctx, ...roles: Role[]): PublicUser {
  const user = requireUser(ctx);
  if (!roles.includes(user.role)) {
    throw new HttpError(403, 'Your role does not have access to this operation.');
  }
  return user;
}

/* ------------------------------------------------------------------ validation */

export function str(body: unknown, field: string, { min = 1, max = 400 } = {}): string {
  const value = (body as Record<string, unknown> | null)?.[field];
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new HttpError(422, `“${field}” must be text between ${min} and ${max} characters.`, { [field]: 'invalid' });
  }
  return value.trim();
}

export function optionalStr(body: unknown, field: string): string | null {
  const value = (body as Record<string, unknown> | null)?.[field];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function bool(body: unknown, field: string): boolean {
  return (body as Record<string, unknown> | null)?.[field] === true;
}

export function isoDate(body: unknown, field: string): string {
  const value = str(body, field, { min: 4, max: 40 });
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new HttpError(422, `“${field}” must be a date and time.`, { [field]: 'invalid' });
  return new Date(parsed).toISOString();
}

/* ---------------------------------------------------------------------- router */

type Handler = (ctx: Ctx) => unknown | Promise<unknown>;

interface Route {
  method: string;
  segments: string[];
  handler: Handler;
}

export class Router {
  private readonly routes: Route[] = [];

  add(method: string, pattern: string, handler: Handler): this {
    this.routes.push({ method, segments: pattern.split('/').filter(Boolean), handler });
    return this;
  }

  get(pattern: string, handler: Handler): this {
    return this.add('GET', pattern, handler);
  }

  post(pattern: string, handler: Handler): this {
    return this.add('POST', pattern, handler);
  }

  match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | null {
    const parts = pathname.split('/').filter(Boolean);
    for (const route of this.routes) {
      if (route.method !== method || route.segments.length !== parts.length) continue;
      const params: Record<string, string> = {};
      let matched = true;
      for (const [index, segment] of route.segments.entries()) {
        const part = parts[index]!;
        if (segment.startsWith(':')) params[segment.slice(1)] = decodeURIComponent(part);
        else if (segment !== part) {
          matched = false;
          break;
        }
      }
      if (matched) return { handler: route.handler, params };
    }
    return null;
  }
}
