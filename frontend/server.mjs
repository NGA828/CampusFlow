/**
 * Web server for CampusFlow.
 *
 * Next.js handles the app, and everything under /api is proxied to the API process so the
 * browser only ever talks to one origin. WebSocket upgrades for /api/ws are proxied too,
 * which keeps the realtime channel free of CORS and mixed-origin problems.
 *
 *   node server.mjs            development (Next dev + proxy)
 *   NODE_ENV=production node server.mjs   production (Next build output + proxy)
 */
import { createServer } from 'node:http';
import { parse } from 'node:url';
import httpProxy from 'http-proxy';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 3100);
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8001';

const proxy = httpProxy.createProxyServer({ target: apiTarget, ws: true, changeOrigin: true, xfwd: true });

proxy.on('error', (error, _request, response) => {
  const message = `The API is not reachable at ${apiTarget} (${error.message}). Start it with \`php backend/artisan serve --host=0.0.0.0 --port=8001\`.`;
  if (response && 'writeHead' in response && !response.headersSent) {
    response.writeHead(502, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ success: false, message, code: 'API_UNAVAILABLE' }));
  } else if (response && 'destroy' in response) {
    response.destroy();
  }
});

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const server = createServer((request, response) => {
  const { pathname } = parse(request.url ?? '/', false);
  if (pathname?.startsWith('/api')) {
    proxy.web(request, response);
    return;
  }
  void handle(request, response, parse(request.url ?? '/', true));
});

server.on('upgrade', (request, socket, head) => {
  const { pathname } = parse(request.url ?? '/', false);
  if (pathname?.startsWith('/api')) {
    proxy.ws(request, socket, head);
    return;
  }
  // Next.js handles its own dev-time upgrades (HMR).
  if (dev) {
    app.getRequestHandler();
    socket.destroy();
  } else {
    socket.destroy();
  }
});

server.listen(port, hostname, () => {
  console.log(`[web] CampusFlow web ready on http://${hostname}:${port} (api → ${apiTarget})`);
});
