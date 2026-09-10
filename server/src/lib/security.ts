import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, config.auth.bcryptRounds);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/**
 * Opaque personal access tokens (Sanctum-compatible model): the plaintext is returned to
 * the client once, only a SHA-256 hash is stored, and comparison is constant-time.
 */
export function generateToken(): { plain: string; hash: string } {
  const plain = randomBytes(32).toString('base64url');
  return { plain, hash: sha256(plain) };
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function randomCode(length = 10): string {
  return randomBytes(length).toString('hex').slice(0, length).toUpperCase();
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function hashIp(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}
