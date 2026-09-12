'use client';

import Link from 'next/link';
import { useAsync, relativeTime } from '@/lib/hooks';
import { staffApi } from '@/lib/api/endpoints';
import { Badge, Button, Card, CardSkeleton, EmptyState, ErrorState, SectionHeading, Stat } from '@/components/ui/kit';
import { PageHeader } from '@/components/layout/app-shell';
import { useRealtimeEvent } from '@/lib/realtime/realtime-context';

/**
 * `/staff/offices` — the service desks this account works.
 *
 * The office twin of the queue board, and just as scoped: the list is built from the desks the user is
 * attached to (`office_staff`, or their department's offices), not from every office on campus with the
 * rest hidden in the browser. A student record shown here is the one the desk is currently serving —
 * enough to call the next number, never a directory of who has visited.
 */
export default function StaffOfficesPage() {
  const offices = useAsync(() => staffApi.offices(), []);

  useRealtimeEvent('staff:ops', () => offices.reload(), []);

  if (offices.error) {
    return (
      <div>
        <PageHeader title="Offices" />
        <ErrorState message={offices.error} onRetry={offices.reload} />
      </div>
    );
  }

  const rows = offices.data?.offices ?? [];

  return (
    <div>
      <PageHeader
        title="Offices"
        description="Desks you serve. Call the next ticket and start service from here; hours, capacity and check-in rules are configured in the admin console."
      />

      {offices.loading ? (
        <CardSkeleton rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No offices assigned"
          description="You see a desk here when an administrator attaches your account to it. Until then, your queue lines are the whole of your operations surface."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid grid-cols-3 gap-3 lg:col-span-2">
            <Stat label="Desks you serve" value={rows.length} />
            <Stat label="Open" value={rows.filter((row) => row.is_active).length} tone={rows.some((row) => row.is_active) ? 'success' : 'default'} />
            <Stat label="Waiting now" value={rows.reduce((sum, row) => sum + row.waiting, 0)} />
          </div>

          {rows.map((row) => (
            <Card key={row.office_id}>
              <SectionHeading
                title={row.name}
                description={`${row.code} · ${row.room_code ? `${row.room_code}, ${row.floor_name}` : 'no room assigned'} · ${row.service_duration_minutes} min per ticket`}
                action={<Badge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'serving' : 'closed'}</Badge>}
              />

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-600">
                <span className="rounded-full bg-ink-50 px-2.5 py-1">
                  <strong className="tnum font-semibold text-ink-800">{row.waiting}</strong> waiting
                </span>
                <span className="rounded-full bg-ink-50 px-2.5 py-1">
                  <strong className="tnum font-semibold text-ink-800">{row.in_service}</strong> in service
                </span>
                <span className="rounded-full bg-ink-50 px-2.5 py-1">
                  <strong className="tnum font-semibold text-ink-800">{row.completed_today}</strong> done today
                </span>
              </div>

              {row.current ? (
                <p className="mt-3 rounded-[10px] border border-mint-200 bg-mint-50/60 px-3 py-2 text-[12.5px] text-mint-700">
                  Now with {row.current.student_name} · ticket {row.current.ticket_number}, called{' '}
                  {relativeTime(row.current.called_at ?? row.current.requested_at)}
                </p>
              ) : (
                <p className="mt-3 text-[12.5px] text-ink-500">No ticket is being served right now.</p>
              )}

              <div className="mt-4">
                <Link href={`/staff/offices/${row.office_id}`}>
                  <Button size="sm">Open desk line</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
