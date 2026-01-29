'use client'

import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getPreferences,
  updatePreferences,
  resetPreferences,
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  updateGoalProgress,
  type Preferences,
  type Goal,
} from '@/lib/api/preferences'

/**
 * Hook for managing user preferences
 */
export function usePreferences() {
  const queryClient = useQueryClient()

  // Query for preferences
  const {
    data: preferences,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['preferences'],
    queryFn: getPreferences,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Update preferences mutation
  const updateMutation = useMutation({
    mutationFn: updatePreferences,
    onSuccess: (newPrefs) => {
      queryClient.setQueryData(['preferences'], newPrefs)
    },
  })

  // Reset preferences mutation
  const resetMutation = useMutation({
    mutationFn: resetPreferences,
    onSuccess: (newPrefs) => {
      queryClient.setQueryData(['preferences'], newPrefs)
    },
  })

  const update = useCallback(
    (updates: Partial<Preferences>) => {
      return updateMutation.mutateAsync(updates)
    },
    [updateMutation]
  )

  const reset = useCallback(() => {
    return resetMutation.mutateAsync()
  }, [resetMutation])

  return {
    preferences,
    isLoading,
    error,
    refetch,
    update,
    reset,
    isUpdating: updateMutation.isPending,
    isResetting: resetMutation.isPending,
    updateError: updateMutation.error,
    resetError: resetMutation.error,
  }
}

/**
 * Hook for managing user goals
 */
export function useGoals() {
  const queryClient = useQueryClient()

  // Query for goals
  const {
    data: goals = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['goals'],
    queryFn: getGoals,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  // Create goal mutation
  const createMutation = useMutation({
    mutationFn: createGoal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
    },
  })

  // Update goal mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Goal> }) =>
      updateGoal(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
    },
  })

  // Delete goal mutation
  const deleteMutation = useMutation({
    mutationFn: deleteGoal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
    },
  })

  // Update progress mutation
  const progressMutation = useMutation({
    mutationFn: ({ id, progress }: { id: string; progress: number }) =>
      updateGoalProgress(id, progress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
    },
  })

  const create = useCallback(
    (goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>) => {
      return createMutation.mutateAsync(goal)
    },
    [createMutation]
  )

  const update = useCallback(
    (id: string, updates: Partial<Goal>) => {
      return updateMutation.mutateAsync({ id, updates })
    },
    [updateMutation]
  )

  const remove = useCallback(
    (id: string) => {
      return deleteMutation.mutateAsync(id)
    },
    [deleteMutation]
  )

  const setProgress = useCallback(
    (id: string, progress: number) => {
      return progressMutation.mutateAsync({ id, progress })
    },
    [progressMutation]
  )

  return {
    goals,
    isLoading,
    error,
    refetch,
    create,
    update,
    remove,
    setProgress,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isUpdatingProgress: progressMutation.isPending,
  }
}
