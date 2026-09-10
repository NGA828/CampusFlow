import type { Db } from '../db/client.js';
import { ApiError } from '../lib/errors.js';
import {
  bearingDegrees,
  compassLabel,
  densify,
  distanceMeters,
  planDistance,
  progressAlongPolyline,
  type LatLng,
  type PlanPoint,
} from '../lib/geo.js';

/**
 * Navigation engine (PROMPT §15, §16, §79).
 *
 * Routing runs on the administrator-maintained navigation graph stored in PostgreSQL:
 * every edge carries its own length, floor-change semantics and accessibility flag, so
 * the same engine supports accessible-route preferences and future routing costs without
 * a code change. Path-finding is A* with a Euclidean heuristic; the heuristic is disabled
 * automatically when the two ends live in different coordinate spaces (floor plan vs
 * geography), where it degrades to Dijkstra.
 *
 * The engine never auto-abandons a walk: deviation produces a warning, then a grace
 * period, then recalculation (PROMPT §16).
 */

export type EdgeKind = 'corridor' | 'stairs' | 'elevator' | 'ramp' | 'door' | 'outdoor' | 'service';

export interface GraphNode {
  id: string;
  code: string;
  label: string;
  kind: string;
  building_id: string | null;
  floor_id: string | null;
  floor_level: number | null;
  floor_name: string | null;
  building_code: string | null;
  plan_x: number | null;
  plan_y: number | null;
  lat: number | null;
  lng: number | null;
  is_accessible: boolean;
}

export interface GraphEdge {
  id: string;
  from_node_id: string;
  to_node_id: string;
  kind: EdgeKind;
  distance_m: number;
  bidirectional: boolean;
  is_accessible: boolean;
  floor_change: boolean;
}

export interface NavigationGraph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  adjacency: Map<string, { edge: GraphEdge; to: string }[]>;
}

export interface RouteStep {
  index: number;
  instruction: string;
  kind: 'walk' | 'stairs' | 'elevator' | 'door' | 'arrive' | 'exit' | 'enter';
  distance_m: number;
  node_id: string | null;
  floor_id: string | null;
  floor_name: string | null;
  building_id: string | null;
}

export interface RouteLeg {
  floor_id: string | null;
  floor_name: string | null;
  floor_level: number | null;
  building_id: string | null;
  building_code: string | null;
  /** Plan-space polyline (metres) when the leg is indoor. */
  plan_geometry: [number, number][];
  /** Geographic polyline (lat, lng) for the same leg, always populated. */
  geo_geometry: [number, number][];
  distance_m: number;
}

export interface RouteTransition {
  from_floor_id: string | null;
  to_floor_id: string | null;
  kind: EdgeKind;
  node_id: string;
  label: string;
}

export interface Route {
  nodes: GraphNode[];
  legs: RouteLeg[];
  transitions: RouteTransition[];
  steps: RouteStep[];
  distance_m: number;
  duration_seconds: number;
  floors: { floor_id: string; floor_name: string; level: number; building_id: string; building_code: string }[];
  requires_accessible: boolean;
  accessible: boolean;
  origin: GraphNode;
  destination: GraphNode;
}

export interface RouteEvaluation {
  off_route: boolean;
  distance_from_route_m: number;
  tolerance_m: number;
  progress: number;
  remaining_m: number;
  current_step_index: number;
  current_step: RouteStep | null;
  arrived: boolean;
  floor_id: string | null;
}

const WALKING_SPEED_MPS = 1.35;
const SPEED_BY_EDGE: Record<string, number> = {
  stairs: 0.6,
  elevator: 0.9,
  ramp: 0.9,
  corridor: 1.35,
  outdoor: 1.35,
  door: 0.9,
  service: 1.1,
};

export const OFF_ROUTE_TOLERANCE_INDOOR_M = 12;
export const OFF_ROUTE_TOLERANCE_OUTDOOR_M = 30;
export const OFF_ROUTE_GRACE_SECONDS = 20;

/* ------------------------------------------------------------------- graph load */

