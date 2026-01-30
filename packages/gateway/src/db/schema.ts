/**
 * Database Schema
 *
 * Drizzle ORM schema definitions for Atlas tables.
 *
 * @module @atlas/gateway/db/schema
 */

import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// Users table
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    username: text('username').notNull().unique(),
    email: text('email').unique(),
    passwordHash: text('password_hash').notNull(),
    mfaSecret: text('mfa_secret').notNull(),
    mfaEnabled: integer('mfa_enabled', { mode: 'boolean' }).notNull().default(false),
    backupCodes: text('backup_codes').notNull().default('[]'),
    mfaToken: text('mfa_token'),
    mfaTokenExpiresAt: text('mfa_token_expires_at'),
    failedAttempts: integer('failed_attempts').notNull().default(0),
    lockedUntil: text('locked_until'),
    lastLoginAt: text('last_login_at'),
    createdAt: text('created_at').notNull().default("datetime('now')"),
    updatedAt: text('updated_at').notNull().default("datetime('now')"),
  },
  (table) => ({
    emailIdx: index('idx_users_email').on(table.email),
    usernameIdx: index('idx_users_username').on(table.username),
    mfaTokenIdx: index('idx_users_mfa_token').on(table.mfaToken),
  })
);

// Sessions table
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deviceId: text('device_id').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    lastActivityAt: text('last_activity_at').notNull().default("datetime('now')"),
    expiresAt: text('expires_at').notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default("datetime('now')"),
  },
  (table) => ({
    userIdIdx: index('idx_sessions_user_id').on(table.userId),
    deviceIdIdx: index('idx_sessions_device_id').on(table.deviceId),
    expiresIdx: index('idx_sessions_expires').on(table.expiresAt),
  })
);

// Credentials table (metadata only)
export const credentials = sqliteTable(
  'credentials',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    name: text('name').notNull().unique(),
    service: text('service').notNull(),
    metadata: text('metadata').default('{}'),
    lastRotated: text('last_rotated'),
    createdAt: text('created_at').notNull().default("datetime('now')"),
    updatedAt: text('updated_at').notNull().default("datetime('now')"),
  },
  (table) => ({
    nameIdx: index('idx_credentials_name').on(table.name),
    serviceIdx: index('idx_credentials_service').on(table.service),
  })
);

// Audit logs table
export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    severity: text('severity').notNull().default('info'),
    message: text('message').notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    sessionId: text('session_id'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    metadata: text('metadata').default('{}'),
    timestamp: text('timestamp').notNull().default("datetime('now')"),
  },
  (table) => ({
    typeIdx: index('idx_audit_logs_type').on(table.type),
    severityIdx: index('idx_audit_logs_severity').on(table.severity),
    userIdIdx: index('idx_audit_logs_user_id').on(table.userId),
    timestampIdx: index('idx_audit_logs_timestamp').on(table.timestamp),
  })
);

// Preferences table
export const preferences = sqliteTable(
  'preferences',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    theme: text('theme').default('system'),
    notifications: text('notifications').default('{}'),
    privacy: text('privacy').default('{}'),
    ai: text('ai').default('{}'),
    security: text('security').default('{}'),
    updatedAt: text('updated_at').notNull().default("datetime('now')"),
  },
  (table) => ({
    userIdIdx: index('idx_preferences_user_id').on(table.userId),
  })
);

// Goals table
export const goals = sqliteTable(
  'goals',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    category: text('category').notNull(),
    priority: text('priority').notNull(),
    dueDate: text('due_date'),
    progress: integer('progress').notNull().default(0),
    createdAt: text('created_at').notNull().default("datetime('now')"),
    updatedAt: text('updated_at').notNull().default("datetime('now')"),
  },
  (table) => ({
    userIdIdx: index('idx_goals_user_id').on(table.userId),
  })
);

// Memory entries table
export const memoryEntries = sqliteTable(
  'memory_entries',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    content: text('content').notNull(),
    summary: text('summary'),
    importance: text('importance').notNull(),
    source: text('source').notNull(),
    metadata: text('metadata').default('{}'),
    tags: text('tags').default('[]'),
    accessCount: integer('access_count').notNull().default(0),
    lastAccessedAt: text('last_accessed_at'),
    expiresAt: text('expires_at'),
    createdAt: text('created_at').notNull().default("datetime('now')"),
    updatedAt: text('updated_at').notNull().default("datetime('now')"),
  },
  (table) => ({
    userIdIdx: index('idx_memory_entries_user_id').on(table.userId),
    typeIdx: index('idx_memory_entries_type').on(table.type),
    importanceIdx: index('idx_memory_entries_importance').on(table.importance),
  })
);

