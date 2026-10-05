import { createServer } from 'node:http';
import { HttpError, readBody, resolveUser, send } from './http.ts';
import { router } from './routes.ts';
import { DATA_FILE, initialise, persist, userByEmail } from './store.ts';

/**
 * CampusFlow API.
 *
 * Node's own HTTP server, no framework: the whole surface is the route table in
 * `routes.ts`, which keeps the preview start-up instant and the dependency list
 * empty. Authentication is a bearer token — deliberately not a cookie, because the
 * demo is reviewed inside an iframe where third-party cookies are dropped.
 */

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? '0.0.0.0';

const { restored } = initialise();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  // The browser talks to the web app's own origin, which proxies here; CORS is only
  // needed for the Expo client during development.
  res.setHeader('access-control-allow-origin', req.headers.origin ?? '*');
  res.setHeader('access-control-allow-headers', 'authorization, content-type');
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const match = router.match(req.method ?? 'GET', url.pathname);
  if (!match) {
    send(res, 404, { error: 'This endpoint does not exist.', path: url.pathname });
    return;
  }

  try {
    const body = req.method === 'POST' ? await readBody(req) : null;
    const payload = await match.handler({ req, res, url, params: match.params, body, user: resolveUser(req) });
    // Every successful write goes to disk before the client is told it succeeded.
    if (req.method === 'POST') persist();
    send(res, res.statusCode === 200 ? 200 : res.statusCode, payload);
  } catch (error) {
    if (error instanceof HttpError) {
      send(res, error.status, { error: error.message, details: error.details });
      return;
    }
    console.error('[api] unhandled error', error);
    send(res, 500, { error: 'The API failed to handle this request.' });
  }
});

server.listen(port, host, () => {
  console.log(`[api] CampusFlow API on http://${host}:${port}/api/v1`);
  console.log(`[api] data file ${DATA_FILE} (${restored ? 'restored' : 'seeded'})`);
  const student = userByEmail('etudiant@iaicameroun.cm');
  if (student) console.log(`[api] walkthrough student ${student.email} · staff scolarite@iaicameroun.cm · admin direction@iaicameroun.cm`);
});
