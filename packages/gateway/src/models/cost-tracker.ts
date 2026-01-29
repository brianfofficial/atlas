/**
 * Atlas - Cost Tracker
 *
 * Real-time tracking of API usage costs with budget alerts.
 * Tracks both local (free) and cloud (paid) model usage.
 */

import { v4 as uuidv4 } from 'uuid'
import {
  ModelProvider,
  CostEntry,
  CostSummary,
  BudgetConfig,
  TokenUsage,
  DEFAULT_BUDGET_CONFIG,
} from './types.js'

/**
 * Time period for cost aggregation
 */
export type TimePeriod = 'day' | 'week' | 'month' | 'all'

/**
 * Budget alert callback
 */
export type BudgetAlertCallback = (
  threshold: number,
  currentSpend: number,
  limit: number,
  period: 'daily' | 'weekly' | 'monthly'
) => void

/**
 * Cost tracker for monitoring API usage and spending
 */
export class CostTracker {
  private entries: CostEntry[] = []
  private budgetConfig: BudgetConfig
  private alertCallbacks: BudgetAlertCallback[] = []
  private alertedThresholds: Set<string> = new Set()

  constructor(config: Partial<BudgetConfig> = {}) {
    this.budgetConfig = { ...DEFAULT_BUDGET_CONFIG, ...config }
  }

  /**
   * Record a cost entry
   */
  record(
    provider: ModelProvider,
    model: string,
    usage: TokenUsage,
    taskType?: string,
    metadata?: Record<string, unknown>
  ): CostEntry {
    const entry: CostEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      provider,
      model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cost: usage.estimatedCost,
      taskType,
      metadata,
    }

    this.entries.push(entry)

    // Check budget thresholds
    this.checkBudgetThresholds()