// Cost tracking table
export const costEntries = sqliteTable(
  'cost_entries',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    modelId: text('model_id').notNull(),
    tokensInput: integer('tokens_input').notNull(),
    tokensOutput: integer('tokens_output').notNull(),
    cost: real('cost').notNull(),
    requestId: text('request_id'),
    createdAt: text('created_at').notNull().default("datetime('now')"),
  },
  (table) => ({
    userIdIdx: index('idx_cost_entries_user_id').on(table.userId),
    modelIdIdx: index('idx_cost_entries_model_id').on(table.modelId),
    createdAtIdx: index('idx_cost_entries_created_at').on(table.createdAt),
  })
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  preferences: many(preferences),
  goals: many(goals),
  memoryEntries: many(memoryEntries),
  auditLogs: many(auditLogs),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const preferencesRelations = relations(preferences, ({ one }) => ({
  user: one(users, {
    fields: [preferences.userId],
    references: [users.id],
  }),
}));

export const goalsRelations = relations(goals, ({ one }) => ({
  user: one(users, {
    fields: [goals.userId],
    references: [users.id],
  }),
}));

export const memoryEntriesRelations = relations(memoryEntries, ({ one }) => ({
  user: one(users, {
    fields: [memoryEntries.userId],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// BRIEFING SYSTEM TABLES (Product Validation Framework)
// ============================================================================

/**
 * Briefing drafts - Generated briefings awaiting user approval
 * Supports daily and weekly briefing types with approval workflow
 */
export const briefingDrafts = sqliteTable(
  'briefing_drafts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'daily' | 'weekly'
    status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'dismissed' | 'expired' | 'edited'
    generatedAt: text('generated_at').notNull().default("datetime('now')"),
    approvalDeadline: text('approval_deadline'), // Auto-dismiss after this time

    // Briefing content (JSON)
    content: text('content').notNull(), // Full briefing JSON

    // Draft items for approval (max 5 per briefing)
    draftItems: text('draft_items').notNull().default('[]'), // Array of DraftItem

    // Metadata
    source: text('source').notNull().default('scheduled'), // 'scheduled' | 'manual' | 'notification'
    notificationSentAt: text('notification_sent_at'),
    viewedAt: text('viewed_at'),
    resolvedAt: text('resolved_at'),

    // User action tracking
    userAction: text('user_action'), // 'approved' | 'dismissed' | 'edited' | 'timeout'
    editedContent: text('edited_content'), // If user edited before approving

    createdAt: text('created_at').notNull().default("datetime('now')"),
    updatedAt: text('updated_at').notNull().default("datetime('now')"),
  },
  (table) => ({
    userIdIdx: index('idx_briefing_drafts_user_id').on(table.userId),
    statusIdx: index('idx_briefing_drafts_status').on(table.status),
    typeIdx: index('idx_briefing_drafts_type').on(table.type),
    generatedAtIdx: index('idx_briefing_drafts_generated_at').on(table.generatedAt),
    userStatusIdx: index('idx_briefing_drafts_user_status').on(table.userId, table.status),
  })
);

/**
 * Draft items - Individual actionable items within a briefing
 * Tracks approval/dismiss/edit actions per item
 */
export const draftItems = sqliteTable(
  'draft_items',
  {
    id: text('id').primaryKey(),
    briefingId: text('briefing_id')
      .notNull()
      .references(() => briefingDrafts.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Item details
    type: text('type').notNull(), // 'email_draft' | 'meeting_prep' | 'follow_up' | 'calendar_note'
    surface: text('surface').notNull(), // 'email' | 'calendar' | 'tasks'
    title: text('title').notNull(),
    content: text('content').notNull(), // The draft content
    context: text('context'), // Why this was suggested

    // Source references
    sourceType: text('source_type'), // 'calendar_event' | 'email_thread' | 'memory'
    sourceId: text('source_id'), // Reference to source (event ID, thread ID, etc.)
    sourceMetadata: text('source_metadata').default('{}'),

    // Status tracking
    status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'dismissed' | 'edited'
    priority: integer('priority').notNull().default(1), // 1-5, higher = more important

    // User action tracking
    actionTakenAt: text('action_taken_at'),
    editedContent: text('edited_content'),
    dismissReason: text('dismiss_reason'),

    // Undo support (30-second window)
    executedAt: text('executed_at'),
    undoDeadline: text('undo_deadline'),
    undoneAt: text('undone_at'),

    createdAt: text('created_at').notNull().default("datetime('now')"),
  },
  (table) => ({
    briefingIdIdx: index('idx_draft_items_briefing_id').on(table.briefingId),
    userIdIdx: index('idx_draft_items_user_id').on(table.userId),
    statusIdx: index('idx_draft_items_status').on(table.status),
    surfaceIdx: index('idx_draft_items_surface').on(table.surface),
    typeIdx: index('idx_draft_items_type').on(table.type),
  })
);

/**
 * Briefing history - Completed briefings for historical analysis
 */
export const briefingHistory = sqliteTable(
  'briefing_history',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    briefingId: text('briefing_id'), // Original draft ID
    type: text('type').notNull(), // 'daily' | 'weekly'

    generatedAt: text('generated_at').notNull(),
    deliveredAt: text('delivered_at'),
    viewedAt: text('viewed_at'),
    completedAt: text('completed_at'),

    // Content snapshot
    content: text('content').notNull(),

    // Aggregated stats
    totalItems: integer('total_items').notNull().default(0),
    approvedItems: integer('approved_items').notNull().default(0),
    dismissedItems: integer('dismissed_items').notNull().default(0),
    editedItems: integer('edited_items').notNull().default(0),

    // Time metrics
    timeToFirstAction: integer('time_to_first_action'), // Seconds from view to first action
    totalEngagementTime: integer('total_engagement_time'), // Total seconds spent

    // Quality signals
    userSatisfaction: integer('user_satisfaction'), // 1-5 rating if provided
    missedImportant: integer('missed_important', { mode: 'boolean' }).default(false),

    createdAt: text('created_at').notNull().default("datetime('now')"),
  },
  (table) => ({
    userIdIdx: index('idx_briefing_history_user_id').on(table.userId),
    typeIdx: index('idx_briefing_history_type').on(table.type),
    generatedAtIdx: index('idx_briefing_history_generated_at').on(table.generatedAt),
    userTypeIdx: index('idx_briefing_history_user_type').on(table.userId, table.type),
  })
);

/**
 * Briefing metrics - KPI tracking for product validation
 * Tracks: DAAR, TTFA, DAR, Day 7 Retention, Second Surface, Unprompted Return, Edit Rate
 */
export const briefingMetrics = sqliteTable(
  'briefing_metrics',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Metric identification
    metricType: text('metric_type').notNull(), // 'daar' | 'ttfa' | 'dar' | 'retention' | 'second_surface' | 'unprompted_return' | 'edit_rate'

    // Values
    value: real('value').notNull(),
    numerator: integer('numerator'), // For rate calculations
    denominator: integer('denominator'), // For rate calculations

    // Time context
    periodStart: text('period_start').notNull(), // Start of measurement period
    periodEnd: text('period_end').notNull(), // End of measurement period
    periodType: text('period_type').notNull(), // 'daily' | 'weekly' | 'monthly' | 'cumulative'

    // Additional context
    metadata: text('metadata').default('{}'),

    timestamp: text('timestamp').notNull().default("datetime('now')"),
  },
  (table) => ({
    userIdIdx: index('idx_briefing_metrics_user_id').on(table.userId),
    metricTypeIdx: index('idx_briefing_metrics_type').on(table.metricType),
    timestampIdx: index('idx_briefing_metrics_timestamp').on(table.timestamp),
    userMetricIdx: index('idx_briefing_metrics_user_metric').on(table.userId, table.metricType),
  })
);

/**
 * Briefing schedules - User-configurable briefing delivery times
 */
export const briefingSchedules = sqliteTable(
  'briefing_schedules',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Schedule config
    type: text('type').notNull(), // 'daily' | 'weekly'
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),

    // Timing
    hour: integer('hour').notNull().default(7), // 0-23
    minute: integer('minute').notNull().default(30), // 0-59
    timezone: text('timezone').notNull().default('America/New_York'),

    // Weekly specific
    dayOfWeek: integer('day_of_week'), // 0=Sunday, 1=Monday, etc. (for weekly)

    // Execution tracking
    lastRunAt: text('last_run_at'),
    nextRunAt: text('next_run_at'),

    // Delivery preferences
    deliveryMethod: text('delivery_method').notNull().default('push'), // 'push' | 'email' | 'both'

    createdAt: text('created_at').notNull().default("datetime('now')"),
    updatedAt: text('updated_at').notNull().default("datetime('now')"),
  },
  (table) => ({
    userIdIdx: index('idx_briefing_schedules_user_id').on(table.userId),
    typeIdx: index('idx_briefing_schedules_type').on(table.type),
    enabledIdx: index('idx_briefing_schedules_enabled').on(table.enabled),
    nextRunIdx: index('idx_briefing_schedules_next_run').on(table.nextRunAt),
  })
);

/**
 * User engagement tracking - Daily engagement records for retention metrics
 */
export const userEngagement = sqliteTable(
  'user_engagement',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Date tracking (YYYY-MM-DD format)
    date: text('date').notNull(),

    // Session tracking
    sessionCount: integer('session_count').notNull().default(0),
    unpromptedSessions: integer('unprompted_sessions').notNull().default(0), // User-initiated
    notificationSessions: integer('notification_sessions').notNull().default(0), // Notification-driven

    // Briefing engagement
    briefingsViewed: integer('briefings_viewed').notNull().default(0),
    draftsApproved: integer('drafts_approved').notNull().default(0),
    draftsDismissed: integer('drafts_dismissed').notNull().default(0),
    draftsEdited: integer('drafts_edited').notNull().default(0),

    // Surface usage (for Second Surface Adoption metric)
    usedEmailSurface: integer('used_email_surface', { mode: 'boolean' }).default(false),
    usedCalendarSurface: integer('used_calendar_surface', { mode: 'boolean' }).default(false),
    usedTasksSurface: integer('used_tasks_surface', { mode: 'boolean' }).default(false),

    // Time metrics
    totalEngagementSeconds: integer('total_engagement_seconds').notNull().default(0),
    firstActionAt: text('first_action_at'),
    lastActionAt: text('last_action_at'),

    // First day tracking (for Day N retention)
    daysSinceSignup: integer('days_since_signup'),

    createdAt: text('created_at').notNull().default("datetime('now')"),
    updatedAt: text('updated_at').notNull().default("datetime('now')"),
  },
  (table) => ({
    userIdIdx: index('idx_user_engagement_user_id').on(table.userId),
    dateIdx: index('idx_user_engagement_date').on(table.date),
    userDateIdx: index('idx_user_engagement_user_date').on(table.userId, table.date),
  })
);

