'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { campusApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { useAsync } from '@/lib/hooks';
import { Button, Card, ErrorState, Field, Input, SectionHeading, Select } from '@/components/ui/kit';
import { RoutePreview } from './route-preview';
import type { Route } from '@/lib/api/types';

/** Preview only: never starts a navigation session or claims the browser's physical location. */
export function RoutePlanner() {
  const params = useSearchParams();
  const destination = params.get('route') ?? '';
  return <RouteForm key={destination} initialDestination={destination} />;
}

function RouteForm({ initialDestination }: { initialDestination: string }) {
  const anchors = useAsync(() => campusApi.anchors(), []);
  const [destination, setDestination] = useState(initialDestination);
  const [origin, setOrigin] = useState('');
  const [accessible, setAccessible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const choices = (anchors.data?.anchors ?? []).filter((anchor) => anchor.is_active && anchor.nav_node_id);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !origin || !destination.trim()) return;
    setBusy(true); setError(null); setRoute(null);
    try { setRoute((await campusApi.route({ from_node_id: origin, to_room_code: destination.trim(), accessible })).route); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : 'The route could not be loaded. Please try again.'); }
    finally { setBusy(false); }
  };
  return <section id="route-preview" className="mt-6 scroll-mt-28 space-y-4" aria-label="Route preview planner">
    <Card><SectionHeading title="Plan a route preview" description="Choose a published starting anchor and a destination room. This is a preview, not live positioning or walking guidance." />
      {anchors.error ? <ErrorState message={anchors.error} onRetry={anchors.reload} /> : <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2"><Field label="Starting anchor" htmlFor="preview-origin"><Select id="preview-origin" required value={origin} disabled={busy || anchors.loading} onChange={(event) => { setOrigin(event.target.value); setRoute(null); }}><option value="">{anchors.loading ? 'Loading anchors…' : 'Choose a starting anchor'}</option>{choices.map((anchor) => <option key={anchor.id} value={anchor.nav_node_id!}>{anchor.label} · {anchor.code}</option>)}</Select></Field><Field label="Destination room code" htmlFor="preview-destination"><Input id="preview-destination" value={destination} disabled={busy} required placeholder="e.g. B204" onChange={(event) => { setDestination(event.target.value); setRoute(null); }} /></Field></div>
        {!anchors.loading && choices.length === 0 ? <p className="text-[13px] text-ink-500">No routable starting anchors are published yet. Your campus administrator can configure them.</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-4"><label className="flex min-h-11 items-center gap-2 text-[13px] text-ink-700"><input type="checkbox" checked={accessible} disabled={busy} onChange={(event) => { setAccessible(event.target.checked); setRoute(null); }} />Request a step-free route</label><Button type="submit" loading={busy} disabled={!origin || !destination.trim()}>Preview route</Button></div>
      </form>}
      {error ? <div className="mt-4"><ErrorState message={error} /></div> : null}
    </Card>
    {route ? <RoutePreview route={route} walking={null} /> : null}
  </section>;
}
