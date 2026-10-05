#!/usr/bin/env node
/**
 * Development launcher: the API and the web app, with one Ctrl+C for both.
 *
 *   npm run dev            API on 4000, web on 3000
 *   PORT=8080 npm run dev  web on 8080
 *
 * The browser only ever talks to the web port — `apps/web/next.config.ts` rewrites
 * `/api/v1/*` to the API process, so the preview never makes a cross-origin request.
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const apiPort = process.env.API_PORT ?? '4000';
const webPort = process.env.PORT ?? '3000';

const children = [];
let stopping = false;

function start(name, colour, command, args, cwd, env) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, FORCE_COLOR: '1', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const label = `\u001b[${colour}m[${name}]\u001b[0m`;
  for (const stream of [child.stdout, child.stderr]) {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) process.stdout.write(`${label} ${line}\n`);
    });
  }
  child.on('exit', (code, signal) => {
    if (stopping) return;
    process.stdout.write(`${label} exited (${signal ?? code})\n`);
    stop(code ?? 1);
  });
  children.push(child);
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 300);
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

start('api', '35', process.execPath, ['--experimental-strip-types', 'src/index.ts'], join(root, 'apps', 'api'), { PORT: apiPort });
start('web', '36', 'npx', ['next', 'dev', '--hostname', '0.0.0.0', '--port', webPort], join(root, 'apps', 'web'), {
  API_ORIGIN: `http://127.0.0.1:${apiPort}`,
});

process.stdout.write(`\nCampusFlow\n  web  http://localhost:${webPort}\n  api  http://localhost:${apiPort}/api/v1\n\n`);
