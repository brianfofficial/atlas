'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getMemories,
  searchMemories,
  getMemory,
  createMemory,
  deleteMemory,
  deleteMemories,
  getMemoryStats,
  clearAllMemories,
  exportMemories,
  importMemories,
  type MemoryEntry,
  type MemoryFilters,
  type MemoryStats,
} from '@/lib/api/memory'

/**
 * Hook for managing memories with filters
 */
export function useMemories(initialFilters?: MemoryFilters) {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<MemoryFilters>(initialFilters || {})

  // Query for memories
  const {
    data: memories = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['memories', filters],
    queryFn: () => getMemories(filters),
    staleTime: 30 * 1000, // 30 seconds
  })

  // Create memory mutation
  const createMutation = useMutation({
    mutationFn: createMemory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] })
      queryClient.invalidateQueries({ queryKey: ['memory', 'stats'] })
    },
  })

  // Delete memory mutation
  const deleteMutation = useMutation({
    mutationFn: deleteMemory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] })
      queryClient.invalidateQueries({ queryKey: ['memory', 'stats'] })
    },
  })

  // Batch delete mutation
  const batchDeleteMutation = useMutation({
    mutationFn: deleteMemories,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] })
      queryClient.invalidateQueries({ queryKey: ['memory', 'stats'] })
    },
  })

  const create = useCallback(
    (memory: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'accessCount'>) => {
      return createMutation.mutateAsync(memory)
    },
    [createMutation]
  )

  const remove = useCallback(
    (id: string) => {
      return deleteMutation.mutateAsync(id)
    },
    [deleteMutation]
  )

  const removeBatch = useCallback(
    (ids: string[]) => {
      return batchDeleteMutation.mutateAsync(ids)
    },
    [batchDeleteMutation]
  )

  const updateFilters = useCallback((newFilters: Partial<MemoryFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({})
  }, [])

  return {
    memories,
    filters,
    isLoading,
    error,
    refetch,
    create,
    remove,
    removeBatch,
    updateFilters,
    clearFilters,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending || batchDeleteMutation.isPending,
  }
}

/**
 * Hook for searching memories
 */
export function useMemorySearch() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Debounce search query
  const updateQuery = useCallback((newQuery: string) => {
    setQuery(newQuery)
    // Simple debounce
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
    queryKey: ['memories', 'search', debouncedQuery],
    queryFn: () => searchMemories(debouncedQuery),
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
 * Hook for a single memory entry
 */
export function useMemory(id: string | null) {
  const {
    data: memory,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['memory', id],
    queryFn: () => (id ? getMemory(id) : null),
    enabled: !!id,
  })

  return {
    memory,
    isLoading,
    error,
    refetch,
  }
}

/**
 * Hook for memory statistics
 */
export function useMemoryStats() {
  const {
    data: stats,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['memory', 'stats'],
    queryFn: getMemoryStats,
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
 * Hook for clearing all memories
 */
export function useClearMemories() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: clearAllMemories,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] })
      queryClient.invalidateQueries({ queryKey: ['memory'] })
    },
  })

  return {
    clear: mutation.mutateAsync,
    isClearing: mutation.isPending,
    error: mutation.error,
  }
}

/**
 * Hook for import/export
 */
export function useMemoryImportExport() {
  const queryClient = useQueryClient()

  const exportMutation = useMutation({
    mutationFn: exportMemories,
  })

  const importMutation = useMutation({
    mutationFn: importMemories,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] })
      queryClient.invalidateQueries({ queryKey: ['memory'] })
    },
  })

  const exportToFile = useCallback(async () => {
    const memories = await exportMutation.mutateAsync()
    const blob = new Blob([JSON.stringify(memories, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `atlas-memories-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    return memories
  }, [exportMutation])

  const importFromFile = useCallback(
    async (file: File) => {
      const text = await file.text()
      const memories = JSON.parse(text)
      return importMutation.mutateAsync(memories)
    },
    [importMutation]
  )

  return {
    exportToFile,
    importFromFile,
    isExporting: exportMutation.isPending,
    isImporting: importMutation.isPending,
    importResult: importMutation.data,
    exportError: exportMutation.error,
    importError: importMutation.error,
  }
}
