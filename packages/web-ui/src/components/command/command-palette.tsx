'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Search,
  MessageSquare,
  Settings,
  Shield,
  Key,
  Container,
  DollarSign,
  Network,
  Cloud,
  Mail,
  Calendar,
  Github,
  Loader2,
  Clock,
  ArrowRight,
  Command,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { InlineResult, type InlineResultData } from './inline-result'

export interface CommandItem {
  id: string
  label: string
  description?: string
  icon: React.ComponentType<{ className?: string }>
  shortcut?: string
  action?: () => void | Promise<void>
  href?: string
  group?: string
  keywords?: string[]
  hasInlineResult?: boolean
  getInlineResult?: () => Promise<InlineResultData>
}

const DEFAULT_COMMANDS: CommandItem[] = [
  // Navigation
  {
    id: 'nav-dashboard',
    label: 'Dashboard',
    description: 'Go to main dashboard',
    icon: Command,
    href: '/',
    group: 'Navigation',
    keywords: ['home', 'main'],
  },
  {
    id: 'nav-chat',
    label: 'Chat',
    description: 'Open AI assistant',
    icon: MessageSquare,
    href: '/chat',
    group: 'Navigation',
    keywords: ['talk', 'ai', 'assistant'],
  },
  {
    id: 'nav-security',
    label: 'Security',
    description: 'Security overview',
    icon: Shield,
    href: '/security',
    group: 'Navigation',
  },
  {
    id: 'nav-credentials',
    label: 'Credentials',
    description: 'Manage credentials',
    icon: Key,
    href: '/security/credentials',
    group: 'Navigation',
    keywords: ['keys', 'secrets', 'api'],
  },
  {
    id: 'nav-sandbox',
    label: 'Sandbox',
    description: 'View sandbox logs',
    icon: Container,
    href: '/sandbox',
    group: 'Navigation',
    keywords: ['docker', 'container'],
  },
  {
    id: 'nav-costs',
    label: 'Costs',
    description: 'View usage costs',
    icon: DollarSign,
    href: '/costs',
    group: 'Navigation',
    keywords: ['billing', 'usage', 'money'],
  },
  {
    id: 'nav-settings',
    label: 'Settings',
    description: 'Application settings',
    icon: Settings,
    href: '/settings',
    group: 'Navigation',
  },
  {
    id: 'nav-network',
    label: 'Network',
    description: 'Network settings',
    icon: Network,
    href: '/settings/network',
    group: 'Navigation',
  },

  // Quick Lookups
  {
    id: 'lookup-weather',
    label: 'Weather',
    description: 'Current weather conditions',
    icon: Cloud,
    group: 'Quick Lookup',
    hasInlineResult: true,
    keywords: ['temperature', 'forecast'],
  },
  {
    id: 'lookup-time',
    label: 'Current Time',
    description: 'Show current time and date',
    icon: Clock,
    group: 'Quick Lookup',
    hasInlineResult: true,
    keywords: ['date', 'now'],
  },
  {
    id: 'lookup-github',
    label: 'GitHub Status',
    description: 'PRs awaiting review, CI status',
    icon: Github,
    group: 'Quick Lookup',
    hasInlineResult: true,
    keywords: ['pr', 'pull request', 'ci'],
  },
  {
    id: 'lookup-email',
    label: 'Email Summary',
    description: 'Unread count and latest emails',
    icon: Mail,
    group: 'Quick Lookup',
    hasInlineResult: true,
    keywords: ['inbox', 'gmail', 'unread'],
  },
  {
    id: 'lookup-calendar',
    label: 'Next Event',
    description: 'Upcoming calendar events',
    icon: Calendar,
    group: 'Quick Lookup',
    hasInlineResult: true,
    keywords: ['meeting', 'schedule', 'appointment'],
  },
]

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  additionalCommands?: CommandItem[]
}