/**
 * Trust failure events - Track incidents that may erode user trust
 */
export const trustFailureEvents = sqliteTable(
  'trust_failure_events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    draftItemId: text('draft_item_id')
      .references(() => draftItems.id, { onDelete: 'set null' }),

    // Failure type
    failureType: text('failure_type').notNull(), // 'close_call' | 'irrelevant_flood' | 'missed_critical' | 'automator_regret' | 'creepy_recall'
    severity: text('severity').notNull().default('medium'), // 'low' | 'medium' | 'high' | 'critical'

    // Details
    description: text('description'),
    errorPattern: text('error_pattern'), // For close_call: what type of error (wrong_recipient, wrong_tone, wrong_date)

    // User feedback
    userReported: integer('user_reported', { mode: 'boolean' }).default(false),
    userFeedback: text('user_feedback'),

    // Resolution
    resolved: integer('resolved', { mode: 'boolean' }).default(false),
    resolution: text('resolution'),

    timestamp: text('timestamp').notNull().default("datetime('now')"),
  },
  (table) => ({
    userIdIdx: index('idx_trust_failure_user_id').on(table.userId),
    failureTypeIdx: index('idx_trust_failure_type').on(table.failureType),
    timestampIdx: index('idx_trust_failure_timestamp').on(table.timestamp),
  })
);

