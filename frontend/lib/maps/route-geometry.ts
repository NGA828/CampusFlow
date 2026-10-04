import type { NavigationNode, Route, RouteEdge, RouteStep } from '../api/types';

export const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** One-time browser GPS fix for a route preview; web does not start a live navigation session. */
export interface RouteStartFix {
  lat: number;
  lng: number;
  accuracy_m: number | null;
}

export interface RoutePoint {
  x: number;
  y: number;
}

export interface RouteSegment {
  from: RoutePoint;
  to: RoutePoint;
  /** Includes endpoints, and any published intermediate edge geometry. */
  points: RoutePoint[];
  /** A shape is saved for this edge; this does not itself certify physical accuracy. */
  hasSavedGeometry: boolean;
}

function findEdge(route: Route, from: NavigationNode, to: NavigationNode): RouteEdge | undefined {
  return route.edges?.find(edge => edge.from_node_id === from.id && edge.to_node_id === to.id);
}

function intermediatePoints(edge: RouteEdge | undefined, space: 'plan' | 'geo'): RoutePoint[] | null {
  if (!edge) return [];
  if (edge.geometry_space && edge.geometry_space !== space) return null;
  const shape = edge.geometry ?? [];
  if (!shape.every(point => Array.isArray(point) && point.length === 2 && finite(point[0]) && finite(point[1]))) return null;
  return shape.map(([x, y]) => ({ x, y }));
}

/**
 * Route geometry uses each traversed edge's shape when supplied, falling back to a straight
 * segment between its endpoint nodes for legacy edges. A `null` result is a coordinate-space
 * boundary or a missing coordinate; it must never be bridged with an invented shortcut.
 */
export function routeSegments(route: Route, floorId: string | null): RouteSegment[] {
  return route.nodes.slice(1).flatMap((to, index) => {
    const from = route.nodes[index];
    const edge = findEdge(route, from, to);

    if (floorId !== null) {
      if (from.floor_id !== floorId || to.floor_id !== floorId ||
          !finite(from.plan_x) || !finite(from.plan_y) || !finite(to.plan_x) || !finite(to.plan_y)) return [];
      const intermediate = intermediatePoints(edge, 'plan');
      if (!intermediate) return [];
      const start = { x: from.plan_x, y: from.plan_y };
      const end = { x: to.plan_x, y: to.plan_y };
      return [{ from: start, to: end, points: [start, ...intermediate, end], hasSavedGeometry: Boolean(edge?.geometry_space && edge.geometry?.length) }];
    }

    // Explicitly outdoor edges can connect entrance nodes that carry floor metadata.
    // Indoor coordinates and building-centroid GPS must not be used as outdoor path geometry.
    if (edge?.geometry_space === 'plan' ||
        ((from.floor_id && to.floor_id) && edge?.kind !== 'outdoor' && edge?.geometry_space !== 'geo') ||
        !finite(from.lat) || !finite(from.lng) || !finite(to.lat) || !finite(to.lng)) return [];
    const intermediate = intermediatePoints(edge, 'geo');
    if (!intermediate) return [];
    const start = { x: from.lng, y: from.lat };
    const end = { x: to.lng, y: to.lat };
    return [{ from: start, to: end, points: [start, ...intermediate, end], hasSavedGeometry: Boolean(edge?.geometry_space && edge.geometry?.length) }];
  });
}

export function stepNode(route: Route, step: RouteStep, stepIndex: number): NavigationNode | null {
  if (step.node_id) return route.nodes.find(node => node.id === step.node_id) ?? null;
  if (step.kind === 'start') return route.nodes[0] ?? null;
  if (step.kind === 'arrive') return route.nodes.at(-1) ?? null;
  // Compatibility with the existing one-step-per-edge contract, not arbitrary
  // instruction arrays (which need explicit node IDs).
  if (route.steps.length === route.nodes.length + 1) return route.nodes[stepIndex] ?? null;
  return null;
}
