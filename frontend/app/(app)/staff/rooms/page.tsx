'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAsync, useDebounced } from '@/lib/hooks';
import { staffApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Badge, Button, Card, CardSkeleton, EmptyState, ErrorState, Input, SectionHeading, Select } from '@/components/ui/kit';
import { PageHeader } from '@/components/layout/app-shell';
import { useToast } from '@/components/ui/toast';
import type { Room } from '@/lib/api/types';

const STATUSES = [
  { value: 'available', label: 'Available' },
  { value: 'occupied', label: 'Occupied' },
  { value: 'closed', label: 'Closed' },
  { value: 'maintenance', label: 'Maintenance' },
] as const;

/**
 * `/staff/rooms` — the rooms an operator may run today.
 *
 * This is the one campus write a staff member has: `PATCH /staff/rooms/{room}` moves `status` (and
 * nothing else) on rooms within their scope. Capacity, geometry, access rules and whether a room has a
 * queue at all are administration — `StaffController::updateRoom` accepts a two-field payload precisely
 * so that "I found the room locked" cannot become "I redecorated the building".
 */
export default function StaffRoomsPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const query = useDebounced(search, 300);
  const [busy, setBusy] = useState<string | null>(null);
  const rooms = useAsync(() => staffApi.rooms({ q: query || undefined, per_page: 48 }), [query]);

  const setStatus = async (room: Room, status: Room['status']) => {
    setBusy(room.id);
    try {
      await staffApi.updateRoom(room.id, { status });
      toast.success(`${room.code} marked ${status}`, 'Students see this on the room board straight away.');
      rooms.reload();
    } catch (caught) {
      toast.error('Could not update the room', caught instanceof ApiError ? caught.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  if (rooms.error) {
    return (
      <div>
        <PageHeader title="Rooms" />
        <ErrorState message={rooms.error} onRetry={rooms.reload} />
      </div>
    );
  }

  const rows = rooms.data?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Rooms"
        description="Rooms you are responsible for. Update how a room is being used today — availability, closures, maintenance."
        actions={
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter by code or name…"
            className="w-full sm:w-64"
          />
        }
      />

      {rooms.loading ? (
        <CardSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState title="No rooms in your scope" description="Rooms appear here when they are assigned to you or shared with staff. Ask administration to assign the rooms you run." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((room) => (
            <Card key={room.id} className="flex flex-col">
              <SectionHeading
                title={room.code}
                description={`${room.name} · ${room.building_code ?? room.building_id.slice(0, 8)} · ${room.floor_name ?? '—'} · seats ${room.capacity}`}
                action={
                  <Badge tone={room.status === 'available' ? 'success' : room.status === 'closed' ? 'danger' : 'warning'}>
                    {room.status}
                  </Badge>
                }
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Select
                  value={room.status}
                  onChange={(event) => void setStatus(room, event.target.value as Room['status'])}
                  className="min-w-[9rem]"
                  disabled={busy === room.id}
                >
                  {STATUSES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                {room.requires_admission ? (
                  // Not a link to the student room page: that screen belongs to the student tree and the
                  // server would refuse it. The operator's equivalent is their own queue line.
                  <Link href="/staff/queues" className="text-[12.5px] font-medium text-brand-600 hover:text-brand-700">
                    Open its line
                  </Link>
                ) : null}
              </div>
              {room.requires_admission ? (
                <p className="mt-2 text-[11.5px] leading-snug text-ink-500">
                  Entry to this room is controlled: students need a ticket, so the status you set here decides whether they can be let in.
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
