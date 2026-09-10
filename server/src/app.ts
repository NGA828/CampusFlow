import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyProxy from '@fastify/http-proxy';
import { config } from './config.js';
import { registerHttpPipeline } from './http/context.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerMeRoutes } from './routes/me.js';
import { registerCampusRoutes } from './routes/campus.js';
import { registerPositioningRoutes } from './routes/positioning.js';
import { registerNavigationRoutes } from './routes/navigation.js';
import { registerQueueRoutes } from './routes/queues.js';
import { registerOfficeRoutes } from './routes/offices.js';
import { registerEngagementRoutes } from './routes/engagement.js';
import { registerStaffRoutes } from './routes/staff.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerAiRoutes } from './routes/ai.js';

/**
 * Builds the CampusFlow API.
 *
 * In development the same process also serves the Next.js web client: every request that
 * is not an API call is proxied to the Next dev server, which keeps the browser on a
 * single origin (no CORS, no cross-origin websockets, and the sandbox preview only needs
 * to expose one port).
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.isProduction ? 'info' : 'warn',
      transport: config.isProduction ? undefined : undefined,
    },
    trustProxy: true,
    bodyLimit: 2 * 1024 * 1024,
  });

  await app.register(fastifyCors, {
    origin: config.cors.origins.includes('*') ? true : config.cors.origins,
    credentials: true,
    exposedHeaders: ['retry-after'],
  });

  await registerHttpPipeline(app);

  await app.register(
    async (api) => {
      await registerAuthRoutes(api);
      await registerMeRoutes(api);
      await registerCampusRoutes(api);
      await registerPositioningRoutes(api);
      await registerNavigationRoutes(api);
      await registerQueueRoutes(api);
      await registerOfficeRoutes(api);
      await registerEngagementRoutes(api);
      await registerStaffRoutes(api);
      await registerAdminRoutes(api);
      await registerAiRoutes(api);
    },
    { prefix: config.apiPrefix },
  );

  if (config.webProxyEnabled) {
    await app.register(fastifyProxy, {
      upstream: `http://127.0.0.1:${config.webDevPort}`,
      prefix: '/',
      rewritePrefix: '/',
      websocket: true,
      // API calls and the realtime socket are handled locally, everything else is the app.
      preHandler: (request, reply, done) => {
        if (request.url.startsWith(config.apiPrefix) || request.url.startsWith('/api/ws')) {
          reply.code(404).send({ success: false, message: 'Not found.', code: 'NOT_FOUND' });
          return;
        }
        done();
      },
    });
  }

  return app;
}
