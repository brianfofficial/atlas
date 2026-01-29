/**
 * Auto-Approve Rules
 *
 * Manages rules for automatically approving certain operations
 * based on patterns, categories, and risk levels.
 */

import { randomUUID } from 'crypto'
import {
  AutoApproveRule,
  ApprovalCategory,
  RiskLevel,
  ApprovalRequest,
} from './approval-types'

/**
 * Default auto-approve rules for safe operations
 */
const DEFAULT_RULES: Omit<AutoApproveRule, 'id' | 'createdAt' | 'applyCount' | 'lastApplied'>[] = [
  {
    name: 'Safe read commands',
    description: 'Automatically approve read-only file operations',
    categories: ['file_write'],
    operationPattern: '^(ls|cat|head|tail|less|more|grep|find|wc|file|stat)\\s',
    isRegex: true,
    maxRiskLevel: 'low',
    enabled: true,
    createdBy: 'system',
  },
  {
    name: 'Git status commands',
    description: 'Automatically approve non-destructive git commands',
    categories: ['dangerous_command'],
    operationPattern: '^git\\s+(status|log|diff|branch|show|blame|stash\\s+list)',
    isRegex: true,
    maxRiskLevel: 'low',
    enabled: true,
    createdBy: 'system',
  },
  {
    name: 'NPM info commands',
    description: 'Automatically approve npm read-only commands',
    categories: ['dangerous_command'],
    operationPattern: '^npm\\s+(list|ls|info|outdated|audit|view)',
    isRegex: true,
    maxRiskLevel: 'low',
    enabled: true,
    createdBy: 'system',
  },
]

/**
 * Risk level ordering for comparison
 */
const RISK_LEVEL_ORDER: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
}

/**
 * Auto-Approve Rules Manager
 *
 * Evaluates approval requests against configured rules
 * to determine if they can be auto-approved.
 */
export class AutoApproveRulesManager {
  private rules: Map<string, AutoApproveRule> = new Map()

  constructor(loadDefaults: boolean = true) {
    if (loadDefaults) {
      this.loadDefaultRules()
    }
  }

  /**
   * Load default system rules
   */
  private loadDefaultRules(): void {
    for (const ruleData of DEFAULT_RULES) {
      const rule: AutoApproveRule = {
        ...ruleData,
        id: randomUUID(),
        createdAt: new Date(),
        applyCount: 0,
      }
      this.rules.set(rule.id, rule)
    }
  }

  /**
   * Add a new auto-approve rule
   */
  addRule(params: {
    name: string
    description: string
    categories: ApprovalCategory[]
    operationPattern: string
    isRegex?: boolean
    maxRiskLevel: RiskLevel
    enabled?: boolean
    createdBy?: string
  }): AutoApproveRule {
    // Validate regex if provided
    if (params.isRegex) {
      try {
        new RegExp(params.operationPattern)
      } catch {
        throw new Error(`Invalid regex pattern: ${params.operationPattern}`)
      }
    }

    const rule: AutoApproveRule = {
      id: randomUUID(),
      name: params.name,
      description: params.description,
      categories: params.categories,
      operationPattern: params.operationPattern,
      isRegex: params.isRegex ?? false,
      maxRiskLevel: params.maxRiskLevel,
      enabled: params.enabled ?? true,
      createdAt: new Date(),
      createdBy: params.createdBy,
      applyCount: 0,
    }

    this.rules.set(rule.id, rule)
    return rule
  }

  /**
   * Get a rule by ID
   */
  getRule(id: string): AutoApproveRule | undefined {
    return this.rules.get(id)
  }

  /**
   * Get all rules
   */
  getAllRules(): AutoApproveRule[] {
    return Array.from(this.rules.values())
  }

  /**
   * Get enabled rules
   */
  getEnabledRules(): AutoApproveRule[] {
    return this.getAllRules().filter((r) => r.enabled)
  }