export async function loadGraph(db: Db, options: { buildingId?: string } = {}): Promise<NavigationGraph> {
  const nodeRows = await db.query<GraphNode>(
    `SELECT n.id, n.code, n.label, n.kind, n.building_id, n.floor_id,
            f.level AS floor_level, f.name AS floor_name, b.code AS building_code,
            n.plan_x, n.plan_y, n.lat, n.lng, n.is_accessible
       FROM navigation_nodes n
       LEFT JOIN floors f ON f.id = n.floor_id
       LEFT JOIN buildings b ON b.id = n.building_id
      WHERE n.is_active ${options.buildingId ? 'AND n.building_id = $1' : ''}`,
    options.buildingId ? [options.buildingId] : [],
  );

  const edgeRows = await db.query<GraphEdge>(
    `SELECT id, from_node_id, to_node_id, kind, distance_m, bidirectional, is_accessible, floor_change
       FROM navigation_edges WHERE is_active`,
  );

  const nodes = new Map(nodeRows.map((node) => [node.id, node]));
  const adjacency = new Map<string, { edge: GraphEdge; to: string }[]>();
  const edges: GraphEdge[] = [];

  for (const edge of edgeRows) {
    if (!nodes.has(edge.from_node_id) || !nodes.has(edge.to_node_id)) continue;
    edges.push(edge);
    adjacency.set(edge.from_node_id, [...(adjacency.get(edge.from_node_id) ?? []), { edge, to: edge.to_node_id }]);
    if (edge.bidirectional) {
      adjacency.set(edge.to_node_id, [...(adjacency.get(edge.to_node_id) ?? []), { edge, to: edge.from_node_id }]);
    }
  }

  return { nodes, edges, adjacency };
}

/* ------------------------------------------------------------------- heuristic */

