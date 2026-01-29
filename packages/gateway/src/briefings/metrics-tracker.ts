/**
 * Metrics Tracker
 *
 * Tracks all 7 KPIs defined in the ATLAS Product Validation Framework:
 * 1. DAAR - Daily Active Approval Rate
 * 2. TTFA - Time-to-First-Approval
 * 3. DAR - Draft Acceptance Rate
 * 4. Day 7/14/30 Retention
 * 5. Second Surface Adoption
 * 6. Unprompted Return Rate
 * 7. Edit-Before-Approve Rate
 *
 * Also tracks kill criteria and trust failure events.
 *
 * @module @atlas/gateway/briefings/metrics-tracker
 */

import { v4 as uuid } from 'uuid';
import type { Database } from '../db/index.js';
import {
  briefingMetrics,
  userEngagement,
  trustFailureEvents,
  briefingHistory,
  draftItems,
  users,
} from '../db/schema.js';
import { eq, and, gte, lte, sql, desc, count, avg, sum } from 'drizzle-orm';
import {
  MetricType,
  PeriodType,
  MetricDataPoint,
  MetricTrend,
  DailyMetricsSnapshot,
  TrustFailureType,
  TrustFailureData,
  TrustHealthScore,
  CohortRetention,
  KILL_CRITERIA,
  SUCCESS_THRESHOLDS,
  ErrorPattern,
} from './types.js';

/**
 * Configuration for the metrics tracker
 */
export interface MetricsTrackerConfig {
  enableRealTimeUpdates?: boolean;
  retentionDays?: number; // How long to keep detailed metrics
  cohortAnalysisEnabled?: boolean;
}

/**
 * MetricsTracker class for product validation
 */
export class MetricsTracker {
  private db: Database;
  private config: MetricsTrackerConfig;

  constructor(db: Database, config: MetricsTrackerConfig = {}) {
    this.db = db;
    this.config = {
      enableRealTimeUpdates: true,
      retentionDays: 90,
      cohortAnalysisEnabled: true,
      ...config,
    };
  }

  // ============================================================================
  // DAILY ENGAGEMENT TRACKING
  // ============================================================================

  /**
   * Record a user session
   */
  async recordSession(
    userId: string,
    source: 'notification' | 'user_initiated' | 'scheduled_check'
  ): Promise<void> {
    const date = this.getTodayDate();
    const engagement = await this.getOrCreateEngagement(userId, date);

    const updates: Record<string, unknown> = {
      sessionCount: sql`${userEngagement.sessionCount} + 1`,
      lastActionAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (source === 'user_initiated') {
      updates.unpromptedSessions = sql`${userEngagement.unpromptedSessions} + 1`;
    }
    if (source === 'notification') {
      updates.notificationSessions = sql`${userEngagement.notificationSessions} + 1`;
    }

    await this.db
      .update(userEngagement)
      .set(updates)
      .where(eq(userEngagement.id, engagement.id));
  }

  /**
   * Record briefing view
   */
  async recordBriefingView(userId: string): Promise<void> {
    const date = this.getTodayDate();
    const engagement = await this.getOrCreateEngagement(userId, date);

    const updates: Record<string, unknown> = {
      briefingsViewed: sql`${userEngagement.briefingsViewed} + 1`,
      updatedAt: new Date().toISOString(),
    };

    // Set first action time if not already set
    if (!engagement.firstActionAt) {
      updates.firstActionAt = new Date().toISOString();
    }

    await this.db
      .update(userEngagement)
      .set(updates)
      .where(eq(userEngagement.id, engagement.id));
  }

  /**
   * Record draft item action (approve/dismiss/edit)
   */
  async recordDraftAction(
    userId: string,
    surface: 'email' | 'calendar' | 'tasks',
    action: 'approve' | 'dismiss' | 'edit',
    ttfa?: number // Time to first action in seconds
  ): Promise<void> {
    const date = this.getTodayDate();
    const engagement = await this.getOrCreateEngagement(userId, date);

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
      lastActionAt: new Date().toISOString(),
    };

    // Update action counts
    switch (action) {
      case 'approve':
        updates.draftsApproved = sql`${userEngagement.draftsApproved} + 1`;
        break;
      case 'dismiss':
        updates.draftsDismissed = sql`${userEngagement.draftsDismissed} + 1`;
        break;
      case 'edit':
        updates.draftsEdited = sql`${userEngagement.draftsEdited} + 1`;
        break;
    }

    // Update surface usage
    switch (surface) {
      case 'email':
        updates.usedEmailSurface = true;
        break;
      case 'calendar':
        updates.usedCalendarSurface = true;
        break;
      case 'tasks':
        updates.usedTasksSurface = true;
        break;
    }

    // Set first action time if not already set
    if (!engagement.firstActionAt) {
      updates.firstActionAt = new Date().toISOString();
    }

    await this.db
      .update(userEngagement)
      .set(updates)
      .where(eq(userEngagement.id, engagement.id));

    // Record TTFA metric if provided
    if (ttfa !== undefined) {
      await this.recordMetric(userId, 'ttfa', ttfa, 'daily');
    }
  }