/**
 * Pinned memories - Important context that persists beyond 7-day rolling window
 */
export const pinnedMemories = sqliteTable(
  'pinned_memories',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    memoryEntryId: text('memory_entry_id')
      .references(() => memoryEntries.id, { onDelete: 'set null' }),

    // Pinned content
    type: text('type').notNull(), // 'relationship' | 'preference' | 'pattern' | 'important_context'
    title: text('title').notNull(),
    content: text('content').notNull(),

    // Source tracking
    sourceType: text('source_type'), // 'user_pin' | 'auto_extracted' | 'weekly_consolidation'
    extractedFrom: text('extracted_from'), // Reference to original data

    // Usage tracking
    useCount: integer('use_count').notNull().default(0),
    lastUsedAt: text('last_used_at'),

    // Validity
    validUntil: text('valid_until'), // Optional expiry for time-bound info

    createdAt: text('created_at').notNull().default("datetime('now')"),
    updatedAt: text('updated_at').notNull().default("datetime('now')"),
  },
  (table) => ({
    userIdIdx: index('idx_pinned_memories_user_id').on(table.userId),
    typeIdx: index('idx_pinned_memories_type').on(table.type),
  })
);

// ============================================================================
// BRIEFING SYSTEM RELATIONS
// ============================================================================

