'use client';

/**
 * Georeferenced, WebGL campus map. MapLibre is used instead of Leaflet because
 * Leaflet is a 2D renderer; true pitched building extrusions require a WebGL
 * vector renderer. Campus-owned footprints and route geometry remain the source
 * of truth and are drawn above the OpenStreetMap-based context layer.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent, Marker } from 'maplibre-gl';
import { routeSegments, type RouteStartFix } from '@/lib/maps/route-geometry';
import { cx } from '@/components/ui/kit';
import type { Building, Position, Route } from '@/lib/api/types';

export interface MapMarker { lat: number; lng: number; label: string; tone?: 'user' | 'destination' | 'qr' | 'office' }
interface Props {
  buildings: Pick<Building, 'id'|'code'|'name'|'lat'|'lng'|'footprint'|'status'|'floor_count'|'room_count'|'has_elevator'>[];
  route?: Route | null; originFix?: RouteStartFix | null; markers?: MapMarker[];
  selectedBuildingId?: string | null; onSelectBuilding?: (id: string) => void; onOpenBuilding?: (id: string) => void;
  height?: number; className?: string;
}

const STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const square = (lng: number, lat: number): [number, number][] => {
  const d = 0.000055;
  return [[lng-d,lat-d],[lng+d,lat-d],[lng+d,lat+d],[lng-d,lat+d],[lng-d,lat-d]];
};

export function CampusMap({ buildings, route, originFix = null, markers = [], selectedBuildingId, onSelectBuilding, onOpenBuilding, height = 420, className }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRefs = useRef<Marker[]>([]);
  const callbacks = useRef({ onSelectBuilding, onOpenBuilding });
  const [ready, setReady] = useState(false);
  const [is3d, setIs3d] = useState(true);
  useEffect(() => { callbacks.current = { onSelectBuilding, onOpenBuilding }; }, [onSelectBuilding, onOpenBuilding]);

  const buildingData = useMemo<GeoJSON.FeatureCollection>(() => ({ type: 'FeatureCollection', features: buildings.filter(b => Number.isFinite(b.lat) && Number.isFinite(b.lng)).map(b => ({
    type: 'Feature', id: b.id, properties: { id: b.id, code: b.code, name: b.name, status: b.status, height: Math.max(7, (b.floor_count ?? 2) * 3.4), selected: b.id === selectedBuildingId },
    geometry: { type: 'Polygon', coordinates: [b.footprint && b.footprint.length >= 3 ? [...b.footprint, ...(b.footprint[0][0] === b.footprint.at(-1)?.[0] && b.footprint[0][1] === b.footprint.at(-1)?.[1] ? [] : [b.footprint[0]])] : square(b.lng,b.lat)] },
  })) }), [buildings, selectedBuildingId]);

  const routeData = useMemo<GeoJSON.FeatureCollection>(() => ({ type: 'FeatureCollection', features: route ? routeSegments(route, null).filter(s => s.points.length > 1).map((s, i) => ({
    type: 'Feature', properties: { saved: s.hasSavedGeometry, index: i }, geometry: { type: 'LineString', coordinates: s.points.map(p => [p.x,p.y]) },
  })) : [] }), [route]);

  const visibleMarkers = useMemo(() => {
    const values: MapMarker[] = [...markers];
    if (originFix) values.unshift({ lat: originFix.lat, lng: originFix.lng, label: 'Your current location', tone: 'user' });
    else if (route?.origin?.node && Number.isFinite(route.origin.node.lat) && Number.isFinite(route.origin.node.lng)) values.unshift({ lat: route.origin.node.lat!, lng: route.origin.node.lng!, label: route.origin.label, tone: 'user' });
    if (route?.destination?.node && Number.isFinite(route.destination.node.lat) && Number.isFinite(route.destination.node.lng)) values.push({ lat: route.destination.node.lat!, lng: route.destination.node.lng!, label: route.destination.label, tone: 'destination' });
    return values;
  }, [markers, originFix, route]);

  useEffect(() => {
    if (!host.current || mapRef.current || !buildings.length) return;
    let cancelled = false;
    void import('maplibre-gl').then((ml) => {
      if (cancelled || !host.current) return;
      const center: [number,number] = [buildings.reduce((n,b)=>n+b.lng,0)/buildings.length, buildings.reduce((n,b)=>n+b.lat,0)/buildings.length];
      const map = new ml.Map({ container: host.current, style: STYLE, center, zoom: 17, pitch: 58, bearing: -18, attributionControl: {} });
      mapRef.current = map;
      map.addControl(new ml.NavigationControl({ visualizePitch: true }), 'top-right');
      map.addControl(new ml.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, fitBoundsOptions: { maxZoom: 19 } }), 'top-right');
      map.on('load', () => {
        map.addSource('campus-buildings', { type: 'geojson', data: buildingData });
        map.addLayer({ id: 'campus-buildings', type: 'fill-extrusion', source: 'campus-buildings', minzoom: 14, paint: {
          'fill-extrusion-color': ['case',['boolean',['get','selected'],false],'#4f46e5',['match',['get','status'],'closed','#d95a67','maintenance','#e59b37','limited','#55a996','#8292d8']],
          'fill-extrusion-height': ['get','height'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.92,
        }});
        map.addLayer({ id: 'campus-labels', type: 'symbol', source: 'campus-buildings', layout: { 'text-field': ['concat',['get','code'],'\n',['get','name']], 'text-size': 12, 'text-anchor': 'top', 'text-offset': [0,1], 'text-max-width': 12 }, paint: { 'text-color':'#17231c','text-halo-color':'#fff','text-halo-width':2 } });
        map.addSource('campus-route', { type:'geojson', data: routeData });
        map.addLayer({ id:'route-casing', type:'line', source:'campus-route', paint:{'line-color':'#fff','line-width':9,'line-opacity':0.9}, layout:{'line-cap':'round','line-join':'round'} });
        map.addLayer({ id:'outdoor-route', type:'line', source:'campus-route', paint:{'line-color':'#2458b8','line-width':5,'line-dasharray':['case',['boolean',['get','saved'],false],['literal',[1,0]],['literal',[2,1.5]]]}, layout:{'line-cap':'round','line-join':'round'} });
        const click = (e: MapLayerMouseEvent) => { const f = e.features?.[0]; if (f?.properties?.id) callbacks.current.onSelectBuilding?.(f.properties.id); };
        map.on('click','campus-buildings',click);
        map.on('dblclick','campus-buildings',(e) => { const id=e.features?.[0]?.properties?.id; if(id) callbacks.current.onOpenBuilding?.(id); });
        map.on('mouseenter','campus-buildings',()=>{ map.getCanvas().style.cursor='pointer'; });
        map.on('mouseleave','campus-buildings',()=>{ map.getCanvas().style.cursor=''; });
        setReady(true);
      });
    });
    return () => { cancelled = true; markerRefs.current.forEach(m=>m.remove()); markerRefs.current=[]; mapRef.current?.remove(); mapRef.current=null; };
  // Data updates are handled through GeoJSON sources below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildings.length]);

  useEffect(() => { const source=mapRef.current?.getSource('campus-buildings') as GeoJSONSource|undefined; source?.setData(buildingData); }, [buildingData,ready]);
  useEffect(() => { const source=mapRef.current?.getSource('campus-route') as GeoJSONSource|undefined; source?.setData(routeData); }, [routeData,ready]);
  useEffect(() => {
    const map=mapRef.current; if(!map || !ready) return;
    markerRefs.current.forEach(m=>m.remove()); markerRefs.current=[];
    void import('maplibre-gl').then(ml => visibleMarkers.forEach(item => {
      const el=document.createElement('div'); el.className=`campus-map-marker campus-map-marker--${item.tone ?? 'qr'}`; el.title=item.label; el.setAttribute('aria-label',item.label);
      markerRefs.current.push(new ml.Marker({element:el}).setLngLat([item.lng,item.lat]).setPopup(new ml.Popup({offset:18}).setText(item.label)).addTo(map));
    }));
  }, [visibleMarkers,ready]);

  const toggle3d=()=>{ const map=mapRef.current; if(!map)return; const next=!is3d; setIs3d(next); map.easeTo({pitch:next?58:0,bearing:next?-18:0,duration:700}); };
  const recenter=()=>{ const map=mapRef.current;if(!map)return; const coords=buildings.map(b=>[b.lng,b.lat] as [number,number]); if(!coords.length)return; void import('maplibre-gl').then(ml=>{const bounds=coords.reduce((box,p)=>box.extend(p),new ml.LngLatBounds(coords[0],coords[0])); map.fitBounds(bounds,{padding:55,maxZoom:18,pitch:is3d?58:0});}); };

  return <div className={cx('relative overflow-hidden rounded-[var(--radius-card)] border border-ink-200 bg-[#e9efe9] shadow-[var(--shadow-card)]',className)} style={{height}}>
    <div ref={host} className="h-full w-full" role="application" aria-label={`Interactive 3D campus map with ${buildings.length} buildings`} />
    {!ready && <div className="absolute inset-0 grid place-items-center bg-[#e9efe9] text-sm font-semibold text-ink-600" role="status">Loading real-world campus map…</div>}
    <div className="absolute left-3 top-3 flex gap-2">
      <button type="button" onClick={toggle3d} className="rounded-xl border border-white/70 bg-white/95 px-3 py-2 text-xs font-bold text-brand-700 shadow-lg">{is3d?'2D plan':'3D buildings'}</button>
      <button type="button" onClick={recenter} className="rounded-xl border border-white/70 bg-white/95 px-3 py-2 text-xs font-bold text-ink-700 shadow-lg">Campus view</button>
    </div>
    <div className="pointer-events-none absolute bottom-7 left-3 rounded-xl bg-slate-950/80 px-3 py-2 text-[10px] text-white backdrop-blur"><strong>3D CAMPUS</strong> · tap a building · double-tap to explore</div>
    <div className="sr-only" data-testid="outdoor-route">{routeData.features.length ? 'Published outdoor route shown' : ''}</div>
  </div>;
}

export function positionMarker(position: Position | null): MapMarker[] {
  if (!position || position.lat === null || position.lng === null) return [];
  return [{ lat: position.lat, lng: position.lng, label: position.building_code ? `You · ${position.building_code}` : 'You', tone: 'user' }];
}
