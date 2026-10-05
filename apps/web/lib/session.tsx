'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, api, getToken, setToken, setUnauthorizedHandler } from './api';
import type { Role, SessionUser } from './types';

interface SessionValue {
  user: SessionUser | null;
  loading: boolean;
  /** True when a signed-in session was rejected mid-use, so the sign-in screen can say so. */
  expired: boolean;
  signIn: (email: string, password: string) => Promise<SessionUser>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export const HOME_FOR: Record<Role, string> = {
  STUDENT: '/student',
  STAFF: '/staff',
  ADMIN: '/admin',
};

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  // Read inside the handler below, which is registered once and must not go stale.
  const signedIn = useRef(false);

  useEffect(() => {
    signedIn.current = user !== null;
  }, [user]);

  /**
   * The API restarting, or twelve hours passing, must not look like a broken page.
   * Any 401 against a token we were actually using ends the session here, once, and
   * the role guards then send the student to the sign-in screen with an explanation.
   */
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!signedIn.current) return;
      signedIn.current = false;
      setExpired(true);
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const reload = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user: me } = await api<{ user: SessionUser }>('/auth/me');
      setUser(me);
    } catch (error) {
      // Only an actual rejection clears the token; a network blip must not sign people out.
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await api<{ token: string; user: SessionUser }>('/auth/login', {
      method: 'POST',
      body: { email, password },
      token: null,
    });
    setToken(session.token);
    setUser(session.user);
    setExpired(false);
    return session.user;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      /* the session may already be gone; the local token is cleared either way */
    }
    setToken(null);
    setUser(null);
    setExpired(false);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({ user, loading, expired, signIn, signOut, reload }),
    [user, loading, expired, signIn, signOut, reload],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside <SessionProvider>.');
  return context;
}

/**
 * Guard for a role area. The server checks the same thing on every request — this only
 * decides what the browser shows while that happens, and sends people to their *own*
 * workspace rather than letting an administrator browse a student screen.
 */
export function useRequireRole(...roles: Role[]) {
  const { user, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (roles.length > 0 && !roles.includes(user.role)) router.replace(HOME_FOR[user.role]);
    // `roles` is a literal list at every call site, so it is stable between renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, router]);

  return { user, loading };
}
