'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApprovalEvents } from './use-websocket'

/**
 * Approval request types (mirroring gateway types)
 */
export type ApprovalCategory =
  | 'file_write'
  | 'file_delete'
  | 'network_call'
  | 'credential_use'
  | 'dangerous_command'
  | 'external_api'
  | 'system_config'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'denied'
  | 'expired'
  | 'auto_approved'

export interface ApprovalRequest {
  id: string
  category: ApprovalCategory
  operation: string
  action: string
  riskLevel: RiskLevel
  context: string
  technicalDetails?: string
  sessionId: string
  userId?: string
  createdAt: string
  expiresAt: string
  status: ApprovalStatus
  metadata?: Record<string, unknown>
}

export interface ApprovalAuditEntry {
  id: string
  requestId: string
  action: 'created' | 'approved' | 'denied' | 'expired' | 'auto_approved'
  timestamp: string
  userId?: string
  details?: Record<string, unknown>
  ipAddress?: string
}

export interface ApprovalStats {
  pending: number
  approvedToday: number
  deniedToday: number
  autoApprovedToday: number
  expiredToday: number
  averageDecisionTimeMs: number
  topCategories: { category: ApprovalCategory; count: number }[]
}

/**
 * Mock API functions - replace with actual API calls
 */
const api = {
  getPending: async (): Promise<ApprovalRequest[]> => {
    // Mock data for development
    return [
      {
        id: '1',
        category: 'file_write',
        operation: 'Write to config file',
        action: 'echo "test" > config.json',
        riskLevel: 'medium',
        context: 'Atlas wants to save changes to your configuration file.',
        technicalDetails: 'Target: ~/atlas-workspace/config.json\nSize: 128 bytes',
        sessionId: 'session-1',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        status: 'pending',
      },
      {
        id: '2',
        category: 'network_call',
        operation: 'API request to GitHub',
        action: 'curl https://api.github.com/user',
        riskLevel: 'low',
        context: 'Atlas wants to check your GitHub profile.',
        sessionId: 'session-1',
        createdAt: new Date(Date.now() - 60000).toISOString(),
        expiresAt: new Date(Date.now() + 4 * 60 * 1000).toISOString(),
        status: 'pending',
      },
      {
        id: '3',
        category: 'dangerous_command',
        operation: 'Delete temporary files',
        action: 'rm -rf /tmp/atlas-*',
        riskLevel: 'high',
        context: 'Atlas wants to clean up temporary files.',
        technicalDetails: 'Pattern: /tmp/atlas-*\nEstimated files: 23',
        sessionId: 'session-1',
        createdAt: new Date(Date.now() - 120000).toISOString(),
        expiresAt: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
        status: 'pending',
      },
    ]
  },

  getHistory: async (): Promise<ApprovalAuditEntry[]> => {
    return [
      {
        id: 'audit-1',
        requestId: '10',
        action: 'approved',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        userId: 'user-1',
      },
      {
        id: 'audit-2',
        requestId: '11',
        action: 'denied',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        userId: 'user-1',
        details: { reason: 'Suspicious pattern detected' },
      },
      {
        id: 'audit-3',
        requestId: '12',
        action: 'auto_approved',
        timestamp: new Date(Date.now() - 10800000).toISOString(),
        details: { ruleName: 'Safe read commands' },
      },
    ]
  },

  getStats: async (): Promise<ApprovalStats> => {
    return {
      pending: 3,
      approvedToday: 12,
      deniedToday: 2,
      autoApprovedToday: 45,
      expiredToday: 1,
      averageDecisionTimeMs: 8500,
      topCategories: [
        { category: 'file_write', count: 23 },
        { category: 'network_call', count: 18 },
        { category: 'dangerous_command', count: 5 },
      ],
    }
  },

  approve: async (id: string, remember?: boolean): Promise<ApprovalRequest> => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500))
    return {
      id,
      category: 'file_write',
      operation: 'Approved operation',
      action: 'echo "approved"',
      riskLevel: 'low',
      context: 'Operation approved',
      sessionId: 'session-1',
      createdAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      status: 'approved',
    }
  },

  deny: async (id: string, reason?: string): Promise<ApprovalRequest> => {
    await new Promise((resolve) => setTimeout(resolve, 500))
    return {
      id,
      category: 'file_write',
      operation: 'Denied operation',
      action: 'echo "denied"',
      riskLevel: 'low',
      context: 'Operation denied',
      sessionId: 'session-1',
      createdAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      status: 'denied',
    }
  },
}

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
    queryFn: api.getPending,
    refetchInterval: 10000, // Refetch every 10 seconds as backup
  })

  // Query for stats
  const {
    data: stats,
    isLoading: isLoadingStats,
  } = useQuery({
    queryKey: ['approvals', 'stats'],
    queryFn: api.getStats,
    refetchInterval: 30000,
  })

  // Mutation for approving
  const approveMutation = useMutation({
    mutationFn: ({ id, remember }: { id: string; remember?: boolean }) =>
      api.approve(id, remember),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
    },
  })

  // Mutation for denying
  const denyMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.deny(id, reason),
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
export function useApprovalHistory() {
  const {
    data: history = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['approvals', 'history'],
    queryFn: api.getHistory,
  })

  return {
    history,
    isLoading,
    error,
  }
}
