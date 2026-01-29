'use client'

import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getAuditLogs,
  getAuditLogEntry,
  getAuditStats,
  searchAuditLogs,
  exportAuditLogs,
  type AuditLogEntry,
  type AuditLogFilters,
  type AuditStats,
} from '@/lib/api/audit'

// Re-export types
export type { AuditLogEntry, AuditLogFilters, AuditStats }
export type { AuditEventType, AuditSeverity } from '@/lib/api/audit'

/**
 * Hook for audit logs with filtering
 */
export function useAuditLogs(initialFilters?: AuditLogFilters) {
  const [filters, setFilters] = useState<AuditLogFilters>(initialFilters || { limit: 50 })

  const {
    data: logs = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['audit', 'logs', filters],
    queryFn: () => getAuditLogs(filters),
    staleTime: 30 * 1000, // 30 seconds
  })

  const updateFilters = useCallback((newFilters: Partial<AuditLogFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({ limit: 50 })
  }, [])

  const loadMore = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      offset: (prev.offset || 0) + (prev.limit || 50),
    }))
  }, [])

  return {
    logs,
    filters,
    isLoading,
    error,
    refetch,
    updateFilters,
    clearFilters,
    loadMore,
  }
}

/**
 * Hook for a single audit log entry
 */
export function useAuditLogEntry(id: string | null) {
  const {
    data: entry,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['audit', 'entry', id],
    queryFn: () => (id ? getAuditLogEntry(id) : null),
    enabled: !!id,
  })

  return {
    entry,
    isLoading,
    error,
    refetch,
  }
}

/**
 * Hook for audit statistics
 */
export function useAuditStats() {
  const {
    data: stats,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['audit', 'stats'],
    queryFn: getAuditStats,
    staleTime: 60 * 1000, // 1 minute
  })

  return {
    stats,
    isLoading,
    error,
    refetch,
  }
}

/**
 * Hook for searching audit logs
 */
export function useAuditSearch() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  const updateQuery = useCallback((newQuery: string) => {
    setQuery(newQuery)
    const timeout = setTimeout(() => {
      setDebouncedQuery(newQuery)
    }, 300)
    return () => clearTimeout(timeout)
  }, [])

  const {
    data: results = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['audit', 'search', debouncedQuery],
    queryFn: () => searchAuditLogs(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 10 * 1000,
  })

  const clear = useCallback(() => {
    setQuery('')
    setDebouncedQuery('')
  }, [])

  return {
    query,
    results,
    isLoading,
    error,
    search: updateQuery,
    clear,
  }
}

/**
 * Hook for exporting audit logs
 */
export function useAuditExport() {
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const exportLogs = useCallback(async (filters?: AuditLogFilters) => {
    setIsExporting(true)
    setError(null)

    try {
      const blob = await exportAuditLogs(filters)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `atlas-audit-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Export failed'))
    } finally {
      setIsExporting(false)
    }
  }, [])

  return {
    exportLogs,
    isExporting,
    error,
  }
}
