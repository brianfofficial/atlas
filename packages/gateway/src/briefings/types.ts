/**
 * Briefing System Types
 *
 * Type definitions for the ATLAS Product Validation Framework.
 * Covers daily/weekly briefings, draft approval workflows, and metrics tracking.
 *
 * @module @atlas/gateway/briefings/types
 */

// ============================================================================
// CORE ENUMS
// ============================================================================

export type BriefingType = 'daily' | 'weekly';

export type BriefingStatus = 'pending' | 'approved' | 'dismissed' | 'expired' | 'edited';

export type DraftItemType = 'email_draft' | 'meeting_prep' | 'follow_up' | 'calendar_note' | 'task_reminder';

export type DraftItemSurface = 'email' | 'calendar' | 'tasks';

export type DraftItemStatus = 'pending' | 'approved' | 'dismissed' | 'edited';

export type DraftSourceType = 'calendar_event' | 'email_thread' | 'memory' | 'pattern' | 'relationship';

export type TrustFailureType =
  | 'close_call' // Almost wrong draft - user catches and fixes
  | 'irrelevant_flood' // Too many irrelevant suggestions
  | 'missed_critical' // Failed to surface something important
  | 'automator_regret' // User regrets approving something
  | 'creepy_recall'; // Memory feature feels invasive

export type ErrorPattern =
  | 'wrong_recipient'
  | 'wrong_tone'
  | 'wrong_date'
  | 'wrong_subject'
  | 'missing_context'
  | 'outdated_info';

export type MetricType =
  | 'daar' // Daily Active Approval Rate
  | 'ttfa' // Time-to-First-Approval
  | 'dar' // Draft Acceptance Rate
  | 'retention_d7' // Day 7 retention
  | 'retention_d14' // Day 14 retention
  | 'retention_d30' // Day 30 retention
  | 'second_surface' // Second Surface Adoption
  | 'unprompted_return' // Unprompted Return Rate
  | 'edit_rate'; // Edit-Before-Approve Rate

export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'cumulative';

export type DeliveryMethod = 'push' | 'email' | 'both';

export type SessionSource = 'notification' | 'user_initiated' | 'scheduled_check';

export type PinnedMemoryType = 'relationship' | 'preference' | 'pattern' | 'important_context';

// ============================================================================
// BRIEFING CONTENT STRUCTURES
// ============================================================================

/**
 * Calendar event for briefing
 */
export interface BriefingCalendarEvent {
  id: string;
  title: string;
  startTime: string; // ISO timestamp
  endTime: string;
  attendees: string[];
  location?: string;
  description?: string;
  isRecurring: boolean;
  requiresPrep: boolean;
  prepSuggestion?: string;
}

/**
 * Email thread requiring attention
 */
export interface BriefingEmailThread {
  id: string;
  subject: string;
  from: string;
  receivedAt: string; // ISO timestamp
  snippet: string;
  isUrgent: boolean;
  suggestedReply?: string;
  threadLength: number;
}

/**
 * Follow-up item from previous interactions
 */
export interface BriefingFollowUp {
  id: string;
  type: 'yesterday_action' | 'pending_thread' | 'scheduled_followup';
  title: string;
  context: string;
  originalDate: string; // ISO timestamp
  priority: 1 | 2 | 3 | 4 | 5;
}

/**
 * Full briefing content structure
 */
export interface BriefingContent {
  type: BriefingType;
  generatedAt: string; // ISO timestamp
  greeting: string;

  // Summary section
  summary: {
    meetingsToday: number;
    emailsNeedingResponse: number;
    followUpsFromYesterday: number;
    busiestDay?: string; // For weekly
  };

  // Calendar section
  calendar: {
    events: BriefingCalendarEvent[];
    prepSuggestions: Array<{
      eventId: string;
      suggestion: string;
      talkingPoints?: string[];
    }>;
  };

  // Email section
  email: {
    threads: BriefingEmailThread[];
    draftReplies: Array<{
      threadId: string;
      draftContent: string;
      tone: 'formal' | 'casual' | 'urgent';
    }>;
  };

  // Follow-ups section
  followUps: BriefingFollowUp[];

  // Weekly-specific sections
  weekly?: {
    busiestDays: string[];
    suggestedDeepWorkBlocks: Array<{
      day: string;
      startTime: string;
      duration: number; // minutes
    }>;
    threadsLikelyToNeedFollowUp: string[];
  };

  // Memory context used
  memoryContext: Array<{
    id: string;
    type: string;
    summary: string;
    usedFor: string;
  }>;
}

// ============================================================================
// DRAFT ITEM STRUCTURES
// ============================================================================

/**
 * A single actionable draft item in a briefing
 */
