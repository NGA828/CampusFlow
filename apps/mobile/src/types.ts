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

export interface CampusModel {
  university: University;
  buildings: { id: string; code: string; name: string; coordinates: [number, number] }[];
  rooms: { id: string; code: string; name: string; bookable: boolean; nodeId: string; floorId: string }[];
  anchors: { code: string; label: string; nodeId: string }[];
  nodes: { id: string; label: string; coordinates: [number, number] }[];
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
