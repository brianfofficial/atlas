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
