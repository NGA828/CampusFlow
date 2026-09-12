'use client';

/**
 * Authentication state for the whole app.
 *
 * The token lives in `localStorage` (written by the API client), and the principal is
 * always re-read from `GET /me` (the self-scoped read, not an auth endpoint) so permissions and staff scopes come from the
 * backend — the client never decides what a user may do.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, getToken, setToken } from '@/lib/api/client';
import { authApi } from '@/lib/api/endpoints';
import type { Role, StaffAssignment, User } from '@/lib/api/types';

/**
 * Where each principal belongs. Four products, four homes — there is no `/dashboard` that works for
 * everybody, and the redirect after login is the first place that has to prove it.
 */
export const ROLE_HOME: Record<Role, string> = {
  visitor: '/',
  student: '/student/dashboard',
  staff: '/staff/dashboard',
  admin: '/admin/dashboard',
};

export interface AuthContextValue {
  user: User | null;
  assignments: StaffAssignment[];
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  /**
   * Public self-registration creates students, full stop. Staff and administrator accounts are issued
   * by administration (`POST /admin/users`), because "which role do you claim to be" cannot be a
   * self-serve field on a sign-up form — that choice is the whole access model.
   */
  register: (input: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    registration_no?: string;
    department?: string;
    program?: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  /**
   * Roles are compared exactly, never by rank. `isStaff` used to mean "staff or above", which is how an
   * administrator ended up inside a staff screen; a role is an identity, not a privilege level, and the
   * console a person gets is decided by which role they hold.
   */
  isStudent: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  home: string;
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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
      // A 401 from anywhere ends the session and returns the person to the sign-in screen; it never
      // forwards them into a role workspace, because at this moment we do not know who they are.
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
    const role = user?.role_code;
    return {
      user,
      assignments,
      loading,
      login,
      register,
      logout,
      refresh: load,
      isStudent: role === 'student',
      isStaff: role === 'staff',
      isAdmin: role === 'admin',
      home: role ? ROLE_HOME[role] : '/',
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

/**
 * Route guard for an authenticated role tree.
 *
 * `roles` is an allow-list, and an administrator is *not* exempt: an admin who wanders into
 * `/student/dashboard` is a person looking at the wrong product, and the correct answer is to send them
 * to their own console — where their real powers live — rather than to grant a cross-role read of
 * somebody else's workspace. The server enforces the same rule again on every request; this hook only
 * decides what the browser shows while that happens.
 */
export function useRequireAuth(roles?: Role[]) {
  const { user, loading, home } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (roles && roles.length > 0 && !roles.includes(user.role_code)) {
      router.replace(home);
    }
  }, [loading, user, roles, router, home]);

  return { user, loading };
}
