'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAsync, formatClock } from '../../../lib/hooks';
import { campusApi, positioningApi } from '../../../lib/api/endpoints';
import { CampusMap } from '../../../components/maps/campus-map';
import { FloorPlan } from '../../../components/maps/floor-plan';
import { Badge, Button, Card, CardSkeleton, EmptyState, ErrorState, SegmentedControl, Skeleton } from '../../../components/ui/kit';
import { PageHeader } from '../../../components/layout/app-shell';
import type { Room } from '../../../lib/api/types';

export default function MapPage() {
  const buildings = useAsync(() => campusApi.buildings(), []);
  const position = useAsync(() => positioningApi.current(), []);
  const [mode, setMode] = useState<'campus' | 'indoor'>('campus');
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [floorId, setFloorId] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const activeBuildingId = buildingId ?? buildings.data?.buildings[0]?.id ?? null;

  const building = useAsync(
    () => (activeBuildingId ? campusApi.building(activeBuildingId) : Promise.resolve(null)),
    [activeBuildingId],
  );

  const floors = building.data?.floors ?? [];
  const activeFloorId = floorId ?? floors[0]?.id ?? null;

  const plan = useAsync(
    () => (activeFloorId ? campusApi.floorPlan(activeFloorId) : Promise.resolve(null)),
    [activeFloorId],
  );

  useEffect(() => {
    setFloorId(null);
    setSelectedRoom(null);
  }, [activeBuildingId]);

  useEffect(() => {
    if (plan.data?.floor && position.data?.position?.floor_id && position.data.position.floor_id === plan.data.floor.id) {
      /* the caller is on this floor — nothing to do, the marker below picks it up */
    }
  }, [plan.data, position.data]);

  const roomsOnFloor = plan.data?.rooms ?? [];
  const busyCodes = useMemo(() => new Set(Object.keys(plan.data?.busy ?? {})), [plan.data]);
  const currentPosition = position.data?.position ?? null;

  const quick = useMemo(() => {
    const list = roomsOnFloor.filter((room) => !busyCodes.has(room.id) && !busyCodes.has(room.code));
    return list.slice(0, 6);
  }, [roomsOnFloor, busyCodes]);

  if (buildings.error) {
    return (
      <div>
        <PageHeader title="Campus map" />
        <ErrorState message={buildings.error} onRetry={buildings.reload} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Campus map"
        description="Explore buildings floor by floor. Tap a room for details, or plan a route from wherever you are."
        actions={
          <>
            <SegmentedControl
              value={mode}
              onChange={setMode}
              size="sm"
              options={[
                { value: 'campus', label: 'Campus' },
                { value: 'indoor', label: 'Indoor' },
              ]}
            />
            <Link href="/navigate">
              <Button size="sm">Plan a route</Button>
            </Link>
          </>
        }
      />

      {position.data?.position ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[12px] border border-brand-100 bg-brand-50/70 px-4 py-2.5 text-[13px] text-brand-700">
          <span className="h-2 w-2 rounded-full bg-brand-600" />
          Your last known position: <strong className="font-semibold">{position.data.position.building_code ?? 'campus'}</strong>
          {position.data.position.floor_name ? `, ${position.data.position.floor_name}` : ''} · updated{' '}
          {formatClock(position.data.position.updated_at)}
          <Link href="/scan" className="ml-auto font-medium underline decoration-brand-300 hover:decoration-brand-600">
            Re-scan a QR anchor
          </Link>
        </div>
      ) : (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[12px] border border-ink-100 bg-white px-4 py-2.5 text-[13px] text-ink-600">
          <span className="h-2 w-2 rounded-full bg-ink-300" />
          No position yet — scan a QR anchor inside a building and CampusFlow can route you from exactly where you stand.
          <Link href="/scan" className="ml-auto font-medium text-brand-600 hover:text-brand-700">
            Scan a code
          </Link>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="!p-0">
          <div className="border-b border-ink-100 px-4 py-3">
            <p className="text-[13px] font-semibold text-ink-800">Buildings</p>
            <p className="text-[12px] text-ink-500">{buildings.data?.buildings.length ?? 0} mapped on campus</p>
          </div>
          {buildings.loading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <ul className="max-h-[420px] overflow-y-auto">
              {(buildings.data?.buildings ?? []).map((item) => {
                const active = item.id === activeBuildingId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setBuildingId(item.id);
                        setMode('indoor');
                      }}
                      className={`flex w-full items-start gap-3 border-b border-ink-50 px-4 py-3 text-left transition-colors ${active ? 'bg-brand-50/60' : 'hover:bg-ink-50'}`}
                    >
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[13px] font-semibold ${active ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600'}`}>
                        {item.code}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-ink-800">{item.name}</span>
                        <span className="mt-0.5 block truncate text-[12px] text-ink-500">
                          {item.floor_count ?? item.floors?.length ?? 0} floors · {item.room_count ?? '—'} rooms
                        </span>
                      </span>
                      <Badge tone={item.status === 'operational' ? 'success' : item.status === 'closed' ? 'danger' : 'warning'}>{item.status}</Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          {mode === 'campus' || !activeBuildingId ? (
            buildings.loading ? (
              <CardSkeleton rows={5} />
            ) : (
              <CampusMap
                buildings={buildings.data?.buildings ?? []}
                selectedBuildingId={activeBuildingId}
                onSelectBuilding={(id) => {
                  setBuildingId(id);
                  setMode('indoor');
                }}
                markers={
                  currentPosition?.lat && currentPosition?.lng
                    ? [{ lat: currentPosition.lat, lng: currentPosition.lng, label: 'You are here', tone: 'user' as const }]
                    : []
                }
                height={480}
              />
            )
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {floors.map((floor) => (
                  <button
                    key={floor.id}
                    type="button"
                    onClick={() => {
                      setFloorId(floor.id);
                      setSelectedRoom(null);
                    }}
                    className={`rounded-[10px] border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                      floor.id === activeFloorId ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300'
                    }`}
                  >
                    {floor.name}
                  </button>
                ))}
              </div>

              {plan.error ? <ErrorState message={plan.error} onRetry={plan.reload} /> : null}
              {plan.loading || !plan.data ? (
                <CardSkeleton rows={6} />
              ) : (
                <FloorPlan
                  plan={plan.data}
                  selectedRoomId={selectedRoom?.id ?? null}
                  onSelectRoom={setSelectedRoom}
                  showQr
                  className="h-[440px]"
                  marker={
                    currentPosition?.plan_x !== null && currentPosition?.plan_x !== undefined && currentPosition.floor_id === plan.data.floor.id
                      ? { x: Number(currentPosition.plan_x), y: Number(currentPosition.plan_y ?? 0), label: 'You' }
                      : null
                  }
                />
              )}

              {plan.data ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Card>
                    <p className="text-[13px] font-semibold text-ink-800">Rooms on this floor</p>
                    <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1">
                      {roomsOnFloor.map((room) => {
                        const busy = busyCodes.has(room.id) || busyCodes.has(room.code);
                        return (
                          <li key={room.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedRoom(room)}
                              className={`flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-[12.5px] ${
                                selectedRoom?.id === room.id ? 'bg-brand-50 text-brand-700' : 'hover:bg-ink-50'
                              }`}
                            >
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-ink-800">
                                  {room.code} · {room.name}
                                </span>
                                <span className="block text-[11.5px] text-ink-500">
                                  {room.room_type} · {room.capacity} seats
                                </span>
                              </span>
                              <Badge tone={busy ? 'warning' : 'success'}>{busy ? 'In use' : 'Free'}</Badge>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </Card>

                  <Card>
                    {selectedRoom ? (
                      <div>
                        <p className="text-[13px] font-semibold text-ink-900">
                          {selectedRoom.code} · {selectedRoom.name}
                        </p>
                        <p className="mt-1 text-[12.5px] text-ink-500">
                          {selectedRoom.room_type} · capacity {selectedRoom.capacity}
                          {selectedRoom.requires_admission ? ' · admission controlled' : ''}
                        </p>
                        {selectedRoom.amenities?.length ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {selectedRoom.amenities.map((amenity) => (
                              <Badge key={amenity} tone="neutral">
                                {amenity.replaceAll('_', ' ')}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                        {selectedRoom.accessibility?.length ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {selectedRoom.accessibility.map((feature) => (
                              <Badge key={feature} tone="success">
                                {feature.replaceAll('_', ' ')}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link href={`/navigate?to=${encodeURIComponent(selectedRoom.code)}`}>
                            <Button size="sm">Navigate here</Button>
                          </Link>
                          <Link href={`/rooms/${selectedRoom.code}`}>
                            <Button variant="secondary" size="sm">
                              Room details
                            </Button>
                          </Link>
                          {selectedRoom.requires_admission ? (
                            <Link href="/queue">
                              <Button variant="signal" size="sm">
                                Queue status
                              </Button>
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <EmptyState title="Select a room" description="Tap any room in the plan to see its capacity, facilities and actions." />
                    )}
                  </Card>
                </div>
              ) : null}

              {quick.length > 0 ? (
                <Card>
                  <p className="text-[13px] font-semibold text-ink-800">Free right now on this floor</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {quick.map((room) => (
                      <Link
                        key={room.id}
                        href={`/rooms/${room.code}`}
                        className="rounded-full border border-mint-200 bg-mint-50 px-3 py-1.5 text-[12.5px] font-medium text-mint-700 hover:border-mint-300"
                      >
                        {room.code} · {room.capacity} seats
                      </Link>
                    ))}
                  </div>
                </Card>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
