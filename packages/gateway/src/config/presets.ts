/**
 * Atlas - Security Presets
 *
 * Pre-configured security levels for different use cases.
 * Designed to make security accessible to non-technical users.
 */

import type { AllowlistConfig } from '../sandbox/allowlist.js'
import type { NetworkConfig } from '../security/network.js'

/**
 * Security preset levels
 */
export type SecurityPreset = 'paranoid' | 'balanced' | 'permissive'

/**
 * Complete Atlas configuration
 */
export interface AtlasPresetConfig {
  security: SecurityPresetConfig
  network: NetworkConfig
  sandbox: SandboxPresetConfig
  allowlist: AllowlistConfig
  models: ModelPresetConfig
}

/**
 * Security-specific preset configuration
 */
export interface SecurityPresetConfig {
  requireMfa: boolean
  sessionTimeoutMinutes: number
  maxFailedLogins: number
  lockoutDurationMinutes: number
  credentialRotationDays: number
  auditLogRetentionDays: number
}

/**
 * Sandbox-specific preset configuration
 */
export interface SandboxPresetConfig {
  enabled: boolean
  memoryLimitMb: number
  cpuLimit: number
  timeoutSeconds: number
  networkAccess: boolean
  readOnlyFilesystem: boolean
}

/**
 * Model-specific preset configuration
 */
export interface ModelPresetConfig {
  preferLocal: boolean
  allowCloudModels: boolean
  dailyBudgetLimit: number
  requireApprovalAbove: number // Cost threshold for approval
}

/**
 * Preset descriptions for UI display
 */
export const PRESET_DESCRIPTIONS: Record<SecurityPreset, {
  name: string
  emoji: string
  tagline: string
  description: string
  bestFor: string[]
  tradeoffs: string[]
}> = {
  paranoid: {
    name: 'Paranoid',
    emoji: '🔒',
    tagline: 'Maximum security, local-only execution',
    description:
      'All commands require explicit approval. No network access. Local models only. ' +
      'Designed for handling sensitive data or high-security environments.',
    bestFor: [
      'Handling sensitive credentials',
      'Air-gapped environments',
      'Compliance requirements',
      'Maximum privacy',
    ],
    tradeoffs: [
      'Every command needs approval',
      'No cloud AI models (local only)',
      'Limited automation capabilities',
    ],
  },
  balanced: {
    name: 'Balanced',
    emoji: '⚖️',
    tagline: 'Security with usability',
    description:
      'Safe commands auto-approved, dangerous commands require approval. ' +
      'Docker sandbox enforced. Hybrid local/cloud models.',
    bestFor: [
      'Daily development work',
      'General automation tasks',
      'Teams with security policies',
      'Cost-conscious usage',
    ],
    tradeoffs: [
      'Some operations still need approval',
      'Must have Docker installed',
      'Moderate cost for complex tasks',
    ],
  },
  permissive: {
    name: 'Permissive',
    emoji: '🚀',
    tagline: 'Maximum productivity, thoughtful security',
    description:
      'Most commands auto-approved with audit logging. Network access allowed. ' +
      'Dangerous commands (rm, curl) still require approval.',
    bestFor: [
      'Rapid prototyping',
      'Trusted environments',
      'Power users',
      'Non-sensitive projects',
    ],
    tradeoffs: [
      'Higher security risk',
      'Potentially higher API costs',
      'Less oversight on operations',
    ],
  },
}

/**
 * Full preset configurations
 */
