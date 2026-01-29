/**
 * Approvals Routes
 *
 * Human-in-the-Loop approval workflow endpoints.
 * Integrates with ApprovalManager from P2.
 *
 * @module @atlas/gateway/server/routes/approvals
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { ServerEnv } from '../index.js';
import { getApprovalManager } from '../../workflows/approval-manager.js';
import { NotFoundError, ValidationError } from '../middleware/error-handler.js';
import { getEventBroadcaster } from '../../events/event-broadcaster.js';

const approvals = new Hono<ServerEnv>();

// Validation schemas
const approveSchema = z.object({
  remember: z.boolean().optional(),
  rememberScope: z.enum(['exact', 'similar', 'category']).optional(),
});

const denySchema = z.object({
  reason: z.string().optional(),
});

const historyQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

/**
 * GET /api/approvals/pending
 * Get all pending approval requests
 */
approvals.get('/pending', async (c) => {
  const manager = getApprovalManager();
  const pending = manager.getPending();

  // Convert to API format
  const requests = pending.map((req) => ({
    id: req.id,
    category: req.category,
    operation: req.operation,
    action: req.action,
    riskLevel: req.riskLevel,
    context: req.context,
    technicalDetails: req.technicalDetails,
    sessionId: req.sessionId,
    userId: req.userId,
    createdAt: req.createdAt.toISOString(),
    expiresAt: req.expiresAt.toISOString(),
    status: req.status,
    metadata: req.metadata,
  }));

  return c.json(requests);
});

/**
 * GET /api/approvals/history
 * Get approval audit history
 */
approvals.get('/history', zValidator('query', historyQuerySchema), async (c) => {
  const { limit, offset } = c.req.valid('query');
  const manager = getApprovalManager();

  const history = manager.getFullAuditTrail({ limit, offset });

  // Convert to API format
  const entries = history.map((entry) => ({
    id: entry.id,
    requestId: entry.requestId,
    action: entry.action,
    timestamp: entry.timestamp.toISOString(),
    userId: entry.userId,
    details: entry.details,
    ipAddress: entry.ipAddress,
  }));

  return c.json(entries);
});

/**
 * GET /api/approvals/stats
 * Get approval statistics
 */
approvals.get('/stats', async (c) => {
  const manager = getApprovalManager();
  const stats = manager.getStats();

  return c.json(stats);
});

/**
 * GET /api/approvals/:id
 * Get a specific approval request
 */
approvals.get('/:id', async (c) => {
  const id = c.req.param('id');
  const manager = getApprovalManager();

  const request = manager.getRequest(id);
  if (!request) {
    throw new NotFoundError('Approval request', id);
  }

  return c.json({
    id: request.id,
    category: request.category,
    operation: request.operation,
    action: request.action,
    riskLevel: request.riskLevel,
    context: request.context,
    technicalDetails: request.technicalDetails,
    sessionId: request.sessionId,
    userId: request.userId,
    createdAt: request.createdAt.toISOString(),
    expiresAt: request.expiresAt.toISOString(),
    status: request.status,
    metadata: request.metadata,
  });
});

/**
 * POST /api/approvals/:id/approve
 * Approve a pending request
 */
approvals.post('/:id/approve', zValidator('json', approveSchema), async (c) => {
  const id = c.req.param('id');
  const { remember, rememberScope } = c.req.valid('json');
  const userId = c.get('userId');

  const manager = getApprovalManager();

  try {
    const request = await manager.approve(id, {
      remember,
      rememberScope,
      userId,
    });

    // Broadcast event
    const broadcaster = getEventBroadcaster();
    broadcaster.broadcast('approval:resolved', {
      id: request.id,
      status: 'approved',
    });

    return c.json({
      id: request.id,
      category: request.category,
      operation: request.operation,
      action: request.action,
      riskLevel: request.riskLevel,
      context: request.context,
      status: 'approved',
      createdAt: request.createdAt.toISOString(),
      expiresAt: request.expiresAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        throw new NotFoundError('Approval request', id);
      }
      if (error.message.includes('not pending')) {
        throw new ValidationError('Request is no longer pending');
      }
    }
    throw error;
  }
});

/**
 * POST /api/approvals/:id/deny
 * Deny a pending request
 */
approvals.post('/:id/deny', zValidator('json', denySchema), async (c) => {
  const id = c.req.param('id');
  const { reason } = c.req.valid('json');
  const userId = c.get('userId');

  const manager = getApprovalManager();

  try {
    const request = await manager.deny(id, {
      reason,
      userId,
    });

    // Broadcast event
    const broadcaster = getEventBroadcaster();
    broadcaster.broadcast('approval:resolved', {
      id: request.id,
      status: 'denied',
    });

    return c.json({
      id: request.id,
      category: request.category,
      operation: request.operation,
      action: request.action,
      riskLevel: request.riskLevel,
      context: request.context,
      status: 'denied',
      createdAt: request.createdAt.toISOString(),
      expiresAt: request.expiresAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        throw new NotFoundError('Approval request', id);
      }
      if (error.message.includes('not pending')) {
        throw new ValidationError('Request is no longer pending');
      }
    }
    throw error;
  }
});

export default approvals;
