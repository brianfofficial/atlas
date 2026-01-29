/**
 * Models Routes
 *
 * AI model configuration and cost tracking endpoints.
 * Integrates with the model router from P1.2.
 *
 * @module @atlas/gateway/server/routes/models
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { ServerEnv } from '../index.js';
import { getModelRouter } from '../../models/router.js';
import { getCostTracker, type TimePeriod } from '../../models/cost-tracker.js';
import { getPreferencesRepository } from '../../db/repositories/preferences.js';
import { ValidationError } from '../middleware/error-handler.js';

const models = new Hono<ServerEnv>();

// Validation schemas
const selectionUpdateSchema = z.object({
  defaultModel: z.string().optional(),
  fallbackModel: z.string().optional(),
  routing: z
    .object({
      simple: z.array(z.string()).optional(),
      moderate: z.array(z.string()).optional(),
      complex: z.array(z.string()).optional(),
    })
    .optional(),
  budgetLimit: z
    .object({
      daily: z.number().min(0).optional(),
      weekly: z.number().min(0).optional(),
      monthly: z.number().min(0).optional(),
    })
    .optional(),
});

const budgetSchema = z.object({
  daily: z.number().min(0).optional(),
  weekly: z.number().min(0).optional(),
  monthly: z.number().min(0).optional(),
});

const usageQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month', 'all']).optional().default('month'),
});

/**
 * GET /api/models
 * Get available AI models
 */
models.get('/', async (c) => {
  const router = getModelRouter();
  const localModels = await router.getLocalModels();

  return c.json(localModels);
});

/**
 * GET /api/models/selection
 * Get current model routing configuration
 */
models.get('/selection', async (c) => {
  const userId = c.get('userId');
  const prefsRepo = getPreferencesRepository();

  // Get user's model preferences or defaults
  const prefs = userId ? await prefsRepo.getByUserId(userId) : null;
  const router = getModelRouter();
  const config = router.getConfig();
  const costTracker = getCostTracker();
  const budgetConfig = costTracker.getBudgetConfig();

  const selection = {
    routing: config.routingRules,
    fallbackChain: config.fallbackChain,
    maxLatencyMs: config.maxLatencyMs,
    autoDetectComplexity: config.autoDetectComplexity,
    budgetLimit: {
      daily: prefs?.ai?.budget?.daily ?? budgetConfig.dailyLimit,
      weekly: prefs?.ai?.budget?.weekly ?? budgetConfig.weeklyLimit,
      monthly: prefs?.ai?.budget?.monthly ?? budgetConfig.monthlyLimit,
    },
    defaultModel: prefs?.ai?.defaultModel,
  };

  return c.json(selection);
});

/**
 * PUT /api/models/selection
 * Update model routing configuration
 */
models.put('/selection', zValidator('json', selectionUpdateSchema), async (c) => {
  const userId = c.get('userId');
  const updates = c.req.valid('json');

  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const prefsRepo = getPreferencesRepository();
  const currentPrefs = await prefsRepo.getByUserId(userId);

  // Merge updates
  const aiPrefs = {
    ...currentPrefs?.ai,
    ...(updates.defaultModel && { defaultModel: updates.defaultModel }),
    ...(updates.budgetLimit && { budget: updates.budgetLimit }),
  };

  await prefsRepo.updateAiPreferences(userId, aiPrefs);

  // Update routing config if provided
  if (updates.routing) {
    const router = getModelRouter();
    router.updateConfig({
      routingRules: {
        simple: updates.routing.simple ?? [],
        moderate: updates.routing.moderate ?? [],
        complex: updates.routing.complex ?? [],
      },
    });
  }

  // Update budget config if provided
  if (updates.budgetLimit) {
    const costTracker = getCostTracker();
    costTracker.updateBudget({
      dailyLimit: updates.budgetLimit.daily,
      weeklyLimit: updates.budgetLimit.weekly,
      monthlyLimit: updates.budgetLimit.monthly,
    });
  }

  return c.json({
    defaultModel: updates.defaultModel || currentPrefs?.ai?.defaultModel,
    fallbackModel: updates.fallbackModel,
    routing: updates.routing,
    budgetLimit: updates.budgetLimit || currentPrefs?.ai?.budget,
  });
});

