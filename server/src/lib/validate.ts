import { z, type ZodType } from 'zod';
import { ApiError } from './errors.js';

/**
 * Validation helper: converts Zod issues into the Laravel-style `errors` map used by the
 * API contract, so clients render field-level feedback identically for every endpoint.
 */
export function parse<S extends ZodType>(schema: S, payload: unknown): z.output<S> {
  const result = schema.safeParse(payload);
  if (result.success) return result.data;

  const errors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.length ? issue.path.join('.') : '_';
    errors[path] = [...(errors[path] ?? []), issue.message];
  }
  throw ApiError.validation(errors);
}

export const uuid = z.string().uuid('Must be a valid identifier.');
export const nonEmpty = z.string().trim().min(1, 'This field is required.');
export const isoDate = z.string().datetime({ offset: true }).or(z.string().datetime());
export const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
};
export const paginationSchema = z.object(pagination);
export const searchQuery = z.string().trim().max(120).optional();
