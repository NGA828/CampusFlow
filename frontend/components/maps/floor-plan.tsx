'use client';

/**
 * Indoor floor plan.
 *
 * Rooms, corridor graph nodes and edges are drawn from the floor-plan payload the API
 * returns for `/floors/:id/plan`. The same component renders the interactive student view
 * (tap a room, follow a route) and the administrator's spatial editor.
 */
import { useMemo, useState } from 'react';
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
    <div className={cx('overflow-hidden rounded-[var(--radius-card)] border border-ink-100 bg-white', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full max-h-[70vh] w-full touch-none"
        role="img"
        aria-label={`${plan.building.name} ${plan.floor.name} floor plan`}
        onPointerMove={handlePointerMove}
        onPointerUp={() => setDrag(null)}
        onPointerLeave={() => setDrag(null)}
      >
        <rect x={0} y={0} width={width} height={height} fill="#fbfbfe" />

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
          <path key={index} d={path} fill="none" stroke="#f9a92c" strokeWidth={0.9} strokeLinecap="round" strokeLinejoin="round" className="route-dash" />
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

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-ink-100 px-4 py-2 text-[11px] text-ink-500">
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
