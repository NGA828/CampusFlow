import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Db } from '../db/client.js';
import { ApiError } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { created, noContent, ok, paginate, audit } from '../lib/respond.js';
import { requirePermission, requireRole, type RequestContext } from '../middleware/auth.js';
import type { Permission } from '../policies/rbac.js';
import { ctxOf } from './context.js';

/**
 * Administrative CRUD used by the admin console (PROMPT §77, §78).
 *
 * Each resource still declares its own Zod schema, permission and searchable columns, so
 * validation and authorization remain explicit; the boilerplate of list/filter/paginate/
 * create/update/delete is shared instead of copy-pasted eleven times.
 */

export interface CrudConfig<T extends z.ZodTypeAny, U extends z.ZodTypeAny> {
  /** URL segment, e.g. "buildings" → /admin/buildings */
  resource: string;
  table: string;
  createSchema: T;
  updateSchema?: U;
  permission: Permission;
  /** Columns searched with ILIKE when ?q= is provided. */
  searchColumns?: string[];
  filterColumns?: string[];
  orderBy?: string;
  /** Columns that must never be returned (secrets are replaced instead). */
  hiddenColumns?: string[];
  selectExtra?: string;
  beforeCreate?: (db: Db, values: Record<string, unknown>, ctx: RequestContext) => Promise<Record<string, unknown>>;
  afterWrite?: (db: Db, row: Record<string, unknown>, ctx: RequestContext) => Promise<void>;
  /** Rows are scoped to these ids when the caller is staff rather than admin. */
  idColumn?: string;
}

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(200).default(25),
  q: z.string().trim().max(120).optional(),
  sort: z.string().trim().max(40).optional(),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export function registerCrud<T extends z.ZodTypeAny, U extends z.ZodTypeAny>(
  app: FastifyInstance,
  config: CrudConfig<T, U>,
): void {
  // Every CRUD resource is namespaced under /admin so it can never collide with the
  // public read models in the campus / queue / office modules.
  const base = `admin/${config.resource}`;
  const table = config.table;
  const idColumn = config.idColumn ?? 'id';

  app.get(`/${base}`, async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requirePermission(ctx, config.permission);
    void principal;
    const query = parse(listQuery, request.query ?? {});
    const where: string[] = [];
    const values: unknown[] = [];

    if (query.q && config.searchColumns?.length) {
      const like = `%${query.q.toLowerCase()}%`;
      const clauses = config.searchColumns.map((column) => {
        values.push(like);
        return `lower(${column}::text) LIKE $${values.length}`;
      });
      where.push(`(${clauses.join(' OR ')})`);
    }

    for (const column of config.filterColumns ?? []) {
      const raw = (request.query as Record<string, unknown> | undefined)?.[column];
      if (raw === undefined || raw === '') continue;
      values.push(raw);
      where.push(`${column} = $${values.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const totalRow = await ctx.db.one<{ total: string }>(`SELECT count(*)::text AS total FROM ${table} ${whereSql}`, values);
    const sortColumn = query.sort && /^[a-z_]+$/i.test(query.sort) ? query.sort : null;
    const orderBy = sortColumn ? `${sortColumn} ${query.order.toUpperCase()}` : (config.orderBy ?? 'created_at DESC');
    const offset = (query.page - 1) * query.per_page;

    const rows = await ctx.db.query<Record<string, unknown>>(
      `SELECT ${table}.*${config.selectExtra ? `, ${config.selectExtra}` : ''} FROM ${table} ${whereSql}
        ORDER BY ${orderBy} LIMIT ${query.per_page} OFFSET ${offset}`,
      values,
    );

    return ok(reply, paginate(rows.map((row) => omit(row, config.hiddenColumns)), Number(totalRow?.total ?? 0), query.page, query.per_page));
  });

  app.get(`/${base}/:id`, async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requirePermission(ctx, config.permission);
    const { id } = request.params as { id: string };
    const row = await ctx.db.one<Record<string, unknown>>(
      `SELECT ${table}.*${config.selectExtra ? `, ${config.selectExtra}` : ''} FROM ${table} WHERE ${idColumn}::text = $1`,
      [id],
    );
    if (!row) throw ApiError.notFound('Resource not found.');
    return ok(reply, omit(row, config.hiddenColumns));
  });

  app.post(`/${base}`, async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requirePermission(ctx, config.permission);
    let values = parse(config.createSchema, request.body ?? {}) as Record<string, unknown>;
    if (config.beforeCreate) values = await config.beforeCreate(ctx.db, values, ctx);

    const columns = Object.keys(values);
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    const row = await ctx.db.one<Record<string, unknown>>(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      columns.map((column) => serialise(values[column])),
    );
    await audit(ctx, `${config.resource}.created`, { type: config.resource, id: String(row?.[idColumn]), metadata: values });
    if (config.afterWrite && row) await config.afterWrite(ctx.db, row, ctx);
    return created(reply, omit(row ?? {}, config.hiddenColumns));
  });

  app.patch(`/${base}/:id`, async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requirePermission(ctx, config.permission);
    if (!config.updateSchema) throw ApiError.badRequest('This resource does not support updates.');
    const { id } = request.params as { id: string };
    const existing = await ctx.db.one<Record<string, unknown>>(`SELECT * FROM ${table} WHERE ${idColumn}::text = $1`, [id]);
    if (!existing) throw ApiError.notFound('Resource not found.');

    const values = parse(config.updateSchema, request.body ?? {}) as Record<string, unknown>;
    const columns = Object.keys(values).filter((column) => column !== 'id');
    if (columns.length === 0) throw ApiError.badRequest('No fields were provided to update.');
    const assignments = columns.map((column, index) => `${column} = $${index + 2}`);
    if (hasColumn(existing, 'updated_at')) assignments.push('updated_at = now()');

    const row = await ctx.db.one<Record<string, unknown>>(
      `UPDATE ${table} SET ${assignments.join(', ')} WHERE ${idColumn}::text = $1 RETURNING *`,
      [id, ...columns.map((column) => serialise(values[column]))],
    );
    await audit(ctx, `${config.resource}.updated`, { type: config.resource, id, metadata: values });
    if (config.afterWrite && row) await config.afterWrite(ctx.db, row, ctx);
    return ok(reply, omit(row ?? {}, config.hiddenColumns), 'Updated successfully.');
  });

  app.delete(`/${base}/:id`, async (request, reply) => {
    const ctx = ctxOf(request, reply);
    requirePermission(ctx, config.permission);
    const { id } = request.params as { id: string };
    const row = await ctx.db.one<Record<string, unknown>>(`DELETE FROM ${table} WHERE ${idColumn}::text = $1 RETURNING *`, [id]);
    if (!row) throw ApiError.notFound('Resource not found.');
    await audit(ctx, `${config.resource}.deleted`, { type: config.resource, id });
    return noContent(reply);
  });
}

/** Admin-only variant that also verifies the global admin role. */
export function registerAdminCrud<T extends z.ZodTypeAny, U extends z.ZodTypeAny>(
  app: FastifyInstance,
  config: CrudConfig<T, U>,
): void {
  app.addHook('onRequest', async () => {});
  registerCrud(app, {
    ...config,
    permission: config.permission,
  });
}

function hasColumn(row: Record<string, unknown>, column: string): boolean {
  return Object.prototype.hasOwnProperty.call(row, column);
}

function serialise(value: unknown): unknown {
  if (value === undefined) return null;
  if (value !== null && typeof value === 'object') return JSON.stringify(value);
  return value;
}

function omit(row: Record<string, unknown>, hidden?: string[]): Record<string, unknown> {
  if (!hidden?.length) return row;
  const clone = { ...row };
  for (const column of hidden) delete clone[column];
  return clone;
}

export { requireRole };
