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
  onClearRoute?: () => void;
}

/**
 * Route visualisation. Outdoor legs are drawn on the schematic campus map, indoor legs
 * on the floor plan of the leg's floor — no third-party tiles are involved.
 */
export function RoutePreview({ route, walking, onClearRoute }: RoutePreviewProps) {
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

  return <RoutePreviewContent route={route} walking={walking} onClearRoute={onClearRoute} />;
}

function RoutePreviewContent({ route, walking, onClearRoute }: RoutePreviewProps) {
  const [mode, setMode] = useState<'campus' | 'indoor'>(() => (route.legs.some((leg) => leg.floor_id) ? 'indoor' : 'campus'));
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const buildings = useAsync(() => campusApi.buildings(), []);

  const steps = useMemo(() => {
    if (route.steps.length > 0) return route.steps;
    return [
      { index: 0, instruction: `Start at ${route.origin.label}`, kind: 'start', distance_m: 0, duration_s: 0, floor_id: route.legs[0]?.floor_id ?? null },
      ...route.legs.map((leg, i) => ({
        index: i + 1,
        instruction: leg.floor_name ? `Walk along ${leg.floor_name}` : 'Walk across campus grounds',
        kind: 'walk',
        distance_m: leg.distance_m,
        duration_s: leg.duration_s,
        floor_id: leg.floor_id,
      })),
      { index: route.legs.length + 1, instruction: `Arrive at ${route.destination.label}`, kind: 'arrive', distance_m: 0, duration_s: 0, floor_id: route.legs[route.legs.length - 1]?.floor_id ?? null },
    ];
  }, [route.steps, route.origin.label, route.destination.label, route.legs]);

  const currentStep = steps[Math.min(activeStep, steps.length - 1)];

  // Active indoor floor plan
  const indoorLeg = useMemo(() => {
    const legs = route.legs.filter((leg) => leg.floor_id);
    if (legs.length === 0) return null;
    const stepFloorId = currentStep?.floor_id ?? null;
    if (stepFloorId) {
      const match = legs.find((leg) => leg.floor_id === stepFloorId);
      if (match) return match;
    }
    return legs[0] ?? null;
  }, [route.legs, currentStep]);

  const plan = useAsync(
    () => (indoorLeg?.floor_id ? campusApi.floorPlan(indoorLeg.floor_id) : Promise.resolve(null)),
    [indoorLeg?.floor_id],
  );

  // Simulation playback loop
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => {
        if (prev >= steps.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 2200);
    return () => clearInterval(interval);
  }, [isPlaying, steps.length]);

  // Sync mode based on whether active step is indoor vs outdoor
  useEffect(() => {
    if (currentStep?.floor_id) {
      setMode('indoor');
    } else {
      setMode('campus');
    }
  }, [activeStep, currentStep?.floor_id]);

  const stepInstructionText = useMemo(() => {
    if (!currentStep) return 'Walking route';
    const distText = currentStep.distance_m > 0 ? ` · ${Math.round(currentStep.distance_m)} m remaining` : '';
    return `${currentStep.instruction}${distText}`;
  }, [currentStep]);

  // Calculate marker for current step on indoor plan
  const markerPoint = useMemo(() => {
    if (!indoorLeg) return null;
    const node = route.nodes.find((n) => n.floor_id === indoorLeg.floor_id);
    if (node && typeof node.plan_x === 'number' && typeof node.plan_y === 'number') {
      return { x: Number(node.plan_x), y: Number(node.plan_y), label: 'Walker', instruction: stepInstructionText };
    }
    const legPoint = indoorLeg.points?.[0];
    if (legPoint) return { x: legPoint.x, y: legPoint.y, label: 'Walker', instruction: stepInstructionText };
    return null;
  }, [indoorLeg, route.nodes, stepInstructionText]);

  const campusMarker = useMemo(() => {
    const node = route.nodes[Math.min(activeStep, route.nodes.length - 1)];
    if (node && typeof node.lat === 'number' && typeof node.lng === 'number') {
      return [{ lat: node.lat, lng: node.lng, label: 'Walker', tone: 'user' as const, instruction: stepInstructionText }];
    }
    return [];
  }, [route.nodes, activeStep, stepInstructionText]);

  const totalTimeMinutes = Math.max(1, Math.ceil((route.distance_m ?? 0) / 75));

  return (
    <Card className="!p-0 overflow-hidden border border-brand-100 shadow-md">
      {/* Route Header & View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          {onClearRoute ? (
            <button
              type="button"
              onClick={onClearRoute}
              className="rounded-[9px] border border-ink-200 bg-ink-50 px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-700 hover:bg-ink-100 transition-colors"
            >
              ← Clear route
            </button>
          ) : null}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-700">Route preview</span>
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                {route.accessible ? 'Step-free' : route.uses_stairs ? 'Stairs' : 'Standard'}
              </span>
            </div>
            <p className="mt-1 text-[15px] font-bold text-ink-900">
              {route.origin.label} → {route.destination.label}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('campus')}
            className={`rounded-[10px] px-3 py-1.5 text-[12px] font-semibold transition-colors ${mode === 'campus' ? 'bg-brand-600 text-white shadow-sm' : 'bg-ink-50 text-ink-600 hover:bg-ink-100'}`}
          >
            Campus Map
          </button>
          <button
            type="button"
            onClick={() => setMode('indoor')}
            disabled={!indoorLeg}
            className={`rounded-[10px] px-3 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-40 ${mode === 'indoor' ? 'bg-brand-600 text-white shadow-sm' : 'bg-ink-50 text-ink-600 hover:bg-ink-100'}`}
          >
            Indoor Plan
          </button>
        </div>
      </div>

      {/* Interactive Simulation & Playback Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-brand-900 px-4 py-2.5 text-white">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (activeStep >= steps.length - 1) setActiveStep(0);
              setIsPlaying(!isPlaying);
            }}
            className="flex min-h-8 min-w-8 items-center justify-center rounded-lg bg-mint-500 font-bold text-[13px] text-ink-950 transition-colors hover:bg-mint-400"
            aria-label={isPlaying ? 'Pause simulation' : 'Play simulation'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button
            type="button"
            disabled={activeStep === 0}
            onClick={() => {
              setIsPlaying(false);
              setActiveStep((s) => Math.max(0, s - 1));
            }}
            className="rounded-lg bg-brand-800 px-2.5 py-1 text-[12px] font-semibold text-brand-100 hover:bg-brand-700 disabled:opacity-30"
          >
            ◀ Prev
          </button>
          <button
            type="button"
            disabled={activeStep >= steps.length - 1}
            onClick={() => {
              setIsPlaying(false);
              setActiveStep((s) => Math.min(steps.length - 1, s + 1));
            }}
            className="rounded-lg bg-brand-800 px-2.5 py-1 text-[12px] font-semibold text-brand-100 hover:bg-brand-700 disabled:opacity-30"
          >
            Next ▶
          </button>
        </div>
        <div className="flex items-center gap-3 text-[12px]">
          <span className="font-medium text-brand-200">
            Step {activeStep + 1} of {steps.length}
          </span>
          <div className="h-2 w-28 overflow-hidden rounded-full bg-brand-800">
            <div
              className="h-full bg-mint-400 transition-all duration-300"
              style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Map / Floor Plan Visual Area */}
      {mode === 'campus' ? (
        buildings.loading ? (
          <CardSkeleton rows={6} />
        ) : (
          <CampusMap
            buildings={buildings.data?.buildings ?? []}
            route={route}
            markers={campusMarker}
            height={420}
            className="rounded-none border-0"
          />
        )
      ) : plan.error ? (
        <div className="p-4">
          <ErrorState message={plan.error} onRetry={plan.reload} />
        </div>
      ) : plan.loading || !plan.data ? (
        <div className="p-4">
          <CardSkeleton rows={6} />
        </div>
      ) : (
        <FloorPlan
          plan={plan.data}
          route={route}
          marker={markerPoint}
          className="rounded-none border-0"
        />
      )}

      {/* Route Metrics Summary */}
      <div className="grid grid-cols-2 gap-4 border-t border-ink-100 bg-ink-50/70 px-4 py-3 sm:grid-cols-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Distance</p>
          <p className="text-[15px] font-bold text-ink-900">{Math.round(route.distance_m ?? 0)} metres</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Est. Walk Time</p>
          <p className="text-[15px] font-bold text-ink-900">~{totalTimeMinutes} min</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Floor Changes</p>
          <p className="text-[15px] font-bold text-ink-900">{route.transitions.length}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Accessibility</p>
          <p className="text-[15px] font-bold text-ink-900">
            {route.accessible ? '100% Step-free' : route.uses_stairs ? 'Stairs required' : 'Elevators / Standard'}
          </p>
        </div>
      </div>

      {/* Turn-by-Turn Visual Directions List */}
      <div className="border-t border-ink-100 px-4 py-4">
        <SectionHeading
          title="Turn-by-turn directions & playback"
          description="Click any step to inspect and position the route map at that location."
        />
        <div className="mt-3 space-y-2">
          {steps.map((step, index) => {
            const isActive = index === activeStep;
            const stepIcon =
              step.kind === 'start' ? '📍' :
              step.kind === 'arrive' ? '🎯' :
              step.kind === 'elevator' ? '🛗' :
              step.kind === 'stairs' ? '🪜' : '🚶';

            return (
              <div
                key={`${step.instruction}-${index}`}
                onClick={() => {
                  setIsPlaying(false);
                  setActiveStep(index);
                }}
                className={`group flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-all ${
                  isActive
                    ? 'border-brand-500 bg-brand-50/60 shadow-sm ring-2 ring-brand-500/20'
                    : 'border-ink-100 bg-white hover:border-brand-200 hover:bg-ink-50/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[16px] font-bold ${
                      isActive ? 'bg-brand-600 text-white shadow-sm' : 'bg-ink-100 text-ink-700'
                    }`}
                  >
                    {stepIcon}
                  </div>
                  <div>
                    <p className={`text-[13px] font-bold ${isActive ? 'text-brand-900' : 'text-ink-800'}`}>
                      {step.instruction}
                    </p>
                    {step.floor_name ? (
                      <p className="text-[11px] text-ink-500">{step.floor_name}</p>
                    ) : null}
                  </div>
                </div>
                {step.distance_m > 0 ? (
                  <div className="text-right">
                    <span className="text-[12px] font-semibold text-ink-600">
                      {Math.round(step.distance_m)} m
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {route.destination.room_id ? (
        <div className="border-t border-ink-100 bg-ink-50/40 px-4 py-3">
          <Link
            href={`/student/campus/rooms/${route.destination.label.split(' ')[0]}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-bold text-brand-700 hover:text-brand-800"
          >
            View destination room details →
          </Link>
        </div>
      ) : null}
    </Card>
  );
}
