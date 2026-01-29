/**
 * Rollout Manager
 *
 * Controls the V1 rollout phases, user eligibility, and freeze procedures.
 *
 * Phase Progression:
 * - Phase 0: Builder-only (1 user) - Until 7 consecutive days clean
 * - Phase 1: Trusted testers (3-5 users) - Until 14 consecutive days clean
 * - Phase 2: Extended pilot (10-15 users) - Until 30 consecutive days clean
 * - Phase 3: Open v1.0 (unlimited) - After expansion gate criteria met
 *
 * Governing Principle: Optimize for trust preservation, not growth.
 *
 * @module @atlas/gateway/rollout/rollout-manager
 */

import { v4 as uuid } from 'uuid';
import type { Database } from '../db/index.js';
import {
  rolloutState,
  userEligibility,
  users,
  trustRegressionEvents,
} from '../db/schema.js';
import { eq, and, gte, count, sql } from 'drizzle-orm';
import {
  RolloutPhase,
  RolloutState,
  RolloutFreezeState,
  UserEligibilityTraits,
  UserAntiTargetFlags,
  UserEligibilityAssessment,
  ExpansionGateStatus,
  FreezeRegistrationResponse,
  BriefingsDisabledResponse,
  ROLLOUT_PHASE_NAMES,
  ROLLOUT_PHASE_LIMITS,
  ROLLOUT_PHASE_CLEAN_DAYS,
} from './types.js';
import { getTrustMonitor, TrustMonitor } from './trust-monitor.js';
import { getEventBroadcaster } from '../events/event-broadcaster.js';
import { getAuditService } from '../audit/audit-service.js';

/**
 * Rollout Manager configuration
 */
export interface RolloutManagerConfig {
  /** Auto-freeze on STOP signals */
  autoFreezeEnabled?: boolean;
  /** Check expansion gates daily */
  dailyGateCheckEnabled?: boolean;
}

/**
 * Rollout Manager Service
 */
export class RolloutManager {
  private db: Database;
  private config: Required<RolloutManagerConfig>;
  private trustMonitor: TrustMonitor | null = null;

  constructor(db: Database, config: RolloutManagerConfig = {}) {
    this.db = db;
    this.config = {
      autoFreezeEnabled: config.autoFreezeEnabled ?? true,
      dailyGateCheckEnabled: config.dailyGateCheckEnabled ?? true,
    };
  }

  /**
   * Initialize the rollout manager (call on startup)
   */
  async initialize(): Promise<void> {
    // Ensure rollout state exists
    await this.ensureRolloutState();

    // Connect to trust monitor
    try {
      this.trustMonitor = getTrustMonitor();
    } catch {
      // Trust monitor not initialized yet, will connect later
    }
  }

  // ============================================================================
  // ROLLOUT STATE MANAGEMENT
  // ============================================================================

  /**
   * Get current rollout state
   */
  async getRolloutState(): Promise<RolloutState> {
    const state = await this.db
      .select()
      .from(rolloutState)
      .limit(1);

    if (!state[0]) {
      // Initialize default state
      return this.ensureRolloutState();
    }

    const s = state[0];
    return {
      currentPhase: s.currentPhase as RolloutPhase,
      consecutiveCleanDays: s.consecutiveCleanDays,
      lastCleanDayCheck: s.lastCleanDayCheck,
      totalUsers: s.totalUsers,
      activeUsers: s.activeUsers,
      freeze: {
        frozen: s.frozen,
        frozenAt: s.frozenAt ?? undefined,
        frozenReason: s.frozenReason ?? undefined,
        frozenBy: s.frozenBy ?? undefined,
        briefingsDisabled: s.briefingsDisabled,
        briefingsDisabledAt: s.briefingsDisabledAt ?? undefined,
        briefingsDisabledReason: s.briefingsDisabledReason ?? undefined,
      },
      lastPhaseChange: s.lastPhaseChangeTo !== null ? {
        from: s.lastPhaseChangeFrom as RolloutPhase,
        to: s.lastPhaseChangeTo as RolloutPhase,
        changedAt: s.lastPhaseChangeAt!,
        reason: s.lastPhaseChangeReason!,
      } : undefined,
    };
  }

  /**
   * Ensure rollout state exists in database
   */
  private async ensureRolloutState(): Promise<RolloutState> {
    const existing = await this.db
      .select()
      .from(rolloutState)
      .limit(1);

    if (existing[0]) {
      return this.getRolloutState();
    }

    // Create initial state (Phase 0)
    await this.db.insert(rolloutState).values({
      id: 'singleton',
      currentPhase: 0,
      consecutiveCleanDays: 0,
      lastCleanDayCheck: new Date().toISOString(),
      totalUsers: 0,
      activeUsers: 0,
      frozen: false,
      briefingsDisabled: false,
    });

    return this.getRolloutState();
  }

