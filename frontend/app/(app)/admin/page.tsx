'use client';

import Link from 'next/link';
import { useAsync, relativeTime, statusLabel } from '../../../lib/hooks';
import { adminApi } from '../../../lib/api/endpoints';
import { useRealtimeEvent } from '../../../lib/realtime/realtime-context';
import { Badge, Button, Card, CardSkeleton, EmptyState, ErrorState, Progress, SectionHeading, Stat } from '../../../components/ui/kit';
import { PageHeader } from '../../../components/layout/app-shell';
import { BarChart } from '../../../components/admin/table';

export default function AdminOverviewPage() {
  const dashboard = useAsync(() => adminApi.dashboard(), []);

  useRealtimeEvent('admin:ops', () => dashboard.reload(), []);

  if (dashboard.error) {
    return (
      <div>
        <PageHeader title="Administration" />
        <ErrorState message={dashboard.error} onRetry={dashboard.reload} />
      </div>
    );
  }

  if (dashboard.loading || !dashboard.data) {
    return (
      <div>
        <PageHeader title="Administration" description="Live campus KPIs" />
        <CardSkeleton rows={4} />
        <CardSkeleton rows={4} />
      </div>
    );
  }

  const { kpis, overview, live_queues: liveQueues, recent_audit: recentAudit, buildings } = dashboard.data;

  return (
    <div>
      <PageHeader
        title="Administration"
        description={`Live figures generated ${relativeTime(kpis.generated_at)} from campus records — nothing here is a placeholder.`}
        actions={
          <>
            <Link href="/admin/analytics">
              <Button variant="secondary" size="sm">
                Analytics
              </Button>
            </Link>
            <Link href="/admin/services">
              <Button size="sm">Queues & offices</Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Students" value={kpis.students} hint={`${overview.users.active_7d} active in the last 7 days`} />
        <Stat label="Waiting now" value={kpis.waiting_now} tone={kpis.waiting_now > 0 ? 'brand' : 'default'} hint={`${kpis.office_waiting_now} at offices`} />
        <Stat label="Issued today" value={kpis.issued_today} hint={`${kpis.average_wait_minutes ?? '—'} min average wait`} />
        <Stat label="Navigation today" value={kpis.navigation_sessions_today} hint={`${kpis.rooms} rooms across ${kpis.buildings} buildings`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card>
          <SectionHeading title="Busiest rooms" description="Tickets issued in the last 7 days" />
          {overview.queues.busiest_rooms.length === 0 ? (
            <p className="text-[13px] text-ink-500">No queue activity recorded yet.</p>
          ) : (
            <BarChart data={overview.queues.busiest_rooms as unknown as Record<string, unknown>[]} labelKey="room_code" valueKey="issued" />
          )}
        </Card>

        <Card>
          <SectionHeading title="Queue health" />
          <dl className="space-y-3 text-[13px]">
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">Configured queues</dt>
              <dd className="tnum font-medium text-ink-800">{overview.queues.configured}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">Active now</dt>
              <dd className="tnum font-medium text-ink-800">{overview.queues.active}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">Issued this week</dt>
              <dd className="tnum font-medium text-ink-800">{overview.queues.issued_7d}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">Average wait</dt>
              <dd className="tnum font-medium text-ink-800">{overview.queues.average_wait_minutes ?? '—'} min</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">No-show rate (7d)</dt>
              <dd className="tnum font-medium text-ink-800">{overview.queues.no_show_rate_7d === null ? '—' : `${overview.queues.no_show_rate_7d}%`}</dd>
            </div>
          </dl>
          <div className="mt-4">
            <p className="mb-2 text-[12px] font-medium text-ink-600">Tickets by hour today</p>
            <BarChart data={overview.queues.hourly_volume as unknown as Record<string, unknown>[]} labelKey="hour" valueKey="tickets" tone="mint" />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <SectionHeading title="Live queues" description={`${liveQueues.length} configured`} />
          {liveQueues.length === 0 ? (
            <EmptyState title="No queues" description="Create a queue from the services screen." />
          ) : (
            <ul className="space-y-3">
              {liveQueues.map((queue) => {
                const load = queue.admission_capacity > 0 ? (queue.occupying / queue.admission_capacity) * 100 : 0;
                return (
                  <li key={queue.queue_id}>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="font-medium text-ink-800">
                        {queue.room_code} · {queue.room_name}
                      </span>
                      <span className="tnum text-ink-500">
                        {queue.waiting} waiting · {queue.occupying} inside
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <Progress value={load} tone={load > 85 ? 'signal' : 'brand'} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <SectionHeading title="Building status" />
          <ul className="divide-y divide-ink-50">
            {buildings.map((building) => (
              <li key={building.id} className="flex items-center justify-between py-2 text-[13px]">
                <span className="font-medium text-ink-800">
                  {building.code} · {building.name}
                </span>
                <Badge tone={building.status === 'operational' ? 'success' : building.status === 'closed' ? 'danger' : 'warning'}>{building.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionHeading title="Recent activity" description="From the audit log" />
          {recentAudit.length === 0 ? (
            <p className="text-[13px] text-ink-500">No activity recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentAudit.map((entry) => (
                <li key={entry.id} className="text-[12.5px]">
                  <p className="text-ink-700">
                    <span className="font-medium">{entry.actor_name ?? 'System'}</span> {statusLabel(entry.action)}
                  </p>
                  <p className="text-[11.5px] text-ink-400">
                    {entry.entity_type ?? '—'} · {relativeTime(entry.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/settings" className="mt-3 inline-block text-[12.5px] font-medium text-brand-600 hover:text-brand-700">
            Open audit log →
          </Link>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Navigation sessions (7d)" value={overview.navigation.sessions_7d} hint={`${overview.navigation.off_route_events_7d} off-route events`} />
        <Stat label="Completion rate" value={overview.navigation.completion_rate_7d === null ? '—' : `${overview.navigation.completion_rate_7d}%`} hint="sessions completed" />
        <Stat label="Office tickets today" value={overview.offices.issued_today} hint={`${overview.offices.completed_today} completed`} />
        <Stat label="Upcoming events" value={overview.engagement.events_upcoming} hint={`${overview.engagement.notifications_7d} notifications sent`} />
      </div>
    </div>
  );
}
