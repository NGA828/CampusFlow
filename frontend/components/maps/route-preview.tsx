'use client';

import { useEffect, useState } from 'react';
import { useAsync } from '@/lib/hooks';
import { campusApi } from '@/lib/api/endpoints';
import { CampusMap } from './campus-map';
import { FloorPlan } from './floor-plan';
import { Card, CardSkeleton, ErrorState } from '@/components/ui/kit';
import { finite, routeSegments, stepNode, type RouteStartFix } from '@/lib/maps/route-geometry';
import type { NavigationWalking, Route } from '@/lib/api/types';
import s from './route-preview.module.css';

interface Props { route: Route; walking: NavigationWalking | null; onClearRoute?: () => void; startFix?: RouteStartFix | null }

export function RoutePreview({ route, onClearRoute, startFix }: Props) {
  if (!Array.isArray(route.nodes) || !route.nodes.length || !Array.isArray(route.steps) || !route.steps.length || !Array.isArray(route.legs) || !route.origin || !route.destination) {
    return <Card><ErrorState message="No walkable route is available. Choose another starting point or ask campus staff to check the published paths." />
      {onClearRoute && <button onClick={onClearRoute}>Change route</button>}
    </Card>;
  }
  // A newly calculated route starts at its origin, not the previous route's step.
  return <RouteContent key={JSON.stringify(route)} route={route} onClearRoute={onClearRoute} startFix={startFix} />;
}

function RouteContent({ route, onClearRoute, startFix }: Omit<Props, 'walking'>) {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [view, setView] = useState<string | null | undefined>(undefined);
  const step = route.steps[active];
  const node = stepNode(route, step, active);
  const floorId = view === undefined ? (node?.floor_id ?? step.floor_id ?? null) : view;
  const buildings = useAsync(() => campusApi.buildings(), []);
  const plan = useAsync(() => floorId ? campusApi.floorPlan(floorId) : Promise.resolve(null), [floorId]);
  const floors = [...new Set(route.nodes.map(n => n.floor_id).filter((id): id is string => !!id))];
  const segments = routeSegments(route, floorId);
  const select = (index: number) => { setActive(index); setView(undefined); setPlaying(false); };

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      if (active >= route.steps.length - 1) setPlaying(false);
      else { setActive(active + 1); setView(undefined); }
    }, 2000);
    return () => clearTimeout(timer);
  }, [playing, active, route.steps.length]);

  const marker = node?.floor_id === floorId && finite(node?.plan_x) && finite(node?.plan_y)
    ? { x: node.plan_x, y: node.plan_y, label: `Step ${active + 1}` } : null;
  const geoMarker = node && finite(node.lat) && finite(node.lng)
    ? [{ lat: node.lat, lng: node.lng, label: `Step ${active + 1}`, tone: 'user' as const }] : [];
  const remaining = route.steps.slice(active + 1).reduce((sum, next) => sum + next.distance_m, 0);
  const floorLabel = (id: string) => route.steps.find(item => item.floor_id === id)?.floor_name
    ?? route.legs.find(leg => leg.floor_id === id)?.floor_name ?? 'Indoor floor';

  return <section className={s.preview} aria-label="Visual route preview">
    <header className={s.header}>
      <div><p className={s.eyebrow}>YOUR WALK ACROSS CAMPUS</p><h2>{startFix ? 'Your location' : route.origin.label} <span aria-hidden="true">→</span> {route.destination.label}</h2>
        <p>Shortest published {route.accessible ? 'step-free ' : ''}path · Preview, not live tracking{startFix && startFix.accuracy_m !== null ? ` · GPS accuracy ±${Math.round(startFix.accuracy_m)} m` : ''}</p></div>
      {onClearRoute && <button className={s.button} onClick={onClearRoute}>Change route</button>}
    </header>
    <div className={s.metrics}>
      <span><strong>{Math.round(route.distance_m)} m</strong> total distance</span>
      <span><strong>{Math.max(1, Math.ceil(route.duration_s / 60))} min</strong> estimated walk</span>
      <span><strong>{route.accessible ? 'Step-free requested' : route.uses_stairs ? 'Includes stairs' : 'Standard walking'}</strong> route preference</span>
    </div>
    <div className={s.workspace}>
      <div className={s.visual}>
        <div className={s.toolbar}>
          <label>Map view <select aria-label="Route map view" value={floorId ?? ''} onChange={e => { setView(e.target.value || null); setPlaying(false); }}>
            <option value="">Campus outdoors</option>
            {floors.map(id => <option key={id} value={id}>{floorLabel(id)}</option>)}
          </select></label>
          <button className={s.button} onClick={() => setView(undefined)}>Show selected step</button>
        </div>
        {floorId ? (
          plan.error ? <ErrorState message={plan.error} onRetry={plan.reload} /> :
          plan.loading || !plan.data || plan.data.floor.id !== floorId ? <CardSkeleton rows={7} /> :
          <FloorPlan plan={plan.data} route={route} marker={marker} />
        ) : buildings.error ? <ErrorState message={buildings.error} onRetry={buildings.reload} /> :
          buildings.loading ? <CardSkeleton rows={7} /> :
          <CampusMap buildings={buildings.data?.buildings ?? []} route={route} markers={geoMarker} originFix={startFix} height={460} />}
        {!segments.length && <p className={s.notice}>No walking line is published for this view. {floorId ? 'This may be a floor transition or a single location.' : 'Choose an indoor floor to see its corridor route.'} We do not draw a straight-line shortcut.</p>}
        <div className={s.legend}><span>● {startFix ? 'Your location' : `Start: ${route.origin.label}`}</span>{startFix && <span>┄ Dashed link: nearest walking node</span>}<span>→ Arrows show travel direction</span><span>◎ Destination: {route.destination.label}</span></div>
        <div className={s.current} aria-live="polite"><span className={s.stepNumber}>{active + 1}</span><div><strong>{step.instruction}</strong><p>{floorId ? floorLabel(floorId) : 'Campus outdoors'} · {Math.round(remaining)} m after this step</p></div></div>
        {!node && <p className={s.notice}>This instruction has no mapped position. The full published route remains visible.</p>}
        <div className={s.controls}>
          <button className={s.button} disabled={active === 0} onClick={() => select(active - 1)}>← Previous</button>
          <button className={s.play} onClick={() => { if (active === route.steps.length - 1) select(0); setPlaying(!playing); }}>{playing ? 'Pause preview' : 'Play step preview'}</button>
          <button className={s.button} disabled={active === route.steps.length - 1} onClick={() => select(active + 1)}>Next →</button>
        </div>
      </div>
      <aside className={s.directions} aria-label="Route directions"><h3>Your route, step by step</h3><p>Select a step to see its position on the correct floor.</p>
        <ol>{route.steps.map((item, index) => <li key={index}>
          <button aria-current={active === index ? 'step' : undefined} onClick={() => select(index)}>
            <span className={s.stepNumber}>{index + 1}</span><span><strong>{item.instruction}</strong><small>{item.floor_name || 'Campus outdoors'}{item.distance_m > 0 ? ` · ${Math.round(item.distance_m)} m` : ''}</small></span>
          </button>
        </li>)}</ol>
      </aside>
    </div>
    <footer className={s.footer}>Routes follow the campus’s published walking network. Unmapped shortcuts are not included. Check local signs and closures; use the mobile app for live positioning.</footer>
  </section>;
}