  /**
   * Update a rule
   */
  updateRule(
    id: string,
    updates: Partial<Omit<AutoApproveRule, 'id' | 'createdAt' | 'applyCount' | 'lastApplied'>>
  ): AutoApproveRule | undefined {
    const rule = this.rules.get(id)
    if (!rule) return undefined

    // Validate regex if updated
    if (updates.isRegex || (updates.operationPattern && rule.isRegex)) {
      try {
        new RegExp(updates.operationPattern ?? rule.operationPattern)
      } catch {
        throw new Error(`Invalid regex pattern: ${updates.operationPattern}`)
      }
    }

    const updated = { ...rule, ...updates }
    this.rules.set(id, updated)
    return updated
  }

  /**
   * Delete a rule
   */
  deleteRule(id: string): boolean {
    return this.rules.delete(id)
  }

  /**
   * Enable a rule
   */
  enableRule(id: string): boolean {
    const rule = this.rules.get(id)
    if (!rule) return false
    rule.enabled = true
    return true
  }

  /**
   * Disable a rule
   */
  disableRule(id: string): boolean {
    const rule = this.rules.get(id)
    if (!rule) return false
    rule.enabled = false
    return true
  }

  /**
   * Check if an approval request can be auto-approved
   *
   * Returns the matching rule if auto-approve is allowed, undefined otherwise.
   */
  shouldAutoApprove(request: ApprovalRequest): AutoApproveRule | undefined {
    const enabledRules = this.getEnabledRules()

    for (const rule of enabledRules) {
      if (this.ruleMatches(rule, request)) {
        // Update rule stats
        rule.applyCount++
        rule.lastApplied = new Date()
        return rule
      }
    }

    return undefined
  }

  /**
   * Check if a specific rule matches a request
   */
  ruleMatches(rule: AutoApproveRule, request: ApprovalRequest): boolean {
    // Check category
    if (!rule.categories.includes(request.category)) {
      return false
    }

    // Check risk level
    if (RISK_LEVEL_ORDER[request.riskLevel] > RISK_LEVEL_ORDER[rule.maxRiskLevel]) {
      return false
    }

    // Check operation pattern
    if (rule.isRegex) {
      try {
        const regex = new RegExp(rule.operationPattern, 'i')
        if (!regex.test(request.action)) {
          return false
        }
      } catch {
        return false
      }
    } else {
      // Exact match (case-insensitive)
      if (request.action.toLowerCase() !== rule.operationPattern.toLowerCase()) {
        return false
      }
    }

    return true
  }

  /**
   * Export rules for persistence
   */
  export(): AutoApproveRule[] {
    return this.getAllRules()
  }

  /**
   * Import rules from persistence
   */
  import(rules: AutoApproveRule[], merge: boolean = false): void {
    if (!merge) {
      this.rules.clear()
    }

    for (const rule of rules) {
      this.rules.set(rule.id, {
        ...rule,
        createdAt: new Date(rule.createdAt),
        lastApplied: rule.lastApplied ? new Date(rule.lastApplied) : undefined,
      })
    }
  }

  /**
   * Get rule statistics
   */
  getStats(): {
    totalRules: number
    enabledRules: number
    totalApplyCount: number
    topRules: { rule: AutoApproveRule; applyCount: number }[]
  } {
    const allRules = this.getAllRules()

    return {
      totalRules: allRules.length,
      enabledRules: allRules.filter((r) => r.enabled).length,
      totalApplyCount: allRules.reduce((sum, r) => sum + r.applyCount, 0),
      topRules: allRules
        .filter((r) => r.applyCount > 0)
        .sort((a, b) => b.applyCount - a.applyCount)
        .slice(0, 5)
        .map((r) => ({ rule: r, applyCount: r.applyCount })),
    }
  }
}

// Default singleton instance
let defaultManager: AutoApproveRulesManager | null = null

export function getAutoApproveRulesManager(): AutoApproveRulesManager {
  if (!defaultManager) {
    defaultManager = new AutoApproveRulesManager()
  }
  return defaultManager
}
