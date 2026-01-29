/**
 * Optimization Statistics
 *
 * Tracks and aggregates optimization metrics across all systems.
 */

import { getPromptCache, PromptCacheStats } from './prompt-cache'
import { getContextCompressor } from './context-compressor'

/**
 * Token pricing by model (per 1M tokens)
 */
export const MODEL_PRICING: Record<
  string,
  { input: number; output: number }
> = {
  // Anthropic
  'claude-3-opus': { input: 15, output: 75 },
  'claude-3.5-sonnet': { input: 3, output: 15 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },

  // OpenAI
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4': { input: 30, output: 60 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },

  // Local (free)
  'ollama:llama3': { input: 0, output: 0 },
  'ollama:mistral': { input: 0, output: 0 },
  'ollama:codellama': { input: 0, output: 0 },
  'lmstudio': { input: 0, output: 0 },
}

/**
 * Aggregated optimization stats
 */
export interface OptimizationStats {
  // Prompt cache stats
  promptCache: PromptCacheStats

  // Context compression stats
  contextCompression: {
    totalCompressions: number
    originalTokens: number
    compressedTokens: number
    tokensSaved: number
    averageCompressionRatio: number
  }

  // Cost savings
  costSavings: {
    fromCache: number
    fromCompression: number
    fromLocalModels: number
    total: number
  }

  // Token savings
  tokenSavings: {
    fromCache: { input: number; output: number }
    fromCompression: number
    fromLocalModels: { input: number; output: number }
    total: { input: number; output: number }
  }

  // Efficiency metrics
  efficiency: {
    cacheHitRate: number
    compressionRatio: number
    localModelUsageRate: number
    overallSavingsRate: number
  }

  // Time period
  period: {
    startDate: Date
    endDate: Date
    durationMs: number
  }
}

/**
 * Optimization tracking entry
 */
interface OptimizationEntry {
  timestamp: Date
  type: 'cache_hit' | 'compression' | 'local_model' | 'cloud_model'
  model: string
  tokensSaved: { input: number; output: number }
  costSaved: number
}

/**
 * Optimization Stats Tracker
 */
export class OptimizationStatsTracker {
  private entries: OptimizationEntry[] = []
  private startDate: Date = new Date()
  private compressionStats = {
    totalCompressions: 0,
    originalTokens: 0,
    compressedTokens: 0,
  }
  private localModelUsage = {
    requests: 0,
    tokens: { input: 0, output: 0 },
  }
  private cloudModelUsage = {
    requests: 0,
    tokens: { input: 0, output: 0 },
    cost: 0,
  }
  private maxEntries: number = 10000

  /**
   * Record a cache hit
   */
  recordCacheHit(
    model: string,
    tokensSaved: { input: number; output: number }
  ): void {
    const pricing = MODEL_PRICING[model] ?? { input: 1, output: 1 }
    const costSaved =
      (tokensSaved.input * pricing.input + tokensSaved.output * pricing.output) /
      1_000_000

    this.addEntry({
      timestamp: new Date(),
      type: 'cache_hit',
      model,
      tokensSaved,
      costSaved,
    })
  }

  /**
   * Record context compression
   */
  recordCompression(
    originalTokens: number,
    compressedTokens: number,
    model: string
  ): void {
    const tokensSaved = originalTokens - compressedTokens
    const pricing = MODEL_PRICING[model] ?? { input: 1, output: 0 }
    const costSaved = (tokensSaved * pricing.input) / 1_000_000

    this.compressionStats.totalCompressions++
    this.compressionStats.originalTokens += originalTokens
    this.compressionStats.compressedTokens += compressedTokens

    this.addEntry({
      timestamp: new Date(),
      type: 'compression',
      model,
      tokensSaved: { input: tokensSaved, output: 0 },
      costSaved,
    })
  }

  /**
   * Record local model usage
   */
  recordLocalModelUsage(
    model: string,
    tokens: { input: number; output: number }
  ): void {
    // Calculate cost saved by using local instead of cloud
    const cloudAlternative = 'claude-3-haiku' // Assume cheapest cloud
    const pricing = MODEL_PRICING[cloudAlternative] ?? { input: 0.25, output: 1.25 }
    const costSaved =
      (tokens.input * pricing.input + tokens.output * pricing.output) /
      1_000_000

    this.localModelUsage.requests++
    this.localModelUsage.tokens.input += tokens.input
    this.localModelUsage.tokens.output += tokens.output

    this.addEntry({
      timestamp: new Date(),
      type: 'local_model',
      model,
      tokensSaved: tokens, // These would have been cloud tokens
      costSaved,
    })
  }

  /**
   * Record cloud model usage (for comparison)
   */
  recordCloudModelUsage(
    model: string,
    tokens: { input: number; output: number }
  ): void {
    const pricing = MODEL_PRICING[model] ?? { input: 1, output: 1 }
    const cost =
      (tokens.input * pricing.input + tokens.output * pricing.output) /
      1_000_000

    this.cloudModelUsage.requests++
    this.cloudModelUsage.tokens.input += tokens.input
    this.cloudModelUsage.tokens.output += tokens.output
    this.cloudModelUsage.cost += cost

    this.addEntry({
      timestamp: new Date(),
      type: 'cloud_model',
      model,
      tokensSaved: { input: 0, output: 0 },
      costSaved: 0,
    })
  }

