import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Environment configuration. Values are read once at boot; nothing about the runtime is
 * hardcoded in application code (PROMPT §72).
 */
function loadDotEnv(): void {
  const candidates = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../.env')];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    for (const rawLine of readFileSync(file, 'utf8').split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

loadDotEnv();

function str(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function num(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

const nodeEnv = str('NODE_ENV', 'development');

export const config = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  appName: str('APP_NAME', 'CampusFlow'),
  appUrl: str('APP_URL', 'http://localhost:3000'),
  apiPrefix: '/api/v1',

  /** Public port — also serves the Next.js web client in development (single origin). */
  port: num('PORT', 3000),
  host: str('HOST', '0.0.0.0'),
  /** Internal Next.js dev server the API gateway proxies to. */
  webDevPort: num('WEB_DEV_PORT', 3100),
  webProxyEnabled: bool('WEB_PROXY_ENABLED', true),

  db: {
    driver: str('DB_DRIVER', 'pglite'),
    url: process.env.DATABASE_URL ?? '',
    ssl: bool('DB_SSL', false),
    pgliteDataDir: str('PGLITE_DATA_DIR', 'storage/campusflow.db'),
  },

  auth: {
    tokenTtlDays: num('AUTH_TOKEN_TTL_DAYS', 30),
    passwordResetTtlMinutes: num('AUTH_RESET_TTL_MINUTES', 60),
    bcryptRounds: num('BCRYPT_ROUNDS', 10),
    /** Password reset links are written to the API log in development (no SMTP here). */
    exposeResetToken: bool('AUTH_EXPOSE_RESET_TOKEN', nodeEnv !== 'production'),
  },

  rateLimit: {
    windowSeconds: num('RATE_LIMIT_WINDOW_SECONDS', 60),
    defaultMax: num('RATE_LIMIT_MAX', 240),
    authMax: num('RATE_LIMIT_AUTH_MAX', 20),
    mutationMax: num('RATE_LIMIT_MUTATION_MAX', 60),
  },

  scheduler: {
    enabled: bool('SCHEDULER_ENABLED', true),
    ticketExpiryIntervalMs: num('SCHEDULER_TICKET_MS', 10_000),
    classReminderIntervalMs: num('SCHEDULER_REMINDER_MS', 60_000),
  },

  ai: {
    /** OpenAI-compatible endpoint. When unset the assistant uses the deterministic intent engine. */
    apiKey: str('LLM_API_KEY', ''),
    baseUrl: str('LLM_BASE_URL', 'https://api.openai.com/v1'),
    model: str('LLM_MODEL', 'gpt-4o-mini'),
    timeoutMs: num('LLM_TIMEOUT_MS', 20_000),
    maxToolIterations: num('LLM_MAX_TOOL_ITERATIONS', 4),
  },

  push: {
    enabled: bool('EXPO_PUSH_ENABLED', false),
    expoAccessToken: str('EXPO_ACCESS_TOKEN', ''),
  },

  cors: {
    origins: str('CORS_ALLOWED_ORIGINS', '*')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  },

  dev: {
    /** Enables the clearly-labelled location simulator used to test navigation on desktop. */
    positionSimulator: bool('ENABLE_POSITION_SIMULATOR', nodeEnv !== 'production'),
    /** Development-only endpoint that reports pending password reset tokens. */
    debugRoutes: bool('ENABLE_DEBUG_ROUTES', nodeEnv !== 'production'),
  },
} as const;

export type AppConfig = typeof config;
