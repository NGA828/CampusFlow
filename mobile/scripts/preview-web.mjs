/** Serve the Expo web export with the same-origin API proxy used for browser previews.
 * No demo data or authentication bypass is provided. Native devices use EXPO_PUBLIC_API_URL.
 */
import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const port = Number(process.env.PORT ?? 3101);
const target = new URL(process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8001');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
if (!existsSync(resolve(root, 'index.html'))) throw new Error('Export the mobile web app first: EXPO_PUBLIC_API_URL=/api/v1 npx expo export --platform web');
createServer((req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://preview').pathname;
  if (pathname.startsWith('/api/')) {
    const destination = new URL(req.url, target);
    const proxy = (destination.protocol === 'https:' ? httpsRequest : httpRequest)(destination, { method: req.method, headers: { ...req.headers, host: destination.host } }, (upstream) => {
      res.writeHead(upstream.statusCode ?? 502, upstream.headers); upstream.pipe(res);
    });
    proxy.on('error', () => { if (!res.headersSent) { res.writeHead(502, { 'content-type': 'application/json' }); res.end(JSON.stringify({ success: false, message: 'The CampusFlow API is unavailable. Start the backend or configure API_PROXY_TARGET.' })); } else res.destroy(); });
    req.pipe(proxy); return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  let path;
  try { path = resolve(root, `.${decodeURIComponent(pathname)}`); } catch { res.writeHead(400); res.end(); return; }
  if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
  if (existsSync(path) && statSync(path).isDirectory()) path = resolve(path, 'index.html');
  if (!existsSync(path) && existsSync(path + '.html')) path += '.html';
  if (!existsSync(path)) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'content-type': mime[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
  if (req.method === 'HEAD') res.end(); else createReadStream(path).pipe(res);
}).listen(port, '0.0.0.0', () => console.log(`CampusFlow mobile web preview on :${port}`));
