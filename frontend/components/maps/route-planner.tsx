'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { campusApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { useAsync } from '@/lib/hooks';
import { Button, Card, ErrorState, Field, Input, SectionHeading, Select } from '@/components/ui/kit';
import { RoutePreview } from './route-preview';
import type { Route } from '@/lib/api/types';
import type { RouteStartFix } from '@/lib/maps/route-geometry';

interface RoutePlannerProps {
  onRouteCalculated?: (route: Route | null, startFix: RouteStartFix | null) => void;
  hidePreviewCard?: boolean;
}

/** Preview only: a browser location is requested only on explicit user action and is never saved or tracked. */
export function RoutePlanner({ onRouteCalculated, hidePreviewCard = false }: RoutePlannerProps = {}) {
  const params = useSearchParams();
  const destination = params.get('route') ?? '';
  return <RouteForm key={destination} initialDestination={destination} onRouteCalculated={onRouteCalculated} hidePreviewCard={hidePreviewCard} />;
}

function RouteForm({
  initialDestination,
  onRouteCalculated,
  hidePreviewCard = false,
}: {
  initialDestination: string;
  onRouteCalculated?: (route: Route | null, startFix: RouteStartFix | null) => void;
  hidePreviewCard?: boolean;
}) {
  const anchors = useAsync(() => campusApi.anchors(), []);
  const [destination, setDestination] = useState(initialDestination);
  const [origin, setOrigin] = useState('');
  const [startFix, setStartFix] = useState<RouteStartFix | null>(null);
  const [locating, setLocating] = useState(false);
  const [accessible, setAccessible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const choices = (anchors.data?.anchors ?? []).filter((anchor) => anchor.is_active && anchor.nav_node_id);

  const useBrowserLocation = () => {
    if (!navigator.geolocation) {
      setError('This browser does not provide location. Choose a published starting anchor instead.');
      return;
    }
    setLocating(true);
    setError(null);
    setStartFix(null);
    setOrigin('');
    setRoute(null);
    onRouteCalculated?.(null, null);
    navigator.geolocation.getCurrentPosition(
      (fix) => {
        const location: RouteStartFix = {
          lat: fix.coords.latitude,
          lng: fix.coords.longitude,
          accuracy_m: Number.isFinite(fix.coords.accuracy) ? fix.coords.accuracy : null,
        };
        setStartFix(location);
        setOrigin('');
        setRoute(null);
        onRouteCalculated?.(null, null);
        setLocating(false);
      },
      (locationError) => {
        setError(locationError.code === locationError.PERMISSION_DENIED
          ? 'Location permission was denied. Allow location access in your browser or choose a published starting anchor.'
          : locationError.code === locationError.TIMEOUT
            ? 'Your location could not be found before the request timed out. Try again or choose a published anchor.'
            : 'Your browser could not read a location. Choose a published starting anchor instead.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || (!origin && !startFix) || !destination.trim()) return;
    setBusy(true); setError(null); setRoute(null);
    try {
      const result = await campusApi.route({
        ...(startFix ? { from_lat: startFix.lat, from_lng: startFix.lng } : { from_node_id: origin }),
        to_room_code: destination.trim(),
        accessible,
      });
      if (!result.route?.nodes?.length || !result.route.steps?.length) {
        setError('No walkable route is available for these places. Try another starting point or ask campus staff to check the paths.');
        onRouteCalculated?.(null, null);
        return;
      }
      setRoute(result.route);
      onRouteCalculated?.(result.route, startFix);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The route could not be loaded. Please try again.');
      onRouteCalculated?.(null, null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="route-preview" className="scroll-mt-28 space-y-4" aria-label="Route preview planner">
      <Card>
        <SectionHeading
          title="Plan a route preview"
          description="Choose a published anchor or explicitly share a one-time browser location, then preview the shortest published path to a room. Web previews do not start live tracking or save your location."
        />
        {anchors.error ? (
          <ErrorState message={anchors.error} onRetry={anchors.reload} />
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Starting anchor" htmlFor="preview-origin">
                <Select
                  id="preview-origin"
                  required={!startFix}
                  value={origin}
                  disabled={busy || locating || anchors.loading}
                  onChange={(event) => {
                    setOrigin(event.target.value);
                    setStartFix(null);
                    setRoute(null);
                    onRouteCalculated?.(null, null);
                  }}
                >
                  <option value="">{anchors.loading ? 'Loading anchors…' : 'Choose a starting anchor'}</option>
                  {choices.map((anchor) => (
                    <option key={anchor.id} value={anchor.nav_node_id!}>
                      {anchor.label} · {anchor.code}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Destination room code" htmlFor="preview-destination">
                <Input
                  id="preview-destination"
                  value={destination}
                  disabled={busy}
                  required
                  placeholder="e.g. ADM-101, B204 or STB"
                  onChange={(event) => {
                    setDestination(event.target.value);
                    setRoute(null);
                    onRouteCalculated?.(null, null);
                  }}
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="secondary" disabled={busy || locating} onClick={useBrowserLocation}>
                {locating ? 'Finding your location…' : startFix ? 'Refresh my location' : 'Use my current location'}
              </Button>
              {startFix ? (
                <p className="text-[13px] text-ink-600" role="status">
                  Using one-time browser fix · about {startFix.accuracy_m === null ? 'unknown accuracy' : `±${Math.round(startFix.accuracy_m)} m accuracy`}.
                  Location is used for this preview only.
                </p>
              ) : (
                <p className="text-[13px] text-ink-500">Your browser will ask permission; location is not saved or tracked.</p>
              )}
            </div>
            {!anchors.loading && choices.length === 0 && !startFix ? (
              <p className="text-[13px] text-ink-500">
                No routable starting anchors are published yet. Use your browser location for an outdoor preview, or ask a campus administrator to configure anchors.
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <label className="flex min-h-11 items-center gap-2 text-[13px] text-ink-700">
                <input
                  type="checkbox"
                  checked={accessible}
                  disabled={busy}
                  onChange={(event) => {
                    setAccessible(event.target.checked);
                    setRoute(null);
                    onRouteCalculated?.(null, null);
                  }}
                />
                Step-free route (may be longer)
              </label>
              <Button type="submit" loading={busy} disabled={(!origin && !startFix) || !destination.trim() || locating}>
                Preview route
              </Button>
            </div>
          </form>
        )}
        {error ? <div className="mt-4"><ErrorState message={error} /></div> : null}
      </Card>
      {!hidePreviewCard && route ? <RoutePreview route={route} walking={null} startFix={startFix} /> : null}
    </section>
  );
}
