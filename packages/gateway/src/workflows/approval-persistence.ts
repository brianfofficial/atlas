/**
 * Approval Persistence
 *
 * Handles saving and loading approval state to disk.
 * Uses JSON file storage for simplicity and portability.
 */

import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'
import {
  ApprovalRequest,
  ApprovalAuditEntry,
  AutoApproveRule,
  ApprovalConfig,
} from './approval-types'

/**
 * State to persist
 */
export interface ApprovalPersistedState {
  requests: ApprovalRequest[]
  auditTrail: ApprovalAuditEntry[]
  autoApproveRules: AutoApproveRule[]
  config: ApprovalConfig
  version: number
  savedAt: string
}

const CURRENT_VERSION = 1

/**
 * Default storage path
 */
function getDefaultStoragePath(): string {
  return join(homedir(), '.atlas', 'approvals.json')
}

/**
 * Approval Persistence
 *
 * Saves and loads approval state to a JSON file.
 */
export class ApprovalPersistence {
  private storagePath: string
  private saving: boolean = false
  private saveQueue: ApprovalPersistedState | null = null

  constructor(storagePath?: string) {
    this.storagePath = storagePath ?? getDefaultStoragePath()
  }

  /**
   * Save state to disk
   */
  async save(state: Omit<ApprovalPersistedState, 'version' | 'savedAt'>): Promise<void> {
    const fullState: ApprovalPersistedState = {
      ...state,
      version: CURRENT_VERSION,
      savedAt: new Date().toISOString(),
    }

    // If already saving, queue this save
    if (this.saving) {
      this.saveQueue = fullState
      return
    }

    this.saving = true

    try {
      // Ensure directory exists
      const dir = dirname(this.storagePath)
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true })
      }

      // Write atomically (write to temp, then rename)
      const tempPath = `${this.storagePath}.tmp`
      await writeFile(tempPath, JSON.stringify(fullState, null, 2), 'utf-8')

      // On Windows, need to remove existing file first
      if (existsSync(this.storagePath)) {
        const { unlink, rename } = await import('fs/promises')
        await unlink(this.storagePath).catch(() => {})
        await rename(tempPath, this.storagePath)
      } else {
        const { rename } = await import('fs/promises')
        await rename(tempPath, this.storagePath)
      }
    } finally {
      this.saving = false

      // Process queued save
      if (this.saveQueue) {
        const queued = this.saveQueue
        this.saveQueue = null
        await this.save(queued)
      }
    }
  }

  /**
   * Load state from disk
   */
  async load(): Promise<ApprovalPersistedState | null> {
    try {
      if (!existsSync(this.storagePath)) {
        return null
      }

      const content = await readFile(this.storagePath, 'utf-8')
      const state = JSON.parse(content) as ApprovalPersistedState

      // Migrate if needed
      if (state.version !== CURRENT_VERSION) {
        return this.migrate(state)
      }

      return state
    } catch (error) {
      console.error('Failed to load approval state:', error)
      return null
    }
  }

  /**
   * Check if persisted state exists
   */
  exists(): boolean {
    return existsSync(this.storagePath)
  }

  /**
   * Clear persisted state
   */
  async clear(): Promise<void> {
    if (existsSync(this.storagePath)) {
      const { unlink } = await import('fs/promises')
      await unlink(this.storagePath)
    }
  }

  /**
   * Get the storage path
   */
  getStoragePath(): string {
    return this.storagePath
  }

  /**
   * Migrate old versions to current
   */
  private migrate(state: ApprovalPersistedState): ApprovalPersistedState {
    // For now, just update version number
    // In the future, add migration logic here
    return {
      ...state,
      version: CURRENT_VERSION,
    }
  }
}

// Default singleton instance
let defaultPersistence: ApprovalPersistence | null = null

export function getApprovalPersistence(storagePath?: string): ApprovalPersistence {
  if (!defaultPersistence) {
    defaultPersistence = new ApprovalPersistence(storagePath)
  }
  return defaultPersistence
}
