/**
 * Human-in-the-Loop Approval Types
 *
 * Type definitions for the approval workflow system.
 */

/**
 * Categories of operations that may require approval
 */
export type ApprovalCategory =
  | 'file_write'
  | 'file_delete'
  | 'network_call'
  | 'credential_use'
  | 'dangerous_command'
  | 'external_api'
  | 'system_config'

/**
 * Risk levels for operations
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

/**
 * Status of an approval request
 */
export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'denied'
  | 'expired'
  | 'auto_approved'

/**
 * An approval request waiting for user decision
 */
export interface ApprovalRequest {
  /** Unique identifier for this request */
  id: string

  /** Category of the operation */
  category: ApprovalCategory

  /** Human-readable operation name */
  operation: string

  /** The actual command/action being requested */
  action: string

  /** Risk level assessment */
  riskLevel: RiskLevel

  /** Plain-language explanation of what will happen */
  context: string

  /** Technical details (expandable for advanced users) */
  technicalDetails?: string

  /** ID of the session/user making the request */
  sessionId: string

  /** Optional user ID */
  userId?: string

  /** When the request was created */
  createdAt: Date

  /** When the request expires */
  expiresAt: Date

  /** Current status */
  status: ApprovalStatus

  /** Metadata for additional context */
  metadata?: Record<string, unknown>
}

/**
 * User's decision on an approval request
 */
export interface ApprovalDecision {
  /** The approval request ID */
  requestId: string

  /** The decision made */
  status: 'approved' | 'denied'

  /** Whether to remember this decision for future similar requests */
  rememberDecision: boolean

  /** Optional scope for the remember decision */
  rememberScope?: 'exact' | 'similar' | 'category'

  /** Optional expiry for remembered decision */
  rememberExpiry?: Date

  /** Optional reason for the decision (especially for denials) */
  reason?: string

  /** When the decision was made */
  decidedAt: Date

  /** ID of the user who made the decision */
  decidedBy?: string
}

/**
 * A rule for auto-approving certain operations
 */
export interface AutoApproveRule {
  /** Unique identifier */
  id: string

  /** Human-readable name */
  name: string

  /** Description of what this rule covers */
  description: string

  /** Categories this rule applies to */
  categories: ApprovalCategory[]

  /** Pattern to match operations (regex or exact) */
  operationPattern: string

  /** Whether the pattern is a regex */
  isRegex: boolean

  /** Maximum risk level to auto-approve */
  maxRiskLevel: RiskLevel

  /** Whether this rule is currently active */
  enabled: boolean

  /** When this rule was created */
  createdAt: Date

  /** Who created this rule */
  createdBy?: string

  /** Number of times this rule has been applied */
  applyCount: number

  /** When this rule was last applied */
  lastApplied?: Date
}

/**
 * Audit trail entry for an approval
 */
export interface ApprovalAuditEntry {
  /** Unique identifier */
  id: string

  /** The approval request ID */
  requestId: string

  /** Action that occurred */
  action: 'created' | 'approved' | 'denied' | 'expired' | 'auto_approved'

  /** Timestamp */
  timestamp: Date

  /** User who performed the action (if applicable) */
  userId?: string

  /** Additional details */
  details?: Record<string, unknown>

  /** IP address if available */
  ipAddress?: string
}

/**
 * Statistics about the approval system
 */
export interface ApprovalStats {
  /** Total pending approvals */
  pending: number

  /** Approved in last 24 hours */
  approvedToday: number

  /** Denied in last 24 hours */
  deniedToday: number

  /** Auto-approved in last 24 hours */
  autoApprovedToday: number

  /** Expired in last 24 hours */
  expiredToday: number

  /** Average time to decision (ms) */
  averageDecisionTimeMs: number

  /** Most common categories */
  topCategories: { category: ApprovalCategory; count: number }[]
}

/**
 * Configuration for the approval system
 */
export interface ApprovalConfig {
  /** Default expiry time for requests (ms) */
  defaultExpiryMs: number

  /** Whether to allow auto-approve rules */
  allowAutoApprove: boolean

  /** Maximum pending approvals before blocking new requests */
  maxPendingApprovals: number

  /** Categories that always require approval (no auto-approve) */
  alwaysRequireApproval: ApprovalCategory[]

  /** Risk levels that always require approval */
  alwaysRequireApprovalRiskLevels: RiskLevel[]

  /** Whether to notify on new approvals */
  notifyOnNew: boolean

  /** Whether to notify on expiry */
  notifyOnExpiry: boolean
}

/**
 * Default configuration
 */
export const DEFAULT_APPROVAL_CONFIG: ApprovalConfig = {
  defaultExpiryMs: 5 * 60 * 1000, // 5 minutes
  allowAutoApprove: true,
  maxPendingApprovals: 100,
  alwaysRequireApproval: ['system_config', 'credential_use'],
  alwaysRequireApprovalRiskLevels: ['critical'],
  notifyOnNew: true,
  notifyOnExpiry: true,
}

/**
 * Risk level descriptions for UI display
 */
export const RISK_LEVEL_INFO: Record<RiskLevel, { label: string; description: string; color: string }> = {
  low: {
    label: 'Low Risk',
    description: 'This action is generally safe and reversible.',
    color: 'success',
  },
  medium: {
    label: 'Medium Risk',
    description: 'This action may have some impact. Review before approving.',
    color: 'warning',
  },
  high: {
    label: 'High Risk',
    description: 'This action could have significant consequences. Review carefully.',
    color: 'danger',
  },
  critical: {
    label: 'Critical Risk',
    description: 'This action is potentially dangerous and irreversible. Proceed with extreme caution.',
    color: 'danger',
  },
}

/**
 * Category descriptions for UI display
 */
export const CATEGORY_INFO: Record<ApprovalCategory, { label: string; description: string; icon: string }> = {
  file_write: {
    label: 'File Write',
    description: 'Creating or modifying files',
    icon: '📝',
  },
  file_delete: {
    label: 'File Delete',
    description: 'Permanently removing files',
    icon: '🗑️',
  },
  network_call: {
    label: 'Network Request',
    description: 'Connecting to external services',
    icon: '🌐',
  },
  credential_use: {
    label: 'Credential Use',
    description: 'Using stored passwords or API keys',
    icon: '🔑',
  },
  dangerous_command: {
    label: 'Dangerous Command',
    description: 'System commands that could cause harm',
    icon: '⚠️',
  },
  external_api: {
    label: 'External API',
    description: 'Calling third-party services',
    icon: '🔌',
  },
  system_config: {
    label: 'System Config',
    description: 'Changing Atlas settings',
    icon: '⚙️',
  },
}
