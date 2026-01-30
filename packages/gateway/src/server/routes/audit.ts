/**
 * Audit Routes
 *
 * Audit log retrieval and export endpoints.
 *
 * @module @atlas/gateway/server/routes/audit
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { ServerEnv } from '../index.js';
import { getAuditService, type AuditEventType, type AuditSeverity } from '../../audit/audit-service.js';
import { NotFoundError, ForbiddenError } from '../middleware/error-handler.js';

const audit = new Hono<ServerEnv>();

// Event types and severities
const eventTypes: AuditEventType[] = [
  // Authentication events
  'auth:login',
  'auth:logout',
  'auth:mfa_verify',
  'auth:failed_login',
  // Approval workflow events
  'approval:created',
  'approval:approved',
  'approval:denied',
  'approval:expired',
  'approval:auto_approved',
  // Credential events
  'credential:created',
  'credential:accessed',
  'credential:rotated',
  'credential:deleted',
  // Security events
  'sandbox:execution',
  'sandbox:blocked',
  'security:injection_blocked',
  'security:exfiltration_blocked',
  'network:request_blocked',
  // Session events
  'session:created',
  'session:invalidated',
  'config:changed',
  // Trust regression events (V1 Rollout Plan)
  'trust:stale_data',
  'trust:silent_failure',
  'trust:behavior_change',
  'trust:user_report',
  'trust:memory_attribution',
  'trust:cascade_failure',
  'trust:signal_stop',
  // Rollout events
  'rollout:freeze',
  'rollout:unfreeze',
  'rollout:phase_change',
  'rollout:briefings_disabled',
  'rollout:briefings_enabled',
  'rollout:eligibility_assessed',
  'rollout:clean_day',
  'rollout:clean_days_reset',
];

const severities: AuditSeverity[] = ['info', 'warning', 'error', 'critical'];

// Validation schemas
const auditQuerySchema = z.object({
  type: z.string().optional(),
  severity: z.string().optional(),
  userId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(1000).optional().default(100),
  offset: z.coerce.number().min(0).optional().default(0),
});

const searchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
});

const exportQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  format: z.enum(['json', 'csv']).optional().default('json'),
});

/**
 * GET /api/audit/logs
 * Get audit logs with filters
 */
audit.get('/logs', zValidator('query', auditQuerySchema), async (c) => {
  const filters = c.req.valid('query');

  const auditService = getAuditService();

  // Parse type and severity arrays
  const typeArray = filters.type?.split(',').filter((t) => eventTypes.includes(t as AuditEventType));
  const severityArray = filters.severity
    ?.split(',')
    .filter((s) => severities.includes(s as AuditSeverity)) as AuditSeverity[] | undefined;

  const logs = await auditService.query({
    type: typeArray as AuditEventType[] | undefined,
    severity: severityArray,
    userId: filters.userId,
    startDate: filters.startDate ? new Date(filters.startDate) : undefined,
    endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    limit: filters.limit,
    offset: filters.offset,
  });

  return c.json(logs);
});

/**
 * GET /api/audit/logs/:id
 * Get a single audit log entry
 */
audit.get('/logs/:id', async (c) => {
  const id = c.req.param('id');

  const auditService = getAuditService();
  const entry = await auditService.getById(id);

  if (!entry) {
    throw new NotFoundError('Audit log', id);
  }

  return c.json(entry);
});

/**
 * GET /api/audit/stats
 * Get audit statistics
 */
audit.get('/stats', async (c) => {
  const auditService = getAuditService();
  const stats = await auditService.getStats();

  return c.json(stats);
});

/**
 * GET /api/audit/search
 * Search audit logs
 */
audit.get('/search', zValidator('query', searchQuerySchema), async (c) => {
  const { q, limit } = c.req.valid('query');

  const auditService = getAuditService();
  const results = await auditService.search(q, limit);

  return c.json(results);
});

/**
 * GET /api/audit/export
 * Export audit logs
 */
audit.get('/export', zValidator('query', exportQuerySchema), async (c) => {
  const { startDate, endDate, format } = c.req.valid('query');

  const auditService = getAuditService();
  const logs = await auditService.query({
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    limit: 10000, // Max export size
  });

  if (format === 'csv') {
    // Generate CSV
    const headers = ['id', 'type', 'severity', 'message', 'userId', 'timestamp', 'ipAddress'];
    const rows = logs.map((log) =>
      [
        log.id,
        log.type,
        log.severity,
        `"${log.message.replace(/"/g, '""')}"`,
        log.userId || '',
        log.timestamp,
        log.ipAddress || '',
      ].join(',')
    );

    const csv = [headers.join(','), ...rows].join('\n');

    c.header('Content-Type', 'text/csv');
    c.header('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
    return c.text(csv);
  }

  // JSON format
  c.header('Content-Type', 'application/json');
  c.header(
    'Content-Disposition',
    `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.json"`
  );
  return c.json(logs);
});

/**
 * GET /api/audit/types
 * Get available event types
 */
audit.get('/types', async (c) => {
  return c.json({
    eventTypes,
    severities,
  });
});

export default audit;
