import { Platform } from 'react-native';
import { readToken, writeToken } from './token-store';

/**
 * Mobile HTTP client.
 *
 * A real phone talks to the API directly, so the base URL is configuration rather
 * than a literal scattered through screens:
 *   EXPO_PUBLIC_API_URL=http://192.168.1.20:4000/api/v1
 *
 * Without that variable:
 *   • web → **same origin**, `/api/v1`, proxied to the API by `tools/serve-web.mjs`.
 *     This used to guess a host and port (`<host>:4000`, or `4000-<sandbox>` for one
 *     particular preview domain) and it broke the moment the app was opened through
 *     any other hostname: the browser is not the machine running the API, that port
 *     is usually not routable from it, and the guess fails as an unreachable-network
 *     error. The browser must only ever call the origin it was served from.
 *   • native → the Android emulator's alias for the host machine, which is a real
 *     direct connection and cannot be relative.
 */
function resolveApiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured;
  if (Platform.OS === 'web') return '/api/v1';
  return 'http://10.0.2.2:4000/api/v1';
}

export const API_URL = resolveApiUrl();

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let cachedToken: string | null = null;

export async function loadToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  cachedToken = await readToken();
  return cachedToken;
}

export async function saveToken(token: string | null): Promise<void> {
  cachedToken = token;
  await writeToken(token);
}

/**
 * What to do when the server rejects the stored token mid-session — the API was
 * restarted, or twelve hours passed. Without this each screen reports it as its own
 * loading failure and the student is left pulling to refresh against a dead token.
 */
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

/** True when a failure is just "you are no longer signed in". */
export function isSignedOut(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export async function api<T>(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.auth !== false) {
    const token = await loadToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, `CampusFlow could not reach ${API_URL}. Check the API address and your network.`);
  }

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (response.status === 401 && headers.authorization) {
    await saveToken(null);
    onUnauthorized?.();
  }
  if (!response.ok) {
    throw new ApiError(
      response.status,
      typeof payload.error === 'string' ? payload.error : 'The request could not be completed.',
    );
  }
  return payload as T;
}
