'use client';

import { useState } from 'react';
import { useAsync, formatDate, relativeTime } from '../../../../lib/hooks';
import { campusApi, engagementApi, staffApi } from '../../../../lib/api/endpoints';
import { ApiError } from '../../../../lib/api/client';
import { Badge, Button, Card, CardSkeleton, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, Select, Tabs, Textarea, Toggle } from '../../../../components/ui/kit';
import { PageHeader } from '../../../../components/layout/app-shell';
import { useToast } from '../../../../components/ui/toast';

const CATEGORIES = ['academic', 'career', 'social', 'sport', 'wellbeing', 'administrative'] as const;

export default function StaffContentPage() {
  const toast = useToast();
  const [tab, setTab] = useState<'events' | 'announcements'>('events');

  const events = useAsync(() => engagementApi.events({ per_page: 40 }), []);
  const announcements = useAsync(() => staffApi.announcements(), []);
  const buildings = useAsync(() => campusApi.buildings(), []);

  const [eventDraft, setEventDraft] = useState<{
    title: string;
    description: string;
    category: string;
    starts_at: string;
    ends_at: string;
    venue: string;
    building_id: string;
    capacity: string;
    registration_required: boolean;
  } | null>(null);
  const [noticeDraft, setNoticeDraft] = useState<{
    title: string;
    body: string;
    priority: string;
    audience: string;
    building_id: string;
    is_pinned: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ kind: 'event' | 'announcement'; id: string; label: string } | null>(null);

  const saveEvent = async () => {
    if (!eventDraft) return;
    setSaving(true);
    setFormError(null);
    try {
      await staffApi.createEvent({
        title: eventDraft.title,
        description: eventDraft.description || undefined,
        category: eventDraft.category,
        starts_at: new Date(eventDraft.starts_at).toISOString(),
        ends_at: eventDraft.ends_at ? new Date(eventDraft.ends_at).toISOString() : undefined,
        venue: eventDraft.venue || undefined,
        building_id: eventDraft.building_id || undefined,
        capacity: eventDraft.capacity ? Number(eventDraft.capacity) : undefined,
        registration_required: eventDraft.registration_required,
      });
      toast.success('Event published', 'Students can now see and register for it.');
      setEventDraft(null);
      events.reload();
    } catch (caught) {
      const message = caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Could not publish the event.';
      setFormError(message);
      toast.error('Publish failed', message);
    } finally {
      setSaving(false);
    }
  };

  const saveNotice = async () => {
    if (!noticeDraft) return;
    setSaving(true);
    setFormError(null);
    try {
      await staffApi.createAnnouncement({
        title: noticeDraft.title,
        body: noticeDraft.body,
        priority: noticeDraft.priority,
        audience: [noticeDraft.audience],
        building_id: noticeDraft.building_id || undefined,
        is_pinned: noticeDraft.is_pinned,
      });
      toast.success('Announcement published', 'It is visible to the selected audience immediately.');
      setNoticeDraft(null);
      announcements.reload();
    } catch (caught) {
      const message = caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Could not publish the announcement.';
      setFormError(message);
      toast.error('Publish failed', message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    try {
      if (pendingDelete.kind === 'event') await staffApi.deleteEvent(pendingDelete.id);
      else await staffApi.deleteAnnouncement(pendingDelete.id);
      toast.success(pendingDelete.kind === 'event' ? 'Event removed' : 'Announcement removed');
      if (pendingDelete.kind === 'event') events.reload();
      else announcements.reload();
    } catch (caught) {
      toast.error('Delete failed', caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Try again.');
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Events & announcements"
        description="Publish what your department is running or needs students to know. Both surfaces notify students in real time."
        actions={
          <Button
            size="sm"
            onClick={() => {
              setFormError(null);
              if (tab === 'events') {
                setEventDraft({
                  title: '',
                  description: '',
                  category: 'academic',
                  starts_at: '',
                  ends_at: '',
                  venue: '',
                  building_id: '',
                  capacity: '',
                  registration_required: true,
                });
              } else {
                setNoticeDraft({ title: '', body: '', priority: 'normal', audience: 'all', building_id: '', is_pinned: false });
              }
            }}
          >
            {tab === 'events' ? 'New event' : 'New announcement'}
          </Button>
        }
      />

      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'events', label: 'Events', count: events.data?.items.length },
            { value: 'announcements', label: 'Announcements', count: announcements.data?.announcements.length },
          ]}
        />
      </div>

      {tab === 'events' ? (
        <>
          {events.error ? <ErrorState message={events.error} onRetry={events.reload} /> : null}
          {events.loading ? (
            <CardSkeleton rows={5} />
          ) : (events.data?.items.length ?? 0) === 0 ? (
            <EmptyState title="No events yet" description="Publish the first event for your department." />
          ) : (
            <ul className="space-y-2">
              {events.data?.items.map((event) => (
                <li key={event.id}>
                  <Card className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium text-ink-800">{event.title}</p>
                      <p className="mt-0.5 text-[12.5px] text-ink-500">
                        {formatDate(event.starts_at, { weekday: 'short', day: 'numeric', month: 'short' })}
                        {event.venue ? ` · ${event.venue}` : ''}
                        {event.room_code ? ` · ${event.room_code}` : ''}
                        {event.capacity ? ` · ${event.registrations ?? 0}/${event.capacity} registered` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral">{event.category}</Badge>
                      <Badge tone={event.status === 'published' ? 'success' : 'neutral'}>{event.status}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => setPendingDelete({ kind: 'event', id: event.id, label: event.title })}>
                        Remove
                      </Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          {announcements.error ? <ErrorState message={announcements.error} onRetry={announcements.reload} /> : null}
          {announcements.loading ? (
            <CardSkeleton rows={5} />
          ) : (announcements.data?.announcements.length ?? 0) === 0 ? (
            <EmptyState title="No announcements" description="Nothing has been published yet." />
          ) : (
            <ul className="space-y-2">
              {announcements.data?.announcements.map((notice) => (
                <li key={notice.id}>
                  <Card className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium text-ink-800">
                        {notice.title}
                        {notice.is_pinned ? <Badge tone="brand">pinned</Badge> : null}
                        {notice.priority !== 'normal' ? <Badge tone="warning">{notice.priority}</Badge> : null}
                        {notice.published_at ? null : <Badge tone="neutral">draft</Badge>}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[12.5px] text-ink-500">{notice.body}</p>
                      <p className="mt-1 text-[11.5px] text-ink-400">
                        {notice.author_name ? `${notice.author_name} · ` : ''}
                        {notice.published_at ? `published ${relativeTime(notice.published_at)}` : 'not published'}
                        {notice.building_code ? ` · ${notice.building_code}` : ''}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setPendingDelete({ kind: 'announcement', id: notice.id, label: notice.title })}>
                      Remove
                    </Button>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Modal
        open={eventDraft !== null}
        onClose={() => setEventDraft(null)}
        title="Publish an event"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEventDraft(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void saveEvent()} disabled={eventDraft ? eventDraft.title.length < 3 || !eventDraft.starts_at : true}>
              Publish event
            </Button>
          </>
        }
      >
        {eventDraft ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Title" htmlFor="event-title" error={formError}>
                <Input id="event-title" value={eventDraft.title} onChange={(event) => setEventDraft({ ...eventDraft, title: event.target.value })} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Description" htmlFor="event-description">
                <Textarea id="event-description" rows={3} value={eventDraft.description} onChange={(event) => setEventDraft({ ...eventDraft, description: event.target.value })} />
              </Field>
            </div>
            <Field label="Category" htmlFor="event-category">
              <Select id="event-category" value={eventDraft.category} onChange={(event) => setEventDraft({ ...eventDraft, category: event.target.value })}>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Building" htmlFor="event-building">
              <Select id="event-building" value={eventDraft.building_id} onChange={(event) => setEventDraft({ ...eventDraft, building_id: event.target.value })}>
                <option value="">No specific building</option>
                {(buildings.data?.buildings ?? []).map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.code} · {building.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Starts at" htmlFor="event-starts">
              <Input id="event-starts" type="datetime-local" value={eventDraft.starts_at} onChange={(event) => setEventDraft({ ...eventDraft, starts_at: event.target.value })} />
            </Field>
            <Field label="Ends at" htmlFor="event-ends">
              <Input id="event-ends" type="datetime-local" value={eventDraft.ends_at} onChange={(event) => setEventDraft({ ...eventDraft, ends_at: event.target.value })} />
            </Field>
            <Field label="Venue" htmlFor="event-venue">
              <Input id="event-venue" value={eventDraft.venue} onChange={(event) => setEventDraft({ ...eventDraft, venue: event.target.value })} placeholder="Main Auditorium" />
            </Field>
            <Field label="Capacity" htmlFor="event-capacity" hint="Leave blank for open attendance.">
              <Input id="event-capacity" type="number" min={1} value={eventDraft.capacity} onChange={(event) => setEventDraft({ ...eventDraft, capacity: event.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Toggle
                checked={eventDraft.registration_required}
                onChange={(value) => setEventDraft({ ...eventDraft, registration_required: value })}
                label="Require registration"
                description="Students must register; capacity is enforced by the server."
              />
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={noticeDraft !== null}
        onClose={() => setNoticeDraft(null)}
        title="Publish an announcement"
        footer={
          <>
            <Button variant="secondary" onClick={() => setNoticeDraft(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void saveNotice()} disabled={noticeDraft ? noticeDraft.title.length < 3 || noticeDraft.body.length < 3 : true}>
              Publish announcement
            </Button>
          </>
        }
      >
        {noticeDraft ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Title" htmlFor="notice-title" error={formError}>
                <Input id="notice-title" value={noticeDraft.title} onChange={(event) => setNoticeDraft({ ...noticeDraft, title: event.target.value })} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Body" htmlFor="notice-body">
                <Textarea id="notice-body" rows={4} value={noticeDraft.body} onChange={(event) => setNoticeDraft({ ...noticeDraft, body: event.target.value })} />
              </Field>
            </div>
            <Field label="Audience" htmlFor="notice-audience">
              <Select id="notice-audience" value={noticeDraft.audience} onChange={(event) => setNoticeDraft({ ...noticeDraft, audience: event.target.value })}>
                <option value="all">Everyone</option>
                <option value="students">Students</option>
                <option value="staff">Staff</option>
              </Select>
            </Field>
            <Field label="Priority" htmlFor="notice-priority">
              <Select id="notice-priority" value={noticeDraft.priority} onChange={(event) => setNoticeDraft({ ...noticeDraft, priority: event.target.value })}>
                {['low', 'normal', 'high', 'urgent'].map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Building" htmlFor="notice-building" hint="Optional — pins the notice to a building.">
              <Select id="notice-building" value={noticeDraft.building_id} onChange={(event) => setNoticeDraft({ ...noticeDraft, building_id: event.target.value })}>
                <option value="">Campus-wide</option>
                {(buildings.data?.buildings ?? []).map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.code} · {building.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Toggle checked={noticeDraft.is_pinned} onChange={(value) => setNoticeDraft({ ...noticeDraft, is_pinned: value })} label="Pin to top" description="Pinned notices stay above newer ones." />
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete?.kind === 'event' ? 'Remove this event?' : 'Remove this announcement?'}
        message={pendingDelete ? `“${pendingDelete.label}” will be removed for everyone.` : ''}
        confirmLabel="Remove"
        tone="danger"
        onConfirm={() => void remove()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
