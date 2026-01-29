/**
 * GC Scheduler
 *
 * Coordinates garbage collection and cleanup across services.
 */

import { EventEmitter } from 'events'
import { getSessionStore } from './session-store'
import { getDeduplicationService } from './deduplication-service'
import { getMemoryMonitor } from './memory-monitor'
import { getApprovalQueue } from '../workflows/approval-queue'

/**
 * Cleanup result
 */
export interface CleanupResult {
  /** Sessions cleaned up */
  sessions: number

  /** Cache entries cleaned up */
  cacheEntries: number

  /** Approvals cleaned up */
  approvals: number

  /** Memory freed (estimated, bytes) */
  memoryFreed: number

  /** Duration of cleanup in ms */
  durationMs: number

  /** When cleanup ran */
  timestamp: Date
}

/**
 * Scheduler configuration
 */
export interface GCSchedulerConfig {
  /** Cleanup interval in ms (default: 5 minutes) */
  cleanupInterval: number

  /** Memory threshold to trigger cleanup (0-1, default: 0.6) */
  memoryCleanupThreshold: number

  /** Whether to log cleanup results (default: true) */
  logResults: boolean

  /** Maximum cleanup history entries (default: 100) */
  maxHistoryEntries: number
}

const DEFAULT_CONFIG: GCSchedulerConfig = {
  cleanupInterval: 5 * 60 * 1000, // 5 minutes
  memoryCleanupThreshold: 0.6,
  logResults: true,
  maxHistoryEntries: 100,
}

/**
 * GC Scheduler
 *
 * Coordinates cleanup across all memory-holding services.
 */
export class GCScheduler extends EventEmitter {
  private config: GCSchedulerConfig
  private timer: NodeJS.Timeout | null = null
  private history: CleanupResult[] = []
  private isRunning: boolean = false

  constructor(config?: Partial<GCSchedulerConfig>) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.timer) return

    // Run immediately on start
    this.runCleanup()

    // Schedule periodic cleanup
    this.timer = setInterval(() => {
      this.runCleanup()
    }, this.config.cleanupInterval)

    // Also trigger cleanup on memory warnings
    const memoryMonitor = getMemoryMonitor()
    memoryMonitor.on('alert', (alert) => {
      if (alert.level === 'critical') {
        this.runCleanup(true)
      }
    })
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /**
   * Run cleanup across all services
   */
  async runCleanup(emergency: boolean = false): Promise<CleanupResult> {
    if (this.isRunning) {
      return this.history[0] ?? this.emptyResult()
    }

    this.isRunning = true
    const startTime = Date.now()
    const startMemory = process.memoryUsage().heapUsed

    let sessions = 0
    let cacheEntries = 0
    let approvals = 0

    try {
      // Cleanup sessions
      try {
        const sessionStore = getSessionStore()
        sessions = sessionStore.cleanup()
      } catch {
        // Session store might not be initialized
      }

      // Cleanup deduplication cache
      try {
        const dedupService = getDeduplicationService()
        cacheEntries = dedupService.cleanup()
      } catch {
        // Dedup service might not be initialized
      }

      // Cleanup approvals
      try {
        const approvalQueue = getApprovalQueue()
        const result = approvalQueue.cleanup()
        approvals = result.expiredRequests + result.deletedAuditEntries
      } catch {
        // Approval queue might not be initialized
      }

      // Force GC if available and this is an emergency
      if (emergency && global.gc) {
        global.gc()
      }
    } finally {
      this.isRunning = false
    }

    const endTime = Date.now()
    const endMemory = process.memoryUsage().heapUsed
    const memoryFreed = Math.max(0, startMemory - endMemory)

    const result: CleanupResult = {
      sessions,
      cacheEntries,
      approvals,
      memoryFreed,
      durationMs: endTime - startTime,
      timestamp: new Date(),
    }

    // Store in history
    this.history.unshift(result)
    if (this.history.length > this.config.maxHistoryEntries) {
      this.history.pop()
    }

    // Log if configured
    if (this.config.logResults && (sessions > 0 || cacheEntries > 0 || approvals > 0)) {
      console.log(
        `[GC] Cleanup: ${sessions} sessions, ${cacheEntries} cache entries, ` +
        `${approvals} approvals, ${this.formatBytes(memoryFreed)} freed in ${result.durationMs}ms`
      )
    }

    this.emit('cleanup', result)
    return result
  }

  /**
   * Get cleanup history
   */
  getHistory(): CleanupResult[] {
    return [...this.history]
  }

  /**
   * Get aggregate statistics
   */
  getStats(): {
    totalCleanups: number
    totalSessionsCleaned: number
    totalCacheEntriesCleaned: number
    totalApprovalsCleaned: number
    totalMemoryFreed: number
    averageDurationMs: number
    lastCleanup: Date | null
  } {
    if (this.history.length === 0) {
      return {
        totalCleanups: 0,
        totalSessionsCleaned: 0,
        totalCacheEntriesCleaned: 0,
        totalApprovalsCleaned: 0,
        totalMemoryFreed: 0,
        averageDurationMs: 0,
        lastCleanup: null,
      }
    }

    const totals = this.history.reduce(
      (acc, r) => ({
        sessions: acc.sessions + r.sessions,
        cache: acc.cache + r.cacheEntries,
        approvals: acc.approvals + r.approvals,
        memory: acc.memory + r.memoryFreed,
        duration: acc.duration + r.durationMs,
      }),
      { sessions: 0, cache: 0, approvals: 0, memory: 0, duration: 0 }
    )

    return {
      totalCleanups: this.history.length,
      totalSessionsCleaned: totals.sessions,
      totalCacheEntriesCleaned: totals.cache,
      totalApprovalsCleaned: totals.approvals,
      totalMemoryFreed: totals.memory,
      averageDurationMs: totals.duration / this.history.length,
      lastCleanup: this.history[0]?.timestamp ?? null,
    }
  }

  // Private methods

  private emptyResult(): CleanupResult {
    return {
      sessions: 0,
      cacheEntries: 0,
      approvals: 0,
      memoryFreed: 0,
      durationMs: 0,
      timestamp: new Date(),
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
}

// Default singleton instance
let defaultScheduler: GCScheduler | null = null

export function getGCScheduler(config?: Partial<GCSchedulerConfig>): GCScheduler {
  if (!defaultScheduler) {
    defaultScheduler = new GCScheduler(config)
  }
  return defaultScheduler
}

/**
 * Start the GC scheduler
 */
export function startGCScheduler(config?: Partial<GCSchedulerConfig>): GCScheduler {
  const scheduler = getGCScheduler(config)
  scheduler.start()
  return scheduler
}
