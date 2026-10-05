'use client';

import { useEffect, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { useRequireRole } from '@/lib/session';
import type { Announcement } from '@/lib/types';

/** Staff content management: publishing an announcement notifies every student of the institution. */
export default function StaffPublishPage() {
  const { user, loading } = useRequireRole('STAFF', 'ADMIN');
  const [form, setForm] = useState({ title: '', body: '', priority: 'NORMAL' });
  const [published, setPublished] = useState<Announcement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    void api<{ items: Announcement[] }>(`/announcements?university=${user.universitySlug}`)
      .then((payload) => setPublished(payload.items))
      .catch(() => setError('Published announcements could not be loaded.'));
  }, [user]);

  if (loading || !user) {
    return (
      <main className="shell" style={{ paddingBlock: 40 }}>
        <div className="skeleton" style={{ maxWidth: 280, height: 26 }} />
      </main>
    );
  }

  return (
    <main className="shell" style={{ paddingBlock: 36, maxWidth: 820 }}>
      <p className="eyebrow">Content management</p>
      <h1 style={{ marginTop: 8 }}>Publish an announcement</h1>
      {error ? <p className="notice noticeError" style={{ marginTop: 14 }}>{error}</p> : null}
      {ok ? <p className="notice noticeOk" style={{ marginTop: 14 }}>{ok}</p> : null}

      <form
        className="card"
        style={{ marginTop: 18 }}
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError(null);
          setOk(null);
          try {
            const payload = await api<{ announcement: Announcement }>('/announcements', {
              method: 'POST',
              body: { title: form.title.trim(), body: form.body.trim(), priority: form.priority },
            });
            setPublished((current) => [payload.announcement, ...current]);
            setOk('Published. Every student of your institution has been notified.');
            setForm({ title: '', body: '', priority: 'NORMAL' });
          } catch (caught) {
            setError(caught instanceof ApiError ? caught.message : 'The announcement could not be published.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          <span>Title</span>
          <input required minLength={4} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </label>
        <label className="field">
          <span>Message</span>
          <textarea required minLength={4} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} />
        </label>
        <label className="field">
          <span>Priority</span>
          <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </label>
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Publishing…' : 'Publish announcement'}
        </button>
      </form>

      <section className="card" style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 18 }}>Already published</h2>
        <ul className="list" style={{ marginTop: 12 }}>
          {published.map((announcement) => (
            <li key={announcement.id} className="row">
              <span>
                <strong style={{ display: 'block' }}>{announcement.title}</strong>
                <span className="muted">{new Date(announcement.publishedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </span>
              <span className={announcement.priority === 'URGENT' ? 'tag tagRed' : announcement.priority === 'HIGH' ? 'tag tagGold' : 'tag tagPlain'}>
                {announcement.priority}
              </span>
            </li>
          ))}
          {published.length === 0 ? <li className="muted">Nothing published yet.</li> : null}
        </ul>
      </section>
    </main>
  );
}