function heuristic(a: GraphNode, b: GraphNode): number {
  const samePlanSpace =
    (a.plan_x !== null && a.plan_y !== null && b.plan_x !== null && b.plan_y !== null) ||
    (a.lat !== null && a.lng !== null && b.lat !== null && b.lng !== null);
  if (!samePlanSpace) return 0;

  if (a.lat !== null && a.lng !== null && b.lat !== null && b.lng !== null && (a.plan_x === null || b.plan_x === null)) {
    return distanceMeters({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
  }
  if (a.plan_x !== null && a.plan_y !== null && b.plan_x !== null && b.plan_y !== null && a.floor_id === b.floor_id) {
    return planDistance({ x: a.plan_x, y: a.plan_y }, { x: b.plan_x, y: b.plan_y });
  }
  return 0;
}

export interface PathResult {
  nodeIds: string[];
  edges: GraphEdge[];
  distance_m: number;
}

/** A* search. `accessibleOnly` excludes stairs and any edge flagged inaccessible. */
export function findPath(
  graph: NavigationGraph,
  fromNodeId: string,
  toNodeId: string,
  options: { accessibleOnly?: boolean; maxVisited?: number } = {},
): PathResult | null {
  const start = graph.nodes.get(fromNodeId);
  const goal = graph.nodes.get(toNodeId);
  if (!start || !goal) return null;
  if (fromNodeId === toNodeId) return { nodeIds: [fromNodeId], edges: [], distance_m: 0 };

  const allowed = (edge: GraphEdge) =>
    (!options.accessibleOnly || (edge.is_accessible && edge.kind !== 'stairs')) && edge.distance_m >= 0;

  const gScore = new Map<string, number>([[fromNodeId, 0]]);
  const cameFrom = new Map<string, { node: string; edge: GraphEdge }>();
  const open = new Set<string>([fromNodeId]);
  const fScore = new Map<string, number>([[fromNodeId, heuristic(start, goal)]]);
  const visited = new Set<string>();
  const maxVisited = options.maxVisited ?? 5000;

  while (open.size > 0) {
    let current: string | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const nodeId of open) {
      const score = fScore.get(nodeId) ?? Number.POSITIVE_INFINITY;
      if (score < best) {
        best = score;
        current = nodeId;
      }
    }
    if (current === null) break;
    if (current === toNodeId) {
      const nodeIds = [current];
      const edges: GraphEdge[] = [];
      let cursor = current;
      while (cameFrom.has(cursor)) {
        const step = cameFrom.get(cursor)!;
        edges.unshift(step.edge);
        nodeIds.unshift(step.node);
        cursor = step.node;
      }
      return { nodeIds, edges, distance_m: gScore.get(toNodeId) ?? 0 };
    }

    open.delete(current);
    visited.add(current);
    if (visited.size > maxVisited) break;

    for (const { edge, to } of graph.adjacency.get(current) ?? []) {
      if (!allowed(edge) || visited.has(to)) continue;
      const tentative = (gScore.get(current) ?? Number.POSITIVE_INFINITY) + edge.distance_m;
      if (tentative < (gScore.get(to) ?? Number.POSITIVE_INFINITY)) {
        cameFrom.set(to, { node: current, edge });
        gScore.set(to, tentative);
        const target = graph.nodes.get(to)!;
        fScore.set(to, tentative + heuristic(target, goal));
        open.add(to);
      }
    }
  }

  return null;
}

/* -------------------------------------------------------- node resolution from rooms */

export interface NodeWithRoom extends GraphNode {
  room_id?: string | null;
}

/** Find the graph node that represents a room (direct link, or the nearest same-floor node). */
export async function resolveNodeForRoom(db: Db, roomId: string): Promise<GraphNode> {
  const direct = await db.one<GraphNode>(
    `SELECT n.id, n.code, n.label, n.kind, n.building_id, n.floor_id, f.level AS floor_level,
            f.name AS floor_name, b.code AS building_code, n.plan_x, n.plan_y, n.lat, n.lng, n.is_accessible
       FROM navigation_nodes n
       LEFT JOIN floors f ON f.id = n.floor_id
       LEFT JOIN buildings b ON b.id = n.building_id
       JOIN rooms r ON r.floor_id = n.floor_id
      WHERE r.id = $1 AND n.is_active AND n.floor_id = r.floor_id
        AND (upper(n.code) = upper(r.code) OR n.label ILIKE '%' || r.code || '%')
      ORDER BY (upper(n.code) = upper(r.code)) DESC, (n.label ILIKE '%' || r.code || '%') DESC
      LIMIT 1`,
    [roomId],
  );
  if (direct) return direct;

  const room = await db.one<{ floor_id: string; building_id: string; lat: number | null; lng: number | null; plan_x: number; plan_y: number; code: string }>(
    'SELECT floor_id, building_id, lat, lng, plan_x, plan_y, code FROM rooms WHERE id = $1',
    [roomId],
  );
  if (!room) throw ApiError.notFound('Room not found.');

  const candidates = await db.query<GraphNode>(
    `SELECT n.id, n.code, n.label, n.kind, n.building_id, n.floor_id, f.level AS floor_level,
            f.name AS floor_name, b.code AS building_code, n.plan_x, n.plan_y, n.lat, n.lng, n.is_accessible
       FROM navigation_nodes n
       LEFT JOIN floors f ON f.id = n.floor_id
       LEFT JOIN buildings b ON b.id = n.building_id
      WHERE n.is_active AND (n.floor_id = $1 OR n.building_id = $2)`,
    [room.floor_id, room.building_id],
  );
  if (candidates.length === 0) throw ApiError.unavailable('No navigation node is configured near this room.');

  const usePlan = candidates.some((node) => node.plan_x !== null && node.plan_y !== null);
  let best: GraphNode | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const node of candidates) {
    const distance =
      usePlan && node.plan_x !== null && node.plan_y !== null
        ? planDistance({ x: node.plan_x, y: node.plan_y }, { x: room.plan_x, y: room.plan_y }) +
          (node.floor_id === room.floor_id ? 0 : 40)
        : node.lat !== null && node.lng !== null && room.lat !== null && room.lng !== null
          ? distanceMeters({ lat: node.lat, lng: node.lng }, { lat: room.lat, lng: room.lng })
          : Number.POSITIVE_INFINITY;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = node;
    }
  }
  if (!best) throw ApiError.unavailable('No reachable navigation node is configured for this room.');
  return best;
}

export interface PositionFix {
  lat?: number | null;
  lng?: number | null;
  plan_x?: number | null;
  plan_y?: number | null;
  floor_id?: string | null;
  building_id?: string | null;
  nav_node_id?: string | null;
}

/**
 * Resolve a position fix to the closest graph node. QR scans carry an explicit node, GPS
 * fixes resolve geographically, and indoor fixes resolve in floor-plan space.
 */
