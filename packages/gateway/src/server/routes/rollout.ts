/**
 * Rollout & Trust Regression Routes
 *
 * API endpoints for the V1 Rollout & Trust Regression Plan.
 * Includes trust monitoring, rollout state, user reports, and daily review.
 *
 * @module @atlas/gateway/server/routes/rollout
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { ServerEnv } from '../index.js';
import { getTrustMonitor } from '../../rollout/trust-monitor.js';
import { getRolloutManager } from '../../rollout/rollout-manager.js';
import { getDailyReviewService } from '../../rollout/daily-review.js';
import { ValidationError, ForbiddenError } from '../middleware/error-handler.js';
import type {
  TrustStatusResponse,
  UserReportInput,
  UserEligibilityTraits,
  UserAntiTargetFlags,
} from '../../rollout/types.js';

const rollout = new Hono<ServerEnv>();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const userReportSchema = z.object({
  type: z.enum(['feels_wrong', 'data_mismatch', 'error_confusion', 'other']),
  description: z.string().min(1).max(2000),
  briefingId: z.string().optional(),
  sectionId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const freezeSchema = z.object({
  reason: z.string().min(1).max(500),
});

const unfreezeSchema = z.object({
  reason: z.string().min(1).max(500),
});

const disableBriefingsSchema = z.object({
  reason: z.string().min(1).max(500),
});

const enableBriefingsSchema = z.object({
  reason: z.string().min(1).max(500),
});

const eligibilitySchema = z.object({
  userId: z.string(),
  traits: z.object({
    technicalComfort: z.boolean(),
    healthySkepticism: z.boolean(),
    directChannel: z.boolean(),
    patience: z.boolean(),
    dailyToolUser: z.boolean(),
  }),
  antiTargets: z.object({
    expectsPolish: z.boolean(),
    ignoresErrors: z.boolean(),
    tooManyIntegrations: z.boolean(),
    nonUSTimezone: z.boolean(),
    needsAtlasToWork: z.boolean(),
  }),
});

const dailyReviewSchema = z.object({
  checks: z.object({
    failureRateCheck: z.object({ checked: z.boolean() }).optional(),
    retryRateCheck: z.object({ checked: z.boolean() }).optional(),
    trustAlertsCheck: z.object({ checked: z.boolean() }).optional(),
    userReportsCheck: z.object({ checked: z.boolean() }).optional(),
    builderBriefingCheck: z.object({
      feltRight: z.boolean(),
      notes: z.string().optional(),
      checked: z.boolean(),
    }).optional(),
    randomUserSpotCheck: z.object({
      userId: z.string().optional(),
      briefingId: z.string().optional(),
      notes: z.string().optional(),
      checked: z.boolean(),
    }).optional(),
  }).optional(),
  questions: z.object({
    builderFeelWrong: z.string().nullable().optional(),
  }).optional(),
  notes: z.string().optional(),
});

const retrySchema = z.object({
  sessionId: z.string(),
  briefingId: z.string().optional(),
  sectionId: z.string().optional(),
});

// ============================================================================
// TRUST STATUS
// ============================================================================

/**
 * GET /api/rollout/status
 * Get current trust status including all signals, rollout state, and expansion gate
 */
rollout.get('/status', async (c) => {
  const trustMonitor = getTrustMonitor();
  const rolloutManager = getRolloutManager();

  const [signals, rolloutState, expansionGate, recentRegressions] = await Promise.all([
    trustMonitor.measureAllSignals(),
    rolloutManager.getRolloutState(),
    rolloutManager.evaluateExpansionGate(),
    trustMonitor.getRecentRegressions(24),
  ]);

  // Determine overall status
  let overallStatus: 'normal' | 'warning' | 'stop' = 'normal';
  if (signals.some((s) => s.level === 'stop')) {
    overallStatus = 'stop';
  } else if (signals.some((s) => s.level === 'warning')) {
    overallStatus = 'warning';
  }

  const response: TrustStatusResponse = {
    rolloutState,
    signals,
    overallStatus,
    recentRegressions,
    expansionGate,
  };

  return c.json(response);
});

/**
 * GET /api/rollout/signals
 * Get recent trust signal measurements
 */
