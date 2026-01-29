/**
 * Session Manager
 *
 * High-level session lifecycle management with authentication integration.
 */

import { EventEmitter } from 'events'
import { SessionStore, Session, getSessionStore, SessionStoreConfig } from './session-store'

/**
 * Session events
 */
export interface SessionEvents {
  'session:created': Session
  'session:expired': Session
  'session:invalidated': Session
  'session:activity': Session
}

/**
 * Session creation options
 */
export interface CreateSessionOptions {
  userId: string
  deviceId?: string
  ttl?: number
  metadata?: Record<string, unknown>
}

/**
 * Session manager configuration
 */
export interface SessionManagerConfig extends SessionStoreConfig {
  /** Idle timeout in ms (default: 15 minutes) */
  idleTimeout: number

  /** Whether to extend session on activity (default: true) */
  extendOnActivity: boolean

  /** Activity extension amount in ms (default: 15 minutes) */
  activityExtension: number

  /** Cost limit per session (default: no limit) */
  costLimitPerSession?: number

  /** Token limit per session (default: no limit) */
  tokenLimitPerSession?: number
}

const DEFAULT_MANAGER_CONFIG: SessionManagerConfig = {
  defaultTTL: 24 * 60 * 60 * 1000,
  maxSessionsPerUser: 10,
  persist: true,
  autoSaveInterval: 60000,
  idleTimeout: 15 * 60 * 1000, // 15 minutes
  extendOnActivity: true,
  activityExtension: 15 * 60 * 1000, // 15 minutes
}

/**
 * Session Manager
 *
 * Manages session lifecycle with automatic expiry,
 * idle detection, and cost tracking.
 */
export class SessionManager extends EventEmitter {
  private store: SessionStore
  private config: SessionManagerConfig
  private idleCheckInterval: NodeJS.Timeout | null = null

  constructor(config?: Partial<SessionManagerConfig>) {
    super()
    this.config = { ...DEFAULT_MANAGER_CONFIG, ...config }
    this.store = getSessionStore(this.config)
    this.startIdleCheck()
  }

  /**
   * Create a new session
   */
  createSession(options: CreateSessionOptions): Session {
    const session = this.store.create({
      userId: options.userId,
      deviceId: options.deviceId,
      ttl: options.ttl ?? this.config.defaultTTL,
      metadata: options.metadata,
    })

    this.emit('session:created', session)
    return session
  }

  /**
   * Get a session by ID
   */
  getSession(id: string): Session | undefined {
    return this.store.get(id)
  }

  /**
   * Get sessions for a user
   */
  getUserSessions(userId: string): Session[] {
    return this.store.getByUser(userId)
  }

  /**
   * Validate a session (check if active and not expired)
   */
  validateSession(id: string): boolean {
    const session = this.store.get(id)
    if (!session || !session.isActive) return false

    // Check cost limit
    if (
      this.config.costLimitPerSession !== undefined &&
      session.costAccumulator >= this.config.costLimitPerSession
    ) {
      this.invalidateSession(id, 'Cost limit exceeded')
      return false
    }

    // Check token limit
    if (
      this.config.tokenLimitPerSession !== undefined &&
      session.tokenUsage.input + session.tokenUsage.output >= this.config.tokenLimitPerSession
    ) {
      this.invalidateSession(id, 'Token limit exceeded')
      return false
    }

    return true
  }

  /**
   * Record session activity
   */
  recordActivity(
    id: string,
    usage?: {
      cost?: number
      inputTokens?: number
      outputTokens?: number
    }
  ): boolean {
    const session = this.store.get(id)
    if (!session) return false

    // Touch the session
    this.store.touch(id)

    // Update usage if provided
    if (usage) {
      this.store.updateUsage(id, usage)
    }

    // Extend session if configured
    if (this.config.extendOnActivity) {
      this.store.extend(id, this.config.activityExtension)
    }

    this.emit('session:activity', session)
    return true
  }

  /**
   * Invalidate a session
   */
  invalidateSession(id: string, reason?: string): boolean {
    const session = this.store.get(id)
    if (!session) return false

    this.store.invalidate(id)

    if (reason) {
      session.metadata = {
        ...session.metadata,
        invalidationReason: reason,
        invalidatedAt: new Date().toISOString(),
      }
    }

    this.emit('session:invalidated', session)
    return true
  }

  /**
   * Delete a session
   */
  deleteSession(id: string): boolean {
    return this.store.delete(id)
  }

  /**
   * Invalidate all sessions for a user
   */
  invalidateUserSessions(userId: string, reason?: string): number {
    const sessions = this.store.getByUser(userId)
    let count = 0

    for (const session of sessions) {
      if (this.invalidateSession(session.id, reason)) {
        count++
      }
    }

    return count
  }

  /**
   * Get session statistics
   */
  getStats(): ReturnType<SessionStore['getStats']> & {
    idleSessions: number
    costLimited: number
  } {
    const baseStats = this.store.getStats()
    const now = Date.now()
    let idleSessions = 0
    let costLimited = 0

    for (const session of this.store.getByUser('*')) {
      // Check idle
      if (now - session.lastActivityAt.getTime() > this.config.idleTimeout) {
        idleSessions++
      }

      // Check cost limited
      if (
        this.config.costLimitPerSession !== undefined &&
        session.costAccumulator >= this.config.costLimitPerSession
      ) {
        costLimited++
      }
    }

    return {
      ...baseStats,
      idleSessions,
      costLimited,
    }
  }

  /**
   * Cleanup expired and idle sessions
   */
  cleanup(): { expired: number; idle: number } {
    const expiredCount = this.store.cleanup()
    let idleCount = 0

    // Check for idle sessions
    const now = Date.now()
    for (const [id, session] of this.getAllSessions()) {
      if (
        session.isActive &&
        now - session.lastActivityAt.getTime() > this.config.idleTimeout
      ) {
        this.invalidateSession(id, 'Idle timeout')
        idleCount++
      }
    }

    return { expired: expiredCount, idle: idleCount }
  }

  /**
   * Shutdown the manager
   */
  async shutdown(): Promise<void> {
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval)
      this.idleCheckInterval = null
    }

    await this.store.shutdown()
  }

  // Private methods

  private *getAllSessions(): Generator<[string, Session]> {
    // This is a bit of a hack since SessionStore doesn't expose all sessions
    // In production, you'd add a method to SessionStore
    const stats = this.store.getStats()
    // Just return empty for now
    return
  }

  private startIdleCheck(): void {
    // Check for idle sessions every minute
    this.idleCheckInterval = setInterval(() => {
      this.cleanup()
    }, 60 * 1000)
  }
}

// Default singleton instance
let defaultManager: SessionManager | null = null

export function getSessionManager(config?: Partial<SessionManagerConfig>): SessionManager {
  if (!defaultManager) {
    defaultManager = new SessionManager(config)
  }
  return defaultManager
}
