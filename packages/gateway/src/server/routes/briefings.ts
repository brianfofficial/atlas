/**
 * Briefings Routes
 *
 * API endpoints for the ATLAS Product Validation Framework.
 * Supports daily/weekly briefings, draft approval workflow, metrics, and experiments.
 *
 * @module @atlas/gateway/server/routes/briefings
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { ServerEnv } from '../index.js';
import { getBriefingService } from '../../briefings/briefing-service.js';
import { NotFoundError, ValidationError } from '../middleware/error-handler.js';

const briefings = new Hono<ServerEnv>();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const briefingTypeSchema = z.enum(['daily', 'weekly']);

const historyQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  pageSize: z.coerce.number().min(1).max(50).optional().default(10),
  type: z.enum(['daily', 'weekly']).optional(),
});

const approveDraftSchema = z.object({
  executeImmediately: z.boolean().optional().default(true),
});

const dismissDraftSchema = z.object({
  reason: z.string().optional(),
});

const editDraftSchema = z.object({
  content: z.string().min(1),
  executeImmediately: z.boolean().optional().default(true),
});

const scheduleUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  hour: z.number().min(0).max(23).optional(),
  minute: z.number().min(0).max(59).optional(),
  timezone: z.string().optional(),
  dayOfWeek: z.number().min(0).max(6).optional(),
  deliveryMethod: z.enum(['push', 'email', 'both']).optional(),
});

const pinMemorySchema = z.object({
  type: z.enum(['relationship', 'preference', 'pattern', 'important_context']),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  validUntil: z.string().datetime().optional(),
});

const reportMissedSchema = z.object({
  description: z.string().min(1),
  feedback: z.string().optional(),
});

const reportRegretSchema = z.object({
  description: z.string().optional(),
});

// ============================================================================
// TODAY'S BRIEFING
// ============================================================================

/**
 * GET /api/briefings/today
 * Get today's briefing (generates if not exists)
 */
briefings.get('/today', async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const service = getBriefingService();
  const briefing = await service.getOrGenerateTodaysBriefing(userId);

  return c.json(briefing);
});

/**
 * POST /api/briefings/generate
 * Manually trigger briefing generation
 */
briefings.post(
  '/generate',
  zValidator('json', z.object({ type: briefingTypeSchema })),
  async (c) => {
    const userId = c.get('userId');
    if (!userId) {
      throw new ValidationError('User ID required');
    }

    const { type } = c.req.valid('json');
    const service = getBriefingService();

    const result = await service.triggerBriefing(userId, type);

    return c.json({
      success: true,
      briefingId: result.briefingId,
      type,
    });
  }
);

// ============================================================================
// HISTORY
// ============================================================================

/**
 * GET /api/briefings/history
 * Get briefing history with pagination
 */
briefings.get('/history', zValidator('query', historyQuerySchema), async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const { page, pageSize, type } = c.req.valid('query');
  const service = getBriefingService();

  const history = await service.getBriefingHistory(userId, {
    page,
    pageSize,
    type,
  });

  return c.json(history);
});

// ============================================================================
// DRAFT ACTIONS
// ============================================================================

/**
 * POST /api/briefings/drafts/:id/approve
 * Approve a draft item
 */
briefings.post(
  '/drafts/:id/approve',
  zValidator('json', approveDraftSchema),
  async (c) => {
    const userId = c.get('userId');
    const itemId = c.req.param('id');

    if (!userId) {
      throw new ValidationError('User ID required');
    }

    const service = getBriefingService();

    try {
      const result = await service.approveDraft(userId, itemId);

      return c.json({
        success: result.success,
        itemId,
        undoDeadline: result.undoDeadline,
        undoAvailable: true,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          throw new NotFoundError('Draft item', itemId);
        }
        if (error.message.includes('Unauthorized')) {
          throw new ValidationError('Not authorized to approve this item');
        }
      }
      throw error;
    }
  }
);

