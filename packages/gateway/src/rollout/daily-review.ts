/**
 * Daily Builder Review Service
 *
 * Implements the 10-15 minute daily review loop from the V1 Rollout Plan.
 *
 * Morning Checklist:
 * 1. Check briefing.complete_failure_rate metric (2 min)
 * 2. Check briefing.retry_rate metric (2 min)
 * 3. Scan audit log for any TRUST_* alerts (2 min)
 * 4. Review any user-reported issues from last 24h (3 min)
 * 5. Open your own briefing—does it feel right? (3 min)
 * 6. Spot-check one random user's last briefing audit (3 min)
 *
 * @module @atlas/gateway/rollout/daily-review
 */

import { v4 as uuid } from 'uuid';
import type { Database } from '../db/index.js';
import {
  dailyReviewChecklists,
  trustRegressionEvents,
  trustSignals,
  briefingHistory,
  userEngagement,
  users,
  sectionFailures,
} from '../db/schema.js';
import { eq, and, gte, lte, desc, sql, count, ne } from 'drizzle-orm';
import {
  DailyReviewChecklist,
  TrustSignalLevel,
  TrustRiskAlertType,
  DailyReviewResponse,
} from './types.js';
import { getTrustMonitor } from './trust-monitor.js';
import { getRolloutManager } from './rollout-manager.js';

/**
 * Daily Review Service
 */
