#!/usr/bin/env node
/**
 * CampusFlow development launcher.
 *
 * Starts the Laravel API and Next.js web client used by the project.
 *
 * The Laravel API runs on port 8000 and the Next.js development server runs on port 3100.
 * Web requests use Next's rewrite to reach Laravel, while mobile clients call Laravel
 * directly using EXPO_PUBLIC_API_URL.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const apiPort = process.env.API_PORT ?? '8000';
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

const backendDir = join(root, 'backend');
const frontendDir = join(root, 'frontend');

if (!existsSync(join(backendDir, 'vendor', 'autoload.php'))) {
  console.error('[campusflow] Laravel dependencies are missing — run: composer install --working-dir=backend');
  process.exit(1);
}

start('api', 'php', ['artisan', 'serve', '--host=0.0.0.0', `--port=${apiPort}`], backendDir);

if (existsSync(join(frontendDir, 'node_modules'))) {
  start('web', 'npm', ['run', 'dev', '--', '--port', webPort, '--hostname', '0.0.0.0'], frontendDir, {
    PORT: webPort,
  });
} else {
  console.warn('[campusflow] frontend dependencies are missing — run: npm --prefix frontend install');
  console.warn(`[campusflow] the API alone is available on http://localhost:${apiPort}`);
}

process.stdout.write(
  `\nCampusFlow dev\n  web  http://localhost:${webPort}\n` +
    `  api  http://localhost:${apiPort}/api/v1\n\n`,
);
