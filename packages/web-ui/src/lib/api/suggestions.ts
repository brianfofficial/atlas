/**
 * Suggestions API functions
 *
 * Handles proactive suggestions from the anticipation engine.
 */

import { apiGet, apiPost } from './client'

/**
 * Suggestion types
 */
export type SuggestionType =
  | 'reminder'
  | 'task'
  | 'insight'
  | 'recommendation'
  | 'warning'
  | 'opportunity'

/**
 * Suggestion priority
 */
export type SuggestionPriority = 'low' | 'medium' | 'high' | 'urgent'

/**
 * Suggestion action
 */
export interface SuggestionAction {
  id: string
  label: string
  type: 'primary' | 'secondary' | 'link'
  href?: string
  command?: string
}

/**
 * Proactive suggestion
 */
export interface Suggestion {
  id: string
  type: SuggestionType
  title: string
  description: string
  priority: SuggestionPriority
  actions: SuggestionAction[]
  context?: string
  expiresAt?: string
  createdAt: string
  source: 'calendar' | 'task' | 'pattern' | 'system' | 'integration'
  metadata?: Record<string, unknown>
}

/**
 * Get active suggestions
 */
export async function getSuggestions(): Promise<Suggestion[]> {
  return apiGet<Suggestion[]>('/api/suggestions')
}

/**
 * Dismiss a suggestion
 */
export async function dismissSuggestion(id: string): Promise<void> {
  return apiPost(`/api/suggestions/${id}/dismiss`, {})
}

/**
 * Snooze a suggestion
 */
export async function snoozeSuggestion(id: string, until: string): Promise<void> {
  return apiPost(`/api/suggestions/${id}/snooze`, { until })
}

/**
 * Act on a suggestion
 */
export async function actOnSuggestion(id: string, actionId: string): Promise<unknown> {
  return apiPost(`/api/suggestions/${id}/act`, { actionId })
}

/**
 * Get suggestion settings
 */
export interface SuggestionSettings {
  enabled: boolean
  quietHours: {
    enabled: boolean
    start: string // HH:mm
    end: string
  }
  priorities: {
    showLow: boolean
    showMedium: boolean
    showHigh: boolean
    showUrgent: boolean
  }
  types: {
    reminders: boolean
    tasks: boolean
    insights: boolean
    recommendations: boolean
    warnings: boolean
    opportunities: boolean
  }
}

export async function getSuggestionSettings(): Promise<SuggestionSettings> {
  return apiGet<SuggestionSettings>('/api/suggestions/settings')
}

export async function updateSuggestionSettings(settings: Partial<SuggestionSettings>): Promise<SuggestionSettings> {
  return apiPost<SuggestionSettings>('/api/suggestions/settings', settings)
}
