/**
 * Briefing Service
 *
 * Main orchestrator for the ATLAS Product Validation Framework.
 * Coordinates briefing generation, approval workflows, metrics tracking,
 * and experiment management.
 *
 * @module @atlas/gateway/briefings/briefing-service
 */

import { v4 as uuid } from 'uuid';
import type { Database } from '../db/index.js';
import { briefingDrafts, draftItems, briefingHistory, pinnedMemories, users } from '../db/schema.js';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import {
  BriefingType,
  BriefingContent,
  DraftItemData,
  TodaysBriefingResponse,
  BriefingHistoryResponse,
  MetricsDashboardResponse,
  ExperimentStatus,
  PinnedMemoryData,
  MetricType,
} from './types.js';
import {
  BriefingGenerator,
  initializeBriefingGenerator,
  getBriefingGenerator,
} from './briefing-generator.js';
import {
  MetricsTracker,
  initializeMetricsTracker,
  getMetricsTracker,
} from './metrics-tracker.js';
import {
  DraftApprovalWorkflow,
  initializeDraftApprovalWorkflow,
  getDraftApprovalWorkflow,
} from './draft-approval-workflow.js';
import {
  BriefingScheduler,
  initializeBriefingScheduler,
  getBriefingScheduler,
} from './briefing-scheduler.js';
import { getEventBroadcaster } from '../events/event-broadcaster.js';

/**
 * Configuration for the briefing service
 */
export interface BriefingServiceConfig {
  enableScheduler?: boolean;
  experimentMode?: boolean;
}

/**
 * BriefingService - Main orchestrator
 */
export class BriefingService {
  private db: Database;
  private generator: BriefingGenerator;
  private metricsTracker: MetricsTracker;
  private approvalWorkflow: DraftApprovalWorkflow;
  private scheduler: BriefingScheduler;
  private config: BriefingServiceConfig;

  constructor(db: Database, config: BriefingServiceConfig = {}) {
    this.db = db;
    this.config = {
      enableScheduler: true,
      experimentMode: false,
      ...config,
    };

    // Initialize all subsystems
    this.metricsTracker = initializeMetricsTracker(db);
    this.generator = initializeBriefingGenerator(db);
    this.approvalWorkflow = initializeDraftApprovalWorkflow(db);
    this.scheduler = initializeBriefingScheduler(db);
  }

  /**
   * Start the briefing service
   */
  start(): void {
    if (this.config.enableScheduler) {
      this.scheduler.start();
    }
    console.log('[BriefingService] Started');
  }

  /**
   * Stop the briefing service
   */
  stop(): void {
    this.scheduler.stop();
    this.approvalWorkflow.shutdown();
    console.log('[BriefingService] Stopped');
  }

  // ============================================================================
  // BRIEFING RETRIEVAL
  // ============================================================================

  /**
   * Get today's briefing for a user
   */
  async getTodaysBriefing(userId: string): Promise<TodaysBriefingResponse | null> {
    const today = new Date().toISOString().split('T')[0];

    // Find today's pending or approved briefing
    const briefing = await this.db
      .select()
      .from(briefingDrafts)
      .where(
        and(
          eq(briefingDrafts.userId, userId),
          eq(briefingDrafts.type, 'daily'),
          gte(briefingDrafts.generatedAt, `${today}T00:00:00`),
          lte(briefingDrafts.generatedAt, `${today}T23:59:59`)
        )
      )
      .orderBy(desc(briefingDrafts.generatedAt))
      .limit(1);

    if (!briefing[0]) {
      return null;
    }

    const b = briefing[0];

    // Get draft items
    const items = await this.db
      .select()
      .from(draftItems)
      .where(eq(draftItems.briefingId, b.id));

    // Get metrics
    const metrics = await this.getUserMetricsSummary(userId);

    // Record view
    if (!b.viewedAt) {
      await this.db
        .update(briefingDrafts)
        .set({ viewedAt: new Date().toISOString() })
        .where(eq(briefingDrafts.id, b.id));

      await this.metricsTracker.recordBriefingView(userId);
    }

    return {
      briefing: {
        id: b.id,
        type: b.type as BriefingType,
        status: b.status as any,
        generatedAt: b.generatedAt,
        content: JSON.parse(b.content) as BriefingContent,
      },
      draftItems: items.map((item) => ({
        id: item.id,
        briefingId: item.briefingId,
        userId: item.userId,
        type: item.type as any,
        surface: item.surface as any,
        title: item.title,
        content: item.content,
        context: item.context || undefined,
        source: item.sourceType
          ? { type: item.sourceType as any, id: item.sourceId || '' }
          : undefined,
        priority: item.priority as 1 | 2 | 3 | 4 | 5,
        estimatedTimeToReview: 15,
        status: item.status as any,
        createdAt: item.createdAt,
      })),
      metrics: {
        currentStreak: metrics.currentStreak,
        totalApprovalsToday: metrics.totalApprovalsToday,
        averageTTFA: metrics.averageTTFA,
      },
    };
  }

