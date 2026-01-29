/**
 * Preferences Routes
 *
 * User preferences and goals management endpoints.
 *
 * @module @atlas/gateway/server/routes/preferences
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { ServerEnv } from '../index.js';
import { getPreferencesRepository } from '../../db/repositories/preferences.js';
import { getGoalsRepository } from '../../db/repositories/goals.js';
import { NotFoundError, ValidationError } from '../middleware/error-handler.js';

const preferences = new Hono<ServerEnv>();

// Validation schemas
const preferencesUpdateSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  notifications: z
    .object({
      email: z.boolean().optional(),
      push: z.boolean().optional(),
      security: z.boolean().optional(),
      suggestions: z.boolean().optional(),
    })
    .optional(),
  privacy: z
    .object({
      shareAnalytics: z.boolean().optional(),
      rememberHistory: z.boolean().optional(),
    })
    .optional(),
  ai: z
    .object({
      defaultModel: z.string().optional(),
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().min(1).max(100000).optional(),
      verbosity: z.enum(['concise', 'balanced', 'detailed']).optional(),
    })
    .optional(),
  security: z
    .object({
      sessionTimeout: z.number().min(5).max(1440).optional(), // 5 min to 24 hours
      requireMFAForSensitive: z.boolean().optional(),
      autoLockOnIdle: z.boolean().optional(),
    })
    .optional(),
});

const goalCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  category: z.enum(['personal', 'professional', 'health', 'learning', 'other']),
  priority: z.enum(['low', 'medium', 'high']),
  dueDate: z.string().datetime().optional(),
  progress: z.number().min(0).max(100).optional().default(0),
});

const goalUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  category: z.enum(['personal', 'professional', 'health', 'learning', 'other']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  dueDate: z.string().datetime().optional(),
  progress: z.number().min(0).max(100).optional(),
});

// Default preferences
const DEFAULT_PREFERENCES = {
  theme: 'system' as const,
  notifications: {
    email: true,
    push: true,
    security: true,
    suggestions: true,
  },
  privacy: {
    shareAnalytics: false,
    rememberHistory: true,
  },
  ai: {
    defaultModel: 'anthropic:claude-3-sonnet',
    temperature: 0.7,
    maxTokens: 4096,
    verbosity: 'balanced' as const,
  },
  security: {
    sessionTimeout: 15,
    requireMFAForSensitive: true,
    autoLockOnIdle: true,
  },
};

/**
 * GET /api/preferences
 * Get user preferences
 */
preferences.get('/', async (c) => {
  const userId = c.get('userId');

  if (!userId) {
    return c.json(DEFAULT_PREFERENCES);
  }

  const prefsRepo = getPreferencesRepository();
  const prefs = await prefsRepo.getByUserId(userId);

  // Merge with defaults
  return c.json({
    ...DEFAULT_PREFERENCES,
    ...prefs,
  });
});

/**
 * PUT /api/preferences
 * Update user preferences
 */
preferences.put('/', zValidator('json', preferencesUpdateSchema), async (c) => {
  const userId = c.get('userId');
  const updates = c.req.valid('json');

  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const prefsRepo = getPreferencesRepository();
  const updated = await prefsRepo.update(userId, updates);

  return c.json({
    ...DEFAULT_PREFERENCES,
    ...updated,
  });
});

/**
 * POST /api/preferences/reset
 * Reset preferences to defaults
 */
preferences.post('/reset', async (c) => {
  const userId = c.get('userId');

  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const prefsRepo = getPreferencesRepository();
  await prefsRepo.reset(userId);

  return c.json(DEFAULT_PREFERENCES);
});

/**
 * GET /api/preferences/goals
 * Get user goals
 */
preferences.get('/goals', async (c) => {
  const userId = c.get('userId');

  if (!userId) {
    return c.json([]);
  }

  const goalsRepo = getGoalsRepository();
  const goals = await goalsRepo.getByUserId(userId);

  return c.json(goals);
});

/**
 * POST /api/preferences/goals
 * Create a new goal
 */
preferences.post('/goals', zValidator('json', goalCreateSchema), async (c) => {
  const userId = c.get('userId');
  const goalData = c.req.valid('json');

  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const goalsRepo = getGoalsRepository();
  const goal = await goalsRepo.create(userId, goalData);

  return c.json(goal, 201);
});

/**
 * GET /api/preferences/goals/:id
 * Get a specific goal
 */
preferences.get('/goals/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const goalsRepo = getGoalsRepository();
  const goal = await goalsRepo.getById(id);

  if (!goal || goal.userId !== userId) {
    throw new NotFoundError('Goal', id);
  }

  return c.json(goal);
});

/**
 * PATCH /api/preferences/goals/:id
 * Update a goal
 */
preferences.patch('/goals/:id', zValidator('json', goalUpdateSchema), async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const updates = c.req.valid('json');

  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const goalsRepo = getGoalsRepository();
  const existing = await goalsRepo.getById(id);

  if (!existing || existing.userId !== userId) {
    throw new NotFoundError('Goal', id);
  }

  const updated = await goalsRepo.update(id, updates);

  return c.json(updated);
});

/**
 * DELETE /api/preferences/goals/:id
 * Delete a goal
 */
preferences.delete('/goals/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const goalsRepo = getGoalsRepository();
  const existing = await goalsRepo.getById(id);

  if (!existing || existing.userId !== userId) {
    throw new NotFoundError('Goal', id);
  }

  await goalsRepo.delete(id);

  return c.json({ success: true });
});

export default preferences;
