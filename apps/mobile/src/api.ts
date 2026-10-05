import * as SecureStore from 'expo-secure-store';

/**
 * Mobile HTTP client.
 *
 * The phone talks to the API directly (there is no Next.js rewrite in front of it),
 * so the base URL is configuration, never a literal scattered through screens:
 *   EXPO_PUBLIC_API_URL=http://192.168.1.20:4000/api/v1
 * The default targets the Android emulator's host alias.
 *
 * The session token lives in SecureStore — the platform keychain — because a token on
 * a phone outlives the process and must not sit in plain AsyncStorage.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000/api/v1';

const TOKEN_KEY = 'campusflow.token';

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
  try {
    cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

export async function saveToken(token: string | null): Promise<void> {
  cachedToken = token;
  try {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    /* keychain unavailable on this device — the cached token keeps this launch signed in */
  }
}

export async function api<T>(path: string, options: { method?: 'GET' | 'POST'; body?: unknown; auth?: boolean } = {}): Promise<T> {
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
  if (!response.ok) {
    throw new ApiError(response.status, typeof payload.error === 'string' ? payload.error : 'The request could not be completed.');
  }
  return payload as T;
}
