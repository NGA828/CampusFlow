import Link from 'next/link';
import { api } from '@/lib/api';
import { DirectoryMap } from '@/components/directory-map';
import type { Announcement, CampusEvent, University } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** The visitor experience: public directory, public campus life, and a way in. */
export default async function LandingPage() {
  const [directory, events, notices] = await Promise.all([
    api<{ total: number; items: University[] }>('/universities').catch(() => null),
    api<{ items: CampusEvent[] }>('/events').catch(() => ({ items: [] as CampusEvent[] })),
    api<{ items: Announcement[] }>('/announcements').catch(() => ({ items: [] as Announcement[] })),
  ]);

  return (
    <main>
      <section style={{ background: 'var(--ink-950)', color: 'white', paddingBlock: '56px 64px' }}>
        <div className="shell">
          <p className="eyebrow" style={{ color: 'var(--gold-500)' }}>Yaoundé · Cameroun</p>
          <h1 style={{ marginTop: 10, maxWidth: 760 }}>
            Find your institution, then find your way inside it.
          </h1>
          <p style={{ marginTop: 14, maxWidth: 640, color: 'rgba(255,255,255,0.72)' }}>
            CampusFlow maps the universities and grandes écoles of Yaoundé, guides students across the IAI Cameroun campus
            indoors and out, and turns an administrative visit into a booking instead of a queue.
          </p>
          {/*
            Three seats, three different products. The landing page used to offer only
            "Sign in as a student", so staff and administrators had no way in from here.
          */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
            <Link href="/login?role=STUDENT" className="btn">Sign in as a student</Link>
            <Link href="/login?role=STAFF" className="btn btnGhost" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}>
              Sign in as staff
            </Link>
            <Link href="/login?role=ADMIN" className="btn btnGhost" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}>
              Sign in as an administrator
            </Link>
          </div>
          <p style={{ marginTop: 12, fontSize: 13.5, color: 'rgba(255,255,255,0.6)' }}>
            New student? <Link href="/register" style={{ color: 'var(--gold-500)' }}>Create an account</Link>. Or{' '}
            <Link href="/login" style={{ color: 'var(--gold-500)' }}>sign in with your own credentials</Link>.
          </p>
          <dl className="grid cols3" style={{ marginTop: 34, color: 'white' }}>
            {[
              { label: 'Institutions listed', value: directory ? String(directory.total) : '—' },
              { label: 'Campus mapped indoors', value: 'IAI Cameroun' },
              { label: 'Published this week', value: `${events.items.length} events · ${notices.items.length} notices` },
            ].map((stat) => (
              <div key={stat.label} style={{ border: '1px solid rgba(255,255,255,0.14)', borderRadius: 14, padding: '14px 16px' }}>
                <dt style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{stat.label}</dt>
                <dd style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 700 }}>{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="shell" style={{ paddingBlock: 40 }}>
        <p className="eyebrow">Verified directory</p>
        <h2 style={{ marginTop: 6 }}>Higher education in Yaoundé</h2>
        <p className="muted" style={{ marginTop: 8, maxWidth: 680 }}>
          Public universities, grandes écoles, private institutes and the military academy — each entry carries the source it
          came from, and says how precisely it is located.
        </p>
        <div style={{ marginTop: 20 }}>
          {directory ? (
            <DirectoryMap universities={directory.items} />
          ) : (
            <p className="notice noticeError">
              The directory could not be loaded because the CampusFlow API is not reachable.
            </p>
          )}
        </div>
      </section>

      <section className="shell" style={{ paddingBlock: '10px 10px' }}>
        <p className="eyebrow">Three ways in</p>
        <h2 style={{ marginTop: 6 }}>What each account sees</h2>
        <div className="grid cols3" style={{ marginTop: 18 }}>
          {[
            {
              role: 'STUDENT',
              title: 'Student',
              lead: 'Find a room, get there, book a meeting.',
              does: ['Campus map, indoor routes and step-free mode', 'QR scan for an indoor position (mobile)', 'Request an administrative room', 'Events, announcements and notifications'],
            },
            {
              role: 'STAFF',
              title: 'Staff — Scolarité',
              lead: 'Decide requests, publish what students must know.',
              does: ['Approve or decline room requests with a note', 'Publish announcements to the whole institution', 'See every booking and its decision', 'The student is notified either way'],
            },
            {
              role: 'ADMIN',
              title: 'Administrator',
              lead: 'Accounts, campuses and the directory behind it all.',
              does: ['Create staff and administrator accounts', 'Review every account on the platform', 'See the institution directory and its sources', 'Everything the scolarité can do'],
            },
          ].map((seat) => (
            <article key={seat.role} className="card">
              <p className="eyebrow">{seat.title}</p>
              <p style={{ marginTop: 6, fontWeight: 600 }}>{seat.lead}</p>
              <ul className="list" style={{ marginTop: 10 }}>
                {seat.does.map((line) => (
                  <li key={line} className="muted" style={{ fontSize: 13.5 }}>{line}</li>
                ))}
              </ul>
              <Link href={`/login?role=${seat.role}`} className="btn btnSmall" style={{ marginTop: 12 }}>
                Enter as {seat.title.split(' —')[0].toLowerCase()}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="shell" style={{ paddingBlock: '10px 56px' }}>
        <div className="grid cols2">
          <article className="card">
            <p className="eyebrow">Open to visitors</p>
            <h2 style={{ marginTop: 6, fontSize: 20 }}>Campus events</h2>
            <ul className="list" style={{ marginTop: 12 }}>
              {events.items.slice(0, 4).map((event) => (
                <li key={event.id} className="row">
                  <span>
                    <strong style={{ display: 'block' }}>{event.title}</strong>
                    <span className="muted">{event.venue} · {new Date(event.startsAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </span>
                </li>
              ))}
              {events.items.length === 0 ? <li className="muted">No published event yet.</li> : null}
            </ul>
          </article>
          <article className="card">
            <p className="eyebrow">Published by staff</p>
            <h2 style={{ marginTop: 6, fontSize: 20 }}>Announcements</h2>
            <ul className="list" style={{ marginTop: 12 }}>
              {notices.items.slice(0, 4).map((notice) => (
                <li key={notice.id} className="row">
                  <span>
                    <strong style={{ display: 'block' }}>{notice.title}</strong>
                    <span className="muted">{notice.body}</span>
                  </span>
                  <span className={notice.priority === 'URGENT' ? 'tag tagRed' : notice.priority === 'HIGH' ? 'tag tagGold' : 'tag tagPlain'}>
                    {notice.priority}
                  </span>
                </li>
              ))}
              {notices.items.length === 0 ? <li className="muted">No announcement published yet.</li> : null}
            </ul>
          </article>
        </div>
      </section>
    </main>
  );
}