/**
 * POST /api/briefings/drafts/:id/dismiss
 * Dismiss a draft item
 */
briefings.post(
  '/drafts/:id/dismiss',
  zValidator('json', dismissDraftSchema),
  async (c) => {
    const userId = c.get('userId');
    const itemId = c.req.param('id');

    if (!userId) {
      throw new ValidationError('User ID required');
    }

    const { reason } = c.req.valid('json');
    const service = getBriefingService();

    try {
      await service.dismissDraft(userId, itemId, reason);

      return c.json({
        success: true,
        itemId,
        status: 'dismissed',
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          throw new NotFoundError('Draft item', itemId);
        }
        if (error.message.includes('Unauthorized')) {
          throw new ValidationError('Not authorized to dismiss this item');
        }
      }
      throw error;
    }
  }
);

/**
 * POST /api/briefings/drafts/:id/edit
 * Edit and approve a draft item
 */
briefings.post(
  '/drafts/:id/edit',
  zValidator('json', editDraftSchema),
  async (c) => {
    const userId = c.get('userId');
    const itemId = c.req.param('id');

    if (!userId) {
      throw new ValidationError('User ID required');
    }

    const { content } = c.req.valid('json');
    const service = getBriefingService();

    try {
      const result = await service.editAndApproveDraft(userId, itemId, content);

      return c.json({
        success: result.success,
        itemId,
        undoDeadline: result.undoDeadline,
        undoAvailable: true,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          throw new NotFoundError('Draft item', itemId);
        }
        if (error.message.includes('Unauthorized')) {
          throw new ValidationError('Not authorized to edit this item');
        }
      }
      throw error;
    }
  }
);

/**
 * POST /api/briefings/drafts/:id/undo
 * Undo an executed draft (within 30-second window)
 */
briefings.post('/drafts/:id/undo', async (c) => {
  const userId = c.get('userId');
  const itemId = c.req.param('id');

  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const service = getBriefingService();

  // Check if undo is still available
  const undoStatus = service.canUndoDraft(itemId);
  if (!undoStatus.available) {
    throw new ValidationError('Undo window has expired or is not available');
  }

  try {
    const success = await service.undoDraft(userId, itemId);

    return c.json({
      success,
      itemId,
      status: 'undone',
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized')) {
        throw new ValidationError('Not authorized to undo this item');
      }
    }
    throw error;
  }
});

/**
 * GET /api/briefings/drafts/:id/undo-status
 * Check undo availability for a draft
 */
briefings.get('/drafts/:id/undo-status', async (c) => {
  const itemId = c.req.param('id');
  const service = getBriefingService();

  const status = service.canUndoDraft(itemId);

  return c.json({
    itemId,
    undoAvailable: status.available,
    remainingMs: status.remainingMs,
    remainingSeconds: status.remainingMs ? Math.ceil(status.remainingMs / 1000) : 0,
  });
});

/**
 * POST /api/briefings/:id/complete
 * Mark a briefing as completed (all items resolved)
 */
briefings.post('/:id/complete', async (c) => {
  const userId = c.get('userId');
  const briefingId = c.req.param('id');

  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const service = getBriefingService();

  try {
    await service.completeBriefing(userId, briefingId);

    return c.json({
      success: true,
      briefingId,
      status: 'completed',
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        throw new NotFoundError('Briefing', briefingId);
      }
      if (error.message.includes('Unauthorized')) {
        throw new ValidationError('Not authorized to complete this briefing');
      }
    }
    throw error;
  }
});

// ============================================================================
// METRICS & DASHBOARD
// ============================================================================

/**
 * GET /api/briefings/metrics
 * Get full metrics dashboard
 */
briefings.get('/metrics', async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const service = getBriefingService();
  const metrics = await service.getMetricsDashboard(userId);

  return c.json(metrics);
});

/**
 * GET /api/briefings/experiment
 * Get 7-day experiment status (if applicable)
 */
