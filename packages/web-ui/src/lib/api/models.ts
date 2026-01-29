/**
 * Models API functions
 *
 * Handles AI model configuration and selection.
 */

import { apiGet, apiPut, apiPost } from './client'

/**
 * AI model definition
 */
export interface AIModel {
  id: string
  name: string
  provider: 'anthropic' | 'openai' | 'google' | 'local' | 'azure'
  contextWindow: number
  costPer1kInput: number // USD
  costPer1kOutput: number // USD
  capabilities: string[]
  isAvailable: boolean
  isDefault?: boolean
  description?: string
  latency: 'low' | 'medium' | 'high'
}

/**
 * Model routing configuration
 */
export interface ModelSelection {
  defaultModel: string
  fallbackModel?: string
  routing: {
    simple: string // For quick tasks
    complex: string // For complex reasoning
    creative: string // For creative writing
    code: string // For code generation
  }
  budgetLimit?: {
    daily: number
    monthly: number
  }
}

/**
 * Model usage stats
 */
export interface ModelUsage {
  modelId: string
  tokensInput: number
  tokensOutput: number
  cost: number
  requestCount: number
  period: 'day' | 'week' | 'month'
}

/**
 * Cost tracking summary
 */
export interface CostSummary {
  today: number
  thisWeek: number
  thisMonth: number
  byModel: {
    modelId: string
    cost: number
    percentage: number
  }[]
}

/**
 * Get available models
 */
export async function getModels(): Promise<AIModel[]> {
  return apiGet<AIModel[]>('/api/models')
}

/**
 * Get current model selection configuration
 */
export async function getModelSelection(): Promise<ModelSelection> {
  return apiGet<ModelSelection>('/api/models/selection')
}

/**
 * Update model selection configuration
 */
export async function updateModelSelection(selection: Partial<ModelSelection>): Promise<ModelSelection> {
  return apiPut<ModelSelection>('/api/models/selection', selection)
}

/**
 * Get model usage statistics
 */
export async function getModelUsage(period: 'day' | 'week' | 'month' = 'month'): Promise<ModelUsage[]> {
  return apiGet<ModelUsage[]>(`/api/models/usage?period=${period}`)
}

/**
 * Get cost summary
 */
export async function getCostSummary(): Promise<CostSummary> {
  return apiGet<CostSummary>('/api/models/costs')
}

/**
 * Test a model connection
 */
export async function testModel(modelId: string): Promise<{ success: boolean; latencyMs: number; error?: string }> {
  return apiPost<{ success: boolean; latencyMs: number; error?: string }>(`/api/models/${modelId}/test`, {})
}

/**
 * Set budget limits
 */
export async function setBudgetLimits(limits: { daily?: number; monthly?: number }): Promise<ModelSelection> {
  return apiPut<ModelSelection>('/api/models/budget', limits)
}
