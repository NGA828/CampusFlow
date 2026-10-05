import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, api, loadToken, saveToken, setUnauthorizedHandler } from './api';
import type { SessionUser } from './types';

interface SessionValue {
  user: SessionUser | null;
  loading: boolean;
  /** Set when a live session was rejected, so the sign-in screen can explain itself. */
  expired: boolean;
  signIn: (email: string, password: string) => Promise<SessionUser>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);

  // One place decides that a session is over, so no screen has to guess.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setExpired(true);
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    void (async () => {
      if (!(await loadToken())) {
        setLoading(false);
        return;
      }
      try {
        const payload = await api<{ user: SessionUser }>('/auth/me');
        setUser(payload.user);
      } catch (error) {
        // A stored token the server rejects is dead; a network failure is not.
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) await saveToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await api<{ token: string; user: SessionUser }>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    await saveToken(session.token);
    setUser(session.user);
    setExpired(false);
    return session.user;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      /* the session may already be gone; the token is cleared either way */
    }
    await saveToken(null);
    setUser(null);
    setExpired(false);
  }, []);

  const value = useMemo(() => ({ user, loading, expired, signIn, signOut }), [user, loading, expired, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside <SessionProvider>.');
  return context;
}
