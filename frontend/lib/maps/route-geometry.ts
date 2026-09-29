import type { NavigationNode, Route, RouteStep } from '../api/types';

export const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Only adjacent server-returned nodes are connected. Missing coordinates break a path. */
export function routeSegments(route: Route, floorId: string | null) {
  return route.nodes.slice(1).flatMap((to, i) => {
    const from = route.nodes[i];
    if (floorId !== null) {
      if (from.floor_id !== floorId || to.floor_id !== floorId ||
          !finite(from.plan_x) || !finite(from.plan_y) || !finite(to.plan_x) || !finite(to.plan_y)) return [];
      return [{ from: { x: from.plan_x, y: from.plan_y }, to: { x: to.plan_x, y: to.plan_y } }];
    }
    // Indoor coordinates are local to a floor. Geographic positions inside buildings
    // are often building centroids, not corridor geometry.
    if ((from.floor_id && to.floor_id) || !finite(from.lat) || !finite(from.lng) || !finite(to.lat) || !finite(to.lng)) return [];
    return [{ from: { x: from.lng, y: from.lat }, to: { x: to.lng, y: to.lat } }];
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
