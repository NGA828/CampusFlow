import { createServer, request as httpRequest } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

/**
 * Serves the exported web build (`npm run build:web`) so the student app can be
 * reviewed in a browser without a native toolchain.
 *
 * Deliberately dependency-free and deliberately a single-page fallback: the app is a
 * client-side shell, so any unknown path is index.html, not a 404.
 *
 * It also proxies `/api/v1/*` to the API process. The browser showing this build is
 * not the machine running the API — in a hosted preview it is somewhere else
 * entirely — so the app calls its own origin and this server does the hop. Nothing
 * in the bundle has to know a hostname or a port.
 */
const ROOT = new URL('../dist/', import.meta.url).pathname;
const PORT = Number(process.env.PORT ?? 8081);
const API_ORIGIN = process.env.API_ORIGIN ?? 'http://127.0.0.1:4000';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function resolve(pathname) {
  const candidate = join(ROOT, normalize(pathname).replace(/^(\.\.[/\\])+/, ''));
  if (!candidate.startsWith(ROOT)) return join(ROOT, 'index.html');
  try {
    const info = await stat(candidate);
    if (info.isFile()) return candidate;
  } catch {
    /* fall through to the single-page shell */
  }
  return join(ROOT, 'index.html');
}

/** Pipe an API call through to the API process, headers, body and status intact. */
function proxy(req, res) {
  const target = new URL(req.url, API_ORIGIN);
  const upstream = httpRequest(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      path: target.pathname + target.search,
      method: req.method,
      headers: { ...req.headers, host: target.host },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );
  upstream.on('error', () => {
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: `The CampusFlow API at ${API_ORIGIN} is not running.` }));
  });
  req.pipe(upstream);
}

createServer((req, res) => {
  void (async () => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    if (pathname.startsWith('/api/')) {
      proxy(req, res);
      return;
    }
    const file = await resolve(pathname === '/' ? '/index.html' : pathname);
    res.setHeader('content-type', TYPES[extname(file)] ?? 'application/octet-stream');
    res.setHeader('cache-control', file.endsWith('index.html') ? 'no-store' : 'public, max-age=3600');
    createReadStream(file)
      .on('error', () => {
        res.statusCode = 500;
        res.end('CampusFlow web build could not be read. Run: npm run build:web');
      })
      .pipe(res);
  })();
}).listen(PORT, '0.0.0.0', () => {
  console.log(`CampusFlow student app (web build) on http://0.0.0.0:${PORT}`);
  console.log(`  /api/v1 → ${API_ORIGIN}/api/v1`);
});
