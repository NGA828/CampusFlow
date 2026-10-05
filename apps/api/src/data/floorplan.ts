import type { Floor, NavEdge, NavNode, Room, RoomKind } from '../types.ts';

/**
 * The indoor floor-plan generator.
 *
 * Every block in CampusFlow is a corridor with rooms along it, so rather than hand-
 * placing forty nodes and hoping they line up, each floor is *described* — corridor
 * length, which rooms sit where, how deep they are — and the geometry is derived.
 * That makes the plan internally consistent by construction: a room polygon, its door
 * on the corridor and the distance the router reports all come from the same numbers.
 *
 * Dimensions are estimates, read off photographs of the campus and ordinary building
 * practice (2.4 m corridors, ~1 m² per lecture seat, 7 m room depth). They are stated
 * in metres so they can be corrected against a real plan one line at a time.
 *
 * ## Room numbering
 *
 * `P104` → block **P**(édagogique), floor **1**, room **04**.
 *
 * The middle digit is always the floor, which is the point: a student reading `A101`
 * on a door knows it is upstairs in the administration block. Odd numbers are on the
 * left of the corridor walking in, even numbers on the right — the convention used in
 * most Cameroonian public buildings.
 */

/** Corridor width in metres — two people with bags, plus a door swing. */
export const CORRIDOR_WIDTH = 2.4;

export type Side = 'ODD' | 'EVEN';

export interface RoomSpec {
  /** Stable record id. Existing ids are kept so printed anchors and bookings survive. */
  id: string;
  /** Two-digit tail; the full code is derived as BLOCK + FLOOR + tail. */
  number: string;
  name: string;
  kind: RoomKind;
  capacity: number;
  bookable: boolean;
  side: Side;
  /** Metres along the corridor where the room starts, and how long its frontage is. */
  start: number;
  length: number;
  /** How far the room reaches back from the corridor. */
  depth: number;
}

export interface FloorSpec {
  id: string;
  level: number;
  name: string;
  /** Usable corridor length in metres. */
  corridorLength: number;
  rooms: RoomSpec[];
  /** Metres along the corridor where the vertical links stand. */
  stairsAt: number | null;
  liftAt: number | null;
  /** Ground floors only: where the outside door meets the corridor. */
  entranceAt?: number;
  entranceSide?: Side;
}

export interface BlockSpec {
  buildingId: string;
  /** Single letter used in room numbers. */
  letter: string;
  /** Short code used in node ids, e.g. `ped` → `n-ped1-c3`. */
  slug: string;
  /** Corridor start, in campus metres east/north of the perimeter centroid. */
  origin: [number, number];
  /** Corridor bearing in degrees, counter-clockwise from east. */
  bearingDeg: number;
  floors: FloorSpec[];
}

export interface GeneratedFloor {
  floor: Floor;
  /** Corridor centre line, in campus metres. */
  corridor: [number, number][];
}

export interface Generated {
  rooms: Room[];
  nodes: NavNode[];
  edges: NavEdge[];
  floors: GeneratedFloor[];
}

/** Local plan coordinates (u along the corridor, v to the odd-numbered side). */
function place(block: BlockSpec, u: number, v: number): [number, number] {
  const a = (block.bearingDeg * Math.PI) / 180;
  return [
    block.origin[0] + u * Math.cos(a) - v * Math.sin(a),
    block.origin[1] + u * Math.sin(a) + v * Math.cos(a),
  ];
}

function roomCode(block: BlockSpec, floor: FloorSpec, spec: RoomSpec): string {
  return `${block.letter}${floor.level}${spec.number}`;
}

/**
 * Build the rooms, the walking graph and the corridor geometry of one block.
 *
 * `toLngLat` converts campus metres to WGS84; it is passed in so this module stays
 * pure geometry and the campus file keeps ownership of the projection.
 */
