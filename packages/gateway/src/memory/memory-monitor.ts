/**
 * Memory Monitor
 *
 * Monitors memory usage and triggers alerts/cleanup when thresholds are exceeded.
 */

import { EventEmitter } from 'events'

/**
 * Memory statistics
 */
export interface MemoryStats {
  /** Heap memory used in bytes */
  heapUsed: number

  /** Total heap size in bytes */
  heapTotal: number

  /** Heap utilization (0-1) */
  utilization: number

  /** RSS (Resident Set Size) in bytes */
  rss: number

  /** External memory in bytes */
  external: number

  /** Array buffers in bytes */
  arrayBuffers: number
}

/**
 * Memory alert
 */
export interface MemoryAlert {
  level: 'warning' | 'critical'
  utilization: number
  heapUsed: number
  heapTotal: number
  message: string
  timestamp: Date
}

/**
 * Monitor configuration
 */
export interface MemoryMonitorConfig {
  /** Warning threshold (0-1, default: 0.7) */
  warningThreshold: number

  /** Critical threshold (0-1, default: 0.85) */
  criticalThreshold: number

  /** Check interval in ms (default: 30000) */
  checkInterval: number

  /** Whether to force GC on critical (default: false) */
  forceGCOnCritical: boolean

  /** Alert cooldown in ms (default: 60000) */
  alertCooldown: number
}

const DEFAULT_CONFIG: MemoryMonitorConfig = {
  warningThreshold: 0.7,
  criticalThreshold: 0.85,
  checkInterval: 30000, // 30 seconds
  forceGCOnCritical: false,
  alertCooldown: 60000, // 1 minute
}

/**
 * Memory Monitor Events
 */
export interface MemoryMonitorEvents {
  'alert': MemoryAlert
  'recovery': MemoryStats
  'stats': MemoryStats
}

/**
 * Memory Monitor
 *
 * Monitors Node.js memory usage and emits alerts.
 */
export class MemoryMonitor extends EventEmitter {
  private config: MemoryMonitorConfig
  private checkTimer: NodeJS.Timeout | null = null
  private lastAlert: Date | null = null
  private alertHistory: MemoryAlert[] = []
  private isInAlertState: boolean = false

  constructor(config?: Partial<MemoryMonitorConfig>) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Start monitoring
   */
  start(): void {
    if (this.checkTimer) return

    this.checkTimer = setInterval(() => {
      this.check()
    }, this.config.checkInterval)

    // Initial check
    this.check()
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = null
    }
  }

  /**
   * Get current memory stats
   */
  getStats(): MemoryStats {
    const usage = process.memoryUsage()
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      utilization: usage.heapUsed / usage.heapTotal,
      rss: usage.rss,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers,
    }
  }

  /**
   * Get formatted memory stats
   */
  getFormattedStats(): Record<string, string> {
    const stats = this.getStats()
    const formatBytes = (bytes: number) => {
      const mb = bytes / (1024 * 1024)
      return `${mb.toFixed(2)} MB`
    }

    return {
      heapUsed: formatBytes(stats.heapUsed),
      heapTotal: formatBytes(stats.heapTotal),
      utilization: `${(stats.utilization * 100).toFixed(1)}%`,
      rss: formatBytes(stats.rss),
      external: formatBytes(stats.external),
      arrayBuffers: formatBytes(stats.arrayBuffers),
    }
  }

  /**
   * Get alert history
   */
  getAlertHistory(): MemoryAlert[] {
    return [...this.alertHistory]
  }

  /**
   * Check memory and emit alerts if needed
   */
  check(): MemoryStats {
    const stats = this.getStats()
    this.emit('stats', stats)

    const now = new Date()

    // Check if we should alert
    const canAlert = !this.lastAlert ||
      now.getTime() - this.lastAlert.getTime() > this.config.alertCooldown

    if (stats.utilization >= this.config.criticalThreshold) {
      if (canAlert) {
        this.emitAlert('critical', stats)
      }

      // Try to force GC if available and configured
      if (this.config.forceGCOnCritical && global.gc) {
        global.gc()
      }
    } else if (stats.utilization >= this.config.warningThreshold) {
      if (canAlert) {
        this.emitAlert('warning', stats)
      }
    } else if (this.isInAlertState) {
      // Recovered from alert state
      this.isInAlertState = false
      this.emit('recovery', stats)
    }

    return stats
  }

  /**
   * Get memory utilization level
   */
  getUtilizationLevel(): 'normal' | 'warning' | 'critical' {
    const stats = this.getStats()

    if (stats.utilization >= this.config.criticalThreshold) {
      return 'critical'
    }
    if (stats.utilization >= this.config.warningThreshold) {
      return 'warning'
    }
    return 'normal'
  }

  /**
   * Suggest cleanup actions based on current memory state
   */
  suggestActions(): string[] {
    const stats = this.getStats()
    const actions: string[] = []

    if (stats.utilization >= this.config.warningThreshold) {
      actions.push('Consider clearing caches')
      actions.push('Review session store for stale entries')
      actions.push('Check for memory leaks in event listeners')
    }

    if (stats.utilization >= this.config.criticalThreshold) {
      actions.push('Immediately clear non-essential caches')
      actions.push('Invalidate idle sessions')
      actions.push('Consider restarting the service')
    }

    return actions
  }

  // Private methods

  private emitAlert(level: 'warning' | 'critical', stats: MemoryStats): void {
    const alert: MemoryAlert = {
      level,
      utilization: stats.utilization,
      heapUsed: stats.heapUsed,
      heapTotal: stats.heapTotal,
      message: level === 'critical'
        ? `CRITICAL: Memory usage at ${(stats.utilization * 100).toFixed(1)}%`
        : `WARNING: Memory usage at ${(stats.utilization * 100).toFixed(1)}%`,
      timestamp: new Date(),
    }

    this.alertHistory.push(alert)
    this.lastAlert = alert.timestamp
    this.isInAlertState = true

    // Keep only last 100 alerts
    if (this.alertHistory.length > 100) {
      this.alertHistory.shift()
    }

    this.emit('alert', alert)
  }
}

// Default singleton instance
let defaultMonitor: MemoryMonitor | null = null

export function getMemoryMonitor(config?: Partial<MemoryMonitorConfig>): MemoryMonitor {
  if (!defaultMonitor) {
    defaultMonitor = new MemoryMonitor(config)
  }
  return defaultMonitor
}

/**
 * Start the memory monitor
 */
export function startMemoryMonitor(config?: Partial<MemoryMonitorConfig>): MemoryMonitor {
  const monitor = getMemoryMonitor(config)
  monitor.start()
  return monitor
}
