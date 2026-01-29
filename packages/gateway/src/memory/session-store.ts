/**
 * Session Store
 *
 * In-memory session storage with optional file persistence.
 */

import { randomUUID } from 'crypto'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'

/**
 * Session data
 */
export interface Session {
  /** Unique session identifier */
  id: string

  /** User ID associated with this session */
  userId: string

  /** Device ID if applicable */
  deviceId?: string

  /** When the session was created */
  createdAt: Date

  /** Last activity timestamp */
  lastActivityAt: Date

  /** When the session expires */
  expiresAt: Date

  /** Accumulated cost for this session */
  costAccumulator: number

  /** Token usage for this session */
  tokenUsage: {
    input: number
    output: number
  }

  /** Request count for this session */
  requestCount: number

  /** Session metadata */
  metadata?: Record<string, unknown>

  /** Whether the session is active */
  isActive: boolean
}

/**
 * Session store configuration
 */
export interface SessionStoreConfig {
  /** Default session lifetime in ms (default: 24 hours) */
  defaultTTL: number

  /** Maximum sessions per user (default: 10) */
  maxSessionsPerUser: number

  /** Whether to persist to disk (default: false) */
  persist: boolean

  /** Persistence path */
  persistPath?: string

  /** Auto-save interval in ms (default: 60000) */
  autoSaveInterval: number
}

const DEFAULT_CONFIG: SessionStoreConfig = {
  defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
  maxSessionsPerUser: 10,
  persist: false,
  autoSaveInterval: 60000, // 1 minute
}

/**
 * Session Store
 *
 * Manages user sessions with automatic expiry and cleanup.
 */
export class SessionStore {
  private sessions: Map<string, Session> = new Map()
  private userSessions: Map<string, Set<string>> = new Map() // userId -> sessionIds
  private config: SessionStoreConfig
  private saveInterval: NodeJS.Timeout | null = null

  constructor(config?: Partial<SessionStoreConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }

