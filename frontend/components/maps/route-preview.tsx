'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAsync } from '@/lib/hooks';
import { campusApi } from '@/lib/api/endpoints';
import { CampusMap } from '@/components/maps/campus-map';
import { FloorPlan } from '@/components/maps/floor-plan';
import { Card, CardSkeleton, ErrorState } from '@/components/ui/kit';
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
    <Card className="!p-0 overflow-hidden border border-indigo-900/50 shadow-xl bg-[linear-gradient(135deg,#0f172a,#1e293b)]">
      {/* Route Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-900/80 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          {onClearRoute ? (
            <button
              type="button"
              onClick={onClearRoute}
              className="rounded-[9px] border border-white/15 bg-white/8 px-2.5 py-1.5 text-[11.5px] font-semibold text-slate-200 hover:bg-white/15 transition-colors backdrop-blur-sm"
            >
              ← Clear route
            </button>
          ) : null}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-400">Route preview</span>
              <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: 'rgba(99,102,241,0.25)', color: '#a5b4fc' }}>
                {route.accessible ? 'Step-free' : route.uses_stairs ? 'Stairs' : 'Standard'}
              </span>
            </div>
            <p className="mt-1 text-[15px] font-bold text-white">
              {route.origin.label} → {route.destination.label}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('campus')}
            className={`rounded-[10px] px-3 py-1.5 text-[12px] font-semibold transition-all ${mode === 'campus' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'bg-white/8 text-slate-300 hover:bg-white/15'}`}
          >
            Campus Map
          </button>
          <button
            type="button"
            onClick={() => setMode('indoor')}
            disabled={!indoorLeg}
            className={`rounded-[10px] px-3 py-1.5 text-[12px] font-semibold transition-all disabled:opacity-40 ${mode === 'indoor' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'bg-white/8 text-slate-300 hover:bg-white/15'}`}
          >
            Indoor Plan
          </button>
        </div>
      </div>

      {/* Playback Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-4 py-2.5" style={{ background: 'linear-gradient(90deg, rgba(99,102,241,0.18) 0%, rgba(6,182,212,0.12) 100%)' }}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (activeStep >= steps.length - 1) setActiveStep(0);
              setIsPlaying(!isPlaying);
            }}
            className="flex min-h-8 min-w-8 items-center justify-center rounded-lg text-[13px] font-bold text-white transition-colors hover:opacity-90 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #6366f1, #06b6d4)' }}
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
            className="rounded-lg border border-white/15 bg-white/8 px-2.5 py-1 text-[12px] font-semibold text-slate-200 hover:bg-white/15 disabled:opacity-30 backdrop-blur-sm"
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
            className="rounded-lg border border-white/15 bg-white/8 px-2.5 py-1 text-[12px] font-semibold text-slate-200 hover:bg-white/15 disabled:opacity-30 backdrop-blur-sm"
          >
            Next ▶
          </button>
        </div>
        <div className="flex items-center gap-3 text-[12px]">
          <span className="font-medium text-slate-300">
            Step {activeStep + 1} of {steps.length}
          </span>
          <div className="h-2 w-28 overflow-hidden rounded-full bg-white/12">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${((activeStep + 1) / steps.length) * 100}%`, background: 'linear-gradient(90deg, #6366f1, #06b6d4)' }}
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
      <div className="grid grid-cols-2 gap-4 border-y border-white/8 px-4 py-3 sm:grid-cols-4" style={{ background: 'rgba(15,23,42,0.7)' }}>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400">Distance</p>
          <p className="text-[15px] font-bold text-white">{Math.round(route.distance_m ?? 0)} metres</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400">Est. Walk Time</p>
          <p className="text-[15px] font-bold text-white">~{totalTimeMinutes} min</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400">Floor Changes</p>
          <p className="text-[15px] font-bold text-white">{route.transitions.length}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400">Accessibility</p>
          <p className="text-[15px] font-bold text-white">
            {route.accessible ? '100% Step-free' : route.uses_stairs ? 'Stairs required' : 'Elevators / Standard'}
          </p>
        </div>
      </div>

      {/* Turn-by-turn Visual Directions */}
      <div className="border-t border-white/8 px-4 py-4" style={{ background: 'rgba(15,23,42,0.75)' }}>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-400">Turn-by-turn directions</p>
        <p className="mt-0.5 mb-3 text-[12px] text-slate-400">Click any step to inspect the route map at that location.</p>
        <div className="space-y-2">
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
                    ? 'border-indigo-500/60 shadow-md ring-1 ring-indigo-500/30'
                    : 'border-white/8 hover:border-indigo-500/30 hover:bg-white/5'
                }`}
                style={isActive ? { background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(6,182,212,0.12))' } : {}}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[16px] font-bold transition-all ${
                      isActive ? 'shadow-lg' : 'bg-white/8'
                    }`}
                    style={isActive ? { background: 'linear-gradient(135deg, #6366f1, #06b6d4)' } : {}}
                  >
                    {stepIcon}
                  </div>
                  <div>
                    <p className={`text-[13px] font-bold ${isActive ? 'text-white' : 'text-slate-300'}`}>
                      {step.instruction}
                    </p>
                    {step.floor_name ? (
                      <p className="text-[11px] text-slate-500">{step.floor_name}</p>
                    ) : null}
                  </div>
                </div>
                {step.distance_m > 0 ? (
                  <div className="text-right">
                    <span className={`text-[12px] font-semibold ${isActive ? 'text-cyan-400' : 'text-slate-500'}`}>
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
        <div className="border-t border-white/8 px-4 py-3" style={{ background: 'rgba(15,23,42,0.7)' }}>
          <Link
            href={`/student/campus/rooms/${route.destination.label.split(' ')[0]}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-bold text-indigo-400 hover:text-cyan-400 transition-colors"
          >
            View destination room details →
          </Link>
        </div>
      ) : null}
    </Card>
  );
}