export async function resolveNearestNode(db: Db, fix: PositionFix): Promise<GraphNode> {
  if (fix.nav_node_id) {
    const node = await db.one<GraphNode>(
      `SELECT n.id, n.code, n.label, n.kind, n.building_id, n.floor_id, f.level AS floor_level,
              f.name AS floor_name, b.code AS building_code, n.plan_x, n.plan_y, n.lat, n.lng, n.is_accessible
         FROM navigation_nodes n
         LEFT JOIN floors f ON f.id = n.floor_id
         LEFT JOIN buildings b ON b.id = n.building_id
        WHERE n.id = $1 AND n.is_active`,
      [fix.nav_node_id],
    );
    if (node) return node;
  }

  const candidates = await db.query<GraphNode>(
    `SELECT n.id, n.code, n.label, n.kind, n.building_id, n.floor_id, f.level AS floor_level,
            f.name AS floor_name, b.code AS building_code, n.plan_x, n.plan_y, n.lat, n.lng, n.is_accessible
       FROM navigation_nodes n
       LEFT JOIN floors f ON f.id = n.floor_id
       LEFT JOIN buildings b ON b.id = n.building_id
      WHERE n.is_active
        ${fix.floor_id ? 'AND (n.floor_id = $1 OR n.floor_id IS NULL)' : ''}
        ${!fix.floor_id && fix.lat != null ? 'AND n.lat IS NOT NULL' : ''}`,
    fix.floor_id ? [fix.floor_id] : [],
  );
  if (candidates.length === 0) throw ApiError.unavailable('No navigation nodes are configured for this area.');

  let best: GraphNode | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  const usePlan = fix.plan_x != null && fix.plan_y != null && fix.floor_id != null;

  for (const node of candidates) {
    let distance = Number.POSITIVE_INFINITY;
    if (usePlan && node.plan_x !== null && node.plan_y !== null) {
      distance = planDistance({ x: node.plan_x, y: node.plan_y }, { x: fix.plan_x!, y: fix.plan_y! });
    } else if (!usePlan && fix.lat != null && fix.lng != null && node.lat !== null && node.lng !== null) {
      distance = distanceMeters({ lat: node.lat, lng: node.lng }, { lat: fix.lat, lng: fix.lng });
    }
    if (distance < bestDistance) {
      bestDistance = distance;
      best = node;
    }
  }
  if (!best) throw ApiError.unavailable('No navigation node could be matched to your position.');
  return best;
}

/* ------------------------------------------------------------ indoor ↔ geographic */

export interface GeoReference {
  lat: number;
  lng: number;
}

/**
 * Floor-plan convention: coordinates are metres from the building's north-west origin,
 * +x points east and +y points south. This makes plan geometry convertible to WGS84 with
 * a local tangent-plane approximation, so indoor routes can be drawn on the campus map
 * and outdoor routes can be continued indoors.
 */
export function planToLatLng(ref: GeoReference, point: PlanPoint): LatLng {
  const lat = ref.lat - point.y / 111_320;
  const lng = ref.lng + point.x / (111_320 * Math.cos((ref.lat * Math.PI) / 180));
  return { lat, lng };
}

export function latLngToPlan(ref: GeoReference, point: LatLng): PlanPoint {
  const x = (point.lng - ref.lng) * 111_320 * Math.cos((ref.lat * Math.PI) / 180);
  const y = (ref.lat - point.lat) * 111_320;
  return { x, y };
}

async function floorReference(db: Db, floorId: string | null): Promise<GeoReference | null> {
  if (!floorId) return null;
  const row = await db.one<{ lat: number; lng: number }>(
    'SELECT b.lat, b.lng FROM floors f JOIN buildings b ON b.id = f.building_id WHERE f.id = $1',
    [floorId],
  );
  return row ? { lat: Number(row.lat), lng: Number(row.lng) } : null;
}

/* ------------------------------------------------------------------- route building */

function nodePoint(node: GraphNode): LatLng | null {
  if (node.lat === null || node.lng === null) return null;
  return { lat: Number(node.lat), lng: Number(node.lng) };
}

export interface BuildRouteOptions {
  accessibleOnly?: boolean;
  destinationLabel?: string;
}

