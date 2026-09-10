/**
 * Database migration runner.
 *   npm run db:migrate          apply pending migrations
 *   npm run db:migrate -- --fresh   drop every CampusFlow object first (development only)
 */
import { closeDb, dropAll, runMigrations } from '../src/db/client.js';
import { config } from '../src/config.js';

async function main(): Promise<void> {
  const fresh = process.argv.includes('--fresh');
  if (fresh) {
    if (config.isProduction) {
      throw new Error('Refusing to run --fresh in production.');
    }
    await dropAll();
    console.log('[campusflow] dropped all CampusFlow objects');
  }

  const applied = await runMigrations({ log: (message) => console.log(`[campusflow] ${message}`) });
  console.log(`[campusflow] migration complete (${applied.length} applied, driver=${config.db.driver})`);
  await closeDb();
}

main().catch(async (error) => {
  console.error('[campusflow] migration failed:', error);
  await closeDb().catch(() => {});
  process.exit(1);
});
