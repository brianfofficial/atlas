/**
 * Atlas - Skill Types
 *
 * Type definitions for the skill verification system.
 */

/**
 * Skill permission types
 */
export type SkillPermission =
  | 'filesystem:read'
  | 'filesystem:write'
  | 'network:fetch'
  | 'network:listen'
  | 'shell:execute'
  | 'credentials:read'
  | 'system:info'

/**
 * Risk level for skills
 */
export type SkillRiskLevel = 'low' | 'medium' | 'high' | 'critical'

/**
 * Skill manifest - required for all third-party skills
 */
export interface SkillManifest {
  /** Unique skill identifier */
  id: string

  /** Skill display name */
  name: string

  /** Skill version (semver) */
  version: string

  /** Skill description */
  description: string

  /** Author information */
  author: {
    name: string
    email?: string
    url?: string
  }

  /** Repository URL */
  repository?: string

  /** License identifier (SPDX) */
  license: string

  /** Minimum Atlas version required */
  atlasVersion: string

  /** Required permissions */
  permissions: SkillPermissions

  /** Entry point file */
  main: string

  /** Optional dependencies (other skills) */
  dependencies?: Record<string, string>

  /** Security metadata */
  security?: SkillSecurityMetadata
}

/**
 * Detailed permission declarations
 */
export interface SkillPermissions {
  /** File paths the skill can read */
  filesystemRead?: string[]

  /** File paths the skill can write */
  filesystemWrite?: string[]

  /** Network hosts the skill can connect to */
  networkHosts?: string[]

  /** Network ports the skill can listen on */
  networkPorts?: number[]

  /** Shell commands the skill can execute */
  shellCommands?: string[]

  /** Credential services the skill needs access to */
  credentialServices?: string[]

  /** Additional custom permissions */
  custom?: Record<string, unknown>
}

/**
 * Security metadata for skills
 */
export interface SkillSecurityMetadata {
  /** SHA-256 hash of the skill code */
  codeHash: string

  /** Ed25519 signature of the manifest + code hash */
  signature?: string

  /** Public key used for signing */
  publicKey?: string

  /** Timestamp of last security audit */
  lastAudit?: string

  /** Known CVEs affecting this skill */
  knownVulnerabilities?: string[]
}

/**
 * Result of skill verification
 */
export interface SkillVerificationResult {
  /** Whether the skill passed verification */
  isValid: boolean

  /** Overall risk level */
  riskLevel: SkillRiskLevel

  /** List of issues found */
  issues: SkillIssue[]

  /** List of warnings */
  warnings: string[]

  /** Verification timestamp */
  verifiedAt: Date

  /** Hash of verified content */
  contentHash: string
}

/**
 * Issue found during verification
 */
export interface SkillIssue {
  /** Issue severity */
  severity: 'error' | 'warning' | 'info'

  /** Issue code */
  code: string

  /** Human-readable message */
  message: string

  /** Location in code (if applicable) */
  location?: {
    file: string
    line?: number
    column?: number
  }

  /** Suggested fix */
  suggestion?: string
}

/**
 * Registered skill in the local registry
 */
export interface RegisteredSkill {
  /** Skill manifest */
  manifest: SkillManifest

  /** Local installation path */
  installPath: string

  /** Installation timestamp */
  installedAt: Date

  /** Last verification result */
  verification: SkillVerificationResult

  /** Whether the skill is enabled */
  enabled: boolean

  /** Usage statistics */
  stats: {
    totalInvocations: number
    lastInvoked?: Date
    failureCount: number
  }
}

/**
 * Vulnerability scan result
 */
export interface VulnerabilityScanResult {
  /** Total vulnerabilities found */
  totalVulnerabilities: number

  /** Vulnerabilities by severity */
  bySeverity: {
    critical: VulnerabilityInfo[]
    high: VulnerabilityInfo[]
    medium: VulnerabilityInfo[]
    low: VulnerabilityInfo[]
  }

  /** Scan timestamp */
  scannedAt: Date

  /** Whether scan completed successfully */
  success: boolean

  /** Error if scan failed */
  error?: string
}

/**
 * Vulnerability information
 */
export interface VulnerabilityInfo {
  /** CVE identifier */
  cve: string

  /** Affected package */
  package: string

  /** Affected version range */
  affectedVersions: string

  /** Severity score (CVSS) */
  severity: number

  /** Description */
  description: string

  /** Fix available */
  fixAvailable: boolean

  /** Fixed version */
  fixedIn?: string

  /** Reference URLs */
  references: string[]
}
