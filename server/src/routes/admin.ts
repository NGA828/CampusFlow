import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { ApiError } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { created, noContent, ok, paginate, audit } from '../lib/respond.js';
import { requirePermission, requireRole } from '../middleware/auth.js';
import { generateToken, hashPassword } from '../lib/security.js';
import { permissionsForRole, ROLES, type RoleCode } from '../policies/rbac.js';
import { analyticsOverview, dashboardKpis } from '../services/analytics.js';
import { queueCounts, renumberLine } from '../services/queues.js';
import { signPayload } from '../services/positioning.js';
import { planDistance, distanceMeters } from '../lib/geo.js';
import { parse as parseBody } from '../lib/validate.js';
import { ctxOf } from '../http/context.js';
import { registerCrud } from '../http/crud.js';

/**
 * Administration (PROMPT §8, §77–§81).
 *
 * Everything here is gated by an explicit permission and recorded in the audit log. The
 * spatial configuration below (rooms, QR anchors, navigation nodes and edges, geofences)
 * is the authoritative input for indoor positioning and routing — an administrator can
 * shape the whole campus from the console without touching SQL.
 */

const uuid = z.string().uuid();

const buildingSchema = z.object({
  code: z.string().trim().min(1).max(12).toUpperCase(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(600).nullable().optional(),
  campus_name: z.string().trim().max(120).optional(),
  address: z.string().trim().max(200).nullable().optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  footprint: z.array(z.array(z.number()).length(2)).optional(),
  has_elevator: z.coerce.boolean().optional(),
  is_public: z.coerce.boolean().optional(),
  opening_hours: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['operational', 'limited', 'closed', 'maintenance']).optional(),
});

const floorSchema = z.object({
  building_id: uuid,
  level: z.coerce.number().int().min(-5).max(20),
  name: z.string().trim().min(1).max(60),
  plan_width: z.coerce.number().min(1).max(500).optional(),
  plan_height: z.coerce.number().min(1).max(500).optional(),
  plan_units: z.enum(['m', 'ft']).optional(),
  plan_image_url: z.string().trim().max(400).nullable().optional(),
  elevation_m: z.coerce.number().optional(),
});

const roomSchema = z.object({
  building_id: uuid,
  floor_id: uuid,
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  room_type: z.enum(['lecture', 'lab', 'study', 'office', 'library', 'auditorium', 'meeting', 'service', 'other']),
  capacity: z.coerce.number().int().min(0).max(5000),
  description: z.string().trim().max(1000).nullable().optional(),
  requires_admission: z.coerce.boolean().optional(),
  admission_policy: z.record(z.string(), z.unknown()).optional(),
  plan_x: z.coerce.number().optional(),
  plan_y: z.coerce.number().optional(),
  plan_w: z.coerce.number().min(0.5).max(200).optional(),
  plan_h: z.coerce.number().min(0.5).max(200).optional(),
  lat: z.coerce.number().min(-90).max(90).nullable().optional(),
  lng: z.coerce.number().min(-180).max(180).nullable().optional(),
  amenities: z.array(z.string().trim().max(40)).optional(),
  accessibility: z.array(z.string().trim().max(40)).optional(),
  status: z.enum(['available', 'occupied', 'restricted', 'maintenance', 'closed']).optional(),
});

const qrNodeSchema = z.object({
  code: z.string().trim().min(3).max(60).toUpperCase(),
  label: z.string().trim().min(2).max(120),
  building_id: uuid,
  floor_id: uuid,
  room_id: uuid.nullable().optional(),
  nav_node_id: uuid.nullable().optional(),
  plan_x: z.coerce.number(),
  plan_y: z.coerce.number(),
  lat: z.coerce.number().min(-90).max(90).nullable().optional(),
  lng: z.coerce.number().min(-180).max(180).nullable().optional(),
  version: z.coerce.number().int().min(1).max(99).optional(),
  is_active: z.coerce.boolean().optional(),
});

const navigationNodeSchema = z.object({
  code: z.string().trim().min(2).max(40).toUpperCase(),
  label: z.string().trim().min(2).max(120),
  building_id: uuid.nullable().optional(),
  floor_id: uuid.nullable().optional(),
  kind: z.enum(['corridor', 'junction', 'entrance', 'exit', 'stairs', 'elevator', 'room', 'outdoor', 'qr', 'service']),
  plan_x: z.coerce.number().nullable().optional(),
  plan_y: z.coerce.number().nullable().optional(),
  lat: z.coerce.number().min(-90).max(90).nullable().optional(),
  lng: z.coerce.number().min(-180).max(180).nullable().optional(),
  is_accessible: z.coerce.boolean().optional(),
  is_active: z.coerce.boolean().optional(),
});

const navigationEdgeSchema = z.object({
  from_node_id: uuid,
  to_node_id: uuid,
  kind: z.enum(['corridor', 'stairs', 'elevator', 'ramp', 'door', 'outdoor', 'service']),
  distance_m: z.coerce.number().min(0).max(5000).optional(),
  bidirectional: z.coerce.boolean().optional(),
  is_accessible: z.coerce.boolean().optional(),
  is_active: z.coerce.boolean().optional(),
});

const geofenceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  target_type: z.enum(['room', 'office', 'building', 'qr_node']),
  target_id: uuid,
  center_lat: z.coerce.number().min(-90).max(90).nullable().optional(),
  center_lng: z.coerce.number().min(-180).max(180).nullable().optional(),
  radius_m: z.coerce.number().min(1).max(2000),
  purpose: z.enum(['presence', 'queue_join', 'check_in', 'navigation']).optional(),
  is_active: z.coerce.boolean().optional(),
});

