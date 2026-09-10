'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/auth-context';
import { Button, Field, Input } from '../../components/ui/kit';
import { useToast } from '../../components/ui/toast';
import { ApiError } from '../../lib/api/client';

const DEMO_ACCOUNTS = [
  { role: 'Student', email: 'student@campusflow.dev', hint: 'Sofia Alvarez · Computer Science' },
  { role: 'Staff', email: 'staff@campusflow.dev', hint: 'Priya Raman · Student Services' },
  { role: 'Administrator', email: 'admin@campusflow.dev', hint: 'Amara Osei · Facilities & IT' },
];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await login(email.trim(), password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
      router.replace(user.role_code === 'admin' ? '/admin' : user.role_code === 'staff' ? '/staff' : '/dashboard');
    } catch (caught) {
      const message = caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Sign in failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -top-32 -right-24 h-[380px] w-[380px] rounded-full bg-brand-600/30 blur-3xl" />
        <Link href="/" className="relative flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-[15px] font-bold">CF</span>
          <span className="text-[15px] font-semibold">CampusFlow</span>
        </Link>
        <div className="relative max-w-md">
          <h1 className="text-3xl leading-tight font-semibold tracking-tight">Your campus, in one place.</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-white/70">
            Timetables, indoor navigation, room queues and administrative offices — all connected, all live.
          </p>
          <ul className="mt-8 space-y-3 text-[13.5px] text-white/70">
            {['Scan a QR anchor to place yourself indoors', 'Join a room queue and watch your position move', 'Book a slot at the registrar in two taps'].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-signal-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-[12px] text-white/40">Northfield University · demo deployment</p>
      </div>

      <div className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-[14px] font-bold text-white">CF</span>
            <span className="text-[15px] font-semibold text-ink-900">CampusFlow</span>
          </Link>

          <h1 className="text-[24px] font-semibold text-ink-900">Sign in</h1>
          <p className="mt-1 text-[13.5px] text-ink-500">Use your campus account. Students sign in with their registration details.</p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <Field label="Email address" htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@campusflow.dev"
              />
            </Field>
            <Field label="Password" htmlFor="password" error={error}>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
              />
            </Field>

            <Button type="submit" size="lg" loading={loading} className="w-full">
              Sign in
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between text-[13px]">
            <Link href="/forgot-password" className="font-medium text-brand-600 hover:text-brand-700">
              Forgot your password?
            </Link>
            <Link href="/register" className="font-medium text-ink-600 hover:text-ink-800">
              Create an account
            </Link>
          </div>

          <div className="mt-8 rounded-[var(--radius-card)] border border-ink-100 bg-white p-4">
            <p className="text-[12.5px] font-medium text-ink-700">Demo accounts</p>
            <p className="mt-0.5 text-[12px] text-ink-500">Password for all seeded accounts: <span className="font-mono">CampusFlow2026!</span></p>
            <div className="mt-3 space-y-1.5">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword('CampusFlow2026!');
                    setError(null);
                  }}
                  className="flex w-full items-center justify-between rounded-[10px] border border-ink-100 px-3 py-2 text-left transition-colors hover:border-brand-200 hover:bg-brand-50/50"
                >
                  <span>
                    <span className="block text-[12.5px] font-medium text-ink-800">{account.role}</span>
                    <span className="block text-[11.5px] text-ink-500">{account.hint}</span>
                  </span>
                  <span className="text-[11.5px] font-medium text-brand-600">Use</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
