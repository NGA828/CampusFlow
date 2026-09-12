'use client';

/**
 * Schematic outdoor campus map.
 *
 * CampusFlow deliberately does not depend on third-party tile servers: building
 * footprints, open spaces and routes come from the campus database and are rendered as a
 * vector plan, so the map works offline and stays legible on any screen. Geography is
 * projected with a local equirectangular projection (accurate to a few metres over a
 * campus-sized area).
 */
import { useMemo, useState } from 'react';
import { cx } from '@/components/ui/kit';
import type { Building, Position, Route } from '@/lib/api/types';

export interface MapMarker {
  lat: number;
  lng: number;
  label: string;
  tone?: 'user' | 'destination' | 'qr' | 'office';
}

interface CampusMapProps {
  buildings: Pick<Building, 'id' | 'code' | 'name' | 'lat' | 'lng' | 'footprint' | 'status'>[];
  route?: Route | null;
  markers?: MapMarker[];
  selectedBuildingId?: string | null;
  onSelectBuilding?: (buildingId: string) => void;
  height?: number;
  className?: string;
}

const METERS_PER_DEG_LAT = 111_320;

function project(lat: number, lng: number, origin: { lat: number; lng: number }) {
  const mPerDegLng = METERS_PER_DEG_LAT * Math.cos((origin.lat * Math.PI) / 180);
  return { x: (lng - origin.lng) * mPerDegLng, y: -(lat - origin.lat) * METERS_PER_DEG_LAT };
}

