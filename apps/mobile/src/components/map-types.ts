/**
 * The props shared by the two campus map implementations.
 *
 * `CampusMapView.tsx` draws them with MapLibre Native, `CampusMapView.web.tsx` with
 * MapLibre GL JS. Keeping the contract in its own file means the screen above never
 * learns which renderer it got.
 */
export interface MapBuilding {
  id: string;
  code: string;
  name: string;
  coordinates: [number, number];
  footprint: [number, number][] | null;
}

export interface MapLandmark {
  id: string;
  name: string;
  kind: string;
  coordinates: [number, number];
}

/** One glyph per landmark kind — a gate and a fountain should not look alike. */
export const LANDMARK_GLYPH: Record<string, string> = {
  GATE: '⛩',
  PLAZA: '▣',
  FOUNTAIN: '⛲',
  MONUMENT: '🗿',
  PARKING: 'P',
  GARDEN: '❦',
  VIEWPOINT: '◭',
  SPORT: '⚽',
};

/** One room of the floor currently on display, already projected to lng/lat. */
export interface MapRoom {
  id: string;
  code: string;
  name: string;
  bookable: boolean;
  polygon: [number, number][];
  centre: [number, number];
}

/** The plan of a single floor: its rooms and the corridor they open onto. */
export interface MapFloorPlan {
  floorId: string;
  label: string;
  corridors: [number, number][][];
  rooms: MapRoom[];
}

export interface CampusMapProps {
  centre: [number, number];
  zoom: number;
  /** The surveyed campus perimeter, drawn under everything else. */
  boundary: [number, number][] | null;
  buildings: MapBuilding[];
  landmarks: MapLandmark[];
  gps: [number, number] | null;
  indoor: [number, number] | null;
  route: [number, number][] | null;
  /** The indoor plan to draw inside the footprints, or null while outdoors. */
  plan?: MapFloorPlan | null;
}

export const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
