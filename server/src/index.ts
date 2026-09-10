import { buildApp } from './app.js';
import { config } from './config.js';
import { closeDb, getDb, runMigrations } from './db/client.js';
import { attachRealtime } from './realtime/bus.js';
import { startScheduler } from './services/scheduler.js';

/**
 * CampusFlow API entry point.
 *
 * Boot order: database → migrations → HTTP + realtime → background scheduler.
 * `ENABLE_AUTO_MIGRATE=false` allows a deployment to run migrations as a separate step.
 */
async function main(): Promise<void> {
  const app = await buildApp();
  const log = (message: string) => app.log.info(message);

  const db = await getDb();
  if ((process.env.ENABLE_AUTO_MIGRATE ?? 'true') !== 'false') {
    const applied = await runMigrations({ log: (message) => app.log.info(message) });
    if (applied.length === 0) log('database schema is current');
  }

  await app.listen({ port: config.port, host: config.host });

  const detachRealtime = await attachRealtime(app.server, db);
  const scheduler = startScheduler(db, (message) => app.log.info(message));

  app.log.info(
    `CampusFlow API ready on http://${config.host}:${config.port}${config.apiPrefix} ` +
      `(db=${config.db.driver}, web proxy=${config.webProxyEnabled ? `127.0.0.1:${config.webDevPort}` : 'off'}, ` +
      `assistant=${config.ai.apiKey ? 'llm' : 'deterministic'})`,
  );

  const shutdown = async (signal: string) => {
    app.log.info(`received ${signal}, shutting down`);
    scheduler.stop();
    await detachRealtime();
    await app.close();
    await closeDb();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[campusflow] failed to start:', error);
  process.exit(1);
});
