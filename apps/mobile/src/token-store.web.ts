/**
 * Browser token storage.
 *
 * SecureStore has no web implementation, so the web build keeps the token in
 * localStorage. It is the same contract as the native file, deliberately: the rest of
 * the app never branches on platform for this.
 */
const TOKEN_KEY = 'campusflow.token';

export async function readToken(): Promise<string | null> {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function writeToken(token: string | null): Promise<void> {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode can refuse storage — the in-memory cache still works */
  }
}