    if (this.config.persist) {
      this.load().catch(console.error)
      this.startAutoSave()
    }
  }

  /**
   * Create a new session
   */
  create(params: {
    userId: string
    deviceId?: string
    ttl?: number
    metadata?: Record<string, unknown>
  }): Session {
    // Check max sessions per user
    const userSessionSet = this.userSessions.get(params.userId)
    if (userSessionSet && userSessionSet.size >= this.config.maxSessionsPerUser) {
      // Remove oldest session
      const oldestId = this.findOldestSession(params.userId)
      if (oldestId) {
        this.delete(oldestId)
      }
    }

    const now = new Date()
    const ttl = params.ttl ?? this.config.defaultTTL

    const session: Session = {
      id: randomUUID(),
      userId: params.userId,
      deviceId: params.deviceId,
      createdAt: now,
      lastActivityAt: now,
      expiresAt: new Date(now.getTime() + ttl),
      costAccumulator: 0,
      tokenUsage: { input: 0, output: 0 },
      requestCount: 0,
      metadata: params.metadata,
      isActive: true,
    }

    this.sessions.set(session.id, session)

    // Update user sessions index
    if (!this.userSessions.has(params.userId)) {
      this.userSessions.set(params.userId, new Set())
    }
    this.userSessions.get(params.userId)!.add(session.id)

    return session
  }

  /**
   * Get a session by ID
   */
  get(id: string): Session | undefined {
    const session = this.sessions.get(id)
    if (!session) return undefined

    // Check if expired
    if (session.expiresAt <= new Date()) {
      this.delete(id)
      return undefined
    }

    return session
  }

  /**
   * Get all sessions for a user
   */
  getByUser(userId: string): Session[] {
    const sessionIds = this.userSessions.get(userId)
    if (!sessionIds) return []

    const sessions: Session[] = []
    for (const id of sessionIds) {
      const session = this.get(id)
      if (session) {
        sessions.push(session)
      }
    }

    return sessions
  }

  /**
   * Update session activity
   */
  touch(id: string): boolean {
    const session = this.sessions.get(id)
    if (!session || !session.isActive) return false

    session.lastActivityAt = new Date()
    return true
  }

  /**
   * Extend session expiry
   */
  extend(id: string, additionalMs?: number): boolean {
    const session = this.sessions.get(id)
    if (!session) return false

    const extension = additionalMs ?? this.config.defaultTTL
    session.expiresAt = new Date(session.expiresAt.getTime() + extension)
    return true
  }

  /**
   * Update session usage
   */
  updateUsage(
    id: string,
    usage: {
      cost?: number
      inputTokens?: number
      outputTokens?: number
    }
  ): boolean {
    const session = this.sessions.get(id)
    if (!session) return false

    if (usage.cost) session.costAccumulator += usage.cost
    if (usage.inputTokens) session.tokenUsage.input += usage.inputTokens
    if (usage.outputTokens) session.tokenUsage.output += usage.outputTokens
    session.requestCount++
    session.lastActivityAt = new Date()

    return true
  }

  /**
   * Invalidate a session
   */
  invalidate(id: string): boolean {
    const session = this.sessions.get(id)
    if (!session) return false

    session.isActive = false
    return true
  }

  /**
   * Delete a session
   */
  delete(id: string): boolean {
    const session = this.sessions.get(id)
    if (!session) return false

    // Remove from user index
    const userSessionSet = this.userSessions.get(session.userId)
    if (userSessionSet) {
      userSessionSet.delete(id)
      if (userSessionSet.size === 0) {
        this.userSessions.delete(session.userId)
      }
    }

    return this.sessions.delete(id)
  }

  /**
   * Delete all sessions for a user
   */
  deleteByUser(userId: string): number {
    const sessionIds = this.userSessions.get(userId)
    if (!sessionIds) return 0

    let count = 0
    for (const id of sessionIds) {
      if (this.sessions.delete(id)) {
        count++
      }
    }

    this.userSessions.delete(userId)
    return count
  }

  /**
   * Get active session count
   */
  getActiveCount(): number {
    return Array.from(this.sessions.values()).filter(
      (s) => s.isActive && s.expiresAt > new Date()
    ).length
  }

  /**
   * Get total session count
   */
  getTotalCount(): number {
    return this.sessions.size
  }

  /**
   * Clean up expired sessions
   */
  cleanup(): number {
    const now = new Date()
    let count = 0

    for (const [id, session] of this.sessions) {
      if (session.expiresAt <= now) {
        this.delete(id)
        count++
      }
    }

    return count
  }

  /**
   * Get session statistics
   */
  getStats(): {
    total: number
    active: number
    expired: number
    totalCost: number
    totalTokens: { input: number; output: number }
    userCount: number
  } {
    const now = new Date()
    let active = 0
    let expired = 0
    let totalCost = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0

    for (const session of this.sessions.values()) {
      if (session.expiresAt <= now) {
        expired++
      } else if (session.isActive) {
        active++
      }
      totalCost += session.costAccumulator
      totalInputTokens += session.tokenUsage.input
      totalOutputTokens += session.tokenUsage.output
    }

    return {
      total: this.sessions.size,
      active,
      expired,
      totalCost,
      totalTokens: { input: totalInputTokens, output: totalOutputTokens },
      userCount: this.userSessions.size,
    }
  }

  /**
   * Shutdown the store
   */
  async shutdown(): Promise<void> {
    if (this.saveInterval) {
      clearInterval(this.saveInterval)
      this.saveInterval = null
    }

    if (this.config.persist) {
      await this.save()
    }
  }

  // Private methods

  private findOldestSession(userId: string): string | undefined {
    const sessionIds = this.userSessions.get(userId)
    if (!sessionIds) return undefined

    let oldest: Session | undefined
    for (const id of sessionIds) {
      const session = this.sessions.get(id)
      if (session && (!oldest || session.createdAt < oldest.createdAt)) {
        oldest = session
      }
    }

    return oldest?.id
  }

  private getStoragePath(): string {
    return this.config.persistPath ?? join(homedir(), '.atlas', 'sessions.json')
  }

  private async save(): Promise<void> {
    if (!this.config.persist) return

    const path = this.getStoragePath()
    const dir = dirname(path)

    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }

    const data = {
      sessions: Array.from(this.sessions.entries()),
      userSessions: Array.from(this.userSessions.entries()).map(([k, v]) => [
        k,
        Array.from(v),
      ]),
      savedAt: new Date().toISOString(),
    }

    await writeFile(path, JSON.stringify(data, null, 2), 'utf-8')
  }

  private async load(): Promise<void> {
    if (!this.config.persist) return

    const path = this.getStoragePath()
    if (!existsSync(path)) return

    try {
      const content = await readFile(path, 'utf-8')
      const data = JSON.parse(content)

      // Restore sessions
      this.sessions.clear()
      for (const [id, session] of data.sessions) {
        this.sessions.set(id, {
          ...session,
          createdAt: new Date(session.createdAt),
          lastActivityAt: new Date(session.lastActivityAt),
          expiresAt: new Date(session.expiresAt),
        })
      }

      // Restore user sessions index
      this.userSessions.clear()
      for (const [userId, sessionIds] of data.userSessions) {
        this.userSessions.set(userId, new Set(sessionIds))
      }

      // Cleanup expired sessions
      this.cleanup()
    } catch (error) {
      console.error('Failed to load sessions:', error)
    }
  }

  private startAutoSave(): void {
    this.saveInterval = setInterval(() => {
      this.save().catch(console.error)
    }, this.config.autoSaveInterval)
  }
}

// Default singleton instance
let defaultStore: SessionStore | null = null

export function getSessionStore(config?: Partial<SessionStoreConfig>): SessionStore {
  if (!defaultStore) {
    defaultStore = new SessionStore(config)
  }
  return defaultStore
}