  /**
   * Record engagement time
   */
  async recordEngagementTime(userId: string, seconds: number): Promise<void> {
    const date = this.getTodayDate();
    const engagement = await this.getOrCreateEngagement(userId, date);

    await this.db
      .update(userEngagement)
      .set({
        totalEngagementSeconds: sql`${userEngagement.totalEngagementSeconds} + ${seconds}`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userEngagement.id, engagement.id));
  }

  // ============================================================================
  // METRIC CALCULATIONS
  // ============================================================================

  /**
   * Calculate DAAR (Daily Active Approval Rate)
   * % of days a user approves at least one draft
   */
  async calculateDAAR(
    userId: string,
    days: number = 30
  ): Promise<MetricDataPoint> {
    const endDate = this.getTodayDate();
    const startDate = this.getDateMinusDays(days);

    const results = await this.db
      .select({
        totalDays: count(),
        daysWithApproval: sql<number>`SUM(CASE WHEN ${userEngagement.draftsApproved} > 0 THEN 1 ELSE 0 END)`,
      })
      .from(userEngagement)
      .where(
        and(
          eq(userEngagement.userId, userId),
          gte(userEngagement.date, startDate),
          lte(userEngagement.date, endDate)
        )
      );

    const totalDays = results[0]?.totalDays || 0;
    const daysWithApproval = results[0]?.daysWithApproval || 0;
    const value = totalDays > 0 ? daysWithApproval / totalDays : 0;

    return {
      type: 'daar',
      value,
      numerator: daysWithApproval,
      denominator: totalDays,
      periodStart: startDate,
      periodEnd: endDate,
      periodType: 'cumulative',
    };
  }

  /**
   * Calculate TTFA (Time-to-First-Approval)
   * Median time between opening briefing and first approval
   */
  async calculateTTFA(
    userId: string,
    days: number = 30
  ): Promise<MetricDataPoint> {
    const endDate = this.getTodayDate();
    const startDate = this.getDateMinusDays(days);

    const results = await this.db
      .select({ value: briefingMetrics.value })
      .from(briefingMetrics)
      .where(
        and(
          eq(briefingMetrics.userId, userId),
          eq(briefingMetrics.metricType, 'ttfa'),
          gte(briefingMetrics.periodStart, startDate),
          lte(briefingMetrics.periodEnd, endDate)
        )
      )
      .orderBy(briefingMetrics.value);

    // Calculate median
    const values = results.map((r) => r.value);
    const median = this.calculateMedian(values);

    return {
      type: 'ttfa',
      value: median,
      numerator: values.length,
      periodStart: startDate,
      periodEnd: endDate,
      periodType: 'cumulative',
    };
  }