rollout.get('/signals', async (c) => {
  const hours = parseInt(c.req.query('hours') || '24', 10);
  const trustMonitor = getTrustMonitor();

  const signals = await trustMonitor.getRecentSignals(hours);

  return c.json({ signals });
});

/**
 * GET /api/rollout/signals/current
 * Get current (live) signal measurements
 */
rollout.get('/signals/current', async (c) => {
  const trustMonitor = getTrustMonitor();
  const signals = await trustMonitor.measureAllSignals();

  return c.json({ signals, measuredAt: new Date().toISOString() });
});

// ============================================================================
// USER REPORTS
// ============================================================================

/**
 * POST /api/rollout/report
 * Submit a user report ("feels wrong", data mismatch, etc.)
 * This is the highest priority action - may trigger immediate freeze
 */
rollout.post('/report', zValidator('json', userReportSchema), async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const input = c.req.valid('json') as UserReportInput;
  const trustMonitor = getTrustMonitor();
  const rolloutManager = getRolloutManager();

  // Map report type to trigger
  const triggerMap: Record<UserReportInput['type'], string> = {
    feels_wrong: 'user_trust_question',
    data_mismatch: 'user_data_mismatch',
    error_confusion: 'user_error_confusion',
    other: 'user_trust_question',
  };

  // Record the regression event
  const event = await trustMonitor.recordFeelsWrongReport(
    userId,
    input.description,
    {
      briefingId: input.briefingId,
      sectionId: input.sectionId,
      metadata: {
        reportType: input.type,
        ...input.metadata,
      },
    }
  );

  // For "feels_wrong" reports, trigger immediate freeze
  if (input.type === 'feels_wrong') {
    await rolloutManager.instantFreeze(
      `User report: ${input.description.substring(0, 100)}`,
      'system'
    );
  }

  return c.json({
    success: true,
    message: 'Report submitted. Thank you for helping us improve ATLAS.',
    eventId: event.id,
    frozeRollout: input.type === 'feels_wrong',
  });
});

/**
 * GET /api/rollout/regressions
 * Get recent regression events
 */
rollout.get('/regressions', async (c) => {
  const hours = parseInt(c.req.query('hours') || '24', 10);
  const trustMonitor = getTrustMonitor();

  const regressions = await trustMonitor.getRecentRegressions(hours);

  return c.json({ regressions });
});

// ============================================================================
// RETRY TRACKING
// ============================================================================

/**
 * POST /api/rollout/retry
 * Record a briefing retry (for signal tracking)
 */
rollout.post('/retry', zValidator('json', retrySchema), async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const { sessionId, briefingId, sectionId } = c.req.valid('json');
  const trustMonitor = getTrustMonitor();

  await trustMonitor.recordRetry(userId, sessionId, briefingId, sectionId);

  return c.json({ success: true });
});

// ============================================================================
// ROLLOUT STATE MANAGEMENT
// ============================================================================

/**
 * GET /api/rollout/state
 * Get current rollout state
 */
rollout.get('/state', async (c) => {
  const rolloutManager = getRolloutManager();
  const state = await rolloutManager.getRolloutState();

  return c.json(state);
});

/**
 * POST /api/rollout/freeze
 * Freeze the rollout (admin only)
 */
rollout.post('/freeze', zValidator('json', freezeSchema), async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    throw new ValidationError('User ID required');
  }

  // TODO: Add admin check
  // For now, any authenticated user can freeze (trust preservation > access control)

  const { reason } = c.req.valid('json');
  const rolloutManager = getRolloutManager();

  await rolloutManager.instantFreeze(reason, userId);

  return c.json({
    success: true,
    message: 'Rollout frozen.',
  });
});

/**
 * POST /api/rollout/unfreeze
 * Unfreeze the rollout (admin only)
 */
rollout.post('/unfreeze', zValidator('json', unfreezeSchema), async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    throw new ValidationError('User ID required');
  }

  // TODO: Add admin check

  const { reason } = c.req.valid('json');
  const rolloutManager = getRolloutManager();

  await rolloutManager.unfreeze(reason, userId);

  return c.json({
    success: true,
    message: 'Rollout unfrozen.',
  });
});

/**
 * POST /api/rollout/briefings/disable
 * Disable briefings (preserves data)
 */