  // ============================================================================
  // FREEZE PROCEDURES
  // ============================================================================

  /**
   * Instant Freeze (New Users)
   *
   * 1. Set ATLAS_ROLLOUT_FROZEN=true
   * 2. Registration endpoint returns: "ATLAS is paused for improvements."
   * 3. Existing users continue to have access
   * 4. Log freeze reason to audit trail
   */
  async instantFreeze(
    reason: string,
    triggeredBy: string = 'system'
  ): Promise<void> {
    const now = new Date().toISOString();

    await this.db
      .update(rolloutState)
      .set({
        frozen: true,
        frozenAt: now,
        frozenReason: reason,
        frozenBy: triggeredBy,
        updatedAt: now,
      })
      .where(eq(rolloutState.id, 'singleton'));

    // Audit log
    const auditService = getAuditService();
    await auditService.log({
      type: 'config:changed',
      severity: 'critical',
      message: `Rollout frozen: ${reason}`,
      userId: triggeredBy !== 'system' ? triggeredBy : undefined,
      metadata: { action: 'rollout_freeze', reason, triggeredBy },
    });

    // Broadcast freeze event
    const broadcaster = getEventBroadcaster();
    broadcaster.broadcast('trust:failure', {
      type: 'rollout_frozen',
      reason,
      triggeredBy,
      timestamp: now,
    });
  }

  /**
   * Disable Morning Briefings (Preserve Data)
   *
   * 1. Set BRIEFINGS_ENABLED=false
   * 2. Briefings endpoint returns temporarily_disabled response
   * 3. All user preferences, integrations, and history remain intact
   * 4. Users can still access other ATLAS features
   */
  async disableBriefings(reason: string): Promise<void> {
    const now = new Date().toISOString();

    await this.db
      .update(rolloutState)
      .set({
        briefingsDisabled: true,
        briefingsDisabledAt: now,
        briefingsDisabledReason: reason,
        updatedAt: now,
      })
      .where(eq(rolloutState.id, 'singleton'));

    // Audit log
    const auditService = getAuditService();
    await auditService.log({
      type: 'config:changed',
      severity: 'warning',
      message: `Briefings disabled: ${reason}`,
      metadata: { action: 'briefings_disable', reason },
    });

    // Broadcast
    const broadcaster = getEventBroadcaster();
    broadcaster.broadcast('trust:failure', {
      type: 'briefings_disabled',
      reason,
      timestamp: now,
    });
  }

  /**
   * Unfreeze rollout
   */
  async unfreeze(reason: string, unfrozenBy: string): Promise<void> {
    const now = new Date().toISOString();

    await this.db
      .update(rolloutState)
      .set({
        frozen: false,
        frozenAt: null,
        frozenReason: null,
        frozenBy: null,
        updatedAt: now,
      })
      .where(eq(rolloutState.id, 'singleton'));

    // Audit log
    const auditService = getAuditService();
    await auditService.log({
      type: 'config:changed',
      severity: 'info',
      message: `Rollout unfrozen: ${reason}`,
      userId: unfrozenBy,
      metadata: { action: 'rollout_unfreeze', reason, unfrozenBy },
    });
  }

  /**
   * Re-enable briefings
   */
  async enableBriefings(reason: string): Promise<void> {
    const now = new Date().toISOString();

    await this.db
      .update(rolloutState)
      .set({
        briefingsDisabled: false,
        briefingsDisabledAt: null,
        briefingsDisabledReason: null,
        updatedAt: now,
      })
      .where(eq(rolloutState.id, 'singleton'));

    // Audit log
    const auditService = getAuditService();
    await auditService.log({
      type: 'config:changed',
      severity: 'info',
      message: `Briefings re-enabled: ${reason}`,
      metadata: { action: 'briefings_enable', reason },
    });
  }

  /**
   * Check if registration is allowed
   */
  async canRegister(): Promise<{ allowed: boolean; response?: FreezeRegistrationResponse }> {
    const state = await this.getRolloutState();

    if (state.freeze.frozen) {
      return {
        allowed: false,
        response: {
          status: 'paused',
          message: 'ATLAS is paused for improvements. Your spot is saved.',
          dataPreserved: true,
          estimatedReturn: null,
        },
      };
    }

    // Check user count against phase limit
    const limit = ROLLOUT_PHASE_LIMITS[state.currentPhase];
    if (state.totalUsers >= limit) {
      return {
        allowed: false,
        response: {
          status: 'paused',
          message: `ATLAS is currently in ${ROLLOUT_PHASE_NAMES[state.currentPhase]} phase with limited capacity. Your spot is saved.`,
          dataPreserved: true,
          estimatedReturn: null,
        },
      };
    }

    return { allowed: true };
  }