export const briefingDraftsRelations = relations(briefingDrafts, ({ one, many }) => ({
  user: one(users, {
    fields: [briefingDrafts.userId],
    references: [users.id],
  }),
  items: many(draftItems),
}));

export const draftItemsRelations = relations(draftItems, ({ one }) => ({
  briefing: one(briefingDrafts, {
    fields: [draftItems.briefingId],
    references: [briefingDrafts.id],
  }),
  user: one(users, {
    fields: [draftItems.userId],
    references: [users.id],
  }),
}));

export const briefingHistoryRelations = relations(briefingHistory, ({ one }) => ({
  user: one(users, {
    fields: [briefingHistory.userId],
    references: [users.id],
  }),
}));

export const briefingMetricsRelations = relations(briefingMetrics, ({ one }) => ({
  user: one(users, {
    fields: [briefingMetrics.userId],
    references: [users.id],
  }),
}));

export const briefingSchedulesRelations = relations(briefingSchedules, ({ one }) => ({
  user: one(users, {
    fields: [briefingSchedules.userId],
    references: [users.id],
  }),
}));

export const userEngagementRelations = relations(userEngagement, ({ one }) => ({
  user: one(users, {
    fields: [userEngagement.userId],
    references: [users.id],
  }),
}));

export const trustFailureEventsRelations = relations(trustFailureEvents, ({ one }) => ({
  user: one(users, {
    fields: [trustFailureEvents.userId],
    references: [users.id],
  }),
  draftItem: one(draftItems, {
    fields: [trustFailureEvents.draftItemId],
    references: [draftItems.id],
  }),
}));

export const pinnedMemoriesRelations = relations(pinnedMemories, ({ one }) => ({
  user: one(users, {
    fields: [pinnedMemories.userId],
    references: [users.id],
  }),
  memoryEntry: one(memoryEntries, {
    fields: [pinnedMemories.memoryEntryId],
    references: [memoryEntries.id],
  }),
}));

// ============================================================================
// ROLLOUT & TRUST REGRESSION TABLES (V1 Trust Monitoring)
// ============================================================================

/**
 * Rollout state - Global rollout configuration and freeze state
 * Only one row should exist (singleton pattern)
 */
export const rolloutState = sqliteTable('rollout_state', {
  id: text('id').primaryKey().default('singleton'),
  currentPhase: integer('current_phase').notNull().default(0), // 0-3
  consecutiveCleanDays: integer('consecutive_clean_days').notNull().default(0),
  lastCleanDayCheck: text('last_clean_day_check').notNull().default("datetime('now')"),
  totalUsers: integer('total_users').notNull().default(0),
  activeUsers: integer('active_users').notNull().default(0),

  // Freeze state
  frozen: integer('frozen', { mode: 'boolean' }).notNull().default(false),
  frozenAt: text('frozen_at'),
  frozenReason: text('frozen_reason'),
  frozenBy: text('frozen_by'), // userId or 'system'

  // Briefings disable state
  briefingsDisabled: integer('briefings_disabled', { mode: 'boolean' }).notNull().default(false),
  briefingsDisabledAt: text('briefings_disabled_at'),
  briefingsDisabledReason: text('briefings_disabled_reason'),

  // Last phase change
  lastPhaseChangeFrom: integer('last_phase_change_from'),
  lastPhaseChangeTo: integer('last_phase_change_to'),
  lastPhaseChangeAt: text('last_phase_change_at'),
  lastPhaseChangeReason: text('last_phase_change_reason'),

  updatedAt: text('updated_at').notNull().default("datetime('now')"),
});

/**
 * Trust signal measurements - Live monitoring signals
 */
export const trustSignals = sqliteTable(
  'trust_signals',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(), // TrustSignalType
    value: real('value').notNull(),
    level: text('level').notNull(), // 'normal' | 'warning' | 'stop'
    numerator: integer('numerator'),
    denominator: integer('denominator'),
    periodStart: text('period_start').notNull(),
    periodEnd: text('period_end').notNull(),
    metadata: text('metadata').default('{}'),
    measuredAt: text('measured_at').notNull().default("datetime('now')"),
  },
  (table) => ({
    typeIdx: index('idx_trust_signals_type').on(table.type),
    levelIdx: index('idx_trust_signals_level').on(table.level),
    measuredAtIdx: index('idx_trust_signals_measured_at').on(table.measuredAt),
  })
);

