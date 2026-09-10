'use client';

import Link from 'next/link';
import { useAsync, formatClock, relativeTime, statusLabel, STATUS_TONES } from '../../../lib/hooks';
import { staffApi } from '../../../lib/api/endpoints';
import { useAuth } from '../../../lib/auth/auth-context';
import { useRealtimeEvent } from '../../../lib/realtime/realtime-context';
import { Badge, Button, Card, CardSkeleton, EmptyState, ErrorState, SectionHeading, Stat } from '../../../components/ui/kit';
import { PageHeader } from '../../../components/layout/app-shell';

function isNow(starts: string, ends: string): boolean {
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = starts.split(':').map(Number);
  const [eh, em] = ends.split(':').map(Number);
  return current >= (sh ?? 0) * 60 + (sm ?? 0) && current < (eh ?? 0) * 60 + (em ?? 0);
}

export default function StaffDashboardPage() {
  const { user } = useAuth();
  const dashboard = useAsync(() => staffApi.dashboard(), []);

  useRealtimeEvent('staff:ops', () => dashboard.reload(), []);

  if (dashboard.error) {
    return (
      <div>
        <PageHeader title="Staff operations" />
        <ErrorState message={dashboard.error} onRetry={dashboard.reload} />
      </div>
    );
  }

  if (dashboard.loading || !dashboard.data) {
    return (
      <div>
        <PageHeader title="Staff operations" description="Loading your scopes…" />
        <CardSkeleton rows={4} />
        <CardSkeleton rows={4} />
      </div>
    );
  }

  const data = dashboard.data;
  const pending: { id: string; ticket_number: string; student_name: string; status: string }[] = [
    ...data.pending_queue_actions,
    ...data.pending_office_actions,
  ];

  return (
    <div>
      <PageHeader
        title="Staff operations"
        description={`${data.campus_time.date} · ${formatClock(new Date(`${data.campus_time.date}T${data.campus_time.time}`).toISOString())} campus time · you can operate ${data.scopes.queues} queues and ${data.scopes.offices} offices`}
        actions={
          <>
            <Link href="/staff/timetable">
              <Button variant="secondary" size="sm">
                Timetable
              </Button>
            </Link>
            <Link href="/staff/content">
              <Button variant="secondary" size="sm">
                Events & notices
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Served today" value={data.kpis.served_today} hint="students admitted or completed" />
        <Stat label="Waiting now" value={data.kpis.waiting_now} tone={data.kpis.waiting_now > 0 ? 'brand' : 'default'} hint="across your queues" />
        <Stat label="Offices open" value={data.kpis.offices_open} hint="with an active service window" />
      </div>

      {pending.length > 0 ? (
        <Card className="mt-4 border-signal-200 bg-signal-50/50">
          <SectionHeading title="Needs attention" description={`${pending.length} students are called or checked in and waiting for you`} />
          <ul className="space-y-2">
            {pending.slice(0, 6).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-white px-3 py-2">
                <span className="flex items-center gap-2 text-[13px]">
                  <span className="font-mono font-medium text-ink-800">{row.ticket_number}</span>
                  <span className="text-ink-500">{row.student_name ?? 'Student'}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={STATUS_TONES[row.status] ?? 'brand'}>{statusLabel(row.status)}</Badge>
                  <Link href="/staff">
                    <Button size="sm" variant="secondary">
                      Open board
                    </Button>
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeading title="Your room queues" description={data.queues.length === 0 ? 'No queues are assigned to you' : `${data.queues.length} queues`} />
          {data.queues.length === 0 ? (
            <EmptyState
              title="No queue scopes"
              description="An administrator must assign you a building, room or queue before you can call tickets."
            />
          ) : (
            <ul className="space-y-2">
              {data.queues.map((queue) => (
                <li key={queue.queue_id} className="rounded-[12px] border border-ink-100 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[13.5px] font-semibold text-ink-900">
                        {queue.room_code} · {queue.room_name}
                      </p>
                      <p className="text-[12px] text-ink-500">
                        {queue.building_code} · {queue.floor_name} · {queue.is_active ? 'open' : 'closed'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tnum text-[13px] text-ink-600">
                        {queue.waiting} waiting · {queue.occupying} inside
                      </span>
                      <Link href={`/staff/queues/${queue.queue_id}`}>
                        <Button size="sm">Operate</Button>
                      </Link>
                    </div>
                  </div>
                  {queue.current ? (
                    <p className="mt-2 text-[12px] text-ink-500">
                      Now serving <span className="font-mono text-ink-700">{queue.current.ticket_number}</span> ·{' '}
                      {statusLabel(queue.current.status)}
                    </p>
                  ) : (
                    <p className="mt-2 text-[12px] text-ink-400">No one is currently being served.</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionHeading title="Your offices" description={data.offices.length === 0 ? 'No offices are assigned to you' : `${data.offices.length} offices`} />
          {data.offices.length === 0 ? (
            <EmptyState title="No office scopes" description="Ask an administrator to assign you to an administrative office." />
          ) : (
            <ul className="space-y-2">
              {data.offices.map((office) => (
                <li key={office.office_id} className="rounded-[12px] border border-ink-100 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[13.5px] font-semibold text-ink-900">{office.name}</p>
                      <p className="text-[12px] text-ink-500">
                        {office.building_code} · {office.floor_name}
                        {office.room_code ? ` · ${office.room_code}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tnum text-[13px] text-ink-600">
                        {office.waiting} waiting · {office.in_service} in service
                      </span>
                      <Link href={`/staff/offices/${office.office_id}`}>
                        <Button size="sm">Operate</Button>
                      </Link>
                    </div>
                  </div>
                  <p className="mt-2 text-[12px] text-ink-500">
                    {office.completed_today} served today
                    {office.current ? ` · now serving ${office.current.ticket_number}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <SectionHeading title="Your teaching today" description={data.teaching_today.length === 0 ? 'No sessions on your timetable today' : `${data.teaching_today.length} sessions`} />
        {data.teaching_today.length === 0 ? (
          <p className="text-[13px] text-ink-500">Nothing scheduled — a quiet day.</p>
        ) : (
          <ul className="divide-y divide-ink-50">
            {data.teaching_today.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-[13.5px] font-medium text-ink-800">
                    {entry.course_code} · {entry.course_title}
                  </p>
                  <p className="text-[12.5px] text-ink-500">
                    {entry.room_code ?? 'Room TBA'} · {entry.session_type}
                  </p>
                </div>
                <div className="tnum text-[12.5px] text-ink-600">
                  {entry.starts_at} – {entry.ends_at}
                  {isNow(entry.starts_at, entry.ends_at) ? <Badge tone="success">Now</Badge> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-4 text-[12px] text-ink-400">
        Signed in as {user?.name} · {data.scopes.queues + data.scopes.offices} operational scopes · updated {relativeTime(new Date().toISOString())}
      </p>
    </div>
  );
}
