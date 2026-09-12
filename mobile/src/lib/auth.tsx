/**
 * Session handling for the mobile app.
 *
 * The Sanctum-style bearer token lives in the device keychain (`expo-secure-store`) and is
 * validated against `GET /me` on launch — the same self-scoped read the account screen uses — so a revoked
 * or expired token signs the user out
 * instead of leaving the app in a half-authenticated state.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ApiError, authApi, loadToken, saveToken } from './api';
import type { SessionInfo, User } from './types';

/**
 * Where each role belongs on this device.
 *
 * The mobile app has no universal home screen. A student lands on the next-class card, a member of staff
 * lands on the line they are running, an administrator lands on the alert feed. Which tree the router puts
 * you in is decided here, once, from the token's role — not by a conditional inside a shared screen.
 */
export const ROLE_ROOT = {
  student: '/student',
  staff: '/staff',
  admin: '/admin',
} as const;


interface AuthValue {
  user: User | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (body: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    registration_no?: string;
    department?: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await loadToken();
        if (!token) return;
        const result = await authApi.me();
        if (active) setUser(result.user);
      } catch {
        await saveToken(null);
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const session: SessionInfo = await authApi.login({ email: email.trim().toLowerCase(), password });
    await saveToken(session.token);
    setUser(session.user);
  }, []);

  const signUp = useCallback(async (body: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    registration_no?: string;
    department?: string;
  }) => {
    const session: SessionInfo = await authApi.register({ ...body, email: body.email.trim().toLowerCase() });
    await saveToken(session.token);
    setUser(session.user);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // A failed revoke must never trap the user inside the app.
      if (!(error instanceof ApiError)) throw error;
    }
    await saveToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const result = await authApi.me();
    setUser(result.user);
  }, []);

  const value = useMemo<AuthValue>(() => ({ user, ready, signIn, signUp, signOut, refresh }), [user, ready, signIn, signUp, signOut, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

/** Runs an async loader with loading/error/refresh state, mirroring the web `useAsync` hook. */
import { useCallback as useCallbackAlias } from 'react';

export function useLoader<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const run = useCallbackAlias(async () => {
    setLoading(true);
    try {
      setData(await loader());
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'The request failed. Pull to retry.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void run();
  }, [run]);

  return { data, error, loading, reload: run };
}