export async function buildRoute(
  db: Db,
  path: PathResult,
  graph: NavigationGraph,
  options: BuildRouteOptions = {},
): Promise<Route> {
  const nodes = path.nodeIds.map((id) => graph.nodes.get(id)!).filter(Boolean);
  if (nodes.length === 0) throw ApiError.unavailable('Route could not be built.');

  const references = new Map<string, GeoReference>();
  for (const node of nodes) {
    if (!node.floor_id || references.has(node.floor_id)) continue;
    const ref = await floorReference(db, node.floor_id);
    if (ref) references.set(node.floor_id, ref);
  }

  // Geographic point for every node: stored coordinates win; indoor plan coordinates are
  // projected through the building reference so mixed indoor/outdoor routes stay continuous.
  const geoPoints: LatLng[] = nodes.map((node) => {
    const direct = nodePoint(node);
    if (direct) return direct;
    const ref = node.floor_id ? references.get(node.floor_id) : null;
    if (ref && node.plan_x !== null && node.plan_y !== null) {
      return planToLatLng(ref, { x: Number(node.plan_x), y: Number(node.plan_y) });
    }
    const previous = geoPoints[geoPoints.length - 1];
    return previous ?? { lat: 0, lng: 0 };
  });

  const legs: RouteLeg[] = [];
  const transitions: RouteTransition[] = [];
  const steps: RouteStep[] = [];
  let totalDistance = 0;
  let totalDuration = 0;
  let stepIndex = 0;

  let currentLeg: RouteLeg | null = null;
  const flushLeg = () => {
    if (currentLeg && (currentLeg.plan_geometry.length > 0 || currentLeg.geo_geometry.length > 0)) {
      legs.push(currentLeg);
    }
    currentLeg = null;
  };

  const legKey = (node: GraphNode) => `${node.floor_id ?? 'outdoor'}`;

  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]!;
    const previousNode = i > 0 ? nodes[i - 1] : null;
    const edge = i > 0 ? path.edges[i - 1] : null;

    if (!currentLeg || (previousNode && legKey(previousNode) !== legKey(node))) {
      flushLeg();
      currentLeg = {
        floor_id: node.floor_id,
        floor_name: node.floor_name,
        floor_level: node.floor_level === null ? null : Number(node.floor_level),
        building_id: node.building_id,
        building_code: node.building_code,
        plan_geometry: [],
        geo_geometry: [],
        distance_m: 0,
      };
    }

    const leg = currentLeg as RouteLeg;
    const geo = geoPoints[i]!;
    if (leg.geo_geometry.length === 0 || i === 0 || legKey(previousNode ?? node) !== legKey(node)) {
      leg.geo_geometry.push([geo.lat, geo.lng]);
    } else {
      leg.geo_geometry.push([geo.lat, geo.lng]);
    }
    if (node.plan_x !== null && node.plan_y !== null) {
      leg.plan_geometry.push([Number(node.plan_x), Number(node.plan_y)]);
    }

    if (edge) {
      leg.distance_m += edge.distance_m;
      totalDistance += edge.distance_m;
      totalDuration += edge.distance_m / (SPEED_BY_EDGE[edge.kind] ?? WALKING_SPEED_MPS);

      if (edge.floor_change && previousNode) {
        transitions.push({
          from_floor_id: previousNode.floor_id,
          to_floor_id: node.floor_id,
          kind: edge.kind,
          node_id: node.id,
          label: node.label,
        });
        stepIndex += 1;
        steps.push({
          index: stepIndex,
          instruction:
            edge.kind === 'elevator'
              ? `Take the lift to ${node.floor_name ?? 'the next level'}`
              : edge.kind === 'ramp'
                ? `Follow the ramp to ${node.floor_name ?? 'the next level'}`
                : `Take the stairs to ${node.floor_name ?? 'the next level'}`,
          kind: edge.kind === 'elevator' ? 'elevator' : 'stairs',
          distance_m: edge.distance_m,
          node_id: node.id,
          floor_id: node.floor_id,
          floor_name: node.floor_name,
          building_id: node.building_id,
        });
        continue;
      }

      const previousPoint = geoPoints[i - 1];
      const heading = previousPoint && geo ? bearingDegrees(previousPoint, geo) : 0;
      const direction = compassLabel(heading);
      if (node.kind === 'entrance') {
        stepIndex += 1;
        steps.push({
          index: stepIndex,
          instruction: `Enter ${node.label}`,
          kind: 'enter',
          distance_m: edge.distance_m,
          node_id: node.id,
          floor_id: node.floor_id,
          floor_name: node.floor_name,
          building_id: node.building_id,
        });
      } else if (edge.distance_m >= 6) {
        stepIndex += 1;
        steps.push({
          index: stepIndex,
          instruction: `Head ${direction} for ${Math.round(edge.distance_m)} m${
            node.floor_name && edge.kind === 'corridor' ? ` along ${node.label}` : ''
          }`,
          kind: edge.kind === 'door' ? 'door' : 'walk',
          distance_m: edge.distance_m,
          node_id: node.id,
          floor_id: node.floor_id,
          floor_name: node.floor_name,
          building_id: node.building_id,
        });
      }
    }
  }

  flushLeg();

  const destination = nodes[nodes.length - 1]!;
  stepIndex += 1;
  steps.push({
    index: stepIndex,
    instruction: `Arrive at ${options.destinationLabel ?? destination.label}`,
    kind: 'arrive',
    distance_m: 0,
    node_id: destination.id,
    floor_id: destination.floor_id,
    floor_name: destination.floor_name,
    building_id: destination.building_id,
  });

  const floors: Route['floors'] = [];
  for (const node of nodes) {
    if (!node.floor_id || !node.floor_name || node.floor_level === null) continue;
    if (floors.some((floor) => floor.floor_id === node.floor_id)) continue;
    floors.push({
      floor_id: node.floor_id,
      floor_name: node.floor_name,
      level: Number(node.floor_level),
      building_id: node.building_id ?? '',
      building_code: node.building_code ?? '',
    });
  }

  return {
    nodes,
    legs: legs.map((leg) => ({ ...leg, geo_geometry: densify(leg.geo_geometry.map(([lat, lng]) => ({ lat, lng }))).map(({ lat, lng }) => [lat, lng] as [number, number]) })),
    transitions,
    steps,
    distance_m: Math.round(totalDistance),
    duration_seconds: Math.round(totalDuration),
    floors,
    requires_accessible: Boolean(options.accessibleOnly),
    accessible: nodes.every((node) => node.is_accessible) && path.edges.every((edge) => edge.is_accessible),
    origin: nodes[0]!,
    destination,
  };
}