/**
 * Trust regression events - Halt triggers and user reports
 */
export const trustRegressionEvents = sqliteTable(
  'trust_regression_events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    trigger: text('trigger').notNull(), // ImmediateHaltTrigger
    severity: text('severity').notNull().default('warning'), // 'warning' | 'critical'
    description: text('description').notNull(),
    userReported: integer('user_reported', { mode: 'boolean' }).notNull().default(false),
    userFeedback: text('user_feedback'),
    briefingId: text('briefing_id'),
    sectionId: text('section_id'),
    metadata: text('metadata').default('{}'),
    resolved: integer('resolved', { mode: 'boolean' }).notNull().default(false),
    resolvedAt: text('resolved_at'),
    resolution: text('resolution'),
    timestamp: text('timestamp').notNull().default("datetime('now')"),
  },
  (table) => ({
    userIdIdx: index('idx_trust_regression_user_id').on(table.userId),
    triggerIdx: index('idx_trust_regression_trigger').on(table.trigger),
    severityIdx: index('idx_trust_regression_severity').on(table.severity),
    resolvedIdx: index('idx_trust_regression_resolved').on(table.resolved),
    timestampIdx: index('idx_trust_regression_timestamp').on(table.timestamp),
  })
);

/**
 * User eligibility - Tracks V1 eligibility assessments
 */
export const userEligibility = sqliteTable(
  'user_eligibility',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    eligible: integer('eligible', { mode: 'boolean' }).notNull().default(false),

    // Required traits (all must be true for eligibility)
    technicalComfort: integer('technical_comfort', { mode: 'boolean' }).default(false),
    healthySkepticism: integer('healthy_skepticism', { mode: 'boolean' }).default(false),
    directChannel: integer('direct_channel', { mode: 'boolean' }).default(false),
    patience: integer('patience', { mode: 'boolean' }).default(false),
    dailyToolUser: integer('daily_tool_user', { mode: 'boolean' }).default(false),

    // Anti-target flags (any true = ineligible)
    expectsPolish: integer('expects_polish', { mode: 'boolean' }).default(false),
    ignoresErrors: integer('ignores_errors', { mode: 'boolean' }).default(false),
    tooManyIntegrations: integer('too_many_integrations', { mode: 'boolean' }).default(false),
    nonUSTimezone: integer('non_us_timezone', { mode: 'boolean' }).default(false),
    needsAtlasToWork: integer('needs_atlas_to_work', { mode: 'boolean' }).default(false),

    blockedReasons: text('blocked_reasons').default('[]'), // JSON array
    assessedAt: text('assessed_at').notNull().default("datetime('now')"),
    assessedBy: text('assessed_by'),
    updatedAt: text('updated_at').notNull().default("datetime('now')"),
  },
  (table) => ({
    userIdIdx: index('idx_user_eligibility_user_id').on(table.userId),
    eligibleIdx: index('idx_user_eligibility_eligible').on(table.eligible),
  })
);

/**
 * Daily review checklists - Builder review tracking
 */
export const dailyReviewChecklists = sqliteTable(
  'daily_review_checklists',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull().unique(), // YYYY-MM-DD
    completedAt: text('completed_at'),
    completedBy: text('completed_by'),

    // Check values (JSON)
    checks: text('checks').notNull().default('{}'),

    // Daily questions (JSON)
    questions: text('questions').notNull().default('{}'),

    // Erosion patterns detected (JSON)
    erosionPatterns: text('erosion_patterns').notNull().default('{}'),

    // Overall assessment
    allClear: integer('all_clear', { mode: 'boolean' }).default(false),
    notes: text('notes'),

    createdAt: text('created_at').notNull().default("datetime('now')"),
    updatedAt: text('updated_at').notNull().default("datetime('now')"),
  },
  (table) => ({
    dateIdx: index('idx_daily_review_date').on(table.date),
    completedAtIdx: index('idx_daily_review_completed_at').on(table.completedAt),
  })
);

/**
 * Briefing retry tracking - Per-session retry counts
 */
