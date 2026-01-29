/**
 * Trust Regression & Rollout Types
 *
 * Type definitions for the ATLAS V1 Rollout & Trust Regression Plan.
 * Implements controlled exposure, aggressive monitoring, and immediate response.
 *
 * @module @atlas/gateway/rollout/types
 */

// ============================================================================
// ROLLOUT PHASE DEFINITIONS
// ============================================================================

/**
 * Rollout phase progression
 * Phase 0: Builder-only (1 user) - Until 7 consecutive days clean
 * Phase 1: Trusted testers (3-5 users) - Until 14 consecutive days clean
 * Phase 2: Extended pilot (10-15 users) - Until 30 consecutive days clean
 * Phase 3: Open v1.0 (unlimited) - After expansion gate criteria met
 */
export type RolloutPhase = 0 | 1 | 2 | 3;

export const ROLLOUT_PHASE_NAMES: Record<RolloutPhase, string> = {
  0: 'Builder-only',
  1: 'Trusted testers',
  2: 'Extended pilot',
  3: 'Open v1.0',
} as const;

export const ROLLOUT_PHASE_LIMITS: Record<RolloutPhase, number> = {
  0: 1,
  1: 5,
  2: 15,
  3: Infinity,
} as const;

export const ROLLOUT_PHASE_CLEAN_DAYS: Record<RolloutPhase, number> = {
  0: 7,
  1: 14,
  2: 30,
  3: Infinity,
} as const;

// ============================================================================
// TRUST SIGNAL TYPES
// ============================================================================

/**
 * The 6 live trust monitoring signals from the rollout plan
 */
export type TrustSignalType =
  | 'briefing_generation_failure' // Signal 1: Complete failures
  | 'retry_usage' // Signal 2: Manual retry patterns
  | 'partial_success' // Signal 3: Sections with failures
  | 'dismissal_behavior' // Signal 4: Items dismissed
  | 'manual_refresh_loop' // Signal 5: Refreshes per session
  | 'trust_risk_alert'; // Signal 6: Trust-risk alerts

/**
 * Trust signal status level
 */
export type TrustSignalLevel = 'normal' | 'warning' | 'stop';

/**
 * Thresholds for each signal
 */
export interface TrustSignalThresholds {
  normal: { max: number };
  warning: { max: number };
  // Above warning.max = STOP
}

export const TRUST_SIGNAL_THRESHOLDS: Record<TrustSignalType, TrustSignalThresholds> = {
  briefing_generation_failure: {
    normal: { max: 0.02 }, // <2%
    warning: { max: 0.05 }, // 2-5%, >5% = STOP
  },
  retry_usage: {
    normal: { max: 0.10 }, // <10%
    warning: { max: 0.20 }, // 10-20%, >20% = STOP
  },
  partial_success: {
    normal: { max: 0.15 }, // <15%
    warning: { max: 0.30 }, // 15-30%, >30% = STOP
  },
  dismissal_behavior: {
    normal: { max: 0.05 }, // <5%
    warning: { max: 0.15 }, // 5-15%, >15% = STOP
  },
  manual_refresh_loop: {
    normal: { max: 1 }, // 0-1 refreshes
    warning: { max: 3 }, // 2-3 refreshes, >3 in 60s = STOP
  },
  trust_risk_alert: {
    normal: { max: 0 }, // 0 alerts
    warning: { max: 2 }, // 1-2 alerts, any STALE_DATA/SILENT_FAILURE = STOP
  },
};

/**
 * Trust-risk alert types that trigger immediate STOP
 */
export type TrustRiskAlertType =
  | 'TRUST_STALE_DATA' // Data shown is outdated
  | 'TRUST_SILENT_FAILURE' // Section failed without user knowing
  | 'TRUST_BEHAVIOR_CHANGE' // Briefing changed unexpectedly
  | 'TRUST_USER_REPORT' // User reported "feels wrong"
  | 'TRUST_MEMORY_ATTRIBUTION' // Memory used without attribution
  | 'TRUST_CASCADE_FAILURE'; // Summary mentions failed section data

/**
 * Signal measurement for a specific period
 */