/* --------------------------------------------------------- live route evaluation */

export interface EvaluationPosition {
  lat?: number | null;
  lng?: number | null;
  plan_x?: number | null;
  plan_y?: number | null;
  floor_id?: string | null;
}

/**
 * Deterministic progress and deviation evaluation (PROMPT §16).
 * Returns whether the walker is off-route plus the measured deviation — the caller
 * decides about warnings, grace periods and recalculation.
 */
export function evaluateRoutePosition(route: Route, position: EvaluationPosition): RouteEvaluation {
  const activeLeg =
    (position.floor_id && route.legs.find((leg) => leg.floor_id === position.floor_id)) ||
    route.legs[route.legs.length - 1]!;

  const usesPlan = position.plan_x != null && position.plan_y != null && activeLeg.plan_geometry.length > 1;
  const polyline: LatLng[] = usesPlan
    ? activeLeg.plan_geometry.map(([x, y]) => ({ lat: y, lng: x }))
    : activeLeg.geo_geometry.map(([lat, lng]) => ({ lat, lng }));

  const point: LatLng = usesPlan
    ? { lat: position.plan_y!, lng: position.plan_x! }
    : { lat: position.lat ?? 0, lng: position.lng ?? 0 };

  const tolerance = usesPlan ? OFF_ROUTE_TOLERANCE_INDOOR_M : OFF_ROUTE_TOLERANCE_OUTDOOR_M;

  let offRoute = false;
  let deviation = 0;
  let progress = 0;

  if (polyline.length > 1) {
    const { distance } = distanceAlong(polyline, point);
    deviation = distance;
    const travelled = progressAlongPolyline(point, polyline);
    const total = route.legs.reduce((sum, leg) => sum + leg.distance_m, 0) || route.distance_m || 1;
    progress = Math.max(0, Math.min(1, travelled / total));
    offRoute = deviation > tolerance;
  }

  const travelledFromProgress = progress * route.distance_m;
  const remaining = Math.max(0, route.distance_m - travelledFromProgress);
  let currentStepIndex = 0;
  let accumulated = 0;
  for (let i = 0; i < route.steps.length; i += 1) {
    currentStepIndex = i;
    accumulated += route.steps[i]!.distance_m;
    if (accumulated >= travelledFromProgress) break;
  }

  const destination = route.destination;
  const arrived =
    (destination.plan_x !== null && destination.plan_y !== null && position.plan_x != null && position.plan_y != null
      ? planDistance({ x: destination.plan_x, y: destination.plan_y }, { x: position.plan_x, y: position.plan_y }) < 6
      : destination.lat !== null && destination.lng !== null && position.lat != null && position.lng != null
        ? distanceMeters({ lat: destination.lat, lng: destination.lng }, { lat: position.lat, lng: position.lng }) < 15
        : false) || remaining < 4;

  return {
    off_route: offRoute && !arrived,
    distance_from_route_m: Math.round(deviation * 10) / 10,
    tolerance_m: tolerance,
    progress: Math.round(progress * 1000) / 1000,
    remaining_m: Math.round(remaining),
    current_step_index: currentStepIndex,
    current_step: route.steps[currentStepIndex] ?? null,
    arrived,
    floor_id: activeLeg.floor_id,
  };
}

