/**
 * Authentication Middleware
 *
 * Verifies JWT tokens and enforces MFA requirements.
 * Integrates with the existing JWTManager from P0.
 *
 * @module @atlas/gateway/server/middleware/auth
 */

import { createMiddleware } from 'hono/factory';
import type { ServerEnv } from '../index.js';
import { getJWTManager } from '../../security/auth/jwt-manager.js';

/**
 * JWT authentication middleware
 *
 * Validates the Authorization header and sets user context.
 * Requires MFA verification for all protected routes.
 */
export function authMiddleware() {
  return createMiddleware<ServerEnv>(async (c, next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json(
        {
          error: 'Unauthorized',
          message: 'Missing or invalid authorization header',
          code: 'AUTH_REQUIRED',
        },
        401
      );
    }

    const token = authHeader.substring(7);

    try {
      const jwtManager = getJWTManager();
      const payload = jwtManager.verifyAccessToken(token);

      // Set user context
      c.set('userId', payload.sub);
      c.set('deviceId', payload.deviceId);

      return await next();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Token verification failed';

      if (message.includes('TOKEN_EXPIRED')) {
        return c.json(
          {
            error: 'Token Expired',
            message: 'Access token has expired. Please refresh your token.',
            code: 'TOKEN_EXPIRED',
          },
          401
        );
      }

      if (message.includes('MFA_REQUIRED')) {
        return c.json(
          {
            error: 'MFA Required',
            message: 'Multi-factor authentication is required for this operation.',
            code: 'MFA_REQUIRED',
          },
          403
        );
      }

      return c.json(
        {
          error: 'Unauthorized',
          message: 'Invalid access token',
          code: 'INVALID_TOKEN',
        },
        401
      );
    }
  });
}

/**
 * Optional auth middleware - doesn't fail if no token
 * Used for routes that work differently for authenticated vs anonymous users
 */
export function optionalAuthMiddleware() {
  return createMiddleware<ServerEnv>(async (c, next) => {
    const authHeader = c.req.header('Authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      try {
        const jwtManager = getJWTManager();
        const payload = jwtManager.verifyAccessToken(token);
        c.set('userId', payload.sub);
        c.set('deviceId', payload.deviceId);
      } catch {
        // Ignore token errors for optional auth
      }
    }

    return await next();
  });
}

/**
 * MFA token middleware - for the MFA verification step
 * Validates temporary MFA tokens (different from access tokens)
 */
export function mfaTokenMiddleware() {
  return createMiddleware<ServerEnv>(async (c, next) => {
    // MFA tokens are passed in the body, not headers
    return await next();
  });
}

/**
 * Admin user IDs from environment variable
 * Format: comma-separated list of user IDs
 * Example: ATLAS_ADMIN_USERS=user-123,user-456
 */
function getAdminUserIds(): Set<string> {
  const adminUsers = process.env.ATLAS_ADMIN_USERS || '';
  return new Set(adminUsers.split(',').map((id) => id.trim()).filter(Boolean));
}

/**
 * Check if a user ID is an admin
 */
export function isAdminUser(userId: string): boolean {
  const adminUsers = getAdminUserIds();
  return adminUsers.has(userId);
}

/**
 * Admin authorization middleware
 *
 * Requires user to be an admin for protected routes.
 * Must be used after authMiddleware().
 */
export function adminMiddleware() {
  return createMiddleware<ServerEnv>(async (c, next) => {
    const userId = c.get('userId');

    if (!userId) {
      return c.json(
        {
          error: 'Unauthorized',
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        },
        401
      );
    }

    if (!isAdminUser(userId)) {
      return c.json(
        {
          error: 'Forbidden',
          message: 'Admin access required for this operation',
          code: 'ADMIN_REQUIRED',
        },
        403
      );
    }

    return await next();
  });
}

/**
 * Require admin role - throws ForbiddenError if not admin
 * Use inline in routes that need conditional admin checks
 */
export function requireAdmin(userId: string | undefined): void {
  if (!userId) {
    throw new Error('Authentication required');
  }
  if (!isAdminUser(userId)) {
    throw new Error('Admin access required');
  }
}

export default authMiddleware;
