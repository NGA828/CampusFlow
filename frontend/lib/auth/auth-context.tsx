'use client';

/**
 * Authentication state for the whole app.
 *
 * The token lives in `localStorage` (written by the API client), and the principal is
 * always re-read from `GET /auth/me` so permissions and staff scopes come from the
 * backend — the client never decides what a user may do.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, getToken, setToken } from '../api/client';
import { authApi } from '../api/endpoints';
import type { Role, StaffAssignment, User } from '../api/types';

interface AuthContextValue {
  user: User | null;
  assignments: StaffAssignment[];
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    role?: 'student' | 'staff';
    registration_no?: string;
    department?: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  isStaff: boolean;
  isAdmin: boolean;
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const RANK: Record<Role, number> = { visitor: 0, student: 10, staff: 20, admin: 30 };

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [assignments, setAssignments] = useState<StaffAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setAssignments([]);
      setLoading(false);
      return;
    }
    try {
      const { user: principal, assignments: scoped } = await authApi.me();
      setUser(principal);
      setAssignments(scoped ?? []);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setToken(null);
      }
      setUser(null);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onUnauthenticated = () => {
      setUser(null);
      setAssignments([]);
      router.replace('/login');
    };
    const onToken = () => void load();
    window.addEventListener('campusflow:unauthenticated', onUnauthenticated);
    window.addEventListener('campusflow:token', onToken);
    return () => {
      window.removeEventListener('campusflow:unauthenticated', onUnauthenticated);
      window.removeEventListener('campusflow:token', onToken);
    };
  }, [load, router]);

  const login = useCallback(async (email: string, password: string) => {
    const session = await authApi.login({ email, password });
    setToken(session.token);
    setUser(session.user);
    const me = await authApi.me().catch(() => null);
    if (me) {
      setUser(me.user);
      setAssignments(me.assignments ?? []);
    }
    return session.user;
  }, []);

  const register = useCallback<AuthContextValue['register']>(async (input) => {
    const session = await authApi.register(input);
    setToken(session.token);
    setUser(session.user);
    const me = await authApi.me().catch(() => null);
    if (me) {
      setUser(me.user);
      setAssignments(me.assignments ?? []);
    }
    return session.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* the session may already be gone — the local token is cleared either way */
    }
    setToken(null);
    setUser(null);
    setAssignments([]);
    router.replace('/login');
  }, [router]);

  const value = useMemo<AuthContextValue>(() => {
    const isStaff = user ? RANK[user.role_code] >= RANK.staff : false;
    return {
      user,
      assignments,
      loading,
      login,
      register,
      logout,
      refresh: load,
      isStaff,
      isAdmin: user?.role_code === 'admin',
      can: (permission: string) => Boolean(user?.permissions?.includes(permission)),
    };
  }, [user, assignments, loading, login, register, logout, load]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}

/** Route guard used by the authenticated layout. */
export function useRequireAuth(roles?: Role[]) {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (roles && roles.length > 0 && !roles.includes(user.role_code) && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [loading, user, roles, router, isAdmin]);

  return { user, loading };
}
