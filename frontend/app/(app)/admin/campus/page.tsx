'use client';

import { useMemo, useState } from 'react';
import { useAsync, useDebounced } from '@/lib/hooks';
import { adminApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Badge, Button, ConfirmDialog, Field, Input, Modal, Select, Tabs } from '@/components/ui/kit';
import { PageHeader } from '@/components/layout/app-shell';
import { ResourceTable, type Column } from '@/components/admin/table';
import { useToast } from '@/components/ui/toast';
import type { Building, Floor, Room } from '@/lib/api/types';

type Tab = 'buildings' | 'floors' | 'rooms';

const ROOM_TYPES = ['lecture', 'lab', 'study', 'office', 'library', 'auditorium', 'meeting', 'service', 'other'] as const;

interface Draft {
  kind: Tab;
  id?: string;
  values: Record<string, string>;
}

export default function AdminCampusPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('buildings');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 250);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ kind: Tab; id: string; label: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const buildings = useAsync(() => adminApi.buildings({ per_page: 100 }), []);
  const floors = useAsync(() => adminApi.floors({ per_page: 300 }), []);
  const rooms = useAsync(() => adminApi.rooms({ per_page: 400 }), []);

  const buildingOptions = useMemo(() => buildings.data?.items ?? [], [buildings.data]);
  const floorOptions = useMemo(() => floors.data?.items ?? [], [floors.data]);

  const filtered = useMemo(() => {
    const needle = debounced.trim().toLowerCase();
    const match = (value: string | null | undefined) => !needle || (value ?? '').toLowerCase().includes(needle);
    return {
      buildings: buildingOptions.filter((item) => match(item.code) || match(item.name)),
      floors: floorOptions.filter((item) => match(item.name) || match(String(item.level))),
      rooms: (rooms.data?.items ?? []).filter((item) => match(item.code) || match(item.name)),
    };
  }, [buildingOptions, floorOptions, rooms.data, debounced]);

  const openCreate = () => {
    setFormError(null);
    if (tab === 'buildings') setDraft({ kind: 'buildings', values: { code: '', name: '', campus_name: 'Main Campus', lat: '', lng: '', status: 'operational' } });
    if (tab === 'floors') setDraft({ kind: 'floors', values: { building_id: buildingOptions[0]?.id ?? '', level: '0', name: '', plan_width: '40', plan_height: '30' } });
    if (tab === 'rooms') setDraft({ kind: 'rooms', values: { building_id: buildingOptions[0]?.id ?? '', floor_id: '', code: '', name: '', room_type: 'lecture', capacity: '30', plan_x: '0', plan_y: '0', plan_w: '6', plan_h: '5' } });
  };

  const openEdit = (kind: Tab, row: Building | Floor | Room) => {
    setFormError(null);
    if (kind === 'buildings') {
      const building = row as Building;
      setDraft({ kind, id: building.id, values: { code: building.code, name: building.name, campus_name: building.campus_name ?? '', lat: String(building.lat), lng: String(building.lng), status: building.status } });
    }
    if (kind === 'floors') {
      const floor = row as Floor;
      setDraft({ kind, id: floor.id, values: { building_id: floor.building_id, level: String(floor.level), name: floor.name, plan_width: String(floor.plan_width), plan_height: String(floor.plan_height) } });
    }
    if (kind === 'rooms') {
      const room = row as Room;
      setDraft({
        kind,
        id: room.id,
        values: {
          building_id: room.building_id ?? '',
          floor_id: room.floor_id ?? '',
          code: room.code,
          name: room.name,
          room_type: room.room_type,
          capacity: String(room.capacity),
          plan_x: String(room.plan_x ?? 0),
          plan_y: String(room.plan_y ?? 0),
          plan_w: String(room.plan_w ?? 6),
          plan_h: String(room.plan_h ?? 5),
        },
      });
    }
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setFormError(null);
    try {
      if (draft.kind === 'buildings') {
        const body = { ...draft.values, lat: Number(draft.values.lat), lng: Number(draft.values.lng) };
        if (draft.id) await adminApi.updateBuilding(draft.id, body);
        else await adminApi.createBuilding(body);
        buildings.reload();
      } else if (draft.kind === 'floors') {
        const body = { ...draft.values, level: Number(draft.values.level), plan_width: Number(draft.values.plan_width), plan_height: Number(draft.values.plan_height) };
        if (draft.id) await adminApi.updateFloor(draft.id, body);
        else await adminApi.createFloor(body);
        floors.reload();
      } else {
        const body = {
          ...draft.values,
          capacity: Number(draft.values.capacity),
          plan_x: Number(draft.values.plan_x),
          plan_y: Number(draft.values.plan_y),
          plan_w: Number(draft.values.plan_w),
          plan_h: Number(draft.values.plan_h),
        };
        if (draft.id) await adminApi.updateRoom(draft.id, body);
        else await adminApi.createRoom(body);
        rooms.reload();
      }
      toast.success(draft.id ? 'Saved' : 'Created');
      setDraft(null);
    } catch (caught) {
      const message = caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Could not save.';
      setFormError(message);
      toast.error('Save failed', message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    try {
      if (pendingDelete.kind === 'buildings') await adminApi.deleteBuilding(pendingDelete.id);
      if (pendingDelete.kind === 'floors') await adminApi.deleteFloor(pendingDelete.id);
      if (pendingDelete.kind === 'rooms') await adminApi.deleteRoom(pendingDelete.id);
      toast.success('Removed');
      if (pendingDelete.kind === 'buildings') buildings.reload();
      if (pendingDelete.kind === 'floors') floors.reload();
      if (pendingDelete.kind === 'rooms') rooms.reload();
    } catch (caught) {
      toast.error('Delete failed', caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'It may still be referenced by rooms, sessions or queues.');
    } finally {
      setPendingDelete(null);
    }
  };

  const buildingColumns: Column<Building>[] = [
    { key: 'code', header: 'Code', render: (row) => <span className="font-mono font-medium text-ink-800">{row.code}</span> },
    { key: 'name', header: 'Building', render: (row) => row.name },
    { key: 'campus', header: 'Campus', render: (row) => row.campus_name ?? '—' },
    {
      key: 'coords',
      header: 'Coordinates',
      render: (row) => (
        <span className="font-mono text-[12px] text-ink-500">
          {row.lat.toFixed(4)}, {row.lng.toFixed(4)}
        </span>
      ),
    },
    { key: 'floors', header: 'Floors / rooms', render: (row) => <span className="tnum">{row.floor_count ?? '—'} / {row.room_count ?? '—'}</span> },
    { key: 'status', header: 'Status', render: (row) => <Badge tone={row.status === 'operational' ? 'success' : row.status === 'closed' ? 'danger' : 'warning'}>{row.status}</Badge> },
  ];

  const floorColumns: Column<Floor>[] = [
    { key: 'level', header: 'Level', render: (row) => <span className="tnum font-medium text-ink-800">{row.level}</span> },
    { key: 'name', header: 'Floor', render: (row) => row.name },
    { key: 'building', header: 'Building', render: (row) => buildingOptions.find((building) => building.id === row.building_id)?.code ?? row.building_id.slice(0, 8) },
    { key: 'plan', header: 'Plan size', render: (row) => <span className="tnum text-[12.5px] text-ink-500">{row.plan_width} × {row.plan_height} m</span> },
  ];

  const roomColumns: Column<Room>[] = [
    { key: 'code', header: 'Room', render: (row) => <span className="font-mono font-medium text-ink-800">{row.code}</span> },
    { key: 'name', header: 'Name', render: (row) => row.name },
    { key: 'type', header: 'Type', render: (row) => <Badge tone="neutral">{row.room_type}</Badge> },
    { key: 'capacity', header: 'Capacity', align: 'right', render: (row) => <span className="tnum">{row.capacity}</span> },
    { key: 'floor', header: 'Floor', render: (row) => floorOptions.find((floor) => floor.id === row.floor_id)?.name ?? '—' },
    {
      key: 'plan',
      header: 'Plan position',
      render: (row) => (
        <span className="font-mono text-[12px] text-ink-500">
          {row.plan_x}, {row.plan_y} · {row.plan_w}×{row.plan_h}
        </span>
      ),
    },
    { key: 'admission', header: 'Admission', render: (row) => (row.requires_admission ? <Badge tone="warning">queue</Badge> : <span className="text-[12px] text-ink-400">walk-in</span>) },
  ];

  return (
    <div>
      <PageHeader
        title="Campus & floors"
        description="Buildings, floors and rooms. Room geometry feeds the indoor map, navigation graph and the spatial editor."
      />

      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'buildings', label: 'Buildings', count: buildingOptions.length },
            { value: 'floors', label: 'Floors', count: floorOptions.length },
            { value: 'rooms', label: 'Rooms', count: rooms.data?.items.length },
          ]}
        />
      </div>

      <ResourceTable
        rows={tab === 'buildings' ? filtered.buildings : tab === 'floors' ? filtered.floors : filtered.rooms}
        columns={(tab === 'buildings' ? buildingColumns : tab === 'floors' ? floorColumns : roomColumns) as Column<Building | Floor | Room>[]}
        loading={tab === 'buildings' ? buildings.loading : tab === 'floors' ? floors.loading : rooms.loading}
        error={tab === 'buildings' ? buildings.error : tab === 'floors' ? floors.error : rooms.error}
        onRetry={() => (tab === 'buildings' ? buildings.reload() : tab === 'floors' ? floors.reload() : rooms.reload())}
        emptyTitle="Nothing to show"
        emptyDescription="Create the first record or clear the search."
        search={{ value: search, onChange: setSearch, placeholder: tab === 'buildings' ? 'Search buildings' : tab === 'floors' ? 'Search floors' : 'Search rooms' }}
        onCreate={openCreate}
        createLabel={tab === 'buildings' ? 'New building' : tab === 'floors' ? 'New floor' : 'New room'}
        rowActions={(row) => (
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => openEdit(tab, row)}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPendingDelete({ kind: tab, id: String(row.id), label: 'code' in row ? row.code : row.name })}>
              Remove
            </Button>
          </div>
        )}
      />

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? `Edit ${draft.kind.slice(0, -1)}` : `New ${draft?.kind.slice(0, -1) ?? 'record'}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void save()}>
              Save
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {draft.kind === 'buildings' ? (
              <>
                <Field label="Code" htmlFor="building-code" error={formError} hint="Short code used on the map, e.g. B.">
                  <Input id="building-code" value={draft.values.code} onChange={(event) => setDraft({ ...draft, values: { ...draft.values, code: event.target.value } })} />
                </Field>
                <Field label="Name" htmlFor="building-name">
                  <Input id="building-name" value={draft.values.name} onChange={(event) => setDraft({ ...draft, values: { ...draft.values, name: event.target.value } })} />
                </Field>
                <Field label="Campus" htmlFor="building-campus">
                  <Input id="building-campus" value={draft.values.campus_name} onChange={(event) => setDraft({ ...draft, values: { ...draft.values, campus_name: event.target.value } })} />
                </Field>
                <Field label="Status" htmlFor="building-status">
                  <Select id="building-status" value={draft.values.status} onChange={(event) => setDraft({ ...draft, values: { ...draft.values, status: event.target.value } })}>
                    {['operational', 'limited', 'maintenance', 'closed'].map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Latitude" htmlFor="building-lat" hint="Used for outdoor routing.">
                  <Input id="building-lat" value={draft.values.lat} onChange={(event) => setDraft({ ...draft, values: { ...draft.values, lat: event.target.value } })} placeholder="51.5245" />
                </Field>
                <Field label="Longitude" htmlFor="building-lng">
                  <Input id="building-lng" value={draft.values.lng} onChange={(event) => setDraft({ ...draft, values: { ...draft.values, lng: event.target.value } })} placeholder="-0.1340" />
                </Field>
              </>
            ) : null}

            {draft.kind === 'floors' ? (
              <>
                <Field label="Building" htmlFor="floor-building" error={formError}>
                  <Select id="floor-building" value={draft.values.building_id} onChange={(event) => setDraft({ ...draft, values: { ...draft.values, building_id: event.target.value } })}>
                    {buildingOptions.map((building) => (
                      <option key={building.id} value={building.id}>
                        {building.code} · {building.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Level" htmlFor="floor-level" hint="0 for ground, negative for basements.">
                  <Input id="floor-level" value={draft.values.level} onChange={(event) => setDraft({ ...draft, values: { ...draft.values, level: event.target.value } })} />
                </Field>
                <Field label="Name" htmlFor="floor-name">
                  <Input id="floor-name" value={draft.values.name} onChange={(event) => setDraft({ ...draft, values: { ...draft.values, name: event.target.value } })} placeholder="Ground floor" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Plan width (m)" htmlFor="floor-width">
                    <Input id="floor-width" value={draft.values.plan_width} onChange={(event) => setDraft({ ...draft, values: { ...draft.values, plan_width: event.target.value } })} />
                  </Field>
                  <Field label="Plan height (m)" htmlFor="floor-height">
                    <Input id="floor-height" value={draft.values.plan_height} onChange={(event) => setDraft({ ...draft, values: { ...draft.values, plan_height: event.target.value } })} />
                  </Field>
                </div>
              </>
            ) : null}

            {draft.kind === 'rooms' ? (
              <>
                <Field label="Building" htmlFor="room-building" error={formError}>
                  <Select
                    id="room-building"
                    value={draft.values.building_id}
                    onChange={(event) => setDraft({ ...draft, values: { ...draft.values, building_id: event.target.value, floor_id: floorOptions.find((floor) => floor.building_id === event.target.value)?.id ?? '' } })}
                  >
                    {buildingOptions.map((building) => (
                      <option key={building.id} value={building.id}>
                        {building.code} · {building.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Floor" htmlFor="room-floor">
                  <Select id="room-floor" value={draft.values.floor_id} onChange={(event) => setDraft({ ...draft, values: { ...draft.values, floor_id: event.target.value } })}>
                    <option value="">Select a floor…</option>
                    {floorOptions
                      .filter((floor) => floor.building_id === draft.values.building_id)
                      .map((floor) => (
                        <option key={floor.id} value={floor.id}>
                          {floor.name} (level {floor.level})
                        </option>
                      ))}
                  </Select>
                </Field>
                <Field label="Room code" htmlFor="room-code">
                  <Input id="room-code" value={draft.values.code} onChange={(event) => setDraft({ ...draft, values: { ...draft.values, code: event.target.value } })} />
                </Field>
                <Field label="Room name" htmlFor="room-name">
                  <Input id="room-name" value={draft.values.name} onChange={(event) => setDraft({ ...draft, values: { ...draft.values, name: event.target.value } })} />
                </Field>
                <Field label="Type" htmlFor="room-type">
                  <Select id="room-type" value={draft.values.room_type} onChange={(event) => setDraft({ ...draft, values: { ...draft.values, room_type: event.target.value } })}>
                    {ROOM_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Capacity" htmlFor="room-capacity">
                  <Input id="room-capacity" value={draft.values.capacity} onChange={(event) => setDraft({ ...draft, values: { ...draft.values, capacity: event.target.value } })} />
                </Field>
                <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                  <Field label="Plan x (m)" htmlFor="room-x">
                    <Input id="room-x" value={draft.values.plan_x} onChange={(event) => setDraft({ ...draft, values: { ...draft.values, plan_x: event.target.value } })} />
                  </Field>
                  <Field label="Plan y (m)" htmlFor="room-y">
                    <Input id="room-y" value={draft.values.plan_y} onChange={(event) => setDraft({ ...draft, values: { ...draft.values, plan_y: event.target.value } })} />
                  </Field>
                  <Field label="Width (m)" htmlFor="room-w">
                    <Input id="room-w" value={draft.values.plan_w} onChange={(event) => setDraft({ ...draft, values: { ...draft.values, plan_w: event.target.value } })} />
                  </Field>
                  <Field label="Height (m)" htmlFor="room-h">
                    <Input id="room-h" value={draft.values.plan_h} onChange={(event) => setDraft({ ...draft, values: { ...draft.values, plan_h: event.target.value } })} />
                  </Field>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove this record?"
        message={pendingDelete ? `“${pendingDelete.label}” will be deleted. Records still referenced by rooms, queues or sessions are protected by the database.` : ''}
        confirmLabel="Remove"
        tone="danger"
        onConfirm={() => void remove()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
