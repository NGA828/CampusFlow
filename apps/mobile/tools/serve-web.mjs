import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

/**
 * Serves the exported web build (`npm run build:web`) so the student app can be
 * reviewed in a browser without a native toolchain.
 *
 * Deliberately dependency-free and deliberately a single-page fallback: the app is a
 * client-side shell, so any unknown path is index.html, not a 404.
 */
const ROOT = new URL('../dist/', import.meta.url).pathname;
const PORT = Number(process.env.PORT ?? 8081);

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

createServer((req, res) => {
  void (async () => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
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
});