export function CampusMap({
  buildings,
  route,
  markers = [],
  selectedBuildingId,
  onSelectBuilding,
  height = 420,
  className,
}: CampusMapProps) {
  const [zoom, setZoom] = useState(1);
  const [hovered, setHovered] = useState<string | null>(null);

  const origin = useMemo(() => {
    if (buildings.length === 0) return { lat: 0, lng: 0 };
    const lat = buildings.reduce((sum, building) => sum + building.lat, 0) / buildings.length;
    const lng = buildings.reduce((sum, building) => sum + building.lng, 0) / buildings.length;
    return { lat, lng };
  }, [buildings]);

  const geometry = useMemo(() => {
    const points: { x: number; y: number }[] = [];
    for (const building of buildings) {
      points.push(project(building.lat, building.lng, origin));
      for (const [lng, lat] of building.footprint ?? []) points.push(project(lat, lng, origin));
    }
    for (const marker of markers) points.push(project(marker.lat, marker.lng, origin));
    for (const leg of route?.legs ?? []) {
      for (const point of leg.geo ?? []) points.push(project(point.lat, point.lng, origin));
    }
    if (points.length === 0) return { minX: -50, maxX: 50, minY: -50, maxY: 50, width: 100, height: 100 };
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const padding = 40;
    const minX = Math.min(...xs) - padding;
    const maxX = Math.max(...xs) + padding;
    const minY = Math.min(...ys) - padding;
    const maxY = Math.max(...ys) + padding;
    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
  }, [buildings, markers, origin, route]);

  const toSvg = (lat: number, lng: number) => project(lat, lng, origin);

  const routePath = useMemo(() => {
    const segments: string[] = [];
    for (const leg of route?.legs ?? []) {
      const points = (leg.geo ?? []).map((point) => toSvg(point.lat, point.lng));
      if (points.length < 2) continue;
      segments.push(points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' '));
    }
    return segments.join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, origin]);

  const markersWithTones: MapMarker[] = [];
  if (typeof route?.origin?.node?.lat === 'number' && typeof route.origin.node.lng === 'number') {
    markersWithTones.push({ lat: route.origin.node.lat, lng: route.origin.node.lng, label: route.origin.label, tone: 'user' });
  }
  if (typeof route?.destination?.node?.lat === 'number' && typeof route.destination.node.lng === 'number') {
    markersWithTones.push({ lat: route.destination.node.lat, lng: route.destination.node.lng, label: route.destination.label, tone: 'destination' });
  }
  markersWithTones.push(...markers);

  const toneClasses: Record<string, string> = {
    user: 'fill-brand-600',
    destination: 'fill-coral-500',
    qr: 'fill-signal-400',
    office: 'fill-mint-500',
  };

  return (
    <div className={cx('relative overflow-hidden rounded-[var(--radius-card)] border border-ink-100 bg-[#f2f4fb]', className)} style={{ height }}>
      <svg
        viewBox={`${geometry.minX} ${geometry.minY} ${geometry.width} ${geometry.height}`}
        className="h-full w-full"
        role="img"
        aria-label="Schematic campus map"
        style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform 150ms ease-out' }}
      >
        <defs>
          <pattern id="cf-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0H0V20" fill="none" stroke="#dfe3f0" strokeWidth="0.5" />
          </pattern>
          <marker id="cf-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="#f9a92c" />
          </marker>
        </defs>

        <rect x={geometry.minX} y={geometry.minY} width={geometry.width} height={geometry.height} fill="url(#cf-grid)" />

        {/* Open spaces: a soft ring around the plaza keep the plan readable. */}
        <circle cx={0} cy={0} r={26} fill="#e6ebf7" stroke="#d3daf0" strokeWidth="1" />

        {buildings.map((building) => {
          const footprint = building.footprint;
          const center = toSvg(building.lat, building.lng);
          const isSelected = building.id === selectedBuildingId;
          const isHovered = building.id === hovered;
          const statusColour =
            building.status === 'closed' ? '#e6a5ab' : building.status === 'maintenance' ? '#f4cf95' : building.status === 'limited' ? '#cfe6de' : '#cdd6f5';

          return (
            <g
              key={building.id}
              onMouseEnter={() => setHovered(building.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelectBuilding?.(building.id)}
              className={onSelectBuilding ? 'cursor-pointer' : undefined}
            >
              {footprint && footprint.length > 2 ? (
                <polygon
                  points={footprint.map(([lng, lat]) => {
                    const point = toSvg(lat, lng);
                    return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
                  }).join(' ')}
                  fill={isSelected ? '#9ea9ff' : statusColour}
                  stroke={isSelected ? '#4340e0' : '#8b96bd'}
                  strokeWidth={isSelected ? 1.6 : 1}
                  opacity={isHovered || isSelected ? 1 : 0.92}
                />
              ) : null}
              <circle cx={center.x} cy={center.y} r={isSelected ? 6 : 4.5} fill="#2d2a95" opacity={0.85} />
              <text x={center.x} y={center.y - 9} textAnchor="middle" className="fill-ink-700" style={{ fontSize: 8, fontWeight: 600 }}>
                {building.code}
              </text>
              {isHovered || isSelected ? (
                <text x={center.x} y={center.y + 16} textAnchor="middle" className="fill-ink-500" style={{ fontSize: 6.5 }}>
                  {building.name}
                </text>
              ) : null}
            </g>
          );
        })}

        {routePath ? <path d={routePath} fill="none" stroke="#f9a92c" strokeWidth="3" strokeLinecap="round" className="route-dash" markerEnd="url(#cf-arrow)" /> : null}

        {markersWithTones.map((marker, index) => {
          const point = toSvg(marker.lat, marker.lng);
          return (
            <g key={`${marker.label}-${index}`}>
              <circle cx={point.x} cy={point.y} r={4.5} className={toneClasses[marker.tone ?? 'qr']} />
              <circle cx={point.x} cy={point.y} r={8} fill="none" className={toneClasses[marker.tone ?? 'qr']} opacity={0.25} />
            </g>
          );
        })}
      </svg>

      <div className="absolute top-3 right-3 flex flex-col gap-1">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => setZoom((value) => Math.min(2.5, Number((value + 0.2).toFixed(2))))}
          className="grid h-8 w-8 place-items-center rounded-[9px] border border-ink-200 bg-white/95 text-ink-600 hover:border-ink-300"
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => setZoom((value) => Math.max(0.6, Number((value - 0.2).toFixed(2))))}
          className="grid h-8 w-8 place-items-center rounded-[9px] border border-ink-200 bg-white/95 text-ink-600 hover:border-ink-300"
        >
          −
        </button>
      </div>

      <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-3 rounded-[10px] border border-ink-100 bg-white/92 px-3 py-1.5 text-[11px] text-ink-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-600" /> You are here
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-coral-500" /> Destination
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-signal-400" /> Route
        </span>
      </div>
    </div>
  );
}

export function positionMarker(position: Position | null): MapMarker[] {
  if (!position || position.lat === null || position.lng === null) return [];
  return [
    {
      lat: position.lat,
      lng: position.lng,
      label: position.building_code ? `You · ${position.building_code}` : 'You',
      tone: 'user',
    },
  ];
}