  /**
   * Get aggregated statistics
   */
  getStats(): OptimizationStats {
    const promptCache = getPromptCache().getStats()
    const now = new Date()

    // Aggregate from entries
    const cacheHits = this.entries.filter((e) => e.type === 'cache_hit')
    const compressions = this.entries.filter((e) => e.type === 'compression')
    const localUsage = this.entries.filter((e) => e.type === 'local_model')

    const cacheSavings = cacheHits.reduce(
      (sum, e) => ({
        input: sum.input + e.tokensSaved.input,
        output: sum.output + e.tokensSaved.output,
        cost: sum.cost + e.costSaved,
      }),
      { input: 0, output: 0, cost: 0 }
    )

    const compressionSavings = compressions.reduce(
      (sum, e) => ({
        tokens: sum.tokens + e.tokensSaved.input,
        cost: sum.cost + e.costSaved,
      }),
      { tokens: 0, cost: 0 }
    )

    const localSavings = localUsage.reduce(
      (sum, e) => ({
        input: sum.input + e.tokensSaved.input,
        output: sum.output + e.tokensSaved.output,
        cost: sum.cost + e.costSaved,
      }),
      { input: 0, output: 0, cost: 0 }
    )

    const totalRequests =
      this.localModelUsage.requests + this.cloudModelUsage.requests

    return {
      promptCache,

      contextCompression: {
        totalCompressions: this.compressionStats.totalCompressions,
        originalTokens: this.compressionStats.originalTokens,
        compressedTokens: this.compressionStats.compressedTokens,
        tokensSaved:
          this.compressionStats.originalTokens -
          this.compressionStats.compressedTokens,
        averageCompressionRatio:
          this.compressionStats.totalCompressions > 0
            ? this.compressionStats.compressedTokens /
              this.compressionStats.originalTokens
            : 1,
      },

      costSavings: {
        fromCache: cacheSavings.cost,
        fromCompression: compressionSavings.cost,
        fromLocalModels: localSavings.cost,
        total: cacheSavings.cost + compressionSavings.cost + localSavings.cost,
      },

      tokenSavings: {
        fromCache: { input: cacheSavings.input, output: cacheSavings.output },
        fromCompression: compressionSavings.tokens,
        fromLocalModels: {
          input: localSavings.input,
          output: localSavings.output,
        },
        total: {
          input: cacheSavings.input + compressionSavings.tokens + localSavings.input,
          output: cacheSavings.output + localSavings.output,
        },
      },

      efficiency: {
        cacheHitRate: promptCache.hitRate,
        compressionRatio:
          this.compressionStats.totalCompressions > 0
            ? this.compressionStats.compressedTokens /
              this.compressionStats.originalTokens
            : 1,
        localModelUsageRate:
          totalRequests > 0 ? this.localModelUsage.requests / totalRequests : 0,
        overallSavingsRate:
          this.cloudModelUsage.cost > 0
            ? (cacheSavings.cost +
                compressionSavings.cost +
                localSavings.cost) /
              (this.cloudModelUsage.cost +
                cacheSavings.cost +
                compressionSavings.cost +
                localSavings.cost)
            : 0,
      },

      period: {
        startDate: this.startDate,
        endDate: now,
        durationMs: now.getTime() - this.startDate.getTime(),
      },
    }
  }

  /**
   * Get daily summary
   */
  getDailySummary(): {
    date: string
    tokensSaved: number
    costSaved: number
    cacheHits: number
    compressions: number
    localRequests: number
  }[] {
    const byDay = new Map<
      string,
      {
        tokensSaved: number
        costSaved: number
        cacheHits: number
        compressions: number
        localRequests: number
      }
    >()

    for (const entry of this.entries) {
      const date = entry.timestamp.toISOString().split('T')[0]
      const current = byDay.get(date) ?? {
        tokensSaved: 0,
        costSaved: 0,
        cacheHits: 0,
        compressions: 0,
        localRequests: 0,
      }

      current.tokensSaved += entry.tokensSaved.input + entry.tokensSaved.output
      current.costSaved += entry.costSaved

      if (entry.type === 'cache_hit') current.cacheHits++
      if (entry.type === 'compression') current.compressions++
      if (entry.type === 'local_model') current.localRequests++

      byDay.set(date, current)
    }

    return Array.from(byDay.entries())
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.entries = []
    this.startDate = new Date()
    this.compressionStats = {
      totalCompressions: 0,
      originalTokens: 0,
      compressedTokens: 0,
    }
    this.localModelUsage = {
      requests: 0,
      tokens: { input: 0, output: 0 },
    }
    this.cloudModelUsage = {
      requests: 0,
      tokens: { input: 0, output: 0 },
      cost: 0,
    }
  }

  // Private methods

  private addEntry(entry: OptimizationEntry): void {
    this.entries.push(entry)

    // Trim old entries
    if (this.entries.length > this.maxEntries) {
      this.entries.shift()
    }
  }
}

// Default singleton instance
let defaultTracker: OptimizationStatsTracker | null = null

export function getOptimizationStats(): OptimizationStatsTracker {
  if (!defaultTracker) {
    defaultTracker = new OptimizationStatsTracker()
  }
  return defaultTracker
}
