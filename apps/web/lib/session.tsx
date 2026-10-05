'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, api, getToken, setToken } from './api';
import type { Role, SessionUser } from './types';

interface SessionValue {
  user: SessionUser | null;
  loading: boolean;
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
  }, []);

  const value = useMemo<SessionValue>(() => ({ user, loading, signIn, signOut, reload }), [user, loading, signIn, signOut, reload]);
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
