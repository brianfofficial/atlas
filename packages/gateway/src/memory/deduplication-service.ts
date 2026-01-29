/**
 * Request Deduplication Service
 *
 * Prevents duplicate requests from being processed multiple times.
 * Uses hash-based detection with TTL-based cache.
 */

import { createHash } from 'crypto'

/**
 * Cached response
 */
export interface CachedResponse<T = unknown> {
  /** Hash of the original request */
  requestHash: string

  /** The cached response */
  response: T

  /** When the cache entry was created */
  createdAt: Date

  /** When the cache entry expires */
  expiresAt: Date

  /** Number of times this cache entry was returned */
  hitCount: number
}

/**
 * Deduplication result
 */
export interface DeduplicationResult<T = unknown> {
  /** Whether this is a duplicate request */
  isDuplicate: boolean

  /** Original request ID if duplicate */
  originalRequestId?: string

  /** Cached response if duplicate */
  cachedResponse?: T
}

/**
 * Service configuration
 */
export interface DeduplicationConfig {
  /** Default TTL for cache entries in ms (default: 30 seconds) */
  defaultTTL: number

  /** Maximum cache entries (default: 1000) */
  maxEntries: number

  /** Cleanup interval in ms (default: 60 seconds) */
  cleanupInterval: number

  /** Whether to include timestamp in hash (default: false) */
  includeTimestamp: boolean

  /** Timestamp window for dedup in ms (default: 0 - disabled) */
  timestampWindow: number
}

const DEFAULT_CONFIG: DeduplicationConfig = {
  defaultTTL: 30 * 1000, // 30 seconds
  maxEntries: 1000,
  cleanupInterval: 60 * 1000, // 1 minute
  includeTimestamp: false,
  timestampWindow: 0,
}

/**
 * Deduplication Service
 *
 * Detects and caches duplicate requests to prevent
 * unnecessary processing and API calls.
 */
export class DeduplicationService {
  private cache: Map<string, CachedResponse> = new Map()
  private config: DeduplicationConfig
  private cleanupTimer: NodeJS.Timeout | null = null
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  }

  constructor(config?: Partial<DeduplicationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.startCleanup()
  }

  /**
   * Check if a request is a duplicate
   */
  check<T>(
    request: unknown,
    options?: {
      sessionId?: string
      ttl?: number
    }
  ): DeduplicationResult<T> {
    const hash = this.hashRequest(request, options?.sessionId)
    const cached = this.cache.get(hash)

    if (cached && cached.expiresAt > new Date()) {
      cached.hitCount++
      this.stats.hits++

      return {
        isDuplicate: true,
        originalRequestId: hash,
        cachedResponse: cached.response as T,
      }
    }

    this.stats.misses++
    return { isDuplicate: false }
  }

  /**
   * Cache a response for a request
   */
  cacheResponse<T>(
    request: unknown,
    response: T,
    options?: {
      sessionId?: string
      ttl?: number
    }
  ): string {
    const hash = this.hashRequest(request, options?.sessionId)
    const ttl = options?.ttl ?? this.config.defaultTTL
    const now = new Date()

    // Evict if at capacity
    if (this.cache.size >= this.config.maxEntries) {
      this.evictOldest()
    }

    this.cache.set(hash, {
      requestHash: hash,
      response,
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttl),
      hitCount: 0,
    })

    return hash
  }

  /**
   * Check and cache in one operation
   * Returns cached response if duplicate, otherwise caches new response
   */
  dedupe<T>(
    request: unknown,
    response: T,
    options?: {
      sessionId?: string
      ttl?: number
    }
  ): { isDuplicate: boolean; response: T } {
    const result = this.check<T>(request, options)

    if (result.isDuplicate && result.cachedResponse !== undefined) {
      return { isDuplicate: true, response: result.cachedResponse }
    }

    this.cacheResponse(request, response, options)
    return { isDuplicate: false, response }
  }

  /**
   * Invalidate a cached response
   */
  invalidate(requestOrHash: unknown, sessionId?: string): boolean {
    const hash = typeof requestOrHash === 'string'
      ? requestOrHash
      : this.hashRequest(requestOrHash, sessionId)
    return this.cache.delete(hash)
  }

  /**
   * Invalidate all entries for a session
   */
  invalidateSession(sessionId: string): number {
    let count = 0
    for (const [hash, entry] of this.cache) {
      // Check if hash contains session ID
      if (hash.includes(sessionId)) {
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
  getStats(): {
    size: number
    hits: number
    misses: number
    hitRate: number
    evictions: number
  } {
    const total = this.stats.hits + this.stats.misses
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      evictions: this.stats.evictions,
    }
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
   * Shutdown the service
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  // Private methods

  private hashRequest(request: unknown, sessionId?: string): string {
    let data: unknown = request

    // If timestamp window is enabled, round timestamp
    if (this.config.includeTimestamp && this.config.timestampWindow > 0) {
      const windowedTime = Math.floor(Date.now() / this.config.timestampWindow)
      data = { ...data as object, _time: windowedTime }
    }

    // Include session ID if provided
    if (sessionId) {
      data = { ...data as object, _session: sessionId }
    }

    const json = JSON.stringify(data, Object.keys(data as object).sort())
    return createHash('sha256').update(json).digest('hex').slice(0, 16)
  }

  private evictOldest(): void {
    let oldest: { hash: string; time: Date } | null = null

    for (const [hash, entry] of this.cache) {
      if (!oldest || entry.createdAt < oldest.time) {
        oldest = { hash, time: entry.createdAt }
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
let defaultService: DeduplicationService | null = null

export function getDeduplicationService(config?: Partial<DeduplicationConfig>): DeduplicationService {
  if (!defaultService) {
    defaultService = new DeduplicationService(config)
  }
  return defaultService
}
