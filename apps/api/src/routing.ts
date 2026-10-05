import { NAV_EDGES, NAV_NODES, floorName, nodeById } from './data/campus.ts';
import type { NavEdge, NavNode } from './types.ts';

/**
 * Indoor routing over the campus walking graph.
 *
 * Dijkstra, not A*: the graph is small, and a plain shortest-path keeps the cost
 * model honest and easy to audit. Cost is distance in plan metres plus a fixed
 * penalty for changing level, so a route does not bounce between floors to save a
 * metre of corridor. `stepFree` removes stairs entirely rather than discouraging
 * them — a student who needs step-free access is not helped by "mostly step-free".
 */

const LEVEL_CHANGE_PENALTY_METRES = 12;

export interface RouteStep {
  nodeId: string;
  label: string;
  floorName: string;
  buildingId: string;
  coordinates: [number, number];
  /** Human instruction for arriving at this node from the previous one. */
  instruction: string;
  distanceMetres: number;
  edgeKind: NavEdge['kind'] | null;
}

export interface RouteResult {
  from: string;
  to: string;
  stepFree: boolean;
  totalDistanceMetres: number;
  estimatedMinutes: number;
  steps: RouteStep[];
}

function distance(a: NavNode, b: NavNode): number {
  const base = Math.hypot(a.x - b.x, a.y - b.y);
  return a.floorId === b.floorId ? base : base + LEVEL_CHANGE_PENALTY_METRES;
}

function neighbours(stepFree: boolean): Map<string, { to: string; edge: NavEdge }[]> {
  const map = new Map<string, { to: string; edge: NavEdge }[]>();
  for (const node of NAV_NODES) map.set(node.id, []);
  for (const edge of NAV_EDGES) {
    if (stepFree && !edge.accessible) continue;
    map.get(edge.from)?.push({ to: edge.to, edge });
    map.get(edge.to)?.push({ to: edge.from, edge });
  }
  return map;
}

function instructionFor(edge: NavEdge | null, node: NavNode, previous: NavNode | null): string {
  if (!edge || !previous) return `Départ : ${node.label}`;
  switch (edge.kind) {
    case 'STAIRS':
      return `Prenez l’escalier jusqu’au ${floorName(node.buildingId, node.floorId)}`;
    case 'LIFT':
      return `Prenez l’ascenseur jusqu’au ${floorName(node.buildingId, node.floorId)}`;
    case 'DOOR':
      return `Entrez : ${node.label}`;
    default:
      return `Continuez vers ${node.label}`;
  }
}

export function findRoute(fromNodeId: string, toNodeId: string, stepFree = false): RouteResult | null {
  const start = nodeById(fromNodeId);
  const goal = nodeById(toNodeId);
  if (!start || !goal) return null;

  const graph = neighbours(stepFree);
  const best = new Map<string, number>([[start.id, 0]]);
  const cameFrom = new Map<string, { node: string; edge: NavEdge }>();
  const visited = new Set<string>();

  while (visited.size < NAV_NODES.length) {
    let current: string | null = null;
    let currentCost = Number.POSITIVE_INFINITY;
    for (const [id, cost] of best) {
      if (!visited.has(id) && cost < currentCost) {
        current = id;
        currentCost = cost;
      }
    }
    if (current === null) break;
    if (current === goal.id) break;
    visited.add(current);

    const here = nodeById(current)!;
    for (const link of graph.get(current) ?? []) {
      if (visited.has(link.to)) continue;
      const next = nodeById(link.to)!;
      const cost = currentCost + distance(here, next);
      if (cost < (best.get(link.to) ?? Number.POSITIVE_INFINITY)) {
        best.set(link.to, cost);
        cameFrom.set(link.to, { node: current, edge: link.edge });
      }
    }
  }

  if (!best.has(goal.id)) return null;

  const path: { node: NavNode; edge: NavEdge | null }[] = [];
  let cursor: string | undefined = goal.id;
  while (cursor) {
    const previous: { node: string; edge: NavEdge } | undefined = cameFrom.get(cursor);
    path.unshift({ node: nodeById(cursor)!, edge: previous?.edge ?? null });
    cursor = previous?.node;
  }

  let total = 0;
  const steps: RouteStep[] = path.map((entry, index) => {
    const previous = index === 0 ? null : path[index - 1]!.node;
    const legLength = previous ? Math.hypot(previous.x - entry.node.x, previous.y - entry.node.y) : 0;
    total += legLength;
    return {
      nodeId: entry.node.id,
      label: entry.node.label,
      floorName: floorName(entry.node.buildingId, entry.node.floorId),
      buildingId: entry.node.buildingId,
      coordinates: entry.node.coordinates,
      instruction: instructionFor(entry.edge, entry.node, previous),
      distanceMetres: Math.round(legLength),
      edgeKind: entry.edge?.kind ?? null,
    };
  });

  return {
    from: start.id,
    to: goal.id,
    stepFree,
    totalDistanceMetres: Math.round(total),
    // 1.25 m/s is an unhurried indoor walking pace, rounded up to whole minutes.
    estimatedMinutes: Math.max(1, Math.ceil(total / 1.25 / 60)),
    steps,
  };
}
