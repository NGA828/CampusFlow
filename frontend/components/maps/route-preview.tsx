'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAsync } from '@/lib/hooks';
import { campusApi } from '@/lib/api/endpoints';
import { CampusMap } from '@/components/maps/campus-map';
import { FloorPlan } from '@/components/maps/floor-plan';
import { Card, CardSkeleton, ErrorState, SectionHeading } from '@/components/ui/kit';
import type { NavigationWalking, Route } from '@/lib/api/types';

interface RoutePreviewProps {
  route: Route;
  walking: NavigationWalking | null;
}

/**
 * Route visualisation. Outdoor legs are drawn on the schematic campus map, indoor legs
 * on the floor plan of the leg's floor — no third-party tiles are involved.
 */
export function RoutePreview({ route, walking }: RoutePreviewProps) {
  if (
    !Array.isArray(route.nodes) ||
    !Array.isArray(route.legs) ||
    !Array.isArray(route.steps) ||
    !Array.isArray(route.transitions) ||
    !route.origin ||
    !route.destination
  ) {
    return (
      <Card>
        <ErrorState message="This route is incomplete. Please plan the route again after the navigation service is updated." />
      </Card>
    );
  }

  return <RoutePreviewContent route={route} walking={walking} />;
}

function RoutePreviewContent({ route, walking }: RoutePreviewProps) {
  const [mode, setMode] = useState<'campus' | 'indoor'>('indoor');

  const buildings = useAsync(() => campusApi.buildings(), []);

  const indoorLeg = useMemo(() => {
    const legs = route.legs.filter((leg) => leg.floor_id);
    if (legs.length === 0) return null;
    const stepFloorId = walking ? route.steps[walking.current_step_index]?.floor_id ?? null : null;
    const current = stepFloorId ? legs.find((leg) => leg.floor_id === stepFloorId) ?? null : null;
    return current ?? legs[0] ?? null;
  }, [route.legs, route.steps, walking]);

  const plan = useAsync(
    () => (indoorLeg?.floor_id ? campusApi.floorPlan(indoorLeg.floor_id) : Promise.resolve(null)),
    [indoorLeg?.floor_id],
  );

  const currentFloorId = indoorLeg?.floor_id ?? null;
  const markerPoint = useMemo(() => {
    if (!walking || !currentFloorId) return null;
    const leg = route.legs.find((candidate) => candidate.floor_id === currentFloorId);
    if (!leg || leg.points.length === 0) return null;
    return leg.points[Math.min(leg.points.length - 1, Math.round((walking.progress ?? 0) * (leg.points.length - 1)))];
  }, [walking, route.legs, currentFloorId]);

  useEffect(() => {
    if (indoorLeg) setMode('indoor');
  }, [indoorLeg]);

  return (
    <Card className="!p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-3">
        <div>
          <p className="text-[13px] font-semibold text-ink-800">{route.destination.label}</p>
          <p className="text-[12px] text-ink-500">
            From {route.origin.label}
            {indoorLeg?.floor_name ? ` · ${indoorLeg.floor_name}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('campus')}
            className={`rounded-[10px] px-2.5 py-1.5 text-[12px] font-medium ${mode === 'campus' ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:text-ink-700'}`}
          >
            Campus
          </button>
          <button
            type="button"
            onClick={() => setMode('indoor')}
            disabled={!indoorLeg}
            className={`rounded-[10px] px-2.5 py-1.5 text-[12px] font-medium disabled:opacity-40 ${mode === 'indoor' ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:text-ink-700'}`}
          >
            Indoor
          </button>
        </div>
      </div>

      {mode === 'campus' ? (
        buildings.loading ? (
          <CardSkeleton rows={5} />
        ) : (
          <CampusMap buildings={buildings.data?.buildings ?? []} route={route} height={420} className="rounded-none border-0" />
        )
      ) : plan.error ? (
        <div className="p-4">
          <ErrorState message={plan.error} onRetry={plan.reload} />
        </div>
      ) : plan.loading || !plan.data ? (
        <div className="p-4">
          <CardSkeleton rows={5} />
        </div>
      ) : (
        <FloorPlan
          plan={plan.data}
          route={route}
          marker={markerPoint ? { x: markerPoint.x, y: markerPoint.y, label: 'You' } : null}
          className="rounded-none border-0"
        />
      )}

      <div className="grid gap-4 border-t border-ink-100 px-4 py-3 sm:grid-cols-3">
        <div>
          <p className="text-[12px] text-ink-500">Legs</p>
          <p className="tnum text-[13px] font-medium text-ink-800">{route.legs.length}</p>
        </div>
        <div>
          <p className="text-[12px] text-ink-500">Floor changes</p>
          <p className="tnum text-[13px] font-medium text-ink-800">{route.transitions.length}</p>
        </div>
        <div>
          <p className="text-[12px] text-ink-500">Route type</p>
          <p className="text-[13px] font-medium text-ink-800">
            {route.accessible ? 'Step-free' : route.uses_stairs ? 'Includes stairs' : 'Standard'}
          </p>
        </div>
      </div>

      {route.legs.length > 1 ? (
        <div className="border-t border-ink-100 px-4 py-3">
          <SectionHeading title="Legs" description="Each leg is a single floor." />
          <ul className="space-y-1.5">
            {route.legs.map((leg, index) => (
              <li key={`${leg.floor_id ?? 'outdoor'}-${index}`} className="flex items-center justify-between rounded-[10px] bg-ink-50 px-3 py-2 text-[12.5px]">
                <span className="font-medium text-ink-700">
                  {leg.building_code ? `Building ${leg.building_code} · ` : ''}
                  {leg.floor_name ?? 'Outdoors'}
                </span>
                <span className="tnum text-ink-500">{Math.round(leg.distance_m)} m</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {route.destination.room_id ? (
        <div className="border-t border-ink-100 px-4 py-3">
          <Link href={`/student/campus/rooms/${route.destination.label.split(' ')[0]}`} className="text-[12.5px] font-medium text-brand-600 hover:text-brand-700">
            View room details →
          </Link>
        </div>
      ) : null}
    </Card>
  );
}
