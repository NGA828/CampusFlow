#!/usr/bin/env node
/**
 * CampusFlow development launcher.
 *
 * Starts the Laravel API, database queue worker, scheduler and Next.js web client.
 *
 * The Laravel API runs on port 8001 and the Next.js development server runs on port 3000.
 * Web requests use Next's rewrite to reach Laravel, while mobile clients call Laravel
 * directly using EXPO_PUBLIC_API_URL. The worker and scheduler execute notification jobs
 * and ticket expiry rules in development just as they must in production.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { connect } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const apiPort = process.env.API_PORT ?? '8001';
const webPort = process.env.WEB_DEV_PORT ?? '3000';

const COLORS = { api: '\u001b[36m', worker: '\u001b[33m', scheduler: '\u001b[32m', web: '\u001b[35m', reset: '\u001b[0m' };

/** @type {import('node:child_process').ChildProcess[]} */
const children = [];
let shuttingDown = false;

/**
 * Windows children are spawned through the shell, which does not quote the command itself, so a
 * binary such as `C:\Program Files\php-8.5.2\php.exe` has to be quoted here or the shell reports
 * `'C:\Program' is not recognized`.
 */
function shellCommand(command) {
  if (process.platform !== 'win32') return command;
  if (!/\s/.test(command) || /^".*"$/.test(command)) return command;
  return `"${command}"`;
}

function start(name, command, args, cwd, extraEnv = {}) {
  const label = `${COLORS[name] ?? ''}[${name}]${COLORS.reset}`;
  const child = spawn(shellCommand(command), args, {
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

const backendDir = join(root, 'backend');
const frontendDir = join(root, 'frontend');
const phpBin = process.env.PHP_BIN ?? 'php';

if (!existsSync(join(backendDir, 'vendor', 'autoload.php'))) {
  console.error('[campusflow] Laravel dependencies are missing — run: composer install --working-dir=backend');
  process.exit(1);
}

/**
 * A second web server (a leftover `npm start`, a `next start` from an earlier build) can hold
 * :3000 on IPv6 while this one binds IPv4, and then `localhost` silently serves a stale bundle.
 * Refuse to start rather than let two builds answer the same URL.
 */
function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = connect({ port, host: '127.0.0.1' });
    const settle = (inUse) => {
      socket.destroy();
      resolve(inUse);
    };
    socket.setTimeout(800);
    socket.once('connect', () => settle(true));
    socket.once('timeout', () => settle(false));
    socket.once('error', () => settle(false));
  });
}

for (const [name, port] of [['web', webPort], ['API', apiPort]]) {
  if (await isPortInUse(Number(port))) {
    console.error(`[campusflow] port ${port} is already in use, so another CampusFlow server is still running.`);
    console.error('[campusflow] Stop it first (Ctrl+C in the other window). Run one web server only:');
    console.error('[campusflow]   npm run dev  for development');
    console.error('[campusflow]   npm start    only after "npm run build", and never alongside npm run dev');
    process.exit(1);
  }
}

/**
 * Composer writes the effective minimum PHP version into platform_check.php, so read it back
 * instead of guessing: a too-old `php` on PATH otherwise only fails once per launch with a
 * fatal error from deep inside the autoloader.
 */
const platformCheck = join(backendDir, 'vendor', 'composer', 'platform_check.php');
const requiredVersionId = existsSync(platformCheck)
  ? Number(/PHP_VERSION_ID\s*>=\s*(\d+)/.exec(readFileSync(platformCheck, 'utf8'))?.[1] ?? 0)
  : 0;

if (requiredVersionId > 0) {
  const readable = (id) => `${Math.floor(id / 10000)}.${Math.floor(id / 100) % 100}.${id % 100}`;
  const probe = spawnSync(phpBin, ['-r', 'echo PHP_VERSION_ID;'], { encoding: 'utf8' });
  if (probe.error) {
    console.error(`[campusflow] ${phpBin} could not be started (${probe.error.message}).`);
    console.error('[campusflow] Set PHP_BIN to a full path such as C:\\Program Files\\php-8.5.2\\php.exe.');
    process.exit(1);
  }
  const runningVersionId = Number(String(probe.stdout ?? '').trim());
  if (Number.isFinite(runningVersionId) && runningVersionId < requiredVersionId) {
    console.error(
      `[campusflow] ${phpBin} is PHP ${readable(runningVersionId)}, but the Laravel dependencies ` +
        `require PHP >= ${readable(requiredVersionId)}.`,
    );
    console.error('[campusflow] Point PHP_BIN at a newer php.exe, or fix the order of your PATH.');
    process.exit(1);
  }
}

start('api', phpBin, ['artisan', 'serve', '--host=0.0.0.0', `--port=${apiPort}`], backendDir);
start('worker', phpBin, ['artisan', 'queue:work', '--queue=notifications,default', '--sleep=2', '--tries=4', '--timeout=60'], backendDir);
start('scheduler', phpBin, ['artisan', 'schedule:work'], backendDir);

if (existsSync(join(frontendDir, 'node_modules'))) {
  const apiOrigin = process.env.API_PROXY_TARGET ?? `http://127.0.0.1:${apiPort}`;
  start('web', 'npm', ['run', 'dev', '--', '--port', webPort, '--hostname', '0.0.0.0'], frontendDir, {
    PORT: webPort,
    API_PROXY_TARGET: apiOrigin,
    API_INTERNAL_URL: process.env.API_INTERNAL_URL ?? apiOrigin,
  });
} else {
  console.warn('[campusflow] frontend dependencies are missing — run: npm --prefix frontend install');
  console.warn(`[campusflow] the API alone is available on http://localhost:${apiPort}`);
}

process.stdout.write(
  `\nCampusFlow dev\n  web  http://localhost:${webPort}\n` +
    `  api  http://localhost:${apiPort}/api/v1\n\n`,
);
