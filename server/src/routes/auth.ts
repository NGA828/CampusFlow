import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { created, noContent, ok, audit } from '../lib/respond.js';
import { generateToken, hashPassword, sha256, verifyPassword } from '../lib/security.js';
import { requireAuth } from '../middleware/auth.js';
import { permissionsForRole, type RoleCode } from '../policies/rbac.js';
import { config } from '../config.js';
import { ctxOf } from '../http/context.js';

const password = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(200)
  .refine((value) => /[a-z]/.test(value) && /[A-Z]/.test(value), 'Include upper and lower case letters.')
  .refine((value) => /\d/.test(value), 'Include at least one number.');

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password,
  registration_no: z.string().trim().max(40).optional(),
  department: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
  device: z.string().trim().max(120).optional(),
});

const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email() });
const resetSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  token: z.string().min(10),
  password,
});
const changeSchema = z.object({ current_password: z.string().min(1), password });

const PROFILE_SELECT = `id, name, email, role_code, status, registration_no, department, phone, avatar_url,
  email_verified_at, last_login_at, created_at`;

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  /** Registration creates a student account; staff and administrators are created by an admin. */
  app.post('/auth/register', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const input = parse(registerSchema, request.body ?? {});

    const existing = await ctx.db.one<{ id: string }>('SELECT id FROM users WHERE lower(email) = $1', [input.email]);
    if (existing) {
      throw ApiError.validation({ email: ['An account with this email address already exists.'] });
    }

    const passwordHash = await hashPassword(input.password);
    const user = await ctx.db.one<Record<string, unknown>>(
      `INSERT INTO users (name, email, password_hash, role_code, registration_no, department, phone, status)
       VALUES ($1, $2, $3, 'student', $4, $5, $6, 'active')
       RETURNING ${PROFILE_SELECT}`,
      [input.name, input.email, passwordHash, input.registration_no ?? null, input.department ?? null, input.phone ?? null],
    );

    const token = generateToken();
    const expiresAt = new Date(Date.now() + config.auth.tokenTtlDays * 86_400_000);
    await ctx.db.query(
      `INSERT INTO api_tokens (user_id, name, token_hash, abilities, expires_at) VALUES ($1, 'web', $2, $3, $4)`,
      [user!.id, token.hash, JSON.stringify(permissionsForRole('student')), expiresAt],
    );

    await audit(ctx, 'auth.registered', { type: 'user', id: String(user!.id) });

    return created(
      reply,
      {
        token: token.plain,
        expires_at: expiresAt.toISOString(),
        user: { ...user, permissions: permissionsForRole('student') },
      },
      'Welcome to CampusFlow.',
    );
  });

  app.post('/auth/login', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const input = parse(loginSchema, request.body ?? {});

    const user = await ctx.db.one<{
      id: string;
      name: string;
      email: string;
      password_hash: string;
      role_code: RoleCode;
      status: string;
      registration_no: string | null;
      department: string | null;
      phone: string | null;
      avatar_url: string | null;
      email_verified_at: string | null;
      last_login_at: string | null;
      created_at: string;
    }>(`SELECT ${PROFILE_SELECT}, password_hash FROM users WHERE lower(email) = $1`, [input.email]);

    // Uniform failure message: never reveal whether the address exists.
    if (!user || !(await verifyPassword(input.password, user.password_hash))) {
      throw ApiError.unauthorized('These credentials do not match our records.');
    }
    if (user.status === 'suspended') {
      throw ApiError.forbidden('This account has been suspended. Contact the campus administrator.');
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + config.auth.tokenTtlDays * 86_400_000);
    await ctx.db.query(
      `INSERT INTO api_tokens (user_id, name, token_hash, abilities, device, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        user.id,
        input.device ?? 'web',
        token.hash,
        JSON.stringify(permissionsForRole(user.role_code)),
        input.device ?? null,
        expiresAt,
      ],
    );
    await ctx.db.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);

    const { password_hash: _ignored, ...profile } = user;
    void _ignored;
    await audit(ctx, 'auth.login', { type: 'user', id: user.id });

    return ok(reply, {
      token: token.plain,
      expires_at: expiresAt.toISOString(),
      user: { ...profile, permissions: permissionsForRole(user.role_code) },
    });
  });

  app.post('/auth/logout', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    await ctx.db.query('UPDATE api_tokens SET revoked_at = now() WHERE id = $1', [principal.tokenId]);
    await audit(ctx, 'auth.logout', { type: 'user', id: principal.id });
    return noContent(reply);
  });

  app.get('/auth/me', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const profile = await ctx.db.one(PROFILE_SELECT_QUERY, [principal.id]);
    if (!profile) throw ApiError.unauthorized('Your account is no longer available.');
    return ok(reply, {
      user: { ...profile, permissions: principal.permissions },
      assignments: principal.assignments,
    });
  });

  app.post('/auth/forgot-password', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const input = parse(forgotSchema, request.body ?? {});
    const user = await ctx.db.one<{ id: string; name: string }>('SELECT id, name FROM users WHERE lower(email) = $1', [input.email]);

    let devToken: string | undefined;
    if (user) {
      const token = generateToken();
      devToken = token.plain;
      await ctx.db.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, now() + make_interval(mins => $3::int))`,
        [user.id, token.hash, config.auth.passwordResetTtlMinutes],
      );
      request.log.info({ user: user.id }, 'password reset token issued');
    }

    // Always the same response: no account enumeration.
    return ok(
      reply,
      config.auth.exposeResetToken && devToken ? { reset_token: devToken, expires_in_minutes: config.auth.passwordResetTtlMinutes } : {},
      'If that email address is registered, a reset link has been sent.',
    );
  });

  app.post('/auth/reset-password', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const input = parse(resetSchema, request.body ?? {});

    const row = await ctx.db.one<{ id: string; user_id: string }>(
      `SELECT t.id, t.user_id FROM password_reset_tokens t
        JOIN users u ON u.id = t.user_id
       WHERE lower(u.email) = $1 AND t.token_hash = $2 AND t.used_at IS NULL AND t.expires_at > now()`,
      [input.email, sha256(input.token)],
    );
    if (!row) {
      throw ApiError.validation({ token: ['This password reset link is invalid or has expired.'] });
    }

    const hash = await hashPassword(input.password);
    await ctx.db.query('UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1', [row.user_id, hash]);
    await ctx.db.query('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [row.id]);
    await ctx.db.query('UPDATE api_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [row.user_id]);
    await audit(ctx, 'auth.password_reset', { type: 'user', id: row.user_id });

    return ok(reply, {}, 'Your password has been reset. Sign in with your new password.');
  });

  app.patch('/auth/password', async (request, reply) => {
    const ctx = ctxOf(request, reply);
    const principal = requireAuth(ctx);
    const input = parse(changeSchema, request.body ?? {});

    const row = await ctx.db.one<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [principal.id]);
    if (!row || !(await verifyPassword(input.current_password, row.password_hash))) {
      throw ApiError.validation({ current_password: ['Your current password is incorrect.'] });
    }

    const hash = await hashPassword(input.password);
    await ctx.db.query('UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1', [principal.id, hash]);
    await ctx.db.query('UPDATE api_tokens SET revoked_at = now() WHERE user_id = $1 AND id <> $2', [principal.id, principal.tokenId]);
    await audit(ctx, 'auth.password_changed', { type: 'user', id: principal.id });
    return ok(reply, {}, 'Password updated.');
  });

  // Development helper: surfaces the pending reset token so the flow can be exercised
  // without an SMTP server. Disabled whenever ENABLE_DEBUG_ROUTES is false.
  if (config.dev.debugRoutes) {
    app.get('/auth/debug/reset-tokens', async (request, reply) => {
      const ctx = ctxOf(request, reply);
      const rows = await ctx.db.query(
        `SELECT u.email, t.created_at, t.expires_at FROM password_reset_tokens t
           JOIN users u ON u.id = t.user_id
          WHERE t.used_at IS NULL AND t.expires_at > now() ORDER BY t.created_at DESC LIMIT 10`,
      );
      return ok(reply, { tokens: rows, note: 'Development only — tokens are hashed at rest, so only metadata is shown.' });
    });
  }
}

const PROFILE_SELECT_QUERY = `SELECT ${PROFILE_SELECT} FROM users WHERE id = $1`;
