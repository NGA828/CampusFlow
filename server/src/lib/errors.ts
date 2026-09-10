/**
 * API error contract (PROMPT §37, §38).
 *   success → { success: true, data, message }
 *   failure → { success: false, message, errors }
 * Failures never return HTTP 200.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly errors: Record<string, string[]> | undefined;
  readonly code: string | undefined;

  constructor(
    status: number,
    message: string,
    options: { errors?: Record<string, string[]>; code?: string } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = options.errors;
    this.code = options.code;
  }

  static badRequest(message: string, errors?: Record<string, string[]>): ApiError {
    return new ApiError(400, message, { errors, code: 'BAD_REQUEST' });
  }

  static unauthorized(message = 'Authentication required.'): ApiError {
    return new ApiError(401, message, { code: 'UNAUTHENTICATED' });
  }

  static forbidden(message = 'You do not have permission to perform this action.'): ApiError {
    return new ApiError(403, message, { code: 'FORBIDDEN' });
  }

  static notFound(message = 'Resource not found.'): ApiError {
    return new ApiError(404, message, { code: 'NOT_FOUND' });
  }

  static conflict(message: string, code = 'CONFLICT'): ApiError {
    return new ApiError(409, message, { code });
  }

  static validation(errors: Record<string, string[]>, message = 'The given data was invalid.'): ApiError {
    return new ApiError(422, message, { errors, code: 'VALIDATION_ERROR' });
  }

  static tooMany(message = 'Too many requests. Please slow down.'): ApiError {
    return new ApiError(429, message, { code: 'RATE_LIMITED' });
  }

  static unavailable(message: string, code = 'UNAVAILABLE'): ApiError {
    return new ApiError(503, message, { code });
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