  /**
   * Get or generate today's briefing
   */
  async getOrGenerateTodaysBriefing(userId: string): Promise<TodaysBriefingResponse> {
    // Try to get existing
    const existing = await this.getTodaysBriefing(userId);
    if (existing) {
      return existing;
    }

    // Generate new
    const result = await this.generator.generateDailyBriefing(userId);

    // Record session as user-initiated since they're requesting it
    await this.metricsTracker.recordSession(userId, 'user_initiated');

    return this.getTodaysBriefing(userId) as Promise<TodaysBriefingResponse>;
  }

  /**
   * Get briefing history
   */
  async getBriefingHistory(
    userId: string,
    options: {
      page?: number;
      pageSize?: number;
      type?: BriefingType;
    } = {}
  ): Promise<BriefingHistoryResponse> {
    const page = options.page || 1;
    const pageSize = options.pageSize || 10;
    const offset = (page - 1) * pageSize;

    // Build query conditions
    const conditions = [eq(briefingHistory.userId, userId)];
    if (options.type) {
      conditions.push(eq(briefingHistory.type, options.type));
    }

    // Get total count
    const countResult = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(briefingHistory)
      .where(and(...conditions));
    const totalCount = countResult[0]?.count || 0;

    // Get paginated results
    const history = await this.db
      .select()
      .from(briefingHistory)
      .where(and(...conditions))
      .orderBy(desc(briefingHistory.generatedAt))
      .limit(pageSize)
      .offset(offset);

    return {
      briefings: history.map((h) => ({
        id: h.id,
        type: h.type as BriefingType,
        generatedAt: h.generatedAt,
        viewedAt: h.viewedAt || undefined,
        stats: {
          totalItems: h.totalItems,
          approvedItems: h.approvedItems,
          dismissedItems: h.dismissedItems,
          editedItems: h.editedItems,
        },
      })),
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    };
  }

  // ============================================================================
  // DRAFT ACTIONS
  // ============================================================================

  /**
   * Approve a draft item
   */
  async approveDraft(
    userId: string,
    itemId: string
  ): Promise<{ success: boolean; undoDeadline?: string }> {
    const result = await this.approvalWorkflow.approve(userId, itemId);
    return {
      success: result.success,
      undoDeadline: result.undoDeadline,
    };
  }

  /**
   * Dismiss a draft item
   */
  async dismissDraft(
    userId: string,
    itemId: string,
    reason?: string
  ): Promise<void> {
    await this.approvalWorkflow.dismiss(userId, itemId, reason);
  }

  /**
   * Edit and approve a draft item
   */
  async editAndApproveDraft(
    userId: string,
    itemId: string,
    editedContent: string
  ): Promise<{ success: boolean; undoDeadline?: string }> {
    const result = await this.approvalWorkflow.editAndApprove(
      userId,
      itemId,
      editedContent
    );
    return {
      success: result.success,
      undoDeadline: result.undoDeadline,
    };
  }