export class DailyReviewService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  // ============================================================================
  // CHECKLIST MANAGEMENT
  // ============================================================================

  /**
   * Get or create today's checklist
   */
  async getTodayChecklist(): Promise<DailyReviewChecklist> {
    const today = this.formatDate(new Date());

    const existing = await this.db
      .select()
      .from(dailyReviewChecklists)
      .where(eq(dailyReviewChecklists.date, today))
      .limit(1);

    if (existing[0]) {
      return this.parseChecklist(existing[0]);
    }

    // Create new checklist
    const id = uuid();
    await this.db.insert(dailyReviewChecklists).values({
      id,
      date: today,
      checks: JSON.stringify(this.getDefaultChecks()),
      questions: JSON.stringify(this.getDefaultQuestions()),
      erosionPatterns: JSON.stringify(this.getDefaultErosionPatterns()),
    });

    return {
      date: today,
      checks: this.getDefaultChecks(),
      questions: this.getDefaultQuestions(),
      erosionPatterns: this.getDefaultErosionPatterns(),
    };
  }

  /**
   * Complete the daily review
   */
  async completeReview(
    userId: string,
    updates: {
      checks?: Record<string, unknown>;
      questions?: Record<string, unknown>;
      erosionPatterns?: Record<string, unknown>;
      notes?: string;
    }
  ): Promise<DailyReviewChecklist> {
    const checklist = await this.getTodayChecklist();
    const now = new Date().toISOString();

    // Merge updates - deep merge checks
    const updatedChecks = this.mergeChecks(checklist.checks, updates.checks);
    const updatedQuestions = { ...checklist.questions, ...updates.questions } as DailyReviewChecklist['questions'];
    const updatedPatterns = { ...checklist.erosionPatterns, ...updates.erosionPatterns } as DailyReviewChecklist['erosionPatterns'];

    // Check if all checks are complete
    const allChecked = Object.values(updatedChecks).every((c) => c.checked);

    await this.db
      .update(dailyReviewChecklists)
      .set({
        completedAt: allChecked ? now : null,
        completedBy: allChecked ? userId : null,
        checks: JSON.stringify(updatedChecks),
        questions: JSON.stringify(updatedQuestions),
        erosionPatterns: JSON.stringify(updatedPatterns),
        allClear: allChecked && this.isAllClear(updatedChecks, updatedPatterns),
        notes: updates.notes,
        updatedAt: now,
      })
      .where(eq(dailyReviewChecklists.date, checklist.date));

    // If all clear, record as clean day
    if (allChecked && this.isAllClear(updatedChecks, updatedPatterns)) {
      const rolloutManager = getRolloutManager();
      await rolloutManager.recordCleanDay();
    }

    return {
      ...checklist,
      completedAt: allChecked ? now : undefined,
      completedBy: allChecked ? userId : undefined,
      checks: updatedChecks,
      questions: updatedQuestions,
      erosionPatterns: updatedPatterns,
    };
  }

  // ============================================================================
  // DATA GATHERING FOR REVIEW
  // ============================================================================

  /**
   * Get complete daily review data
   */
  async getDailyReviewData(): Promise<DailyReviewResponse> {
    const checklist = await this.getTodayChecklist();
    const trustMonitor = getTrustMonitor();

    // Get current signals
    const signals = await trustMonitor.measureAllSignals();

    // Get recent regressions
    const regressions = await trustMonitor.getRecentRegressions(24);

    // Get user reports in last 24h
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const userReportsResult = await this.db
      .select({
        userId: trustRegressionEvents.userId,
        trigger: trustRegressionEvents.trigger,
        description: trustRegressionEvents.description,
        timestamp: trustRegressionEvents.timestamp,
      })
      .from(trustRegressionEvents)
      .where(
        and(
          eq(trustRegressionEvents.userReported, true),
          gte(trustRegressionEvents.timestamp, twentyFourHoursAgo)
        )
      )
      .orderBy(desc(trustRegressionEvents.timestamp));

    const userReports = userReportsResult.map((r) => ({
      userId: r.userId,
      type: r.trigger,
      description: r.description,
      timestamp: r.timestamp,
    }));

    // Auto-populate check values
    const failureSignal = signals.find((s) => s.type === 'briefing_generation_failure');
    const retrySignal = signals.find((s) => s.type === 'retry_usage');
    const alertSignal = signals.find((s) => s.type === 'trust_risk_alert');

    if (failureSignal) {
      checklist.checks.failureRateCheck.value = failureSignal.value;
      checklist.checks.failureRateCheck.status = failureSignal.level;
    }

    if (retrySignal) {
      checklist.checks.retryRateCheck.value = retrySignal.value;
      checklist.checks.retryRateCheck.status = retrySignal.level;
    }

    if (alertSignal) {
      checklist.checks.trustAlertsCheck.count = alertSignal.value;
      checklist.checks.trustAlertsCheck.alerts =
        ((alertSignal.metadata?.criticalAlertTypes as TrustRiskAlertType[]) || []);
    }

    checklist.checks.userReportsCheck.count = userReports.length;
    checklist.checks.userReportsCheck.reports = userReports.map((r) => r.description);

    // Detect erosion patterns
    const erosionPatterns = await this.detectErosionPatterns();
    checklist.erosionPatterns = erosionPatterns;

    // Generate recommendations
    const recommendations = this.generateRecommendations(signals, regressions, erosionPatterns);

    return {
      checklist,
      signals,
      recentRegressions: regressions,
      userReports24h: userReports,
      recommendations,
    };
  }

  /**
   * Get a random user's last briefing for spot-check
   */
  async getRandomUserBriefingForSpotCheck(excludeUserId: string): Promise<{
    userId: string;
    briefingId: string;
    generatedAt: string;
    stats: {
      totalItems: number;
      approvedItems: number;
      dismissedItems: number;
      editedItems: number;
    };
  } | null> {
    // Get users with recent briefings, excluding the builder
    const recentBriefings = await this.db
      .select({
        userId: briefingHistory.userId,
        id: briefingHistory.id,
        generatedAt: briefingHistory.generatedAt,
        totalItems: briefingHistory.totalItems,
        approvedItems: briefingHistory.approvedItems,
        dismissedItems: briefingHistory.dismissedItems,
        editedItems: briefingHistory.editedItems,
      })
      .from(briefingHistory)
      .where(ne(briefingHistory.userId, excludeUserId))
      .orderBy(desc(briefingHistory.generatedAt))
      .limit(20);

    if (recentBriefings.length === 0) return null;

    // Pick random
    const randomIndex = Math.floor(Math.random() * recentBriefings.length);
    const briefing = recentBriefings[randomIndex];

    if (!briefing) return null;

    return {
      userId: briefing.userId,
      briefingId: briefing.id,
      generatedAt: briefing.generatedAt,
      stats: {
        totalItems: briefing.totalItems,
        approvedItems: briefing.approvedItems,
        dismissedItems: briefing.dismissedItems,
        editedItems: briefing.editedItems,
      },
    };
  }

  // ============================================================================
  // EROSION PATTERN DETECTION
  // ============================================================================

  /**
   * Detect subtle trust erosion patterns
   */
  async detectErosionPatterns(): Promise<DailyReviewChecklist['erosionPatterns']> {
    const patterns: DailyReviewChecklist['erosionPatterns'] = {
      retryRateCreeping: false,
      sameUserDismissingSameType: false,
      briefingOpenRateDecline: false,
      userAskingHowItWorks: false,
    };

    // Pattern 1: Retry rate creeping up 1%/day
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const retryTrend = await this.db
      .select({
        date: sql<string>`DATE(${trustSignals.measuredAt})`,
        avgValue: sql<number>`AVG(${trustSignals.value})`,
      })
      .from(trustSignals)
      .where(
        and(
          eq(trustSignals.type, 'retry_usage'),
          gte(trustSignals.measuredAt, sevenDaysAgo)
        )
      )
      .groupBy(sql`DATE(${trustSignals.measuredAt})`)
      .orderBy(sql`DATE(${trustSignals.measuredAt})`);

    if (retryTrend.length >= 3) {
      // Check if trending upward
      let increasingDays = 0;
      for (let i = 1; i < retryTrend.length; i++) {
        const current = retryTrend[i];
        const previous = retryTrend[i - 1];
        if (current && previous && current.avgValue > previous.avgValue) {
          increasingDays++;
        }
      }
      patterns.retryRateCreeping = increasingDays >= retryTrend.length - 2;
    }

    // Pattern 2: Same user dismissing same item type repeatedly
    // This is detected in the trust monitor, check regression events
    const dismissalPatternEvents = await this.db
      .select({ count: count() })
      .from(trustRegressionEvents)
      .where(
        and(
          eq(trustRegressionEvents.trigger, 'retry_button_spam'),
          gte(trustRegressionEvents.timestamp, sevenDaysAgo)
        )
      );

    patterns.sameUserDismissingSameType = (dismissalPatternEvents[0]?.count || 0) > 0;

    // Pattern 3: Briefing open rate declining
    const engagementTrend = await this.db
      .select({
        date: userEngagement.date,
        totalViewed: sql<number>`SUM(${userEngagement.briefingsViewed})`,
        totalUsers: count(),
      })
      .from(userEngagement)
      .where(gte(userEngagement.date, sevenDaysAgo.split('T')[0] || ''))
      .groupBy(userEngagement.date)
      .orderBy(userEngagement.date);

    if (engagementTrend.length >= 3) {
      let decliningDays = 0;
      for (let i = 1; i < engagementTrend.length; i++) {
        const current = engagementTrend[i];
        const previous = engagementTrend[i - 1];
        if (current && previous) {
          const currentRate = current.totalUsers > 0 ? current.totalViewed / current.totalUsers : 0;
          const previousRate = previous.totalUsers > 0 ? previous.totalViewed / previous.totalUsers : 0;
          if (currentRate < previousRate) {
            decliningDays++;
          }
        }
      }
      patterns.briefingOpenRateDecline = decliningDays >= engagementTrend.length - 2;
    }

    // Pattern 4: Users asking "how does this work?" - check user reports
    const howItWorksReports = await this.db
      .select({ count: count() })
      .from(trustRegressionEvents)
      .where(
        and(
          eq(trustRegressionEvents.trigger, 'user_error_confusion'),
          gte(trustRegressionEvents.timestamp, sevenDaysAgo)
        )
      );

    patterns.userAskingHowItWorks = (howItWorksReports[0]?.count || 0) > 0;

    return patterns;
  }

  // ============================================================================
  // DAILY QUESTIONS
  // ============================================================================

  /**
   * Answer daily questions based on data
   */
  async answerDailyQuestions(): Promise<DailyReviewChecklist['questions']> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Q1: Did any user retry more than once yesterday?
    const multipleRetries = await this.db
      .select({ count: count() })
      .from(trustRegressionEvents)
      .where(
        and(
          eq(trustRegressionEvents.trigger, 'retry_button_spam'),
          gte(trustRegressionEvents.timestamp, twentyFourHoursAgo)
        )
      );

    // Q2: Did any section fail for >10% of briefings?
    const signals = await getTrustMonitor().measureAllSignals();
    const partialSignal = signals.find((s) => s.type === 'partial_success');
    const anySection10Percent = (partialSignal?.value || 0) > 0.10;

    // Q3: Did any user reconnect an integration?
    const reconnects = await this.db
      .select({ count: count() })
      .from(trustRegressionEvents)
      .where(
        and(
          eq(trustRegressionEvents.trigger, 'integration_reconnect_loop'),
          gte(trustRegressionEvents.timestamp, twentyFourHoursAgo)
        )
      );

    // Q4: Is there any pattern in which sections fail?
    const failurePattern = await this.analyzeSectionFailurePatterns();

    // Q5: Did I notice anything in my own briefing that felt off?
    // This is user-provided, not auto-detected
    const builderFeelWrong: string | null = null;

    return {
      anyRetryMoreThanOnce: (multipleRetries[0]?.count || 0) > 0,
      anySection10PercentFailure: anySection10Percent,
      anyIntegrationReconnect: (reconnects[0]?.count || 0) > 0,
      anyFailurePattern: failurePattern,
      builderFeelWrong,
    };
  }

  // ============================================================================
  // SECTION FAILURE ANALYSIS
  // ============================================================================

  /**
   * Analyze section failure patterns to identify recurring issues
   * Returns a human-readable description of any patterns found
   */
  async analyzeSectionFailurePatterns(): Promise<string | null> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const patterns: string[] = [];

    // Pattern 1: Which section types fail most often?
    const sectionTypeFailures = await this.db
      .select({
        sectionType: sectionFailures.sectionType,
        count: count(),
      })
      .from(sectionFailures)
      .where(gte(sectionFailures.occurredAt, sevenDaysAgo))
      .groupBy(sectionFailures.sectionType)
      .orderBy(desc(count()));

    if (sectionTypeFailures.length > 0 && sectionTypeFailures[0]) {
      const topFailure = sectionTypeFailures[0];
      const total = sectionTypeFailures.reduce((sum, s) => sum + s.count, 0);
      const percentage = total > 0 ? Math.round((topFailure.count / total) * 100) : 0;

      if (percentage > 50) {
        patterns.push(`${topFailure.sectionType} section accounts for ${percentage}% of failures`);
      }
    }

    // Pattern 2: Failures concentrated at specific times?
    const hourlyFailures = await this.db
      .select({
        hourOfDay: sectionFailures.hourOfDay,
        count: count(),
      })
      .from(sectionFailures)
      .where(gte(sectionFailures.occurredAt, sevenDaysAgo))
      .groupBy(sectionFailures.hourOfDay)
      .orderBy(desc(count()));

    if (hourlyFailures.length > 0) {
      const totalHourlyFailures = hourlyFailures.reduce((sum, h) => sum + h.count, 0);
      const peakHour = hourlyFailures[0];

      if (peakHour && totalHourlyFailures > 5) {
        const peakPercentage = Math.round((peakHour.count / totalHourlyFailures) * 100);
        if (peakPercentage > 40) {
          patterns.push(`${peakPercentage}% of failures occur around ${peakHour.hourOfDay}:00`);
        }
      }
    }

    // Pattern 3: Failure type distribution (auth vs timeout vs rate limit)
    const failureTypeDistribution = await this.db
      .select({
        failureType: sectionFailures.failureType,
        count: count(),
      })
      .from(sectionFailures)
      .where(gte(sectionFailures.occurredAt, sevenDaysAgo))
      .groupBy(sectionFailures.failureType)
      .orderBy(desc(count()));

    if (failureTypeDistribution.length > 0 && failureTypeDistribution[0]) {
      const topFailureType = failureTypeDistribution[0];
      const total = failureTypeDistribution.reduce((sum, f) => sum + f.count, 0);
      const percentage = total > 0 ? Math.round((topFailureType.count / total) * 100) : 0;

      if (percentage > 60) {
        const readableType = this.formatFailureType(topFailureType.failureType);
        patterns.push(`${readableType} is the dominant failure mode (${percentage}%)`);
      }
    }

    // Pattern 4: Same user experiencing repeated failures
    const userFailureCounts = await this.db
      .select({
        userId: sectionFailures.userId,
        count: count(),
      })
      .from(sectionFailures)
      .where(gte(sectionFailures.occurredAt, sevenDaysAgo))
      .groupBy(sectionFailures.userId)
      .orderBy(desc(count()));

    const highFailureUsers = userFailureCounts.filter((u) => u.count > 5);
    if (highFailureUsers.length > 0) {
      patterns.push(`${highFailureUsers.length} user(s) experiencing repeated failures`);
    }

    // Pattern 5: Day of week patterns (weekday vs weekend)
    const dayOfWeekFailures = await this.db
      .select({
        dayOfWeek: sectionFailures.dayOfWeek,
        count: count(),
      })
      .from(sectionFailures)
      .where(gte(sectionFailures.occurredAt, sevenDaysAgo))
      .groupBy(sectionFailures.dayOfWeek);

    const weekdayTotal = dayOfWeekFailures
      .filter((d) => d.dayOfWeek >= 1 && d.dayOfWeek <= 5)
      .reduce((sum, d) => sum + d.count, 0);
    const weekendTotal = dayOfWeekFailures
      .filter((d) => d.dayOfWeek === 0 || d.dayOfWeek === 6)
      .reduce((sum, d) => sum + d.count, 0);

    if (weekdayTotal + weekendTotal > 10) {
      const weekdayAvg = weekdayTotal / 5;
      const weekendAvg = weekendTotal / 2;

      if (weekendAvg > weekdayAvg * 2) {
        patterns.push('Failures significantly higher on weekends');
      } else if (weekdayAvg > weekendAvg * 2) {
        patterns.push('Failures significantly higher on weekdays');
      }
    }

    if (patterns.length === 0) {
      return null;
    }

    return patterns.join('; ');
  }

  /**
   * Record a section failure for pattern analysis
   */
  async recordSectionFailure(
    userId: string,
    sectionType: string,
    failureType: string,
    options?: {
      briefingId?: string;
      integrationId?: string;
      errorMessage?: string;
      errorCode?: string;
      retryCount?: number;
      wasRecovered?: boolean;
    }
  ): Promise<void> {
    const now = new Date();
    const id = `sf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    await this.db.insert(sectionFailures).values({
      id,
      userId,
      briefingId: options?.briefingId,
      sectionType,
      integrationId: options?.integrationId,
      failureType,
      errorMessage: options?.errorMessage,
      errorCode: options?.errorCode,
      retryCount: options?.retryCount ?? 0,
      wasRecovered: options?.wasRecovered ?? false,
      occurredAt: now.toISOString(),
      dayOfWeek: now.getDay(),
      hourOfDay: now.getHours(),
    });
  }

  /**
   * Format failure type for human readability
   */
  private formatFailureType(type: string): string {
    const typeMap: Record<string, string> = {
      timeout: 'Timeouts',
      auth: 'Authentication errors',
      rate_limit: 'Rate limiting',
      parse_error: 'Data parsing errors',
      empty_response: 'Empty responses',
      unknown: 'Unknown errors',
    };
    return typeMap[type] || type;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private generateRecommendations(
    signals: Array<{ type: string; level: TrustSignalLevel }>,
    regressions: Array<{ trigger: string; severity: string }>,
    erosionPatterns: DailyReviewChecklist['erosionPatterns']
  ): string[] {
    const recommendations: string[] = [];

    // Signal-based recommendations
    for (const signal of signals) {
      if (signal.level === 'stop') {
        recommendations.push(`CRITICAL: ${signal.type} at STOP level - freeze rollout immediately`);
      } else if (signal.level === 'warning') {
        recommendations.push(`WARNING: ${signal.type} elevated - investigate within 4 hours`);
      }
    }

    // Regression-based recommendations
    const criticalRegressions = regressions.filter((r) => r.severity === 'critical');
    if (criticalRegressions.length > 0) {
      recommendations.push(
        `${criticalRegressions.length} critical regression(s) in last 24h - prioritize resolution`
      );
    }

    // Erosion pattern recommendations
    if (erosionPatterns.retryRateCreeping) {
      recommendations.push('Retry rate trending up - users may be losing confidence slowly');
    }
    if (erosionPatterns.sameUserDismissingSameType) {
      recommendations.push('User dismissing same content type - review content relevance');
    }
    if (erosionPatterns.briefingOpenRateDecline) {
      recommendations.push('Briefing open rate declining - users may be disengaging');
    }
    if (erosionPatterns.userAskingHowItWorks) {
      recommendations.push('Users confused about functionality - improve UX clarity');
    }

    if (recommendations.length === 0) {
      recommendations.push('All signals normal - safe to continue');
    }

    return recommendations;
  }

  private isAllClear(
    checks: DailyReviewChecklist['checks'],
    patterns: DailyReviewChecklist['erosionPatterns']
  ): boolean {
    // All signal checks must be normal
    if (checks.failureRateCheck.status !== 'normal') return false;
    if (checks.retryRateCheck.status !== 'normal') return false;
    if (checks.trustAlertsCheck.count > 0) return false;
    if (checks.userReportsCheck.count > 0) return false;

    // No erosion patterns
    if (Object.values(patterns).some(Boolean)) return false;

    return true;
  }

  /**
   * Deep merge check objects, preserving existing values while applying updates
   */
  private mergeChecks(
    existing: DailyReviewChecklist['checks'],
    updates?: Record<string, unknown>
  ): DailyReviewChecklist['checks'] {
    if (!updates) return existing;

    // Type-safe merge for each check type
    const result: DailyReviewChecklist['checks'] = {
      failureRateCheck: updates.failureRateCheck
        ? { ...existing.failureRateCheck, ...(updates.failureRateCheck as object) }
        : existing.failureRateCheck,
      retryRateCheck: updates.retryRateCheck
        ? { ...existing.retryRateCheck, ...(updates.retryRateCheck as object) }
        : existing.retryRateCheck,
      trustAlertsCheck: updates.trustAlertsCheck
        ? { ...existing.trustAlertsCheck, ...(updates.trustAlertsCheck as object) }
        : existing.trustAlertsCheck,
      userReportsCheck: updates.userReportsCheck
        ? { ...existing.userReportsCheck, ...(updates.userReportsCheck as object) }
        : existing.userReportsCheck,
      builderBriefingCheck: updates.builderBriefingCheck
        ? { ...existing.builderBriefingCheck, ...(updates.builderBriefingCheck as object) }
        : existing.builderBriefingCheck,
      randomUserSpotCheck: updates.randomUserSpotCheck
        ? { ...existing.randomUserSpotCheck, ...(updates.randomUserSpotCheck as object) }
        : existing.randomUserSpotCheck,
    };

    return result;
  }

  private parseChecklist(row: typeof dailyReviewChecklists.$inferSelect): DailyReviewChecklist {
    return {
      date: row.date,
      completedAt: row.completedAt ?? undefined,
      completedBy: row.completedBy ?? undefined,
      checks: JSON.parse(row.checks),
      questions: JSON.parse(row.questions),
      erosionPatterns: JSON.parse(row.erosionPatterns),
    };
  }

  private getDefaultChecks(): DailyReviewChecklist['checks'] {
    return {
      failureRateCheck: { value: 0, status: 'normal', checked: false },
      retryRateCheck: { value: 0, status: 'normal', checked: false },
      trustAlertsCheck: { count: 0, alerts: [], checked: false },
      userReportsCheck: { count: 0, reports: [], checked: false },
      builderBriefingCheck: { feltRight: true, checked: false },
      randomUserSpotCheck: { checked: false },
    };
  }

  private getDefaultQuestions(): DailyReviewChecklist['questions'] {
    return {
      anyRetryMoreThanOnce: false,
      anySection10PercentFailure: false,
      anyIntegrationReconnect: false,
      anyFailurePattern: null,
      builderFeelWrong: null,
    };
  }

  private getDefaultErosionPatterns(): DailyReviewChecklist['erosionPatterns'] {
    return {
      retryRateCreeping: false,
      sameUserDismissingSameType: false,
      briefingOpenRateDecline: false,
      userAskingHowItWorks: false,
    };
  }

  private formatDate(date: Date): string {
    const isoString = date.toISOString();
    const datePart = isoString.split('T')[0];
    return datePart || isoString.substring(0, 10);
  }
}

// Singleton instance
let dailyReviewServiceInstance: DailyReviewService | null = null;

export function initializeDailyReviewService(db: Database): DailyReviewService {
  dailyReviewServiceInstance = new DailyReviewService(db);
  return dailyReviewServiceInstance;
}

export function getDailyReviewService(): DailyReviewService {
  if (!dailyReviewServiceInstance) {
    throw new Error('DailyReviewService not initialized. Call initializeDailyReviewService first.');
  }
  return dailyReviewServiceInstance;
}
