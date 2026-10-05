/**
 * CampusFlow domain types.
 *
 * Everything the API returns is described here, so the web and mobile clients can
 * mirror these shapes without guessing. Nothing in this file is persisted — see
 * `store.ts` for the runtime data — but the *claims* a record makes about the real
 * world (how precise a coordinate is, where a fact came from) are part of the type,
 * because CampusFlow shows real places to people who will walk to them.
 */

export type Role = 'STUDENT' | 'STAFF' | 'ADMIN';

export type InstitutionType = 'PUBLIC' | 'PRIVATE' | 'INTERNATIONAL' | 'MILITARY';

/**
 * How much a coordinate is allowed to claim.
 *
 * `CITY_LOCATION` is the honest default: the point locates the institution inside
 * Yaoundé, nothing more. `CAMPUS_POINT` means the coordinate was taken from a
 * mapped campus feature (OpenStreetMap way, official contact page) and may be shown
 * as the campus entrance. No value in this codebase claims a surveyed boundary.
 */
export type LocationAccuracy = 'CITY_LOCATION' | 'CAMPUS_POINT';

export interface SourceRef {
  /** What the source establishes, in one phrase. */
  claim: string;
  url: string;
}

export interface University {
  slug: string;
  name: string;
  shortName: string;
  type: InstitutionType;
  city: string;
  neighbourhood: string | null;
  /** [longitude, latitude] — GeoJSON order, which is what MapLibre expects. */
  coordinates: [number, number];
  accuracy: LocationAccuracy;
  description: string;
  sources: SourceRef[];
  /**
   * 1 is the institution currently being mapped indoors; `null` means outdoor
   * directory only. IAI Cameroon is 1 — it is the pilot campus for indoor routing.
   */
  indoorMappingPriority: number | null;
}

export interface Building {
  id: string;
  universitySlug: string;
  code: string;
  name: string;
  description: string;
  coordinates: [number, number];
  floors: Floor[];
}

export interface Floor {
  id: string;
  level: number;
  name: string;
}

export type RoomKind = 'CLASSROOM' | 'LAB' | 'ADMINISTRATIVE' | 'AMENITY' | 'LIBRARY';

export interface Room {
  id: string;
  buildingId: string;
  floorId: string;
  code: string;
  name: string;
  kind: RoomKind;
  capacity: number;
  /** Administrative rooms can be requested by students for meetings and interviews. */
  bookable: boolean;
  /** Indoor graph node this room opens onto. */
  nodeId: string;
}

/** A printed QR anchor fixed to a wall; scanning one establishes an indoor position. */
export interface QrAnchor {
  code: string;
  buildingId: string;
  floorId: string;
  nodeId: string;
  label: string;
}

export interface NavNode {
  id: string;
  buildingId: string;
  floorId: string;
  label: string;
  /** Local floor-plan metres, not WGS84: indoor routing happens in plan space. */
  x: number;
  y: number;
  coordinates: [number, number];
}

export interface NavEdge {
  from: string;
  to: string;
  /** Stairs and lifts connect floors; `accessible` drives the step-free option. */
  kind: 'CORRIDOR' | 'DOOR' | 'STAIRS' | 'LIFT';
  accessible: boolean;
}

export type BookingStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'CANCELLED';

export interface Booking {
  id: string;
  roomId: string;
  studentId: string;
  purpose: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  /** Set when staff approve or decline; never written by the student. */
  decidedBy: string | null;
  decisionNote: string | null;
  createdAt: string;
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
  authorId: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  kind: 'BOOKING' | 'ANNOUNCEMENT' | 'EVENT' | 'NAVIGATION';
  createdAt: string;
  readAt: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  universitySlug: string;
  /** Students only. */
  matricule: string | null;
  passwordHash: string;
  createdAt: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  universitySlug: string;
  matricule: string | null;
}

export interface Session {
  token: string;
  refreshToken: string;
  userId: string;
  issuedAt: string;
  expiresAt: string;
}
