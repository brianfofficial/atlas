/**
 * Briefings API
 *
 * Handles briefing management, draft approvals, metrics, and scheduling.
 */

import { apiGet, apiPost, apiPut, apiDelete } from './client'

// ============================================================================
// Types
// ============================================================================

export type BriefingType = 'daily' | 'weekly'
export type DraftStatus = 'pending' | 'approved' | 'dismissed' | 'edited'
export type DraftSurface = 'email' | 'calendar' | 'tasks'
export type DraftItemType = 'email_draft' | 'meeting_prep' | 'follow_up' | 'calendar_note'

export interface DraftItem {
  id: string
  briefingId: string
  type: DraftItemType
  surface: DraftSurface
  title: string
  content: string
  context?: string
  sourceType?: string
  sourceId?: string
  status: DraftStatus
  priority: number
  actionTakenAt?: string
  editedContent?: string
  dismissReason?: string
  executedAt?: string
  undoDeadline?: string
  undoneAt?: string
  createdAt: string
}

export interface Briefing {
  id: string
  userId: string
  type: BriefingType
  status: 'pending' | 'approved' | 'dismissed' | 'expired' | 'edited'
  generatedAt: string
  approvalDeadline?: string
  content: BriefingContent
  draftItems: DraftItem[]
  source: 'scheduled' | 'manual' | 'notification'
  notificationSentAt?: string
  viewedAt?: string
  resolvedAt?: string
  userAction?: string
  createdAt: string
  updatedAt: string
}

export interface BriefingContent {
  greeting: string
  summary: string
  sections: BriefingSection[]
}

export interface BriefingSection {
  id: string
  title: string
  type: 'calendar' | 'email' | 'github' | 'tasks' | 'weather'
  items: Array<{
    id: string
    title: string
    description?: string
    time?: string
    metadata?: Record<string, unknown>
  }>
}

