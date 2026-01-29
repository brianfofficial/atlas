/**
 * Trust Monitor Service
 *
 * Monitors the 6 live trust signals defined in the V1 Rollout Plan:
 * 1. Briefing Generation Failures (<2% normal, 2-5% warning, >5% STOP)
 * 2. Retry Usage Patterns (<10% normal, 10-20% warning, >20% STOP)
 * 3. Partial Success Frequency (<15% normal, 15-30% warning, >30% STOP)
 * 4. Dismissal Behavior (<5% normal, 5-15% warning, >15% STOP)
 * 5. Manual Refresh Loops (0-1 normal, 2-3 warning, >3 in 60s STOP)
 * 6. Trust-Risk Alerts (0 normal, 1-2 warning, any STALE_DATA/SILENT_FAILURE STOP)
 *
 * @module @atlas/gateway/rollout/trust-monitor
 */

import { v4 as uuid } from 'uuid';
import type { Database } from '../db/index.js';
import {
  trustSignals,
  trustRegressionEvents,
  briefingRetries,
  briefingDrafts,
  briefingHistory,
  userEngagement,
  draftItems,
  trustFailureEvents,
} from '../db/schema.js';
import { eq, and, gte, lte, sql, desc, count, sum } from 'drizzle-orm';
import {
  TrustSignalType,
  TrustSignalLevel,
  TrustSignalMeasurement,
  TrustRiskAlertType,
  ImmediateHaltTrigger,
  TrustRegressionEvent,
  TRUST_SIGNAL_THRESHOLDS,
} from './types.js';
import { getEventBroadcaster } from '../events/event-broadcaster.js';
import { getAuditService } from '../audit/audit-service.js';

/**
 * Trust Monitor configuration
 */
export interface TrustMonitorConfig {
  /** How often to recalculate signals (ms) */
  signalRefreshInterval?: number;
  /** Period for signal calculations */
  measurementPeriodHours?: number;
  /** Enable real-time event broadcasting */
  enableBroadcast?: boolean;
}

/**
 * Trust Monitor Service
 */
export class TrustMonitor {
  private db: Database;
  private config: Required<TrustMonitorConfig>;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(db: Database, config: TrustMonitorConfig = {}) {
    this.db = db;
    this.config = {
      signalRefreshInterval: config.signalRefreshInterval ?? 5 * 60 * 1000, // 5 minutes
      measurementPeriodHours: config.measurementPeriodHours ?? 24,
      enableBroadcast: config.enableBroadcast ?? true,
    };
  }