briefings.get('/experiment', async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const service = getBriefingService();
  const status = await service.getExperimentStatus(userId);

  if (!status) {
    return c.json({
      inExperiment: false,
      message: 'User is past the 7-day experiment window',
    });
  }

  return c.json({
    inExperiment: true,
    ...status,
  });
});

// ============================================================================
// SCHEDULE MANAGEMENT
// ============================================================================

/**
 * GET /api/briefings/schedule
 * Get user's briefing schedule
 */
briefings.get('/schedule', async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const service = getBriefingService();
  const schedule = await service.getSchedule(userId);

  return c.json(schedule);
});

/**
 * PUT /api/briefings/schedule/daily
 * Update daily briefing schedule
 */
briefings.put(
  '/schedule/daily',
  zValidator('json', scheduleUpdateSchema),
  async (c) => {
    const userId = c.get('userId');
    if (!userId) {
      throw new ValidationError('User ID required');
    }

    const updates = c.req.valid('json');
    const service = getBriefingService();

    await service.updateSchedule(userId, 'daily', updates);

    return c.json({
      success: true,
      type: 'daily',
      ...updates,
    });
  }
);

/**
 * PUT /api/briefings/schedule/weekly
 * Update weekly briefing schedule
 */
briefings.put(
  '/schedule/weekly',
  zValidator('json', scheduleUpdateSchema),
  async (c) => {
    const userId = c.get('userId');
    if (!userId) {
      throw new ValidationError('User ID required');
    }

    const updates = c.req.valid('json');
    const service = getBriefingService();

    await service.updateSchedule(userId, 'weekly', updates);

    return c.json({
      success: true,
      type: 'weekly',
      ...updates,
    });
  }
);

// ============================================================================
// PINNED MEMORIES
// ============================================================================

/**
 * GET /api/briefings/memories
 * Get user's pinned memories
 */
briefings.get('/memories', async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const service = getBriefingService();
  const memories = await service.getPinnedMemories(userId);

  return c.json({ memories });
});

/**
 * POST /api/briefings/memories
 * Pin a new memory
 */
briefings.post('/memories', zValidator('json', pinMemorySchema), async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const data = c.req.valid('json');
  const service = getBriefingService();

  const memory = await service.pinMemory(userId, data);

  return c.json(memory, 201);
});

/**
 * DELETE /api/briefings/memories/:id
 * Unpin a memory
 */
briefings.delete('/memories/:id', async (c) => {
  const userId = c.get('userId');
  const memoryId = c.req.param('id');

  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const service = getBriefingService();
  await service.unpinMemory(userId, memoryId);

  return c.json({
    success: true,
    memoryId,
    status: 'unpinned',
  });
});

// ============================================================================
// TRUST FAILURE REPORTING
// ============================================================================

/**
 * POST /api/briefings/feedback/missed
 * Report that ATLAS missed something important
 */
briefings.post(
  '/feedback/missed',
  zValidator('json', reportMissedSchema),
  async (c) => {
    const userId = c.get('userId');
    if (!userId) {
      throw new ValidationError('User ID required');
    }

    const { description, feedback } = c.req.valid('json');
    const service = getBriefingService();

    await service.reportMissedImportant(userId, description, feedback);

    return c.json({
      success: true,
      type: 'missed_critical',
      message: 'Thank you for your feedback. We will improve.',
    });
  }
);

/**
 * POST /api/briefings/feedback/regret/:itemId
 * Report regret after approving a draft
 */
briefings.post(
  '/feedback/regret/:itemId',
  zValidator('json', reportRegretSchema),
  async (c) => {
    const userId = c.get('userId');
    const itemId = c.req.param('itemId');

    if (!userId) {
      throw new ValidationError('User ID required');
    }

    const { description } = c.req.valid('json');
    const service = getBriefingService();

    await service.reportRegret(userId, itemId, description);

    return c.json({
      success: true,
      type: 'automator_regret',
      itemId,
      message: 'Thank you for your feedback. We will improve.',
    });
  }
);

export default briefings;
