'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authApi } from '../../lib/api/endpoints';
import { Button, Field, Input } from '../../components/ui/kit';
import { ApiError } from '../../lib/api/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await authApi.forgotPassword({ email: email.trim() });
      setSent(true);
      setResetToken(result.reset_token ?? null);
    } catch (caught) {
      setError(caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'The request failed. Please try again.');
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

        <h1 className="text-[24px] font-semibold text-ink-900">Reset your password</h1>
        <p className="mt-1 text-[13.5px] text-ink-500">
          Enter the email address on your account and we will issue a one-hour reset token.
        </p>

        {sent ? (
          <div className="mt-6 rounded-[var(--radius-card)] border border-mint-200 bg-mint-50 p-5">
            <p className="text-[14px] font-medium text-mint-700">Reset requested</p>
            <p className="mt-1 text-[13px] text-mint-700/90">
              If <span className="font-medium">{email}</span> matches an account, a reset link has been generated.
            </p>
            {resetToken ? (
              <div className="mt-3 rounded-[10px] border border-mint-200 bg-white p-3">
                <p className="text-[12px] font-medium text-ink-600">Development token (this deployment has no mail transport configured)</p>
                <p className="mt-1 font-mono text-[12px] break-all text-ink-800">{resetToken}</p>
                <Link href={`/reset-password?token=${encodeURIComponent(resetToken)}`} className="mt-2 inline-block text-[12.5px] font-medium text-brand-600 hover:text-brand-700">
                  Continue to reset →
                </Link>
              </div>
            ) : null}
            <Link href="/login" className="mt-4 inline-block text-[13px] font-medium text-brand-600 hover:text-brand-700">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Email address" htmlFor="email" error={error}>
              <Input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@campusflow.dev" autoComplete="email" />
            </Field>
            <Button type="submit" size="lg" loading={loading} className="w-full">
              Send reset instructions
            </Button>
            <Link href="/login" className="block text-center text-[13px] font-medium text-ink-600 hover:text-ink-800">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
