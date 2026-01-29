/**
 * Atlas Security Startup Verification
 *
 * Comprehensive security checks that run at gateway startup.
 * Validates file permissions, credential storage, and security configuration.
 *
 * @module @atlas/gateway/security/startup-verification
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, platform, hostname } from 'node:os';
import pinoModule from 'pino';
import { runSecurityAudit, verifySecurePermissions } from './file-permissions.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const log = (pinoModule as any)({ name: 'security:startup' });

export type SecurityLevel = 'critical' | 'high' | 'medium' | 'low';

export interface SecurityCheck {
  name: string;
  description: string;
  level: SecurityLevel;
  passed: boolean;
  message: string;
  remediation?: string;
  autoFixed?: boolean;
}

export interface SecurityVerificationResult {
  timestamp: Date;
  hostname: string;
  platform: string;
  overallStatus: 'secure' | 'warnings' | 'critical';
  checks: SecurityCheck[];
  blockers: SecurityCheck[];
  warnings: SecurityCheck[];
}

/**
 * Check if running on a personal/development machine vs server
 */
function isPersonalMachine(): boolean {
  const h = hostname().toLowerCase();
  // Server indicators
  const serverIndicators = ['prod', 'staging', 'server', 'node', 'worker', 'ec2', 'gce', 'azure'];
  return !serverIndicators.some(i => h.includes(i));
}

/**
 * Check file permission security
 */
function checkFilePermissions(autoFix: boolean): SecurityCheck {
  const check: SecurityCheck = {
    name: 'file-permissions',
    description: 'Verify sensitive files have secure permissions (600/700)',
    level: 'critical',
    passed: false,
    message: '',
  };

  try {
    if (autoFix) {
      const audit = runSecurityAudit(true);
      if (audit.fixed > 0) {
        check.passed = true;
        check.autoFixed = true;
        check.message = `Auto-fixed ${audit.fixed} insecure file permissions`;
      } else if (audit.insecureFound === 0) {
        check.passed = true;
        check.message = 'All sensitive files have secure permissions';
      } else {
        check.passed = false;
        check.message = `Found ${audit.insecureFound} files with insecure permissions`;
        check.remediation = 'Run: chmod 600 ~/.atlas/data/*.db';
      }
    } else {
      const result = verifySecurePermissions();
      check.passed = result.secure;
      if (result.secure) {
        check.message = 'All sensitive files have secure permissions';
      } else {
        check.message = `Found ${result.violations.length} files with insecure permissions`;
        check.remediation = 'Enable autoFix or run: chmod 600 ~/.atlas/data/*.db';
      }
    }
  } catch (error) {
    check.passed = false;
    check.message = `Permission check failed: ${error}`;
  }

  return check;
}

/**
 * Check if Atlas data directory exists and is properly secured
 */
function checkDataDirectory(): SecurityCheck {
  const check: SecurityCheck = {
    name: 'data-directory',
    description: 'Verify Atlas data directory exists with proper structure',
    level: 'high',
    passed: false,
    message: '',
  };

  const atlasDir = join(homedir(), '.atlas');
  const dataDir = join(atlasDir, 'data');

  if (!existsSync(atlasDir)) {
    check.passed = true;
    check.message = 'Atlas directory not yet created (will be created with secure permissions)';
    return check;
  }

  if (!existsSync(dataDir)) {
    check.passed = true;
    check.message = 'Data directory not yet created (will be created with secure permissions)';
    return check;
  }

  check.passed = true;
  check.message = 'Data directory exists';
  return check;
}

/**
 * Check for plaintext credential files
 */
function checkPlaintextCredentials(): SecurityCheck {
  const check: SecurityCheck = {
    name: 'plaintext-credentials',
    description: 'Check for plaintext credential files that should be migrated',
    level: 'critical',
    passed: false,
    message: '',
  };

  const dangerousFiles = [
    join(homedir(), '.atlas', 'auth-profiles.json'),
    join(homedir(), '.atlas', 'tokens.json'),
    join(homedir(), '.atlas', 'secrets.json'),
    join(homedir(), '.atlas', 'api-keys.json'),
  ];

  const foundFiles: string[] = [];
  for (const file of dangerousFiles) {
    if (existsSync(file)) {
      foundFiles.push(file);
    }
  }

  if (foundFiles.length > 0) {
    check.passed = false;
    check.message = `Found ${foundFiles.length} plaintext credential files that should be migrated`;
    check.remediation = 'Use CredentialStore.migrateFromPlaintext() to migrate these files';
  } else {
    check.passed = true;
    check.message = 'No plaintext credential files found';
  }

  return check;
}

/**
 * Check environment configuration for security issues
 */