export interface BriefingHistory {
  entries: BriefingHistoryEntry[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface BriefingHistoryEntry {
  id: string
  briefingId?: string
  type: BriefingType
  generatedAt: string
  completedAt?: string
  totalItems: number
  approvedItems: number
  dismissedItems: number
  editedItems: number
  timeToFirstAction?: number
  userSatisfaction?: number
}

// ============================================================================
// Metrics Types
// ============================================================================

export interface MetricsDashboard {
  metrics: {
    daar: MetricValue // Daily Active Approval Rate
    ttfa: MetricValue // Time to First Action
    dar: MetricValue // Draft Acceptance Rate
    editRate: MetricValue
    secondSurfaceAdoption: MetricValue
    unpromptedReturn: MetricValue
    retention: {
      day7: MetricValue
      day14: MetricValue
      day30: MetricValue
    }
  }
  killCriteria: {
    status: 'passing' | 'warning' | 'failing'
    checks: KillCriteriaCheck[]
  }
  trustHealth: {
    score: number
    trend: 'improving' | 'stable' | 'declining'
    signals: TrustSignal[]
  }
  trends: {
    daar: TrendPoint[]
    dar: TrendPoint[]
    editRate: TrendPoint[]
  }
}

export interface MetricValue {
  value: number
  target?: number
  trend?: 'up' | 'down' | 'stable'
  label: string
}

export interface KillCriteriaCheck {
  name: string
  status: 'passing' | 'warning' | 'failing'
  value: number
  threshold: number
  description: string
}

export interface TrustSignal {
  type: string
  level: 'normal' | 'warning' | 'stop'
  value: number
  description: string
}

export interface TrendPoint {
  date: string
  value: number
}

// ============================================================================
// Schedule Types
// ============================================================================

export interface BriefingSchedule {
  daily: ScheduleConfig
  weekly: ScheduleConfig
}

export interface ScheduleConfig {
  id: string
  enabled: boolean
  hour: number
  minute: number
  timezone: string
  dayOfWeek?: number
  deliveryMethod: 'push' | 'email' | 'both'
  lastRunAt?: string
  nextRunAt?: string
}

// ============================================================================
// Pinned Memory Types
// ============================================================================

export type PinnedMemoryType = 'relationship' | 'preference' | 'pattern' | 'important_context'

export interface PinnedMemory {
  id: string
  userId: string
  type: PinnedMemoryType
  title: string
  content: string
  sourceType?: string
  useCount: number
  lastUsedAt?: string
  validUntil?: string
  createdAt: string
}

// ============================================================================
// API Functions - Briefings
// ============================================================================

/**
 * Get today's briefing (generates if not exists)
 */
export async function getTodaysBriefing(): Promise<Briefing> {
  return apiGet<Briefing>('/api/briefings/today')
}

/**
 * Manually trigger briefing generation
 */
export async function generateBriefing(type: BriefingType): Promise<{ success: boolean; briefingId: string; type: string }> {
  return apiPost('/api/briefings/generate', { type })
}

/**
 * Get briefing history
 */
export async function getBriefingHistory(options?: {
  page?: number
  pageSize?: number
  type?: BriefingType
}): Promise<BriefingHistory> {
  const params = new URLSearchParams()
  if (options?.page) params.set('page', options.page.toString())
  if (options?.pageSize) params.set('pageSize', options.pageSize.toString())
  if (options?.type) params.set('type', options.type)

  const query = params.toString()
  return apiGet<BriefingHistory>(`/api/briefings/history${query ? `?${query}` : ''}`)
}

/**
 * Mark a briefing as completed
 */
export async function completeBriefing(briefingId: string): Promise<{ success: boolean }> {
  return apiPost(`/api/briefings/${briefingId}/complete`, {})
}

// ============================================================================
// API Functions - Draft Actions
// ============================================================================

/**
 * Approve a draft item
 */
export async function approveDraft(
  itemId: string,
  options?: { executeImmediately?: boolean }
): Promise<{ success: boolean; itemId: string; undoDeadline: string; undoAvailable: boolean }> {
  return apiPost(`/api/briefings/drafts/${itemId}/approve`, {
    executeImmediately: options?.executeImmediately ?? true,
  })
}

/**
 * Dismiss a draft item
 */
export async function dismissDraft(
  itemId: string,
  reason?: string
): Promise<{ success: boolean; itemId: string; status: string }> {
  return apiPost(`/api/briefings/drafts/${itemId}/dismiss`, { reason })
}

/**
 * Edit and approve a draft item
 */
export async function editDraft(
  itemId: string,
  content: string,
  options?: { executeImmediately?: boolean }
): Promise<{ success: boolean; itemId: string; undoDeadline: string; undoAvailable: boolean }> {
  return apiPost(`/api/briefings/drafts/${itemId}/edit`, {
    content,
    executeImmediately: options?.executeImmediately ?? true,
  })
}

/**
 * Undo an executed draft (within 30-second window)
 */
export async function undoDraft(itemId: string): Promise<{ success: boolean; itemId: string; status: string }> {
  return apiPost(`/api/briefings/drafts/${itemId}/undo`, {})
}

/**
 * Check undo availability for a draft
 */
export async function getUndoStatus(itemId: string): Promise<{
  itemId: string
  undoAvailable: boolean
  remainingMs: number
  remainingSeconds: number
}> {
  return apiGet(`/api/briefings/drafts/${itemId}/undo-status`)
}

// ============================================================================
// API Functions - Metrics
// ============================================================================

/**
 * Get metrics dashboard
 */
export async function getMetricsDashboard(): Promise<MetricsDashboard> {
  return apiGet<MetricsDashboard>('/api/briefings/metrics')
}

/**
 * Get experiment status (7-day window)
 */
export async function getExperimentStatus(): Promise<{
  inExperiment: boolean
  dayNumber?: number
  startDate?: string
  endDate?: string
  metrics?: Record<string, number>
}> {
  return apiGet('/api/briefings/experiment')
}

// ============================================================================
// API Functions - Schedule
// ============================================================================

/**
 * Get briefing schedule
 */
export async function getSchedule(): Promise<BriefingSchedule> {
  return apiGet<BriefingSchedule>('/api/briefings/schedule')
}

/**
 * Update daily schedule
 */
export async function updateDailySchedule(config: Partial<Omit<ScheduleConfig, 'id'>>): Promise<{ success: boolean }> {
  return apiPut('/api/briefings/schedule/daily', config)
}

/**
 * Update weekly schedule
 */
export async function updateWeeklySchedule(config: Partial<Omit<ScheduleConfig, 'id'>>): Promise<{ success: boolean }> {
  return apiPut('/api/briefings/schedule/weekly', config)
}

// ============================================================================
// API Functions - Pinned Memories
// ============================================================================

/**
 * Get pinned memories
 */
export async function getPinnedMemories(): Promise<{ memories: PinnedMemory[] }> {
  return apiGet('/api/briefings/memories')
}

/**
 * Pin a new memory
 */
export async function pinMemory(data: {
  type: PinnedMemoryType
  title: string
  content: string
  validUntil?: string
}): Promise<PinnedMemory> {
  return apiPost('/api/briefings/memories', data)
}

/**
 * Unpin a memory
 */
export async function unpinMemory(memoryId: string): Promise<{ success: boolean }> {
  return apiDelete(`/api/briefings/memories/${memoryId}`)
}

// ============================================================================
// API Functions - Feedback
// ============================================================================

/**
 * Report that Atlas missed something important
 */
export async function reportMissed(description: string, feedback?: string): Promise<{ success: boolean }> {
  return apiPost('/api/briefings/feedback/missed', { description, feedback })
}

/**
 * Report regret after approving a draft
 */
export async function reportRegret(itemId: string, description?: string): Promise<{ success: boolean }> {
  return apiPost(`/api/briefings/feedback/regret/${itemId}`, { description })
}