  /**
   * Check if briefings are available
   */
  async canAccessBriefings(): Promise<{ allowed: boolean; response?: BriefingsDisabledResponse }> {
    const state = await this.getRolloutState();

    if (state.freeze.briefingsDisabled) {
      return {
        allowed: false,
        response: {
          status: 'temporarily_disabled',
          message: 'Morning Briefings are paused while we make improvements.',
          dataPreserved: true,
          estimatedReturn: null,
        },
      };
    }

    return { allowed: true };
  }

  // ============================================================================
  // USER ELIGIBILITY
  // ============================================================================

  /**
   * Assess user eligibility for V1
   */
  async assessEligibility(
    userId: string,
    traits: UserEligibilityTraits,
    antiTargets: UserAntiTargetFlags,
    assessedBy?: string
  ): Promise<UserEligibilityAssessment> {
    const blockedReasons: string[] = [];

    // Check required traits (all must be true)
    if (!traits.technicalComfort) {
      blockedReasons.push('Needs technical comfort with beta software');
    }
    if (!traits.healthySkepticism) {
      blockedReasons.push('Needs healthy skepticism to notice issues');
    }
    if (!traits.directChannel) {
      blockedReasons.push('Needs direct communication channel');
    }
    if (!traits.patience) {
      blockedReasons.push('Needs patience with incomplete features');
    }
    if (!traits.dailyToolUser) {
      blockedReasons.push('Should use calendar/task tools daily');
    }

    // Check anti-targets (any true = blocked)
    if (antiTargets.expectsPolish) {
      blockedReasons.push('DO NOT INVITE: Expects polish, will conflate rough edges with broken trust');
    }
    if (antiTargets.ignoresErrors) {
      blockedReasons.push('DO NOT INVITE: Ignores error messages');
    }
    if (antiTargets.tooManyIntegrations) {
      blockedReasons.push('DO NOT INVITE: >3 calendar integrations creates complexity explosion');
    }
    if (antiTargets.nonUSTimezone) {
      blockedReasons.push('DO NOT INVITE (initially): Non-US timezone, high risk of timezone bugs');
    }
    if (antiTargets.needsAtlasToWork) {
      blockedReasons.push('DO NOT INVITE: Dependency on ATLAS creates pressure to ship faster');
    }

    const eligible = blockedReasons.length === 0;
    const assessedAt = new Date().toISOString();

    // Store assessment
    const existingAssessment = await this.db
      .select()
      .from(userEligibility)
      .where(eq(userEligibility.userId, userId))
      .limit(1);

    if (existingAssessment[0]) {
      await this.db
        .update(userEligibility)
        .set({
          eligible,
          technicalComfort: traits.technicalComfort,
          healthySkepticism: traits.healthySkepticism,
          directChannel: traits.directChannel,
          patience: traits.patience,
          dailyToolUser: traits.dailyToolUser,
          expectsPolish: antiTargets.expectsPolish,
          ignoresErrors: antiTargets.ignoresErrors,
          tooManyIntegrations: antiTargets.tooManyIntegrations,
          nonUSTimezone: antiTargets.nonUSTimezone,
          needsAtlasToWork: antiTargets.needsAtlasToWork,
          blockedReasons: JSON.stringify(blockedReasons),
          assessedAt,
          assessedBy,
          updatedAt: assessedAt,
        })
        .where(eq(userEligibility.userId, userId));
    } else {
      await this.db.insert(userEligibility).values({
        id: uuid(),
        userId,
        eligible,
        technicalComfort: traits.technicalComfort,
        healthySkepticism: traits.healthySkepticism,
        directChannel: traits.directChannel,
        patience: traits.patience,
        dailyToolUser: traits.dailyToolUser,
        expectsPolish: antiTargets.expectsPolish,
        ignoresErrors: antiTargets.ignoresErrors,
        tooManyIntegrations: antiTargets.tooManyIntegrations,
        nonUSTimezone: antiTargets.nonUSTimezone,
        needsAtlasToWork: antiTargets.needsAtlasToWork,
        blockedReasons: JSON.stringify(blockedReasons),
        assessedAt,
        assessedBy,
      });
    }

    return {
      userId,
      eligible,
      traits,
      antiTargets,
      blockedReasons,
      assessedAt,
      assessedBy,
    };
  }

