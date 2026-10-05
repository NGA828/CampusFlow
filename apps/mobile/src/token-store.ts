import * as SecureStore from 'expo-secure-store';

/**
 * Native token storage: the platform keychain.
 *
 * A token on a phone outlives the process, so it must not sit in plain AsyncStorage.
 * `token-store.web.ts` is the browser twin of this file — the bundler picks the right
 * one per platform, so nothing above this layer has to know which one it got.
 */
const TOKEN_KEY = 'campusflow.token';

export async function readToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function writeToken(token: string | null): Promise<void> {
  try {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    /* keychain unavailable — the in-memory cache keeps this launch signed in */
  }
}