rollout.post('/briefings/disable', zValidator('json', disableBriefingsSchema), async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const { reason } = c.req.valid('json');
  const rolloutManager = getRolloutManager();

  await rolloutManager.disableBriefings(reason);

  return c.json({
    success: true,
    message: 'Briefings disabled. Data preserved.',
  });
});

/**
 * POST /api/rollout/briefings/enable
 * Re-enable briefings
 */
rollout.post('/briefings/enable', zValidator('json', enableBriefingsSchema), async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const { reason } = c.req.valid('json');
  const rolloutManager = getRolloutManager();

  await rolloutManager.enableBriefings(reason);

  return c.json({
    success: true,
    message: 'Briefings re-enabled.',
  });
});

/**
 * GET /api/rollout/can-register
 * Check if registration is currently allowed
 */
rollout.get('/can-register', async (c) => {
  const rolloutManager = getRolloutManager();
  const result = await rolloutManager.canRegister();

  return c.json(result);
});

/**
 * GET /api/rollout/can-access-briefings
 * Check if briefings are currently available
 */
rollout.get('/can-access-briefings', async (c) => {
  const rolloutManager = getRolloutManager();
  const result = await rolloutManager.canAccessBriefings();

  return c.json(result);
});

// ============================================================================
// EXPANSION GATES
// ============================================================================

/**
 * GET /api/rollout/expansion-gate
 * Get expansion gate status
 */
rollout.get('/expansion-gate', async (c) => {
  const rolloutManager = getRolloutManager();
  const status = await rolloutManager.evaluateExpansionGate();

  return c.json(status);
});

/**
 * POST /api/rollout/advance-phase
 * Attempt to advance to next rollout phase (admin only)
 */
rollout.post('/advance-phase', async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    throw new ValidationError('User ID required');
  }

  // TODO: Add admin check

  const rolloutManager = getRolloutManager();
  const result = await rolloutManager.tryAdvancePhase();

  return c.json(result);
});

// ============================================================================
// USER ELIGIBILITY
// ============================================================================

/**
 * POST /api/rollout/eligibility/assess
 * Assess a user's eligibility for V1 (admin only)
 */
rollout.post('/eligibility/assess', zValidator('json', eligibilitySchema), async (c) => {
  const assessedBy = c.get('userId');
  if (!assessedBy) {
    throw new ValidationError('User ID required');
  }

  const { userId, traits, antiTargets } = c.req.valid('json');
  const rolloutManager = getRolloutManager();

  const assessment = await rolloutManager.assessEligibility(
    userId,
    traits as UserEligibilityTraits,
    antiTargets as UserAntiTargetFlags,
    assessedBy
  );

  return c.json(assessment);
});

/**
 * GET /api/rollout/eligibility/:userId
 * Get a user's eligibility status
 */
rollout.get('/eligibility/:userId', async (c) => {
  const userId = c.req.param('userId');
  const rolloutManager = getRolloutManager();

  const assessment = await rolloutManager.getUserEligibility(userId);

  if (!assessment) {
    return c.json({ eligible: false, assessed: false });
  }

  return c.json(assessment);
});

// ============================================================================
// DAILY REVIEW
// ============================================================================

/**
 * GET /api/rollout/daily-review
 * Get daily review data for builder
 */
rollout.get('/daily-review', async (c) => {
  const dailyReviewService = getDailyReviewService();
  const data = await dailyReviewService.getDailyReviewData();

  return c.json(data);
});

/**
 * POST /api/rollout/daily-review/complete
 * Mark daily review as complete with updates
 */
rollout.post('/daily-review/complete', zValidator('json', dailyReviewSchema), async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const updates = c.req.valid('json');
  const dailyReviewService = getDailyReviewService();

  const checklist = await dailyReviewService.completeReview(userId, updates);

  return c.json({
    success: true,
    checklist,
  });
});

/**
 * GET /api/rollout/daily-review/spot-check
 * Get a random user's briefing for spot-check
 */
rollout.get('/daily-review/spot-check', async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const dailyReviewService = getDailyReviewService();
  const briefing = await dailyReviewService.getRandomUserBriefingForSpotCheck(userId);

  if (!briefing) {
    return c.json({ available: false, message: 'No other users with briefings to spot-check' });
  }

  return c.json({ available: true, briefing });
});

export default rollout;