  /**
   * Get user eligibility
   */
  async getUserEligibility(userId: string): Promise<UserEligibilityAssessment | null> {
    const result = await this.db
      .select()
      .from(userEligibility)
      .where(eq(userEligibility.userId, userId))
      .limit(1);

    if (!result[0]) return null;

    const r = result[0];
    return {
      userId: r.userId,
      eligible: r.eligible,
      traits: {
        technicalComfort: r.technicalComfort ?? false,
        healthySkepticism: r.healthySkepticism ?? false,
        directChannel: r.directChannel ?? false,
        patience: r.patience ?? false,
        dailyToolUser: r.dailyToolUser ?? false,
      },
      antiTargets: {
        expectsPolish: r.expectsPolish ?? false,
        ignoresErrors: r.ignoresErrors ?? false,
        tooManyIntegrations: r.tooManyIntegrations ?? false,
        nonUSTimezone: r.nonUSTimezone ?? false,
        needsAtlasToWork: r.needsAtlasToWork ?? false,
      },
      blockedReasons: r.blockedReasons ? JSON.parse(r.blockedReasons) : [],
      assessedAt: r.assessedAt,
      assessedBy: r.assessedBy ?? undefined,
    };
  }

  // ============================================================================
  // EXPANSION GATES
  // ============================================================================

