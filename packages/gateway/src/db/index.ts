/**
 * Database Connection
 *
 * SQLite database with Drizzle ORM.
 * Used for persistent storage of users, sessions, audit logs, etc.
 *
 * @module @atlas/gateway/db
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { existsSync, mkdirSync, chmodSync, statSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import pinoModule from 'pino';
import * as schema from './schema.js';

// Secure file permissions (owner read/write only)
const SECURE_FILE_MODE = 0o600;
const SECURE_DIR_MODE = 0o700;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const log = (pinoModule as any)({ name: 'database' });

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database path - use ~/.atlas/data for persistence
const DB_DIR = process.env.ATLAS_DB_DIR || join(homedir(), '.atlas', 'data');
const DB_PATH = process.env.ATLAS_DB_PATH || join(DB_DIR, 'atlas.db');
const MIGRATIONS_PATH = join(__dirname, 'migrations');

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sqlite: Database.Database | null = null;

/**
 * Get the database connection
 */
export function getDatabase(): ReturnType<typeof drizzle<typeof schema>> {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Get the raw SQLite connection (for advanced operations)
 */
export function getSQLite(): Database.Database {
  if (!sqlite) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return sqlite;
}

// Export database type for use in other modules
export type Database = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Initialize the database connection and run migrations
 */
export async function initializeDatabase(): Promise<Database> {
  if (db) {
    log.info('Database already initialized');
    return db;
  }

  // Ensure database directory exists with secure permissions
  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true, mode: SECURE_DIR_MODE });
    log.info({ dir: DB_DIR }, 'Created database directory with secure permissions (700)');
  } else {
    // Verify and fix directory permissions
    enforceDirPermissions(DB_DIR);
  }

  // Track if this is a new database
  const isNewDatabase = !existsSync(DB_PATH);

  // Create SQLite connection
  sqlite = new Database(DB_PATH);

  // If new database, set secure file permissions
  if (isNewDatabase) {
    chmodSync(DB_PATH, SECURE_FILE_MODE);
    log.info({ path: DB_PATH }, 'Set secure permissions (600) on new database');
  } else {
    // Verify existing database permissions
    enforceFilePermissions(DB_PATH);
  }

  // Enable WAL mode for better concurrent performance
  sqlite.pragma('journal_mode = WAL');

  // Enable foreign keys
  sqlite.pragma('foreign_keys = ON');

  // Create Drizzle instance
  db = drizzle(sqlite, { schema });

  log.info({ path: DB_PATH }, 'Database connection established');

  // Run migrations (create tables if they don't exist)
  await runMigrations();

  return db;
}

/**
 * Run database migrations
 */
