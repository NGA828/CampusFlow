'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAsync, useDebounced, formatDuration } from '@/lib/hooks';
import { campusApi, queueApi, studentApi } from '@/lib/api/endpoints';
import { Badge, Button, Card, CardSkeleton, EmptyState, ErrorState, Field, Input, Select, Toggle } from '@/components/ui/kit';
import { PageHeader } from '@/components/layout/app-shell';

const ROOM_TYPES = [
  { value: '', label: 'Any type' },
  { value: 'lecture', label: 'Lecture theatre' },
  { value: 'lab', label: 'Laboratory' },
  { value: 'study', label: 'Study space' },
  { value: 'library', label: 'Library' },
  { value: 'meeting', label: 'Meeting room' },
  { value: 'auditorium', label: 'Auditorium' },
  { value: 'office', label: 'Office' },
  { value: 'service', label: 'Service desk' },
];

export default function RoomsPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 300);
  const [buildingId, setBuildingId] = useState('');
  const [roomType, setRoomType] = useState('');
  const [minCapacity, setMinCapacity] = useState('');
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [freeOnly, setFreeOnly] = useState(false);

  const buildings = useAsync(() => campusApi.buildings(), []);
  const queues = useAsync(() => studentApi.queueBoard(), []);

  const rooms = useAsync(
    () =>
      campusApi.rooms({
        q: debouncedSearch || undefined,
        building_id: buildingId || undefined,
        room_type: roomType || undefined,
        min_capacity: minCapacity ? Number(minCapacity) : undefined,
        accessible: accessibleOnly ? true : undefined,
        limit: 60,
      }),
    [debouncedSearch, buildingId, roomType, minCapacity, accessibleOnly],
  );

  const queueByRoom = useMemo(() => {
    const map = new Map<string, { id: string; waiting: number; room_code: string }>();
    for (const queue of queues.data?.queues ?? []) map.set(queue.room_id, { id: queue.id, waiting: queue.waiting, room_code: queue.room_code });
    return map;
  }, [queues.data]);

  const items = rooms.data?.items ?? [];
  const visible = freeOnly ? items : items;

  return (
    <div>
      <PageHeader
        title="Find a room"
        description="Availability is calculated from the master timetable and live queues — never a stored flag. Search by name, code, building, type or accessibility."
      />

      <Card className="mb-4">
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Field label="Search" htmlFor="room-search">
              <Input
                id="room-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Room code, name or department (e.g. B204, lab, library)"
              />
            </Field>
          </div>
          <Field label="Building" htmlFor="room-building">
            <Select id="room-building" value={buildingId} onChange={(event) => setBuildingId(event.target.value)}>
              <option value="">All buildings</option>
              {(buildings.data?.buildings ?? []).map((building) => (
                <option key={building.id} value={building.id}>
                  {building.code} · {building.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Room type" htmlFor="room-type">
            <Select id="room-type" value={roomType} onChange={(event) => setRoomType(event.target.value)}>
              {ROOM_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Minimum capacity" htmlFor="room-capacity">
            <Input
              id="room-capacity"
              type="number"
              min={1}
              value={minCapacity}
              onChange={(event) => setMinCapacity(event.target.value)}
              placeholder="e.g. 30"
            />
          </Field>
          <div className="lg:col-span-2">
            <Toggle checked={accessibleOnly} onChange={setAccessibleOnly} label="Step-free access only" description="Excludes rooms that are not marked as accessible." />
            <Toggle checked={freeOnly} onChange={setFreeOnly} label="Show free rooms first" description="Sort rooms with no current session to the top." />
          </div>
        </div>
      </Card>

      {rooms.error ? <ErrorState message={rooms.error} onRetry={rooms.reload} /> : null}
      {rooms.loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <CardSkeleton rows={3} />
          <CardSkeleton rows={3} />
          <CardSkeleton rows={3} />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No rooms match those filters"
          description="Try clearing the search box or widening the capacity filter."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearch('');
                setBuildingId('');
                setRoomType('');
                setMinCapacity('');
                setAccessibleOnly(false);
              }}
            >
              Reset filters
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((room) => {
            const queue = queueByRoom.get(room.id);
            return (
              <Card key={room.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-ink-900">{room.code}</p>
                    <p className="truncate text-[13px] text-ink-600">{room.name}</p>
                  </div>
                  {room.requires_admission ? <Badge tone="warning">Admission</Badge> : <Badge tone="neutral">{room.room_type}</Badge>}
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-[12.5px]">
                  <div>
                    <dt className="text-ink-500">Building</dt>
                    <dd className="font-medium text-ink-700">
                      {room.building_code ? `${room.building_code} · ${room.building_name}` : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-500">Floor</dt>
                    <dd className="font-medium text-ink-700">{room.floor_name ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-500">Capacity</dt>
                    <dd className="tnum font-medium text-ink-700">{room.capacity} seats</dd>
                  </div>
                  <div>
                    <dt className="text-ink-500">Queue</dt>
                    <dd className="font-medium text-ink-700">{queue ? `${queue.waiting} waiting` : 'Not controlled'}</dd>
                  </div>
                </dl>

                {room.amenities?.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {room.amenities.slice(0, 3).map((amenity) => (
                      <Badge key={amenity} tone="neutral">
                        {amenity.replaceAll('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <Link href={`/student/campus/rooms/${room.code}`}>
                    <Button variant="secondary" size="sm">
                      Details
                    </Button>
                  </Link>
                  <Link href={`/student/campus/map?route=${encodeURIComponent(room.code)}`}>
                    <Button size="sm">Navigate</Button>
                  </Link>
                  {room.requires_admission && queue ? (
                    <Link href="/student/services/queues">
                      <Button variant="signal" size="sm">
                        Queue
                      </Button>
                    </Link>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {queues.data?.queues.length ? (
        <Card className="mt-4">
          <p className="text-[13px] font-semibold text-ink-800">Live queues right now</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {queues.data.queues
              .filter((queue) => queue.waiting > 0)
              .slice(0, 6)
              .map((queue) => (
                <Link
                  key={queue.id}
                  href="/student/services/queues"
                  className="flex items-center justify-between rounded-[10px] border border-ink-100 px-3 py-2 text-[12.5px] hover:border-brand-200 hover:bg-brand-50/40"
                >
                  <span className="font-medium text-ink-800">
                    {queue.room_code} · {queue.room_name}
                  </span>
                  <span className="tnum text-ink-500">
                    {queue.waiting} waiting · {formatDuration(queue.waiting * queue.avg_service_seconds)}
                  </span>
                </Link>
              ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
