'use client'

import { useQuery } from '@tanstack/react-query'
import {
  getDashboardStats,
  getSecurityEvents,
  getSecurityPosture,
  type DashboardStats,
  type SecurityEvent,
  type SecurityPosture,
} from '@/lib/api/dashboard'

// Re-export types
export type { DashboardStats, SecurityEvent, SecurityPosture }

/**
 * Hook for dashboard statistics
 */
export function useDashboardStats() {
  const {
    data: stats,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: getDashboardStats,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refresh every minute
  })

  return {
    stats,
    isLoading,
    error,
    refetch,
  }
}

/**
 * Hook for recent security events
 */
export function useSecurityEvents(limit = 10) {
  const {
    data: events = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['dashboard', 'events', limit],
    queryFn: () => getSecurityEvents(limit),
    staleTime: 15 * 1000, // 15 seconds
    refetchInterval: 30 * 1000, // Refresh every 30 seconds
  })

  return {
    events,
    isLoading,
    error,
    refetch,
  }
}

/**
 * Hook for security posture
 */
export function useSecurityPosture() {
  const {
    data: posture,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['dashboard', 'posture'],
    queryFn: getSecurityPosture,
    staleTime: 5 * 60 * 1000, // 5 minutes - doesn't change often
  })

  return {
    posture,
    isLoading,
    error,
    refetch,
  }
}
