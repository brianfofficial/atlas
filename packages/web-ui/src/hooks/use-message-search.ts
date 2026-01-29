'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import type { Message } from '@/lib/api/chat'

interface UseMessageSearchOptions {
  messages: Message[]
  debounceMs?: number
}

interface SearchResult {
  message: Message
  matchCount: number
  excerpts: string[]
}

export function useMessageSearch({ messages, debounceMs = 200 }: UseMessageSearchOptions) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const debounceTimeout = useRef<ReturnType<typeof setTimeout>>()

  // Debounce the query
  useEffect(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current)
    }

    debounceTimeout.current = setTimeout(() => {
      setDebouncedQuery(query)
      setSelectedIndex(0)
    }, debounceMs)

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current)
      }
    }
  }, [query, debounceMs])

  // Search logic
  const results = useMemo((): SearchResult[] => {
    if (!debouncedQuery.trim()) return []

    const searchTerms = debouncedQuery.toLowerCase().split(/\s+/).filter(Boolean)
    if (searchTerms.length === 0) return []

    const matchedMessages: SearchResult[] = []

    for (const message of messages) {
      const content = message.content.toLowerCase()
      let matchCount = 0
      const excerpts: string[] = []

      for (const term of searchTerms) {
        const termMatches = (content.match(new RegExp(escapeRegExp(term), 'gi')) || []).length
        if (termMatches > 0) {
          matchCount += termMatches

          // Extract excerpts around matches
          const regex = new RegExp(`.{0,40}${escapeRegExp(term)}.{0,40}`, 'gi')
          const matches = content.match(regex) || []
          excerpts.push(...matches.slice(0, 2).map((m) => `...${m}...`))
        }
      }

      if (matchCount > 0) {
        matchedMessages.push({
          message,
          matchCount,
          excerpts: excerpts.slice(0, 2), // Limit excerpts
        })
      }
    }

    // Sort by match count (most matches first) and then by date (newest first)
    return matchedMessages.sort((a, b) => {
      if (b.matchCount !== a.matchCount) {
        return b.matchCount - a.matchCount
      }
      return new Date(b.message.createdAt).getTime() - new Date(a.message.createdAt).getTime()
    })
  }, [messages, debouncedQuery])

  const selectedResult = results[selectedIndex] || null

  const selectNext = useCallback(() => {
    setSelectedIndex((prev) => (prev + 1) % Math.max(results.length, 1))
  }, [results.length])

  const selectPrevious = useCallback(() => {
    setSelectedIndex((prev) => (prev - 1 + results.length) % Math.max(results.length, 1))
  }, [results.length])

  const selectResult = useCallback((index: number) => {
    if (index >= 0 && index < results.length) {
      setSelectedIndex(index)
    }
  }, [results.length])

  const clearSearch = useCallback(() => {
    setQuery('')
    setDebouncedQuery('')
    setSelectedIndex(0)
  }, [])

  return {
    query,
    setQuery,
    results,
    selectedIndex,
    selectedResult,
    selectNext,
    selectPrevious,
    selectResult,
    clearSearch,
    isSearching: query !== debouncedQuery,
    hasResults: results.length > 0,
    resultCount: results.length,
  }
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Global search across conversations
interface UseGlobalSearchOptions {
  conversations: Array<{ id: string; title: string; messages: Message[] }>
  debounceMs?: number
}

interface GlobalSearchResult {
  conversationId: string
  conversationTitle: string
  message: Message
  excerpt: string
}

export function useGlobalSearch({ conversations, debounceMs = 300 }: UseGlobalSearchOptions) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const debounceTimeout = useRef<ReturnType<typeof setTimeout>>()

  // Debounce
  useEffect(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current)
    }

    setIsLoading(true)
    debounceTimeout.current = setTimeout(() => {
      setDebouncedQuery(query)
      setIsLoading(false)
    }, debounceMs)

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current)
      }
    }
  }, [query, debounceMs])

  const results = useMemo((): GlobalSearchResult[] => {
    if (!debouncedQuery.trim()) return []

    const searchTerm = debouncedQuery.toLowerCase()
    const matched: GlobalSearchResult[] = []

    for (const conversation of conversations) {
      for (const message of conversation.messages) {
        const content = message.content.toLowerCase()
        const index = content.indexOf(searchTerm)

        if (index !== -1) {
          // Extract excerpt
          const start = Math.max(0, index - 30)
          const end = Math.min(content.length, index + searchTerm.length + 30)
          const excerpt = (start > 0 ? '...' : '') +
            message.content.slice(start, end) +
            (end < content.length ? '...' : '')

          matched.push({
            conversationId: conversation.id,
            conversationTitle: conversation.title,
            message,
            excerpt,
          })
        }
      }
    }

    // Sort by date (newest first)
    return matched.sort(
      (a, b) =>
        new Date(b.message.createdAt).getTime() - new Date(a.message.createdAt).getTime()
    )
  }, [conversations, debouncedQuery])

  const clearSearch = useCallback(() => {
    setQuery('')
    setDebouncedQuery('')
  }, [])

  return {
    query,
    setQuery,
    results,
    clearSearch,
    isLoading,
    hasResults: results.length > 0,
  }
}
