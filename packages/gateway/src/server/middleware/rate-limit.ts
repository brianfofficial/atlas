/**
 * Rate Limiting Middleware
 *
 * Token bucket rate limiter to prevent abuse.
 * Default: 100 requests per minute per IP.
 *
 * @module @atlas/gateway/server/middleware/rate-limit
 */

import { createMiddleware } from 'hono/factory';
import type { ServerEnv } from '../index.js';

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

// In-memory store for rate limiting
// In production, this should be Redis-backed for multi-instance support
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries periodically
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute
setInterval(() => {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes

  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.lastRefill > maxAge) {
      rateLimitStore.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Key function to identify clients */
  keyFn?: (ip: string, path: string) => string;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
};

/**
 * Token bucket rate limiter middleware
 */
export function rateLimitMiddleware(config: Partial<RateLimitConfig> = {}) {
  const { maxRequests, windowMs, keyFn } = { ...DEFAULT_CONFIG, ...config };

  return createMiddleware<ServerEnv>(async (c, next) => {
    // Get client identifier
    const ip = getClientIP(c);
    const path = c.req.path;
    const key = keyFn ? keyFn(ip, path) : ip;

    const now = Date.now();
    let entry = rateLimitStore.get(key);

    if (!entry) {
      // New client - start with full bucket
      entry = {
        tokens: maxRequests,
        lastRefill: now,
      };
      rateLimitStore.set(key, entry);
    }

    // Refill tokens based on time elapsed
    const elapsed = now - entry.lastRefill;
    const refillRate = maxRequests / windowMs;
    const tokensToAdd = Math.floor(elapsed * refillRate);

    if (tokensToAdd > 0) {
      entry.tokens = Math.min(maxRequests, entry.tokens + tokensToAdd);
      entry.lastRefill = now;
    }

    // Check if request can proceed
    if (entry.tokens < 1) {
      // Calculate retry-after
      const retryAfter = Math.ceil((1 - entry.tokens) / refillRate / 1000);

      c.header('Retry-After', String(retryAfter));
      c.header('X-RateLimit-Limit', String(maxRequests));
      c.header('X-RateLimit-Remaining', '0');
      c.header('X-RateLimit-Reset', String(Math.ceil((entry.lastRefill + windowMs) / 1000)));

      return c.json(
        {
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter,
        },
        429
      );
    }

    // Consume a token
    entry.tokens -= 1;

    // Set rate limit headers
    c.header('X-RateLimit-Limit', String(maxRequests));
    c.header('X-RateLimit-Remaining', String(Math.floor(entry.tokens)));
    c.header('X-RateLimit-Reset', String(Math.ceil((entry.lastRefill + windowMs) / 1000)));

    return await next();
  });
}

/**
 * Stricter rate limit for sensitive endpoints (login, MFA)
 */
export function authRateLimitMiddleware() {
  return rateLimitMiddleware({
    maxRequests: 10,
    windowMs: 60 * 1000, // 10 per minute
    keyFn: (ip, path) => `auth:${ip}:${path}`,
  });
}

/**
 * Very strict rate limit for password reset/recovery
 */
export function recoveryRateLimitMiddleware() {
  return rateLimitMiddleware({
    maxRequests: 3,
    windowMs: 60 * 60 * 1000, // 3 per hour
    keyFn: (ip, path) => `recovery:${ip}`,
  });
}

/**
 * Get client IP from request
 */
function getClientIP(c: { req: { header: (name: string) => string | undefined } }): string {
  // Check forwarded headers (in order of preference)
  const forwardedFor = c.req.header('X-Forwarded-For');
  if (forwardedFor) {
    // Take the first IP in the chain (original client)
    const ip = forwardedFor.split(',')[0]?.trim();
    if (ip) return ip;
  }

  const realIP = c.req.header('X-Real-IP');
  if (realIP) return realIP;

  // Fallback to connection IP (not available in all environments)
  return 'unknown';
}

export default rateLimitMiddleware;
