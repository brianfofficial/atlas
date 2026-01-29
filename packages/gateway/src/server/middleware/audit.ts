/**
 * Audit Middleware
 *
 * Logs all API requests to the audit trail.
 * Integrates with the P3.4 Audit Service.
 *
 * @module @atlas/gateway/server/middleware/audit
 */

import { createMiddleware } from 'hono/factory';
import type { ServerEnv } from '../index.js';
import { getAuditService, type AuditEventType } from '../../audit/audit-service.js';

/**
 * Map HTTP paths to audit event types
 */
function getAuditEventType(method: string, path: string): AuditEventType | null {
  // Auth events
  if (path.startsWith('/api/auth/login')) return 'auth:login';
  if (path.startsWith('/api/auth/logout')) return 'auth:logout';
  if (path.startsWith('/api/auth/mfa/verify')) return 'auth:mfa_verify';

  // Approval events
  if (path.includes('/approve')) return 'approval:approved';
  if (path.includes('/deny')) return 'approval:denied';
  if (path.startsWith('/api/approvals') && method === 'POST') return 'approval:created';

  // Credential events
  if (path.startsWith('/api/credentials')) {
    if (method === 'POST') return 'credential:created';
    if (method === 'DELETE') return 'credential:deleted';
    if (path.includes('/rotate')) return 'credential:rotated';
    return 'credential:accessed';
  }

  // Session events
  if (path.includes('/session')) return 'session:created';

  // Config events
  if (path.startsWith('/api/preferences') && (method === 'PUT' || method === 'PATCH')) {
    return 'config:changed';
  }

  return null;
}

/**
 * Audit middleware - logs all API requests
 */
export function auditMiddleware() {
  return createMiddleware<ServerEnv>(async (c, next) => {
    const startTime = c.get('startTime') ?? Date.now();
    const requestId = c.get('requestId');

    // Execute the request
    await next();

    // Get response status
    const status = c.res.status;
    const duration = Date.now() - startTime;

    // Determine event type
    const eventType = getAuditEventType(c.req.method, c.req.path);

    // Log to audit service
    const auditService = getAuditService();

    // Determine severity based on response status
    let severity: 'info' | 'warning' | 'error' | 'critical' = 'info';
    if (status >= 400 && status < 500) severity = 'warning';
    if (status >= 500) severity = 'error';

    // Log failed auth attempts as security events
    if (c.req.path.includes('/auth/login') && status === 401) {
      auditService.log({
        type: 'auth:failed_login',
        severity: 'warning',
        message: 'Failed login attempt',
        userId: undefined,
        sessionId: undefined,
        ipAddress: c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP'),
        userAgent: c.req.header('User-Agent'),
        metadata: {
          requestId,
          path: c.req.path,
          method: c.req.method,
          status,
          duration,
        },
      });
      return;
    }

    // Log other events
    if (eventType) {
      auditService.log({
        type: eventType,
        severity,
        message: `${c.req.method} ${c.req.path}`,
        userId: c.get('userId'),
        sessionId: c.get('sessionId'),
        ipAddress: c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP'),
        userAgent: c.req.header('User-Agent'),
        metadata: {
          requestId,
          status,
          duration,
        },
      });
    }
  });
}

export default auditMiddleware;