export interface TrustSignalMeasurement {
  type: TrustSignalType;
  value: number;
  level: TrustSignalLevel;
  numerator?: number;
  denominator?: number;
  measuredAt: string;
  periodStart: string;
  periodEnd: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// TRUST REGRESSION TRIGGERS
// ============================================================================

/**
 * Immediate halt trigger types
 */
export type ImmediateHaltTrigger =
  | 'user_data_mismatch' // "this doesn't match my calendar"
  | 'user_error_confusion' // "I don't understand this error"
  | 'integration_reconnect_loop' // Same integration reconnected >2x in 24h
  | 'retry_button_spam' // Retry clicked >3x on same section
  | 'user_trust_question' // "is this real data?"
  | 'memory_without_attribution' // memoryUsed > 0 without citation
  | 'cascade_prevention_failure'; // Summary mentions failed section

/**
 * Regression event record
 */
export interface TrustRegressionEvent {
  id: string;
  userId: string;
  trigger: ImmediateHaltTrigger;
  severity: 'warning' | 'critical';
  description: string;
  userReported: boolean;
  userFeedback?: string;
  briefingId?: string;
  sectionId?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
  resolution?: string;
}

// ============================================================================
// ROLLOUT STATE
// ============================================================================

/**
 * Rollout freeze state
 */
export interface RolloutFreezeState {
  frozen: boolean;
  frozenAt?: string;
  frozenReason?: string;
  frozenBy?: string; // userId or 'system'
  briefingsDisabled: boolean;
  briefingsDisabledAt?: string;
  briefingsDisabledReason?: string;
}

/**
 * Complete rollout state
 */
export interface RolloutState {
  currentPhase: RolloutPhase;
  consecutiveCleanDays: number;
  lastCleanDayCheck: string;
  totalUsers: number;
  activeUsers: number;
  freeze: RolloutFreezeState;
  lastPhaseChange?: {
    from: RolloutPhase;
    to: RolloutPhase;
    changedAt: string;
    reason: string;
  };
}

// ============================================================================
// USER ELIGIBILITY
// ============================================================================

/**
 * V1 user eligibility traits (required)
 */
export interface UserEligibilityTraits {
  technicalComfort: boolean; // Can distinguish bugs from UX issues
  healthySkepticism: boolean; // Will notice when something "feels wrong"
  directChannel: boolean; // Can report issues without friction
  patience: boolean; // Won't rage-quit over missing features
  dailyToolUser: boolean; // Uses calendar/task tools daily
}

/**
 * Anti-target flags (user should NOT be invited)
 */
export interface UserAntiTargetFlags {
  expectsPolish: boolean; // Will conflate rough edges with broken trust
  ignoresErrors: boolean; // Won't read error messages
  tooManyIntegrations: boolean; // >3 calendar integrations
  nonUSTimezone: boolean; // Timezone bugs risk (initially)
  needsAtlasToWork: boolean; // Dependency creates pressure
}

/**
 * User eligibility assessment
 */
export interface UserEligibilityAssessment {
  userId: string;
  eligible: boolean;
  traits: UserEligibilityTraits;
  antiTargets: UserAntiTargetFlags;
  blockedReasons: string[];
  assessedAt: string;
  assessedBy?: string;
}

// ============================================================================
// DAILY REVIEW
// ============================================================================

/**
 * Daily builder review checklist
 */
export interface DailyReviewChecklist {
  date: string;
  completedAt?: string;
  completedBy?: string;

  // Step 1-6 from the plan
  checks: {
    failureRateCheck: {
      value: number;
      status: TrustSignalLevel;
      checked: boolean;
    };
    retryRateCheck: {
      value: number;
      status: TrustSignalLevel;
      checked: boolean;
    };
    trustAlertsCheck: {
      count: number;
      alerts: TrustRiskAlertType[];
      checked: boolean;
    };
    userReportsCheck: {
      count: number;
      reports: string[];
      checked: boolean;
    };
    builderBriefingCheck: {
      feltRight: boolean;
      notes?: string;
      checked: boolean;
    };
    randomUserSpotCheck: {
      userId?: string;
      briefingId?: string;
      notes?: string;
      checked: boolean;
    };
  };

  // Daily questions
  questions: {
    anyRetryMoreThanOnce: boolean;
    anySection10PercentFailure: boolean;
    anyIntegrationReconnect: boolean;
    anyFailurePattern: string | null;
    builderFeelWrong: string | null;
  };

  // Subtle erosion patterns detected
  erosionPatterns: {
    retryRateCreeping: boolean;
    sameUserDismissingSameType: boolean;
    briefingOpenRateDecline: boolean;
    userAskingHowItWorks: boolean;
  };
}

// ============================================================================
// EXPANSION GATES
// ============================================================================

/**
 * Prerequisites for phase expansion
 */
export interface ExpansionGateStatus {
  currentPhase: RolloutPhase;
  targetPhase: RolloutPhase;
  canExpand: boolean;
  criteria: {
    stabilityDuration: {
      required: number;
      current: number;
      met: boolean;
    };
    trustRiskAlerts: {
      maxAllowed: number;
      count: number;
      met: boolean;
    };
    feelsWrongReports: {
      maxAllowed: number;
      count: number;
      met: boolean;
    };
    retryRate: {
      maxAllowed: number;
      current: number;
      met: boolean;
    };
    partialSuccessRate: {
      maxAllowed: number;
      current: number;
      met: boolean;
    };
  };
  blockedReasons: string[];
  evaluatedAt: string;
}

// ============================================================================
// FREEZE COMMUNICATION
// ============================================================================

/**
 * Freeze response for registration endpoint
 */
export interface FreezeRegistrationResponse {
  status: 'paused';
  message: string;
  dataPreserved: boolean;
  estimatedReturn: string | null;
}

/**
 * Briefings disabled response
 */
export interface BriefingsDisabledResponse {
  status: 'temporarily_disabled';
  message: string;
  dataPreserved: true;
  estimatedReturn: string | null;
}

// ============================================================================
// DECISION RULE TYPES
// ============================================================================

/**
 * PR/change review for the decision rule:
 * "If this change improves capability but weakens predictability, we do not ship it."
 */
export interface PredictabilityReview {
  changeId: string;
  description: string;
  improvesCapability: boolean;
  weakensPredictability: boolean;
  decision: 'ship' | 'no_ship' | 'evaluate_at_gate';
  rationale: string;
  reviewedBy: string;
  reviewedAt: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Trust status API response
 */
export interface TrustStatusResponse {
  rolloutState: RolloutState;
  signals: TrustSignalMeasurement[];
  overallStatus: TrustSignalLevel;
  recentRegressions: TrustRegressionEvent[];
  expansionGate: ExpansionGateStatus;
}

/**
 * User report submission
 */
export interface UserReportInput {
  type: 'feels_wrong' | 'data_mismatch' | 'error_confusion' | 'other';
  description: string;
  briefingId?: string;
  sectionId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Daily review API response
 */
export interface DailyReviewResponse {
  checklist: DailyReviewChecklist;
  signals: TrustSignalMeasurement[];
  recentRegressions: TrustRegressionEvent[];
  userReports24h: Array<{
    userId: string;
    type: string;
    description: string;
    timestamp: string;
  }>;
  recommendations: string[];
}