export function generateBlock(
  block: BlockSpec,
  toLngLat: (east: number, north: number) => [number, number],
): Generated {
  const rooms: Room[] = [];
  const nodes: NavNode[] = [];
  const edges: NavEdge[] = [];
  const floors: GeneratedFloor[] = [];

  const node = (id: string, floorId: string, label: string, u: number, v: number): NavNode => {
    const [east, north] = place(block, u, v);
    const entry: NavNode = {
      id,
      buildingId: block.buildingId,
      floorId,
      label,
      x: east,
      y: north,
      coordinates: toLngLat(east, north),
    };
    nodes.push(entry);
    return entry;
  };

  for (const floor of block.floors) {
    const prefix = `n-${block.slug}${floor.level}`;
    const half = CORRIDOR_WIDTH / 2;

    // Corridor nodes: one per room door, plus the ends, in order along the corridor.
    const stops = new Map<number, string>();
    const mark = (u: number) => {
      const key = Math.round(u * 10) / 10;
      if (!stops.has(key)) stops.set(key, '');
      return key;
    };

    mark(0);
    mark(floor.corridorLength);
    if (floor.stairsAt !== null) mark(floor.stairsAt);
    if (floor.liftAt !== null) mark(floor.liftAt);
    if (floor.entranceAt !== undefined) mark(floor.entranceAt);
    for (const spec of floor.rooms) mark(spec.start + spec.length / 2);

    const ordered = [...stops.keys()].sort((a, b) => a - b);
    const corridorNodeAt = new Map<number, string>();
    ordered.forEach((u, index) => {
      const id = `${prefix}-c${index + 1}`;
      corridorNodeAt.set(u, id);
      node(id, floor.id, `Couloir ${block.letter}${floor.level} — ${Math.round(u)} m`, u, 0);
    });

    // Chain the corridor together; each segment's length is simply the gap in metres.
    for (let index = 1; index < ordered.length; index += 1) {
      edges.push({
        from: corridorNodeAt.get(ordered[index - 1] as number) as string,
        to: corridorNodeAt.get(ordered[index] as number) as string,
        kind: 'CORRIDOR',
        accessible: true,
      });
    }

    // Rooms: a polygon, a node at the centre, a door onto the nearest corridor stop.
    for (const spec of floor.rooms) {
      const sign = spec.side === 'ODD' ? 1 : -1;
      const near = sign * half;
      const far = sign * (half + spec.depth);
      const polygon: [number, number][] = [
        place(block, spec.start, near),
        place(block, spec.start + spec.length, near),
        place(block, spec.start + spec.length, far),
        place(block, spec.start, far),
      ].map(([east, north]) => toLngLat(east, north));
      polygon.push(polygon[0] as [number, number]);

      const centreU = spec.start + spec.length / 2;
      const centreV = sign * (half + spec.depth / 2);
      const code = roomCode(block, floor, spec);
      const roomNodeId = `n-${spec.id}`;

      node(roomNodeId, floor.id, spec.name, centreU, centreV);
      edges.push({
        from: corridorNodeAt.get(Math.round(centreU * 10) / 10) as string,
        to: roomNodeId,
        kind: 'DOOR',
        accessible: true,
      });

      rooms.push({
        id: spec.id,
        buildingId: block.buildingId,
        floorId: floor.id,
        code,
        name: spec.name,
        kind: spec.kind,
        capacity: spec.capacity,
        bookable: spec.bookable,
        nodeId: roomNodeId,
        widthMetres: Math.round(spec.length * 10) / 10,
        depthMetres: Math.round(spec.depth * 10) / 10,
        areaSqMetres: Math.round(spec.length * spec.depth),
        polygon,
      });
    }

    // Vertical links and the outside door.
    if (floor.stairsAt !== null) {
      const stairs = `${prefix}-stairs`;
      node(stairs, floor.id, `Escalier ${block.letter} — ${floor.name}`, floor.stairsAt, 0);
      edges.push({ from: corridorNodeAt.get(Math.round(floor.stairsAt * 10) / 10) as string, to: stairs, kind: 'CORRIDOR', accessible: true });
    }
    if (floor.liftAt !== null) {
      const lift = `${prefix}-lift`;
      node(lift, floor.id, `Ascenseur ${block.letter} — ${floor.name}`, floor.liftAt, 0);
      edges.push({ from: corridorNodeAt.get(Math.round(floor.liftAt * 10) / 10) as string, to: lift, kind: 'CORRIDOR', accessible: true });
    }
    if (floor.entranceAt !== undefined) {
      const sign = floor.entranceSide === 'EVEN' ? -1 : 1;
      const entrance = `n-${block.slug}${floor.level}-entrance`;
      const hall = `n-${block.slug}${floor.level}-hall`;
      node(entrance, floor.id, `Entrée ${block.letter}`, floor.entranceAt, sign * (half + 2));
      node(hall, floor.id, `Hall ${block.letter}`, floor.entranceAt, 0);
      edges.push({ from: entrance, to: hall, kind: 'DOOR', accessible: true });
      edges.push({ from: hall, to: corridorNodeAt.get(Math.round(floor.entranceAt * 10) / 10) as string, kind: 'CORRIDOR', accessible: true });
    }

    floors.push({
      floor: {
        id: floor.id,
        level: floor.level,
        name: floor.name,
        corridorLengthMetres: floor.corridorLength,
        corridor: [place(block, 0, 0), place(block, floor.corridorLength, 0)].map(([east, north]) =>
          toLngLat(east, north),
        ) as [number, number][],
      },
      corridor: [place(block, 0, 0), place(block, floor.corridorLength, 0)],
    });
  }

  // Stairs and lifts join consecutive floors.
  for (let index = 1; index < block.floors.length; index += 1) {
    const below = block.floors[index - 1] as FloorSpec;
    const above = block.floors[index] as FloorSpec;
    if (below.stairsAt !== null && above.stairsAt !== null) {
      edges.push({
        from: `n-${block.slug}${below.level}-stairs`,
        to: `n-${block.slug}${above.level}-stairs`,
        kind: 'STAIRS',
        accessible: false,
      });
    }
    if (below.liftAt !== null && above.liftAt !== null) {
      edges.push({
        from: `n-${block.slug}${below.level}-lift`,
        to: `n-${block.slug}${above.level}-lift`,
        kind: 'LIFT',
        accessible: true,
      });
    }
  }

  return { rooms, nodes, edges, floors };
}