export function CommandPalette({
  open,
  onOpenChange,
  additionalCommands = [],
}: CommandPaletteProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [inlineResult, setInlineResult] = useState<InlineResultData | null>(null)
  const [isLoadingResult, setIsLoadingResult] = useState(false)

  const commands = useMemo(
    () => [...DEFAULT_COMMANDS, ...additionalCommands],
    [additionalCommands]
  )

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands

    const searchTerms = query.toLowerCase().split(/\s+/)
    return commands.filter((cmd) => {
      const searchText = [
        cmd.label,
        cmd.description,
        ...(cmd.keywords || []),
      ]
        .join(' ')
        .toLowerCase()

      return searchTerms.every((term) => searchText.includes(term))
    })
  }, [commands, query])

  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {}
    for (const cmd of filteredCommands) {
      const group = cmd.group || 'Commands'
      if (!groups[group]) groups[group] = []
      groups[group].push(cmd)
    }
    return groups
  }, [filteredCommands])

  const selectedCommand = filteredCommands[selectedIndex]

  // Reset selection when filtered results change
  useEffect(() => {
    setSelectedIndex(0)
    setInlineResult(null)
  }, [query])

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      setQuery('')
      setSelectedIndex(0)
      setInlineResult(null)
    }
  }, [open])

  // Load inline result when selection changes
  useEffect(() => {
    if (selectedCommand?.hasInlineResult && selectedCommand.getInlineResult) {
      setIsLoadingResult(true)
      selectedCommand
        .getInlineResult()
        .then(setInlineResult)
        .catch(() => setInlineResult(null))
        .finally(() => setIsLoadingResult(false))
    } else {
      setInlineResult(null)
    }
  }, [selectedCommand])

  const executeCommand = useCallback(
    async (command: CommandItem) => {
      if (command.action) {
        await command.action()
      } else if (command.href) {
        router.push(command.href)
      }
      onOpenChange(false)
    },
    [router, onOpenChange]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) =>
            Math.min(prev + 1, filteredCommands.length - 1)
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => Math.max(prev - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (selectedCommand) {
            executeCommand(selectedCommand)
          }
          break
        case 'Escape':
          e.preventDefault()
          onOpenChange(false)
          break
      }
    },
    [filteredCommands.length, selectedCommand, executeCommand, onOpenChange]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Command Palette</DialogTitle>

        {/* Search input */}
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="border-0 focus-visible:ring-0 h-12"
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>

        <div className="flex">
          {/* Command list */}
          <ScrollArea className="flex-1 max-h-[400px]">
            {filteredCommands.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No commands found</p>
              </div>
            ) : (
              <div className="p-2">
                {Object.entries(groupedCommands).map(([group, items]) => (
                  <div key={group} className="mb-4 last:mb-0">
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      {group}
                    </div>
                    {items.map((command) => {
                      const globalIndex = filteredCommands.indexOf(command)
                      const isSelected = globalIndex === selectedIndex

                      return (
                        <button
                          key={command.id}
                          onClick={() => executeCommand(command)}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          className={cn(
                            'w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-colors',
                            isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                          )}
                        >
                          <div
                            className={cn(
                              'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                              isSelected ? 'bg-primary/10' : 'bg-muted'
                            )}
                          >
                            <command.icon
                              className={cn(
                                'h-4 w-4',
                                isSelected ? 'text-primary' : 'text-muted-foreground'
                              )}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{command.label}</p>
                            {command.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {command.description}
                              </p>
                            )}
                          </div>
                          {command.hasInlineResult && (
                            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          {command.shortcut && (
                            <kbd className="hidden sm:inline-flex h-5 items-center rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground shrink-0">
                              {command.shortcut}
                            </kbd>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Inline result panel */}
          {selectedCommand?.hasInlineResult && (
            <div className="w-64 border-l bg-muted/30 p-3">
              {isLoadingResult ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : inlineResult ? (
                <InlineResult data={inlineResult} />
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  <p>Loading...</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-3 py-2 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted rounded">↑</kbd>
              <kbd className="px-1 py-0.5 bg-muted rounded">↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted rounded">↵</kbd>
              select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted rounded">esc</kbd>
              close
            </span>
          </div>
          <span>{filteredCommands.length} commands</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Hook to use the command palette
export function useCommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return {
    open,
    setOpen,
    toggle: () => setOpen((prev) => !prev),
  }
}
