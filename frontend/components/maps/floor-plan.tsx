'use client';

/**
 * Indoor floor plan.
 *
 * Rooms, corridor graph nodes and edges are drawn from the floor-plan payload the API
 * returns for `/floors/:id/plan`. The same component renders the interactive student view
 * (tap a room, follow a route) and the administrator's spatial editor.
 */
import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/ui/kit';
import type { FloorPlanPayload, NavigationNode, Room, Route } from '@/lib/api/types';

const ROOM_FILL: Record<Room['room_type'], string> = {
  lecture: '#dfe4ff',
  auditorium: '#dfe4ff',
  lab: '#e2f5f0',
  study: '#fff1d6',
  library: '#e8ecfb',
  office: '#fbe4e7',
  meeting: '#eae6fb',
  service: '#e6eaf3',
  other: '#eceef6',
};

const BUSY_FILL = '#f6c9ce';
const EMPTY_LIST: [] = [];

interface FloorPlanProps {
  plan: FloorPlanPayload;
  route?: Route | null;
  highlightRoomIds?: string[];
  selectedRoomId?: string | null;
  onSelectRoom?: (room: Room) => void;
  onSelectNode?: (node: NavigationNode) => void;
  showGraph?: boolean;
  showQr?: boolean;
  editable?: boolean;
  onMoveRoom?: (room: Room, position: { x: number; y: number }) => void;
  marker?: { x: number; y: number; label?: string } | null;
  className?: string;
  busyRoomIds?: string[];
}

