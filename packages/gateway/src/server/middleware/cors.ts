/**
 * CORS Middleware
 *
 * Cross-Origin Resource Sharing configuration.
 * Restrictive by default - only allows configured origins.
 *
 * @module @atlas/gateway/server/middleware/cors
 */

import { cors } from 'hono/cors';
import type { AtlasConfig } from '../../index.js';

// Default allowed origins
const DEFAULT_ORIGINS = [
  'http://localhost:3000', // Next.js dev server
  'http://localhost:18789', // Same-origin
  'http://127.0.0.1:3000',
  'http://127.0.0.1:18789',
];

/**
 * Create CORS middleware with Atlas configuration
 */
export function corsMiddleware(config: AtlasConfig) {
  // Build allowed origins list
  const allowedOrigins = [...DEFAULT_ORIGINS];

  // Add custom origins from environment
  const customOrigins = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim());
  if (customOrigins) {
    allowedOrigins.push(...customOrigins);
  }

  return cors({
    origin: (origin) => {
      // Allow requests with no origin (same-origin, curl, etc.)
      if (!origin) return '*';

      // Check if origin is in allowlist
      if (allowedOrigins.includes(origin)) {
        return origin;
      }

      // Allow localhost variants
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return origin;
      }

      // Deny by default
      return null;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'X-Device-Fingerprint',
    ],
    exposeHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-Request-ID',
    ],
    credentials: true,
    maxAge: 600, // 10 minutes preflight cache
  });
}

export default corsMiddleware;
