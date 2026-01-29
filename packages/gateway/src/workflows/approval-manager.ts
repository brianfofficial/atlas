/**
 * Approval Manager
 *
 * Main entry point for the Human-in-the-Loop approval system.
 * Coordinates between the approval queue, auto-approve rules,
 * and persistence layer.
 */

import { EventEmitter } from 'events'
import {
  ApprovalRequest,
  ApprovalDecision,
  ApprovalCategory,
  RiskLevel,
  ApprovalConfig,
  ApprovalStats,
  ApprovalAuditEntry,
  DEFAULT_APPROVAL_CONFIG,
} from './approval-types'
import { ApprovalQueue, getApprovalQueue } from './approval-queue'
import { AutoApproveRulesManager, getAutoApproveRulesManager } from './auto-approve-rules'
import { ApprovalPersistence, getApprovalPersistence } from './approval-persistence'

/**
 * Events emitted by the ApprovalManager
 */
export interface ApprovalEvents {
  'request:created': ApprovalRequest
  'request:approved': ApprovalRequest
  'request:denied': ApprovalRequest
  'request:auto_approved': ApprovalRequest
  'request:expired': ApprovalRequest
}

/**
 * Approval Manager
 *
 * High-level interface for the HITL approval system.
 */
export class ApprovalManager extends EventEmitter {
  private queue: ApprovalQueue
  private autoApproveRules: AutoApproveRulesManager
  private persistence: ApprovalPersistence
  private config: ApprovalConfig
  private saveInterval: NodeJS.Timeout | null = null

  constructor(config?: Partial<ApprovalConfig>) {
    super()
    this.config = { ...DEFAULT_APPROVAL_CONFIG, ...config }
    this.queue = getApprovalQueue(this.config)
    this.autoApproveRules = getAutoApproveRulesManager()
    this.persistence = getApprovalPersistence()

    // Load persisted state
    this.load()

    // Start auto-save
    this.startAutoSave()
  }

  /**
   * Request approval for an operation
   *
   * Returns immediately if auto-approved, otherwise creates a pending request.
   */
  async requestApproval(params: {
    category: ApprovalCategory
    operation: string
    action: string
    riskLevel: RiskLevel
    context: string
    technicalDetails?: string
    sessionId: string
    userId?: string
    metadata?: Record<string, unknown>
  }): Promise<{ approved: boolean; request: ApprovalRequest; waitForDecision?: () => Promise<ApprovalRequest> }> {
    // Create the request first
    const request = this.queue.createRequest(params)
    this.emit('request:created', request)

    // Check if it should be auto-approved
    if (this.config.allowAutoApprove) {
      // Skip auto-approve for categories that always require approval
      const requiresApproval =
        this.config.alwaysRequireApproval.includes(params.category) ||
        this.config.alwaysRequireApprovalRiskLevels.includes(params.riskLevel)

      if (!requiresApproval) {
        const matchingRule = this.autoApproveRules.shouldAutoApprove(request)
        if (matchingRule) {
          this.queue.autoApprove(request.id, {
            ruleId: matchingRule.id,
            ruleName: matchingRule.name,
          })
          this.emit('request:auto_approved', request)
          await this.save()
          return { approved: true, request }
        }
      }
    }

    // Return pending request with a function to wait for decision
    const waitForDecision = (): Promise<ApprovalRequest> => {
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          const current = this.queue.getRequest(request.id)
          if (!current) {
            clearInterval(checkInterval)
            reject(new Error('Request not found'))
            return
          }

          if (current.status === 'approved' || current.status === 'auto_approved') {
            clearInterval(checkInterval)
            resolve(current)
          } else if (current.status === 'denied') {
            clearInterval(checkInterval)
            reject(new Error('Request was denied'))
          } else if (current.status === 'expired') {
            clearInterval(checkInterval)
            reject(new Error('Request expired'))
          }
        }, 100)

