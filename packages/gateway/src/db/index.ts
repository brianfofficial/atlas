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

/**
 * Initialize the database connection and run migrations
 */
export async function initializeDatabase(): Promise<void> {
  if (db) {
    log.info('Database already initialized');
    return;
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
