/**
 * The single HTTP client used by the web app (and mirrored in the mobile app).
 *
 * - All requests go to `NEXT_PUBLIC_API_URL`, with Laravel as the only supported API.
 * - The API envelope `{ success, data, message }` / `{ success, message, errors }` is
 *   unwrapped here: callers receive `data` or a typed `ApiError`.
 * - Duplicate-submitting mutations accept an idempotency key so a double tap can never
 *   create two tickets.
 */

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? '/api/v1').replace(/\/$/, '');

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly errors: Record<string, string[]> | null;

  constructor(status: number, message: string, code: string | null = null, errors: Record<string, string[]> | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.errors = errors;
  }

  /** First validation message, useful for inline form errors. */
  get firstError(): string | null {
    if (!this.errors) return null;
    const [first] = Object.values(this.errors);
    return first?.[0] ?? null;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

const TOKEN_KEY = 'campusflow.token';

let memoryToken: string | null = null;

export function getToken(): string | null {
  if (memoryToken) return memoryToken;
  if (typeof window === 'undefined') return null;
  memoryToken = window.localStorage.getItem(TOKEN_KEY);
  return memoryToken;
}

export function setToken(token: string | null): void {
  memoryToken = token;
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new CustomEvent('campusflow:token', { detail: token }));
}

/**
 * Which product is calling. The backend's `Platform` gate trusts this header only as a *hint about
 * the client*, never as authority — role and permissions come from the token — but it is what lets
 * `/student/positioning/scan` answer 403 PLATFORM_NOT_SUPPORTED for a browser while the phone on the
 * same account succeeds. Mobile sends `mobile`; anything unlabelled is treated as web.
 */
export const CLIENT_PLATFORM = 'web';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  /** Supplied for mutations where a retry must not create a second record. */
  idempotencyKey?: string;
  auth?: boolean;
}

/**
 * Server components run inside our own Node process, so a relative base cannot be fetched.
 * The internal origin targets Laravel for server-rendered requests.
 */
const INTERNAL_API_ORIGIN = (process.env.API_INTERNAL_URL ?? process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8000').replace(/\/$/, '');

function resolveBase(): string {
  if (typeof window !== 'undefined') return API_BASE;
  if (/^https?:\/\//.test(API_BASE)) return API_BASE;
  return `${INTERNAL_API_ORIGIN}${API_BASE.startsWith('/') ? API_BASE : `/${API_BASE}`}`;
}

export function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${resolveBase()}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    search.append(key, String(value));
  }
  const suffix = search.toString();
  return suffix ? `${url}?${suffix}` : url;
}

export function newIdempotencyKey(prefix = 'cf'): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, idempotencyKey, auth = true } = options;
  const headers: Record<string, string> = { accept: 'application/json', 'X-CampusFlow-Client': CLIENT_PLATFORM };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const token = auth ? getToken() : null;
  if (token) headers.authorization = `Bearer ${token}`;
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      credentials: 'same-origin',
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(0, 'The CampusFlow API is unreachable. Check that the API server is running.', 'NETWORK_ERROR');
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ApiError(response.status, 'The API returned a response that could not be parsed.', 'BAD_RESPONSE');
    }
  }

  const envelope = (payload ?? {}) as { success?: boolean; data?: T; message?: string; errors?: Record<string, string[]>; code?: string };

  if (!response.ok || envelope.success === false) {
    if (response.status === 401 && typeof window !== 'undefined') {
      setToken(null);
      window.dispatchEvent(new CustomEvent('campusflow:unauthenticated'));
    }
    throw new ApiError(
      response.status,
      envelope.message ?? 'The request could not be completed.',
      envelope.code ?? null,
      envelope.errors ?? null,
    );
  }

  return (envelope.data ?? (payload as T)) as T;
}

export const api = {
  get: <T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}) => request<T>(path, { ...options, method: 'DELETE' }),
};