    return entry
  }

  /**
   * Get cost summary for a time period
   */
  getSummary(period: TimePeriod = 'day'): CostSummary {
    const filteredEntries = this.filterByPeriod(period)

    const summary: CostSummary = {
      totalCost: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      byProvider: {} as Record<ModelProvider, number>,
      byModel: {},
      entries: filteredEntries,
    }

    for (const entry of filteredEntries) {
      summary.totalCost += entry.cost
      summary.totalInputTokens += entry.inputTokens
      summary.totalOutputTokens += entry.outputTokens

      // Aggregate by provider
      summary.byProvider[entry.provider] =
        (summary.byProvider[entry.provider] ?? 0) + entry.cost

      // Aggregate by model
      const modelKey = `${entry.provider}:${entry.model}`
      summary.byModel[modelKey] = (summary.byModel[modelKey] ?? 0) + entry.cost
    }

    return summary
  }

  /**
   * Get today's spend
   */
  getTodaySpend(): number {
    return this.getSummary('day').totalCost
  }

  /**
   * Get this week's spend
   */
  getWeekSpend(): number {
    return this.getSummary('week').totalCost
  }

  /**
   * Get this month's spend
   */
  getMonthSpend(): number {
    return this.getSummary('month').totalCost
  }

  /**
   * Get projected monthly spend based on current usage
   */
  getProjectedMonthlySpend(): number {
    const monthSummary = this.getSummary('month')
    const now = new Date()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const dayOfMonth = now.getDate()

    if (dayOfMonth === 0) return 0

    // Project based on daily average
    const dailyAverage = monthSummary.totalCost / dayOfMonth
    return dailyAverage * daysInMonth
  }

  /**
   * Check if budget limit is exceeded
   */
  isOverBudget(period: 'daily' | 'weekly' | 'monthly'): boolean {
    const limit = this.getLimit(period)
    if (limit === undefined) return false

    const spend =
      period === 'daily'
        ? this.getTodaySpend()
        : period === 'weekly'
          ? this.getWeekSpend()
          : this.getMonthSpend()

    return spend >= limit
  }

  /**
   * Get budget utilization percentage
   */
  getBudgetUtilization(period: 'daily' | 'weekly' | 'monthly'): number {
    const limit = this.getLimit(period)
    if (limit === undefined || limit === 0) return 0

    const spend =
      period === 'daily'
        ? this.getTodaySpend()
        : period === 'weekly'
          ? this.getWeekSpend()
          : this.getMonthSpend()

    return (spend / limit) * 100
  }

  /**
   * Register a budget alert callback
   */
  onBudgetAlert(callback: BudgetAlertCallback): void {
    this.alertCallbacks.push(callback)
  }

  /**
   * Update budget configuration
   */
  updateBudget(config: Partial<BudgetConfig>): void {
    this.budgetConfig = { ...this.budgetConfig, ...config }
    // Reset alerted thresholds when budget changes
    this.alertedThresholds.clear()
  }

  /**
   * Get current budget configuration
   */
  getBudgetConfig(): BudgetConfig {
    return { ...this.budgetConfig }
  }

  /**
   * Clear all entries (useful for testing)
   */
  clear(): void {
    this.entries = []
    this.alertedThresholds.clear()
  }

  /**
   * Export entries as JSON
   */
  export(): string {
    return JSON.stringify(this.entries, null, 2)
  }

  /**
   * Import entries from JSON
   */
  import(json: string): void {
    const data = JSON.parse(json) as CostEntry[]
    // Validate and convert dates
    this.entries = data.map((entry) => ({
      ...entry,
      timestamp: new Date(entry.timestamp),
    }))
  }

  /**
   * Filter entries by time period
   */
  private filterByPeriod(period: TimePeriod): CostEntry[] {
    if (period === 'all') {
      return this.entries
    }

    const now = new Date()
    let startDate: Date

    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        const dayOfWeek = now.getDay()
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek)
        break
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
    }

    return this.entries.filter((entry) => entry.timestamp >= startDate)
  }

  /**
   * Get limit for a period
   */
  private getLimit(period: 'daily' | 'weekly' | 'monthly'): number | undefined {
    switch (period) {
      case 'daily':
        return this.budgetConfig.dailyLimit
      case 'weekly':
        return this.budgetConfig.weeklyLimit
      case 'monthly':
        return this.budgetConfig.monthlyLimit
    }
  }

  /**
   * Check budget thresholds and trigger alerts
   */
  private checkBudgetThresholds(): void {
    const periods: Array<'daily' | 'weekly' | 'monthly'> = ['daily', 'weekly', 'monthly']

    for (const period of periods) {
      const limit = this.getLimit(period)
      if (limit === undefined) continue

      const spend =
        period === 'daily'
          ? this.getTodaySpend()
          : period === 'weekly'
            ? this.getWeekSpend()
            : this.getMonthSpend()

      const utilization = (spend / limit) * 100

      for (const threshold of this.budgetConfig.alertThresholds) {
        const alertKey = `${period}-${threshold}`

        if (utilization >= threshold && !this.alertedThresholds.has(alertKey)) {
          this.alertedThresholds.add(alertKey)

          // Trigger callbacks
          for (const callback of this.alertCallbacks) {
            try {
              callback(threshold, spend, limit, period)
            } catch (error) {
              console.error('Budget alert callback failed:', error)
            }
          }
        }
      }
    }
  }

  /**
   * Get daily breakdown for the current month
   */
  getDailyBreakdown(): Array<{ date: string; cost: number; tokens: number }> {
    const monthEntries = this.filterByPeriod('month')
    const dailyMap = new Map<string, { cost: number; tokens: number }>()

    for (const entry of monthEntries) {
      const dateKey = entry.timestamp.toISOString().split('T')[0] ?? 'unknown'
      const existing = dailyMap.get(dateKey) ?? { cost: 0, tokens: 0 }

      dailyMap.set(dateKey, {
        cost: existing.cost + entry.cost,
        tokens: existing.tokens + entry.inputTokens + entry.outputTokens,
      })
    }

    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }
}

// Export singleton instance
export const costTracker = new CostTracker()

// Getter for singleton
export function getCostTracker(): CostTracker {
  return costTracker
}
