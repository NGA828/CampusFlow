import type { FastifyReply, FastifyRequest } from 'fastify';
import { ApiError } from '../lib/errors.js';
import type { Permission, RoleCode } from '../policies/rbac.js';
import { permissionsForRole, roleAtLeast } from '../policies/rbac.js';
import type { Db } from '../db/client.js';
import { sha256 } from '../lib/security.js';

export interface StaffAssignment {
  scope_type: 'building' | 'room' | 'office' | 'queue';
  scope_id: string;
  role_in_scope: string;
  can_manage_timetable: boolean;
  can_publish_content: boolean;
  can_call_tickets: boolean;
}

export interface Principal {
  id: string;
  name: string;
  email: string;
  role: RoleCode;
  status: string;
  registration_no: string | null;
  department: string | null;
  permissions: Permission[];
  assignments: StaffAssignment[];
  tokenId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    principal?: Principal;
  }
}

export interface RequestContext {
  request: FastifyRequest;
  reply: FastifyReply;
  db: Db;
  principal?: Principal;
  ip?: string;
}

/** Resolve a bearer token to an authenticated principal. */
export async function resolvePrincipal(db: Db, token: string): Promise<Principal | null> {
  const row = await db.one<{
    token_id: string;
    user_id: string;
    name: string;
    email: string;
    role_code: RoleCode;
    status: string;
    registration_no: string | null;
    department: string | null;
  }>(
    `SELECT t.id AS token_id, u.id AS user_id, u.name, u.email, u.role_code, u.status,
            u.registration_no, u.department
       FROM api_tokens t
       JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = $1
        AND t.revoked_at IS NULL
        AND (t.expires_at IS NULL OR t.expires_at > now())
        AND u.status = 'active'`,
    [sha256(token)],
  );
  if (!row) return null;

  await db.query('UPDATE api_tokens SET last_used_at = now() WHERE id = $1', [row.token_id]);

  const assignments =
    row.role_code === 'staff'
      ? await db.query<StaffAssignment>(
          `SELECT scope_type, scope_id, role_in_scope, can_manage_timetable, can_publish_content, can_call_tickets
             FROM staff_assignments WHERE user_id = $1`,
          [row.user_id],
        )
      : [];

  return {
    id: row.user_id,
    name: row.name,
    email: row.email,
    role: row.role_code,
    status: row.status,
    registration_no: row.registration_no,
    department: row.department,
    permissions: permissionsForRole(row.role_code),
    assignments,
    tokenId: row.token_id,
  };
}

export function extractBearer(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (!value || scheme.toLowerCase() !== 'bearer') return null;
  return value.trim() || null;
}

/** Load the principal from the request (no error when absent). */
export async function loadPrincipal(ctx: RequestContext): Promise<void> {
  const token = extractBearer(ctx.request);
  if (!token) return;
  const principal = await resolvePrincipal(ctx.db, token);
  if (principal) ctx.principal = principal;
}

export function requireAuth(ctx: RequestContext): Principal {
  if (!ctx.principal) throw ApiError.unauthorized('Sign in to continue.');
  return ctx.principal;
}

export function requireRole(ctx: RequestContext, role: RoleCode): Principal {
  const principal = requireAuth(ctx);
  if (!roleAtLeast(principal.role, role)) {
    throw ApiError.forbidden('Your account does not have access to this area.');
  }
  return principal;
}

export function requirePermission(ctx: RequestContext, permission: Permission): Principal {
  const principal = requireAuth(ctx);
  if (!principal.permissions.includes(permission)) {
    throw ApiError.forbidden(`Missing permission: ${permission}.`);
  }
  return principal;
}

/** Students may only ever act on their own records. */
export function requireOwnerOrStaff(ctx: RequestContext, ownerId: string): Principal {
  const principal = requireAuth(ctx);
  if (principal.id === ownerId) return principal;
  if (roleAtLeast(principal.role, 'staff')) return principal;
  throw ApiError.forbidden('You may only access your own records.');
}

/* ------------------------------------------------------- scoped staff authorisation */

export interface QueueScope {
  queue_id: string;
  room_id: string;
  building_id: string;
  office_id?: string | null;
  office_assignment_required?: boolean;
}

/** A staff member may operate a queue only within an assigned scope (building/room/queue). */
export async function canOperateQueue(ctx: RequestContext, scope: QueueScope): Promise<boolean> {
  const principal = requireAuth(ctx);
  if (principal.role === 'admin') return true;
  if (principal.role !== 'staff') return false;
  if (scope.office_id) {
    return principal.assignments.some(
      (a) =>
        a.can_call_tickets &&
        ((a.scope_type === 'office' && a.scope_id === scope.office_id) ||
          (a.scope_type === 'building' && a.scope_id === scope.building_id) ||
          (a.scope_type === 'room' && a.scope_id === scope.room_id) ||
          (a.scope_type === 'queue' && a.scope_id === scope.queue_id)),
    );
  }
  return principal.assignments.some(
    (a) =>
      a.can_call_tickets &&
      ((a.scope_type === 'building' && a.scope_id === scope.building_id) ||
        (a.scope_type === 'room' && a.scope_id === scope.room_id) ||
        (a.scope_type === 'queue' && a.scope_id === scope.queue_id)),
  );
}

export async function requireQueueOperation(ctx: RequestContext, scope: QueueScope): Promise<Principal> {
  const principal = requireAuth(ctx);
  if (!(await canOperateQueue(ctx, scope))) {
    throw ApiError.forbidden('You are not assigned to operate this queue.');
  }
  return principal;
}