const courseSchema = z.object({
  code: z.string().trim().min(2).max(20).toUpperCase(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).nullable().optional(),
  credits: z.coerce.number().int().min(1).max(30).optional(),
  department: z.string().trim().min(2).max(120),
  level: z.enum(['foundation', 'undergraduate', 'postgraduate']).optional(),
  colour: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  is_active: z.coerce.boolean().optional(),
});

const termSchema = z.object({
  code: z.string().trim().min(3).max(20).toUpperCase(),
  name: z.string().trim().min(3).max(80),
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ends_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  is_current: z.coerce.boolean().optional(),
});

const officeSchema = z.object({
  code: z.string().trim().min(2).max(20).toUpperCase(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(600).nullable().optional(),
  building_id: uuid,
  floor_id: uuid,
  room_id: uuid.nullable().optional(),
  ticket_prefix: z.string().trim().min(1).max(6).toUpperCase(),
  service_duration_minutes: z.coerce.number().int().min(1).max(240).optional(),
  concurrent_capacity: z.coerce.number().int().min(1).max(20).optional(),
  daily_capacity: z.coerce.number().int().min(1).max(1000).optional(),
  check_in_radius_m: z.coerce.number().min(5).max(2000).optional(),
  grace_period_seconds: z.coerce.number().int().min(0).max(3600).optional(),
  requires_proximity_to_request: z.coerce.boolean().optional(),
  requires_appointment: z.coerce.boolean().optional(),
  contact_email: z.string().trim().email().nullable().optional(),
  contact_phone: z.string().trim().max(40).nullable().optional(),
  is_active: z.coerce.boolean().optional(),
});

const serviceWindowSchema = z.object({
  office_id: uuid,
  day_of_week: z.coerce.number().int().min(1).max(7),
  opens_at: z.string().regex(/^\d{2}:\d{2}$/),
  closes_at: z.string().regex(/^\d{2}:\d{2}$/),
  capacity: z.coerce.number().int().min(1).max(500).optional(),
  avg_service_minutes: z.coerce.number().int().min(1).max(240).optional(),
  is_active: z.coerce.boolean().optional(),
});

const queueSchema = z.object({
  is_active: z.coerce.boolean().optional(),
  max_size: z.coerce.number().int().min(1).max(500).optional(),
  admission_capacity: z.coerce.number().int().min(1).max(50).optional(),
  avg_service_seconds: z.coerce.number().int().min(30).max(86_400).optional(),
  proximity_radius_m: z.coerce.number().min(5).max(2000).optional(),
  requires_proximity_to_join: z.coerce.boolean().optional(),
  check_in_window_seconds: z.coerce.number().int().min(30).max(7200).optional(),
  grace_period_seconds: z.coerce.number().int().min(0).max(3600).optional(),
  max_active_tickets_per_student: z.coerce.number().int().min(1).max(10).optional(),
  opens_at: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  closes_at: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  notes: z.string().trim().max(400).nullable().optional(),
});

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  /* --------------------------------------------------------------- dashboards */

  app.get('/admin/dashboard', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requireRole(ctx, 'admin');
    const [kpis, overview] = await Promise.all([dashboardKpis(ctx.db), analyticsOverview(ctx.db)]);
    const liveQueues = await ctx.db.query(
      `SELECT q.id AS queue_id, r.code AS room_code, r.name AS room_name, b.code AS building_code, f.name AS floor_name,
              q.is_active, q.admission_capacity,
              (SELECT count(*)::int FROM queue_tickets t WHERE t.queue_id = q.id AND t.status IN ('QUEUE_PENDING','WAITING')) AS waiting,
              (SELECT count(*)::int FROM queue_tickets t WHERE t.queue_id = q.id AND t.status IN ('CALLED','CHECK_IN_WINDOW','CHECKED_IN','ADMITTED')) AS occupying
         FROM room_queues q
         JOIN rooms r ON r.id = q.room_id
         JOIN buildings b ON b.id = r.building_id
         JOIN floors f ON f.id = r.floor_id
        ORDER BY waiting DESC, r.code LIMIT 8`,
    );
    const recentAudit = await ctx.db.query(
      `SELECT a.id, a.action, a.entity_type, a.entity_id, a.metadata, a.created_at, u.name AS actor_name, u.role_code
         FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
        ORDER BY a.created_at DESC LIMIT 12`,
    );
    const buildingStatus = await ctx.db.query(
      `SELECT id, code, name, status, is_public FROM buildings ORDER BY code`,
    );

    return ok(reply, { kpis, overview, live_queues: liveQueues, recent_audit: recentAudit, buildings: buildingStatus });
  });

  app.get('/admin/analytics', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requirePermission(ctx, 'analytics.view');
    return ok(reply, await analyticsOverview(ctx.db));
  });

  app.get('/admin/audit-logs', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requirePermission(ctx, 'analytics.view');
    const query = parse(
      z.object({
        page: z.coerce.number().int().min(1).default(1),
        per_page: z.coerce.number().int().min(1).max(100).default(30),
        action: z.string().trim().max(60).optional(),
      }),
      request.query ?? {},
    );
    const where = query.action ? 'WHERE a.action LIKE $1' : '';
    const values = query.action ? [`${query.action}%`] : [];
    const totalRow = await ctx.db.one<{ total: string }>(`SELECT count(*)::text AS total FROM audit_logs a ${where}`, values);
    const rows = await ctx.db.query(
      `SELECT a.id, a.action, a.entity_type, a.entity_id, a.metadata, a.ip, a.created_at,
              u.name AS actor_name, u.role_code
         FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
         ${where}
        ORDER BY a.created_at DESC LIMIT ${query.per_page} OFFSET ${(query.page - 1) * query.per_page}`,
      values,
    );
    return ok(reply, paginate(rows, Number(totalRow?.total ?? 0), query.page, query.per_page));
  });

  /* ------------------------------------------------------------ user management */

  app.get('/admin/users', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requirePermission(ctx, 'users.manage');
    const query = parse(
      z.object({
        page: z.coerce.number().int().min(1).default(1),
        per_page: z.coerce.number().int().min(1).max(100).default(25),
        role: z.enum(['visitor', 'student', 'staff', 'admin']).optional(),
        status: z.enum(['active', 'pending', 'suspended']).optional(),
        q: z.string().trim().max(120).optional(),
      }),
      request.query ?? {},
    );

    const where: string[] = [];
    const values: unknown[] = [];
    if (query.role) {
      values.push(query.role);
      where.push(`role_code = $${values.length}`);
    }
    if (query.status) {
      values.push(query.status);
      where.push(`status = $${values.length}`);
    }
    if (query.q) {
      values.push(`%${query.q.toLowerCase()}%`);
      where.push(`(lower(name) LIKE $${values.length} OR lower(email) LIKE $${values.length} OR lower(coalesce(registration_no,'')) LIKE $${values.length})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const totalRow = await ctx.db.one<{ total: string }>(`SELECT count(*)::text AS total FROM users ${whereSql}`, values);
    const users = await ctx.db.query(
      `SELECT id, name, email, role_code, status, registration_no, department, phone, last_login_at, created_at,
              (SELECT count(*)::int FROM staff_assignments s WHERE s.user_id = users.id) AS assignments
         FROM users ${whereSql}
        ORDER BY created_at DESC LIMIT ${query.per_page} OFFSET ${(query.page - 1) * query.per_page}`,
      values,
    );
    const counts = await ctx.db.query<{ role_code: string; count: string }>(
      `SELECT role_code, count(*)::text AS count FROM users GROUP BY role_code`,
    );

    return ok(reply, {
      ...paginate(users, Number(totalRow?.total ?? 0), query.page, query.per_page),
      by_role: Object.fromEntries(counts.map((row) => [row.role_code, Number(row.count)])),
      roles: ROLES,
    });
  });

  app.post('/admin/users', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requirePermission(ctx, 'users.manage');
    const input = parseBody(
      z.object({
        name: z.string().trim().min(2).max(120),
        email: z.string().trim().toLowerCase().email(),
        role_code: z.enum(['visitor', 'student', 'staff', 'admin']),
        password: z.string().min(10).max(200).optional(),
        registration_no: z.string().trim().max(40).nullable().optional(),
        department: z.string().trim().max(120).nullable().optional(),
        phone: z.string().trim().max(40).nullable().optional(),
        assignments: z
          .array(
            z.object({
              scope_type: z.enum(['building', 'room', 'office', 'queue']),
              scope_id: uuid,
              role_in_scope: z.string().trim().max(40).optional(),
              can_manage_timetable: z.coerce.boolean().optional(),
              can_publish_content: z.coerce.boolean().optional(),
              can_call_tickets: z.coerce.boolean().optional(),
            }),
          )
          .optional(),
      }),
      request.body ?? {},
    );

    const existing = await ctx.db.one('SELECT id FROM users WHERE lower(email) = $1', [input.email]);
    if (existing) throw ApiError.validation({ email: ['That email address is already registered.'] });

    // A generated password is returned once when the administrator does not set one.
    const generated = input.password ?? randomBytes(9).toString('base64url');
    const hash = await hashPassword(generated);

    const user = await ctx.db.one<{ id: string }>(
      `INSERT INTO users (name, email, password_hash, role_code, registration_no, department, phone, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'active') RETURNING id`,
      [
        input.name,
        input.email,
        hash,
        input.role_code,
        input.registration_no ?? null,
        input.department ?? null,
        input.phone ?? null,
      ],
    );

    for (const assignment of input.assignments ?? []) {
      await ctx.db.query(
        `INSERT INTO staff_assignments (user_id, scope_type, scope_id, role_in_scope, can_manage_timetable, can_publish_content, can_call_tickets)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
        [
          user!.id,
          assignment.scope_type,
          assignment.scope_id,
          assignment.role_in_scope ?? 'operator',
          assignment.can_manage_timetable ?? false,
          assignment.can_publish_content ?? false,
          assignment.can_call_tickets ?? true,
        ],
      );
    }

    await audit(ctx, 'user.created', { type: 'user', id: user!.id, metadata: { role: input.role_code, by: principal.id } });
    return created(reply, { user: { id: user!.id, email: input.email, role_code: input.role_code }, password: input.password ? undefined : generated }, 'User created.');
  });

  app.patch('/admin/users/:id', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requirePermission(ctx, 'users.manage');
    const { id } = request.params as { id: string };
    const input = parse(
      z.object({
        name: z.string().trim().min(2).max(120).optional(),
        role_code: z.enum(['visitor', 'student', 'staff', 'admin']).optional(),
        status: z.enum(['active', 'pending', 'suspended']).optional(),
        registration_no: z.string().trim().max(40).nullable().optional(),
        department: z.string().trim().max(120).nullable().optional(),
        phone: z.string().trim().max(40).nullable().optional(),
      }),
      request.body ?? {},
    );
    const columns = Object.keys(input);
    if (columns.length === 0) throw ApiError.badRequest('No changes were provided.');
    if (id === principal.id && input.role_code && input.role_code !== 'admin') {
      throw ApiError.conflict('You cannot remove your own administrator role.', 'SELF_DEMOTION_BLOCKED');
    }

    const user = await ctx.db.one(
      `UPDATE users SET ${columns.map((column, index) => `${column} = $${index + 2}`).join(', ')}, updated_at = now()
        WHERE id = $1 RETURNING id, name, email, role_code, status, department, registration_no`,
      [id, ...columns.map((column) => (input as Record<string, unknown>)[column])],
    );
    if (!user) throw ApiError.notFound('User not found.');

    if (input.role_code || input.status === 'suspended') {
      await ctx.db.query('UPDATE api_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [id]);
    }
    await audit(ctx, 'user.updated', { type: 'user', id, metadata: input });
    return ok(reply, { user }, 'User updated.');
  });

  app.post('/admin/users/:id/reset-password', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requirePermission(ctx, 'users.manage');
    const { id } = request.params as { id: string };
    const user = await ctx.db.one<{ id: string; email: string }>('SELECT id, email FROM users WHERE id = $1', [id]);
    if (!user) throw ApiError.notFound('User not found.');

    const token = generateToken();
    await ctx.db.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + interval '60 minutes')`,
      [user.id, token.hash],
    );
    await ctx.db.query('UPDATE api_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [user.id]);
    await audit(ctx, 'user.password_reset_issued', { type: 'user', id });

    // The plaintext token is returned once so an administrator can hand it over securely.
    return ok(reply, { reset_token: token.plain, expires_in_minutes: 60 }, 'Password reset link generated.');
  });

  app.delete('/admin/users/:id', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requirePermission(ctx, 'users.manage');
    const { id } = request.params as { id: string };
    if (principal.id === id) throw ApiError.conflict('You cannot delete your own account.', 'SELF_DELETE_BLOCKED');
    const deleted = await ctx.db.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (deleted.length === 0) throw ApiError.notFound('User not found.');
    await audit(ctx, 'user.deleted', { type: 'user', id });
    return noContent(reply);
  });

  /* --------------------------------------------------------- staff assignments */

  app.get('/admin/staff-assignments', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requirePermission(ctx, 'users.manage');
    const assignments = await ctx.db.query(
      `SELECT s.*, u.name AS user_name, u.email AS user_email,
              CASE s.scope_type
                WHEN 'building' THEN (SELECT name FROM buildings WHERE id = s.scope_id)
                WHEN 'room' THEN (SELECT name FROM rooms WHERE id = s.scope_id)
                WHEN 'office' THEN (SELECT name FROM administrative_offices WHERE id = s.scope_id)
                WHEN 'queue' THEN (SELECT r.name FROM room_queues q JOIN rooms r ON r.id = q.room_id WHERE q.id = s.scope_id)
              END AS scope_name
         FROM staff_assignments s JOIN users u ON u.id = s.user_id
        ORDER BY u.name, s.scope_type`,
    );
    return ok(reply, { assignments });
  });

  app.post('/admin/staff-assignments', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requirePermission(ctx, 'users.manage');
    const input = parse(
      z.object({
        user_id: uuid,
        scope_type: z.enum(['building', 'room', 'office', 'queue']),
        scope_id: uuid,
        role_in_scope: z.string().trim().max(40).optional(),
        can_manage_timetable: z.coerce.boolean().optional(),
        can_publish_content: z.coerce.boolean().optional(),
        can_call_tickets: z.coerce.boolean().optional(),
      }),
      request.body ?? {},
    );

    const assignment = await ctx.db.one(
      `INSERT INTO staff_assignments (user_id, scope_type, scope_id, role_in_scope, can_manage_timetable, can_publish_content, can_call_tickets)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (user_id, scope_type, scope_id) DO UPDATE
          SET role_in_scope = EXCLUDED.role_in_scope,
              can_manage_timetable = EXCLUDED.can_manage_timetable,
              can_publish_content = EXCLUDED.can_publish_content,
              can_call_tickets = EXCLUDED.can_call_tickets
       RETURNING *`,
      [
        input.user_id,
        input.scope_type,
        input.scope_id,
        input.role_in_scope ?? 'operator',
        input.can_manage_timetable ?? false,
        input.can_publish_content ?? false,
        input.can_call_tickets ?? true,
      ],
    );
    await audit(ctx, 'staff_assignment.upserted', { type: 'staff_assignment', id: String(assignment?.id), metadata: input });
    return created(reply, { assignment }, 'Assignment saved.');
  });

  app.delete('/admin/staff-assignments/:id', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requirePermission(ctx, 'users.manage');
    const { id } = request.params as { id: string };
    const deleted = await ctx.db.query('DELETE FROM staff_assignments WHERE id = $1 RETURNING id', [id]);
    if (deleted.length === 0) throw ApiError.notFound('Assignment not found.');
    await audit(ctx, 'staff_assignment.deleted', { type: 'staff_assignment', id });
    return noContent(reply);
  });

  /* --------------------------------------------------------------- academics */

  registerCrud(app, {
    resource: 'courses',
    table: 'courses',
    createSchema: courseSchema,
    updateSchema: courseSchema.partial(),
    permission: 'academics.manage',
    searchColumns: ['code', 'title', 'department'],
    orderBy: 'code ASC',
  });

  registerCrud(app, {
    resource: 'terms',
    table: 'terms',
    // `terms` is keyed by its human-readable code (e.g. 2026-FALL) rather than a uuid.
    idColumn: 'code',
    createSchema: termSchema,
    updateSchema: termSchema.partial(),
    permission: 'academics.manage',
    orderBy: 'starts_on DESC',
    afterWrite: async (db, row) => {
      if (row.is_current) {
        await db.query('UPDATE terms SET is_current = false WHERE code <> $1', [row.code]);
      }
    },
  });

  app.get('/admin/enrollments', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requirePermission(ctx, 'academics.manage');
    const query = parse(
      z.object({
        course_id: uuid.optional(),
        student_id: uuid.optional(),
        term: z.string().trim().max(20).optional(),
        page: z.coerce.number().int().min(1).default(1),
        per_page: z.coerce.number().int().min(1).max(200).default(50),
      }),
      request.query ?? {},
    );
    const where: string[] = [];
    const values: unknown[] = [];
    if (query.course_id) {
      values.push(query.course_id);
      where.push(`e.course_id = $${values.length}`);
    }
    if (query.student_id) {
      values.push(query.student_id);
      where.push(`e.student_id = $${values.length}`);
    }
    if (query.term) {
      values.push(query.term);
      where.push(`e.term_code = $${values.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const totalRow = await ctx.db.one<{ total: string }>(`SELECT count(*)::text AS total FROM enrollments e ${whereSql}`, values);
    const rows = await ctx.db.query(
      `SELECT e.id, e.term_code, e.status, e.group_code, e.created_at,
              u.id AS student_id, u.name AS student_name, u.registration_no,
              c.id AS course_id, c.code AS course_code, c.title AS course_title
         FROM enrollments e
         JOIN users u ON u.id = e.student_id
         JOIN courses c ON c.id = e.course_id
         ${whereSql}
        ORDER BY c.code, u.name LIMIT ${query.per_page} OFFSET ${(query.page - 1) * query.per_page}`,
      values,
    );
    return ok(reply, paginate(rows, Number(totalRow?.total ?? 0), query.page, query.per_page));
  });

  app.post('/admin/enrollments', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requirePermission(ctx, 'academics.manage');
    const input = parse(
      z.object({
        student_id: uuid,
        course_id: uuid,
        term_code: z.string().trim().max(20).optional(),
        group_code: z.string().trim().max(20).optional(),
      }),
      request.body ?? {},
    );
    const term =
      input.term_code ?? (await ctx.db.one<{ code: string }>('SELECT code FROM terms WHERE is_current ORDER BY starts_on DESC LIMIT 1'))?.code;
    if (!term) throw ApiError.unavailable('Configure an academic term first.');

    const enrollment = await ctx.db.one(
      `INSERT INTO enrollments (student_id, course_id, term_code, group_code) VALUES ($1,$2,$3,$4)
       ON CONFLICT (student_id, course_id, term_code) DO UPDATE SET status = 'enrolled'
       RETURNING *`,
      [input.student_id, input.course_id, term, input.group_code ?? null],
    );
    await audit(ctx, 'enrollment.created', { type: 'enrollment', id: String(enrollment?.id), metadata: input });
    return created(reply, { enrollment }, 'Student enrolled.');
  });

  app.delete('/admin/enrollments/:id', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requirePermission(ctx, 'academics.manage');
    const { id } = request.params as { id: string };
    const deleted = await ctx.db.query('DELETE FROM enrollments WHERE id = $1 RETURNING id', [id]);
    if (deleted.length === 0) throw ApiError.notFound('Enrollment not found.');
    await audit(ctx, 'enrollment.deleted', { type: 'enrollment', id });
    return noContent(reply);
  });

  /* -------------------------------------------------------- campus + spatial */

  registerCrud(app, {
    resource: 'buildings',
    table: 'buildings',
    createSchema: buildingSchema,
    updateSchema: buildingSchema.partial(),
    permission: 'campus.manage',
    searchColumns: ['code', 'name', 'campus_name'],
    orderBy: 'code ASC',
    selectExtra: `(SELECT count(*)::int FROM floors f WHERE f.building_id = buildings.id) AS floors_count`,
  });

  registerCrud(app, {
    resource: 'floors',
    table: 'floors',
    createSchema: floorSchema,
    updateSchema: floorSchema.partial(),
    permission: 'campus.manage',
    filterColumns: ['building_id'],
    orderBy: 'level ASC',
    selectExtra: `(SELECT count(*)::int FROM rooms r WHERE r.floor_id = floors.id) AS rooms_count`,
  });

  registerCrud(app, {
    resource: 'rooms',
    table: 'rooms',
    createSchema: roomSchema,
    updateSchema: roomSchema.partial(),
    permission: 'campus.manage',
    searchColumns: ['code', 'name'],
    filterColumns: ['building_id', 'floor_id', 'room_type', 'requires_admission', 'status'],
    orderBy: 'code ASC',
    selectExtra: `(SELECT json_build_object('id', q.id, 'is_active', q.is_active, 'max_size', q.max_size,
                              'requires_proximity_to_join', q.requires_proximity_to_join)
                     FROM room_queues q WHERE q.room_id = rooms.id) AS queue_config`,
  });

  registerCrud(app, {
    resource: 'qr-nodes',
    table: 'qr_nodes',
    createSchema: qrNodeSchema,
    updateSchema: qrNodeSchema.partial(),
    permission: 'spatial.manage',
    searchColumns: ['code', 'label'],
    filterColumns: ['building_id', 'floor_id', 'is_active'],
    orderBy: 'code ASC',
    hiddenColumns: ['secret'],
    beforeCreate: async (_db, values) => ({ ...values, secret: randomBytes(24).toString('base64url') }),
  });

  registerCrud(app, {
    resource: 'navigation-nodes',
    table: 'navigation_nodes',
    createSchema: navigationNodeSchema,
    updateSchema: navigationNodeSchema.partial(),
    permission: 'spatial.manage',
    searchColumns: ['code', 'label'],
    filterColumns: ['building_id', 'floor_id', 'kind'],
    orderBy: 'code ASC',
  });

  registerCrud(app, {
    resource: 'navigation-edges',
    table: 'navigation_edges',
    createSchema: navigationEdgeSchema,
    updateSchema: navigationEdgeSchema.partial(),
    permission: 'spatial.manage',
    filterColumns: ['kind', 'is_accessible'],
    orderBy: 'created_at DESC',
    beforeCreate: async (db, values) => {
      const from = await db.one<{ id: string; floor_id: string | null; plan_x: number | null; plan_y: number | null; lat: number | null; lng: number | null }>(
        'SELECT id, floor_id, plan_x, plan_y, lat, lng FROM navigation_nodes WHERE id = $1',
        [values.from_node_id as string],
      );
      const to = await db.one<{ id: string; floor_id: string | null; plan_x: number | null; plan_y: number | null; lat: number | null; lng: number | null }>(
        'SELECT id, floor_id, plan_x, plan_y, lat, lng FROM navigation_nodes WHERE id = $1',
        [values.to_node_id as string],
      );
      if (!from || !to) throw ApiError.validation({ from_node_id: ['Both nodes must exist.'] });
      if (from.id === to.id) throw ApiError.validation({ to_node_id: ['A node cannot connect to itself.'] });

      const floorChange = from.floor_id !== to.floor_id;
      let distance = Number(values.distance_m ?? 0);
      if (!values.distance_m || Number(values.distance_m) <= 0) {
        if (from.plan_x !== null && to.plan_x !== null && from.plan_y !== null && to.plan_y !== null && !floorChange) {
          distance = Math.round(planDistance({ x: Number(from.plan_x), y: Number(from.plan_y) }, { x: Number(to.plan_x), y: Number(to.plan_y) }) * 10) / 10;
        } else if (from.lat !== null && to.lat !== null && from.lng !== null && to.lng !== null) {
          distance = Math.round(distanceMeters({ lat: Number(from.lat), lng: Number(from.lng) }, { lat: Number(to.lat), lng: Number(to.lng) }) * 10) / 10;
        } else {
          distance = floorChange ? 15 : 10; // conservative default for vertical links
        }
      }
      return { ...values, distance_m: distance, floor_change: floorChange };
    },
  });

  registerCrud(app, {
    resource: 'geofences',
    table: 'geofences',
    createSchema: geofenceSchema,
    updateSchema: geofenceSchema.partial(),
    permission: 'spatial.manage',
    searchColumns: ['name'],
    filterColumns: ['target_type', 'purpose', 'is_active'],
    orderBy: 'name ASC',
  });

  app.get('/admin/qr-nodes/:id/payload', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requirePermission(ctx, 'spatial.manage');
    const { id } = request.params as { id: string };
    const node = await ctx.db.one<{ id: string; code: string; version: number; secret: string; label: string }>(
      'SELECT id, code, version, secret, label FROM qr_nodes WHERE id = $1',
      [id],
    );
    if (!node) throw ApiError.notFound('QR node not found.');
    const signature = signPayload(node.code, Number(node.version), node.secret);
    const payload = `CF1|${node.code}|${node.version}|${signature}`;
    return ok(reply, {
      payload,
      code: node.code,
      label: node.label,
      version: Number(node.version),
      // Signed payload + a human-readable fallback code that the scan screen also accepts.
      scan_url: `${process.env.APP_URL ?? ''}/scan?code=${encodeURIComponent(node.code)}`,
    });
  });

  app.post('/admin/qr-nodes/:id/regenerate', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requirePermission(ctx, 'spatial.manage');
    const { id } = request.params as { id: string };
    const node = await ctx.db.one<{ id: string; code: string; version: number }>(
      `UPDATE qr_nodes SET secret = $2, version = version + 1, updated_at = now()
        WHERE id = $1 RETURNING id, code, version`,
      [id, randomBytes(24).toString('base64url')],
    );
    if (!node) throw ApiError.notFound('QR node not found.');
    await audit(ctx, 'qr_node.regenerated', { type: 'qr_node', id, metadata: { version: node.version } });
    return ok(reply, { node, note: 'Previous printed codes no longer validate for this anchor.' }, 'QR secret rotated.');
  });

  /* ------------------------------------------------------------- queue config */

  app.get('/admin/queues', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requirePermission(ctx, 'queues.manage');
    const queues = await ctx.db.query(
      `SELECT q.*, r.code AS room_code, r.name AS room_name, r.capacity AS room_capacity,
              b.code AS building_code, f.name AS floor_name,
              (SELECT count(*)::int FROM queue_tickets t WHERE t.queue_id = q.id AND t.status IN ('QUEUE_PENDING','WAITING')) AS waiting
         FROM room_queues q
         JOIN rooms r ON r.id = q.room_id
         JOIN buildings b ON b.id = r.building_id
         JOIN floors f ON f.id = r.floor_id
        ORDER BY b.code, r.code`,
    );
    const roomsWithoutQueue = await ctx.db.query(
      `SELECT r.id, r.code, r.name, b.code AS building_code, r.requires_admission
         FROM rooms r JOIN buildings b ON b.id = r.building_id
        WHERE NOT EXISTS (SELECT 1 FROM room_queues q WHERE q.room_id = r.id)
        ORDER BY b.code, r.code LIMIT 100`,
    );
    return ok(reply, { queues, rooms_without_queue: roomsWithoutQueue });
  });

  app.post('/admin/rooms/:id/queue', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requirePermission(ctx, 'queues.manage');
    const { id } = request.params as { id: string };
    const input = parse(queueSchema, request.body ?? {});

    const room = await ctx.db.one<{ id: string; requires_admission: boolean }>('SELECT id, requires_admission FROM rooms WHERE id = $1', [id]);
    if (!room) throw ApiError.notFound('Room not found.');

    const queue = await ctx.db.one(
      `INSERT INTO room_queues (room_id, is_active, max_size, admission_capacity, avg_service_seconds,
                                proximity_radius_m, requires_proximity_to_join, check_in_window_seconds,
                                grace_period_seconds, max_active_tickets_per_student, opens_at, closes_at, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (room_id) DO UPDATE SET updated_at = now()
       RETURNING *`,
      [
        id,
        input.is_active ?? true,
        input.max_size ?? Math.max(10, 4),
        input.admission_capacity ?? 1,
        input.avg_service_seconds ?? 300,
        input.proximity_radius_m ?? 120,
        input.requires_proximity_to_join ?? true,
        input.check_in_window_seconds ?? 300,
        input.grace_period_seconds ?? 180,
        input.max_active_tickets_per_student ?? 3,
        input.opens_at ?? null,
        input.closes_at ?? null,
        input.notes ?? null,
      ],
    );
    await ctx.db.query('UPDATE rooms SET requires_admission = true, updated_at = now() WHERE id = $1', [id]);
    await audit(ctx, 'queue.created', { type: 'room_queue', id: String(queue?.id) });
    return created(reply, { queue }, 'Admission queue configured for this room.');
  });

  // Queue configuration is managed through the room-scoped upsert above plus these two
  // endpoints, so `GET /admin/queues` stays the enriched listing (room + building joins).
  app.patch('/admin/queues/:id', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requirePermission(ctx, 'queues.manage');
    const { id } = request.params as { id: string };
    const input = parse(queueSchema.partial(), request.body ?? {});
    const columns = Object.keys(input).filter((column) => column !== 'id');
    if (columns.length === 0) throw ApiError.badRequest('No queue settings were provided.');

    const queue = await ctx.db.one(
      `UPDATE room_queues SET ${columns.map((column, index) => `${column} = $${index + 2}`).join(', ')}, updated_at = now()
        WHERE id = $1 RETURNING *`,
      [id, ...columns.map((column) => (input as Record<string, unknown>)[column])],
    );
    if (!queue) throw ApiError.notFound('Queue not found.');
    await audit(ctx, 'queue.updated', { type: 'room_queue', id, metadata: input });
    return ok(reply, { queue }, 'Queue settings updated.');
  });

  app.delete('/admin/queues/:id', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requirePermission(ctx, 'queues.manage');
    const { id } = request.params as { id: string };
    const active = await ctx.db.one<{ active: number }>(
      `SELECT count(*)::int AS active FROM queue_tickets
        WHERE queue_id = $1 AND status NOT IN ('COMPLETED','CANCELLED','NO_SHOW','EXPIRED')`,
      [id],
    );
    if ((active?.active ?? 0) > 0) {
      throw ApiError.conflict('This queue still has active tickets. Close it instead of deleting it.', 'QUEUE_HAS_ACTIVE_TICKETS');
    }
    const deleted = await ctx.db.one('DELETE FROM room_queues WHERE id = $1 RETURNING room_id', [id]);
    if (!deleted) throw ApiError.notFound('Queue not found.');
    await ctx.db.query('UPDATE rooms SET requires_admission = false, updated_at = now() WHERE id = $1', [(deleted as { room_id: string }).room_id]);
    await audit(ctx, 'queue.deleted', { type: 'room_queue', id });
    return noContent(reply);
  });

  /* ------------------------------------------------------------ office config */

  registerCrud(app, {
    resource: 'offices',
    table: 'administrative_offices',
    createSchema: officeSchema,
    updateSchema: officeSchema.partial(),
    permission: 'offices.manage',
    searchColumns: ['code', 'name'],
    filterColumns: ['building_id', 'is_active'],
    orderBy: 'name ASC',
    selectExtra: `(SELECT count(*)::int FROM office_service_windows w WHERE w.office_id = administrative_offices.id) AS windows_count`,
  });

  registerCrud(app, {
    resource: 'office-service-windows',
    table: 'office_service_windows',
    createSchema: serviceWindowSchema,
    updateSchema: serviceWindowSchema.partial(),
    permission: 'offices.manage',
    filterColumns: ['office_id', 'day_of_week', 'is_active'],
    orderBy: 'day_of_week ASC, opens_at ASC',
  });

  app.get('/admin/office-staff', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requirePermission(ctx, 'offices.manage');
    const rows = await ctx.db.query(
      `SELECT s.office_id, s.user_id, s.role, s.is_primary, u.name AS user_name, u.email AS user_email, o.name AS office_name
         FROM office_staff s JOIN users u ON u.id = s.user_id JOIN administrative_offices o ON o.id = s.office_id
        ORDER BY o.name, u.name`,
    );
    return ok(reply, { staff: rows });
  });

  app.post('/admin/office-staff', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requirePermission(ctx, 'offices.manage');
    const input = parse(
      z.object({ office_id: uuid, user_id: uuid, role: z.enum(['officer', 'supervisor']).default('officer'), is_primary: z.coerce.boolean().default(false) }),
      request.body ?? {},
    );
    const row = await ctx.db.one(
      `INSERT INTO office_staff (office_id, user_id, role, is_primary) VALUES ($1,$2,$3,$4)
       ON CONFLICT (office_id, user_id) DO UPDATE SET role = EXCLUDED.role, is_primary = EXCLUDED.is_primary
       RETURNING *`,
      [input.office_id, input.user_id, input.role, input.is_primary],
    );
    await audit(ctx, 'office_staff.upserted', { type: 'office', id: input.office_id });
    return created(reply, { staff: row }, 'Office staff saved.');
  });

  app.delete('/admin/office-staff/:officeId/:userId', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requirePermission(ctx, 'offices.manage');
    const { officeId, userId } = request.params as { officeId: string; userId: string };
    await ctx.db.query('DELETE FROM office_staff WHERE office_id = $1 AND user_id = $2', [officeId, userId]);
    await audit(ctx, 'office_staff.removed', { type: 'office', id: officeId });
    return noContent(reply);
  });

  /* ------------------------------------------------------------- spatial map */

  app.get('/admin/map', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requirePermission(ctx, 'spatial.manage');
    const [buildings, nodes, edges, geofences, qrNodes] = await Promise.all([
      ctx.db.query('SELECT id, code, name, lat, lng, footprint, status FROM buildings ORDER BY code'),
      ctx.db.query(
        `SELECT n.id, n.code, n.label, n.kind, n.plan_x, n.plan_y, n.lat, n.lng, n.is_accessible, n.is_active,
                n.floor_id, n.building_id, f.level AS floor_level, f.name AS floor_name, b.code AS building_code
           FROM navigation_nodes n
           LEFT JOIN floors f ON f.id = n.floor_id
           LEFT JOIN buildings b ON b.id = n.building_id`,
      ),
      ctx.db.query(
        `SELECT e.id, e.from_node_id, e.to_node_id, e.kind, e.distance_m, e.bidirectional, e.is_accessible,
                e.is_active, e.floor_change
           FROM navigation_edges e`,
      ),
      ctx.db.query('SELECT * FROM geofences ORDER BY name'),
      ctx.db.query(
        `SELECT q.id, q.code, q.label, q.plan_x, q.plan_y, q.lat, q.lng, q.version, q.is_active, q.floor_id,
                q.scans_count, q.last_scanned_at
           FROM qr_nodes q ORDER BY q.code`,
      ),
    ]);
    return ok(reply, { buildings, nodes, edges, geofences, qr_nodes: qrNodes });
  });

  /* --------------------------------------------------------------- settings */

  app.get('/admin/settings', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requireRole(ctx, 'admin');
    const settings = await ctx.db.query('SELECT key, value, updated_at FROM settings ORDER BY key');
    return ok(reply, { settings });
  });

  app.patch('/admin/settings/:key', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requireRole(ctx, 'admin');
    const { key } = request.params as { key: string };
    const input = parse(z.object({ value: z.unknown() }), request.body ?? {});
    const row = await ctx.db.one(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
       RETURNING key, value, updated_at`,
      [key, JSON.stringify(input.value)],
    );
    await audit(ctx, 'setting.updated', { type: 'setting', id: key, metadata: { value: input.value } });
    return ok(reply, { setting: row }, 'Setting saved.');
  });

  /* ------------------------------------------- timetable overview (read-only) */

  app.get('/admin/timetable', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requirePermission(ctx, 'academics.manage');
    const query = parse(
      z.object({
        course_id: uuid.optional(),
        room_id: uuid.optional(),
        staff_id: uuid.optional(),
        day_of_week: z.coerce.number().int().min(1).max(7).optional(),
        term: z.string().trim().max(20).optional(),
      }),
      request.query ?? {},
    );
    const where: string[] = [];
    const values: unknown[] = [];
    for (const [column, value] of Object.entries({
      't.course_id': query.course_id,
      't.room_id': query.room_id,
      't.staff_id': query.staff_id,
      't.day_of_week': query.day_of_week,
      't.term_code': query.term,
    })) {
      if (value === undefined) continue;
      values.push(value);
      where.push(`${column} = $${values.length}`);
    }
    const rows = await ctx.db.query(
      `SELECT t.id, t.day_of_week, to_char(t.starts_at, 'HH24:MI') AS starts_at, to_char(t.ends_at, 'HH24:MI') AS ends_at,
              t.session_type, t.term_code, c.code AS course_code, c.title AS course_title,
              r.code AS room_code, r.name AS room_name, b.code AS building_code,
              u.name AS lecturer,
              (SELECT count(*)::int FROM enrollments e WHERE e.course_id = t.course_id AND e.term_code = t.term_code AND e.status = 'enrolled') AS enrolled
         FROM timetable_entries t
         JOIN courses c ON c.id = t.course_id
         LEFT JOIN rooms r ON r.id = t.room_id
         LEFT JOIN buildings b ON b.id = r.building_id
         LEFT JOIN users u ON u.id = t.staff_id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY t.day_of_week, t.starts_at LIMIT 300`,
      values,
    );
    return ok(reply, { entries: rows });
  });
}