  /**
   * Undo an executed draft
   */
  async undoDraft(userId: string, itemId: string): Promise<boolean> {
    return this.approvalWorkflow.undo(userId, itemId);
  }

  /**
   * Check if undo is available
   */
  canUndoDraft(itemId: string): { available: boolean; remainingMs?: number } {
    return this.approvalWorkflow.canUndo(itemId);
  }

  /**
   * Complete a briefing (all items resolved)
   */
  async completeBriefing(userId: string, briefingId: string): Promise<void> {
    await this.approvalWorkflow.completeBriefing(userId, briefingId);
  }

  // ============================================================================
  // METRICS & DASHBOARD
  // ============================================================================

  /**
   * Get full metrics dashboard
   */
  async getMetricsDashboard(userId: string): Promise<MetricsDashboardResponse> {
    // Get user info
    const user = await this.db
      .select({ createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const signupDate = user[0] ? new Date(user[0].createdAt) : new Date();
    const daysSinceSignup = Math.floor(
      (Date.now() - signupDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate all metrics
    const [
      daarTrend,
      ttfaTrend,
      darTrend,
      editRateTrend,
      secondSurface,
      unpromptedTrend,
      retention7,
      retention14,
      retention30,
      killCriteria,
      trustHealth,
    ] = await Promise.all([
      this.metricsTracker.getMetricTrend(userId, 'daar'),
      this.metricsTracker.getMetricTrend(userId, 'ttfa'),
      this.metricsTracker.getMetricTrend(userId, 'dar'),
      this.metricsTracker.getMetricTrend(userId, 'edit_rate'),
      this.metricsTracker.calculateSecondSurfaceAdoption(userId),
      this.metricsTracker.getMetricTrend(userId, 'unprompted_return'),
      this.metricsTracker.calculateRetention(userId, 7),
      this.metricsTracker.calculateRetention(userId, 14),
      this.metricsTracker.calculateRetention(userId, 30),
      this.metricsTracker.evaluateKillCriteria(userId),
      this.metricsTracker.calculateTrustHealth(userId),
    ]);

    return {
      userId,
      daysSinceSignup,
      current: {
        daar: daarTrend,
        ttfa: ttfaTrend,
        dar: darTrend,
        editRate: editRateTrend,
        secondSurfaceAdoption: secondSurface.value === 1,
        unpromptedReturnRate: unpromptedTrend,
      },
      retention: {
        day7: { achieved: retention7.value === 1, value: retention7.value },
        day14: { achieved: retention14.value === 1, value: retention14.value },
        day30: { achieved: retention30.value === 1, value: retention30.value },
      },
      killCriteriaStatus: killCriteria,
      trustHealth,
      valueCompounding: {
        darTrend: darTrend.trend,
        editRateTrend: editRateTrend.trend,
        proactiveSuggestionsCount: 0, // Would need to track this separately
      },
    };
  }

  /**
   * Get quick metrics summary
   */
  private async getUserMetricsSummary(userId: string): Promise<{
    currentStreak: number;
    totalApprovalsToday: number;
    averageTTFA: number;
  }> {
    const today = new Date().toISOString().split('T')[0];

    // Get today's snapshot
    const snapshot = await this.metricsTracker.getDailySnapshot(userId, today);

    // Calculate streak (consecutive days with approvals)
    let streak = 0;
    const checkDate = new Date();
    while (streak < 30) {
      const dateStr = checkDate.toISOString().split('T')[0];
      const daySnapshot = await this.metricsTracker.getDailySnapshot(userId, dateStr);
      if (daySnapshot && daySnapshot.draftsApproved > 0) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (dateStr !== today) {
        // Allow today to be incomplete
        break;
      } else {
        checkDate.setDate(checkDate.getDate() - 1);
      }
    }

    // Get average TTFA
    const ttfa = await this.metricsTracker.calculateTTFA(userId, 30);

    return {
      currentStreak: streak,
      totalApprovalsToday: snapshot?.draftsApproved || 0,
      averageTTFA: ttfa.value,
    };
  }

  // ============================================================================
  // EXPERIMENT SUPPORT (7-Day Test)
  // ============================================================================

  /**
   * Get experiment status for a user
   */
  async getExperimentStatus(userId: string): Promise<ExperimentStatus | null> {
    // Get user signup date
    const user = await this.db
      .select({ createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user[0]) return null;

    const startDate = new Date(user[0].createdAt);
    const now = new Date();
    const dayNumber = Math.floor(
      (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    // Only track for first 7 days
    if (dayNumber > 7) {
      return null;
    }

    const today = now.toISOString().split('T')[0];

    // Get today's data
    const todayBriefing = await this.getTodaysBriefing(userId);
    const todaySnapshot = await this.metricsTracker.getDailySnapshot(userId, today);

    // Calculate cumulative stats
    const daar = await this.metricsTracker.calculateDAAR(userId, dayNumber);
    const dar = await this.metricsTracker.calculateDAR(userId, dayNumber);
    const ttfa = await this.metricsTracker.calculateTTFA(userId, dayNumber);
    const unprompted = await this.metricsTracker.calculateUnpromptedReturnRate(userId, dayNumber);

    // Count days with approvals
    let daysWithApproval = 0;
    let totalApprovals = 0;
    let totalDismissals = 0;
    let totalEdits = 0;

    for (let d = 0; d < dayNumber; d++) {
      const checkDate = new Date(startDate);
      checkDate.setDate(checkDate.getDate() + d);
      const dateStr = checkDate.toISOString().split('T')[0];
      const daySnap = await this.metricsTracker.getDailySnapshot(userId, dateStr);
      if (daySnap) {
        if (daySnap.draftsApproved > 0) daysWithApproval++;
        totalApprovals += daySnap.draftsApproved;
        totalDismissals += daySnap.draftsDismissed;
        totalEdits += daySnap.draftsEdited;
      }
    }

    // Project success
    const concerns: string[] = [];
    const likelyToMeetDay7Retention = daysWithApproval >= Math.floor(dayNumber * 0.4);
    const likelyToMeetDARThreshold = dar.value >= 0.4;

    if (!likelyToMeetDay7Retention) {
      concerns.push('User is not approving drafts frequently enough');
    }
    if (!likelyToMeetDARThreshold) {
      concerns.push('Draft acceptance rate is below threshold');
    }
    if (ttfa.value > 180) {
      concerns.push('Time to first action is too long (>3 minutes)');
    }
    if (unprompted.value < 0.1) {
      concerns.push('User relies entirely on notifications');
    }

    return {
      userId,
      experimentDay: dayNumber,
      experimentStartDate: startDate.toISOString().split('T')[0] || startDate.toISOString().substring(0, 10),
      dailyChecks: {
        briefingGenerated: !!todayBriefing,
        notificationSent: todayBriefing?.briefing.status !== 'pending',
        briefingViewed: !!todaySnapshot?.briefingsViewed,
        anyApprovals: (todaySnapshot?.draftsApproved || 0) > 0,
        unpromptedSession: (todaySnapshot?.unpromptedSessions || 0) > 0,
      },
      cumulative: {
        daysWithApproval,
        totalApprovals,
        totalDismissals,
        totalEdits,
        medianTTFA: ttfa.value,
        dar: dar.value,
      },
      projection: {
        likelyToMeetDay7Retention,
        likelyToMeetDARThreshold,
        concerns,
      },
    };
  }

  // ============================================================================
  // PINNED MEMORIES
  // ============================================================================

  /**
   * Pin a memory for persistence beyond 7-day rolling window
   */
  async pinMemory(
    userId: string,
    data: {
      type: PinnedMemoryData['type'];
      title: string;
      content: string;
      validUntil?: string;
    }
  ): Promise<PinnedMemoryData> {
    const id = uuid();
    const now = new Date().toISOString();

    await this.db.insert(pinnedMemories).values({
      id,
      userId,
      type: data.type,
      title: data.title,
      content: data.content,
      sourceType: 'user_pin',
      validUntil: data.validUntil,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id,
      userId,
      type: data.type,
      title: data.title,
      content: data.content,
      sourceType: 'user_pin',
      useCount: 0,
      createdAt: now,
    };
  }

  /**
   * Get user's pinned memories
   */
  async getPinnedMemories(userId: string): Promise<PinnedMemoryData[]> {
    const pinned = await this.db
      .select()
      .from(pinnedMemories)
      .where(eq(pinnedMemories.userId, userId))
      .orderBy(desc(pinnedMemories.useCount));

    return pinned.map((p) => ({
      id: p.id,
      userId: p.userId,
      type: p.type as PinnedMemoryData['type'],
      title: p.title,
      content: p.content,
      sourceType: p.sourceType as PinnedMemoryData['sourceType'],
      extractedFrom: p.extractedFrom || undefined,
      useCount: p.useCount,
      lastUsedAt: p.lastUsedAt || undefined,
      validUntil: p.validUntil || undefined,
      createdAt: p.createdAt,
    }));
  }

  /**
   * Unpin a memory
   */
  async unpinMemory(userId: string, memoryId: string): Promise<void> {
    await this.db
      .delete(pinnedMemories)
      .where(
        and(eq(pinnedMemories.id, memoryId), eq(pinnedMemories.userId, userId))
      );
  }

  // ============================================================================
  // TRUST FAILURE REPORTING
  // ============================================================================

  /**
   * Report that ATLAS missed something important
   */
  async reportMissedImportant(
    userId: string,
    description: string,
    feedback?: string
  ): Promise<void> {
    await this.approvalWorkflow.reportMissedCritical(userId, description, feedback);
  }

  /**
   * Report regret after approving a draft
   */
  async reportRegret(
    userId: string,
    itemId: string,
    description?: string
  ): Promise<void> {
    await this.approvalWorkflow.reportAutomatorRegret(userId, itemId, description);
  }

  // ============================================================================
  // SCHEDULE MANAGEMENT
  // ============================================================================

  /**
   * Get user's schedule configuration
   */
  async getSchedule(userId: string) {
    return this.scheduler.getSchedule(userId);
  }

  /**
   * Update schedule configuration
   */
  async updateSchedule(
    userId: string,
    type: BriefingType,
    config: {
      enabled?: boolean;
      hour?: number;
      minute?: number;
      timezone?: string;
      dayOfWeek?: number;
      deliveryMethod?: 'push' | 'email' | 'both';
    }
  ): Promise<void> {
    await this.scheduler.setSchedule(userId, type, config);
  }

  /**
   * Trigger a manual briefing generation
   */
  async triggerBriefing(
    userId: string,
    type: BriefingType
  ): Promise<{ briefingId: string }> {
    return this.scheduler.triggerBriefing(userId, type);
  }

  /**
   * Set up default schedules for a new user
   */
  async setupNewUser(userId: string): Promise<void> {
    await this.scheduler.createDefaultSchedules(userId);
  }
}

// Singleton instance
let serviceInstance: BriefingService | null = null;

export function initializeBriefingService(
  db: Database,
  config?: BriefingServiceConfig
): BriefingService {
  serviceInstance = new BriefingService(db, config);
  return serviceInstance;
}

export function getBriefingService(): BriefingService {
  if (!serviceInstance) {
    throw new Error(
      'BriefingService not initialized. Call initializeBriefingService first.'
    );
  }
  return serviceInstance;
}

export function startBriefingService(): void {
  getBriefingService().start();
}

export function stopBriefingService(): void {
  if (serviceInstance) {
    serviceInstance.stop();
  }
}
