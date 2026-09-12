'use client';

import { useAsync, formatClock, relativeTime } from '@/lib/hooks';
import { campusApi, publicApi } from '@/lib/api/endpoints';
import { Badge, Card, CardSkeleton, ErrorState } from '@/components/ui/kit';
import { PageHeader } from '@/components/layout/app-shell';

export default function StatusPage() {
  // This page is readable without signing in, so it is fed entirely by `/public/*`. That is not a
  // stylistic choice: `/campus/*` and `/student/*` would answer a visitor with 401, and the queue and
  // office *lines* behind them are resident data. Visitors get service health and desk hours; the
  // number of people waiting in a corridor is not public information.
  const health = useAsync(() => campusApi.health(), []);
  const overview = useAsync(() => publicApi.overview(), []);
  const offices = useAsync(() => publicApi.offices(), []);

  const openOffices = (offices.data?.offices ?? []).filter((office) => office.is_open).length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Service status"
        description="Live health of the CampusFlow platform — the same figures the API reports to the operations team."
      />

      {health.error ? <ErrorState message={health.error} onRetry={health.reload} /> : null}

      {health.loading ? (
        <CardSkeleton rows={4} />
      ) : health.data ? (
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-mint-50 text-mint-600">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-ink-900">API is healthy</p>
                  <p className="text-[12.5px] text-ink-500">Checked {relativeTime(health.data.time)}</p>
                </div>
              </div>
              <Badge tone="success">Operational</Badge>
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[12px] bg-ink-50 px-4 py-3">
                <dt className="text-[12px] text-ink-500">Database</dt>
                <dd className="mt-1 text-[14px] font-medium text-ink-800">{health.data.database.engine}</dd>
              </div>
              <div className="rounded-[12px] bg-ink-50 px-4 py-3">
                <dt className="text-[12px] text-ink-500">Query latency</dt>
                <dd className="tnum mt-1 text-[14px] font-medium text-ink-800">{health.data.database.latency_ms} ms</dd>
              </div>
              <div className="rounded-[12px] bg-ink-50 px-4 py-3">
                <dt className="text-[12px] text-ink-500">Server time</dt>
                <dd className="tnum mt-1 text-[14px] font-medium text-ink-800">{formatClock(health.data.time)}</dd>
              </div>
            </dl>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <p className="text-[13px] font-semibold text-ink-800">Mapped campus</p>
              <p className="mt-1 text-[12.5px] text-ink-500">
                {overview.loading
                  ? 'Checking…'
                  : `${overview.data?.stats.buildings ?? 0} buildings · ${overview.data?.stats.rooms ?? 0} rooms · ${overview.data?.stats.seats ?? 0} seats`}
              </p>
              <p className="mt-3 text-[12px] leading-relaxed text-ink-500">
                Live queue lengths, room occupancy and timetables are available to signed-in students, staff and
                administration — not to the open internet.
              </p>
            </Card>

            <Card>
              <p className="text-[13px] font-semibold text-ink-800">Administrative offices</p>
              <p className="mt-1 text-[12.5px] text-ink-500">
                {offices.loading ? 'Checking…' : `${offices.data?.offices.length ?? 0} published · ${openOffices} open now`}
              </p>
              {offices.data?.offices.length ? (
                <ul className="mt-3 space-y-2">
                  {offices.data.offices.map((office) => (
                    <li key={office.id} className="flex items-center justify-between text-[12.5px]">
                      <span className="text-ink-700">
                        {office.name}
                        {office.opening_hours ? <span className="text-ink-400"> · {office.opening_hours}</span> : null}
                      </span>
                      <Badge tone={office.is_open ? 'success' : 'neutral'}>{office.is_open ? 'Open' : 'Closed'}</Badge>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