/**
 * GET /api/models/usage
 * Get model usage statistics
 */
models.get('/usage', zValidator('query', usageQuerySchema), async (c) => {
  const { period } = c.req.valid('query');

  const costTracker = getCostTracker();
  const summary = costTracker.getSummary(period as TimePeriod);

  return c.json({
    period,
    totalCost: summary.totalCost,
    totalInputTokens: summary.totalInputTokens,
    totalOutputTokens: summary.totalOutputTokens,
    byProvider: summary.byProvider,
    byModel: summary.byModel,
    entryCount: summary.entries.length,
  });
});

/**
 * GET /api/models/costs
 * Get cost summary
 */
models.get('/costs', async (c) => {
  const costTracker = getCostTracker();

  const daySummary = costTracker.getSummary('day');
  const weekSummary = costTracker.getSummary('week');
  const monthSummary = costTracker.getSummary('month');
  const budgetConfig = costTracker.getBudgetConfig();

  return c.json({
    today: daySummary.totalCost,
    thisWeek: weekSummary.totalCost,
    thisMonth: monthSummary.totalCost,
    projected: costTracker.getProjectedMonthlySpend(),
    budget: {
      daily: budgetConfig.dailyLimit,
      weekly: budgetConfig.weeklyLimit,
      monthly: budgetConfig.monthlyLimit,
    },
    utilization: {
      daily: costTracker.getBudgetUtilization('daily'),
      weekly: costTracker.getBudgetUtilization('weekly'),
      monthly: costTracker.getBudgetUtilization('monthly'),
    },
    byProvider: monthSummary.byProvider,
    byModel: monthSummary.byModel,
    dailyBreakdown: costTracker.getDailyBreakdown(),
  });
});

/**
 * POST /api/models/:modelId/test
 * Test a model connection
 */
models.post('/:modelId/test', async (c) => {
  const modelId = c.req.param('modelId');
  const router = getModelRouter();

  try {
    const startTime = Date.now();
    // Use the route method with a simple test prompt
    const response = await router.route({
      prompt: 'Say "test successful" and nothing else.',
      maxTokens: 20,
    });
    const latencyMs = Date.now() - startTime;

    return c.json({
      success: response.finishReason !== 'error',
      latencyMs,
      model: response.model,
      provider: response.provider,
      error: response.error,
    });
  } catch (error) {
    return c.json({
      success: false,
      latencyMs: 0,
      model: modelId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/models/budget
 * Set budget limits
 */
models.put('/budget', zValidator('json', budgetSchema), async (c) => {
  const userId = c.get('userId');
  const limits = c.req.valid('json');

  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const prefsRepo = getPreferencesRepository();
  await prefsRepo.updateAiPreferences(userId, {
    budget: limits,
  });

  // Update the cost tracker
  const costTracker = getCostTracker();
  costTracker.updateBudget({
    dailyLimit: limits.daily,
    weeklyLimit: limits.weekly,
    monthlyLimit: limits.monthly,
  });

  return c.json({
    budgetLimit: limits,
  });
});

/**
 * GET /api/models/health
 * Get provider health status
 */
models.get('/health', async (c) => {
  const router = getModelRouter();
  const providerStatus = await router.refreshAllProviders();

  const health: Record<string, object> = {};
  for (const [provider, status] of providerStatus) {
    health[provider] = {
      isAvailable: status.isAvailable,
      availableModels: status.availableModels,
      lastChecked: status.lastChecked,
      error: status.error,
    };
  }

  return c.json(health);
});

/**
 * GET /api/models/local
 * Check if local models are available
 */
models.get('/local', async (c) => {
  const router = getModelRouter();
  const hasLocal = await router.hasLocalModels();
  const localModels = await router.getLocalModels();

  return c.json({
    available: hasLocal,
    models: localModels,
  });
});

export default models;
