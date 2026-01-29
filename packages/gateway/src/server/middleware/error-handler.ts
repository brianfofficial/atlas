/**
 * Error Handler Middleware
 *
 * Centralized error handling for all API routes.
 * Transforms errors into consistent API responses.
 *
 * @module @atlas/gateway/server/middleware/error-handler
 */

import type { Context } from 'hono';
import type { ServerEnv } from '../index.js';
import pino from 'pino';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const log = (pino as any)({ name: 'error-handler' });

/**
 * Standard API error response structure
 */
export interface ApiErrorResponse {
  error: string;
  message: string;
  code: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

/**
 * Custom API error class
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Validation error class
 */
export class ValidationError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(400, 'VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

/**
 * Not found error class
 */
export class NotFoundError extends ApiError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(404, 'NOT_FOUND', message, { resource, id });
    this.name = 'NotFoundError';
  }
}

/**
 * Unauthorized error class
 */
export class UnauthorizedError extends ApiError {
  constructor(message = 'Authentication required') {
    super(401, 'UNAUTHORIZED', message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Forbidden error class
 */
export class ForbiddenError extends ApiError {
  constructor(message = 'Access denied') {
    super(403, 'FORBIDDEN', message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Conflict error class
 */
export class ConflictError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(409, 'CONFLICT', message, details);
    this.name = 'ConflictError';
  }
}

/**
 * Global error handler
 */
export function errorHandler(err: Error, c: Context<ServerEnv>): Response {
  const requestId = c.get('requestId');

  // Log the error
  log.error(
    {
      err,
      requestId,
      path: c.req.path,
      method: c.req.method,
    },
    'Request error'
  );

  // Handle known API errors
  if (err instanceof ApiError) {
    const response: ApiErrorResponse = {
      error: err.name.replace('Error', ''),
      message: err.message,
      code: err.code,
      details: err.details,
      requestId,
    };

    return c.json(response, err.status as 400 | 401 | 403 | 404 | 409 | 500);
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError' && 'issues' in err) {
    const zodError = err as unknown as { issues: Array<{ path: string[]; message: string }> };
    const response: ApiErrorResponse = {
      error: 'Validation Error',
      message: 'Request validation failed',
      code: 'VALIDATION_ERROR',
      details: {
        issues: zodError.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
      requestId,
    };

    return c.json(response, 400);
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    const response: ApiErrorResponse = {
      error: 'Authentication Error',
      message: err.message,
      code: err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
      requestId,
    };

    return c.json(response, 401);
  }

  // Handle unknown errors (don't expose internal details)
  const isProduction = process.env.NODE_ENV === 'production';
  const response: ApiErrorResponse = {
    error: 'Internal Server Error',
    message: isProduction ? 'An unexpected error occurred' : err.message,
    code: 'INTERNAL_ERROR',
    requestId,
  };

  if (!isProduction) {
    response.details = {
      stack: err.stack,
    };
  }

  return c.json(response, 500);
}

export default errorHandler;
