/**
 * Context Compressor
 *
 * Compresses conversation context to reduce token usage
 * while maintaining essential information.
 */

/**
 * Conversation turn
 */
export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: Date
  metadata?: Record<string, unknown>
}

/**
 * Compressed context result
 */
export interface CompressedContext {
  /** Compressed conversation turns */
  turns: ConversationTurn[]

  /** Original token count (estimated) */
  originalTokenCount: number

  /** Compressed token count (estimated) */
  compressedTokenCount: number

  /** Compression ratio (0-1, lower is more compressed) */
  compressionRatio: number

  /** Summary of compressed content */
  summary?: string

  /** Number of turns removed */
  turnsRemoved: number
}

/**
 * Compressor configuration
 */
export interface ContextCompressorConfig {
  /** Maximum context tokens (default: 8000) */
  maxContextTokens: number

  /** Sliding window size (number of recent turns to keep) */
  windowSize: number

  /** Whether to summarize old turns (default: true) */
  summarizeOld: boolean

  /** Maximum summary tokens (default: 500) */
  maxSummaryTokens: number

  /** Characters per token estimate (default: 4) */
  charsPerToken: number

  /** Priority roles (these are kept over others) */
  priorityRoles: ConversationTurn['role'][]

  /** Minimum turn content length to keep (default: 10) */
  minTurnLength: number
}

const DEFAULT_CONFIG: ContextCompressorConfig = {
  maxContextTokens: 8000,
  windowSize: 10,
  summarizeOld: true,
  maxSummaryTokens: 500,
  charsPerToken: 4,
  priorityRoles: ['system', 'user'],
  minTurnLength: 10,
}

/**
 * Context Compressor
 *
 * Reduces conversation context size while preserving
 * important information.
 */
export class ContextCompressor {
  private config: ContextCompressorConfig

  constructor(config?: Partial<ContextCompressorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Compress a conversation context
   */
  compress(turns: ConversationTurn[]): CompressedContext {
    const originalTokens = this.estimateTokens(turns)

    // If already under limit, no compression needed
    if (originalTokens <= this.config.maxContextTokens) {
      return {
        turns,
        originalTokenCount: originalTokens,
        compressedTokenCount: originalTokens,
        compressionRatio: 1,
        turnsRemoved: 0,
      }
    }

    // Keep system message(s) and recent window
    const systemTurns = turns.filter((t) => t.role === 'system')
    const nonSystemTurns = turns.filter((t) => t.role !== 'system')

    // Keep recent turns in the window
    const recentTurns = nonSystemTurns.slice(-this.config.windowSize)
    const oldTurns = nonSystemTurns.slice(0, -this.config.windowSize)

    // Calculate available tokens for old content
    const systemTokens = this.estimateTokens(systemTurns)
    const recentTokens = this.estimateTokens(recentTurns)
    const availableForOld = this.config.maxContextTokens - systemTokens - recentTokens

    let compressedOld: ConversationTurn[] = []
    let summary: string | undefined

    if (oldTurns.length > 0 && availableForOld > 0) {
      if (this.config.summarizeOld) {
        // Create a summary of old turns
        summary = this.createSummary(oldTurns, availableForOld)
        if (summary) {
          compressedOld = [{
            role: 'system',
            content: `[Context summary: ${summary}]`,
          }]
        }
      } else {
        // Just truncate old turns
        compressedOld = this.truncateToFit(oldTurns, availableForOld)
      }
    }

    const compressedTurns = [...systemTurns, ...compressedOld, ...recentTurns]
    const compressedTokens = this.estimateTokens(compressedTurns)

    return {
      turns: compressedTurns,
      originalTokenCount: originalTokens,
      compressedTokenCount: compressedTokens,
      compressionRatio: compressedTokens / originalTokens,
      summary,
      turnsRemoved: turns.length - compressedTurns.length,
    }
  }

  /**
   * Apply sliding window to context
   */
  slidingWindow(turns: ConversationTurn[]): ConversationTurn[] {
    const systemTurns = turns.filter((t) => t.role === 'system')
    const nonSystemTurns = turns.filter((t) => t.role !== 'system')
    const windowedTurns = nonSystemTurns.slice(-this.config.windowSize)
    return [...systemTurns, ...windowedTurns]
  }

  /**
   * Estimate token count for turns
   */
  estimateTokens(turns: ConversationTurn[]): number {
    const totalChars = turns.reduce((sum, t) => sum + t.content.length, 0)
    return Math.ceil(totalChars / this.config.charsPerToken)
  }

  /**
   * Estimate token count for a string
   */
  estimateStringTokens(text: string): number {
    return Math.ceil(text.length / this.config.charsPerToken)
  }

  /**
   * Check if context needs compression
   */
  needsCompression(turns: ConversationTurn[]): boolean {
    return this.estimateTokens(turns) > this.config.maxContextTokens
  }

  /**
   * Get compression recommendation
   */
  getRecommendation(turns: ConversationTurn[]): {
    currentTokens: number
    maxTokens: number
    needsCompression: boolean
    estimatedSavings: number
    suggestedAction: string
  } {
    const current = this.estimateTokens(turns)
    const needsCompression = current > this.config.maxContextTokens
    const estimatedCompressed = this.compress(turns)

    return {
      currentTokens: current,
      maxTokens: this.config.maxContextTokens,
      needsCompression,
      estimatedSavings: current - estimatedCompressed.compressedTokenCount,
      suggestedAction: needsCompression
        ? `Compress context (${estimatedCompressed.turnsRemoved} turns)`
        : 'No compression needed',
    }
  }

  // Private methods

  private createSummary(turns: ConversationTurn[], maxTokens: number): string {
    // Simple extractive summary - take key points from each turn
    const maxChars = maxTokens * this.config.charsPerToken

    const keyPoints: string[] = []
    let totalChars = 0

    for (const turn of turns) {
      // Extract first sentence or key phrase
      const sentences = turn.content.split(/[.!?]+/).filter((s) => s.trim().length > 0)
      const firstSentence = sentences[0]?.trim() ?? ''

      if (firstSentence && totalChars + firstSentence.length < maxChars) {
        keyPoints.push(`${turn.role}: ${firstSentence}`)
        totalChars += firstSentence.length + turn.role.length + 2
      }
    }

    if (keyPoints.length === 0) {
      return `Previous conversation with ${turns.length} messages`
    }

    return keyPoints.join(' | ')
  }

  private truncateToFit(turns: ConversationTurn[], maxTokens: number): ConversationTurn[] {
    const result: ConversationTurn[] = []
    let currentTokens = 0

    // Prioritize by role
    const prioritized = [...turns].sort((a, b) => {
      const aIdx = this.config.priorityRoles.indexOf(a.role)
      const bIdx = this.config.priorityRoles.indexOf(b.role)
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx)
    })

    for (const turn of prioritized) {
      const turnTokens = this.estimateStringTokens(turn.content)
      if (currentTokens + turnTokens <= maxTokens) {
        result.push(turn)
        currentTokens += turnTokens
      }
    }

    // Re-sort by original order (using timestamp if available)
    return result.sort((a, b) => {
      if (a.timestamp && b.timestamp) {
        return a.timestamp.getTime() - b.timestamp.getTime()
      }
      return turns.indexOf(a) - turns.indexOf(b)
    })
  }
}

// Default singleton instance
let defaultCompressor: ContextCompressor | null = null

export function getContextCompressor(
  config?: Partial<ContextCompressorConfig>
): ContextCompressor {
  if (!defaultCompressor) {
    defaultCompressor = new ContextCompressor(config)
  }
  return defaultCompressor
}
