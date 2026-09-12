/**
 * PHP syntax gate — the whole backend, parsed rather than executed.
 *
 * There is no PHP runtime in every environment this repo is worked in (CI sandboxes, review VMs), and
 * `php -l` is the only cheap check available when there is one. This script gives the same guarantee
 * without a binary: every file under `backend/` is parsed with the same grammar PHP itself uses, so a
 * missing brace, a half-applied patch or a stray fragment left by an edit fails the build here instead of
 * surfacing as a blank 500 on the first request. It checks *parseability*, not behaviour — the feature tests in `backend/tests` are what prove
 * a role cannot read another role's data.
 *
 *   node scripts/check-php-syntax.mjs [path/to/backend]
 */
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync, statSync, readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

// php-parser ships CommonJS; resolve it from the repo root so a global install is not needed.
let enginePkg;
try {
  ({ default: enginePkg } = await import('php-parser'));
} catch {
  enginePkg = require(require.resolve('php-parser', { paths: [resolve(here, '..')] })).default ?? require('php-parser');
}

const root = process.argv[2] ? resolve(process.argv[2]) : resolve(here, '..', 'backend');
const dirs = ['app', 'routes', 'database', 'tests', 'bootstrap', 'config'];
const parser = new enginePkg({ parser: { php7: true, suppressErrors: false }, ast: { withPositions: true } });

const files = [];
const walk = (d) => {
  for (const entry of readdirSync(d)) {
    const p = join(d, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (p.endsWith('.php')) files.push(p);
  }
};

let failed = 0;
for (const d of dirs) {
  try { walk(join(root, d)); } catch { /* missing dir */ }
}

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  try {
    parser.parseCode(src, file);
  } catch (e) {
    failed++;
    const line = e?.lineNumber ?? e?.message?.match(/line (\d+)/)?.[1] ?? '?';
    console.log(`FAIL ${file.replace(root + '/', '')}:${line} — ${String(e.message).split('\n')[0]}`);
  }
}

console.log(`\n${files.length} PHP files parsed, ${failed} with syntax errors`);
process.exit(failed ? 1 : 0);
