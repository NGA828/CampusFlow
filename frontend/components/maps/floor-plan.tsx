'use client';

/**
 * Indoor floor plan.
 *
 * Rooms, corridor graph nodes and edges are drawn from the floor-plan payload the API
 * returns for `/floors/:id/plan`. The same component renders the interactive student view
 * (tap a room, follow a route) and the administrator's spatial editor.
 */
import { useId, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cx } from '@/components/ui/kit';
import type { FloorPlanPayload, NavigationNode, Room, Route } from '@/lib/api/types';

// Rich fills per room type — evokes the Smart City palette
const ROOM_FILL: Record<Room['room_type'], { base: string; light: string; stroke: string }> = {
  lecture:    { base: '#6366f1', light: '#e0e7ff', stroke: '#4f46e5' },
  auditorium: { base: '#8b5cf6', light: '#ede9fe', stroke: '#7c3aed' },
  lab:        { base: '#10b981', light: '#d1fae5', stroke: '#059669' },
  study:      { base: '#f59e0b', light: '#fef3c7', stroke: '#d97706' },
  library:    { base: '#3b82f6', light: '#dbeafe', stroke: '#2563eb' },
  office:     { base: '#ec4899', light: '#fce7f3', stroke: '#db2777' },
  meeting:    { base: '#a855f7', light: '#f3e8ff', stroke: '#9333ea' },
  service:    { base: '#64748b', light: '#f1f5f9', stroke: '#475569' },
  other:      { base: '#94a3b8', light: '#f8fafc', stroke: '#64748b' },
};

