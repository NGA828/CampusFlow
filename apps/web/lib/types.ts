/** Mirrors `apps/api/src/types.ts`. Kept small and explicit rather than generated. */

export type Role = 'STUDENT' | 'STAFF' | 'ADMIN';

export interface University {
  slug: string;
  name: string;
  shortName: string;
  type: 'PUBLIC' | 'PRIVATE' | 'INTERNATIONAL' | 'MILITARY';
  city: string;
  neighbourhood: string | null;
  coordinates: [number, number];
  accuracy: 'CITY_LOCATION' | 'CAMPUS_POINT';
  description: string;
  sources: { claim: string; url: string }[];
  indoorMappingPriority: number | null;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  universitySlug: string;
  matricule: string | null;
}

export interface RoomSummary {
  id: string;
  code: string;
  name: string;
  kind: 'CLASSROOM' | 'LAB' | 'ADMINISTRATIVE' | 'AMENITY' | 'LIBRARY';
  capacity: number;
  bookable: boolean;
  nodeId: string;
  buildingName: string;
  buildingCode: string;
  floorName: string;
}

export interface Booking {
  id: string;
  roomId: string;
  purpose: string;
  startsAt: string;
  endsAt: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'CANCELLED';
  decisionNote: string | null;
  room: { id: string; code: string; name: string; buildingName: string; floorName: string; nodeId: string } | null;
  student: { id: string; name: string; matricule: string | null } | null;
}

export interface CampusEvent {
  id: string;
  universitySlug: string;
  title: string;
  body: string;
  venue: string;
  startsAt: string;
  endsAt: string;
}

export interface Announcement {
  id: string;
  universitySlug: string;
  title: string;
  body: string;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  publishedAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  kind: 'BOOKING' | 'ANNOUNCEMENT' | 'EVENT' | 'NAVIGATION';
  createdAt: string;
  readAt: string | null;
}

export interface RouteStep {
  nodeId: string;
  label: string;
  floorName: string;
  coordinates: [number, number];
  instruction: string;
  distanceMetres: number;
  edgeKind: 'CORRIDOR' | 'DOOR' | 'STAIRS' | 'LIFT' | null;
}

export interface IndoorRoute {
  from: string;
  to: string;
  stepFree: boolean;
  totalDistanceMetres: number;
  estimatedMinutes: number;
  steps: RouteStep[];
}

export interface CampusModel {
  university: University;
  buildings: { id: string; code: string; name: string; description: string; coordinates: [number, number]; floors: { id: string; level: number; name: string }[] }[];
  rooms: { id: string; buildingId: string; floorId: string; code: string; name: string; kind: RoomSummary['kind']; capacity: number; bookable: boolean; nodeId: string }[];
  anchors: { code: string; buildingId: string; floorId: string; nodeId: string; label: string }[];
  nodes: { id: string; buildingId: string; floorId: string; label: string; coordinates: [number, number] }[];
  edges: { from: string; to: string; kind: string; accessible: boolean }[];
}