export const briefingRetries = sqliteTable(
  'briefing_retries',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    briefingId: text('briefing_id'),
    sessionId: text('session_id').notNull(),
    sectionId: text('section_id'), // Which section was retried
    retryCount: integer('retry_count').notNull().default(1),
    firstRetryAt: text('first_retry_at').notNull().default("datetime('now')"),
    lastRetryAt: text('last_retry_at').notNull().default("datetime('now')"),
    // Track retries within 60 seconds (for STOP detection)
    retriesInLastMinute: integer('retries_in_last_minute').notNull().default(1),
  },
  (table) => ({
    userIdIdx: index('idx_briefing_retries_user_id').on(table.userId),
    sessionIdIdx: index('idx_briefing_retries_session_id').on(table.sessionId),
    lastRetryIdx: index('idx_briefing_retries_last_retry').on(table.lastRetryAt),
  })
);

// Relations for rollout tables
export const rolloutStateRelations = relations(rolloutState, () => ({}));

export const trustSignalsRelations = relations(trustSignals, () => ({}));

export const trustRegressionEventsRelations = relations(trustRegressionEvents, ({ one }) => ({
  user: one(users, {
    fields: [trustRegressionEvents.userId],
    references: [users.id],
  }),
}));

export const userEligibilityRelations = relations(userEligibility, ({ one }) => ({
  user: one(users, {
    fields: [userEligibility.userId],
    references: [users.id],
  }),
}));

export const dailyReviewChecklistsRelations = relations(dailyReviewChecklists, () => ({}));

export const briefingRetriesRelations = relations(briefingRetries, ({ one }) => ({
  user: one(users, {
    fields: [briefingRetries.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// CHAT SYSTEM TABLES
// ============================================================================

/**
 * Conversations - Chat conversation containers
 */
export const conversations = sqliteTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default('New Conversation'),
    messageCount: integer('message_count').notNull().default(0),
    lastMessageAt: text('last_message_at'),
    lastMessage: text('last_message'), // Preview of last message
    metadata: text('metadata').default('{}'),
    createdAt: text('created_at').notNull().default("datetime('now')"),
    updatedAt: text('updated_at').notNull().default("datetime('now')"),
  },
  (table) => ({
    userIdIdx: index('idx_conversations_user_id').on(table.userId),
    updatedAtIdx: index('idx_conversations_updated_at').on(table.updatedAt),
    userUpdatedIdx: index('idx_conversations_user_updated').on(table.userId, table.updatedAt),
  })
);

/**
 * Messages - Individual chat messages
 */
export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // 'user' | 'assistant' | 'system'
    content: text('content').notNull(),

    // AI response metadata
    model: text('model'),
    provider: text('provider'),
    tokensInput: integer('tokens_input'),
    tokensOutput: integer('tokens_output'),
    durationMs: integer('duration_ms'),
    estimatedCost: real('estimated_cost'),
    finishReason: text('finish_reason'), // 'stop' | 'max_tokens' | 'error'

    // Error tracking
    error: text('error'),

    // General metadata
    metadata: text('metadata').default('{}'),
    createdAt: text('created_at').notNull().default("datetime('now')"),
  },
  (table) => ({
    conversationIdIdx: index('idx_messages_conversation_id').on(table.conversationId),
    createdAtIdx: index('idx_messages_created_at').on(table.createdAt),
    roleIdx: index('idx_messages_role').on(table.role),
  })
);

/**
 * Message attachments - Files attached to messages
 */
export const messageAttachments = sqliteTable(
  'message_attachments',
  {
    id: text('id').primaryKey(),
    messageId: text('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    fileId: text('file_id').notNull(),
    fileName: text('file_name').notNull(),
    fileSize: integer('file_size'),
    fileType: text('file_type'),
    url: text('url'),
    createdAt: text('created_at').notNull().default("datetime('now')"),
  },
  (table) => ({
    messageIdIdx: index('idx_message_attachments_message_id').on(table.messageId),
    fileIdIdx: index('idx_message_attachments_file_id').on(table.fileId),
  })
);

// Chat system relations
export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  attachments: many(messageAttachments),
}));

