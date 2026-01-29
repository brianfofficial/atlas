/**
 * Atlas File Permission Security
 *
 * Validates and enforces secure file permissions on all sensitive data files.
 * Addresses: World-readable database files, credential exposure risks.
 *
 * @module @atlas/gateway/security/file-permissions
 */

import { statSync, chmodSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import pinoModule from 'pino';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const log = (pinoModule as any)({ name: 'security:file-permissions' });

// Secure permission constants
const SECURE_FILE_MODE = 0o600;  // Owner read/write only
const SECURE_DIR_MODE = 0o700;   // Owner read/write/execute only

// Sensitive file patterns that MUST have secure permissions
const SENSITIVE_FILE_PATTERNS = [
  /\.db$/,           // SQLite databases
  /\.db-wal$/,       // SQLite WAL files
  /\.db-shm$/,       // SQLite shared memory files
  /\.enc$/,          // Encrypted files
  /\.key$/,          // Key files
  /\.pem$/,          // Certificate/key files
  /\.json$/,         // JSON configs (may contain tokens)
  /credentials/i,    // Credential files
  /secret/i,         // Secret files
  /token/i,          // Token files
  /\.salt$/,         // Salt files
];

// Directories that contain sensitive data
const SENSITIVE_DIRECTORIES = [
  join(homedir(), '.atlas'),
  join(homedir(), '.atlas', 'data'),
  join(homedir(), '.atlas', 'credentials'),
  join(homedir(), '.atlas', 'keys'),
];

export interface PermissionCheckResult {
  path: string;
  type: 'file' | 'directory';
  currentMode: number;
  isSecure: boolean;
  fixed: boolean;
  error?: string;
}

export interface SecurityAuditResult {
  timestamp: Date;
  totalChecked: number;
  insecureFound: number;
  fixed: number;
  errors: number;
  results: PermissionCheckResult[];
}

/**
 * Check if a file has secure permissions (not world/group readable)
 */
function isSecureMode(mode: number, isDirectory: boolean): boolean {
  const relevantBits = mode & 0o777;
  const expectedMode = isDirectory ? SECURE_DIR_MODE : SECURE_FILE_MODE;

  // Check that group and other have no permissions
  return (relevantBits & 0o077) === 0;
}

/**
 * Check if a filename matches sensitive patterns
 */
function isSensitiveFile(filename: string): boolean {
  return SENSITIVE_FILE_PATTERNS.some(pattern => pattern.test(filename));
}

/**
 * Check and optionally fix permissions on a single path
 */
export function checkPermissions(
  filePath: string,
  autoFix: boolean = true
): PermissionCheckResult {
  const result: PermissionCheckResult = {
    path: filePath,
    type: 'file',
    currentMode: 0,
    isSecure: false,
    fixed: false,
  };

  try {
    if (!existsSync(filePath)) {
      result.error = 'Path does not exist';
      return result;
    }

    const stats = statSync(filePath);
    result.type = stats.isDirectory() ? 'directory' : 'file';
    result.currentMode = stats.mode & 0o777;
    result.isSecure = isSecureMode(stats.mode, stats.isDirectory());

    if (!result.isSecure) {
      log.warn({
        path: filePath,
        type: result.type,
        mode: result.currentMode.toString(8),
      }, 'SECURITY: Insecure permissions detected');

      if (autoFix) {
        const targetMode = stats.isDirectory() ? SECURE_DIR_MODE : SECURE_FILE_MODE;
        chmodSync(filePath, targetMode);
        result.fixed = true;
        log.info({
          path: filePath,
          oldMode: result.currentMode.toString(8),
          newMode: targetMode.toString(8),
        }, 'Fixed insecure permissions');
      }
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    log.error({ path: filePath, error: result.error }, 'Failed to check permissions');
  }

  return result;
}

/**
 * Recursively check and fix permissions in a directory
 */
export function secureDirectory(
  dirPath: string,
  autoFix: boolean = true
): PermissionCheckResult[] {
  const results: PermissionCheckResult[] = [];

  if (!existsSync(dirPath)) {
    return results;
  }

  // Check the directory itself
  results.push(checkPermissions(dirPath, autoFix));

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively secure subdirectories
        results.push(...secureDirectory(fullPath, autoFix));
      } else if (entry.isFile() && isSensitiveFile(entry.name)) {
        // Check sensitive files
        results.push(checkPermissions(fullPath, autoFix));
      }
    }
  } catch (error) {
    log.error({ dirPath, error }, 'Failed to read directory');
  }

  return results;
}

/**
 * Run a complete security audit on all Atlas data directories
 */
export function runSecurityAudit(autoFix: boolean = true): SecurityAuditResult {
  const result: SecurityAuditResult = {
    timestamp: new Date(),
    totalChecked: 0,
    insecureFound: 0,
    fixed: 0,
    errors: 0,
    results: [],
  };

  log.info({ autoFix }, 'Starting security audit of file permissions');

  for (const dir of SENSITIVE_DIRECTORIES) {
    if (existsSync(dir)) {
      const dirResults = secureDirectory(dir, autoFix);
      result.results.push(...dirResults);
    }
  }

  // Calculate summary statistics
  for (const check of result.results) {
    result.totalChecked++;
    if (!check.isSecure && !check.fixed) {
      result.insecureFound++;
    }
    if (check.fixed) {
      result.fixed++;
    }
    if (check.error) {
      result.errors++;
    }
  }

  log.info({
    totalChecked: result.totalChecked,
    insecureFound: result.insecureFound,
    fixed: result.fixed,
    errors: result.errors,
  }, 'Security audit complete');

  return result;
}

/**
 * Verify that all sensitive files have secure permissions (non-fixing check)
 */
export function verifySecurePermissions(): {
  secure: boolean;
  violations: PermissionCheckResult[];
} {
  const audit = runSecurityAudit(false);
  const violations = audit.results.filter(r => !r.isSecure && !r.error);

  return {
    secure: violations.length === 0,
    violations,
  };
}

/**
 * Create a directory with secure permissions
 */
export function createSecureDirectory(dirPath: string): void {
  if (!existsSync(dirPath)) {
    const { mkdirSync } = require('fs');
    mkdirSync(dirPath, { recursive: true, mode: SECURE_DIR_MODE });
    log.info({ path: dirPath, mode: SECURE_DIR_MODE.toString(8) }, 'Created secure directory');
  } else {
    checkPermissions(dirPath, true);
  }
}

/**
 * Write a file with secure permissions
 */
export function writeSecureFile(filePath: string, content: string | Buffer): void {
  const { writeFileSync, mkdirSync, dirname } = require('fs');
  const { dirname: pathDirname } = require('path');

  const dir = pathDirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: SECURE_DIR_MODE });
  }

  writeFileSync(filePath, content, { mode: SECURE_FILE_MODE });
  log.debug({ path: filePath, mode: SECURE_FILE_MODE.toString(8) }, 'Wrote secure file');
}

export default {
  checkPermissions,
  secureDirectory,
  runSecurityAudit,
  verifySecurePermissions,
  createSecureDirectory,
  writeSecureFile,
  SECURE_FILE_MODE,
  SECURE_DIR_MODE,
};