  /**
   * Start periodic signal monitoring
   */
  start(): void {
    if (this.refreshTimer) return;

    // Initial measurement
    void this.measureAllSignals();

    // Periodic refresh
    this.refreshTimer = setInterval(() => {
      void this.measureAllSignals();
    }, this.config.signalRefreshInterval);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // ============================================================================
  // SIGNAL 1: BRIEFING GENERATION FAILURES
  // ============================================================================

  /**
   * Measure briefing generation failure rate
   * Normal: <2%, Warning: 2-5%, STOP: >5%
   */
  async measureBriefingFailures(): Promise<TrustSignalMeasurement> {
    const periodStart = this.getPeriodStart();
    const periodEnd = new Date().toISOString();

    // Count total briefings and failed briefings
    const results = await this.db
      .select({
        total: count(),
        failed: sql<number>`SUM(CASE WHEN ${briefingDrafts.status} = 'error' THEN 1 ELSE 0 END)`,
      })
      .from(briefingDrafts)
      .where(gte(briefingDrafts.generatedAt, periodStart));

    const total = results[0]?.total || 0;
    const failed = results[0]?.failed || 0;
    const value = total > 0 ? failed / total : 0;

    const level = this.evaluateSignalLevel('briefing_generation_failure', value);

    const measurement: TrustSignalMeasurement = {
      type: 'briefing_generation_failure',
      value,
      level,
      numerator: failed,
      denominator: total,
      measuredAt: new Date().toISOString(),
      periodStart,
      periodEnd,
    };

    await this.recordSignal(measurement);

    if (level === 'stop') {
      await this.triggerHalt('briefing_generation_failure', value, measurement);
    }

    return measurement;
  }

  // ============================================================================
  // SIGNAL 2: RETRY USAGE PATTERNS
  // ============================================================================

  /**
   * Measure retry usage rate
   * Normal: <10%, Warning: 10-20%, STOP: >20% OR >3 retries on single briefing
   */
  async measureRetryUsage(): Promise<TrustSignalMeasurement> {
    const periodStart = this.getPeriodStart();
    const periodEnd = new Date().toISOString();

    // Count briefings with retries vs total briefings viewed
    const totalBriefings = await this.db
      .select({ count: count() })
      .from(briefingHistory)
      .where(
        and(
          gte(briefingHistory.viewedAt, periodStart),
          sql`${briefingHistory.viewedAt} IS NOT NULL`
        )
      );

    const briefingsWithRetries = await this.db
      .select({ count: sql<number>`COUNT(DISTINCT ${briefingRetries.briefingId})` })
      .from(briefingRetries)
      .where(gte(briefingRetries.firstRetryAt, periodStart));

    const total = totalBriefings[0]?.count || 0;
    const withRetries = briefingsWithRetries[0]?.count || 0;
    const value = total > 0 ? withRetries / total : 0;

    // Also check for >3 retries on single briefing (immediate STOP)
    const highRetryCount = await this.db
      .select({ maxRetries: sql<number>`MAX(${briefingRetries.retryCount})` })
      .from(briefingRetries)
      .where(gte(briefingRetries.firstRetryAt, periodStart));

    const maxRetries = highRetryCount[0]?.maxRetries || 0;
    const hasExcessiveRetries = maxRetries > 3;

    let level = this.evaluateSignalLevel('retry_usage', value);
    if (hasExcessiveRetries) {
      level = 'stop';
    }

    const measurement: TrustSignalMeasurement = {
      type: 'retry_usage',
      value,
      level,
      numerator: withRetries,
      denominator: total,
      measuredAt: new Date().toISOString(),
      periodStart,
      periodEnd,
      metadata: { maxRetries, hasExcessiveRetries },
    };

    await this.recordSignal(measurement);

    if (level === 'stop') {
      await this.triggerHalt('retry_usage', value, measurement);
    }

    return measurement;
  }

  // ============================================================================
  // SIGNAL 3: PARTIAL SUCCESS FREQUENCY
  // ============================================================================

  /**
   * Measure partial success rate (briefings with 1+ failed section)
   * Normal: <15%, Warning: 15-30%, STOP: >30% sustained 1 hour
   */
  async measurePartialSuccess(): Promise<TrustSignalMeasurement> {
    const periodStart = this.getPeriodStart();
    const periodEnd = new Date().toISOString();

    // Count briefings with partial failures
    // A briefing with status 'partial' or with some items failed
    const results = await this.db
      .select({
        total: count(),
        partial: sql<number>`SUM(CASE WHEN
          ${briefingDrafts.status} = 'partial' OR
          json_extract(${briefingDrafts.content}, '$.errors') IS NOT NULL
          THEN 1 ELSE 0 END)`,
      })
      .from(briefingDrafts)
      .where(gte(briefingDrafts.generatedAt, periodStart));

    const total = results[0]?.total || 0;
    const partial = results[0]?.partial || 0;
    const value = total > 0 ? partial / total : 0;

    const level = this.evaluateSignalLevel('partial_success', value);

    const measurement: TrustSignalMeasurement = {
      type: 'partial_success',
      value,
      level,
      numerator: partial,
      denominator: total,
      measuredAt: new Date().toISOString(),
      periodStart,
      periodEnd,
    };

    await this.recordSignal(measurement);

    // Check if sustained for 1 hour at STOP level
    if (level === 'stop') {
      const sustained = await this.isSignalSustained('partial_success', 'stop', 60);
      if (sustained) {
        await this.triggerHalt('partial_success', value, measurement);
      }
    }

    return measurement;
  }

  // ============================================================================
  // SIGNAL 4: DISMISSAL BEHAVIOR
  // ============================================================================

  /**
   * Measure dismissal rate
   * Normal: <5%, Warning: 5-15%, STOP: >15% OR same item type >3x
   */
  async measureDismissalBehavior(): Promise<TrustSignalMeasurement> {
    const periodStart = this.getPeriodStart();
    const periodEnd = new Date().toISOString();

    // Count dismissed vs total items
    const results = await this.db
      .select({
        total: count(),
        dismissed: sql<number>`SUM(CASE WHEN ${draftItems.status} = 'dismissed' THEN 1 ELSE 0 END)`,
      })
      .from(draftItems)
      .where(gte(draftItems.createdAt, periodStart));

    const total = results[0]?.total || 0;
    const dismissed = results[0]?.dismissed || 0;
    const value = total > 0 ? dismissed / total : 0;

    // Check for same item type dismissed >3x by any user
    const repeatedDismissals = await this.db
      .select({
        userId: draftItems.userId,
        type: draftItems.type,
        count: count(),
      })
      .from(draftItems)
      .where(
        and(
          eq(draftItems.status, 'dismissed'),
          gte(draftItems.createdAt, periodStart)
        )
      )
      .groupBy(draftItems.userId, draftItems.type)
      .having(sql`count(*) > 3`);

    const hasRepeatedDismissals = repeatedDismissals.length > 0;

    let level = this.evaluateSignalLevel('dismissal_behavior', value);
    if (hasRepeatedDismissals) {
      level = 'stop';
    }

    const measurement: TrustSignalMeasurement = {
      type: 'dismissal_behavior',
      value,
      level,
      numerator: dismissed,
      denominator: total,
      measuredAt: new Date().toISOString(),
      periodStart,
      periodEnd,
      metadata: { hasRepeatedDismissals, repeatedCount: repeatedDismissals.length },
    };

    await this.recordSignal(measurement);

    if (level === 'stop') {
      await this.triggerHalt('dismissal_behavior', value, measurement);
    }

    return measurement;
  }

  // ============================================================================
  // SIGNAL 5: MANUAL REFRESH LOOPS
  // ============================================================================

  /**
   * Measure manual refresh loops per session
   * Normal: 0-1, Warning: 2-3, STOP: >3 in 60 seconds
   */
  async measureRefreshLoops(): Promise<TrustSignalMeasurement> {
    const periodStart = this.getPeriodStart();
    const periodEnd = new Date().toISOString();

    // Average refreshes per session
    const avgResults = await this.db
      .select({
        avgRefreshes: sql<number>`AVG(${briefingRetries.retryCount})`,
      })
      .from(briefingRetries)
      .where(gte(briefingRetries.firstRetryAt, periodStart));

    const avgRefreshes = avgResults[0]?.avgRefreshes || 0;

    // Check for >3 refreshes in 60 seconds (immediate STOP condition)
    const rapidRefreshes = await this.db
      .select({ count: count() })
      .from(briefingRetries)
      .where(
        and(
          gte(briefingRetries.lastRetryAt, periodStart),
          sql`${briefingRetries.retriesInLastMinute} > 3`
        )
      );

    const hasRapidRefreshLoop = (rapidRefreshes[0]?.count || 0) > 0;

    let level = this.evaluateSignalLevel('manual_refresh_loop', avgRefreshes);
    if (hasRapidRefreshLoop) {
      level = 'stop';
    }

    const measurement: TrustSignalMeasurement = {
      type: 'manual_refresh_loop',
      value: avgRefreshes,
      level,
      measuredAt: new Date().toISOString(),
      periodStart,
      periodEnd,
      metadata: { hasRapidRefreshLoop },
    };

    await this.recordSignal(measurement);

    if (level === 'stop') {
      await this.triggerHalt('manual_refresh_loop', avgRefreshes, measurement);
    }

    return measurement;
  }

  // ============================================================================
  // SIGNAL 6: TRUST-RISK ALERTS
  // ============================================================================

  /**
   * Measure trust-risk alerts
   * Normal: 0, Warning: 1-2, STOP: any STALE_DATA or SILENT_FAILURE
   */
  async measureTrustRiskAlerts(): Promise<TrustSignalMeasurement> {
    const periodStart = this.getPeriodStart();
    const periodEnd = new Date().toISOString();

    // Count trust failure events
    const results = await this.db
      .select({
        total: count(),
        critical: sql<number>`SUM(CASE WHEN ${trustFailureEvents.severity} IN ('critical', 'high') THEN 1 ELSE 0 END)`,
      })
      .from(trustFailureEvents)
      .where(gte(trustFailureEvents.timestamp, periodStart));

    const total = results[0]?.total || 0;
    const critical = results[0]?.critical || 0;

    // Check for specific STOP-level alert types
    const criticalAlerts = await this.db
      .select({ failureType: trustFailureEvents.failureType })
      .from(trustFailureEvents)
      .where(
        and(
          gte(trustFailureEvents.timestamp, periodStart),
          sql`${trustFailureEvents.failureType} IN ('stale_data', 'silent_failure', 'cascade_failure')`
        )
      );

    const hasCriticalAlertType = criticalAlerts.length > 0;

    let level = this.evaluateSignalLevel('trust_risk_alert', total);
    if (hasCriticalAlertType) {
      level = 'stop';
    }

    const measurement: TrustSignalMeasurement = {
      type: 'trust_risk_alert',
      value: total,
      level,
      numerator: critical,
      denominator: total,
      measuredAt: new Date().toISOString(),
      periodStart,
      periodEnd,
      metadata: {
        hasCriticalAlertType,
        criticalAlertTypes: criticalAlerts.map((a) => a.failureType),
      },
    };

    await this.recordSignal(measurement);

    if (level === 'stop') {
      await this.triggerHalt('trust_risk_alert', total, measurement);
    }

    return measurement;
  }

  // ============================================================================
  // REGRESSION RECORDING
  // ============================================================================

  /**
   * Record a trust regression event
   */
  async recordRegression(
    userId: string,
    trigger: ImmediateHaltTrigger,
    description: string,
    options: {
      severity?: 'warning' | 'critical';
      userReported?: boolean;
      userFeedback?: string;
      briefingId?: string;
      sectionId?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<TrustRegressionEvent> {
    const id = uuid();
    const timestamp = new Date().toISOString();
    const severity = options.severity ?? 'warning';

    await this.db.insert(trustRegressionEvents).values({
      id,
      userId,
      trigger,
      severity,
      description,
      userReported: options.userReported ?? false,
      userFeedback: options.userFeedback,
      briefingId: options.briefingId,
      sectionId: options.sectionId,
      metadata: JSON.stringify(options.metadata ?? {}),
      timestamp,
    });

    const event: TrustRegressionEvent = {
      id,
      userId,
      trigger,
      severity,
      description,
      userReported: options.userReported ?? false,
      userFeedback: options.userFeedback,
      briefingId: options.briefingId,
      sectionId: options.sectionId,
      metadata: options.metadata,
      timestamp,
      resolved: false,
    };

    // Broadcast the regression event
    if (this.config.enableBroadcast) {
      const broadcaster = getEventBroadcaster();
      broadcaster.broadcast('trust:failure', {
        regressionEvent: event,
        requiresImmediateAction: severity === 'critical',
      });
    }

    // Audit log
    const auditService = getAuditService();
    await auditService.log({
      type: 'security:alert' as any, // TODO: Add trust-specific audit types
      severity: severity === 'critical' ? 'critical' : 'warning',
      message: `Trust regression: ${trigger} - ${description}`,
      userId,
      metadata: { trigger, ...options },
    });

    return event;
  }

  /**
   * Record a user "feels wrong" report
   * This is the highest priority - immediately freeze rollout
   */
  async recordFeelsWrongReport(
    userId: string,
    description: string,
    options: {
      briefingId?: string;
      sectionId?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<TrustRegressionEvent> {
    // "This Feels Wrong" Protocol:
    // 1. Do not explain - the user's feeling is valid
    // 2. Freeze new user invites immediately
    // 3. Reproduce within 2 hours
    // 4. If reproducible, fix before resuming
    // 5. If not, add logging to detect next time

    const event = await this.recordRegression(
      userId,
      'user_trust_question',
      description,
      {
        severity: 'critical',
        userReported: true,
        userFeedback: description,
        ...options,
      }
    );

    // Import and trigger freeze (handled by RolloutManager)
    // The caller should check the return and trigger freeze

    return event;
  }

  /**
   * Record a retry attempt
   */
  async recordRetry(
    userId: string,
    sessionId: string,
    briefingId?: string,
    sectionId?: string
  ): Promise<void> {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000).toISOString();

    // Find existing retry record for this session
    const existing = await this.db
      .select()
      .from(briefingRetries)
      .where(
        and(
          eq(briefingRetries.userId, userId),
          eq(briefingRetries.sessionId, sessionId),
          briefingId ? eq(briefingRetries.briefingId, briefingId) : sql`1=1`
        )
      )
      .limit(1);

    if (existing[0]) {
      // Update existing record
      const lastRetryTime = new Date(existing[0].lastRetryAt);
      const timeSinceLastRetry = now.getTime() - lastRetryTime.getTime();

      // Calculate retries in last minute
      let retriesInLastMinute = existing[0].retriesInLastMinute;
      if (timeSinceLastRetry < 60000) {
        retriesInLastMinute++;
      } else {
        retriesInLastMinute = 1; // Reset counter
      }

      await this.db
        .update(briefingRetries)
        .set({
          retryCount: sql`${briefingRetries.retryCount} + 1`,
          lastRetryAt: now.toISOString(),
          retriesInLastMinute,
        })
        .where(eq(briefingRetries.id, existing[0].id));

      // Check for STOP condition
      if (retriesInLastMinute > 3) {
        await this.recordRegression(
          userId,
          'retry_button_spam',
          `User clicked retry ${retriesInLastMinute} times in 60 seconds`,
          {
            severity: 'critical',
            briefingId,
            sectionId,
            metadata: { retriesInLastMinute, sessionId },
          }
        );
      }
    } else {
      // Create new retry record
      await this.db.insert(briefingRetries).values({
        id: uuid(),
        userId,
        sessionId,
        briefingId,
        sectionId,
        retryCount: 1,
        firstRetryAt: now.toISOString(),
        lastRetryAt: now.toISOString(),
        retriesInLastMinute: 1,
      });
    }
  }

  // ============================================================================
  // AGGREGATE METHODS
  // ============================================================================

  /**
   * Measure all signals at once
   */
  async measureAllSignals(): Promise<TrustSignalMeasurement[]> {
    const signals = await Promise.all([
      this.measureBriefingFailures(),
      this.measureRetryUsage(),
      this.measurePartialSuccess(),
      this.measureDismissalBehavior(),
      this.measureRefreshLoops(),
      this.measureTrustRiskAlerts(),
    ]);

    return signals;
  }

  /**
   * Get the overall trust status (worst signal level)
   */
  async getOverallStatus(): Promise<TrustSignalLevel> {
    const signals = await this.measureAllSignals();

    if (signals.some((s) => s.level === 'stop')) return 'stop';
    if (signals.some((s) => s.level === 'warning')) return 'warning';
    return 'normal';
  }

  /**
   * Get recent signals from database
   */
  async getRecentSignals(hours: number = 24): Promise<TrustSignalMeasurement[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const results = await this.db
      .select()
      .from(trustSignals)
      .where(gte(trustSignals.measuredAt, since))
      .orderBy(desc(trustSignals.measuredAt))
      .limit(100);

    return results.map((r) => ({
      type: r.type as TrustSignalType,
      value: r.value,
      level: r.level as TrustSignalLevel,
      numerator: r.numerator ?? undefined,
      denominator: r.denominator ?? undefined,
      measuredAt: r.measuredAt,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
    }));
  }

  /**
   * Get recent regression events
   */
  async getRecentRegressions(hours: number = 24): Promise<TrustRegressionEvent[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const results = await this.db
      .select()
      .from(trustRegressionEvents)
      .where(gte(trustRegressionEvents.timestamp, since))
      .orderBy(desc(trustRegressionEvents.timestamp))
      .limit(50);

    return results.map((r) => ({
      id: r.id,
      userId: r.userId,
      trigger: r.trigger as ImmediateHaltTrigger,
      severity: r.severity as 'warning' | 'critical',
      description: r.description,
      userReported: r.userReported,
      userFeedback: r.userFeedback ?? undefined,
      briefingId: r.briefingId ?? undefined,
      sectionId: r.sectionId ?? undefined,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      timestamp: r.timestamp,
      resolved: r.resolved,
      resolvedAt: r.resolvedAt ?? undefined,
      resolution: r.resolution ?? undefined,
    }));
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Evaluate signal level based on thresholds
   */
  private evaluateSignalLevel(type: TrustSignalType, value: number): TrustSignalLevel {
    const thresholds = TRUST_SIGNAL_THRESHOLDS[type];

    if (value <= thresholds.normal.max) return 'normal';
    if (value <= thresholds.warning.max) return 'warning';
    return 'stop';
  }

  /**
   * Record a signal measurement to the database
   */
  private async recordSignal(measurement: TrustSignalMeasurement): Promise<void> {
    await this.db.insert(trustSignals).values({
      id: uuid(),
      type: measurement.type,
      value: measurement.value,
      level: measurement.level,
      numerator: measurement.numerator,
      denominator: measurement.denominator,
      periodStart: measurement.periodStart,
      periodEnd: measurement.periodEnd,
      metadata: measurement.metadata ? JSON.stringify(measurement.metadata) : undefined,
      measuredAt: measurement.measuredAt,
    });
  }

  /**
   * Check if a signal has been at a level for a sustained period
   */
  private async isSignalSustained(
    type: TrustSignalType,
    level: TrustSignalLevel,
    minutes: number
  ): Promise<boolean> {
    const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();

    const signals = await this.db
      .select({ level: trustSignals.level })
      .from(trustSignals)
      .where(
        and(
          eq(trustSignals.type, type),
          gte(trustSignals.measuredAt, since)
        )
      )
      .orderBy(trustSignals.measuredAt);

    // All signals in the period must be at or above the level
    return signals.length > 0 && signals.every((s) => s.level === level);
  }

  /**
   * Trigger a halt due to STOP-level signal
   */
  private async triggerHalt(
    signalType: TrustSignalType,
    value: number,
    measurement: TrustSignalMeasurement
  ): Promise<void> {
    // Log critical audit event
    const auditService = getAuditService();
    await auditService.log({
      type: 'security:alert' as any,
      severity: 'critical',
      message: `Trust signal STOP triggered: ${signalType} = ${value}`,
      metadata: { signalType, value, measurement },
    });

    // Broadcast halt trigger
    if (this.config.enableBroadcast) {
      const broadcaster = getEventBroadcaster();
      broadcaster.broadcast('trust:failure', {
        type: 'signal_stop',
        signalType,
        value,
        measurement,
        action: 'rollout_freeze_required',
      });
    }

    // The actual freeze is handled by RolloutManager
    // This just emits the signal
  }

  /**
   * Get period start timestamp
   */
  private getPeriodStart(): string {
    return new Date(
      Date.now() - this.config.measurementPeriodHours * 60 * 60 * 1000
    ).toISOString();
  }
}

// Singleton instance
let trustMonitorInstance: TrustMonitor | null = null;

export function initializeTrustMonitor(
  db: Database,
  config?: TrustMonitorConfig
): TrustMonitor {
  trustMonitorInstance = new TrustMonitor(db, config);
  return trustMonitorInstance;
}

export function getTrustMonitor(): TrustMonitor {
  if (!trustMonitorInstance) {
    throw new Error('TrustMonitor not initialized. Call initializeTrustMonitor first.');
  }
  return trustMonitorInstance;
}
