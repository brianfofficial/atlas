'use client'

import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getSuggestions,
  dismissSuggestion,
  snoozeSuggestion,
  actOnSuggestion,
  getSuggestionSettings,
  updateSuggestionSettings,
  type Suggestion,
  type SuggestionSettings,
} from '@/lib/api/suggestions'

/**
 * Hook for managing suggestions
 */
export function useSuggestions() {
  const queryClient = useQueryClient()

  // Query for suggestions with polling
  const {
    data: suggestions = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['suggestions'],
    queryFn: getSuggestions,
    refetchInterval: 5 * 60 * 1000, // Poll every 5 minutes
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  // Dismiss mutation
  const dismissMutation = useMutation({
    mutationFn: dismissSuggestion,
    onMutate: async (id) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['suggestions'] })
      const previous = queryClient.getQueryData<Suggestion[]>(['suggestions'])
      queryClient.setQueryData<Suggestion[]>(['suggestions'], (old = []) =>
        old.filter((s) => s.id !== id)
      )
      return { previous }
    },
    onError: (_err, _id, context) => {
      queryClient.setQueryData(['suggestions'], context?.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] })
    },
  })

  // Snooze mutation
  const snoozeMutation = useMutation({
    mutationFn: ({ id, until }: { id: string; until: string }) =>
      snoozeSuggestion(id, until),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ['suggestions'] })
      const previous = queryClient.getQueryData<Suggestion[]>(['suggestions'])
      queryClient.setQueryData<Suggestion[]>(['suggestions'], (old = []) =>
        old.filter((s) => s.id !== id)
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(['suggestions'], context?.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] })
    },
  })

  // Act mutation
  const actMutation = useMutation({
    mutationFn: ({ id, actionId }: { id: string; actionId: string }) =>
      actOnSuggestion(id, actionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] })
    },
  })

  const dismiss = useCallback(
    (id: string) => {
      return dismissMutation.mutateAsync(id)
    },
    [dismissMutation]
  )

  const snooze = useCallback(
    (id: string, until: string) => {
      return snoozeMutation.mutateAsync({ id, until })
    },
    [snoozeMutation]
  )

  const act = useCallback(
    (id: string, actionId: string) => {
      return actMutation.mutateAsync({ id, actionId })
    },
    [actMutation]
  )

  // Sort by priority
  const sortedSuggestions = [...suggestions].sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })

  // Filter by priority
  const urgentSuggestions = suggestions.filter((s) => s.priority === 'urgent')
  const highSuggestions = suggestions.filter((s) => s.priority === 'high')

  return {
    suggestions: sortedSuggestions,
    urgentSuggestions,
    highSuggestions,
    count: suggestions.length,
    isLoading,
    error,
    refetch,
    dismiss,
    snooze,
    act,
    isDismissing: dismissMutation.isPending,
    isSnoozing: snoozeMutation.isPending,
    isActing: actMutation.isPending,
  }
}

/**
 * Hook for suggestion settings
 */
export function useSuggestionSettings() {
  const queryClient = useQueryClient()

  const {
    data: settings,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['suggestions', 'settings'],
    queryFn: getSuggestionSettings,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  const updateMutation = useMutation({
    mutationFn: updateSuggestionSettings,
    onSuccess: (newSettings) => {
      queryClient.setQueryData(['suggestions', 'settings'], newSettings)
    },
  })

  const update = useCallback(
    (updates: Partial<SuggestionSettings>) => {
      return updateMutation.mutateAsync(updates)
    },
    [updateMutation]
  )

  return {
    settings,
    isLoading,
    error,
    update,
    isUpdating: updateMutation.isPending,
  }
}