export const messageAttachmentsRelations = relations(messageAttachments, ({ one }) => ({
  message: one(messages, {
    fields: [messageAttachments.messageId],
    references: [messages.id],
  }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Credential = typeof credentials.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Preferences = typeof preferences.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type MemoryEntry = typeof memoryEntries.$inferSelect;
export type CostEntry = typeof costEntries.$inferSelect;

// Briefing system types
export type BriefingDraft = typeof briefingDrafts.$inferSelect;
export type NewBriefingDraft = typeof briefingDrafts.$inferInsert;
export type DraftItem = typeof draftItems.$inferSelect;
export type NewDraftItem = typeof draftItems.$inferInsert;
export type BriefingHistory = typeof briefingHistory.$inferSelect;
export type BriefingMetric = typeof briefingMetrics.$inferSelect;
export type BriefingSchedule = typeof briefingSchedules.$inferSelect;
export type UserEngagement = typeof userEngagement.$inferSelect;
export type TrustFailureEvent = typeof trustFailureEvents.$inferSelect;
export type PinnedMemory = typeof pinnedMemories.$inferSelect;

// Rollout system types
export type RolloutStateRow = typeof rolloutState.$inferSelect;
export type TrustSignalRow = typeof trustSignals.$inferSelect;
export type TrustRegressionEventRow = typeof trustRegressionEvents.$inferSelect;
export type UserEligibilityRow = typeof userEligibility.$inferSelect;
export type DailyReviewChecklistRow = typeof dailyReviewChecklists.$inferSelect;
export type BriefingRetryRow = typeof briefingRetries.$inferSelect;

// Chat system types
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type MessageAttachment = typeof messageAttachments.$inferSelect;
export type NewMessageAttachment = typeof messageAttachments.$inferInsert;

// ============================================================================
// FILE STORAGE TABLES
// ============================================================================

/**
 * Uploaded files - File metadata storage
 */
export const files = sqliteTable(
  'files',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    originalName: text('original_name').notNull(),
    size: integer('size').notNull(),
    mimeType: text('mime_type').notNull(),
    category: text('category').notNull(), // 'image' | 'document' | 'code'
    storagePath: text('storage_path').notNull(),
    url: text('url'),
    thumbnailUrl: text('thumbnail_url'),
    checksum: text('checksum'), // SHA-256 hash for deduplication
    metadata: text('metadata').default('{}'),
    createdAt: text('created_at').notNull().default("datetime('now')"),
  },
  (table) => ({
    userIdIdx: index('idx_files_user_id').on(table.userId),
    checksumIdx: index('idx_files_checksum').on(table.checksum),
    createdAtIdx: index('idx_files_created_at').on(table.createdAt),
  })
);

export const filesRelations = relations(files, ({ one }) => ({
  user: one(users, {
    fields: [files.userId],
    references: [users.id],
  }),
}));

// File types
export type FileRecord = typeof files.$inferSelect;
export type NewFileRecord = typeof files.$inferInsert;

// ============================================================================
// SECTION FAILURE TRACKING
// ============================================================================

/**
 * Section failures - Track failures by briefing section type for pattern analysis
 * Enables answering "Is there any pattern in which sections fail?"
 */
export const sectionFailures = sqliteTable(
  'section_failures',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    briefingId: text('briefing_id'),

    // Section identification
    sectionType: text('section_type').notNull(), // 'calendar' | 'email' | 'tasks' | 'health' | 'weather' | 'summary'
    integrationId: text('integration_id'), // Which integration failed

    // Failure details
    failureType: text('failure_type').notNull(), // 'timeout' | 'auth' | 'rate_limit' | 'parse_error' | 'empty_response' | 'unknown'
    errorMessage: text('error_message'),
    errorCode: text('error_code'),

    // Context
    retryCount: integer('retry_count').notNull().default(0),
    wasRecovered: integer('was_recovered', { mode: 'boolean' }).default(false),

    // Timing
    occurredAt: text('occurred_at').notNull(),
    dayOfWeek: integer('day_of_week').notNull(), // 0-6 (Sunday-Saturday)
    hourOfDay: integer('hour_of_day').notNull(), // 0-23

    createdAt: text('created_at').notNull().default("datetime('now')"),
  },
  (table) => ({
    userIdIdx: index('idx_section_failures_user_id').on(table.userId),
    sectionTypeIdx: index('idx_section_failures_section_type').on(table.sectionType),
    failureTypeIdx: index('idx_section_failures_failure_type').on(table.failureType),
    occurredAtIdx: index('idx_section_failures_occurred_at').on(table.occurredAt),
    dayHourIdx: index('idx_section_failures_day_hour').on(table.dayOfWeek, table.hourOfDay),
  })
);

export const sectionFailuresRelations = relations(sectionFailures, ({ one }) => ({
  user: one(users, {
    fields: [sectionFailures.userId],
    references: [users.id],
  }),
}));

// Section failure types
export type SectionFailure = typeof sectionFailures.$inferSelect;
export type NewSectionFailure = typeof sectionFailures.$inferInsert;
