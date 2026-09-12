'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAsync, formatClock, formatDate, relativeTime } from '../../../lib/hooks';
import { engagementApi } from '../../../lib/api/endpoints';
import { ApiError } from '../../../lib/api/client';
import { Badge, Button, Card, CardSkeleton, EmptyState, ErrorState, SegmentedControl } from '../../../components/ui/kit';
import { PageHeader } from '../../../components/layout/app-shell';
import { useToast } from '../../../components/ui/toast';

const CATEGORIES = ['all', 'academic', 'career', 'social', 'sport', 'wellbeing', 'administrative'] as const;
type Category = (typeof CATEGORIES)[number];

export default function EventsPage() {
  const toast = useToast();
  const [category, setCategory] = useState<Category>('all');
  const [when, setWhen] = useState<'upcoming' | 'past'>('upcoming');
  const [busy, setBusy] = useState<string | null>(null);

  const events = useAsync(
    () => engagementApi.events({ category: category === 'all' ? undefined : category, when, per_page: 40 }),
    [category, when],
  );
  const [localRegistrations, setLocalRegistrations] = useState<Record<string, boolean>>({});
  const eventItems = Array.isArray(events.data?.items) ? events.data.items : [];

  const registered = useMemo(() => {
    const base = new Set(events.data?.registered_event_ids ?? []);
    return base;
  }, [events.data]);

  const toggle = async (eventId: string, isRegistered: boolean) => {
    setBusy(eventId);
    try {
      if (isRegistered) {
        await engagementApi.unregister(eventId);
        setLocalRegistrations((state) => ({ ...state, [eventId]: false }));
        toast.info('Registration cancelled');
      } else {
        await engagementApi.register(eventId);
        setLocalRegistrations((state) => ({ ...state, [eventId]: true }));
        toast.success('You are registered', 'A reminder will be sent before the event starts.');
      }
      events.reload();
    } catch (caught) {
      const message = caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'That action failed.';
      toast.error('Could not update registration', message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Campus events"
        description="Talks, career fairs, sports and wellbeing sessions. Register in one tap and get a reminder before it starts."
        actions={
          <SegmentedControl
            value={when}
            onChange={setWhen}
            size="sm"
            options={[
              { value: 'upcoming', label: 'Upcoming' },
              { value: 'past', label: 'Past' },
            ]}
          />
        }
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {CATEGORIES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium capitalize transition-colors ${
              category === item ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {events.error ? <ErrorState message={events.error} onRetry={events.reload} /> : null}
      {events.loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <CardSkeleton rows={4} />
          <CardSkeleton rows={4} />
        </div>
      ) : eventItems.length === 0 ? (
        <EmptyState
          title={when === 'upcoming' ? 'No upcoming events' : 'No past events'}
          description="Check back soon — departments publish new events every week."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {eventItems.map((event) => {
            const isRegistered = localRegistrations[event.id] ?? event.registered ?? registered.has(event.id);
            const full = event.capacity !== null && (event.registrations ?? 0) >= event.capacity && !isRegistered;
            return (
              <Card key={event.id} className="flex flex-col">
                <div className="flex items-start gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] bg-brand-50 text-brand-700">
                    <span className="text-[11px] font-semibold uppercase">
                      {new Date(event.starts_at).toLocaleString([], { month: 'short' })}
                    </span>
                    <span className="tnum text-[15px] font-semibold leading-none">{new Date(event.starts_at).getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-[14.5px] font-semibold text-ink-900">{event.title}</p>
                      <Badge tone={event.category === 'wellbeing' ? 'success' : event.category === 'career' ? 'brand' : 'neutral'}>{event.category}</Badge>
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-ink-500">
                      {formatDate(event.starts_at, { weekday: 'short', day: 'numeric', month: 'long' })} · {formatClock(event.starts_at)}
                      {event.ends_at ? ` – ${formatClock(event.ends_at)}` : ''}
                    </p>
                    {event.venue || event.building_name ? (
                      <p className="mt-0.5 text-[12.5px] text-ink-500">
                        {event.venue ?? event.building_name}
                        {event.room_code ? ` · ${event.room_code}` : ''}
                      </p>
                    ) : null}
                  </div>
                </div>

                {event.description ? <p className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-ink-600">{event.description}</p> : null}

                <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-ink-500">
                  {event.capacity !== null ? (
                    <span className="tnum">
                      {event.registrations ?? 0} / {event.capacity} registered
                    </span>
                  ) : (
                    <span>Open attendance</span>
                  )}
                  {event.organiser_name ? <span>· by {event.organiser_name}</span> : null}
                  <span>· {relativeTime(event.starts_at)}</span>
                </div>

                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  {when === 'upcoming' && event.registration_required ? (
                    <Button
                      size="sm"
                      variant={isRegistered ? 'secondary' : 'primary'}
                      loading={busy === event.id}
                      disabled={full}
                      onClick={() => void toggle(event.id, isRegistered)}
                    >
                      {full ? 'Event full' : isRegistered ? 'Registered · cancel' : 'Register'}
                    </Button>
                  ) : (
                    <Badge tone="neutral">{when === 'past' ? 'Finished' : 'No registration needed'}</Badge>
                  )}
                  {event.room_code ? (
                    <Link href={`/navigate?to=${encodeURIComponent(event.room_code)}`}>
                      <Button size="sm" variant="ghost">
                        Directions
                      </Button>
                    </Link>
                  ) : event.building_code ? (
                    <Link href={`/map`}>
                      <Button size="sm" variant="ghost">
                        Show on map
                      </Button>
                    </Link>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