  /**
   * Calculate DAR (Draft Acceptance Rate)
   * Approved drafts / total drafts shown
   */
  async calculateDAR(
    userId: string,
    days: number = 30
  ): Promise<MetricDataPoint> {
    const endDate = this.getTodayDate();
    const startDate = this.getDateMinusDays(days);

    const results = await this.db
      .select({
        totalApproved: sql<number>`SUM(${userEngagement.draftsApproved})`,
        totalDismissed: sql<number>`SUM(${userEngagement.draftsDismissed})`,
        totalEdited: sql<number>`SUM(${userEngagement.draftsEdited})`,
      })
      .from(userEngagement)
      .where(
        and(
          eq(userEngagement.userId, userId),
          gte(userEngagement.date, startDate),
          lte(userEngagement.date, endDate)
        )
      );

    const approved = results[0]?.totalApproved || 0;
    const dismissed = results[0]?.totalDismissed || 0;
    const edited = results[0]?.totalEdited || 0;
    const total = approved + dismissed + edited;
    const acceptedTotal = approved + edited; // Edited items are also accepted
    const value = total > 0 ? acceptedTotal / total : 0;

    return {
      type: 'dar',
      value,
      numerator: acceptedTotal,
      denominator: total,
      periodStart: startDate,
      periodEnd: endDate,
      periodType: 'cumulative',
    };
  }

