'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, api, setToken } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { SessionUser, University } from '@/lib/types';

/** Public registration creates students only; staff and admin accounts are issued by an administrator. */
export default function RegisterPage() {
  const router = useRouter();
  const { reload } = useSession();
  const [universities, setUniversities] = useState<University[]>([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', matricule: '', universitySlug: 'iai-cameroun' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<{ items: University[] }>('/universities', { token: null })
      .then((payload) => setUniversities(payload.items))
      .catch(() => setUniversities([]));
  }, []);

  const update = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  return (
    <main className="shell" style={{ paddingBlock: 48, maxWidth: 560 }}>
      <p className="eyebrow">Student registration</p>
      <h1 style={{ marginTop: 8 }}>Create your CampusFlow account</h1>
      <p className="muted" style={{ marginTop: 10 }}>
        Choose the institution you attend. Only IAI Cameroun is mapped indoors today — everything else gives you the city
        directory, events and announcements.
      </p>

      {error ? (
        <p className="notice noticeError" role="alert" style={{ marginTop: 16 }}>
          {error}
        </p>
      ) : null}

      <form
        className="card"
        style={{ marginTop: 18 }}
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const session = await api<{ token: string; user: SessionUser }>('/auth/register', {
              method: 'POST',
              token: null,
              body: {
                name: form.name.trim(),
                email: form.email.trim(),
                password: form.password,
                universitySlug: form.universitySlug,
                matricule: form.matricule.trim() || undefined,
              },
            });
            setToken(session.token);
            await reload();
            router.replace('/student');
          } catch (caught) {
            setError(caught instanceof ApiError ? caught.message : 'Your account could not be created.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          <span>Full name</span>
          <input required minLength={2} value={form.name} onChange={update('name')} autoComplete="name" />
        </label>
        <label className="field">
          <span>Email address</span>
          <input required type="email" value={form.email} onChange={update('email')} autoComplete="email" />
        </label>
        <label className="field">
          <span>Password (at least 8 characters)</span>
          <input required type="password" minLength={8} value={form.password} onChange={update('password')} autoComplete="new-password" />
        </label>
        <label className="field">
          <span>Institution</span>
          <select value={form.universitySlug} onChange={update('universitySlug')}>
            {universities.map((university) => (
              <option key={university.slug} value={university.slug}>
                {university.shortName} — {university.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Matricule (optional)</span>
          <input value={form.matricule} onChange={update('matricule')} placeholder="IAI-2026-0481" />
        </label>
        <button type="submit" className="btn" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Creating your account…' : 'Create account'}
        </button>
      </form>

      <p className="muted" style={{ marginTop: 16 }}>
        Already registered? <Link href="/login?manual=1">Sign in</Link>.
      </p>
    </main>
  );
}