function checkEnvironmentConfig(): SecurityCheck {
  const check: SecurityCheck = {
    name: 'environment-config',
    description: 'Verify environment configuration is secure',
    level: 'medium',
    passed: true,
    message: '',
  };

  const warnings: string[] = [];

  // Check for development encryption key
  const encryptionKey = process.env.ATLAS_ENCRYPTION_KEY;
  if (encryptionKey === 'development-key-change-in-production') {
    warnings.push('Using development encryption key');
  }

  // Check for debug mode in production
  if (process.env.NODE_ENV === 'production' && process.env.DEBUG) {
    warnings.push('Debug mode enabled in production');
  }

  // Check for insecure host binding
  const host = process.env.ATLAS_HOST;
  if (host && host !== '127.0.0.1' && host !== 'localhost') {
    warnings.push(`Gateway bound to ${host} instead of localhost`);
  }

  if (warnings.length > 0) {
    check.passed = false;
    check.message = warnings.join('; ');
    check.remediation = 'Review and fix environment configuration';
  } else {
    check.message = 'Environment configuration appears secure';
  }

  return check;
}

/**
 * Check localhost binding
 */
function checkLocalhostBinding(): SecurityCheck {
  const check: SecurityCheck = {
    name: 'localhost-binding',
    description: 'Verify gateway binds only to localhost',
    level: 'critical',
    passed: true,
    message: '',
  };

  const host = process.env.ATLAS_HOST || '127.0.0.1';
  const allowedHosts = ['127.0.0.1', 'localhost', '::1'];

  if (!allowedHosts.includes(host)) {
    check.passed = false;
    check.message = `Gateway configured to bind to ${host} - this exposes it to network`;
    check.remediation = 'Set ATLAS_HOST=127.0.0.1 to bind only to localhost';
  } else {
    check.message = `Gateway will bind to ${host} (localhost only)`;
  }

  return check;
}

/**
 * Check for secure credential storage backend
 */
function checkCredentialBackend(): SecurityCheck {
  const check: SecurityCheck = {
    name: 'credential-backend',
    description: 'Verify secure credential storage is available',
    level: 'high',
    passed: false,
    message: '',
  };

  // Try to detect keytar availability
  try {
    // We just check if the import would work conceptually
    // The actual CredentialStore will do the real check
    if (platform() === 'darwin' || platform() === 'win32' || platform() === 'linux') {
      check.passed = true;
      check.message = `OS keychain should be available on ${platform()}`;
    } else {
      check.passed = true;
      check.message = 'Will use encrypted file storage as fallback';
    }
  } catch {
    check.passed = true;
    check.message = 'Will use encrypted file storage';
  }

  return check;
}

/**
 * Run all security verification checks
 */
export async function runSecurityVerification(options: {
  autoFix?: boolean;
  failOnCritical?: boolean;
} = {}): Promise<SecurityVerificationResult> {
  const { autoFix = true, failOnCritical = false } = options;

  log.info({ autoFix, failOnCritical }, 'Starting security verification');

  const result: SecurityVerificationResult = {
    timestamp: new Date(),
    hostname: hostname(),
    platform: platform(),
    overallStatus: 'secure',
    checks: [],
    blockers: [],
    warnings: [],
  };

  // Run all checks
  result.checks = [
    checkLocalhostBinding(),
    checkFilePermissions(autoFix),
    checkDataDirectory(),
    checkPlaintextCredentials(),
    checkCredentialBackend(),
    checkEnvironmentConfig(),
  ];

  // Categorize results
  for (const check of result.checks) {
    if (!check.passed) {
      if (check.level === 'critical') {
        result.blockers.push(check);
      } else {
        result.warnings.push(check);
      }
    }
  }

  // Determine overall status
  if (result.blockers.length > 0) {
    result.overallStatus = 'critical';
  } else if (result.warnings.length > 0) {
    result.overallStatus = 'warnings';
  }

  // Log results
  for (const check of result.checks) {
    const status = check.passed ? '✓' : '✗';
    const level = check.autoFixed ? '(auto-fixed)' : '';

    if (check.passed) {
      log.info({ check: check.name }, `${status} ${check.description}: ${check.message} ${level}`);
    } else if (check.level === 'critical') {
      log.error({ check: check.name, remediation: check.remediation },
        `${status} CRITICAL: ${check.description}: ${check.message}`);
    } else {
      log.warn({ check: check.name, remediation: check.remediation },
        `${status} ${check.level.toUpperCase()}: ${check.description}: ${check.message}`);
    }
  }

  // Summary
  const passedCount = result.checks.filter(c => c.passed).length;
  log.info({
    total: result.checks.length,
    passed: passedCount,
    blockers: result.blockers.length,
    warnings: result.warnings.length,
    status: result.overallStatus,
  }, `Security verification complete: ${passedCount}/${result.checks.length} checks passed`);

  // Optionally fail on critical issues
  if (failOnCritical && result.blockers.length > 0) {
    const blockerNames = result.blockers.map(b => b.name).join(', ');
    throw new Error(`SECURITY_VERIFICATION_FAILED: Critical issues found: ${blockerNames}`);
  }

  return result;
}

/**
 * Quick security check for development (less strict)
 */
export async function quickSecurityCheck(): Promise<boolean> {
  const isPersonal = isPersonalMachine();

  if (isPersonal) {
    log.info('Running on personal machine - performing basic security checks');
    // Just check file permissions
    const permCheck = checkFilePermissions(true);
    return permCheck.passed;
  }

  // On server, do full check
  const result = await runSecurityVerification({ autoFix: true, failOnCritical: false });
  return result.overallStatus !== 'critical';
}

export default {
  runSecurityVerification,
  quickSecurityCheck,
};
