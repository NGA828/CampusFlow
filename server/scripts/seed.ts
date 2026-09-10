/**
 * `npm run db:seed` — build the demo campus (see src/db/seed.ts for the dataset).
 */
import { closeDb, getDb, runMigrations } from '../src/db/client.js';
import { seedDatabase } from '../src/db/seed.js';

async function main(): Promise<void> {
  const db = await getDb();
  const applied = await runMigrations({ log: (message) => console.log(`[campusflow] ${message}`) });
  if (applied.length > 0) console.log(`[campusflow] applied ${applied.length} migration(s)`);

  const summary = await seedDatabase(db, { log: (message) => console.log(`[seed] ${message}`) });
  console.log(
    `[seed] ${summary.users} users · ${summary.rooms} rooms · ${summary.navigation_nodes} nav nodes · ` +
      `${summary.navigation_edges} edges · ${summary.qr_nodes} QR anchors · ${summary.queues} queues · ` +
      `${summary.offices} offices · ${summary.queue_tickets} room tickets · ${summary.office_tickets} office tickets`,
  );
  await closeDb();
}

main().catch(async (error) => {
  console.error('[campusflow] seed failed:', error);
  await closeDb().catch(() => {});
  process.exit(1);
});
