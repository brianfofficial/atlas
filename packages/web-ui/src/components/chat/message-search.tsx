'use client'

import { useEffect, useRef } from 'react'
import { Search, X, ArrowUp, ArrowDown, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useMessageSearch, useGlobalSearch } from '@/hooks/use-message-search'
import type { Message } from '@/lib/api/chat'

interface MessageSearchProps {
  messages: Message[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onJumpToMessage?: (messageId: string) => void
}

export function MessageSearch({
  messages,
  open,
  onOpenChange,
  onJumpToMessage,
}: MessageSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const {
    query,
    setQuery,
    results,
    selectedIndex,
    selectedResult,
    selectNext,
    selectPrevious,
    selectResult,
    clearSearch,
    hasResults,
    resultCount,
  } = useMessageSearch({ messages })

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      clearSearch()
    }
  }, [open, clearSearch])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        selectNext()
        break
      case 'ArrowUp':
        e.preventDefault()
        selectPrevious()
        break
      case 'Enter':
        e.preventDefault()
        if (selectedResult) {
          onJumpToMessage?.(selectedResult.message.id)
          onOpenChange(false)
        }
        break
      case 'Escape':
        e.preventDefault()
        onOpenChange(false)
        break
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle className="sr-only">Search messages</DialogTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search messages..."
              className="pl-10 pr-10"
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={clearSearch}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[400px]">
          {!query ? (
            <div className="py-8 text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Start typing to search messages</p>
              <p className="text-xs mt-1">
                Use <kbd className="px-1 py-0.5 bg-muted rounded text-xs">↑</kbd>{' '}
                <kbd className="px-1 py-0.5 bg-muted rounded text-xs">↓</kbd> to navigate,{' '}
                <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Enter</kbd> to jump
              </p>
            </div>
          ) : !hasResults ? (
            <div className="py-8 text-center text-muted-foreground">
              <p className="text-sm">No messages found for "{query}"</p>
            </div>
          ) : (
            <div className="divide-y">
              {results.map((result, index) => (
                <SearchResultItem
                  key={result.message.id}
                  result={result}
                  isSelected={index === selectedIndex}
                  onClick={() => {
                    selectResult(index)
                    onJumpToMessage?.(result.message.id)
                    onOpenChange(false)
                  }}
                  searchQuery={query}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {hasResults && (
          <div className="px-4 py-2 border-t flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {resultCount} result{resultCount !== 1 ? 's' : ''} found
            </span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <ArrowUp className="h-3 w-3" />
                <ArrowDown className="h-3 w-3" />
                to navigate
              </span>
              <span>
                <kbd className="px-1 py-0.5 bg-muted rounded">Enter</kbd> to jump
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

interface SearchResultItemProps {
  result: {
    message: Message
    matchCount: number
    excerpts: string[]
  }
  isSelected: boolean
  onClick: () => void
  searchQuery: string
}

function SearchResultItem({
  result,
  isSelected,
  onClick,
  searchQuery,
}: SearchResultItemProps) {
  const { message, excerpts } = result

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 transition-colors',
        isSelected ? 'bg-primary/10' : 'hover:bg-muted'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-xs',
            message.role === 'user' ? 'bg-primary/10' : 'bg-success/10'
          )}
        >
          {message.role === 'user' ? 'Y' : 'A'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">
              {message.role === 'user' ? 'You' : 'Atlas'}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(message.createdAt)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            <HighlightedText text={excerpts[0] || message.content.slice(0, 100)} query={searchQuery} />
          </p>
        </div>
      </div>
    </button>
  )
}

interface HighlightedTextProps {
  text: string
  query: string
}

function HighlightedText({ text, query }: HighlightedTextProps) {
  if (!query) return <>{text}</>

  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, 'gi'))

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-warning/30 px-0.5 rounded font-medium">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  )
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Global search component for searching across all conversations
interface GlobalMessageSearchProps {
  conversations: Array<{ id: string; title: string; messages: Message[] }>
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectConversation?: (conversationId: string, messageId: string) => void
}

export function GlobalMessageSearch({
  conversations,
  open,
  onOpenChange,
  onSelectConversation,
}: GlobalMessageSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { query, setQuery, results, clearSearch, isLoading, hasResults } =
    useGlobalSearch({ conversations })

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      clearSearch()
    }
  }, [open, clearSearch])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle className="sr-only">Search all conversations</DialogTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search all conversations..."
              className="pl-10"
            />
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[400px]">
          {isLoading ? (
            <div className="py-8 text-center">
              <div className="h-6 w-6 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground mt-2">Searching...</p>
            </div>
          ) : !query ? (
            <div className="py-8 text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Search across all your conversations</p>
            </div>
          ) : !hasResults ? (
            <div className="py-8 text-center text-muted-foreground">
              <p className="text-sm">No results found for "{query}"</p>
            </div>
          ) : (
            <div className="divide-y">
              {results.slice(0, 50).map((result, index) => (
                <button
                  key={`${result.conversationId}-${result.message.id}`}
                  onClick={() => {
                    onSelectConversation?.(result.conversationId, result.message.id)
                    onOpenChange(false)
                  }}
                  className="w-full text-left p-3 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />
                    <span className="truncate">{result.conversationTitle}</span>
                    <span>·</span>
                    <span>{formatRelativeTime(result.message.createdAt)}</span>
                  </div>
                  <p className="text-sm line-clamp-2">
                    <HighlightedText text={result.excerpt} query={query} />
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {hasResults && (
          <div className="px-4 py-2 border-t text-xs text-muted-foreground">
            {results.length} result{results.length !== 1 ? 's' : ''} found
            {results.length > 50 && ' (showing first 50)'}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
