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
import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/ui/kit';
import type { Building, Position, Route } from '@/lib/api/types';

export interface MapMarker {
  lat: number;
  lng: number;
  label: string;
  tone?: 'user' | 'destination' | 'qr' | 'office';
}

interface CampusMapProps {
  buildings: Pick<
    Building,
    | 'id'
    | 'code'
    | 'name'
    | 'lat'
    | 'lng'
    | 'footprint'
    | 'status'
    | 'floor_count'
    | 'room_count'
    | 'has_elevator'
  >[];
  route?: Route | null;
  markers?: MapMarker[];
  selectedBuildingId?: string | null;
  onSelectBuilding?: (buildingId: string) => void;
  onOpenBuilding?: (buildingId: string) => void;
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
  onOpenBuilding,
  height = 420,
  className,
}: CampusMapProps) {
  const [zoom, setZoom] = useState(1);
  const [hovered, setHovered] = useState<string | null>(null);
  const [labelsVisible, setLabelsVisible] = useState(true);
  const mapId = useId().replace(/:/g, '');

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
  const selectedBuilding = buildings.find((building) => building.id === selectedBuildingId) ?? null;
  const scaleMetres = Math.max(10, Math.round(geometry.width / 5 / 10) * 10);
  const scaleWidth = Math.max(44, Math.min(116, (scaleMetres / geometry.width) * 100));

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

  const toneClasses: Record<string, { fill: string; ring: string }> = {
    user: { fill: '#4340e0', ring: '#7a83fb' },
    destination: { fill: '#dd3746', ring: '#fb929c' },
    qr: { fill: '#f9a92c', ring: '#ffd889' },
    office: { fill: '#129a84', ring: '#63d3bd' },
  };

  return (
    <div
      className={cx('relative overflow-hidden rounded-[var(--radius-card)] border border-ink-200 bg-[#e9efe9] shadow-[var(--shadow-card)]', className)}
      style={{ height }}
    >
      <svg
        viewBox={`${geometry.minX} ${geometry.minY} ${geometry.width} ${geometry.height}`}
        className="h-full w-full"
        role="img"
        aria-label={`Interactive campus map with ${buildings.length} buildings`}
        style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform 150ms ease-out' }}
      >
        <defs>
          <linearGradient id={`${mapId}-surface`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f5f8f1" />
            <stop offset="1" stopColor="#e7eee7" />
          </linearGradient>
          <pattern id={`${mapId}-grid`} width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0H0V20" fill="none" stroke="#cddbcf" strokeWidth="0.5" />
            <circle cx="1.5" cy="1.5" r="0.6" fill="#c5d5c8" opacity="0.65" />
          </pattern>
          <filter id={`${mapId}-shadow`} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#243a32" floodOpacity="0.18" />
          </filter>
          <filter id={`${mapId}-glow`} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <marker id={`${mapId}-arrow`} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="#e3890c" />
          </marker>
        </defs>

        <rect x={geometry.minX} y={geometry.minY} width={geometry.width} height={geometry.height} fill={`url(#${mapId}-surface)`} />
        <rect x={geometry.minX} y={geometry.minY} width={geometry.width} height={geometry.height} fill={`url(#${mapId}-grid)`} opacity="0.78" />
        <rect
          x={geometry.minX + 8}
          y={geometry.minY + 8}
          width={geometry.width - 16}
          height={geometry.height - 16}
          rx="8"
          fill="none"
          stroke="#b9cdbd"
          strokeWidth="0.8"
          strokeDasharray="4 5"
        />
        <text x={geometry.minX + 18} y={geometry.maxY - 17} fill="#6b8172" style={{ fontSize: 6, letterSpacing: 1.4, fontWeight: 700 }}>
          CAMPUSFLOW · PUBLISHED CAMPUS DATA
        </text>

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
              role={onSelectBuilding ? 'button' : undefined}
              tabIndex={onSelectBuilding ? 0 : undefined}
              aria-label={`Explore ${building.name}`}
              onKeyDown={(event) => { if (onSelectBuilding && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelectBuilding(building.id); } }}
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
                  fill={isSelected ? '#b6baff' : statusColour}
                  stroke={isSelected ? '#3730bb' : '#819a86'}
                  strokeWidth={isSelected ? 1.7 : 1}
                  opacity={isHovered || isSelected ? 1 : 0.88}
                  filter={isSelected ? `url(#${mapId}-shadow)` : undefined}
                />
              ) : (
                <rect
                  x={center.x - 5}
                  y={center.y - 4}
                  width="10"
                  height="8"
                  rx="1.5"
                  fill={isSelected ? '#b6baff' : statusColour}
                  stroke={isSelected ? '#3730bb' : '#819a86'}
                  strokeWidth={isSelected ? 1.7 : 1}
                  filter={isSelected ? `url(#${mapId}-shadow)` : undefined}
                />
              )}
              {labelsVisible || isHovered || isSelected ? (
                <>
                  <circle cx={center.x} cy={center.y} r={isSelected ? 5.5 : 3.2} fill="#2d2a95" opacity="0.9" />
                  <text x={center.x} y={center.y - 8} textAnchor="middle" fill="#263b30" style={{ fontSize: 7.2, fontWeight: 750 }}>
                    {building.code}
                  </text>
                  {isHovered || isSelected ? (
                    <text x={center.x} y={center.y + 14} textAnchor="middle" fill="#506b59" style={{ fontSize: 6.1 }}>
                      {building.name}
                    </text>
                  ) : null}
                </>
              ) : null}
            </g>
          );
        })}

        {routePath ? (
          <>
            <path d={routePath} fill="none" stroke="#fff5d8" strokeWidth="6" strokeLinecap="round" opacity="0.9" />
            <path d={routePath} fill="none" stroke="#e3890c" strokeWidth="3" strokeLinecap="round" className="route-dash" markerEnd={`url(#${mapId}-arrow)`} />
          </>
        ) : null}

        {markersWithTones.map((marker, index) => {
          const point = toSvg(marker.lat, marker.lng);
          const tone = toneClasses[marker.tone ?? 'qr'];
          return (
            <g key={`${marker.label}-${index}`} role="img" aria-label={marker.label} filter={marker.tone === 'user' ? `url(#${mapId}-glow)` : undefined}>
              <title>{marker.label}</title>
              <circle cx={point.x} cy={point.y} r={4.5} fill={tone.fill} stroke="#fff" strokeWidth="1.2" />
              <circle cx={point.x} cy={point.y} r={8} fill="none" stroke={tone.ring} strokeWidth="1.4" opacity="0.7" />
            </g>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-3">
        <div className="pointer-events-auto rounded-[13px] border border-white/70 bg-white/92 px-3 py-2 shadow-[var(--shadow-card)] backdrop-blur-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-mint-700">Campus overview</p>
          <p className="mt-0.5 text-[12px] font-medium text-ink-800">{buildings.length} published buildings</p>
        </div>
        <div className="pointer-events-auto flex flex-col gap-1 rounded-[12px] border border-white/70 bg-white/92 p-1 shadow-[var(--shadow-card)] backdrop-blur-sm">
          <button
            type="button"
            aria-label={labelsVisible ? 'Hide map labels' : 'Show map labels'}
            aria-pressed={labelsVisible}
            onClick={() => setLabelsVisible((value) => !value)}
            className={cx('grid h-8 w-8 place-items-center rounded-[9px] text-[11px] font-bold transition-colors', labelsVisible ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:bg-ink-50')}
          >
            Aa
          </button>
          <button
            type="button"
            aria-label="Reset map view"
            onClick={() => setZoom(1)}
            className="grid h-8 w-8 place-items-center rounded-[9px] text-[15px] text-ink-600 hover:bg-ink-50"
          >
            ⌂
          </button>
          <span className="my-0.5 h-px bg-ink-100" />
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setZoom((value) => Math.min(2.5, Number((value + 0.2).toFixed(2))))}
            className="grid h-8 w-8 place-items-center rounded-[9px] text-[17px] text-ink-600 hover:bg-ink-50"
          >
            +
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setZoom((value) => Math.max(0.6, Number((value - 0.2).toFixed(2))))}
            className="grid h-8 w-8 place-items-center rounded-[9px] text-[17px] text-ink-600 hover:bg-ink-50"
          >
            −
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 flex items-end gap-2">
        <div className="pointer-events-auto rounded-[11px] border border-white/70 bg-white/92 px-3 py-2 text-[10px] text-ink-600 shadow-[var(--shadow-card)] backdrop-blur-sm">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-mint-500" /> Operational
            <span className="ml-1 h-2 w-2 rounded-full bg-signal-400" /> Limited
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-coral-400" /> Closed / maintenance
            <span className="ml-1 h-0.5 w-5 rounded bg-signal-500" /> Route
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-[11px] border border-white/70 bg-white/92 px-3 py-2 text-[10px] text-ink-600 shadow-[var(--shadow-card)] backdrop-blur-sm sm:flex">
          <span className="text-[15px] font-bold text-brand-700">N</span>
          <span className="h-5 w-px bg-ink-200" />
          <span className="block h-1.5 rounded-full bg-ink-700" style={{ width: `${scaleWidth}px` }} />
          <span>{scaleMetres} m</span>
        </div>
      </div>

      {selectedBuilding ? (
        <div className="absolute bottom-3 right-3 max-w-[min(290px,calc(100%-24px))] rounded-[14px] border border-brand-100 bg-white/96 p-3 shadow-[var(--shadow-pop)] backdrop-blur-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-700">Selected destination</p>
              <p className="mt-1 text-[14px] font-semibold text-ink-900">{selectedBuilding.code} · {selectedBuilding.name}</p>
            </div>
            <span className={cx(
              'rounded-full px-2 py-1 text-[10px] font-semibold',
              selectedBuilding.status === 'operational' ? 'bg-mint-50 text-mint-700' :
                selectedBuilding.status === 'limited' ? 'bg-signal-50 text-signal-700' :
                  'bg-coral-50 text-coral-600',
            )}>
              {selectedBuilding.status}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-500">
            {typeof selectedBuilding.floor_count === 'number' ? <span>{selectedBuilding.floor_count} floors</span> : null}
            {typeof selectedBuilding.room_count === 'number' ? <span>{selectedBuilding.room_count} rooms</span> : null}
            <span>{selectedBuilding.has_elevator ? 'Step-free access' : 'Stairs likely'}</span>
          </div>
          {onOpenBuilding ? (
            <button
              type="button"
              onClick={() => onOpenBuilding(selectedBuilding.id)}
              className="mt-3 min-h-9 rounded-[9px] bg-brand-600 px-3 text-[11px] font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Explore floors and rooms →
            </button>
          ) : null}
        </div>
      ) : null}

      {markersWithTones.length > 0 ? (
        <div className="absolute bottom-3 left-1/2 hidden -translate-x-1/2 items-center gap-3 rounded-[10px] border border-white/70 bg-white/92 px-3 py-1.5 text-[10px] text-ink-600 shadow-[var(--shadow-card)] backdrop-blur-sm md:flex">
          {markersWithTones.some((marker) => marker.tone === 'user') ? <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-brand-600" /> You</span> : null}
          {markersWithTones.some((marker) => marker.tone === 'destination') ? <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-coral-500" /> Destination</span> : null}
        </div>
      ) : null}
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