  /**
   * Calculate retention for a specific day
   */
  async calculateRetention(
    userId: string,
    day: 7 | 14 | 30
  ): Promise<MetricDataPoint> {
    // Get user signup date
    const user = await this.db
      .select({ createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user[0]) {
      return {
        type: `retention_d${day}` as MetricType,
        value: 0,
        periodStart: '',
        periodEnd: '',
        periodType: 'cumulative',
      };
    }

    const signupDate = new Date(user[0].createdAt);
    const targetDate = new Date(signupDate);
    targetDate.setDate(targetDate.getDate() + day);
    const targetDateStr = this.formatDate(targetDate);

    // Check if user had any approval on that day
    const engagement = await this.db
      .select({ draftsApproved: userEngagement.draftsApproved })
      .from(userEngagement)
      .where(
        and(
          eq(userEngagement.userId, userId),
          eq(userEngagement.date, targetDateStr)
        )
      )
      .limit(1);

    const retained = (engagement[0]?.draftsApproved || 0) > 0 ? 1 : 0;

    return {
      type: `retention_d${day}` as MetricType,
      value: retained,
      periodStart: targetDateStr,
      periodEnd: targetDateStr,
      periodType: 'cumulative',
    };
  }

  /**
   * Calculate Second Surface Adoption
   * % of users who use both email AND calendar features
   */
  async calculateSecondSurfaceAdoption(
    userId: string,
    days: number = 14
  ): Promise<MetricDataPoint> {
    const endDate = this.getTodayDate();
    const startDate = this.getDateMinusDays(days);

    const results = await this.db
      .select({
        usedEmail: sql<number>`MAX(CASE WHEN ${userEngagement.usedEmailSurface} THEN 1 ELSE 0 END)`,
        usedCalendar: sql<number>`MAX(CASE WHEN ${userEngagement.usedCalendarSurface} THEN 1 ELSE 0 END)`,
      })
      .from(userEngagement)
      .where(
        and(
          eq(userEngagement.userId, userId),
          gte(userEngagement.date, startDate),
          lte(userEngagement.date, endDate)
        )
      );

    const usedEmail = results[0]?.usedEmail === 1;
    const usedCalendar = results[0]?.usedCalendar === 1;
    const value = usedEmail && usedCalendar ? 1 : 0;

    return {
      type: 'second_surface',
      value,
      periodStart: startDate,
      periodEnd: endDate,
      periodType: 'cumulative',
      metadata: { usedEmail, usedCalendar },
    };
  }

  /**
   * Calculate Unprompted Return Rate
   * % of sessions initiated by user (not notification)
   */
  async calculateUnpromptedReturnRate(
    userId: string,
    days: number = 14
  ): Promise<MetricDataPoint> {
    const endDate = this.getTodayDate();
    const startDate = this.getDateMinusDays(days);

    const results = await this.db
      .select({
        totalSessions: sql<number>`SUM(${userEngagement.sessionCount})`,
        unpromptedSessions: sql<number>`SUM(${userEngagement.unpromptedSessions})`,
      })
      .from(userEngagement)
      .where(
        and(
          eq(userEngagement.userId, userId),
          gte(userEngagement.date, startDate),
          lte(userEngagement.date, endDate)
        )
      );

    const total = results[0]?.totalSessions || 0;
    const unprompted = results[0]?.unpromptedSessions || 0;
    const value = total > 0 ? unprompted / total : 0;

    return {
      type: 'unprompted_return',
      value,
      numerator: unprompted,
      denominator: total,
      periodStart: startDate,
      periodEnd: endDate,
      periodType: 'cumulative',
    };
  }

  /**
   * Calculate Edit-Before-Approve Rate
   * % of approved drafts that were edited first
   */
  async calculateEditRate(
    userId: string,
    days: number = 30
  ): Promise<MetricDataPoint> {
    const endDate = this.getTodayDate();
    const startDate = this.getDateMinusDays(days);

    const results = await this.db
      .select({
        totalApproved: sql<number>`SUM(${userEngagement.draftsApproved})`,
        totalEdited: sql<number>`SUM(${userEngagement.draftsEdited})`,
      })
      .from(userEngagement)
      .where(
        and(
          eq(userEngagement.userId, userId),
          gte(userEngagement.date, startDate),
          lte(userEngagement.date, endDate)
        )
      );

    const approved = results[0]?.totalApproved || 0;
    const edited = results[0]?.totalEdited || 0;
    const total = approved + edited;
    const value = total > 0 ? edited / total : 0;

    return {
      type: 'edit_rate',
      value,
      numerator: edited,
      denominator: total,
      periodStart: startDate,
      periodEnd: endDate,
      periodType: 'cumulative',
    };
  }

  // ============================================================================
  // KILL CRITERIA EVALUATION
  // ============================================================================

  /**
   * Check if any kill criteria are triggered
   */
  async evaluateKillCriteria(userId: string): Promise<{
    isAtRisk: boolean;
    triggeredCriteria: string[];
    recommendations: string[];
  }> {
    const triggered: string[] = [];
    const recommendations: string[] = [];

    // Get user signup date
    const user = await this.db
      .select({ createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user[0]) {
      return { isAtRisk: false, triggeredCriteria: [], recommendations: [] };
    }

    const signupDate = new Date(user[0].createdAt);
    const daysSinceSignup = Math.floor(
      (Date.now() - signupDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Day 7 checks
    if (daysSinceSignup >= 7) {
      const retention = await this.calculateRetention(userId, 7);
      if (retention.value < KILL_CRITERIA.day7.retention) {
        triggered.push(`Day 7 retention below ${KILL_CRITERIA.day7.retention * 100}%`);
        recommendations.push('Focus on improving initial value delivery');
      }

      const ttfa = await this.calculateTTFA(userId, 7);
      if (ttfa.value > KILL_CRITERIA.day7.ttfa) {
        triggered.push(`TTFA exceeds ${KILL_CRITERIA.day7.ttfa / 60} minutes`);
        recommendations.push('Simplify briefing format to reduce cognitive load');
      }
    }

    // Day 14 checks
    if (daysSinceSignup >= 14) {
      const dar = await this.calculateDAR(userId, 14);
      if (dar.value < KILL_CRITERIA.day14.dar) {
        triggered.push(`DAR below ${KILL_CRITERIA.day14.dar * 100}%`);
        recommendations.push('Improve draft quality and relevance');
      }

      const daar = await this.calculateDAAR(userId, 14);
      if (daar.value < KILL_CRITERIA.day14.daar) {
        triggered.push(`DAAR below ${KILL_CRITERIA.day14.daar * 100}%`);
        recommendations.push('Investigate why users are not approving daily');
      }

      const secondSurface = await this.calculateSecondSurfaceAdoption(userId, 14);
      if (secondSurface.value < KILL_CRITERIA.day14.secondSurface) {
        triggered.push(`Second surface adoption below ${KILL_CRITERIA.day14.secondSurface * 100}%`);
        recommendations.push('Guide users to discover second surface features');
      }
    }

    // Day 30 checks
    if (daysSinceSignup >= 30) {
      const unprompted = await this.calculateUnpromptedReturnRate(userId, 30);
      if (unprompted.value < KILL_CRITERIA.day30.unpromptedReturn) {
        triggered.push(`Unprompted return rate below ${KILL_CRITERIA.day30.unpromptedReturn * 100}%`);
        recommendations.push('ATLAS is not forming habits - users rely entirely on notifications');
      }
    }

    return {
      isAtRisk: triggered.length > 0,
      triggeredCriteria: triggered,
      recommendations,
    };
  }

  /**
   * Get metric trend (improving/stable/declining)
   */
  async getMetricTrend(
    userId: string,
    metricType: MetricType
  ): Promise<MetricTrend> {
    // Calculate current and previous period values
    let current: MetricDataPoint;
    let previous: MetricDataPoint;

    const calculators: Record<
      MetricType,
      (days: number) => Promise<MetricDataPoint>
    > = {
      daar: (d) => this.calculateDAAR(userId, d),
      ttfa: (d) => this.calculateTTFA(userId, d),
      dar: (d) => this.calculateDAR(userId, d),
      retention_d7: () => this.calculateRetention(userId, 7),
      retention_d14: () => this.calculateRetention(userId, 14),
      retention_d30: () => this.calculateRetention(userId, 30),
      second_surface: (d) => this.calculateSecondSurfaceAdoption(userId, d),
      unprompted_return: (d) => this.calculateUnpromptedReturnRate(userId, d),
      edit_rate: (d) => this.calculateEditRate(userId, d),
    };

    const calculator = calculators[metricType];
    current = await calculator(7);

    // For retention metrics, we can't really calculate "previous"
    if (metricType.startsWith('retention_')) {
      const retentionThreshold = metricType === 'retention_d7' ? SUCCESS_THRESHOLDS.retention_d7 : 0.4;
      return {
        type: metricType,
        currentValue: current.value,
        previousValue: current.value,
        change: 0,
        trend: 'stable',
        isHealthy: current.value >= retentionThreshold,
        isAtKillThreshold: false,
      };
    }

    // For other metrics, compare last 7 days to previous 7 days
    // This is a simplified version - real implementation would fetch historical data
    previous = current; // Placeholder

    const change =
      previous.value !== 0
        ? ((current.value - previous.value) / previous.value) * 100
        : 0;

    let trend: 'improving' | 'stable' | 'declining';
    if (Math.abs(change) < 5) {
      trend = 'stable';
    } else if (
      (metricType === 'ttfa' && change < 0) ||
      (metricType !== 'ttfa' && change > 0)
    ) {
      trend = 'improving';
    } else {
      trend = 'declining';
    }

    // Determine if healthy
    let isHealthy = false;
    const threshold = SUCCESS_THRESHOLDS[metricType as keyof typeof SUCCESS_THRESHOLDS];
    if (threshold !== undefined) {
      if (typeof threshold === 'object' && 'min' in threshold) {
        // For edit_rate which has a range
        isHealthy = current.value >= threshold.min && current.value <= threshold.max;
      } else {
        // For metrics where higher is better (or lower for TTFA)
        isHealthy =
          metricType === 'ttfa'
            ? current.value <= threshold
            : current.value >= threshold;
      }
    }

    return {
      type: metricType,
      currentValue: current.value,
      previousValue: previous.value,
      change,
      trend,
      isHealthy,
      isAtKillThreshold: false, // Would be set by evaluateKillCriteria
    };
  }

  // ============================================================================
  // TRUST FAILURE TRACKING
  // ============================================================================

  /**
   * Record a trust failure event
   */
  async recordTrustFailure(
    userId: string,
    type: TrustFailureType,
    severity: 'low' | 'medium' | 'high' | 'critical',
    options: {
      description?: string;
      draftItemId?: string;
      errorPattern?: ErrorPattern;
      userReported?: boolean;
      userFeedback?: string;
    } = {}
  ): Promise<TrustFailureData> {
    const id = uuid();
    const timestamp = new Date().toISOString();

    await this.db.insert(trustFailureEvents).values({
      id,
      userId,
      failureType: type,
      severity,
      description: options.description,
      draftItemId: options.draftItemId,
      errorPattern: options.errorPattern,
      userReported: options.userReported || false,
      userFeedback: options.userFeedback,
      timestamp,
    });

    return {
      id,
      userId,
      type,
      severity,
      description: options.description,
      draftItemId: options.draftItemId,
      errorPattern: options.errorPattern,
      userReported: options.userReported || false,
      userFeedback: options.userFeedback,
      timestamp,
    };
  }

  /**
   * Calculate trust health score for a user
   */
  async calculateTrustHealth(userId: string): Promise<TrustHealthScore> {
    const thirtyDaysAgo = this.getDateMinusDays(30);

    const failures = await this.db
      .select({
        failureType: trustFailureEvents.failureType,
        severity: trustFailureEvents.severity,
        timestamp: trustFailureEvents.timestamp,
      })
      .from(trustFailureEvents)
      .where(
        and(
          eq(trustFailureEvents.userId, userId),
          gte(trustFailureEvents.timestamp, thirtyDaysAgo)
        )
      )
      .orderBy(desc(trustFailureEvents.timestamp));

    // Calculate score based on failures
    // Start at 100, deduct points for each failure
    const severityPoints: Record<string, number> = {
      low: 2,
      medium: 5,
      high: 15,
      critical: 30,
    };

    let score = 100;
    const failuresByType: Partial<Record<TrustFailureType, number>> = {};

    for (const failure of failures) {
      score -= severityPoints[failure.severity] || 5;
      const type = failure.failureType as TrustFailureType;
      failuresByType[type] = (failuresByType[type] || 0) + 1;
    }

    score = Math.max(0, Math.min(100, score));

    let riskLevel: 'low' | 'medium' | 'high';
    if (score >= 80) {
      riskLevel = 'low';
    } else if (score >= 50) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'high';
    }

    return {
      userId,
      score,
      recentFailures: failures.length,
      failuresByType,
      lastFailureAt: failures[0]?.timestamp,
      riskLevel,
    };
  }

  // ============================================================================
  // COHORT ANALYSIS
  // ============================================================================

  /**
   * Calculate cohort retention for experiment analysis
   */
  async calculateCohortRetention(
    cohortDate: string // YYYY-MM-DD
  ): Promise<CohortRetention> {
    // Get users who signed up on this date
    const cohortUsers = await this.db
      .select({ id: users.id })
      .from(users)
      .where(sql`DATE(${users.createdAt}) = ${cohortDate}`);

    const cohortSize = cohortUsers.length;
    if (cohortSize === 0) {
      return {
        cohortDate,
        cohortSize: 0,
        retention: { day1: 0, day3: 0, day7: 0, day14: 0, day30: 0 },
      };
    }

    const retention: Record<string, number> = {};

    for (const day of [1, 3, 7, 14, 30]) {
      const targetDate = new Date(cohortDate);
      targetDate.setDate(targetDate.getDate() + day);
      const targetDateStr = this.formatDate(targetDate);

      // Count users with any approval on that day
      let retained = 0;
      for (const user of cohortUsers) {
        const engagement = await this.db
          .select({ draftsApproved: userEngagement.draftsApproved })
          .from(userEngagement)
          .where(
            and(
              eq(userEngagement.userId, user.id),
              eq(userEngagement.date, targetDateStr)
            )
          )
          .limit(1);

        if ((engagement[0]?.draftsApproved || 0) > 0) {
          retained++;
        }
      }

      retention[`day${day}`] = retained / cohortSize;
    }

    return {
      cohortDate,
      cohortSize,
      retention: {
        day1: retention.day1 ?? 0,
        day3: retention.day3 ?? 0,
        day7: retention.day7 ?? 0,
        day14: retention.day14 ?? 0,
        day30: retention.day30 ?? 0,
      },
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Record a metric to the database
   */
  async recordMetric(
    userId: string,
    type: MetricType,
    value: number,
    periodType: PeriodType,
    options: {
      numerator?: number;
      denominator?: number;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<void> {
    const now = new Date();
    const id = uuid();

    await this.db.insert(briefingMetrics).values({
      id,
      userId,
      metricType: type,
      value,
      numerator: options.numerator,
      denominator: options.denominator,
      periodStart: this.getTodayDate(),
      periodEnd: this.getTodayDate(),
      periodType,
      metadata: JSON.stringify(options.metadata || {}),
      timestamp: now.toISOString(),
    });
  }

  /**
   * Get or create engagement record for a date
   */
  private async getOrCreateEngagement(
    userId: string,
    date: string
  ): Promise<{ id: string; firstActionAt?: string | null }> {
    const existing = await this.db
      .select({ id: userEngagement.id, firstActionAt: userEngagement.firstActionAt })
      .from(userEngagement)
      .where(
        and(eq(userEngagement.userId, userId), eq(userEngagement.date, date))
      )
      .limit(1);

    if (existing[0]) {
      return existing[0];
    }

    // Calculate days since signup
    const user = await this.db
      .select({ createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    let daysSinceSignup: number | undefined;
    if (user[0]) {
      const signupDate = new Date(user[0].createdAt);
      const currentDate = new Date(date);
      daysSinceSignup = Math.floor(
        (currentDate.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    const id = uuid();
    await this.db.insert(userEngagement).values({
      id,
      userId,
      date,
      daysSinceSignup,
    });

    return { id, firstActionAt: null };
  }

  private getTodayDate(): string {
    return this.formatDate(new Date());
  }

  private getDateMinusDays(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return this.formatDate(date);
  }

  private formatDate(date: Date): string {
    const isoString = date.toISOString();
    const datePart = isoString.split('T')[0];
    return datePart || isoString.substring(0, 10);
  }

  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 !== 0) {
      return sorted[mid] ?? 0;
    }
    const left = sorted[mid - 1] ?? 0;
    const right = sorted[mid] ?? 0;
    return (left + right) / 2;
  }

  /**
   * Get daily metrics snapshot
   */
  async getDailySnapshot(
    userId: string,
    date?: string
  ): Promise<DailyMetricsSnapshot | null> {
    const targetDate = date || this.getTodayDate();

    const engagement = await this.db
      .select()
      .from(userEngagement)
      .where(
        and(
          eq(userEngagement.userId, userId),
          eq(userEngagement.date, targetDate)
        )
      )
      .limit(1);

    if (!engagement[0]) {
      return null;
    }

    const e = engagement[0];
    const totalDrafts = e.draftsApproved + e.draftsDismissed + e.draftsEdited;
    const accepted = e.draftsApproved + e.draftsEdited;

    return {
      date: targetDate,
      userId,
      briefingsGenerated: 0, // Would need to query briefings table
      briefingsViewed: e.briefingsViewed,
      draftsShown: totalDrafts,
      draftsApproved: e.draftsApproved,
      draftsDismissed: e.draftsDismissed,
      draftsEdited: e.draftsEdited,
      daar: e.draftsApproved > 0 ? 1 : 0,
      dar: totalDrafts > 0 ? accepted / totalDrafts : 0,
      editRate: accepted > 0 ? e.draftsEdited / accepted : 0,
      ttfa: undefined, // Would need to calculate from timestamps
      totalEngagementTime: e.totalEngagementSeconds,
      usedEmail: Boolean(e.usedEmailSurface),
      usedCalendar: Boolean(e.usedCalendarSurface),
      totalSessions: e.sessionCount,
      unpromptedSessions: e.unpromptedSessions,
    };
  }
}

// Singleton instance
let metricsTrackerInstance: MetricsTracker | null = null;

export function initializeMetricsTracker(
  db: Database,
  config?: MetricsTrackerConfig
): MetricsTracker {
  metricsTrackerInstance = new MetricsTracker(db, config);
  return metricsTrackerInstance;
}

export function getMetricsTracker(): MetricsTracker {
  if (!metricsTrackerInstance) {
    throw new Error('MetricsTracker not initialized. Call initializeMetricsTracker first.');
  }
  return metricsTrackerInstance;
}