  /**
   * Evaluate expansion gate criteria
   */
  async evaluateExpansionGate(): Promise<ExpansionGateStatus> {
    const state = await this.getRolloutState();
    const currentPhase = state.currentPhase;

    if (currentPhase >= 3) {
      // Already at max phase
      return {
        currentPhase: 3,
        targetPhase: 3,
        canExpand: false,
        criteria: this.getDefaultCriteria(true),
        blockedReasons: ['Already at Open v1.0 phase'],
        evaluatedAt: new Date().toISOString(),
      };
    }

    const targetPhase = (currentPhase + 1) as RolloutPhase;
    const requiredCleanDays = ROLLOUT_PHASE_CLEAN_DAYS[currentPhase];

    // Get trust signals
    const signals = this.trustMonitor
      ? await this.trustMonitor.measureAllSignals()
      : [];

    // Count trust-risk alerts in last 14 days
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const alertCount = await this.db
      .select({ count: count() })
      .from(trustRegressionEvents)
      .where(
        and(
          gte(trustRegressionEvents.timestamp, fourteenDaysAgo),
          eq(trustRegressionEvents.severity, 'critical')
        )
      );

    // Count "feels wrong" reports in last 14 days
    const feelsWrongCount = await this.db
      .select({ count: count() })
      .from(trustRegressionEvents)
      .where(
        and(
          gte(trustRegressionEvents.timestamp, fourteenDaysAgo),
          eq(trustRegressionEvents.userReported, true)
        )
      );

    // Get retry rate and partial success rate from signals
    const retrySignal = signals.find((s) => s.type === 'retry_usage');
    const partialSignal = signals.find((s) => s.type === 'partial_success');

    const criteria: ExpansionGateStatus['criteria'] = {
      stabilityDuration: {
        required: requiredCleanDays,
        current: state.consecutiveCleanDays,
        met: state.consecutiveCleanDays >= requiredCleanDays,
      },
      trustRiskAlerts: {
        maxAllowed: 0,
        count: alertCount[0]?.count || 0,
        met: (alertCount[0]?.count || 0) === 0,
      },
      feelsWrongReports: {
        maxAllowed: 0,
        count: feelsWrongCount[0]?.count || 0,
        met: (feelsWrongCount[0]?.count || 0) === 0,
      },
      retryRate: {
        maxAllowed: 0.08, // <8% for expansion
        current: retrySignal?.value || 0,
        met: (retrySignal?.value || 0) < 0.08,
      },
      partialSuccessRate: {
        maxAllowed: 0.10, // <10% for expansion
        current: partialSignal?.value || 0,
        met: (partialSignal?.value || 0) < 0.10,
      },
    };

    const blockedReasons: string[] = [];
    if (!criteria.stabilityDuration.met) {
      blockedReasons.push(
        `Need ${requiredCleanDays} consecutive clean days (have ${state.consecutiveCleanDays})`
      );
    }
    if (!criteria.trustRiskAlerts.met) {
      blockedReasons.push(`${criteria.trustRiskAlerts.count} trust-risk alerts in last 14 days`);
    }
    if (!criteria.feelsWrongReports.met) {
      blockedReasons.push(`${criteria.feelsWrongReports.count} "feels wrong" reports in last 14 days`);
    }
    if (!criteria.retryRate.met) {
      blockedReasons.push(`Retry rate ${(criteria.retryRate.current * 100).toFixed(1)}% > 8%`);
    }
    if (!criteria.partialSuccessRate.met) {
      blockedReasons.push(
        `Partial success rate ${(criteria.partialSuccessRate.current * 100).toFixed(1)}% > 10%`
      );
    }

    const canExpand = blockedReasons.length === 0;

    return {
      currentPhase,
      targetPhase,
      canExpand,
      criteria,
      blockedReasons,
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * Attempt to advance to next phase
   */
  async tryAdvancePhase(): Promise<{ success: boolean; message: string }> {
    const gateStatus = await this.evaluateExpansionGate();

    if (!gateStatus.canExpand) {
      return {
        success: false,
        message: `Cannot advance: ${gateStatus.blockedReasons.join('; ')}`,
      };
    }

    const state = await this.getRolloutState();
    const now = new Date().toISOString();

    await this.db
      .update(rolloutState)
      .set({
        currentPhase: gateStatus.targetPhase,
        consecutiveCleanDays: 0, // Reset for new phase
        lastPhaseChangeFrom: state.currentPhase,
        lastPhaseChangeTo: gateStatus.targetPhase,
        lastPhaseChangeAt: now,
        lastPhaseChangeReason: 'Expansion gate criteria met',
        updatedAt: now,
      })
      .where(eq(rolloutState.id, 'singleton'));

    // Audit log
    const auditService = getAuditService();
    await auditService.log({
      type: 'config:changed',
      severity: 'info',
      message: `Rollout advanced from Phase ${state.currentPhase} to Phase ${gateStatus.targetPhase}`,
      metadata: {
        action: 'phase_advance',
        from: state.currentPhase,
        to: gateStatus.targetPhase,
        criteria: gateStatus.criteria,
      },
    });

    return {
      success: true,
      message: `Advanced to Phase ${gateStatus.targetPhase}: ${ROLLOUT_PHASE_NAMES[gateStatus.targetPhase]}`,
    };
  }

  /**
   * Record a clean day (call this from daily review)
   */
  async recordCleanDay(): Promise<void> {
    const state = await this.getRolloutState();
    const now = new Date().toISOString();

    await this.db
      .update(rolloutState)
      .set({
        consecutiveCleanDays: state.consecutiveCleanDays + 1,
        lastCleanDayCheck: now,
        updatedAt: now,
      })
      .where(eq(rolloutState.id, 'singleton'));
  }

  /**
   * Reset clean day counter (call when any signal hits STOP or warning persists)
   */
  async resetCleanDays(reason: string): Promise<void> {
    const now = new Date().toISOString();

    await this.db
      .update(rolloutState)
      .set({
        consecutiveCleanDays: 0,
        lastCleanDayCheck: now,
        updatedAt: now,
      })
      .where(eq(rolloutState.id, 'singleton'));

    // Audit log
    const auditService = getAuditService();
    await auditService.log({
      type: 'config:changed',
      severity: 'warning',
      message: `Clean day counter reset: ${reason}`,
      metadata: { action: 'clean_days_reset', reason },
    });
  }

  /**
   * Update user counts
   */
  async updateUserCounts(): Promise<void> {
    const totalCount = await this.db
      .select({ count: count() })
      .from(users);

    // Active = any engagement in last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    // This would need to query user engagement, simplified here
    const activeCount = totalCount[0]?.count || 0;

    await this.db
      .update(rolloutState)
      .set({
        totalUsers: totalCount[0]?.count || 0,
        activeUsers: activeCount,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(rolloutState.id, 'singleton'));
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private getDefaultCriteria(allMet: boolean): ExpansionGateStatus['criteria'] {
    return {
      stabilityDuration: { required: 0, current: 0, met: allMet },
      trustRiskAlerts: { maxAllowed: 0, count: 0, met: allMet },
      feelsWrongReports: { maxAllowed: 0, count: 0, met: allMet },
      retryRate: { maxAllowed: 0.08, current: 0, met: allMet },
      partialSuccessRate: { maxAllowed: 0.10, current: 0, met: allMet },
    };
  }
}

// Singleton instance
let rolloutManagerInstance: RolloutManager | null = null;

export function initializeRolloutManager(
  db: Database,
  config?: RolloutManagerConfig
): RolloutManager {
  rolloutManagerInstance = new RolloutManager(db, config);
  return rolloutManagerInstance;
}

export function getRolloutManager(): RolloutManager {
  if (!rolloutManagerInstance) {
    throw new Error('RolloutManager not initialized. Call initializeRolloutManager first.');
  }
  return rolloutManagerInstance;
}
