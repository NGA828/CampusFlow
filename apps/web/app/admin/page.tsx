'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, api, isSignedOut } from '@/lib/api';
import { useRequireRole } from '@/lib/session';
import type { SessionUser, University } from '@/lib/types';

/** Administration: accounts, and the directory the whole platform is built on. */
export default function AdminPage() {
  const { user, loading } = useRequireRole('ADMIN');
  const [people, setPeople] = useState<SessionUser[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'STAFF', universitySlug: 'iai-cameroun' });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const payload = await api<{ items: SessionUser[] }>('/admin/users');
    setPeople(payload.items);
  }, []);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const [directory] = await Promise.all([api<{ items: University[] }>('/universities'), refresh()]);
        setUniversities(directory.items);
      } catch (caught) {
        if (isSignedOut(caught)) return;
        setError('Administration data could not be loaded.');
      }
    })();
  }, [user, refresh]);

  if (loading || !user) {
    return (
      <main className="shell" style={{ paddingBlock: 40 }}>
        <div className="skeleton" style={{ maxWidth: 280, height: 26 }} />
      </main>
    );
  }

  const counts = {
    students: people.filter((person) => person.role === 'STUDENT').length,
    staff: people.filter((person) => person.role === 'STAFF').length,
    admins: people.filter((person) => person.role === 'ADMIN').length,
  };

  return (
    <main className="shell" style={{ paddingBlock: 36 }}>
      <p className="eyebrow">Administration</p>
      <h1 style={{ marginTop: 8 }}>Accounts, campuses and the directory</h1>
      {error ? <p className="notice noticeError" style={{ marginTop: 14 }}>{error}</p> : null}
      {ok ? <p className="notice noticeOk" style={{ marginTop: 14 }}>{ok}</p> : null}

      <div className="grid cols3" style={{ marginTop: 20 }}>
        {[
          { label: 'Students', value: counts.students },
          { label: 'Staff', value: counts.staff },
          { label: 'Administrators', value: counts.admins },
          { label: 'Institutions in the directory', value: universities.length },
          { label: 'Private institutions', value: universities.filter((item) => item.type === 'PRIVATE').length },
          { label: 'Campuses mapped indoors', value: universities.filter((item) => item.indoorMappingPriority === 1).length },
        ].map((stat) => (
          <div key={stat.label} className="card">
            <p className="muted">{stat.label}</p>
            <p style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(300px, 400px) 1fr', marginTop: 20, alignItems: 'start' }}>
        <form
          className="card"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError(null);
            setOk(null);
            try {
              await api('/admin/users', { method: 'POST', body: { ...form, email: form.email.trim(), name: form.name.trim() } });
              setOk(`${form.role.toLowerCase()} account created for ${form.email.trim()}.`);
              setForm({ ...form, name: '', email: '', password: '' });
              await refresh();
            } catch (caught) {
              setError(caught instanceof ApiError ? caught.message : 'The account could not be created.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="eyebrow">Issue an account</p>
          <h2 style={{ marginTop: 6, fontSize: 18 }}>New staff or administrator</h2>
          <label className="field" style={{ marginTop: 12 }}>
            <span>Full name</span>
            <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label className="field">
            <span>Email</span>
            <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
          <label className="field">
            <span>Temporary password</span>
            <input required minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </label>
          <label className="field">
            <span>Role</span>
            <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Administrator</option>
              <option value="STUDENT">Student</option>
            </select>
          </label>
          <label className="field">
            <span>Institution</span>
            <select value={form.universitySlug} onChange={(event) => setForm({ ...form, universitySlug: event.target.value })}>
              {universities.map((university) => (
                <option key={university.slug} value={university.slug}>
                  {university.shortName}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn" disabled={busy} style={{ width: '100%' }}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <section className="card">
          <p className="eyebrow">Accounts</p>
          <ul className="list scroller" style={{ marginTop: 12 }}>
            {people.map((person) => (
              <li key={person.id} className="row">
                <span>
                  <strong style={{ display: 'block' }}>{person.name}</strong>
                  <span className="muted">{person.email} · {person.universitySlug}</span>
                </span>
                <span className="tag tagPlain">{person.role}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
