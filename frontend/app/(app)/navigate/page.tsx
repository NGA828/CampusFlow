'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useAsync, useDebounced, useGeolocation, formatDistance, formatDuration } from '../../../lib/hooks';
import { campusApi, navigationApi, positioningApi } from '../../../lib/api/endpoints';
import { ApiError } from '../../../lib/api/client';
import { Badge, Button, Card, CardSkeleton, EmptyState, Field, Input, Progress, Toggle } from '../../../components/ui/kit';
import { PageHeader } from '../../../components/layout/app-shell';
import { RoutePreview } from './route-preview';
import { useToast } from '../../../components/ui/toast';
import type { NavigationWalking, Route } from '../../../lib/api/types';

export default function NavigatePage() {
  return (
    <Suspense fallback={<CardSkeleton rows={6} />}>
      <NavigateScreen />
    </Suspense>
  );
}

function NavigateScreen() {
  const params = useSearchParams();
  const toast = useToast();
  const geo = useGeolocation();

  const [destination, setDestination] = useState(params.get('to') ?? '');
  const debounced = useDebounced(destination, 250);
  const [accessible, setAccessible] = useState(false);
  const [route, setRoute] = useState<Route | null>(null);
  const [destinationLabel, setDestinationLabel] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [walking, setWalking] = useState<NavigationWalking | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const lastSent = useRef<number>(0);

  const position = useAsync(() => positioningApi.current(), []);
  const matches = useAsync(
    () => (debounced.trim().length >= 2 ? campusApi.rooms({ q: debounced.trim(), limit: 8 }) : Promise.resolve(null)),
    [debounced],
  );

  useEffect(() => {
    if (!geo.watching) geo.start();
    // The watcher is intentionally only started once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plan = async (roomCode?: string) => {
    const target = (roomCode ?? destination).trim();
    if (!target) {
      setPlanError('Type a room code or name first.');
      return;
    }
    setPlanning(true);
    setPlanError(null);
    setSessionId(null);
    setWalking(null);
    try {
      const result = await navigationApi.route({ to_room_code: target, accessible });
      setRoute(result.route);
      setDestinationLabel(result.destination_label);
      setDestination(target);
    } catch (error) {
      setRoute(null);
      setPlanError(error instanceof ApiError ? (error.firstError ?? error.message) : 'Could not plan a route to that room.');
    } finally {
      setPlanning(false);
    }
  };

  const startWalk = async () => {
    const target = destination.trim();
    if (!target) return;
    try {
      const started = await navigationApi.startSession({ to_room_code: target, accessible });
      setSessionId(started.session_id);
      setRoute(started.route);
      setDestinationLabel(started.destination_label);
      toast.info('Live navigation started', 'Keep this screen open while you walk.');
    } catch (error) {
      toast.error('Could not start navigation', error instanceof ApiError ? (error.firstError ?? error.message) : 'Try again in a moment.');
    }
  };

  // Stream GPS fixes into the active navigation session; the backend owns progress,
  // off-route detection, the grace period and recalculation.
  useEffect(() => {
    if (!sessionId || !geo.position) return;
    const now = Date.now();
    if (now - lastSent.current < 5_000) return;
    lastSent.current = now;
    navigationApi
      .updatePosition(sessionId, { lat: geo.position.lat, lng: geo.position.lng, accuracy_m: geo.position.accuracy, source: 'gps' })
      .then((update) => {
        setWalking(update.navigation);
        if (update.navigation?.arrived) {
          toast.success('You have arrived', 'Navigation complete.');
        }
      })
      .catch((error) => setLiveError(error instanceof ApiError ? error.message : 'Position update failed.'));
  }, [sessionId, geo.position, toast]);

  // Fall back to the stored QR/GPS fix when the device has no live sensor.
  useEffect(() => {
    if (!sessionId || geo.position) return;
    const fix = position.data?.position;
    if (!fix) return;
    const timer = window.setInterval(() => {
      navigationApi
        .updatePosition(sessionId, {
          lat: fix.lat,
          lng: fix.lng,
          source: 'manual',
          plan_x: fix.plan_x,
          plan_y: fix.plan_y,
          floor_id: fix.floor_id,
        })
        .then((update) => setWalking(update.navigation))
        .catch(() => {});
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [sessionId, geo.position, position.data]);

  const finish = async (mode: 'complete' | 'abandon') => {
    if (!sessionId) return;
    try {
      if (mode === 'complete') await navigationApi.complete(sessionId);
      else await navigationApi.abandon(sessionId);
      toast.success(mode === 'complete' ? 'Navigation completed' : 'Navigation stopped');
    } catch {
      /* the session simply stays active on the server */
    } finally {
      setSessionId(null);
      setWalking(null);
    }
  };

  const steps = route?.steps ?? [];
  const activeStepIndex = walking?.current_step_index ?? 0;

  const fromLabel = useMemo(() => {
    if (position.data?.position?.building_name) {
      return `${position.data.position.building_name}${position.data.position.floor_name ? ` · ${position.data.position.floor_name}` : ''}`;
    }
    if (geo.position) return 'Your live GPS position';
    return null;
  }, [position.data, geo.position]);

  return (
    <div>
      <PageHeader
        title="Navigate"
        description="Turn-by-turn directions across campus and inside buildings. CampusFlow keeps you on route and recalculates if you wander off."
      />

      {!fromLabel ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[12px] border border-signal-200 bg-signal-50 px-4 py-3 text-[13px] text-signal-700">
          <span>No starting point yet. Scan a QR anchor, allow location access, or pick a start point below.</span>
          <Link href="/scan" className="font-medium underline decoration-signal-300 hover:decoration-signal-600">
            Scan a code
          </Link>
        </div>
      ) : (
        <div className="mb-4 flex items-center gap-2 rounded-[12px] border border-mint-200 bg-mint-50 px-4 py-2.5 text-[13px] text-mint-700">
          <span className="h-2 w-2 rounded-full bg-mint-500" />
          Starting from <strong className="font-semibold">{fromLabel}</strong>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <Card>
            <Field label="Where do you want to go?" htmlFor="destination" error={planError} hint="Room code works best — e.g. B204, C112, SA-…">
              <Input
                id="destination"
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void plan();
                }}
                placeholder="Search a room"
              />
            </Field>

            {matches.data && matches.data.items.length > 0 && debounced.trim() !== destination.trim() ? null : null}

            {matches.data && matches.data.items.length > 0 && !route ? (
              <ul className="mt-2 divide-y divide-ink-50 rounded-[10px] border border-ink-100">
                {matches.data.items.map((room) => (
                  <li key={room.id}>
                    <button
                      type="button"
                      onClick={() => void plan(room.code)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-ink-50"
                    >
                      <span>
                        <span className="block text-[13px] font-medium text-ink-800">
                          {room.code} · {room.name}
                        </span>
                        <span className="block text-[11.5px] text-ink-500">
                          {room.building_code} · {room.floor_name} · {room.capacity} seats
                        </span>
                      </span>
                      <span className="text-ink-300">→</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-3">
              <Toggle
                checked={accessible}
                onChange={setAccessible}
                label="Step-free route"
                description="Avoid stairs and use elevators and ramps where they exist."
              />
            </div>

            <div className="mt-2 flex gap-2">
              <Button loading={planning} onClick={() => void plan()} className="flex-1">
                Plan route
              </Button>
              {route ? <Button variant="secondary" onClick={() => void plan()}>Update</Button> : null}
            </div>
          </Card>

          {route ? (
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold text-ink-900">{destinationLabel ?? destination}</p>
                  <p className="tnum mt-1 text-[12.5px] text-ink-500">
                    {formatDistance(route.distance_m)} · about {formatDuration(route.duration_s)} on foot
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {route.accessible ? <Badge tone="success">Step-free</Badge> : route.uses_stairs ? <Badge tone="warning">Uses stairs</Badge> : null}
                </div>
              </div>

              {sessionId ? (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[12.5px] text-ink-600">
                    <span>Progress</span>
                    <span className="tnum">{Math.round((walking?.progress ?? 0) * 100)}%</span>
                  </div>
                  <div className="mt-1.5">
                    <Progress value={(walking?.progress ?? 0) * 100} tone={walking?.off_route ? 'signal' : 'brand'} />
                  </div>
                  {walking?.instruction ? (
                    <p className="mt-3 rounded-[10px] bg-brand-50 px-3 py-2 text-[13px] font-medium text-brand-700">{walking.instruction}</p>
                  ) : null}
                  <div className="tnum mt-2 flex items-center justify-between text-[12.5px] text-ink-500">
                    <span>{formatDistance(walking?.remaining_m ?? route.distance_m)} remaining</span>
                    {walking?.recalculated ? <span className="text-signal-600">Route recalculated</span> : null}
                  </div>

                  {walking?.off_route ? (
                    <div className="mt-3 rounded-[10px] border border-signal-200 bg-signal-50 px-3 py-2 text-[12.5px] text-signal-700">
                      You have stepped off the route.{' '}
                      {typeof walking.grace_seconds_remaining === 'number' && walking.grace_seconds_remaining > 0
                        ? `We will recalculate in ${walking.grace_seconds_remaining} s.`
                        : 'Recalculating…'}
                    </div>
                  ) : null}
                  {liveError ? <p className="mt-2 text-[12px] text-coral-600">{liveError}</p> : null}
                  {geo.error ? (
                    <p className="mt-2 text-[12px] text-ink-500">
                      Live GPS unavailable ({geo.error}). Progress uses your last scanned position instead.
                    </p>
                  ) : null}

                  <div className="mt-3 flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={() => void finish('abandon')}>
                      Stop
                    </Button>
                    <Button className="flex-1" onClick={() => void finish('complete')}>
                      I have arrived
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <Button className="w-full" onClick={() => void startWalk()}>
                    Start live navigation
                  </Button>
                  <p className="mt-2 text-[12px] text-ink-500">Live mode tracks your position, warns you when you drift off route and recalculates automatically.</p>
                </div>
              )}
            </Card>
          ) : null}

          {steps.length > 0 ? (
            <Card>
              <p className="text-[13px] font-semibold text-ink-800">Directions</p>
              <ol className="mt-3 space-y-2.5">
                {steps.map((step, index) => (
                  <li key={`${step.index}-${index}`} className={`flex gap-3 rounded-[10px] px-2.5 py-2 ${index === activeStepIndex && sessionId ? 'bg-brand-50' : ''}`}>
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11.5px] font-semibold ${index === activeStepIndex && sessionId ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600'}`}>
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] text-ink-800">{step.instruction}</span>
                      <span className="tnum block text-[11.5px] text-ink-500">
                        {formatDistance(step.distance_m)}
                        {step.floor_name ? ` · ${step.floor_name}` : ''}
                        {step.compass ? ` · heading ${step.compass}` : ''}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>

              {route && route.transitions.length > 0 ? (
                <div className="mt-3 border-t border-ink-100 pt-3">
                  <p className="text-[12.5px] font-medium text-ink-600">Floor changes</p>
                  <ul className="mt-1.5 space-y-1">
                    {route.transitions.map((transition, index) => (
                      <li key={index} className="text-[12.5px] text-ink-600">
                        {transition.instruction}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          {planning && !route ? (
            <CardSkeleton rows={6} />
          ) : route ? (
            <RoutePreview route={route} walking={walking} />
          ) : (
            <EmptyState
              title="Plan your first route"
              description="Search for a room, or open the campus map and pick a building to see what is inside."
              action={
                <Link href="/map">
                  <Button variant="secondary" size="sm">
                    Open campus map
                  </Button>
                </Link>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
