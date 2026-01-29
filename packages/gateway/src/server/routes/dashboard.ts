/**
 * Dashboard Routes
 *
 * Dashboard statistics and overview data endpoints.
 *
 * @module @atlas/gateway/server/routes/dashboard
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { ServerEnv } from '../index.js';
import { getCredentialStore } from '../../security/credential-store.js';
import { getDockerSandboxExecutor } from '../../sandbox/docker-executor.js';
import { getNetworkSecurityManager } from '../../security/network.js';
import { getSessionRepository } from '../../db/repositories/sessions.js';
import { getAuditService } from '../../audit/audit-service.js';

const dashboard = new Hono<ServerEnv>();

// Query schemas
const eventsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(10),
});

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics
 */
dashboard.get('/stats', async (c) => {
  // Get credential stats
  const credentialStore = getCredentialStore();
  await credentialStore.initialize();
  const credentials = await credentialStore.list();

  let needsRotationCount = 0;
  for (const cred of credentials) {
    if (await credentialStore.needsRotation(cred.id)) {
      needsRotationCount++;
    }
  }

  const credentialStats = {
    total: credentials.length,
    encrypted: credentials.length, // All are encrypted in Atlas
    needsRotation: needsRotationCount,
  };

  // Get session stats
  const sessionRepo = getSessionRepository();
  const sessionStats = await sessionRepo.getStats();

  // Get sandbox stats
  const sandbox = getDockerSandboxExecutor();
  const sandboxAvailable = await sandbox.isAvailable();
  const sandboxStats = {
    running: 0, // Would need container tracking
    completed: 0,
    failed: 0,
    available: sandboxAvailable,
  };

  // Calculate security score
  const securityScore = calculateSecurityScore({
    mfaEnabled: true, // Always true in Atlas
    sandboxAvailable,
    credentialsEncrypted: true,
    allCredentialsRotated: credentialStats.needsRotation === 0,
    sessionCount: sessionStats.active,
  });

  return c.json({
    credentials: credentialStats,
    sessions: sessionStats,
    sandbox: sandboxStats,
    security: {
      score: securityScore,
      issues: credentialStats.needsRotation + (sandboxAvailable ? 0 : 1),
    },
  });
});

/**
 * GET /api/dashboard/events
 * Get recent security events
 */
dashboard.get('/events', zValidator('query', eventsQuerySchema), async (c) => {
  const { limit } = c.req.valid('query');

  const auditService = getAuditService();
  const recentLogs = await auditService.query({
    limit,
    severity: ['warning', 'error', 'critical'],
  });

  // Transform to security events format
  const events = recentLogs.map((log) => ({
    id: log.id,
    type: mapSeverityToEventType(log.severity),
    title: formatEventTitle(log.type),
    description: log.message,
    timestamp: log.timestamp,
    category: log.type.split(':')[0],
    metadata: log.metadata,
  }));

  return c.json(events);
});

/**
 * GET /api/dashboard/posture
 * Get security posture assessment
 */
dashboard.get('/posture', async (c) => {
  const sandbox = getDockerSandboxExecutor();
  const sandboxAvailable = await sandbox.isAvailable();

  const networkManager = getNetworkSecurityManager();
  const networkSecure = !(await networkManager.detectPublicExposure());

  // Determine encryption type (keychain is preferred in CredentialStore)
  const encryptionType: 'AES-256-GCM' | 'keychain' = 'AES-256-GCM'; // Default fallback

  // Get input sanitizer pattern count
  // This would need to be imported from input-sanitizer
  const patternCount = 50; // Approximate - would be dynamic

  return c.json({
    mfaEnabled: true, // Always in Atlas
    dockerAvailable: sandboxAvailable,
    sandboxActive: sandboxAvailable,
    networkSecure,
    credentialEncryption: encryptionType,
    inputSanitization: true,
    patternCount,
  });
});

/**
 * Calculate security score based on various factors
 */
function calculateSecurityScore(factors: {
  mfaEnabled: boolean;
  sandboxAvailable: boolean;
  credentialsEncrypted: boolean;
  allCredentialsRotated: boolean;
  sessionCount: number;
}): number {
  let score = 0;

  // MFA enabled: 30 points
  if (factors.mfaEnabled) score += 30;

  // Sandbox available: 25 points
  if (factors.sandboxAvailable) score += 25;

  // Credentials encrypted: 20 points
  if (factors.credentialsEncrypted) score += 20;

  // All credentials rotated: 15 points
  if (factors.allCredentialsRotated) score += 15;

  // Low session count (less risk): 10 points
  if (factors.sessionCount <= 3) score += 10;
  else if (factors.sessionCount <= 5) score += 5;

  return score;
}

/**
 * Map audit severity to event type
 */
function mapSeverityToEventType(severity: string): 'success' | 'warning' | 'danger' | 'info' {
  switch (severity) {
    case 'critical':
    case 'error':
      return 'danger';
    case 'warning':
      return 'warning';
    default:
      return 'info';
  }
}

/**
 * Format event title from audit type
 */
function formatEventTitle(type: string): string {
  const titles: Record<string, string> = {
    'auth:login': 'Successful login',
    'auth:logout': 'User logged out',
    'auth:mfa_verify': 'MFA verified',
    'auth:failed_login': 'Failed login attempt',
    'approval:created': 'New approval request',
    'approval:approved': 'Request approved',
    'approval:denied': 'Request denied',
    'approval:expired': 'Request expired',
    'credential:created': 'Credential created',
    'credential:rotated': 'Credential rotated',
    'credential:deleted': 'Credential deleted',
    'security:injection_blocked': 'Injection attempt blocked',
    'security:exfiltration_blocked': 'Exfiltration attempt blocked',
    'network:request_blocked': 'Network request blocked',
  };

  return titles[type] || type.replace(/[_:]/g, ' ');
}

export default dashboard;
