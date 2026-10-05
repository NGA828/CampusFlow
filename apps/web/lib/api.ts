/**
 * The single HTTP client.
 *
 * Browser calls are same-origin (`/api/v1/...`, rewritten server-side), which is what
 * makes the embedded preview work: there is no third-party cookie and no cross-site
 * request to be stripped. The session token travels in the Authorization header and
 * lives in `sessionStorage`, so an iframe with blocked storage degrades to "signed
 * out" instead of a redirect loop.
 */

const SERVER_ORIGIN = process.env.API_ORIGIN ?? 'http://127.0.0.1:4000';

export class ApiError extends Error {
  status: number;
  details: Record<string, string> | null;

  constructor(status: number, message: string, details: Record<string, string> | null = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/**
 * What to do when the server says the token is no longer good.
 *
 * Every screen fetches its own data, so without this each one invents its own wording
 * for an expired session — a student gets "your campus data could not be loaded" and
 * is left pressing refresh against a token that will never work again. The session
 * provider registers a handler here and signs them out properly instead.
 */
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

const TOKEN_KEY = 'campusflow.token';
/** Fallback for embedded browsers that refuse storage access entirely. */
let memoryToken: string | null = null;

export function getToken(): string | null {
  if (memoryToken) return memoryToken;
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  memoryToken = token;
  if (typeof window === 'undefined') return;
  try {
    if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
    else window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage denied — the in-memory token keeps this tab signed in */
  }
}

function base(): string {
  return typeof window === 'undefined' ? SERVER_ORIGIN : '';
}

/**
 * True when a failure is just "you are no longer signed in".
 *
 * The session provider has already dealt with it by the time a screen sees the error,
 * so the screen must stay quiet rather than blame the data it was fetching.
 */
export function isSignedOut(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export async function api<T>(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const token = options.token !== undefined ? options.token : getToken();
  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${base()}/api/v1${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'The CampusFlow API is unreachable. Check that the API process is running.');
  }

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (response.status === 401 && token) {
    // The token we sent is dead: drop it before anything retries with it.
    setToken(null);
    onUnauthorized?.();
  }
  if (!response.ok) {
    throw new ApiError(
      response.status,
      typeof payload.error === 'string' ? payload.error : 'The request could not be completed.',
      (payload.details as Record<string, string> | null) ?? null,
    );
  }
  return payload as T;
}
