/**
 * Memory API functions
 *
 * Handles memory store operations - storing, retrieving, and managing
 * AI memory entries that persist across sessions.
 */

import { apiGet, apiPost, apiDelete } from './client'

/**
 * Memory entry types
 */
export type MemoryType =
  | 'fact'
  | 'preference'
  | 'context'
  | 'instruction'
  | 'skill'
  | 'relationship'

/**
 * Memory importance levels
 */
export type MemoryImportance = 'low' | 'medium' | 'high' | 'critical'

/**
 * Memory entry
 */
export interface MemoryEntry {
  id: string
  type: MemoryType
  content: string
  summary?: string
  importance: MemoryImportance
  source: 'user' | 'conversation' | 'system' | 'inference'
  metadata?: Record<string, unknown>
  tags?: string[]
  createdAt: string
  updatedAt: string
  accessCount: number
  lastAccessedAt?: string
  expiresAt?: string
}

/**
 * Memory search filters
 */
export interface MemoryFilters {
  type?: MemoryType | MemoryType[]
  importance?: MemoryImportance | MemoryImportance[]
  source?: MemoryEntry['source']
  search?: string
  tags?: string[]
  limit?: number
  offset?: number
}

/**
 * Memory statistics
 */
export interface MemoryStats {
  total: number
  byType: Record<MemoryType, number>
  byImportance: Record<MemoryImportance, number>
  oldestEntry: string
  newestEntry: string
  storageUsed: number // bytes
}

/**
 * Get all memories with optional filters
 */
export async function getMemories(filters?: MemoryFilters): Promise<MemoryEntry[]> {
  const params = new URLSearchParams()

  if (filters?.type) {
    const types = Array.isArray(filters.type) ? filters.type : [filters.type]
    types.forEach(t => params.append('type', t))
  }
  if (filters?.importance) {
    const levels = Array.isArray(filters.importance) ? filters.importance : [filters.importance]
    levels.forEach(i => params.append('importance', i))
  }
  if (filters?.source) params.set('source', filters.source)
  if (filters?.search) params.set('q', filters.search)
  if (filters?.tags) filters.tags.forEach(t => params.append('tag', t))
  if (filters?.limit) params.set('limit', String(filters.limit))
  if (filters?.offset) params.set('offset', String(filters.offset))

  const query = params.toString()
  return apiGet<MemoryEntry[]>(`/api/memory${query ? `?${query}` : ''}`)
}

/**
 * Search memories by content
 */
export async function searchMemories(query: string, limit = 10): Promise<MemoryEntry[]> {
  return apiGet<MemoryEntry[]>(`/api/memory/search?q=${encodeURIComponent(query)}&limit=${limit}`)
}

/**
 * Get a single memory by ID
 */
export async function getMemory(id: string): Promise<MemoryEntry> {
  return apiGet<MemoryEntry>(`/api/memory/${id}`)
}

/**
 * Create a new memory
 */
export async function createMemory(memory: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'accessCount'>): Promise<MemoryEntry> {
  return apiPost<MemoryEntry>('/api/memory', memory)
}

/**
 * Delete a memory
 */
export async function deleteMemory(id: string): Promise<void> {
  return apiDelete(`/api/memory/${id}`)
}

/**
 * Delete multiple memories
 */
export async function deleteMemories(ids: string[]): Promise<void> {
  return apiPost('/api/memory/delete-batch', { ids })
}

/**
 * Get memory statistics
 */
export async function getMemoryStats(): Promise<MemoryStats> {
  return apiGet<MemoryStats>('/api/memory/stats')
}

/**
 * Clear all memories (dangerous!)
 */
export async function clearAllMemories(): Promise<void> {
  return apiDelete('/api/memory/all')
}

/**
 * Export memories to JSON
 */
export async function exportMemories(): Promise<MemoryEntry[]> {
  return apiGet<MemoryEntry[]>('/api/memory/export')
}

/**
 * Import memories from JSON
 */
export async function importMemories(memories: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'accessCount'>[]): Promise<{ imported: number; failed: number }> {
  return apiPost<{ imported: number; failed: number }>('/api/memory/import', { memories })
}