export interface DraftItemData {
  id: string;
  briefingId: string;
  userId: string;
  type: DraftItemType;
  surface: DraftItemSurface;
  title: string;
  content: string;
  context?: string;

  // Source reference
  source?: {
    type: DraftSourceType;
    id: string;
    metadata?: Record<string, unknown>;
  };

  // Display
  priority: 1 | 2 | 3 | 4 | 5;
  estimatedTimeToReview: number; // seconds

  // State
  status: DraftItemStatus;
  createdAt: string;
}

/**
 * User action on a draft item
 */
export interface DraftItemAction {
  itemId: string;
  action: 'approve' | 'dismiss' | 'edit';
  editedContent?: string;
  dismissReason?: string;
  timestamp: string;
}

/**
 * Result of executing an approved draft
 */
export interface DraftExecutionResult {
  itemId: string;
  success: boolean;
  executedAt: string;
  undoDeadline: string; // 30 seconds from execution
  error?: string;
  externalId?: string; // ID in external system (sent email ID, etc.)
}

// ============================================================================
// METRICS STRUCTURES
// ============================================================================

/**
 * Kill criteria thresholds from the validation framework
 */
export const KILL_CRITERIA = {
  day7: {
    retention: 0.20, // <20% kill threshold
    ttfa: 5 * 60, // >5 minutes median = kill
  },
  day14: {
    dar: 0.20, // <20% draft acceptance = kill
    daar: 0.25, // <25% daily active approval = kill
    secondSurface: 0.15, // <15% using both email + calendar = kill
  },
  day30: {
    unpromptedReturn: 0.05, // <5% user-initiated sessions = kill
    nps: 0, // NPS <0 = kill
  },
} as const;

/**
 * Success thresholds for healthy metrics
 */
export const SUCCESS_THRESHOLDS = {
  daar: 0.60, // >60% of active days have >=1 approval
  ttfa: 60, // <60 seconds median
  dar: 0.50, // >50% acceptance rate
  retention_d7: 0.40, // >40% return at day 7
  secondSurface: 0.50, // >50% use both surfaces within 14 days
  unpromptedReturn: 0.30, // >30% user-initiated by day 14
  editRate: { min: 0.20, max: 0.40 }, // 20-40% is healthy
} as const;

/**
 * Metric data point
 */
export interface MetricDataPoint {
  type: MetricType;
  value: number;
  numerator?: number;
  denominator?: number;
  periodStart: string;
  periodEnd: string;
  periodType: PeriodType;
  metadata?: Record<string, unknown>;
}

/**
 * Metric trend analysis
 */
export interface MetricTrend {
  type: MetricType;
  currentValue: number;
  previousValue: number;
  change: number; // percentage change
  trend: 'improving' | 'stable' | 'declining';
  isHealthy: boolean;
  isAtKillThreshold: boolean;
}

/**
 * Daily metrics snapshot
 */
export interface DailyMetricsSnapshot {
  date: string;
  userId: string;

  // Raw counts
  briefingsGenerated: number;
  briefingsViewed: number;
  draftsShown: number;
  draftsApproved: number;
  draftsDismissed: number;
  draftsEdited: number;

  // Calculated rates
  daar: number; // 1 if any approval, 0 otherwise
  dar: number; // approved / shown
  editRate: number; // edited / (approved + edited)

  // Time metrics
  ttfa?: number; // seconds, null if no actions
  totalEngagementTime: number; // seconds

  // Surface usage
  usedEmail: boolean;
  usedCalendar: boolean;

  // Session tracking
  totalSessions: number;
  unpromptedSessions: number;
}

/**
 * Cohort analysis for retention
 */
export interface CohortRetention {
  cohortDate: string; // Signup date
  cohortSize: number;
  retention: {
    day1: number;
    day3: number;
    day7: number;
    day14: number;
    day30: number;
  };
}

// ============================================================================
// TRUST FAILURE STRUCTURES
// ============================================================================

/**
 * Trust failure event data
 */
export interface TrustFailureData {
  id: string;
  userId: string;
  type: TrustFailureType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  draftItemId?: string;
  errorPattern?: ErrorPattern;
  userReported: boolean;
  userFeedback?: string;
  timestamp: string;
}

/**
 * Trust health score for a user
 */
export interface TrustHealthScore {
  userId: string;
  score: number; // 0-100
  recentFailures: number;
  failuresByType: Partial<Record<TrustFailureType, number>>;
  lastFailureAt?: string;
  riskLevel: 'low' | 'medium' | 'high';
}

// ============================================================================
// SCHEDULE STRUCTURES
// ============================================================================

/**
 * Briefing schedule configuration
 */
