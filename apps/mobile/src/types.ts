/** Mirrors the API payloads the student app consumes. */

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: 'STUDENT' | 'STAFF' | 'ADMIN';
  universitySlug: string;
  matricule: string | null;
}

export interface University {
  slug: string;
  name: string;
  shortName: string;
  city: string;
  neighbourhood: string | null;
  coordinates: [number, number];
  indoorMappingPriority: number | null;
}

export interface CampusBoundary {
  ring: [number, number][];
  areaHectares: number;
  source: 'OSM' | 'PHOTO_SURVEY';
  sourceRef: { claim: string; url: string };
}

export interface Landmark {
  id: string;
  kind: 'GATE' | 'PLAZA' | 'FOUNTAIN' | 'MONUMENT' | 'PARKING' | 'GARDEN' | 'VIEWPOINT' | 'SPORT';
  name: string;
  description: string;
  coordinates: [number, number];
  nodeId: string | null;
}

export interface CampusModel {
  university: University;
  boundary: CampusBoundary | null;
  landmarks: Landmark[];
  buildings: {
    id: string;
    code: string;
    name: string;
    coordinates: [number, number];
    footprint: [number, number][] | null;
    floors: { id: string; level: number; name: string; corridorLengthMetres: number; corridor: [number, number][] }[];
  }[];
  rooms: {
    id: string;
    code: string;
    name: string;
    bookable: boolean;
    nodeId: string;
    floorId: string;
    widthMetres: number;
    depthMetres: number;
    areaSqMetres: number;
    polygon: [number, number][];
  }[];
  anchors: { code: string; label: string; nodeId: string }[];
  nodes: { id: string; label: string; floorId: string | null; coordinates: [number, number] }[];
}

export interface Position {
  nodeId: string;
  label: string;
  buildingName: string;
  floorName: string;
  coordinates: [number, number];
  fixedAt: string;
  source: string;
}

export interface RouteStep {
  nodeId: string;
  label: string;
  floorName: string;
  instruction: string;
  distanceMetres: number;
  coordinates: [number, number];
  edgeKind: 'CORRIDOR' | 'DOOR' | 'STAIRS' | 'LIFT' | null;
}

export interface IndoorRoute {
  totalDistanceMetres: number;
  estimatedMinutes: number;
  stepFree: boolean;
  /** Every node passed through, for the line; `steps` is the condensed wording. */
  geometry: [number, number][];
  steps: RouteStep[];
}

export interface Booking {
  id: string;
  purpose: string;
  startsAt: string;
  endsAt: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'CANCELLED';
  decisionNote: string | null;
  room: { id: string; code: string; name: string; buildingName: string; floorName: string; nodeId: string } | null;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  kind: string;
  createdAt: string;
  readAt: string | null;
}

export interface CampusEvent {
  id: string;
  title: string;
  body: string;
  venue: string;
  startsAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  publishedAt: string;
}
