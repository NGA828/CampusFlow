'use client';

import Link from 'next/link';
import { useAsync, relativeTime } from '@/lib/hooks';
import { staffApi } from '@/lib/api/endpoints';
import { Badge, Button, Card, CardSkeleton, EmptyState, ErrorState, Progress, SectionHeading, Stat } from '@/components/ui/kit';
import { PageHeader } from '@/components/layout/app-shell';
import { useToast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api/client';
import { useState } from 'react';
import { useRealtimeEvent } from '@/lib/realtime/realtime-context';

/**
 * `/staff/queues` — the lines this operator is responsible for.
 *
 * Scoped, not filtered after the fact: `StaffController::queues` returns only the queues this account
 * may run (its own assigned rooms, shared/public rooms, plus rooms whose department it belongs to), so
 * a tutor in Science never sees the queue board for a hall in Arts.
 *
 * Opening and closing a line lives here because it is an operational decision of the day. Changing
 * *policy* — capacity, call window, proximity, the duplicate rule — does not: that is `Admin →
 * Services`, on the web console, for an administrator.
 */
export default function StaffQueuesPage() {
  const toast = useToast();
  const queues = useAsync(() => staffApi.queues(), []);
  const [busy, setBusy] = useState<string | null>(null);

  useRealtimeEvent('staff:ops', () => queues.reload(), []);

  const toggle = async (queueId: string, open: boolean) => {
    setBusy(queueId);
    try {
      await staffApi.setQueueOpen(queueId, open);
      toast.success(open ? 'Queue opened' : 'Queue closed', open ? 'Students can join this line now.' : 'No new tickets will be issued.');
      queues.reload();
    } catch (caught) {
      toast.error('Could not change the queue', caught instanceof ApiError ? caught.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  if (queues.error) {
    return (
      <div>
        <PageHeader title="Room queues" />
        <ErrorState message={queues.error} onRetry={queues.reload} />
      </div>
    );
  }

  const rows = queues.data?.queues ?? [];

  return (
    <div>
      <PageHeader
        title="Room queues"
        description="The lines you run. Call from here, and open or close a line for the day — capacity, windows and proximity rules are set in the admin console."
      />

      {queues.loading ? (
        <CardSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No queues assigned to you"
          description="Queues appear here when a room you are assigned to has one configured. Ask administration to assign the room, or to enable a queue for it."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid grid-cols-3 gap-3 lg:col-span-2">
            <Stat label="Lines you run" value={rows.length} hint="assigned to you" />
            <Stat label="Open now" value={rows.filter((row) => row.is_active).length} tone={rows.some((row) => row.is_active) ? 'success' : 'default'} />
            <Stat label="Waiting" value={rows.reduce((sum, row) => sum + row.waiting, 0)} hint="students in all your lines" />
          </div>

          {rows.map((row) => {
            const load = row.admission_capacity > 0 ? (row.occupying / row.admission_capacity) * 100 : 0;
            return (
              <Card key={row.queue_id}>
                <SectionHeading
                  title={`${row.room_code} · ${row.room_name}`}
                  description={`${row.building_code} · floor ${row.floor_name}`}
                  action={<Badge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'open' : 'closed'}</Badge>}
                />

                <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-[10px] bg-ink-50 px-2 py-2.5">
                    <dt className="text-[11px] text-ink-500">Waiting</dt>
                    <dd className="tnum text-[17px] font-semibold text-ink-900">{row.waiting}</dd>
                  </div>
                  <div className="rounded-[10px] bg-ink-50 px-2 py-2.5">
                    <dt className="text-[11px] text-ink-500">In room</dt>
                    <dd className="tnum text-[17px] font-semibold text-ink-900">
                      {row.occupying}/{row.admission_capacity}
                    </dd>
                  </div>
                  <div className="rounded-[10px] bg-ink-50 px-2 py-2.5">
                    <dt className="text-[11px] text-ink-500">Checked in</dt>
                    <dd className="tnum text-[17px] font-semibold text-ink-900">{row.checked_in}</dd>
                  </div>
                </dl>

                <div className="mt-3">
                  <Progress value={Math.min(100, load)} tone={load > 85 ? 'signal' : 'brand'} />
                  <p className="mt-1.5 text-[11.5px] text-ink-500">
                    {row.requires_proximity_to_join
                      ? `Joins are accepted within ${row.proximity_radius_m} m of the room.`
                      : 'Students may join this line from anywhere.'}
                    {row.current ? ` Now serving ${row.current.ticket_number} · ${relativeTime(row.current.called_at ?? row.current.issued_at)}.` : ''}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/staff/queues/${row.queue_id}`}>
                    <Button size="sm">Open line</Button>
                  </Link>
                  <Button size="sm" variant="secondary" loading={busy === row.queue_id} onClick={() => void toggle(row.queue_id, !row.is_active)}>
                    {row.is_active ? 'Close queue' : 'Open queue'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