/** Local helper: distance from a point to a polyline expressed in metres/degrees space. */
function distanceAlong(polyline: LatLng[], point: LatLng): { distance: number } {
  const latScale = 111_320;
  const lngScale = 111_320 * Math.cos((point.lat * Math.PI) / 180);
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < polyline.length - 1; i += 1) {
    const a = polyline[i]!;
    const b = polyline[i + 1]!;
    const ax = (a.lng - point.lng) * lngScale;
    const ay = (a.lat - point.lat) * latScale;
    const bx = (b.lng - point.lng) * lngScale;
    const by = (b.lat - point.lat) * latScale;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSq));
    const distance = Math.hypot(ax + t * dx, ay + t * dy);
    if (distance < best) best = distance;
  }
  return { distance: best };
}

export interface RouteRequest {
  fromNodeId?: string;
  fromPosition?: PositionFix;
  toRoomId?: string;
  toNodeId?: string;
  accessible?: boolean;
}

export async function calculateRoute(
  db: Db,
  params: RouteRequest,
): Promise<{ route: Route; graph: NavigationGraph; path: PathResult; destination_label: string }> {
  const destinationNode = params.toRoomId
    ? await resolveNodeForRoom(db, params.toRoomId)
    : params.toNodeId
      ? (await loadGraph(db)).nodes.get(params.toNodeId)
      : null;
  if (!destinationNode) throw ApiError.notFound('Destination not found.');

  const originNode = params.fromNodeId
    ? (await loadGraph(db)).nodes.get(params.fromNodeId)
    : params.fromPosition
      ? await resolveNearestNode(db, params.fromPosition)
      : null;
  if (!originNode) throw ApiError.badRequest('A starting point is required (node or position).');

  const graph = await loadGraph(db);
  const path = findPath(graph, originNode.id, destinationNode.id, { accessibleOnly: params.accessible });
  if (!path) {
    throw ApiError.unavailable(
      params.accessible
        ? 'No accessible route is available. Try disabling the accessible-only preference.'
        : 'No route could be found between these points on the configured navigation graph.',
    );
  }

  let destinationLabel = destinationNode.label;
  if (params.toRoomId) {
    const room = await db.one<{ code: string; name: string }>('SELECT code, name FROM rooms WHERE id = $1', [params.toRoomId]);
    if (room) destinationLabel = `${room.name} (${room.code})`;
  }

  const route = await buildRoute(db, path, graph, {
    accessibleOnly: params.accessible,
    destinationLabel,
  });

  return { route, graph, path, destination_label: destinationLabel };
}

export const INDOOR_SPEED_REFERENCE_MPS = WALKING_SPEED_MPS;
