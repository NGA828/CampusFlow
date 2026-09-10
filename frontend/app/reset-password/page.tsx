'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { authApi } from '../../lib/api/endpoints';
import { Button, Field, Input } from '../../components/ui/kit';
import { ApiError } from '../../lib/api/client';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center text-[13px] text-ink-400">Loading…</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const params = useSearchParams();
  const [token, setToken] = useState(params.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await authApi.resetPassword({ token: token.trim(), password });
      setDone(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'The reset failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-[14px] font-bold text-white">CF</span>
          <span className="text-[15px] font-semibold text-ink-900">CampusFlow</span>
        </Link>

        <h1 className="text-[24px] font-semibold text-ink-900">Choose a new password</h1>

        {done ? (
          <div className="mt-6 rounded-[var(--radius-card)] border border-mint-200 bg-mint-50 p-5">
            <p className="text-[14px] font-medium text-mint-700">Password updated</p>
            <p className="mt-1 text-[13px] text-mint-700/90">Every existing session was signed out. Sign in with your new password.</p>
            <Link href="/login" className="mt-3 inline-block text-[13px] font-medium text-brand-600 hover:text-brand-700">
              Go to sign in →
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Reset token" htmlFor="token" hint="Paste the token from the reset email.">
              <Input id="token" required value={token} onChange={(event) => setToken(event.target.value)} className="font-mono text-[12.5px]" />
            </Field>
            <Field label="New password" htmlFor="password" error={error}>
              <Input id="password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
            </Field>
            <Field label="Confirm new password" htmlFor="confirm">
              <Input id="confirm" type="password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" />
            </Field>
            <Button type="submit" size="lg" loading={loading} className="w-full">
              Update password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
