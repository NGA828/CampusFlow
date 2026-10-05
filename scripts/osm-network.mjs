/**
 * Turn an OpenStreetMap highway extract into a routable walking graph.
 *
 * OSM ways are not a graph. A single way is a polyline that may run through a dozen junctions,
 * and two ways connect only because they happen to share a node id. Routing needs the opposite
 * shape: vertices at junctions and endpoints, and edges between them carrying the real geometry.
 *
 * This module is the pure part of that conversion so it can be tested without a network: feed it
 * Overpass `out geom` elements, get back nodes and edges ready for navigation_nodes/edges.
 *
 * Nothing here invents geometry. Every coordinate emitted came from the input.
 */

/** Metres between two WGS84 points. Haversine — the campus is small, but the city is not. */
export function haversineMetres(lat1, lng1, lat2, lng2) {
  const R = 6371008.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Length of a [{lat,lon}, …] polyline in metres. */
export function polylineMetres(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += haversineMetres(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
  }
  return total;
}

/**
 * Which highway values are walkable, and whether a wheelchair user can be routed over them.
 *
 * `steps` is walkable but never step-free. A motorway or trunk road is excluded outright: routing
 * a student along one would be a safety problem, not a routing inefficiency.
 */
const WALKABLE = {
  footway: { accessible: true, type: 'outdoor' },
  path: { accessible: true, type: 'outdoor' },
  pedestrian: { accessible: true, type: 'outdoor' },
  living_street: { accessible: true, type: 'outdoor' },
  residential: { accessible: true, type: 'outdoor' },
  service: { accessible: true, type: 'outdoor' },
  unclassified: { accessible: true, type: 'outdoor' },
  tertiary: { accessible: true, type: 'outdoor' },
  secondary: { accessible: true, type: 'outdoor' },
  track: { accessible: false, type: 'outdoor' },
  steps: { accessible: false, type: 'stairwell' },
};

export function isWalkable(tags = {}) {
  return Boolean(WALKABLE[tags.highway]);
}

/**
 * Explicit tags override the default for the highway class. An OSM `wheelchair=no` on a footway is
 * a surveyed fact and must beat our optimistic default; `steps` can never be step-free.
 */
export function edgeAccessible(tags = {}) {
  const base = WALKABLE[tags.highway];
  if (!base) return false;
  if (tags.highway === 'steps') return false;
  if (tags.wheelchair === 'no') return false;
  if (tags.wheelchair === 'yes') return true;
  return base.accessible;
}

/**
 * Build the graph.
 *
 * A vertex is created where a node is shared by more than one way, or is the first/last node of a
 * way (its endpoint), or carries routing-relevant tags. Everything between two vertices becomes a
 * single edge whose `geometry` keeps the intermediate shape, so the drawn line follows the real
 * path rather than cutting the corner.
 *
 * @param {Array} elements Overpass elements from `out geom` (ways with `nodes` and `geometry`).
 * @returns {{nodes: Array, edges: Array, skipped: number}}
 */
export function buildWalkingGraph(elements) {
  const ways = elements.filter(
    (el) => el.type === 'way' && Array.isArray(el.nodes) && Array.isArray(el.geometry) && el.nodes.length === el.geometry.length,
  );

  const walkable = ways.filter((way) => isWalkable(way.tags));
  const skipped = ways.length - walkable.length;

  // How many walkable ways touch each OSM node id — a count above one means a junction.
  const useCount = new Map();
  for (const way of walkable) {
    // A node repeated inside one closed way (a roundabout) still only counts once for that way.
    for (const id of new Set(way.nodes)) {
      useCount.set(id, (useCount.get(id) ?? 0) + 1);
    }
  }

  const nodes = new Map();
  const edges = [];

  const vertexAt = (osmId, point) => {
    if (!nodes.has(osmId)) {
      nodes.set(osmId, { osm_id: osmId, lat: point.lat, lng: point.lon });
    }
    return osmId;
  };

  for (const way of walkable) {
    const accessible = edgeAccessible(way.tags);
    const edgeType = WALKABLE[way.tags.highway].type;
    // `oneway` applies to vehicles. People on foot walk both ways down a one-way street, and this
    // graph exists to route people on foot, so every edge stays bidirectional.
    const isVertex = (index) =>
      index === 0 ||
      index === way.nodes.length - 1 ||
      (useCount.get(way.nodes[index]) ?? 0) > 1;

    let startIndex = 0;
    for (let i = 1; i < way.nodes.length; i += 1) {
      if (!isVertex(i)) continue;

      const slice = way.geometry.slice(startIndex, i + 1);
      const fromOsm = way.nodes[startIndex];
      const toOsm = way.nodes[i];

      // A closed ring's final segment returns to its own start; a zero-length edge is not routable.
      if (fromOsm !== toOsm && slice.length >= 2) {
        const weight = polylineMetres(slice);
        if (weight > 0) {
          vertexAt(fromOsm, slice[0]);
          vertexAt(toOsm, slice[slice.length - 1]);
          edges.push({
            from_osm_id: fromOsm,
            to_osm_id: toOsm,
            weight: Math.round(weight * 100) / 100,
            accessible,
            edge_type: edgeType,
            bidirectional: true,
            way_osm_id: way.id,
            name: way.tags.name ?? null,
            surface: way.tags.surface ?? null,
            // [lng, lat] to match the GeoJSON order the rest of the app already uses.
            geometry: slice.map((p) => [p.lon, p.lat]),
          });
        }
      }

      startIndex = i;
    }
  }

  return { nodes: [...nodes.values()], edges, skipped };
}

/** Overpass query for every highway inside a bounding box. */
export function overpassQuery({ minLat, minLng, maxLat, maxLng }) {
  return `[out:json][timeout:240];way[highway](${minLat},${minLng},${maxLat},${maxLng});out geom tags;`;
}