export interface BriefingScheduleConfig {
  userId: string;
  daily: {
    enabled: boolean;
    hour: number; // 0-23
    minute: number; // 0-59
    timezone: string;
    deliveryMethod: DeliveryMethod;
  };
  weekly: {
    enabled: boolean;
    dayOfWeek: number; // 0=Sunday
    hour: number;
    minute: number;
    timezone: string;
    deliveryMethod: DeliveryMethod;
  };
}

/**
 * Scheduled job info
 */
export interface ScheduledBriefingJob {
  id: string;
  userId: string;
  type: BriefingType;
  scheduledFor: string; // ISO timestamp
  status: 'pending' | 'running' | 'completed' | 'failed';
  attempts: number;
  lastError?: string;
}

// ============================================================================
// PINNED MEMORY STRUCTURES
// ============================================================================

/**
 * Pinned memory data
 */
export interface PinnedMemoryData {
  id: string;
  userId: string;
  type: PinnedMemoryType;
  title: string;
  content: string;
  sourceType?: 'user_pin' | 'auto_extracted' | 'weekly_consolidation';
  extractedFrom?: string;
  useCount: number;
  lastUsedAt?: string;
  validUntil?: string;
  createdAt: string;
}

/**
 * Memory consolidation result from weekly processing
 */
export interface MemoryConsolidation {
  userId: string;
  processedAt: string;
  memoriesProcessed: number;
  patternsExtracted: number;
  pinnedMemoriesCreated: number;
  expiredMemoriesArchived: number;
}

// ============================================================================
// API RESPONSE STRUCTURES
// ============================================================================

/**
 * Today's briefing response
 */
export interface TodaysBriefingResponse {
  briefing: {
    id: string;
    type: BriefingType;
    status: BriefingStatus;
    generatedAt: string;
    content: BriefingContent;
  };
  draftItems: DraftItemData[];
  metrics: {
    currentStreak: number;
    totalApprovalsToday: number;
    averageTTFA: number;
  };
}

/**
 * Briefing history response
 */
export interface BriefingHistoryResponse {
  briefings: Array<{
    id: string;
    type: BriefingType;
    generatedAt: string;
    viewedAt?: string;
    stats: {
      totalItems: number;
      approvedItems: number;
      dismissedItems: number;
      editedItems: number;
    };
  }>;
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

/**
 * Metrics dashboard response
 */
export interface MetricsDashboardResponse {
  userId: string;
  daysSinceSignup: number;

  // Current metrics
  current: {
    daar: MetricTrend;
    ttfa: MetricTrend;
    dar: MetricTrend;
    editRate: MetricTrend;
    secondSurfaceAdoption: boolean;
    unpromptedReturnRate: MetricTrend;
  };

  // Retention
  retention: {
    day7: { achieved: boolean; value: number };
    day14: { achieved: boolean; value: number };
    day30: { achieved: boolean; value: number };
  };

  // Kill criteria status
  killCriteriaStatus: {
    isAtRisk: boolean;
    triggeredCriteria: string[];
    recommendations: string[];
  };

  // Trust health
  trustHealth: TrustHealthScore;

  // Value compounding signals
  valueCompounding: {
    darTrend: 'improving' | 'stable' | 'declining';
    editRateTrend: 'improving' | 'stable' | 'declining';
    proactiveSuggestionsCount: number;
  };
}

/**
 * Experiment status for 7-day test
 */
export interface ExperimentStatus {
  userId: string;
  experimentDay: number; // 1-7
  experimentStartDate: string;

  // Daily checklist
  dailyChecks: {
    briefingGenerated: boolean;
    notificationSent: boolean;
    briefingViewed: boolean;
    anyApprovals: boolean;
    unpromptedSession: boolean;
  };

  // Cumulative stats
  cumulative: {
    daysWithApproval: number;
    totalApprovals: number;
    totalDismissals: number;
    totalEdits: number;
    medianTTFA: number;
    dar: number;
  };

  // Projected success
  projection: {
    likelyToMeetDay7Retention: boolean;
    likelyToMeetDARThreshold: boolean;
    concerns: string[];
  };
}

// ============================================================================
// EVENT TYPES (WebSocket)
// ============================================================================

export type BriefingEventType =
  | 'briefing:generated'
  | 'briefing:viewed'
  | 'briefing:completed'
  | 'draft:approved'
  | 'draft:dismissed'
  | 'draft:edited'
  | 'draft:executed'
  | 'draft:undone'
  | 'metrics:updated'
  | 'trust:failure'
  | 'schedule:triggered';

export interface BriefingEvent {
  type: BriefingEventType;
  userId: string;
  timestamp: string;
  data: Record<string, unknown>;
}