const BUSY_COLOR = { base: '#ef4444', light: '#fee2e2', stroke: '#dc2626' };
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
  marker?: { x: number; y: number; label?: string; instruction?: string } | null;
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
    <div
      className={cx('relative overflow-hidden rounded-[var(--radius-card)] border border-slate-700/60 shadow-[var(--shadow-card)]', className)}
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f2027 100%)' }}
    >
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
          {/* Dark blueprint surface */}
          <linearGradient id={`${planId}-surface`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e3a5f" />
          </linearGradient>
          {/* Dot grid */}
          <pattern id={`${planId}-dots`} width="2" height="2" patternUnits="userSpaceOnUse">
            <circle cx="0.5" cy="0.5" r="0.12" fill="#334155" opacity="0.8" />
          </pattern>
          {/* Route glow gradient */}
          <linearGradient id={`${planId}-route-glow`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="40%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          {/* Room shine overlay */}
          <linearGradient id={`${planId}-room-shine`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.06" />
          </linearGradient>
          {/* Route glow filter */}
          <filter id={`${planId}-route-filter`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.45" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* Marker glow filter */}
          <filter id={`${planId}-marker-glow`} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="0.6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* Room drop shadow */}
          <filter id={`${planId}-shadow`} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0.4" stdDeviation="0.5" floodColor="#6366f1" floodOpacity="0.5" />
          </filter>
        </defs>
        {/* Blueprint background */}
        <rect x={0} y={0} width={width} height={height} fill={`url(#${planId}-surface)`} />
        <rect x={0} y={0} width={width} height={height} fill={`url(#${planId}-dots)`} opacity="1" />
        {/* Perimeter glow border */}
        <rect
          x={0.4} y={0.4}
          width={width - 0.8} height={height - 0.8}
          rx="1.8" fill="none"
          stroke="#1d4ed8" strokeWidth="0.22" strokeDasharray="1.5 1" opacity="0.4"
        />
        {/* Floor label */}
        <text x="1.5" y="2.2" fill="#94a3b8" style={{ fontSize: 0.9, letterSpacing: 0.2, fontWeight: 700 }}>
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
          const colors = isBusy ? BUSY_COLOR : (ROOM_FILL[room.room_type] ?? ROOM_FILL.other);

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
              {hasOutline ? (
                <>
                  {/* Room body */}
                  <rect
                    x={x} y={y} width={w} height={h} rx={0.7}
                    fill={colors.light}
                    fillOpacity={isSelected ? 0.95 : isHovered ? 0.88 : 0.75}
                    stroke={isSelected ? colors.base : isHighlighted ? '#f59e0b' : colors.stroke}
                    strokeWidth={isSelected || isHighlighted ? 0.42 : 0.22}
                    filter={isSelected ? `url(#${planId}-shadow)` : undefined}
                  />
                  {/* Shine overlay */}
                  <rect x={x} y={y} width={w} height={h * 0.5} rx={0.7} fill={`url(#${planId}-room-shine)`} />
                  {/* Left accent bar */}
                  <rect x={x} y={y + 0.5} width={0.3} height={Math.max(0, h - 1)} rx={0.15} fill={colors.base} opacity={0.85} />
                </>
              ) : (
                <>
                  <circle cx={x} cy={y} r={0.9} fill={colors.light} stroke={colors.base} strokeWidth={0.25} />
                  <text x={x + 1.4} y={y + 0.4} style={{ fontSize: 1.2, fontWeight: 600 }} fill={colors.base}>{room.code}</text>
                </>
              )}

              {/* Room labels */}
              {hasOutline && w >= 5 && h >= 4 ? (
                <>
                  <text x={x + w / 2} y={y + h / 2 - 0.6} textAnchor="middle" style={{ fontSize: Math.min(1.4, w / 5), fontWeight: 700 }} fill="#1e293b">
                    {room.code}
                  </text>
                  <text x={x + w / 2} y={y + h / 2 + 1.4} textAnchor="middle" style={{ fontSize: Math.min(1.0, w / 7) }} fill="#475569">
                    {room.name.length > 18 ? `${room.name.slice(0, 17)}…` : room.name}
                  </text>
                </>
              ) : null}

              {/* Admission badge */}
              {room.requires_admission ? (
                <circle cx={hasOutline ? x + w - 1 : x} cy={y + 1} r={0.65} fill="#f59e0b" stroke="#d97706" strokeWidth={0.15} />
              ) : null}

              {/* Hover tooltip with AnimatePresence */}
              <AnimatePresence>
                {isHovered ? (
                  <motion.g
                    initial={{ opacity: 0, y: 0.5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <rect
                      x={x} y={y - 4.2}
                      width={Math.min(28, Math.max(14, room.name.length * 0.85))}
                      height={3.2} rx={0.7}
                      fill="#0f172a" stroke="#334155" strokeWidth={0.15}
                      opacity={0.97}
                    />
                    <text x={x + 1.1} y={y - 2.4} style={{ fontSize: 1.15, fontWeight: 600 }} fill="#e2e8f0">
                      {room.code} · {room.capacity} seats · {room.room_type}
                    </text>
                  </motion.g>
                ) : null}
              </AnimatePresence>
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
                  stroke={edge.is_accessible ? '#38bdf8' : '#64748b'}
                  strokeWidth={0.25}
                  strokeDasharray={isVertical ? '0.6 0.5' : undefined}
                  opacity={0.7}
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
                    fill={node.kind === 'elevator' ? '#06b6d4' : node.kind === 'stairs' ? '#94a3b8' : '#6366f1'}
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
            {/* Outer glow halo */}
            <path
              d={path} fill="none"
              stroke={`url(#${planId}-route-glow)`}
              strokeWidth={3.5}
              strokeLinecap="round" strokeLinejoin="round"
              opacity={0.2}
              filter={`url(#${planId}-route-filter)`}
            />
            {/* Animated solid core */}
            <motion.path
              d={path} fill="none"
              stroke={`url(#${planId}-route-glow)`}
              strokeWidth={1.4}
              strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 2.0, ease: [0.25, 0.46, 0.45, 0.94] }}
            />
            {/* Dashed white overlay for dimension */}
            <motion.path
              d={path} fill="none"
              stroke="#ffffff"
              strokeWidth={0.35}
              strokeLinecap="round"
              strokeDasharray="0.8 2.0"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.4 }}
              transition={{ duration: 2.2, ease: 'easeOut', delay: 0.3 }}
            />
          </g>
        ))}

        {marker ? (
          <motion.g
            transform={`translate(${marker.x}, ${marker.y})`}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, type: 'spring', stiffness: 200 }}
          >
            {/* Ripple ring 1 */}
            <motion.circle
              r={3.2} fill="none" stroke="#6366f1" strokeWidth={0.35}
              animate={{ r: [3.0, 5.5], opacity: [0.7, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
            />
            {/* Ripple ring 2 */}
            <motion.circle
              r={2.5} fill="none" stroke="#06b6d4" strokeWidth={0.28}
              animate={{ r: [2.2, 4.2], opacity: [0.6, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut', delay: 0.55 }}
            />
            {/* Solid dot */}
            <circle r={1.35} fill="#6366f1" filter={`url(#${planId}-marker-glow)`} />
            <circle r={0.65} fill="#ffffff" />
            {/* Instruction tooltip */}
            {(marker.instruction || marker.label) ? (
              <g transform="translate(-12, -6.5)">
                <rect
                  width={Math.max(24, ((marker.instruction || marker.label) ?? '').length * 0.72 + 4)}
                  height={3.4} rx={0.9}
                  fill="#0f172a" stroke="#6366f1" strokeWidth={0.18}
                  opacity={0.97}
                />
                <text x={1.6} y={2.3} style={{ fontSize: 1.05, fontWeight: 600 }} fill="#e2e8f0">
                  {marker.instruction || marker.label}
                </text>
              </g>
            ) : null}
          </motion.g>
        ) : null}
      </svg>

      {/* Dark HUD overlays */}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-3">
        <div className="pointer-events-auto rounded-[11px] border border-white/10 bg-slate-900/85 px-3 py-2 shadow-lg backdrop-blur-md">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-400">{editable ? 'Spatial editor' : 'Indoor map'}</p>
          <p className="mt-0.5 text-[12px] font-semibold text-white">{plan.building.code} · {plan.floor.name}</p>
          <p className="mt-0.5 text-[10px] text-slate-400">{rooms.length} rooms · {width} × {height} {plan.floor.plan_units}</p>
        </div>
        <div className="pointer-events-auto flex items-center gap-2 rounded-[11px] border border-white/10 bg-slate-900/85 px-2.5 py-2 text-[10px] text-slate-300 shadow-lg backdrop-blur-md">
          <span className="text-[14px] font-bold text-indigo-400">N</span>
          <span className="h-4 w-px bg-slate-700" />
          <span>{showGraph ? `${navigationNodes.length} nodes` : showQr ? `${qrNodes.length} anchors` : 'Published plan'}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/8 bg-slate-900/70 px-4 py-2 text-[11px] text-slate-400 backdrop-blur-sm">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-indigo-500/60 ring-1 ring-indigo-500" /> Room
        </span>
        {showGraph ? (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" /> Navigation node
          </span>
        ) : null}
        {showQr ? (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> QR anchor
          </span>
        ) : null}
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-amber-200/50" /> Requires admission
        </span>
        {routePaths.length > 0 ? (
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-5 rounded-full" style={{ background: 'linear-gradient(90deg,#6366f1,#06b6d4,#10b981)' }} /> Route
          </span>
        ) : null}
        {onMoveRoom ? <span className="ml-auto text-slate-500">Drag a room to reposition it in plan metres.</span> : null}
      </div>
    </div>
  );
}
