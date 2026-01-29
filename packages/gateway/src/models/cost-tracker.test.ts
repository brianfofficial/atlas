/**
 * Atlas - Cost Tracker Tests
 */

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import { CostTracker } from './cost-tracker.js'

describe('Cost Tracker', () => {
  let tracker: CostTracker

  beforeEach(() => {
    tracker = new CostTracker()
  })

  describe('record', () => {
    it('should record usage and return cost entry', () => {
      const entry = tracker.record(
        'anthropic',
        'claude-3-sonnet',
        { inputTokens: 1000, outputTokens: 500, totalTokens: 1500, estimatedCost: 0.015 }
      )

      assert.ok(entry.id)
      assert.strictEqual(entry.provider, 'anthropic')
      assert.strictEqual(entry.model, 'claude-3-sonnet')
      assert.strictEqual(entry.inputTokens, 1000)
      assert.strictEqual(entry.outputTokens, 500)
      assert.strictEqual(entry.cost, 0.015)
      assert.ok(entry.timestamp instanceof Date)
    })

    it('should track local models with zero cost', () => {
      const entry = tracker.record(
        'ollama',
        'llama3',
        { inputTokens: 10000, outputTokens: 5000, totalTokens: 15000, estimatedCost: 0 }
      )

      assert.strictEqual(entry.cost, 0)
    })

    it('should include optional metadata', () => {
      const entry = tracker.record(
        'anthropic',
        'claude-3-haiku',
        { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.001 },
        'code-review',
        { file: 'test.ts' }
      )

      assert.strictEqual(entry.taskType, 'code-review')
      assert.deepStrictEqual(entry.metadata, { file: 'test.ts' })
    })
  })

  describe('getTodaySpend', () => {
    it('should return zero with no usage', () => {
      assert.strictEqual(tracker.getTodaySpend(), 0)
    })

    it('should sum today\'s costs', () => {
      tracker.record('anthropic', 'claude-3-sonnet', { inputTokens: 1000, outputTokens: 500, totalTokens: 1500, estimatedCost: 0.01 })
      tracker.record('anthropic', 'claude-3-sonnet', { inputTokens: 1000, outputTokens: 500, totalTokens: 1500, estimatedCost: 0.01 })

      const total = tracker.getTodaySpend()
      assert.strictEqual(total, 0.02)
    })
  })

  describe('getSummary', () => {
    it('should return summary for day', () => {
      tracker.record('anthropic', 'claude-3-haiku', { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.001 })

      const summary = tracker.getSummary('day')
      assert.ok(summary.totalCost >= 0)
      assert.ok(summary.totalInputTokens >= 0)
      assert.ok(summary.totalOutputTokens >= 0)
    })

    it('should aggregate by provider', () => {
      tracker.record('ollama', 'llama3', { inputTokens: 1000, outputTokens: 500, totalTokens: 1500, estimatedCost: 0 })
      tracker.record('anthropic', 'claude-3-haiku', { inputTokens: 500, outputTokens: 250, totalTokens: 750, estimatedCost: 0.001 })

      const summary = tracker.getSummary('day')
      assert.ok(summary.byProvider !== undefined)
      assert.ok(typeof summary.byProvider === 'object')
    })

    it('should aggregate by model', () => {
      tracker.record('ollama', 'llama3', { inputTokens: 1000, outputTokens: 500, totalTokens: 1500, estimatedCost: 0 })
      tracker.record('ollama', 'codellama', { inputTokens: 2000, outputTokens: 1000, totalTokens: 3000, estimatedCost: 0 })

      const summary = tracker.getSummary('day')
      assert.ok('ollama:llama3' in summary.byModel)
      assert.ok('ollama:codellama' in summary.byModel)
    })
  })

  describe('budget management', () => {
    it('should update budget config', () => {
      tracker.updateBudget({
        dailyLimit: 10,
        weeklyLimit: 50,
        monthlyLimit: 200,
      })

      const config = tracker.getBudgetConfig()
      assert.strictEqual(config.dailyLimit, 10)
      assert.strictEqual(config.weeklyLimit, 50)
      assert.strictEqual(config.monthlyLimit, 200)
    })

    it('should check if over budget', () => {
      tracker.updateBudget({ dailyLimit: 0.001 })

      // Record usage that exceeds daily limit
      tracker.record('anthropic', 'claude-3-sonnet', { inputTokens: 10000, outputTokens: 5000, totalTokens: 15000, estimatedCost: 0.1 })

      assert.strictEqual(tracker.isOverBudget('daily'), true)
    })

    it('should calculate budget utilization', () => {
      tracker.updateBudget({ dailyLimit: 1.0 })
      tracker.record('anthropic', 'claude-3-sonnet', { inputTokens: 1000, outputTokens: 500, totalTokens: 1500, estimatedCost: 0.5 })

      const utilization = tracker.getBudgetUtilization('daily')
      assert.strictEqual(utilization, 50)
    })
  })

  describe('clear', () => {
    it('should clear all usage history', () => {
      tracker.record('ollama', 'llama3', { inputTokens: 1000, outputTokens: 500, totalTokens: 1500, estimatedCost: 0 })
      assert.ok(tracker.getTodaySpend() >= 0)

      tracker.clear()

      assert.strictEqual(tracker.getTodaySpend(), 0)
      assert.strictEqual(tracker.getSummary('all').entries.length, 0)
    })
  })

  describe('export/import', () => {
    it('should export entries as JSON', () => {
      tracker.record('ollama', 'llama3', { inputTokens: 1000, outputTokens: 500, totalTokens: 1500, estimatedCost: 0 })

      const json = tracker.export()
      const parsed = JSON.parse(json)

      assert.ok(Array.isArray(parsed))
      assert.strictEqual(parsed.length, 1)
    })

    it('should import entries from JSON', () => {
      const entries = [{
        id: 'test-id',
        timestamp: new Date().toISOString(),
        provider: 'ollama',
        model: 'llama3',
        inputTokens: 1000,
        outputTokens: 500,
        cost: 0,
      }]

      tracker.import(JSON.stringify(entries))

      const summary = tracker.getSummary('all')
      assert.strictEqual(summary.entries.length, 1)
    })
  })
})
