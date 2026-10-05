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
}

export interface CampusMapProps {
  centre: [number, number];
  zoom: number;
  buildings: MapBuilding[];
  gps: [number, number] | null;
  indoor: [number, number] | null;
  route: [number, number][] | null;
}

export const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
