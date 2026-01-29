/**
 * Approval Queue
 *
 * In-memory queue for approval requests with persistence support.
 */

import { randomUUID } from 'crypto'
import {
  ApprovalRequest,
  ApprovalStatus,
  ApprovalCategory,
  RiskLevel,
  ApprovalAuditEntry,
  ApprovalStats,
  ApprovalConfig,
  DEFAULT_APPROVAL_CONFIG,
} from './approval-types.js'

/**
 * Approval Queue
 *
 * Manages pending approval requests with:
 * - In-memory storage for fast access
 * - Automatic expiry handling
 * - Audit trail generation
 * - Statistics tracking
 */
export class ApprovalQueue {
  private requests: Map<string, ApprovalRequest> = new Map()
  private auditTrail: ApprovalAuditEntry[] = []
  private config: ApprovalConfig
  private expiryCheckInterval: NodeJS.Timeout | null = null

  constructor(config?: Partial<ApprovalConfig>) {
    this.config = { ...DEFAULT_APPROVAL_CONFIG, ...config }
    this.startExpiryCheck()
  }

  /**
   * Create a new approval request
   */
  createRequest(params: {
    category: ApprovalCategory
    operation: string
    action: string
    riskLevel: RiskLevel
    context: string
    technicalDetails?: string
    sessionId: string
    userId?: string
    metadata?: Record<string, unknown>
    expiryMs?: number
  }): ApprovalRequest {
    // Check if we're at capacity
    if (this.getPendingCount() >= this.config.maxPendingApprovals) {
      throw new Error('Maximum pending approvals reached. Please resolve existing requests first.')
    }

    const now = new Date()
    const expiryMs = params.expiryMs ?? this.config.defaultExpiryMs

    const request: ApprovalRequest = {
      id: randomUUID(),
      category: params.category,
      operation: params.operation,
      action: params.action,
      riskLevel: params.riskLevel,
      context: params.context,
      technicalDetails: params.technicalDetails,
      sessionId: params.sessionId,
      userId: params.userId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + expiryMs),
      status: 'pending',
      metadata: params.metadata,
    }

    this.requests.set(request.id, request)

    // Add audit entry
    this.addAuditEntry({
      requestId: request.id,
      action: 'created',
      userId: params.userId,
      details: {
        category: params.category,
        riskLevel: params.riskLevel,
      },
    })