        // Set timeout based on expiry
        const timeoutMs = request.expiresAt.getTime() - Date.now()
        setTimeout(() => {
          clearInterval(checkInterval)
          reject(new Error('Request timed out'))
        }, timeoutMs)
      })
    }

    return { approved: false, request, waitForDecision }
  }

  /**
   * Make a decision on a pending approval
   */
  async decide(decision: ApprovalDecision): Promise<ApprovalRequest> {
    const request = this.queue.getRequest(decision.requestId)
    if (!request) {
      throw new Error(`Approval request ${decision.requestId} not found`)
    }

    if (request.status !== 'pending') {
      throw new Error(`Request ${decision.requestId} is not pending (status: ${request.status})`)
    }

    let updated: ApprovalRequest | undefined

    if (decision.status === 'approved') {
      updated = this.queue.approve(decision.requestId, {
        userId: decision.decidedBy,
      })
      this.emit('request:approved', updated)

      // Handle "remember this decision"
      if (decision.rememberDecision) {
        await this.rememberDecision(request, decision)
      }
    } else {
      updated = this.queue.deny(decision.requestId, {
        reason: decision.reason,
        userId: decision.decidedBy,
      })
      this.emit('request:denied', updated)
    }

    if (!updated) {
      throw new Error('Failed to update request')
    }

    await this.save()
    return updated
  }

  /**
   * Approve a pending request (convenience method)
   */
  async approve(
    requestId: string,
    options?: {
      remember?: boolean
      rememberScope?: 'exact' | 'similar' | 'category'
      userId?: string
    }
  ): Promise<ApprovalRequest> {
    return this.decide({
      requestId,
      status: 'approved',
      rememberDecision: options?.remember ?? false,
      rememberScope: options?.rememberScope,
      decidedAt: new Date(),
      decidedBy: options?.userId,
    })
  }

  /**
   * Deny a pending request (convenience method)
   */
  async deny(
    requestId: string,
    options?: {
      reason?: string
      userId?: string
    }
  ): Promise<ApprovalRequest> {
    return this.decide({
      requestId,
      status: 'denied',
      rememberDecision: false,
      reason: options?.reason,
      decidedAt: new Date(),
      decidedBy: options?.userId,
    })
  }

  /**
   * Get all pending approvals
   */
  getPending(): ApprovalRequest[] {
    return this.queue.getPendingRequests()
  }

  /**
   * Get pending approvals for a session
   */
  getPendingForSession(sessionId: string): ApprovalRequest[] {
    return this.queue.getPendingForSession(sessionId)
  }

  /**
   * Get a specific approval request
   */
  getRequest(id: string): ApprovalRequest | undefined {
    return this.queue.getRequest(id)
  }

  /**
   * Get audit trail for a request
   */
  getAuditTrail(requestId: string): ApprovalAuditEntry[] {
    return this.queue.getAuditTrail(requestId)
  }

  /**
   * Get full audit trail
   */
  getFullAuditTrail(options?: {
    limit?: number
    offset?: number
    startDate?: Date
    endDate?: Date
  }): ApprovalAuditEntry[] {
    return this.queue.getFullAuditTrail(options)
  }

  /**
   * Get approval statistics
   */
  getStats(): ApprovalStats {
    return this.queue.getStats()
  }

  /**
   * Get auto-approve rules manager
   */
  getAutoApproveRules(): AutoApproveRulesManager {
    return this.autoApproveRules
  }

  /**
   * Get configuration
   */
  getConfig(): ApprovalConfig {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ApprovalConfig>): void {
    this.config = { ...this.config, ...updates }
  }

  /**
   * Save state to persistence
   */
  async save(): Promise<void> {
    const queueState = this.queue.export()
    const rules = this.autoApproveRules.export()

    await this.persistence.save({
      requests: queueState.requests,
      auditTrail: queueState.auditTrail,
      autoApproveRules: rules,
      config: this.config,
    })
  }

  /**
   * Load state from persistence
   */
  async load(): Promise<void> {
    const state = await this.persistence.load()
    if (!state) return

    if (state.requests && state.auditTrail) {
      this.queue.import({
        requests: state.requests,
        auditTrail: state.auditTrail,
      })
    }

    if (state.autoApproveRules) {
      this.autoApproveRules.import(state.autoApproveRules, false)
    }

    if (state.config) {
      this.config = { ...DEFAULT_APPROVAL_CONFIG, ...state.config }
    }
  }

  /**
   * Shutdown the manager
   */
  async shutdown(): Promise<void> {
    if (this.saveInterval) {
      clearInterval(this.saveInterval)
      this.saveInterval = null
    }

    await this.save()
    this.queue.shutdown()
  }

  // Private methods

  private async rememberDecision(
    request: ApprovalRequest,
    decision: ApprovalDecision
  ): Promise<void> {
    const scope = decision.rememberScope ?? 'similar'

    let pattern: string
    let isRegex: boolean = true

    switch (scope) {
      case 'exact':
        // Exact match only
        pattern = `^${this.escapeRegex(request.action)}$`
        break
      case 'category':
        // Any action in this category
        pattern = '.*'
        break
      case 'similar':
      default:
        // Similar commands (same base command)
        const baseCommand = request.action.split(/\s+/)[0]
        pattern = `^${this.escapeRegex(baseCommand)}\\s`
    }

    this.autoApproveRules.addRule({
      name: `Remembered: ${request.operation}`,
      description: `Auto-approve based on previous decision at ${decision.decidedAt.toISOString()}`,
      categories: [request.category],
      operationPattern: pattern,
      isRegex,
      maxRiskLevel: request.riskLevel,
      enabled: true,
      createdBy: decision.decidedBy,
    })
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  private startAutoSave(): void {
    // Auto-save every minute
    this.saveInterval = setInterval(() => {
      this.save().catch(console.error)
    }, 60 * 1000)
  }
}

// Default singleton instance
let defaultManager: ApprovalManager | null = null

export function getApprovalManager(config?: Partial<ApprovalConfig>): ApprovalManager {
  if (!defaultManager) {
    defaultManager = new ApprovalManager(config)
  }
  return defaultManager
}
