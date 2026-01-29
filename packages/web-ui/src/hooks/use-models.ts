'use client'

import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getModels,
  getModelSelection,
  updateModelSelection,
  getModelUsage,
  getCostSummary,
  testModel,
  setBudgetLimits,
  type AIModel,
  type ModelSelection,
  type ModelUsage,
  type CostSummary,
} from '@/lib/api/models'

/**
 * Hook for available AI models
 */
export function useModels() {
  const {
    data: models = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['models'],
    queryFn: getModels,
    staleTime: 10 * 60 * 1000, // 10 minutes - models don't change often
  })

  // Group by provider
  const modelsByProvider = models.reduce(
    (acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = []
      }
      acc[model.provider].push(model)
      return acc
    },
    {} as Record<string, AIModel[]>
  )

  // Get available models only
  const availableModels = models.filter((m) => m.isAvailable)

  return {
    models,
    modelsByProvider,
    availableModels,
    isLoading,
    error,
    refetch,
  }
}

/**
 * Hook for model selection configuration
 */
export function useModelSelection() {
  const queryClient = useQueryClient()

  const {
    data: selection,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['models', 'selection'],
    queryFn: getModelSelection,
    staleTime: 5 * 60 * 1000,
  })

  // Update selection mutation
  const updateMutation = useMutation({
    mutationFn: updateModelSelection,
    onSuccess: (newSelection) => {
      queryClient.setQueryData(['models', 'selection'], newSelection)
    },
  })

  // Budget mutation
  const budgetMutation = useMutation({
    mutationFn: setBudgetLimits,
    onSuccess: (newSelection) => {
      queryClient.setQueryData(['models', 'selection'], newSelection)
    },
  })

  const update = useCallback(
    (updates: Partial<ModelSelection>) => {
      return updateMutation.mutateAsync(updates)
    },
    [updateMutation]
  )

  const setDefaultModel = useCallback(
    (modelId: string) => {
      return updateMutation.mutateAsync({ defaultModel: modelId })
    },
    [updateMutation]
  )

  const setRouting = useCallback(
    (routing: ModelSelection['routing']) => {
      return updateMutation.mutateAsync({ routing })
    },
    [updateMutation]
  )

  const setBudget = useCallback(
    (limits: { daily?: number; monthly?: number }) => {
      return budgetMutation.mutateAsync(limits)
    },
    [budgetMutation]
  )

  return {
    selection,
    isLoading,
    error,
    refetch,
    update,
    setDefaultModel,
    setRouting,
    setBudget,
    isUpdating: updateMutation.isPending || budgetMutation.isPending,
    updateError: updateMutation.error,
  }
}

/**
 * Hook for model usage statistics
 */
export function useModelUsage(period: 'day' | 'week' | 'month' = 'month') {
  const {
    data: usage = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['models', 'usage', period],
    queryFn: () => getModelUsage(period),
    staleTime: 60 * 1000, // 1 minute
  })

  // Calculate totals
  const totals = usage.reduce(
    (acc, u) => ({
      tokensInput: acc.tokensInput + u.tokensInput,
      tokensOutput: acc.tokensOutput + u.tokensOutput,
      cost: acc.cost + u.cost,
      requestCount: acc.requestCount + u.requestCount,
    }),
    { tokensInput: 0, tokensOutput: 0, cost: 0, requestCount: 0 }
  )

  return {
    usage,
    totals,
    isLoading,
    error,
    refetch,
  }
}

/**
 * Hook for cost summary
 */
export function useCostSummary() {
  const {
    data: costs,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['models', 'costs'],
    queryFn: getCostSummary,
    staleTime: 60 * 1000, // 1 minute
  })

  return {
    costs,
    isLoading,
    error,
    refetch,
  }
}

/**
 * Hook for testing model connection
 */
export function useTestModel() {
  const mutation = useMutation({
    mutationFn: testModel,
  })

  return {
    test: mutation.mutateAsync,
    isTesting: mutation.isPending,
    result: mutation.data,
    error: mutation.error,
    reset: mutation.reset,
  }
}