    return request
  }

  /**
   * Get a request by ID
   */
  getRequest(id: string): ApprovalRequest | undefined {
    return this.requests.get(id)
  }

  /**
   * Get all pending requests
   */
  getPendingRequests(): ApprovalRequest[] {
    return Array.from(this.requests.values())
      .filter((r) => r.status === 'pending')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  /**
   * Get pending requests for a specific session
   */
  getPendingForSession(sessionId: string): ApprovalRequest[] {
    return this.getPendingRequests().filter((r) => r.sessionId === sessionId)
  }

  /**
   * Get the count of pending requests
   */
  getPendingCount(): number {
    return Array.from(this.requests.values()).filter((r) => r.status === 'pending').length
  }

  /**
   * Approve a request
   */
  approve(
    requestId: string,
    options?: {
      userId?: string
      ipAddress?: string
    }
  ): ApprovalRequest | undefined {
    const request = this.requests.get(requestId)
    if (!request) return undefined

    if (request.status !== 'pending') {
      throw new Error(`Request ${requestId} is not pending (current status: ${request.status})`)
    }

    request.status = 'approved'
    this.requests.set(requestId, request)

    this.addAuditEntry({
      requestId,
      action: 'approved',
      userId: options?.userId,
      ipAddress: options?.ipAddress,
    })

    return request
  }

  /**
   * Deny a request
   */
  deny(
    requestId: string,
    options?: {
      reason?: string
      userId?: string
      ipAddress?: string
    }
  ): ApprovalRequest | undefined {
    const request = this.requests.get(requestId)
    if (!request) return undefined

    if (request.status !== 'pending') {
      throw new Error(`Request ${requestId} is not pending (current status: ${request.status})`)
    }

    request.status = 'denied'
    this.requests.set(requestId, request)

    this.addAuditEntry({
      requestId,
      action: 'denied',
      userId: options?.userId,
      ipAddress: options?.ipAddress,
      details: options?.reason ? { reason: options.reason } : undefined,
    })

    return request
  }

  /**
   * Mark a request as auto-approved
   */
  autoApprove(
    requestId: string,
    options?: {
      ruleId?: string
      ruleName?: string
    }
  ): ApprovalRequest | undefined {
    const request = this.requests.get(requestId)
    if (!request) return undefined

    if (request.status !== 'pending') {
      throw new Error(`Request ${requestId} is not pending (current status: ${request.status})`)
    }

    request.status = 'auto_approved'
    this.requests.set(requestId, request)

    this.addAuditEntry({
      requestId,
      action: 'auto_approved',
      details: options,
    })

    return request
  }

  /**
   * Get audit trail for a request
   */
  getAuditTrail(requestId: string): ApprovalAuditEntry[] {
    return this.auditTrail.filter((e) => e.requestId === requestId)
  }

  /**
   * Get full audit trail (for admin)
   */
  getFullAuditTrail(options?: {
    limit?: number
    offset?: number
    startDate?: Date
    endDate?: Date
  }): ApprovalAuditEntry[] {
    let entries = [...this.auditTrail]

    if (options?.startDate) {
      entries = entries.filter((e) => e.timestamp >= options.startDate!)
    }
    if (options?.endDate) {
      entries = entries.filter((e) => e.timestamp <= options.endDate!)
    }

    // Sort by timestamp descending
    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    if (options?.offset) {
      entries = entries.slice(options.offset)
    }
    if (options?.limit) {
      entries = entries.slice(0, options.limit)
    }

    return entries
  }

  /**
   * Get statistics about the approval system
   */
  getStats(): ApprovalStats {
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const allRequests = Array.from(this.requests.values())
    const recentRequests = allRequests.filter((r) => r.createdAt >= oneDayAgo)

    // Calculate average decision time for completed requests
    const completedWithDecision = allRequests.filter(
      (r) => r.status === 'approved' || r.status === 'denied'
    )
    const decisionTimes = completedWithDecision.map((r) => {
      const audit = this.auditTrail.find(
        (e) => e.requestId === r.id && (e.action === 'approved' || e.action === 'denied')
      )
      if (audit) {
        return audit.timestamp.getTime() - r.createdAt.getTime()
      }
      return 0
    }).filter((t) => t > 0)

    const averageDecisionTimeMs =
      decisionTimes.length > 0
        ? decisionTimes.reduce((a, b) => a + b, 0) / decisionTimes.length
        : 0

    // Count by category
    const categoryCount = new Map<ApprovalCategory, number>()
    for (const r of allRequests) {
      categoryCount.set(r.category, (categoryCount.get(r.category) ?? 0) + 1)
    }

    const topCategories = Array.from(categoryCount.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return {
      pending: this.getPendingCount(),
      approvedToday: recentRequests.filter((r) => r.status === 'approved').length,
      deniedToday: recentRequests.filter((r) => r.status === 'denied').length,
      autoApprovedToday: recentRequests.filter((r) => r.status === 'auto_approved').length,
      expiredToday: recentRequests.filter((r) => r.status === 'expired').length,
      averageDecisionTimeMs,
      topCategories,
    }
  }

  /**
   * Export queue state for persistence
   */
  export(): { requests: ApprovalRequest[]; auditTrail: ApprovalAuditEntry[] } {
    return {
      requests: Array.from(this.requests.values()),
      auditTrail: this.auditTrail,
    }
  }

  /**
   * Import queue state from persistence
   */
  import(data: { requests: ApprovalRequest[]; auditTrail: ApprovalAuditEntry[] }): void {
    // Clear existing
    this.requests.clear()
    this.auditTrail = []

    // Restore requests (rehydrate dates)
    for (const r of data.requests) {
      this.requests.set(r.id, {
        ...r,
        createdAt: new Date(r.createdAt),
        expiresAt: new Date(r.expiresAt),
      })
    }

    // Restore audit trail
    this.auditTrail = data.auditTrail.map((e) => ({
      ...e,
      timestamp: new Date(e.timestamp),
    }))
  }

  /**
   * Clean up expired requests and old audit entries
   */
  cleanup(options?: {
    maxAuditAge?: number // Max age in ms for audit entries
  }): { expiredRequests: number; deletedAuditEntries: number } {
    const now = new Date()
    let expiredCount = 0

    // Expire pending requests
    for (const [id, request] of this.requests) {
      if (request.status === 'pending' && request.expiresAt <= now) {
        request.status = 'expired'
        this.requests.set(id, request)

        this.addAuditEntry({
          requestId: id,
          action: 'expired',
        })

        expiredCount++
      }
    }

    // Clean old completed requests (keep for 7 days)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    for (const [id, request] of this.requests) {
      if (request.status !== 'pending' && request.createdAt < sevenDaysAgo) {
        this.requests.delete(id)
      }
    }

    // Clean old audit entries
    let deletedAuditEntries = 0
    const maxAuditAge = options?.maxAuditAge ?? 30 * 24 * 60 * 60 * 1000 // 30 days default
    const auditCutoff = new Date(now.getTime() - maxAuditAge)

    const originalLength = this.auditTrail.length
    this.auditTrail = this.auditTrail.filter((e) => e.timestamp >= auditCutoff)
    deletedAuditEntries = originalLength - this.auditTrail.length

    return { expiredRequests: expiredCount, deletedAuditEntries }
  }

  /**
   * Shutdown the queue
   */
  shutdown(): void {
    if (this.expiryCheckInterval) {
      clearInterval(this.expiryCheckInterval)
      this.expiryCheckInterval = null
    }
  }

  // Private methods

  private addAuditEntry(params: Omit<ApprovalAuditEntry, 'id' | 'timestamp'>): void {
    this.auditTrail.push({
      id: randomUUID(),
      timestamp: new Date(),
      ...params,
    })
  }

  private startExpiryCheck(): void {
    // Check for expired requests every 30 seconds
    this.expiryCheckInterval = setInterval(() => {
      this.cleanup()
    }, 30 * 1000)
  }
}

// Default singleton instance
let defaultQueue: ApprovalQueue | null = null

export function getApprovalQueue(config?: Partial<ApprovalConfig>): ApprovalQueue {
  if (!defaultQueue) {
    defaultQueue = new ApprovalQueue(config)
  }
  return defaultQueue
}
