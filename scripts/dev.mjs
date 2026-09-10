#!/usr/bin/env node
/**
 * CampusFlow development launcher.
 *
 * Starts both halves of the modular monolith:
 *   • API   — Fastify on PORT (default 3000); migrations run automatically on boot
 *   • Web   — Next.js dev server on WEB_DEV_PORT (default 3100)
 *
 * The API also reverse-proxies every non-API request to the Next server, so the browser
 * only ever talks to one origin (http://localhost:3000). That keeps cookies, CORS and the
 * realtime socket on /api/ws simple, and it means the sandbox preview only needs the API
 * port exposed.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const apiPort = process.env.PORT ?? '3000';
const webPort = process.env.WEB_DEV_PORT ?? '3100';

const COLORS = { api: '\u001b[36m', web: '\u001b[35m', reset: '\u001b[0m' };

/** @type {import('node:child_process').ChildProcess[]} */
const children = [];
let shuttingDown = false;

function start(name, command, args, cwd, extraEnv = {}) {
  const label = `${COLORS[name] ?? ''}[${name}]${COLORS.reset}`;
  const child = spawn(command, args, {
    cwd,
    env: {
      ...process.env,
      FORCE_COLOR: '1',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
  const pump = (stream, target) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) target.write(`${label} ${line}\n`);
    });
  };
  pump(child.stdout, process.stdout);
  pump(child.stderr, process.stderr);
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    process.stdout.write(`${label} exited (${signal ?? code})\n`);
    shutdown(code ?? 1);
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 400);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

const serverDir = join(root, 'server');
const frontendDir = join(root, 'frontend');

if (!existsSync(join(serverDir, 'node_modules'))) {
  console.error('[campusflow] server dependencies are missing — run: npm --prefix server install');
  process.exit(1);
}

start('api', 'npm', ['run', 'dev'], serverDir, { PORT: apiPort, WEB_DEV_PORT: webPort });

if (existsSync(join(frontendDir, 'node_modules'))) {
  start('web', 'npm', ['run', 'dev', '--', '--port', webPort, '--hostname', '0.0.0.0'], frontendDir, {
    PORT: webPort,
  });
} else {
  console.warn('[campusflow] frontend dependencies are missing — run: npm --prefix frontend install');
  console.warn(`[campusflow] the API alone is available on http://localhost:${apiPort}`);
}

process.stdout.write(
  `\nCampusFlow dev\n  web  http://localhost:${apiPort} (proxied to Next on :${webPort})\n` +
    `  api  http://localhost:${apiPort}/api/v1\n\n`,
);
