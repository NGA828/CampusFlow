'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { Button, Field, Input } from '@/components/ui/kit';
import { useToast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api/client';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', password: '', password_confirmation: '', registration_no: '', department: '', program: '' });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        password_confirmation: form.password_confirmation,
        registration_no: form.registration_no.trim() || undefined,
        department: form.department.trim() || undefined,
        program: form.program.trim() || undefined,
      });
      toast.success('Account created', 'You are signed in and ready to go.');
      router.replace('/student/dashboard');
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.errors ?? {});
      } else {
        setError('Registration failed. Please try again.');
      }
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

        <h1 className="text-[24px] font-semibold text-ink-900">Create your account</h1>
        <p className="mt-1 text-[13.5px] text-ink-500">
          Sign-up creates a <strong className="font-medium text-ink-700">student</strong> account. Staff and
          administrator accounts are issued by the university — a role is something an institution grants, not
          something you pick here, and the server will refuse anything else. If you were told to expect access,
          sign in with the account you were given.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <Field label="Full name" htmlFor="name" error={fieldErrors.name?.[0]}>
            <Input id="name" required value={form.name} onChange={update('name')} placeholder="Sofia Alvarez" autoComplete="name" />
          </Field>
          <Field label="Email address" htmlFor="email" error={fieldErrors.email?.[0]}>
            <Input id="email" type="email" required value={form.email} onChange={update('email')} placeholder="you@campusflow.dev" autoComplete="email" />
          </Field>
          <Field
            label="Password"
            htmlFor="password"
            hint="At least 8 characters, including a letter and a number."
            error={fieldErrors.password?.[0]}
          >
            <Input id="password" type="password" required value={form.password} onChange={update('password')} autoComplete="new-password" />
          </Field>
          <Field label="Confirm password" htmlFor="password_confirmation" error={fieldErrors.password_confirmation?.[0]}>
            <Input
              id="password_confirmation"
              type="password"
              required
              value={form.password_confirmation}
              onChange={update('password_confirmation')}
              autoComplete="new-password"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Registration number" htmlFor="registration_no" error={fieldErrors.registration_no?.[0]} hint="If your university already issued one.">
              <Input id="registration_no" value={form.registration_no} onChange={update('registration_no')} placeholder="2026-0110" />
            </Field>
            <Field label="Programme" htmlFor="program" error={fieldErrors.program?.[0]}>
              <Input id="program" value={form.program} onChange={update('program')} placeholder="Computer Science" />
            </Field>
          </div>

          {error ? <p className="rounded-[10px] bg-coral-50 px-3 py-2 text-[13px] text-coral-600">{error}</p> : null}

          <Button type="submit" size="lg" loading={loading} className="w-full">
            Create account
          </Button>
        </form>

        <p className="mt-5 text-[13px] text-ink-500">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