async function runMigrations(): Promise<void> {
  if (!sqlite || !db) {
    throw new Error('Database not initialized');
  }

  log.info('Running database migrations...');

  // Check if tables exist by trying to query them
  const tableCheck = sqlite.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='users'
  `);
  const tablesExist = tableCheck.get();

  if (!tablesExist) {
    // Create initial schema
    log.info('Creating initial database schema...');
    createInitialSchema();
  }

  log.info('Database migrations complete');
}

/**
 * Create the initial database schema
 */
function createInitialSchema(): void {
  if (!sqlite) {
    throw new Error('SQLite connection not available');
  }

  // Users table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      mfa_secret TEXT NOT NULL,
      mfa_enabled INTEGER NOT NULL DEFAULT 0,
      backup_codes TEXT NOT NULL DEFAULT '[]',
      mfa_token TEXT,
      mfa_token_expires_at TEXT,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_mfa_token ON users(mfa_token);
  `);

  // Sessions table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_device_id ON sessions(device_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
  `);

  // Credentials table (metadata only - values in keychain/encrypted file)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS credentials (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL UNIQUE,
      service TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      last_rotated TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_credentials_name ON credentials(name);
    CREATE INDEX IF NOT EXISTS idx_credentials_service ON credentials(service);
  `);

  // Audit logs table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      user_id TEXT,
      session_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      metadata TEXT DEFAULT '{}',
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_logs_type ON audit_logs(type);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
  `);

  // Preferences table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS preferences (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      theme TEXT DEFAULT 'system',
      notifications TEXT DEFAULT '{}',
      privacy TEXT DEFAULT '{}',
      ai TEXT DEFAULT '{}',
      security TEXT DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_preferences_user_id ON preferences(user_id);
  `);

  // Goals table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      priority TEXT NOT NULL,
      due_date TEXT,
      progress INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
  `);

  // Memory entries table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS memory_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      summary TEXT,
      importance TEXT NOT NULL,
      source TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      tags TEXT DEFAULT '[]',
      access_count INTEGER NOT NULL DEFAULT 0,
      last_accessed_at TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_memory_entries_user_id ON memory_entries(user_id);
    CREATE INDEX IF NOT EXISTS idx_memory_entries_type ON memory_entries(type);
    CREATE INDEX IF NOT EXISTS idx_memory_entries_importance ON memory_entries(importance);
  `);

  // Cost tracking table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS cost_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      model_id TEXT NOT NULL,
      tokens_input INTEGER NOT NULL,
      tokens_output INTEGER NOT NULL,
      cost REAL NOT NULL,
      request_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cost_entries_user_id ON cost_entries(user_id);
    CREATE INDEX IF NOT EXISTS idx_cost_entries_model_id ON cost_entries(model_id);
    CREATE INDEX IF NOT EXISTS idx_cost_entries_created_at ON cost_entries(created_at);
  `);

  // ============================================================================
  // BRIEFING SYSTEM TABLES (Product Validation Framework)
  // ============================================================================

  // Briefing drafts table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS briefing_drafts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      generated_at TEXT NOT NULL DEFAULT (datetime('now')),
      approval_deadline TEXT,
      content TEXT NOT NULL,
      draft_items TEXT NOT NULL DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'scheduled',
      notification_sent_at TEXT,
      viewed_at TEXT,
      resolved_at TEXT,
      user_action TEXT,
      edited_content TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_briefing_drafts_user_id ON briefing_drafts(user_id);
    CREATE INDEX IF NOT EXISTS idx_briefing_drafts_status ON briefing_drafts(status);
    CREATE INDEX IF NOT EXISTS idx_briefing_drafts_type ON briefing_drafts(type);
    CREATE INDEX IF NOT EXISTS idx_briefing_drafts_generated_at ON briefing_drafts(generated_at);
  `);

  // Draft items table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS draft_items (
      id TEXT PRIMARY KEY,
      briefing_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      surface TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      context TEXT,
      source_type TEXT,
      source_id TEXT,
      source_metadata TEXT DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',
      priority INTEGER NOT NULL DEFAULT 1,
      action_taken_at TEXT,
      edited_content TEXT,
      dismiss_reason TEXT,
      executed_at TEXT,
      undo_deadline TEXT,
      undone_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (briefing_id) REFERENCES briefing_drafts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_draft_items_briefing_id ON draft_items(briefing_id);
    CREATE INDEX IF NOT EXISTS idx_draft_items_user_id ON draft_items(user_id);
    CREATE INDEX IF NOT EXISTS idx_draft_items_status ON draft_items(status);
    CREATE INDEX IF NOT EXISTS idx_draft_items_surface ON draft_items(surface);
  `);

  // Briefing history table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS briefing_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      briefing_id TEXT,
      type TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      delivered_at TEXT,
      viewed_at TEXT,
      completed_at TEXT,
      content TEXT NOT NULL,
      total_items INTEGER NOT NULL DEFAULT 0,
      approved_items INTEGER NOT NULL DEFAULT 0,
      dismissed_items INTEGER NOT NULL DEFAULT 0,
      edited_items INTEGER NOT NULL DEFAULT 0,
      time_to_first_action INTEGER,
      total_engagement_time INTEGER,
      user_satisfaction INTEGER,
      missed_important INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_briefing_history_user_id ON briefing_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_briefing_history_type ON briefing_history(type);
    CREATE INDEX IF NOT EXISTS idx_briefing_history_generated_at ON briefing_history(generated_at);
  `);

  // Briefing metrics table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS briefing_metrics (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      metric_type TEXT NOT NULL,
      value REAL NOT NULL,
      numerator INTEGER,
      denominator INTEGER,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      period_type TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_briefing_metrics_user_id ON briefing_metrics(user_id);
    CREATE INDEX IF NOT EXISTS idx_briefing_metrics_type ON briefing_metrics(metric_type);
    CREATE INDEX IF NOT EXISTS idx_briefing_metrics_timestamp ON briefing_metrics(timestamp);
  `);

  // Briefing schedules table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS briefing_schedules (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      hour INTEGER NOT NULL DEFAULT 7,
      minute INTEGER NOT NULL DEFAULT 30,
      timezone TEXT NOT NULL DEFAULT 'America/New_York',
      day_of_week INTEGER,
      last_run_at TEXT,
      next_run_at TEXT,
      delivery_method TEXT NOT NULL DEFAULT 'push',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_briefing_schedules_user_id ON briefing_schedules(user_id);
    CREATE INDEX IF NOT EXISTS idx_briefing_schedules_enabled ON briefing_schedules(enabled);
    CREATE INDEX IF NOT EXISTS idx_briefing_schedules_next_run ON briefing_schedules(next_run_at);
  `);

  // User engagement table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS user_engagement (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      session_count INTEGER NOT NULL DEFAULT 0,
      unprompted_sessions INTEGER NOT NULL DEFAULT 0,
      notification_sessions INTEGER NOT NULL DEFAULT 0,
      briefings_viewed INTEGER NOT NULL DEFAULT 0,
      drafts_approved INTEGER NOT NULL DEFAULT 0,
      drafts_dismissed INTEGER NOT NULL DEFAULT 0,
      drafts_edited INTEGER NOT NULL DEFAULT 0,
      used_email_surface INTEGER DEFAULT 0,
      used_calendar_surface INTEGER DEFAULT 0,
      used_tasks_surface INTEGER DEFAULT 0,
      total_engagement_seconds INTEGER NOT NULL DEFAULT 0,
      first_action_at TEXT,
      last_action_at TEXT,
      days_since_signup INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_user_engagement_user_id ON user_engagement(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_engagement_date ON user_engagement(date);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_engagement_user_date ON user_engagement(user_id, date);
  `);

  // Trust failure events table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS trust_failure_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      draft_item_id TEXT,
      failure_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'medium',
      description TEXT,
      error_pattern TEXT,
      user_reported INTEGER DEFAULT 0,
      user_feedback TEXT,
      resolved INTEGER DEFAULT 0,
      resolution TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (draft_item_id) REFERENCES draft_items(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_trust_failure_user_id ON trust_failure_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_trust_failure_type ON trust_failure_events(failure_type);
    CREATE INDEX IF NOT EXISTS idx_trust_failure_timestamp ON trust_failure_events(timestamp);
  `);

  // Pinned memories table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS pinned_memories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      memory_entry_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      source_type TEXT,
      extracted_from TEXT,
      use_count INTEGER NOT NULL DEFAULT 0,
      last_used_at TEXT,
      valid_until TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (memory_entry_id) REFERENCES memory_entries(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pinned_memories_user_id ON pinned_memories(user_id);
    CREATE INDEX IF NOT EXISTS idx_pinned_memories_type ON pinned_memories(type);
  `);

  log.info('Initial database schema created');
}

/**
 * Enforce secure file permissions (600) on a file
 */
function enforceFilePermissions(filePath: string): void {
  try {
    const stats = statSync(filePath);
    const currentMode = stats.mode & 0o777;

    // Check if file is world or group readable/writable
    if (currentMode & 0o077) {
      log.warn(
        { path: filePath, currentMode: currentMode.toString(8) },
        'SECURITY: Database file has insecure permissions, fixing to 600'
      );
      chmodSync(filePath, SECURE_FILE_MODE);
      log.info({ path: filePath }, 'Fixed file permissions to 600');
    }
  } catch (error) {
    log.error({ path: filePath, error }, 'Failed to check/fix file permissions');
  }
}

/**
 * Enforce secure directory permissions (700) on a directory
 */
function enforceDirPermissions(dirPath: string): void {
  try {
    const stats = statSync(dirPath);
    const currentMode = stats.mode & 0o777;

    // Check if directory is world or group accessible
    if (currentMode & 0o077) {
      log.warn(
        { path: dirPath, currentMode: currentMode.toString(8) },
        'SECURITY: Data directory has insecure permissions, fixing to 700'
      );
      chmodSync(dirPath, SECURE_DIR_MODE);
      log.info({ path: dirPath }, 'Fixed directory permissions to 700');
    }
  } catch (error) {
    log.error({ path: dirPath, error }, 'Failed to check/fix directory permissions');
  }
}

/**
 * Secure all database files in the data directory
 * Called on startup to ensure WAL and SHM files are also protected
 */
export function secureAllDatabaseFiles(): void {
  if (!existsSync(DB_DIR)) return;

  try {
    const files = readdirSync(DB_DIR);
    for (const file of files) {
      const filePath = join(DB_DIR, file);
      const stats = statSync(filePath);

      if (stats.isFile()) {
        enforceFilePermissions(filePath);
      }
    }
    log.info({ dir: DB_DIR }, 'Verified secure permissions on all database files');
  } catch (error) {
    log.error({ dir: DB_DIR, error }, 'Failed to secure database files');
  }
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (sqlite) {
    sqlite.close();
    sqlite = null;
    db = null;
    log.info('Database connection closed');
  }
}

/**
 * Clear all data (for testing)
 */
export function clearDatabase(): void {
  if (!sqlite) {
    throw new Error('Database not initialized');
  }

  sqlite.exec(`
    DELETE FROM cost_entries;
    DELETE FROM memory_entries;
    DELETE FROM goals;
    DELETE FROM preferences;
    DELETE FROM audit_logs;
    DELETE FROM credentials;
    DELETE FROM sessions;
    DELETE FROM users;
  `);

  log.info('Database cleared');
}

// Export schema for use in repositories
export { schema };