export const PRESETS: Record<SecurityPreset, AtlasPresetConfig> = {
  paranoid: {
    security: {
      requireMfa: true,
      sessionTimeoutMinutes: 15,
      maxFailedLogins: 3,
      lockoutDurationMinutes: 30,
      credentialRotationDays: 30,
      auditLogRetentionDays: 365,
    },
    network: {
      bindAddress: '127.0.0.1',
      port: 18789,
      allowedIPs: ['127.0.0.1'],
      blockedIPs: [],
      rateLimitPerMinute: 30,
      rateLimitWindowMs: 60000,
      requireTailscale: false,
      tlsEnabled: false,
    },
    sandbox: {
      enabled: true,
      memoryLimitMb: 256,
      cpuLimit: 0.25,
      timeoutSeconds: 15,
      networkAccess: false,
      readOnlyFilesystem: true,
    },
    allowlist: {
      defaultPolicy: 'deny',
      safeCommands: ['ls', 'cat', 'head', 'tail', 'wc', 'pwd', 'echo', 'date'],
      dangerousCommands: [],
      blockedCommands: [
        'rm', 'mv', 'cp', 'chmod', 'chown', 'curl', 'wget', 'ssh', 'scp',
        'rsync', 'tar', 'unzip', 'pip', 'npm', 'apt', 'git', 'sudo', 'su',
      ],
      allowedDirectories: [
        { path: '~/atlas-workspace', permissions: ['read'], recursive: true },
      ],
      blockedPatterns: ['.env*', '*credentials*', '*secret*', '*.pem', '*.key'],
    },
    models: {
      preferLocal: true,
      allowCloudModels: false,
      dailyBudgetLimit: 0,
      requireApprovalAbove: 0,
    },
  },

  balanced: {
    security: {
      requireMfa: true,
      sessionTimeoutMinutes: 60,
      maxFailedLogins: 5,
      lockoutDurationMinutes: 15,
      credentialRotationDays: 90,
      auditLogRetentionDays: 90,
    },
    network: {
      bindAddress: '127.0.0.1',
      port: 18789,
      allowedIPs: ['127.0.0.1', '192.168.0.0/16', '10.0.0.0/8'],
      blockedIPs: [],
      rateLimitPerMinute: 100,
      rateLimitWindowMs: 60000,
      requireTailscale: false,
      tlsEnabled: false,
    },
    sandbox: {
      enabled: true,
      memoryLimitMb: 512,
      cpuLimit: 0.5,
      timeoutSeconds: 30,
      networkAccess: false,
      readOnlyFilesystem: true,
    },
    allowlist: {
      defaultPolicy: 'deny',
      safeCommands: [
        'ls', 'cat', 'head', 'tail', 'grep', 'find', 'wc', 'pwd', 'echo',
        'date', 'whoami', 'basename', 'dirname', 'sort', 'uniq', 'diff',
        'git status', 'git log', 'git diff', 'git branch',
      ],
      dangerousCommands: [
        'rm', 'mv', 'cp', 'chmod', 'curl', 'wget', 'git commit', 'git push',
      ],
      blockedCommands: [
        'sudo', 'su', 'passwd', 'mount', 'umount', 'dd', 'kill', 'shutdown',
        'reboot', 'systemctl', 'crontab', 'nc', 'eval', 'exec',
      ],
      allowedDirectories: [
        { path: '~/atlas-workspace', permissions: ['read', 'write', 'execute'], recursive: true },
        { path: '/tmp', permissions: ['read', 'write'], recursive: false },
      ],
      blockedPatterns: ['.env*', '*credentials*', '*secret*', '*.pem', '*.key', '.ssh/*', '.aws/*'],
    },
    models: {
      preferLocal: true,
      allowCloudModels: true,
      dailyBudgetLimit: 10,
      requireApprovalAbove: 1,
    },
  },

  permissive: {
    security: {
      requireMfa: true, // Still require MFA even in permissive mode
      sessionTimeoutMinutes: 480, // 8 hours
      maxFailedLogins: 10,
      lockoutDurationMinutes: 5,
      credentialRotationDays: 180,
      auditLogRetentionDays: 30,
    },
    network: {
      bindAddress: '127.0.0.1',
      port: 18789,
      allowedIPs: ['127.0.0.1', '192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12'],
      blockedIPs: [],
      rateLimitPerMinute: 200,
      rateLimitWindowMs: 60000,
      requireTailscale: false,
      tlsEnabled: false,
    },
    sandbox: {
      enabled: true, // Still require sandbox
      memoryLimitMb: 1024,
      cpuLimit: 1.0,
      timeoutSeconds: 60,
      networkAccess: true,
      readOnlyFilesystem: false,
    },
    allowlist: {
      defaultPolicy: 'allow-safe',
      safeCommands: [
        'ls', 'cat', 'head', 'tail', 'grep', 'find', 'wc', 'pwd', 'echo',
        'date', 'whoami', 'basename', 'dirname', 'sort', 'uniq', 'diff',
        'git', 'npm', 'node', 'python', 'pip', 'curl', 'wget',
        'mv', 'cp', 'mkdir', 'touch',
      ],
      dangerousCommands: ['rm', 'chmod', 'chown', 'ssh', 'scp'],
      blockedCommands: [
        'sudo', 'su', 'passwd', 'mount', 'umount', 'dd', 'shutdown',
        'reboot', 'systemctl', 'crontab', 'nc', 'eval',
      ],
      allowedDirectories: [
        { path: '~/atlas-workspace', permissions: ['read', 'write', 'execute'], recursive: true },
        { path: '~', permissions: ['read'], recursive: true },
        { path: '/tmp', permissions: ['read', 'write', 'execute'], recursive: true },
      ],
      blockedPatterns: ['.env*', '*credentials*', '*.pem', '*.key', '.ssh/*', '.aws/*', '.kube/*'],
    },
    models: {
      preferLocal: false,
      allowCloudModels: true,
      dailyBudgetLimit: 50,
      requireApprovalAbove: 5,
    },
  },
}

/**
 * Get a preset configuration by name
 */
export function getPreset(name: SecurityPreset): AtlasPresetConfig {
  return PRESETS[name]
}

/**
 * Get preset description for UI display
 */
export function getPresetDescription(name: SecurityPreset) {
  return PRESET_DESCRIPTIONS[name]
}

/**
 * Validate that a preset name is valid
 */
export function isValidPreset(name: string): name is SecurityPreset {
  return name === 'paranoid' || name === 'balanced' || name === 'permissive'
}

/**
 * Get all preset names
 */
export function getPresetNames(): SecurityPreset[] {
  return ['paranoid', 'balanced', 'permissive']
}
