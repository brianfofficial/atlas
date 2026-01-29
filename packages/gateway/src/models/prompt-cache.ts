/**
 * Prompt Cache
 *
 * Hash-based caching for prompt/response pairs to reduce API costs.
 * Uses LRU eviction when cache is full.
 */

import { createHash } from 'crypto'

/**
 * Cached prompt entry
 */
export interface PromptCacheEntry {
  /** Hash of the prompt */
  promptHash: string

  /** Model used for this response */
  model: string

  /** The cached response */
  response: string

  /** When this was cached */
  createdAt: Date

  /** When this expires */
  expiresAt: Date

  /** Last accessed time (for LRU) */
  lastAccessedAt: Date

  /** Number of times this was returned from cache */
  hitCount: number

  /** Original token count */
  tokenCount: {
    input: number
    output: number
  }

  /** Estimated cost saved per hit */
  estimatedCostPerHit: number
}

/**
 * Cache statistics
 */
export interface PromptCacheStats {
  /** Total entries in cache */
  size: number

  /** Cache hits */
  hits: number

  /** Cache misses */
  misses: number

  /** Hit rate (0-1) */
  hitRate: number

  /** Total tokens saved */
  tokensSaved: {
    input: number
    output: number
  }

  /** Estimated cost saved */
  costSaved: number

  /** Evictions due to capacity */
  evictions: number
}

/**
 * Cache configuration
 */
export interface PromptCacheConfig {
  /** Maximum entries in cache (default: 1000) */
  maxEntries: number

  /** Default TTL in ms (default: 1 hour) */
  defaultTTL: number

  /** Maximum TTL in ms (default: 24 hours) */
  maxTTL: number

  /** Minimum prompt length to cache (default: 50) */
  minPromptLength: number

  /** Cleanup interval in ms (default: 5 minutes) */
  cleanupInterval: number
}

const DEFAULT_CONFIG: PromptCacheConfig = {
  maxEntries: 1000,
  defaultTTL: 60 * 60 * 1000, // 1 hour
  maxTTL: 24 * 60 * 60 * 1000, // 24 hours
  minPromptLength: 50,
  cleanupInterval: 5 * 60 * 1000, // 5 minutes
}

/**
 * Prompt Cache
 *
 * Caches prompt/response pairs with LRU eviction.
 */
export class PromptCache {
  private cache: Map<string, PromptCacheEntry> = new Map()
  private config: PromptCacheConfig
  private cleanupTimer: NodeJS.Timeout | null = null
  private stats = {
    hits: 0,
    misses: 0,
    tokensSaved: { input: 0, output: 0 },
    costSaved: 0,
    evictions: 0,
  }

  constructor(config?: Partial<PromptCacheConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.startCleanup()
  }

  /**
   * Get a cached response for a prompt
   */
  get(prompt: string, model: string): PromptCacheEntry | undefined {
    const hash = this.hashPrompt(prompt, model)
    const entry = this.cache.get(hash)

    if (!entry) {
      this.stats.misses++
      return undefined
    }

    // Check expiry
    if (entry.expiresAt <= new Date()) {
      this.cache.delete(hash)
      this.stats.misses++
      return undefined
    }

    // Update access time and hit count
    entry.lastAccessedAt = new Date()
    entry.hitCount++

    // Update stats
    this.stats.hits++
    this.stats.tokensSaved.input += entry.tokenCount.input
    this.stats.tokensSaved.output += entry.tokenCount.output
    this.stats.costSaved += entry.estimatedCostPerHit

    return entry
  }

  /**
   * Cache a prompt/response pair
   */
  set(
    prompt: string,
    model: string,
    response: string,
    options?: {
      ttl?: number
      tokenCount?: { input: number; output: number }
      estimatedCost?: number
    }
  ): string {
    // Skip if prompt is too short
    if (prompt.length < this.config.minPromptLength) {
      return ''
    }

    const hash = this.hashPrompt(prompt, model)

    // Evict if at capacity
    if (this.cache.size >= this.config.maxEntries) {
      this.evictLRU()
    }

    const now = new Date()
    const ttl = Math.min(
      options?.ttl ?? this.config.defaultTTL,
      this.config.maxTTL
    )

    const entry: PromptCacheEntry = {
      promptHash: hash,
      model,
      response,
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttl),
      lastAccessedAt: now,
      hitCount: 0,
      tokenCount: options?.tokenCount ?? { input: 0, output: 0 },
      estimatedCostPerHit: options?.estimatedCost ?? 0,
    }

    this.cache.set(hash, entry)
    return hash
  }

  /**
   * Check if a prompt is cached (without updating stats)
   */
  has(prompt: string, model: string): boolean {
    const hash = this.hashPrompt(prompt, model)
    const entry = this.cache.get(hash)
    return entry !== undefined && entry.expiresAt > new Date()
  }

  /**
   * Invalidate a cached entry
   */
  invalidate(prompt: string, model: string): boolean {
    const hash = this.hashPrompt(prompt, model)
    return this.cache.delete(hash)
  }

  /**
   * Invalidate all entries for a model
   */
  invalidateModel(model: string): number {
    let count = 0
    for (const [hash, entry] of this.cache) {
      if (entry.model === model) {
        this.cache.delete(hash)
        count++
      }
    }
    return count
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getStats(): PromptCacheStats {
    const total = this.stats.hits + this.stats.misses
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      tokensSaved: { ...this.stats.tokensSaved },
      costSaved: this.stats.costSaved,
      evictions: this.stats.evictions,
    }
  }

  /**
   * Get top cached entries by hit count
   */
  getTopEntries(limit: number = 10): PromptCacheEntry[] {
    return Array.from(this.cache.values())
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, limit)
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    const now = new Date()
    let count = 0

    for (const [hash, entry] of this.cache) {
      if (entry.expiresAt <= now) {
        this.cache.delete(hash)
        count++
      }
    }

    return count
  }

  /**
   * Shutdown the cache
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  // Private methods

  private hashPrompt(prompt: string, model: string): string {
    // Normalize the prompt (trim, lowercase for hash)
    const normalized = `${model}:${prompt.trim().toLowerCase()}`
    return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
  }

  private evictLRU(): void {
    let oldest: { hash: string; time: Date } | null = null

    for (const [hash, entry] of this.cache) {
      if (!oldest || entry.lastAccessedAt < oldest.time) {
        oldest = { hash, time: entry.lastAccessedAt }
      }
    }

    if (oldest) {
      this.cache.delete(oldest.hash)
      this.stats.evictions++
    }
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, this.config.cleanupInterval)
  }
}

// Default singleton instance
let defaultCache: PromptCache | null = null

export function getPromptCache(config?: Partial<PromptCacheConfig>): PromptCache {
  if (!defaultCache) {
    defaultCache = new PromptCache(config)
  }
  return defaultCache
}
