'use client';

import { useAsync, relativeTime } from '../../../../lib/hooks';
import { adminApi } from '../../../../lib/api/endpoints';
import { Card, CardSkeleton, EmptyState, ErrorState, Progress, SectionHeading, Stat } from '../../../../components/ui/kit';
import { PageHeader } from '../../../../components/layout/app-shell';
import { BarChart } from '../../../../components/admin/table';

export default function AdminAnalyticsPage() {
  const analytics = useAsync(() => adminApi.analytics(), []);

  if (analytics.error) {
    return (
      <div>
        <PageHeader title="Analytics" />
        <ErrorState message={analytics.error} onRetry={analytics.reload} />
      </div>
    );
  }

  if (analytics.loading || !analytics.data) {
    return (
      <div>
        <PageHeader title="Analytics" description="Live aggregates over campus records" />
        <CardSkeleton rows={5} />
        <CardSkeleton rows={5} />
      </div>
    );
  }

  const data = analytics.data;
  const utilisation = data.utilisation.slice(0, 10);

  return (
    <div>
      <PageHeader
        title="Analytics"
        description={`Aggregated ${relativeTime(data.generated_at)} from queues, offices, navigation sessions and the timetable.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active users (7d)" value={data.users.active_7d} hint={`${data.users.total} accounts`} />
        <Stat label="Tickets issued (7d)" value={data.queues.issued_7d} hint={`${data.queues.issued_today} today`} />
        <Stat
          label="Average service"
          value={data.queues.average_service_minutes === null ? '—' : `${data.queues.average_service_minutes} min`}
          hint="room queues, completed visits"
        />
        <Stat
          label="No-show rate (7d)"
          value={data.queues.no_show_rate_7d === null ? '—' : `${data.queues.no_show_rate_7d}%`}
          tone={data.queues.no_show_rate_7d !== null && data.queues.no_show_rate_7d > 20 ? 'warning' : 'default'}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeading title="Room utilisation" description="Booked teaching hours against a 45-hour teaching week" />
          {utilisation.length === 0 ? (
            <EmptyState title="No timetable data" description="Once sessions are published utilisation appears here." />
          ) : (
            <ul className="space-y-3">
              {utilisation.map((room) => (
                <li key={room.room_id}>
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="font-medium text-ink-800">
                      {room.room_code} · {room.room_name}
                    </span>
                    <span className="tnum text-ink-500">
                      {room.booked_hours} h · {room.utilisation}%
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <Progress value={room.utilisation} tone={room.utilisation > 85 ? 'signal' : room.utilisation > 50 ? 'brand' : 'success'} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionHeading title="Most requested rooms" description="Tickets issued in the last 7 days" />
          {data.queues.busiest_rooms.length === 0 ? (
            <p className="text-[13px] text-ink-500">No queue tickets have been issued this week.</p>
          ) : (
            <BarChart data={data.queues.busiest_rooms as unknown as Record<string, unknown>[]} labelKey="room_code" valueKey="issued" />
          )}
        </Card>

        <Card>
          <SectionHeading title="Office demand" description="Tickets issued per office" />
          {data.offices.busiest.length === 0 ? (
            <p className="text-[13px] text-ink-500">No office tickets have been issued this week.</p>
          ) : (
            <BarChart data={data.offices.busiest as unknown as Record<string, unknown>[]} labelKey="name" valueKey="issued" tone="mint" />
          )}
        </Card>

        <Card>
          <SectionHeading title="Navigation destinations" description="Where students were heading" />
          {data.navigation.popular_destinations.length === 0 ? (
            <p className="text-[13px] text-ink-500">No navigation sessions recorded yet.</p>
          ) : (
            <BarChart data={data.navigation.popular_destinations as unknown as Record<string, unknown>[]} labelKey="label" valueKey="sessions" tone="signal" />
          )}
        </Card>

        <Card>
          <SectionHeading title="Tickets by hour" description="Today, campus time" />
          <BarChart data={data.queues.hourly_volume as unknown as Record<string, unknown>[]} labelKey="hour" valueKey="tickets" />
        </Card>

        <Card>
          <SectionHeading title="Campus inventory" />
          <dl className="grid grid-cols-2 gap-3 text-[13px]">
            <div className="rounded-[10px] bg-ink-50 px-3 py-2.5">
              <dt className="text-[11.5px] text-ink-500">Buildings</dt>
              <dd className="tnum text-[17px] font-semibold text-ink-900">{data.campus.buildings}</dd>
            </div>
            <div className="rounded-[10px] bg-ink-50 px-3 py-2.5">
              <dt className="text-[11.5px] text-ink-500">Floors</dt>
              <dd className="tnum text-[17px] font-semibold text-ink-900">{data.campus.floors}</dd>
            </div>
            <div className="rounded-[10px] bg-ink-50 px-3 py-2.5">
              <dt className="text-[11.5px] text-ink-500">Rooms</dt>
              <dd className="tnum text-[17px] font-semibold text-ink-900">{data.campus.rooms}</dd>
            </div>
            <div className="rounded-[10px] bg-ink-50 px-3 py-2.5">
              <dt className="text-[11.5px] text-ink-500">Total seats</dt>
              <dd className="tnum text-[17px] font-semibold text-ink-900">{data.campus.total_capacity}</dd>
            </div>
            <div className="rounded-[10px] bg-ink-50 px-3 py-2.5">
              <dt className="text-[11.5px] text-ink-500">QR anchors</dt>
              <dd className="tnum text-[17px] font-semibold text-ink-900">{data.campus.qr_nodes}</dd>
            </div>
            <div className="rounded-[10px] bg-ink-50 px-3 py-2.5">
              <dt className="text-[11.5px] text-ink-500">Graph edges</dt>
              <dd className="tnum text-[17px] font-semibold text-ink-900">{data.campus.navigation_edges}</dd>
            </div>
          </dl>
          <p className="mt-3 text-[12px] text-ink-500">
            {data.navigation.recalculations_7d} route recalculations and {data.navigation.off_route_events_7d} off-route events this week. Average planned walk{' '}
            {data.navigation.average_distance_m === null ? '—' : `${data.navigation.average_distance_m} m`}.
          </p>
        </Card>
      </div>
    </div>
  );
}
