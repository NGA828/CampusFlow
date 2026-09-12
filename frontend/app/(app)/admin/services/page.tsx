'use client';

import { useMemo, useState } from 'react';
import { useAsync, dayShort } from '@/lib/hooks';
import { adminApi, campusApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Badge, Button, Card, ConfirmDialog, Field, Input, Modal, SectionHeading, Select, Tabs, Textarea } from '@/components/ui/kit';
import { PageHeader } from '@/components/layout/app-shell';
import { ResourceTable, type Column } from '@/components/admin/table';
import { useToast } from '@/components/ui/toast';
import type { AdminOfficeRow, Office, Room, RoomQueueConfig, ServiceWindow } from '@/lib/api/types';

type Tab = 'queues' | 'offices' | 'windows';

export default function AdminServicesPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('queues');
  const [queueDraft, setQueueDraft] = useState<{ roomId?: string; queueId?: string; values: Record<string, string> } | null>(null);
  const [officeDraft, setOfficeDraft] = useState<{ id?: string; values: Record<string, string> } | null>(null);
  const [windowDraft, setWindowDraft] = useState<{ id?: string; values: Record<string, string> } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ kind: Tab; id: string; label: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [newQueueRoomId, setNewQueueRoomId] = useState('');

  const queues = useAsync(() => adminApi.queues(), []);
  const offices = useAsync(() => adminApi.offices({ per_page: 50 }), []);
  const windows = useAsync(() => adminApi.serviceWindows({ per_page: 100 }), []);
  const buildings = useAsync(() => campusApi.buildings(), []);
  const rooms = useAsync(() => adminApi.rooms({ per_page: 400 }), []);

  const buildingOptions = buildings.data?.buildings ?? [];
  const roomOptions = rooms.data?.items ?? [];

  const queueRooms = queues.data?.rooms_without_queue ?? [];

  const officeOptions = offices.data?.items ?? [];

  const coalesce = (value: unknown, fallback: string) => (value === null || value === undefined ? fallback : String(value));

  const openEditQueue = (queue: RoomQueueConfig) => {
    setFormError(null);
    setQueueDraft({
      queueId: queue.id,
      roomId: queue.room_id,
      values: {
        is_active: String(queue.is_active),
        max_size: String(queue.max_size),
        admission_capacity: String(queue.admission_capacity),
        avg_service_seconds: String(queue.avg_service_seconds),
        proximity_radius_m: String(queue.proximity_radius_m),
        requires_proximity_to_join: String(queue.requires_proximity_to_join),
        check_in_window_seconds: String(queue.check_in_window_seconds),
        grace_period_seconds: String(queue.grace_period_seconds),
        max_active_tickets_per_student: String(queue.max_active_tickets_per_student ?? 3),
        opens_at: coalesce(queue.opens_at, ''),
        closes_at: coalesce(queue.closes_at, ''),
        notes: coalesce(queue.notes, ''),
      },
    });
  };

  const openCreateQueue = () => {
    if (!newQueueRoomId) return;
    setFormError(null);
    setQueueDraft({
      roomId: newQueueRoomId,
      values: {
        is_active: 'true',
        max_size: '40',
        admission_capacity: '3',
        avg_service_seconds: '300',
        proximity_radius_m: '120',
        requires_proximity_to_join: 'true',
        check_in_window_seconds: '300',
        grace_period_seconds: '180',
        max_active_tickets_per_student: '3',
        opens_at: '',
        closes_at: '',
        notes: '',
      },
    });
  };

  const saveQueue = async () => {
    if (!queueDraft) return;
    setSaving(true);
    setFormError(null);
    const numeric = [
      'max_size',
      'admission_capacity',
      'avg_service_seconds',
      'proximity_radius_m',
      'check_in_window_seconds',
      'grace_period_seconds',
      'max_active_tickets_per_student',
    ];
    const body: Record<string, unknown> = {
      is_active: queueDraft.values.is_active === 'true',
      requires_proximity_to_join: queueDraft.values.requires_proximity_to_join === 'true',
      opens_at: queueDraft.values.opens_at || null,
      closes_at: queueDraft.values.closes_at || null,
      notes: queueDraft.values.notes || null,
    };
    for (const key of numeric) body[key] = Number(queueDraft.values[key]);

    try {
      if (queueDraft.queueId) await adminApi.updateQueue(queueDraft.queueId, body);
      else if (queueDraft.roomId) await adminApi.configureQueue(queueDraft.roomId, body);
      toast.success(queueDraft.queueId ? 'Queue updated' : 'Queue created', 'Students will see the change immediately.');
      queues.reload();
      setQueueDraft(null);
      setNewQueueRoomId('');
    } catch (caught) {
      const message = caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Could not save the queue.';
      setFormError(message);
      toast.error('Save failed', message);
    } finally {
      setSaving(false);
    }
  };

  const openEditOffice = (office: Office) => {
    setFormError(null);
    setOfficeDraft({
      id: office.id,
      values: {
        code: office.code,
        name: office.name,
        description: office.description ?? '',
        room_id: office.room_id ?? '',
        ticket_prefix: office.ticket_prefix,
        service_duration_minutes: String(office.service_duration_minutes),
        concurrent_capacity: String(office.concurrent_capacity),
        daily_capacity: coalesce(office.daily_capacity, '80'),
        check_in_radius_m: String(office.check_in_radius_m),
        grace_period_seconds: String(office.grace_period_seconds),
        requires_proximity_to_request: String(office.requires_proximity_to_request),
        requires_appointment: String(office.requires_appointment),
        contact_email: office.contact_email ?? '',
        is_active: String(office.is_active),
      },
    });
  };

  const openCreateOffice = () => {
    setFormError(null);
    setOfficeDraft({
      values: {
        code: '',
        name: '',
        description: '',
        room_id: '',
        ticket_prefix: '',
        service_duration_minutes: '15',
        concurrent_capacity: '1',
        daily_capacity: '80',
        check_in_radius_m: '40',
        grace_period_seconds: '180',
        requires_proximity_to_request: 'true',
        requires_appointment: 'false',
        contact_email: '',
        is_active: 'true',
      },
    });
  };

  const saveOffice = async () => {
    if (!officeDraft) return;
    setSaving(true);
    setFormError(null);
    const body: Record<string, unknown> = {
      code: officeDraft.values.code,
      name: officeDraft.values.name,
      description: officeDraft.values.description || null,
      room_id: officeDraft.values.room_id || null,
      // `is_active` maps onto the office status column server-side; the console keeps the plain word.
      is_active: officeDraft.values.is_active === 'true',
      ticket_prefix: officeDraft.values.ticket_prefix,
      service_duration_minutes: Number(officeDraft.values.service_duration_minutes),
      concurrent_capacity: Number(officeDraft.values.concurrent_capacity),
      daily_capacity: Number(officeDraft.values.daily_capacity),
      check_in_radius_m: Number(officeDraft.values.check_in_radius_m),
      grace_period_seconds: Number(officeDraft.values.grace_period_seconds),
      requires_proximity_to_request: officeDraft.values.requires_proximity_to_request === 'true',
      requires_appointment: officeDraft.values.requires_appointment === 'true',
      contact_email: officeDraft.values.contact_email || null,
    };

    try {
      if (officeDraft.id) await adminApi.updateOffice(officeDraft.id, body);
      else await adminApi.createOffice(body);
      toast.success(officeDraft.id ? 'Office updated' : 'Office created');
      offices.reload();
      setOfficeDraft(null);
    } catch (caught) {
      const message = caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Could not save the office.';
      setFormError(message);
      toast.error('Save failed', message);
    } finally {
      setSaving(false);
    }
  };

  const openWindow = (window?: ServiceWindow, officeId?: string) => {
    setFormError(null);
    setWindowDraft({
      id: window?.id,
      values: window
        ? {
            office_id: window.office_id,
            day_of_week: String(window.day_of_week),
            opens_at: window.opens_at.slice(0, 5),
            closes_at: window.closes_at.slice(0, 5),
            capacity: String(window.capacity),
            avg_service_minutes: String(window.avg_service_minutes),
            is_active: String(window.is_active),
          }
        : {
            office_id: officeId ?? officeOptions[0]?.id ?? '',
            day_of_week: '1',
            opens_at: '09:00',
            closes_at: '16:00',
            capacity: '40',
            avg_service_minutes: '15',
            is_active: 'true',
          },
    });
  };

  const saveWindow = async () => {
    if (!windowDraft) return;
    setSaving(true);
    setFormError(null);
    const body = {
      office_id: windowDraft.values.office_id,
      day_of_week: Number(windowDraft.values.day_of_week),
      opens_at: windowDraft.values.opens_at,
      closes_at: windowDraft.values.closes_at,
      capacity: Number(windowDraft.values.capacity),
      avg_service_minutes: Number(windowDraft.values.avg_service_minutes),
      is_active: windowDraft.values.is_active === 'true',
    };
    try {
      if (windowDraft.id) await adminApi.updateServiceWindow(windowDraft.id, body);
      else await adminApi.createServiceWindow(body);
      toast.success(windowDraft.id ? 'Window updated' : 'Window added');
      windows.reload();
      setWindowDraft(null);
    } catch (caught) {
      const message = caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Could not save the window.';
      setFormError(message);
      toast.error('Save failed', message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    try {
      if (pendingDelete.kind === 'queues') await adminApi.deleteQueue(pendingDelete.id);
      if (pendingDelete.kind === 'offices') await adminApi.deleteOffice(pendingDelete.id);
      if (pendingDelete.kind === 'windows') await adminApi.deleteServiceWindow(pendingDelete.id);
      toast.success('Removed');
      queues.reload();
      offices.reload();
      windows.reload();
    } catch (caught) {
      toast.error('Delete failed', caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Active tickets may be blocking this.');
    } finally {
      setPendingDelete(null);
    }
  };

  const windowsByOffice = useMemo(() => windows.data?.items ?? [], [windows.data]);

  const queueColumns: Column<RoomQueueConfig>[] = [
    {
      key: 'room',
      header: 'Room',
      render: (row) => (
        <div className="min-w-0">
          <p className="font-mono font-medium text-ink-800">{row.room_code ?? '—'}</p>
          <p className="truncate text-[12px] text-ink-500">
            {row.room_name} · {row.building_code}
          </p>
        </div>
      ),
    },
    { key: 'waiting', header: 'Waiting', align: 'right', render: (row) => <span className="tnum">{row.waiting ?? 0}</span> },
    { key: 'rate', header: 'Service time', align: 'right', render: (row) => <span className="tnum">{Math.round(row.avg_service_seconds / 60)} min</span> },
    { key: 'capacity', header: 'Admission', align: 'right', render: (row) => <span className="tnum">{row.admission_capacity}</span> },
    { key: 'radius', header: 'Join radius', align: 'right', render: (row) => <span className="tnum">{row.requires_proximity_to_join ? `${row.proximity_radius_m} m` : 'open'}</span> },
    {
      key: 'hours',
      header: 'Hours',
      render: (row) => <span className="text-[12.5px] text-ink-500">{row.opens_at && row.closes_at ? `${row.opens_at}–${row.closes_at}` : 'always'}</span>,
    },
    { key: 'status', header: 'Status', render: (row) => <Badge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'active' : 'paused'}</Badge> },
  ];

  const officeColumns: Column<AdminOfficeRow>[] = [
    {
      key: 'office',
      header: 'Office',
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-ink-800">{row.name}</p>
          <p className="text-[12px] text-ink-500">
            {row.building_code} · {row.floor_name ?? '—'}
          </p>
        </div>
      ),
    },
    { key: 'prefix', header: 'Ticket', render: (row) => <Badge tone="brand">{row.ticket_prefix}-###</Badge> },
    { key: 'duration', header: 'Service', align: 'right', render: (row) => <span className="tnum">{row.service_duration_minutes} min</span> },
    { key: 'concurrency', header: 'Concurrent', align: 'right', render: (row) => <span className="tnum">{row.concurrent_capacity}</span> },
    { key: 'capacity', header: 'Daily cap', align: 'right', render: (row) => <span className="tnum">{row.daily_capacity ?? '—'}</span> },
    { key: 'radius', header: 'Check-in radius', align: 'right', render: (row) => <span className="tnum">{row.check_in_radius_m} m</span> },
    {
      key: 'live',
      header: 'Live',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Badge tone={row.is_open_now ? 'success' : 'neutral'}>{row.is_open_now ? 'open' : 'closed'}</Badge>
          <span className="tnum text-[12px] text-ink-500">{row.waiting ?? 0} waiting</span>
          {row.requires_proximity_to_request ? <Badge tone="warning">on-site only</Badge> : null}
        </div>
      ),
    },
  ];

  const windowColumns: Column<ServiceWindow>[] = [
    { key: 'office', header: 'Office', render: (row) => offices.data?.items.find((office) => office.id === row.office_id)?.name ?? row.office_id.slice(0, 8) },
    { key: 'day', header: 'Day', render: (row) => dayShort(row.day_of_week) },
    { key: 'hours', header: 'Hours', render: (row) => `${row.opens_at.slice(0, 5)} – ${row.closes_at.slice(0, 5)}` },
    { key: 'capacity', header: 'Capacity', align: 'right', render: (row) => <span className="tnum">{row.capacity}</span> },
    { key: 'service', header: 'Avg service', align: 'right', render: (row) => <span className="tnum">{row.avg_service_minutes} min</span> },
    { key: 'status', header: 'Status', render: (row) => <Badge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'active' : 'off'}</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="Queues & offices"
        description="Admission rules, service hours and office capacities. Every figure here is enforced by the API when a student joins."
      />

      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'queues', label: 'Room queues', count: queues.data?.queues.length },
            { value: 'offices', label: 'Administrative offices', count: officeOptions.length },
            { value: 'windows', label: 'Service windows', count: windowsByOffice.length },
          ]}
        />
      </div>

      {tab === 'queues' ? (
        <div className="space-y-4">
          <Card>
            <SectionHeading title="Configure a room queue" description="Rooms that require admission can have a queue with proximity, capacity and no-show rules." />
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[260px] flex-1">
                <Field label="Room" htmlFor="queue-room">
                  <Select id="queue-room" value={newQueueRoomId} onChange={(event) => setNewQueueRoomId(event.target.value)}>
                    <option value="">Select a room without a queue…</option>
                    {queueRooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.building_code} · {room.code} — {room.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Button className="mb-0.5" disabled={!newQueueRoomId} onClick={openCreateQueue}>
                Configure queue
              </Button>
            </div>
            {queueRooms.length === 0 ? <p className="mt-3 text-[12.5px] text-ink-500">Every admission room already has a queue.</p> : null}
          </Card>

          <ResourceTable
            rows={queues.data?.queues ?? []}
            columns={queueColumns}
            loading={queues.loading}
            error={queues.error}
            onRetry={queues.reload}
            emptyTitle="No queues configured"
            emptyDescription="Pick a room above to add the first admission queue."
            rowActions={(row) => (
              <div className="flex justify-end gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => openEditQueue(row)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPendingDelete({ kind: 'queues', id: row.id, label: row.room_code ?? 'queue' })}>
                  Remove
                </Button>
              </div>
            )}
          />
        </div>
      ) : null}

      {tab === 'offices' ? (
        <div className="space-y-4">
          {officeOptions.length > 0 ? (
            <Card>
              <SectionHeading title="Service windows" description="Office opening hours drive expected service windows and capacity checks." />
              <ul className="divide-y divide-ink-50">
                {officeOptions.slice(0, 5).map((office) => (
                  <li key={office.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div>
                      <p className="text-[13px] font-medium text-ink-800">{office.name}</p>
                      <p className="text-[12px] text-ink-500">
                        {(windowsByOffice.filter((item) => item.office_id === office.id).length ?? 0)} windows configured
                      </p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => openWindow(undefined, office.id)}>
                      Add window
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <ResourceTable
            rows={officeOptions}
            columns={officeColumns}
            loading={offices.loading}
            error={offices.error}
            onRetry={offices.reload}
            emptyTitle="No offices"
            emptyDescription="Create the first administrative office."
            onCreate={openCreateOffice}
            createLabel="New office"
            rowActions={(row) => (
              <div className="flex justify-end gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => openEditOffice(row)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPendingDelete({ kind: 'offices', id: row.id, label: row.name })}>
                  Remove
                </Button>
              </div>
            )}
          />
        </div>
      ) : null}

      {tab === 'windows' ? (
        <ResourceTable
          rows={windowsByOffice}
          columns={windowColumns}
          loading={windows.loading}
          error={windows.error}
          onRetry={windows.reload}
          emptyTitle="No service windows"
          emptyDescription="Add weekday and time ranges so students know when an office is open."
          onCreate={() => openWindow()}
          createLabel="New window"
          rowActions={(row) => (
            <div className="flex justify-end gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => openWindow(row)}>
                Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPendingDelete({ kind: 'windows', id: row.id, label: `${dayShort(row.day_of_week)} ${row.opens_at.slice(0, 5)}` })}>
                Remove
              </Button>
            </div>
          )}
        />
      ) : null}

      <Modal
        open={queueDraft !== null}
        onClose={() => setQueueDraft(null)}
        title={queueDraft?.queueId ? 'Edit queue settings' : 'Configure queue'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setQueueDraft(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void saveQueue()}>
              Save queue
            </Button>
          </>
        }
      >
        {queueDraft ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Queue open" htmlFor="queue-active" hint="Paused queues reject new tickets.">
              <Select id="queue-active" value={queueDraft.values.is_active} onChange={(event) => setQueueDraft({ ...queueDraft, values: { ...queueDraft.values, is_active: event.target.value } })}>
                <option value="true">Active</option>
                <option value="false">Paused</option>
              </Select>
            </Field>
            <Field label="Max line size" htmlFor="queue-max" error={formError}>
              <Input id="queue-max" value={queueDraft.values.max_size} onChange={(event) => setQueueDraft({ ...queueDraft, values: { ...queueDraft.values, max_size: event.target.value } })} />
            </Field>
            <Field label="Admission capacity" htmlFor="queue-admission" hint="People allowed inside at once.">
              <Input id="queue-admission" value={queueDraft.values.admission_capacity} onChange={(event) => setQueueDraft({ ...queueDraft, values: { ...queueDraft.values, admission_capacity: event.target.value } })} />
            </Field>
            <Field label="Average service (seconds)" htmlFor="queue-service">
              <Input id="queue-service" value={queueDraft.values.avg_service_seconds} onChange={(event) => setQueueDraft({ ...queueDraft, values: { ...queueDraft.values, avg_service_seconds: event.target.value } })} />
            </Field>
            <Field label="Require proximity to join" htmlFor="queue-proximity">
              <Select
                id="queue-proximity"
                value={queueDraft.values.requires_proximity_to_join}
                onChange={(event) => setQueueDraft({ ...queueDraft, values: { ...queueDraft.values, requires_proximity_to_join: event.target.value } })}
              >
                <option value="true">Yes — geofence or QR required</option>
                <option value="false">No — remote join allowed</option>
              </Select>
            </Field>
            <Field label="Proximity radius (m)" htmlFor="queue-radius">
              <Input id="queue-radius" value={queueDraft.values.proximity_radius_m} onChange={(event) => setQueueDraft({ ...queueDraft, values: { ...queueDraft.values, proximity_radius_m: event.target.value } })} />
            </Field>
            <Field label="Check-in window (seconds)" htmlFor="queue-window" hint="Time a called student has to arrive.">
              <Input id="queue-window" value={queueDraft.values.check_in_window_seconds} onChange={(event) => setQueueDraft({ ...queueDraft, values: { ...queueDraft.values, check_in_window_seconds: event.target.value } })} />
            </Field>
            <Field label="Grace period (seconds)" htmlFor="queue-grace">
              <Input id="queue-grace" value={queueDraft.values.grace_period_seconds} onChange={(event) => setQueueDraft({ ...queueDraft, values: { ...queueDraft.values, grace_period_seconds: event.target.value } })} />
            </Field>
            <Field label="Tickets per student" htmlFor="queue-per-student">
              <Input id="queue-per-student" value={queueDraft.values.max_active_tickets_per_student} onChange={(event) => setQueueDraft({ ...queueDraft, values: { ...queueDraft.values, max_active_tickets_per_student: event.target.value } })} />
            </Field>
            <Field label="Opens at" htmlFor="queue-opens" hint="Optional HH:MM.">
              <Input id="queue-opens" placeholder="08:30" value={queueDraft.values.opens_at} onChange={(event) => setQueueDraft({ ...queueDraft, values: { ...queueDraft.values, opens_at: event.target.value } })} />
            </Field>
            <Field label="Closes at" htmlFor="queue-closes">
              <Input id="queue-closes" placeholder="17:00" value={queueDraft.values.closes_at} onChange={(event) => setQueueDraft({ ...queueDraft, values: { ...queueDraft.values, closes_at: event.target.value } })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes" htmlFor="queue-notes">
                <Textarea id="queue-notes" rows={2} value={queueDraft.values.notes} onChange={(event) => setQueueDraft({ ...queueDraft, values: { ...queueDraft.values, notes: event.target.value } })} />
              </Field>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={officeDraft !== null}
        onClose={() => setOfficeDraft(null)}
        title={officeDraft?.id ? 'Edit office' : 'New office'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOfficeDraft(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void saveOffice()}>
              Save office
            </Button>
          </>
        }
      >
        {officeDraft ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Code" htmlFor="office-code" error={formError} hint="Short code, e.g. AFFAIRS.">
              <Input id="office-code" value={officeDraft.values.code} onChange={(event) => setOfficeDraft({ ...officeDraft, values: { ...officeDraft.values, code: event.target.value } })} />
            </Field>
            <Field label="Name" htmlFor="office-name">
              <Input id="office-name" value={officeDraft.values.name} onChange={(event) => setOfficeDraft({ ...officeDraft, values: { ...officeDraft.values, name: event.target.value } })} />
            </Field>
            <Field
              label="Room"
              htmlFor="office-room"
              hint="An office lives in a room: that single link is what gives the desk its building, floor, map position and check-in radius."
            >
              <Select id="office-room" value={officeDraft.values.room_id} onChange={(event) => setOfficeDraft({ ...officeDraft, values: { ...officeDraft.values, room_id: event.target.value } })}>
                <option value="">No room — desk is not bookable on site</option>
                {roomOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.code} · {option.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ticket prefix" htmlFor="office-prefix" hint="Produces numbers like AFFAIRS-024.">
              <Input id="office-prefix" value={officeDraft.values.ticket_prefix} onChange={(event) => setOfficeDraft({ ...officeDraft, values: { ...officeDraft.values, ticket_prefix: event.target.value } })} />
            </Field>
            <Field label="Service duration (minutes)" htmlFor="office-duration">
              <Input id="office-duration" value={officeDraft.values.service_duration_minutes} onChange={(event) => setOfficeDraft({ ...officeDraft, values: { ...officeDraft.values, service_duration_minutes: event.target.value } })} />
            </Field>
            <Field label="Concurrent capacity" htmlFor="office-concurrent">
              <Input id="office-concurrent" value={officeDraft.values.concurrent_capacity} onChange={(event) => setOfficeDraft({ ...officeDraft, values: { ...officeDraft.values, concurrent_capacity: event.target.value } })} />
            </Field>
            <Field label="Daily capacity" htmlFor="office-daily">
              <Input id="office-daily" value={officeDraft.values.daily_capacity} onChange={(event) => setOfficeDraft({ ...officeDraft, values: { ...officeDraft.values, daily_capacity: event.target.value } })} />
            </Field>
            <Field label="Check-in radius (m)" htmlFor="office-radius">
              <Input id="office-radius" value={officeDraft.values.check_in_radius_m} onChange={(event) => setOfficeDraft({ ...officeDraft, values: { ...officeDraft.values, check_in_radius_m: event.target.value } })} />
            </Field>
            <Field label="Grace period (seconds)" htmlFor="office-grace">
              <Input id="office-grace" value={officeDraft.values.grace_period_seconds} onChange={(event) => setOfficeDraft({ ...officeDraft, values: { ...officeDraft.values, grace_period_seconds: event.target.value } })} />
            </Field>
            <Field label="Contact email" htmlFor="office-email">
              <Input id="office-email" value={officeDraft.values.contact_email} onChange={(event) => setOfficeDraft({ ...officeDraft, values: { ...officeDraft.values, contact_email: event.target.value } })} />
            </Field>
            <Field label="Proximity to request" htmlFor="office-proximity">
              <Select
                id="office-proximity"
                value={officeDraft.values.requires_proximity_to_request}
                onChange={(event) => setOfficeDraft({ ...officeDraft, values: { ...officeDraft.values, requires_proximity_to_request: event.target.value } })}
              >
                <option value="true">Required</option>
                <option value="false">Requests allowed remotely</option>
              </Select>
            </Field>
            <Field label="Appointment required" htmlFor="office-appointment" hint="When required, the student must book a slot before the desk will issue a ticket.">
              <Select
                id="office-appointment"
                value={officeDraft.values.requires_appointment}
                onChange={(event) => setOfficeDraft({ ...officeDraft, values: { ...officeDraft.values, requires_appointment: event.target.value } })}
              >
                <option value="false">Walk-in allowed</option>
                <option value="true">Appointment only</option>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description" htmlFor="office-description">
                <Textarea id="office-description" rows={2} value={officeDraft.values.description} onChange={(event) => setOfficeDraft({ ...officeDraft, values: { ...officeDraft.values, description: event.target.value } })} />
              </Field>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={windowDraft !== null}
        onClose={() => setWindowDraft(null)}
        title={windowDraft?.id ? 'Edit service window' : 'New service window'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setWindowDraft(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void saveWindow()}>
              Save window
            </Button>
          </>
        }
      >
        {windowDraft ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Office" htmlFor="window-office" error={formError}>
              <Select id="window-office" value={windowDraft.values.office_id} onChange={(event) => setWindowDraft({ ...windowDraft, values: { ...windowDraft.values, office_id: event.target.value } })}>
                {officeOptions.map((office) => (
                  <option key={office.id} value={office.id}>
                    {office.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Day" htmlFor="window-day">
              <Select id="window-day" value={windowDraft.values.day_of_week} onChange={(event) => setWindowDraft({ ...windowDraft, values: { ...windowDraft.values, day_of_week: event.target.value } })}>
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <option key={day} value={String(day)}>
                    {dayShort(day)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Opens at" htmlFor="window-opens">
              <Input id="window-opens" placeholder="09:00" value={windowDraft.values.opens_at} onChange={(event) => setWindowDraft({ ...windowDraft, values: { ...windowDraft.values, opens_at: event.target.value } })} />
            </Field>
            <Field label="Closes at" htmlFor="window-closes">
              <Input id="window-closes" placeholder="16:00" value={windowDraft.values.closes_at} onChange={(event) => setWindowDraft({ ...windowDraft, values: { ...windowDraft.values, closes_at: event.target.value } })} />
            </Field>
            <Field label="Capacity" htmlFor="window-capacity" hint="Maximum tickets issued in this window.">
              <Input id="window-capacity" value={windowDraft.values.capacity} onChange={(event) => setWindowDraft({ ...windowDraft, values: { ...windowDraft.values, capacity: event.target.value } })} />
            </Field>
            <Field label="Average service (minutes)" htmlFor="window-service">
              <Input id="window-service" value={windowDraft.values.avg_service_minutes} onChange={(event) => setWindowDraft({ ...windowDraft, values: { ...windowDraft.values, avg_service_minutes: event.target.value } })} />
            </Field>
            <Field label="Active" htmlFor="window-active">
              <Select id="window-active" value={windowDraft.values.is_active} onChange={(event) => setWindowDraft({ ...windowDraft, values: { ...windowDraft.values, is_active: event.target.value } })}>
                <option value="true">Active</option>
                <option value="false">Disabled</option>
              </Select>
            </Field>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove this configuration?"
        message={pendingDelete ? `“${pendingDelete.label}” will be removed. Students will no longer see it.` : ''}
        confirmLabel="Remove"
        tone="danger"
        onConfirm={() => void remove()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
