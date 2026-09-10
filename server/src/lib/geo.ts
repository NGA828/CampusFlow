/**
 * Deterministic spatial maths (PROMPT §7): the backend — never the client and never the
 * language model — decides distances, geofence membership, off-route state and progress.
 *
 * The same formulas are available inside PostgreSQL through `cf_distance_m(...)`, so
 * geofence checks can run in a single SQL statement on large data sets. When PostGIS is
 * installed, `ST_Distance(geography, geography)` yields the same metres.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface PlanPoint {
  x: number;
  y: number;
}

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Great-circle distance in metres. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Plan-space distance (floor plans are stored in metres). */
export function planDistance(a: PlanPoint, b: PlanPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function bearingDegrees(a: LatLng, b: LatLng): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function compassLabel(bearing: number): string {
  const points = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  return points[Math.round(bearing / 45) % 8];
}

/**
 * Distance from a point to a polyline in metres. Uses an equirectangular projection
 * around the query point, which is accurate well below one metre at campus scale and
 * keeps the calculation dependency-free.
 */
export function distanceToPolyline(point: LatLng, polyline: LatLng[]): { distance: number; index: number; t: number } {
  if (polyline.length === 0) return { distance: Number.POSITIVE_INFINITY, index: 0, t: 0 };
  if (polyline.length === 1) return { distance: distanceMeters(point, polyline[0]!), index: 0, t: 0 };

  const latScale = 111_320;
  const lngScale = 111_320 * Math.cos(toRad(point.lat));
  const toXY = (p: LatLng) => ({ x: (p.lng - point.lng) * lngScale, y: (p.lat - point.lat) * latScale });

  let best = { distance: Number.POSITIVE_INFINITY, index: 0, t: 0 };
  for (let i = 0; i < polyline.length - 1; i += 1) {
    const a = toXY(polyline[i]!);
    const b = toXY(polyline[i + 1]!);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lengthSq));
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    const distance = Math.hypot(px, py);
    if (distance < best.distance) best = { distance, index: i, t };
  }
  return best;
}

/** Distance along a polyline from its start to the closest point of `point`. */
export function progressAlongPolyline(point: LatLng, polyline: LatLng[]): number {
  const { index, t } = distanceToPolyline(point, polyline);
  let travelled = 0;
  for (let i = 0; i < index; i += 1) travelled += distanceMeters(polyline[i]!, polyline[i + 1]!);
  if (index < polyline.length - 1) travelled += distanceMeters(polyline[index]!, polyline[index + 1]!) * t;
  return travelled;
}

/** Interpolate a point at `fraction` (0–1) along a polyline. */
export function pointAlongPolyline(polyline: LatLng[], fraction: number): LatLng {
  if (polyline.length === 0) throw new Error('polyline must not be empty');
  if (polyline.length === 1) return polyline[0]!;
  const total = polyline.reduce((sum, p, i) => (i === 0 ? 0 : sum + distanceMeters(polyline[i - 1]!, p)), 0);
  let target = Math.max(0, Math.min(1, fraction)) * total;
  for (let i = 0; i < polyline.length - 1; i += 1) {
    const segment = distanceMeters(polyline[i]!, polyline[i + 1]!);
    if (target <= segment) {
      const ratio = segment === 0 ? 0 : target / segment;
      return {
        lat: polyline[i]!.lat + (polyline[i + 1]!.lat - polyline[i]!.lat) * ratio,
        lng: polyline[i]!.lng + (polyline[i + 1]!.lng - polyline[i]!.lng) * ratio,
      };
    }
    target -= segment;
  }
  return polyline[polyline.length - 1]!;
}

/** Densely sample a polyline so route geometry can be rendered on a canvas. */
export function densify(polyline: LatLng[], maxSegmentMeters = 8): LatLng[] {
  if (polyline.length < 2) return [...polyline];
  const out: LatLng[] = [polyline[0]!];
  for (let i = 0; i < polyline.length - 1; i += 1) {
    const a = polyline[i]!;
    const b = polyline[i + 1]!;
    const segment = distanceMeters(a, b);
    const steps = Math.max(1, Math.min(60, Math.round(segment / maxSegmentMeters)));
    for (let s = 1; s <= steps; s += 1) {
      const ratio = s / steps;
      out.push({ lat: a.lat + (b.lat - a.lat) * ratio, lng: a.lng + (b.lng - a.lng) * ratio });
    }
  }
  return out;
}

export function approximatePolygonAreaSqMeters(ring: LatLng[]): number {
  if (ring.length < 3) return 0;
  const latScale = 111_320;
  const lngScale = 111_320 * Math.cos(toRad(ring[0]!.lat));
  let area = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    area += (a.lng - ring[0]!.lng) * lngScale * ((b.lat - ring[0]!.lat) * latScale) -
            (b.lng - ring[0]!.lng) * lngScale * ((a.lat - ring[0]!.lat) * latScale);
  }
  return Math.abs(area / 2);
}
