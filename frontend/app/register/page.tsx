'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/auth-context';
import { Button, Field, Input, SegmentedControl } from '../../components/ui/kit';
import { useToast } from '../../components/ui/toast';
import { ApiError } from '../../lib/api/client';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const toast = useToast();
  const [role, setRole] = useState<'student' | 'staff'>('student');
  const [form, setForm] = useState({ name: '', email: '', password: '', registration_no: '', department: '' });
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
      const user = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role,
        registration_no: form.registration_no.trim() || undefined,
        department: form.department.trim() || undefined,
      });
      toast.success('Account created', 'You are signed in and ready to go.');
      router.replace(user.role_code === 'staff' ? '/staff' : '/dashboard');
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
          Student accounts are created immediately. Staff accounts are activated by an administrator — you will see the student areas until then.
        </p>

        <div className="mt-6">
          <SegmentedControl
            value={role}
            onChange={setRole}
            options={[
              { value: 'student', label: 'Student' },
              { value: 'staff', label: 'Staff member' },
            ]}
          />
        </div>

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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={role === 'student' ? 'Registration number' : 'Staff number'} htmlFor="registration_no" error={fieldErrors.registration_no?.[0]}>
              <Input id="registration_no" value={form.registration_no} onChange={update('registration_no')} placeholder={role === 'student' ? '2026-0110' : 'STF-1010'} />
            </Field>
            <Field label="Department" htmlFor="department" error={fieldErrors.department?.[0]}>
              <Input id="department" value={form.department} onChange={update('department')} placeholder="Computer Science" />
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
