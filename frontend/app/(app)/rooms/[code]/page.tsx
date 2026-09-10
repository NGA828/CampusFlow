'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAsync, dayName, formatClock, formatDuration } from '../../../../lib/hooks';
import { campusApi, officeApi, queueApi } from '../../../../lib/api/endpoints';
import { Badge, Button, Card, CardSkeleton, EmptyState, ErrorState, KeyValue, Progress, SectionHeading } from '../../../../components/ui/kit';
import { PageHeader } from '../../../../components/layout/app-shell';
import { useToast } from '../../../../components/ui/toast';
import { ApiError } from '../../../../lib/api/client';

export default function RoomDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const toast = useToast();
  const [joining, setJoining] = useState(false);

  const room = useAsync(() => campusApi.room(code), [code]);

  if (room.error) {
    return (
      <div>
        <PageHeader title="Room" breadcrumb={[{ label: 'Rooms', href: '/rooms' }, { label: code }]} />
        <ErrorState message={room.error} onRetry={room.reload} />
      </div>
    );
  }

  if (room.loading || !room.data) {
    return (
      <div>
        <PageHeader title="Room" breadcrumb={[{ label: 'Rooms', href: '/rooms' }, { label: code }]} />
        <CardSkeleton rows={6} />
      </div>
    );
  }

  const { room: details, availability, week } = room.data;

  const joinQueue = async () => {
    setJoining(true);
    try {
      const queues = await queueApi.list();
      const queue = queues.queues.find((candidate) => candidate.room_id === details.id);
      if (!queue) {
        toast.error('No queue configured', 'This room does not use admission queues.');
        return;
      }
      await queueApi.join(queue.id, {});
      toast.success('You joined the queue', 'Open the queue screen to follow your position.');
    } catch (error) {
      const message = error instanceof ApiError ? (error.firstError ?? error.message) : 'Could not join the queue.';
      toast.error('Could not join', message);
    } finally {
      setJoining(false);
    }
  };

  const occupancy = availability.occupancy;
  const occupancyPct = occupancy.capacity > 0 ? (occupancy.admitted / occupancy.capacity) * 100 : 0;

  return (
    <div>
      <PageHeader
        title={`${details.code} · ${details.name}`}
        description={details.description ?? `${details.room_type} in ${details.building_name ?? 'campus'}`}
        breadcrumb={[{ label: 'Rooms', href: '/rooms' }, { label: details.code }]}
        actions={
          <>
            <Link href={`/navigate?to=${encodeURIComponent(details.code)}`}>
              <Button size="sm">Navigate here</Button>
            </Link>
            {details.requires_admission ? (
              <Button variant="signal" size="sm" loading={joining} onClick={() => void joinQueue()}>
                Join queue
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <SectionHeading title="Availability today" description={availability.headline} />
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-[12px] text-ink-500">Status</p>
                <p className="mt-1">
                  <Badge tone={availability.is_available_now ? 'success' : 'warning'}>{availability.is_available_now ? 'Available now' : 'In use'}</Badge>
                </p>
              </div>
              <div>
                <p className="text-[12px] text-ink-500">Opens / closes</p>
                <p className="tnum mt-1 text-[13.5px] font-medium text-ink-800">
                  {availability.opens_at ? formatClock(`2000-01-01T${availability.opens_at}`) : '—'} –{' '}
                  {availability.closes_at ? formatClock(`2000-01-01T${availability.closes_at}`) : '—'}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-ink-500">Next free</p>
                <p className="tnum mt-1 text-[13.5px] font-medium text-ink-800">
                  {availability.next_free_at ? formatClock(`2000-01-01T${availability.next_free_at}`) : availability.is_available_now ? 'Now' : '—'}
                </p>
              </div>
            </div>

            {availability.current_session ? (
              <div className="mt-4 rounded-[12px] border border-signal-200 bg-signal-50 px-4 py-3">
                <p className="text-[13px] font-medium text-signal-700">In use by {availability.current_session.course_code}</p>
                <p className="mt-0.5 text-[12.5px] text-signal-700/90">
                  {availability.current_session.course_title} · until {formatClock(`2000-01-01T${availability.current_session.ends_at}`)} (
                  {availability.current_session.session_type})
                </p>
              </div>
            ) : null}

            {availability.free_slots.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-[12.5px] font-medium text-ink-600">Free slots today</p>
                <div className="flex flex-wrap gap-2">
                  {availability.free_slots.map((slot) => (
                    <span key={`${slot.starts_at}-${slot.ends_at}`} className="tnum rounded-full border border-mint-200 bg-mint-50 px-3 py-1.5 text-[12.5px] font-medium text-mint-700">
                      {formatClock(`2000-01-01T${slot.starts_at}`)} – {formatClock(`2000-01-01T${slot.ends_at}`)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {availability.busy.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-[12.5px] font-medium text-ink-600">Scheduled sessions</p>
                <ul className="space-y-1.5">
                  {availability.busy.map((slot) => (
                    <li key={`${slot.starts_at}-${slot.ends_at}`} className="flex items-center justify-between rounded-[10px] bg-ink-50 px-3 py-2 text-[12.5px]">
                      <span className="font-medium text-ink-700">
                        {slot.course_code ?? 'Reserved'} {slot.course_title ? `· ${slot.course_title}` : ''}
                      </span>
                      <span className="tnum text-ink-500">
                        {formatClock(`2000-01-01T${slot.starts_at}`)}–{formatClock(`2000-01-01T${slot.ends_at}`)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          <Card>
            <SectionHeading title="This week" description="Recurring sessions from the master timetable" />
            {week.length === 0 ? (
              <p className="text-[13px] text-ink-500">No recurring sessions are scheduled in this room this term.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {week.map((entry, index) => (
                  <li key={`${entry.day_of_week}-${entry.starts_at}-${index}`} className="rounded-[10px] border border-ink-100 px-3 py-2">
                    <p className="text-[13px] font-medium text-ink-800">{dayName(entry.day_of_week)}</p>
                    <p className="tnum text-[12.5px] text-ink-500">
                      {formatClock(`2000-01-01T${entry.starts_at}`)} – {formatClock(`2000-01-01T${entry.ends_at}`)} · {entry.session_type}
                    </p>
                    <p className="mt-0.5 text-[12.5px] text-ink-600">
                      {entry.course_code} · {entry.course_title}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <SectionHeading title="Room details" />
            <dl className="divide-y divide-ink-50">
              <KeyValue label="Building" value={`${details.building_code ?? '—'} · ${details.building_name ?? ''}`} />
              <KeyValue label="Floor" value={details.floor_name ?? '—'} />
              <KeyValue label="Type" value={details.room_type} />
              <KeyValue label="Capacity" value={`${details.capacity} seats`} mono />
              <KeyValue label="Admission" value={details.requires_admission ? 'Controlled queue' : 'Walk in'} />
              <KeyValue label="Plan position" value={`x ${details.plan_x} · y ${details.plan_y}`} mono />
            </dl>

            {details.accessibility?.length ? (
              <div className="mt-4">
                <p className="mb-2 text-[12.5px] font-medium text-ink-600">Accessibility</p>
                <div className="flex flex-wrap gap-1.5">
                  {details.accessibility.map((feature) => (
                    <Badge key={feature} tone="success">
                      {feature.replaceAll('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {details.amenities?.length ? (
              <div className="mt-4">
                <p className="mb-2 text-[12.5px] font-medium text-ink-600">Facilities</p>
                <div className="flex flex-wrap gap-1.5">
                  {details.amenities.map((amenity) => (
                    <Badge key={amenity} tone="neutral">
                      {amenity.replaceAll('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>

          <Card>
            <SectionHeading title="Live occupancy" description="Checked-in and admitted people vs capacity" />
            <div className="flex items-baseline justify-between">
              <p className="tnum text-2xl font-semibold text-ink-900">
                {occupancy.admitted}
                <span className="text-[14px] font-normal text-ink-500"> / {occupancy.capacity}</span>
              </p>
              <p className="tnum text-[12.5px] text-ink-500">{Math.round(occupancyPct)}% full</p>
            </div>
            <div className="mt-2">
              <Progress value={occupancyPct} tone={occupancyPct > 85 ? 'signal' : 'brand'} />
            </div>

            {availability.queue.id ? (
              <div className="mt-4 rounded-[12px] bg-ink-50 px-4 py-3 text-[12.5px]">
                <p className="font-medium text-ink-700">Admission queue</p>
                <p className="mt-0.5 text-ink-500">
                  {availability.queue.waiting} waiting · {availability.queue.is_active ? 'open' : 'closed'}
                  {availability.queue.requires_proximity ? ' · proximity check on arrival' : ''}
                </p>
                <Link href="/queue" className="mt-2 inline-block text-[12.5px] font-medium text-brand-600 hover:text-brand-700">
                  Open queue screen →
                </Link>
              </div>
            ) : null}
          </Card>

          <Card>
            <SectionHeading title="Plan" description="Where this room sits on the floor" />
            <Link href={`/map`} className="flex items-center justify-between rounded-[10px] border border-ink-100 px-4 py-3 text-[13px] hover:border-brand-200">
              <span className="text-ink-700">Open in the campus map</span>
              <span className="text-brand-600">→</span>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
