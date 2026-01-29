/**
 * Atlas Gateway
 *
 * Security-hardened AI assistant execution engine.
 * Secure Moltbot Fork - P0 Security Foundation
 *
 * Key Security Features:
 * - Encrypted credential storage (keytar + AES-256-GCM fallback)
 * - Mandatory MFA authentication (no bypass option)
 * - Zero-trust network architecture (no implicit localhost trust)
 * - Docker sandboxing by default (no sandbox = no execution)
 * - Command allowlisting (deny-by-default)
 * - Prompt injection defense (XML-tagged isolation)
 * - Output validation (credential exfiltration blocking)
 *
 * @module @atlas/gateway
 */

// Re-export all security components
export * from './security/index.js';

// Re-export sandbox components
export * from './sandbox/index.js';

// Re-export model layer (P1.2)
export * from './models/index.js';

// Re-export skills layer (P1.4)
export * from './skills/index.js';

// Re-export configuration presets (P1.3)
export * from './config/presets.js';

// Re-export workflows (P2)
export * from './workflows/approval-manager.js';

// Re-export database (P3.2)
export { initializeDatabase, closeDatabase, getDatabase } from './db/index.js';

// Re-export audit service (P3.4)
export { getAuditService } from './audit/audit-service.js';
export type { AuditEventType, AuditSeverity, AuditLogEntry } from './audit/audit-service.js';

// Re-export event broadcaster (P3.3)
export { getEventBroadcaster } from './events/event-broadcaster.js';
export type { EventType, BroadcastEvent } from './events/event-broadcaster.js';

// Re-export notifications (P3.5)
export { getNotificationService } from './notifications/index.js';
export type { NotificationPayload, NotificationType } from './notifications/index.js';

// Re-export server (P3.1)
export { createServer, startServer } from './server/index.js';

// Version information
export const VERSION = '0.1.0';
export const CODENAME = 'Atlas';

/**
 * Atlas Gateway Configuration
 */
export interface AtlasConfig {
  /** Security settings */
  security: {
    /** Use OS keychain for credential storage */
    useKeychain: boolean;
    /** Require MFA for all operations (always true in Atlas) */
    requireMFA: true;
    /** JWT token expiration in seconds */
    tokenExpiration: number;
  };

  /** Network settings */
  network: {
    /** Port to listen on */
    port: number;
    /** Bind address (127.0.0.1 for local-only) */
    bindAddress: string;
    /** Allowed IP addresses/ranges */
    allowedIPs: string[];
    /** Enable TLS */
    tlsEnabled: boolean;
  };

  /** Sandbox settings */
  sandbox: {
    /** Docker image for sandbox */
    image: string;
    /** Memory limit */
    memoryLimit: string;
    /** CPU limit */
    cpuLimit: string;
    /** Workspace directory */
    workspaceDir: string;
  };
}

/**
 * Default secure configuration
 */
export const DEFAULT_CONFIG: AtlasConfig = {
  security: {
    useKeychain: true,
    requireMFA: true,
    tokenExpiration: 15 * 60, // 15 minutes
  },
  network: {
    port: 18789,
    bindAddress: '127.0.0.1', // Local-only by default
    allowedIPs: [],
    tlsEnabled: false,
  },
  sandbox: {
    image: 'alpine:3.19',
    memoryLimit: '512m',
    cpuLimit: '0.5',
    workspaceDir: '~/atlas-workspace',
  },
};

/**
 * Quick security check - returns issues that need to be addressed
 */
export async function checkSecurityPosture(): Promise<string[]> {
  const issues: string[] = [];

  // Check Docker availability
  const { getDockerSandboxExecutor } = await import('./sandbox/docker-executor.js');
  const sandbox = getDockerSandboxExecutor();
  if (!(await sandbox.isAvailable())) {
    issues.push('CRITICAL: Docker is not available. Sandboxed execution will fail.');
  }

  // Check for public exposure
  const { getNetworkSecurityManager } = await import('./security/network.js');
  const network = getNetworkSecurityManager();
  if (await network.detectPublicExposure()) {
    issues.push('WARNING: Gateway may be publicly exposed. Check network configuration.');
  }

  return issues;
}
