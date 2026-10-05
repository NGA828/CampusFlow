'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ApiError, api } from '@/lib/api';
import { HOME_FOR, useSession } from '@/lib/session';
import type { Role } from '@/lib/types';

interface DemoAccount {
  role: Role;
  email: string;
  name: string;
}

function LoginScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading, expired, signIn } = useSession();
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);
  const [demoPassword, setDemoPassword] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Role | 'form' | null>(null);
  /**
   * The walkthrough signs the student in on arrival. `?manual=1` turns that off, which
   * is how staff and administrators reach the form without racing the redirect.
   */
  const manual = params.get('manual') === '1';
  const [autoState, setAutoState] = useState<'idle' | 'running' | 'failed'>(manual ? 'idle' : 'running');
  const autoAttempted = useRef(false);

  const enter = useCallback(
    async (target: string, targetPassword: string, tag: Role | 'form') => {
      setBusy(tag);
      setError(null);
      try {
        const account = await signIn(target, targetPassword);
        router.replace(HOME_FOR[account.role]);
        return true;
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Sign in failed. Please try again.');
        return false;
      } finally {
        setBusy(null);
      }
    },
    [router, signIn],
  );

  // Already signed in: never show a sign-in form to someone who has a session.
  useEffect(() => {
    if (!loading && user) router.replace(HOME_FOR[user.role]);
  }, [loading, user, router]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const payload = await api<{ password: string; accounts: DemoAccount[] }>('/auth/demo-accounts', { token: null });
        if (cancelled) return;
        setAccounts(payload.accounts);
        setDemoPassword(payload.password);

        if (manual || autoAttempted.current) return;
        autoAttempted.current = true;
        const student = payload.accounts.find((account) => account.role === 'STUDENT');
        if (!student) {
          setAutoState('failed');
          return;
        }
        const ok = await enter(student.email, payload.password, 'STUDENT');
        if (!ok && !cancelled) setAutoState('failed');
      } catch {
        if (!cancelled) setAutoState('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enter, manual]);

  const showForm = manual || autoState === 'failed';

  return (
    <main className="shell" style={{ paddingBlock: 48, maxWidth: 560 }}>
      <p className="eyebrow">CampusFlow · IAI Cameroun</p>
      <h1 style={{ marginTop: 8 }}>Sign in</h1>

      {expired ? (
        <p className="notice noticeError" role="status" style={{ marginTop: 18 }}>
          Your session ended — the server was restarted or twelve hours have passed. Sign in again and you will come
          straight back.
        </p>
      ) : null}

      {autoState === 'running' && !manual ? (
        <p className="notice" role="status" style={{ marginTop: 18 }}>
          Signing you in as the walkthrough student…
        </p>
      ) : null}

      {autoState === 'failed' ? (
        <p className="notice noticeError" role="status" style={{ marginTop: 18 }}>
          The automatic student sign-in did not complete. Use an account below.
        </p>
      ) : null}

      {error ? (
        <p className="notice noticeError" role="alert" style={{ marginTop: 14 }}>
          {error}
        </p>
      ) : null}

      {accounts.length > 0 ? (
        <section className="card" style={{ marginTop: 18 }}>
          <p className="eyebrow">One-click walkthrough accounts</p>
          <p className="muted" style={{ marginTop: 6 }}>
            Seeded accounts for this preview. They are real sign-ins: the server issues a token and checks the role on every
            request afterwards.
          </p>
          <div className="grid" style={{ gap: 8, marginTop: 12 }}>
            {accounts.map((account) => (
              <button
                key={account.email}
                type="button"
                className="btn btnGhost"
                disabled={busy !== null}
                onClick={() => void enter(account.email, demoPassword, account.role)}
                style={{ justifyContent: 'space-between' }}
              >
                <span>
                  <strong>{account.role === 'STUDENT' ? 'Student' : account.role === 'STAFF' ? 'Staff — Scolarité' : 'Administrator'}</strong>
                  <span className="muted" style={{ marginLeft: 8 }}>{account.name}</span>
                </span>
                <span aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {showForm ? (
        <form
          className="card"
          style={{ marginTop: 18 }}
          onSubmit={(event) => {
            event.preventDefault();
            void enter(email.trim(), password, 'form');
          }}
        >
          <p className="eyebrow">Your campus account</p>
          <label className="field" style={{ marginTop: 12 }}>
            <span>Email address</span>
            <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button type="submit" className="btn" disabled={busy !== null} style={{ width: '100%' }}>
            {busy === 'form' ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      ) : (
        <p className="muted" style={{ marginTop: 16 }}>
          <Link href="/login?manual=1">Sign in with another account instead</Link>
        </p>
      )}

      <p className="muted" style={{ marginTop: 18 }}>
        New here? <Link href="/register">Create a student account</Link>.
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="shell" style={{ paddingBlock: 48 }}><div className="skeleton" style={{ maxWidth: 320 }} /></main>}>
      <LoginScreen />
    </Suspense>
  );
}
