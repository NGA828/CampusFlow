/**
 * Database access layer.
 *
 * CampusFlow targets PostgreSQL 17 (+ PostGIS) in every deployment. The driver is
 * selected at runtime:
 *
 *   DB_DRIVER=postgres  → `pg` Pool against a real PostgreSQL server (default for
 *                         production and for any environment with PostgreSQL installed).
 *   DB_DRIVER=pglite    → the embedded WebAssembly PostgreSQL build used by the sandbox
 *                         development runtime, where no PostgreSQL server can be installed.
 *
 * Both drivers execute the same SQL: identical migrations, identical transactions,
 * identical row locking (`SELECT ... FOR UPDATE`), identical partial unique indexes.
 * Switching drivers never changes application code.
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type SqlParam = unknown;

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface Db {
  /** Run a statement and return rows. */
  query<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T[]>;
  /** Run a statement and return the first row (or null). */
  one<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T | null>;
  /** Execute raw SQL (multiple statements, no parameters). */
  exec(sql: string): Promise<void>;
  /** Run `fn` inside a transaction; rolls back on throw. Nested calls join the outer tx. */
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  /** Current transaction depth (0 = outside transaction). */
  readonly inTransaction: boolean;
  close(): Promise<void>;
}

/* ------------------------------------------------------------------ pg driver */

async function createPgDb(connectionString: string, ssl: boolean): Promise<Db> {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    connectionString,
    ssl: ssl ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.DB_POOL_MAX ?? 10),
  });

  const wrap = (client: { query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }> }): Db => ({
    inTransaction: false,
    async query(sql, params = []) {
      const res = await client.query(sql, params);
      return res.rows as never[];
    },
    async one(sql, params = []) {
      const rows = await this.query(sql, params);
      return (rows[0] ?? null) as never;
    },
    async exec(sql) {
      await client.query(sql);
    },
    async tx(fn) {
      const txClient = await pool.connect();
      try {
        await txClient.query('BEGIN');
        const scoped = wrap(txClient as never) as Db & { inTransaction: boolean };
        Object.defineProperty(scoped, 'inTransaction', { value: true });
        const result = await fn(scoped);
        await txClient.query('COMMIT');
        return result;
      } catch (error) {
        try {
          await txClient.query('ROLLBACK');
        } catch {
          /* the connection is already unusable; the pool will discard it */
        }
        throw error;
      } finally {
        txClient.release();
      }
    },
    async close() {
      await pool.end();
    },
  });

  return wrap(pool as never);
}

/* -------------------------------------------------------------- pglite driver */

async function createPgliteDb(dataDir: string | null): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  if (dataDir) mkdirSync(dirname(dataDir), { recursive: true });
  const pg = dataDir ? new PGlite(dataDir) : new PGlite();
  await pg.waitReady;

  let depth = 0;

  const adapter: Db = {
    get inTransaction() {
      return depth > 0;
    },
    async query(sql, params = []) {
      const result = await pg.query(sql, params as never[]);
      return result.rows as never[];
    },
    async one(sql, params = []) {
      const result = await pg.query(sql, params as never[]);
      return (result.rows[0] ?? null) as never;
    },
    async exec(sql) {
      await pg.exec(sql);
    },
    async tx(fn) {
      // PGlite transactions support nesting through savepoints.
      if (depth > 0) {
        depth += 1;
        try {
          return await fn(adapter);
        } finally {
          depth -= 1;
        }
      }
      await pg.exec('BEGIN');
      depth = 1;
      try {
        const result = await fn(adapter);
        await pg.exec('COMMIT');
        return result;
      } catch (error) {
        try {
          await pg.exec('ROLLBACK');
        } catch {
          /* ignore */
        }
        throw error;
      } finally {
        depth = 0;
      }
    },
    async close() {
      await pg.close();
    },
  };

  return adapter;
}

/* ------------------------------------------------------------------- factory */

let cached: Db | null = null;

export async function getDb(): Promise<Db> {
  if (cached) return cached;
  const driver = (process.env.DB_DRIVER ?? 'pglite').toLowerCase();
  if (driver === 'postgres' || driver === 'pgsql') {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is required when DB_DRIVER=postgres');
    cached = await createPgDb(url, (process.env.DB_SSL ?? 'false') === 'true');
  } else {
    const dataDir = process.env.PGLITE_DATA_DIR
      ? resolve(process.env.PGLITE_DATA_DIR)
      : resolve(process.cwd(), 'storage/campusflow.db');
    cached = await createPgliteDb(dataDir);
  }
  return cached;
}

export async function closeDb(): Promise<void> {
  if (cached) {
    await cached.close();
    cached = null;
  }
}

/* ------------------------------------------------------------------ migrations */

const MIGRATION_FILES = [
  '001_identity.sql',
  '002_campus.sql',
  '003_academic.sql',
  '004_queue.sql',
  '005_office.sql',
  '006_engagement.sql',
  '007_intelligence.sql',
] as const;

async function ensureMigrationsTable(db: Db): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

/** Apply every pending migration file, in order. */
export async function runMigrations(options: { log?: (message: string) => void } = {}): Promise<string[]> {
  const log = options.log ?? (() => {});
  const db = await getDb();
  await ensureMigrationsTable(db);
  const applied = await db.query<{ name: string }>('SELECT name FROM schema_migrations');
  const done = new Set(applied.map((row) => row.name));
  const executed: string[] = [];

  for (const file of MIGRATION_FILES) {
    if (done.has(file)) continue;
    const sql = readFileSync(new URL(`./migrations/${file}`, import.meta.url), 'utf8');
    const started = Date.now();
    await db.tx(async (tx) => {
      await tx.exec(sql);
      await tx.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    });
    executed.push(file);
    log(`migrated ${file} (${Date.now() - started}ms)`);
  }

  if (executed.length === 0) log('database schema is up to date');
  return executed;
}

/** Drop all CampusFlow objects. Development only. */
export async function dropAll(): Promise<void> {
  const db = await getDb();
  const objects = await db.query<{ type: string; name: string }>(`
    SELECT 'table' AS type, tablename AS name FROM pg_tables WHERE schemaname = 'public'
    UNION ALL
    SELECT 'function' AS type, proname AS name FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'
    UNION ALL
    SELECT 'type' AS type, typname AS name FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typtype = 'e'
  `);
  const tables = objects.filter((o) => o.type === 'table').map((o) => `"${o.name}"`);
  if (tables.length) await db.exec(`DROP TABLE IF EXISTS ${tables.join(', ')} CASCADE;`);
  const fns = objects.filter((o) => o.type === 'function').map((o) => `"${o.name}"()`);
  if (fns.length) await db.exec(`DROP FUNCTION IF EXISTS ${fns.join(', ')} CASCADE;`);
  const types = objects.filter((o) => o.type === 'type').map((o) => `"${o.name}"`);
  if (types.length) await db.exec(`DROP TYPE IF EXISTS ${types.join(', ')} CASCADE;`);
}