export function FloorPlan({
  plan,
  route,
  highlightRoomIds = [],
  selectedRoomId,
  onSelectRoom,
  onSelectNode,
  showGraph = false,
  showQr = false,
  editable = false,
  onMoveRoom,
  marker,
  className,
  busyRoomIds = [],
}: FloorPlanProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ roomId: string; offsetX: number; offsetY: number } | null>(null);
  const planId = useId().replace(/:/g, '');

  const width = Number(plan.floor.plan_width) || 40;
  const height = Number(plan.floor.plan_height) || 30;
  const rooms = Array.isArray(plan.rooms) ? plan.rooms : EMPTY_LIST;
  const navigationNodes = Array.isArray(plan.navigation_nodes) ? plan.navigation_nodes : EMPTY_LIST;
  const navigationEdges = Array.isArray(plan.navigation_edges) ? plan.navigation_edges : EMPTY_LIST;
  const qrNodes = Array.isArray(plan.qr_nodes) ? plan.qr_nodes : EMPTY_LIST;

  const nodeById = useMemo(() => new Map(navigationNodes.map((node) => [node.id, node])), [navigationNodes]);

  const routePaths = useMemo(() => {
    if (!route) return [] as string[];
    return route.legs
      .filter((leg) => !leg.floor_id || leg.floor_id === plan.floor.id)
      .map((leg) => {
        const points = (leg.points ?? []).filter((point) => typeof point.x === 'number' && typeof point.y === 'number');
        if (points.length < 2) return '';
        return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
      })
      .filter(Boolean);
  }, [route, plan.floor.id]);

  const busy = useMemo(() => new Set(busyRoomIds.length ? busyRoomIds : Object.keys(plan.busy ?? {})), [busyRoomIds, plan.busy]);

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drag || !onMoveRoom) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * width - drag.offsetX;
    const y = ((event.clientY - bounds.top) / bounds.height) * height - drag.offsetY;
    const room = rooms.find((candidate) => candidate.id === drag.roomId);
    if (!room) return;
    onMoveRoom(room, {
      x: Math.max(0, Math.min(width - (Number(room.plan_w) || 0), Math.round(x * 10) / 10)),
      y: Math.max(0, Math.min(height - (Number(room.plan_h) || 0), Math.round(y * 10) / 10)),
    });
  };

  return (
    <div className={cx('relative overflow-hidden rounded-[var(--radius-card)] border border-ink-200 bg-[#edf2ed] shadow-[var(--shadow-card)]', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full max-h-[70vh] w-full touch-none"
        role="img"
        aria-label={`${plan.building.name} ${plan.floor.name} floor plan`}
        onPointerMove={handlePointerMove}
        onPointerUp={() => setDrag(null)}
        onPointerLeave={() => setDrag(null)}
      >
        <defs>
          <linearGradient id={`${planId}-surface`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fbfcf8" />
            <stop offset="1" stopColor="#edf3ec" />
          </linearGradient>
          <pattern id={`${planId}-grid`} width="2" height="2" patternUnits="userSpaceOnUse">
            <path d="M2 0H0V2" fill="none" stroke="#d7e2d6" strokeWidth="0.06" />
          </pattern>
          <filter id={`${planId}-shadow`} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0.35" stdDeviation="0.35" floodColor="#243a32" floodOpacity="0.18" />
          </filter>
        </defs>
        <rect x={0} y={0} width={width} height={height} fill={`url(#${planId}-surface)`} />
        <rect x={0} y={0} width={width} height={height} fill={`url(#${planId}-grid)`} opacity="0.8" />
        <rect x={0.7} y={0.7} width={width - 1.4} height={height - 1.4} rx="1.5" fill="none" stroke="#bfd1c0" strokeWidth="0.18" strokeDasharray="0.8 0.7" />
        <text x="1.7" y="2.5" fill="#6b8172" style={{ fontSize: 1.05, letterSpacing: 0.18, fontWeight: 700 }}>
          {plan.building.code} · {plan.floor.name.toUpperCase()}
        </text>

        {/* Never draw assumed corridors or room outlines absent from the published payload. */}
        {rooms.map((room) => {
          if (typeof room.plan_x !== 'number' || typeof room.plan_y !== 'number' || !Number.isFinite(room.plan_x) || !Number.isFinite(room.plan_y)) return null;
          const x = Number(room.plan_x);
          const y = Number(room.plan_y);
          const w = Number(room.plan_w);
          const h = Number(room.plan_h);
          const hasOutline = Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0;
          const isSelected = room.id === selectedRoomId;
          const isHighlighted = highlightRoomIds.includes(room.id);
          const isBusy = busy.has(room.id) || busy.has(room.code);
          const isHovered = hovered === room.id;
          const fill = isSelected ? '#9ea9ff' : isBusy ? BUSY_FILL : ROOM_FILL[room.room_type] ?? '#eceef6';

          return (
            <g
              key={room.id}
              onMouseEnter={() => setHovered(room.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelectRoom?.(room)}
              onPointerDown={(event) => {
                if (!editable || !onMoveRoom) return;
                const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                if (!bounds) return;
                const pointerX = ((event.clientX - bounds.left) / bounds.width) * width;
                const pointerY = ((event.clientY - bounds.top) / bounds.height) * height;
                setDrag({ roomId: room.id, offsetX: pointerX - x, offsetY: pointerY - y });
              }}
              className={cx(onSelectRoom && 'cursor-pointer', editable && onMoveRoom && 'cursor-move')}
            >
              {hasOutline ? <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx={0.8}
                fill={fill}
                stroke={isSelected ? '#4340e0' : isHighlighted ? '#f9a92c' : '#c6cde2'}
                strokeWidth={isSelected || isHighlighted ? 0.5 : 0.3}
                filter={isSelected ? `url(#${planId}-shadow)` : undefined}
              />
              : <><circle cx={x} cy={y} r={0.9} fill={fill} stroke="#637356" strokeWidth={0.25} /><text x={x + 1.4} y={y + 0.4} style={{ fontSize: 1.2, fontWeight: 600 }} className="fill-ink-800">{room.code}</text></>}
              {hasOutline && w >= 5 && h >= 4 ? (
                <>
                  <text x={x + w / 2} y={y + h / 2 - 0.6} textAnchor="middle" style={{ fontSize: Math.min(1.5, w / 5), fontWeight: 600 }} className="fill-ink-800">
                    {room.code}
                  </text>
                  <text x={x + w / 2} y={y + h / 2 + 1.6} textAnchor="middle" style={{ fontSize: Math.min(1.1, w / 7) }} className="fill-ink-500">
                    {room.name.length > 18 ? `${room.name.slice(0, 17)}…` : room.name}
                  </text>
                </>
              ) : null}
              {room.requires_admission ? <circle cx={hasOutline ? x + w - 1 : x} cy={y + 1} r={0.7} fill="#f9a92c" /> : null}

              {isHovered ? (
                <g>
                  <rect x={x} y={y - 3.4} width={Math.min(26, Math.max(14, room.name.length * 0.85))} height={2.8} rx={0.6} fill="#101527" opacity={0.92} />
                  <text x={x + 1} y={y - 1.4} style={{ fontSize: 1.2 }} className="fill-white">
                    {room.code} · {room.capacity} seats · {room.room_type}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}

        {showGraph
          ? navigationEdges.map((edge) => {
              const from = nodeById.get(edge.from_node_id);
              const to = nodeById.get(edge.to_node_id);
              if (!from || !to || from.plan_x === null || to.plan_x === null || from.plan_y === null || to.plan_y === null) return null;
              if (from.floor_id !== plan.floor.id && to.floor_id !== plan.floor.id) return null;
              const isVertical = edge.kind === 'stairs' || edge.kind === 'elevator' || edge.floor_change;
              return (
                <line
                  key={edge.id}
                  x1={from.plan_x}
                  y1={from.plan_y}
                  x2={to.plan_x}
                  y2={to.plan_y}
                  stroke={edge.is_accessible ? '#7a83fb' : '#b3bad3'}
                  strokeWidth={0.28}
                  strokeDasharray={isVertical ? '0.6 0.5' : undefined}
                  opacity={0.75}
                />
              );
            })
          : null}

        {showGraph
          ? navigationNodes
              .filter((node) => node.floor_id === plan.floor.id && node.plan_x !== null && node.plan_y !== null)
              .map((node) => (
                <g key={node.id} onClick={() => onSelectNode?.(node)} className={onSelectNode ? 'cursor-pointer' : undefined}>
                  <circle
                    cx={node.plan_x ?? 0}
                    cy={node.plan_y ?? 0}
                    r={node.kind === 'junction' || node.kind === 'entrance' ? 0.9 : 0.6}
                    fill={node.kind === 'elevator' ? '#129a84' : node.kind === 'stairs' ? '#b3bad3' : '#4340e0'}
                    opacity={node.is_active ? 0.9 : 0.35}
                  />
                </g>
              ))
          : null}

        {showQr
          ? qrNodes.map((node) => (
              <g key={node.id}>
                <rect
                  x={Number(node.plan_x) - 0.9}
                  y={Number(node.plan_y) - 0.9}
                  width={1.8}
                  height={1.8}
                  rx={0.3}
                  fill="#f9a92c"
                  stroke="#b96707"
                  strokeWidth={0.2}
                  opacity={node.is_active ? 1 : 0.4}
                />
              </g>
            ))
          : null}

        {routePaths.map((path, index) => (
          <g key={index}>
            <path d={path} fill="none" stroke="#fff5d8" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            <path d={path} fill="none" stroke="#e3890c" strokeWidth={0.9} strokeLinecap="round" strokeLinejoin="round" className="route-dash" />
          </g>
        ))}

        {marker ? (
          <g>
            <circle cx={marker.x} cy={marker.y} r={1.6} fill="#4340e0" opacity={0.2} />
            <circle cx={marker.x} cy={marker.y} r={0.8} fill="#4340e0" stroke="white" strokeWidth={0.25} />
            {marker.label ? (
              <text x={marker.x + 1.4} y={marker.y + 0.4} style={{ fontSize: 1.3, fontWeight: 600 }} className="fill-brand-700">
                {marker.label}
              </text>
            ) : null}
          </g>
        ) : null}
      </svg>

      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-3">
        <div className="pointer-events-auto rounded-[11px] border border-white/75 bg-white/92 px-3 py-2 shadow-[var(--shadow-card)] backdrop-blur-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-mint-700">{editable ? 'Spatial editor' : 'Indoor map'}</p>
          <p className="mt-0.5 text-[12px] font-semibold text-ink-800">{plan.building.code} · {plan.floor.name}</p>
          <p className="mt-0.5 text-[10px] text-ink-500">{rooms.length} rooms · {width} × {height} {plan.floor.plan_units}</p>
        </div>
        <div className="pointer-events-auto flex items-center gap-2 rounded-[11px] border border-white/75 bg-white/92 px-2.5 py-2 text-[10px] text-ink-500 shadow-[var(--shadow-card)] backdrop-blur-sm">
          <span className="text-[14px] font-bold text-brand-700">N</span>
          <span className="h-4 w-px bg-ink-200" />
          <span>{showGraph ? `${navigationNodes.length} nodes` : showQr ? `${qrNodes.length} anchors` : 'Published plan'}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-ink-100 bg-white/80 px-4 py-2 text-[11px] text-ink-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-ink-300" /> Room
        </span>
        {showGraph ? (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-brand-600" /> Navigation node
          </span>
        ) : null}
        {showQr ? (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-signal-400" /> QR anchor
          </span>
        ) : null}
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-signal-400 ring-2 ring-signal-200" /> Requires admission
        </span>
        {onMoveRoom ? <span className="ml-auto text-ink-400">Drag a room to reposition it in plan metres.</span> : null}
      </div>
    </div>
  );
}
