/**
 * Preferences API functions
 *
 * Handles user preferences and goals management.
 */

import { apiGet, apiPut, apiPost, apiDelete, apiPatch } from './client'

/**
 * User preferences
 */
export interface Preferences {
  theme: 'light' | 'dark' | 'system'
  notifications: {
    email: boolean
    push: boolean
    security: boolean
    suggestions: boolean
  }
  privacy: {
    shareAnalytics: boolean
    rememberHistory: boolean
  }
  ai: {
    defaultModel: string
    temperature: number
    maxTokens: number
    verbosity: 'concise' | 'balanced' | 'detailed'
  }
  security: {
    sessionTimeout: number // minutes
    requireMFAForSensitive: boolean
    autoLockOnIdle: boolean
  }
}

/**
 * User goal
 */
export interface Goal {
  id: string
  title: string
  description?: string
  category: 'personal' | 'professional' | 'health' | 'learning' | 'other'
  priority: 'low' | 'medium' | 'high'
  dueDate?: string
  progress: number // 0-100
  createdAt: string
  updatedAt: string
}

/**
 * Get user preferences
 */
export async function getPreferences(): Promise<Preferences> {
  return apiGet<Preferences>('/api/preferences')
}

/**
 * Update user preferences
 */
export async function updatePreferences(preferences: Partial<Preferences>): Promise<Preferences> {
  return apiPut<Preferences>('/api/preferences', preferences)
}

/**
 * Reset preferences to defaults
 */
export async function resetPreferences(): Promise<Preferences> {
  return apiPost<Preferences>('/api/preferences/reset', {})
}

/**
 * Get user goals
 */
export async function getGoals(): Promise<Goal[]> {
  return apiGet<Goal[]>('/api/preferences/goals')
}

/**
 * Create a new goal
 */
export async function createGoal(goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>): Promise<Goal> {
  return apiPost<Goal>('/api/preferences/goals', goal)
}

/**
 * Update a goal
 */
export async function updateGoal(id: string, updates: Partial<Goal>): Promise<Goal> {
  return apiPatch<Goal>(`/api/preferences/goals/${id}`, updates)
}

/**
 * Delete a goal
 */
export async function deleteGoal(id: string): Promise<void> {
  return apiDelete(`/api/preferences/goals/${id}`)
}

/**
 * Update goal progress
 */
export async function updateGoalProgress(id: string, progress: number): Promise<Goal> {
  return apiPatch<Goal>(`/api/preferences/goals/${id}`, { progress })
}
