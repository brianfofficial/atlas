'use client'

import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApprovalEvents } from './use-websocket'
import {
  getPendingApprovals,
  getApprovalHistory,
  getApprovalStats,
  approveRequest,
  denyRequest,
  type ApprovalRequest,
  type ApprovalAuditEntry,
  type ApprovalStats,
  type ApprovalCategory,
  type RiskLevel,
  type ApprovalStatus,
} from '@/lib/api/approvals'

// Re-export types for convenience
export type { ApprovalRequest, ApprovalAuditEntry, ApprovalStats, ApprovalCategory, RiskLevel, ApprovalStatus }

/**
 * Hook for managing approvals
 */
export function useApprovals() {
  const queryClient = useQueryClient()

  // Query for pending approvals
  const {
    data: pending = [],
    isLoading: isLoadingPending,
    error: pendingError,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: getPendingApprovals,
    refetchInterval: 10000, // Refetch every 10 seconds as backup
  })

  // Query for stats
  const {
    data: stats,
    isLoading: isLoadingStats,
  } = useQuery({
    queryKey: ['approvals', 'stats'],
    queryFn: getApprovalStats,
    refetchInterval: 30000,
  })

  // Mutation for approving
  const approveMutation = useMutation({
    mutationFn: ({ id, remember }: { id: string; remember?: boolean }) =>
      approveRequest(id, remember),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
    },
  })

  // Mutation for denying
  const denyMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      denyRequest(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
    },
  })

  // Subscribe to real-time updates
  useApprovalEvents({
    onCreated: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals', 'pending'] })
      queryClient.invalidateQueries({ queryKey: ['approvals', 'stats'] })
    },
    onApproved: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
    },
    onDenied: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
    },
    onExpired: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
    },
  })

  const approve = useCallback(
    (id: string, remember?: boolean) => {
      return approveMutation.mutateAsync({ id, remember })
    },
    [approveMutation]
  )

  const deny = useCallback(
    (id: string, reason?: string) => {
      return denyMutation.mutateAsync({ id, reason })
    },
    [denyMutation]
  )

  return {
    pending,
    stats,
    isLoading: isLoadingPending || isLoadingStats,
    isLoadingPending,
    isLoadingStats,
    error: pendingError,
    approve,
    deny,
    isApproving: approveMutation.isPending,
    isDenying: denyMutation.isPending,
    refetch: refetchPending,
  }
}

/**
 * Hook for approval history
 */
export function useApprovalHistory(params?: { limit?: number; offset?: number }) {
  const {
    data: history = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['approvals', 'history', params],
    queryFn: () => getApprovalHistory(params),
  })

  return {
    history,
    isLoading,
    error,
    refetch,
  }
}
