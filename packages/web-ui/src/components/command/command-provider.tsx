'use client'

import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import { CommandPalette, type CommandItem } from './command-palette'
import type { InlineResultData } from './inline-result'

interface CommandContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  registerCommand: (command: CommandItem) => void
  unregisterCommand: (id: string) => void
}

const CommandContext = createContext<CommandContextValue | null>(null)

export function useCommand() {
  const context = useContext(CommandContext)
  if (!context) {
    throw new Error('useCommand must be used within a CommandProvider')
  }
  return context
}

interface CommandProviderProps {
  children: React.ReactNode
}

export function CommandProvider({ children }: CommandProviderProps) {
  const [open, setOpen] = useState(false)
  const [additionalCommands, setAdditionalCommands] = useState<CommandItem[]>([])

  // Keyboard shortcut
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

  const toggle = useCallback(() => {
    setOpen((prev) => !prev)
  }, [])

  const registerCommand = useCallback((command: CommandItem) => {
    setAdditionalCommands((prev) => {
      // Don't add if already exists
      if (prev.some((c) => c.id === command.id)) return prev
      return [...prev, command]
    })
  }, [])

  const unregisterCommand = useCallback((id: string) => {
    setAdditionalCommands((prev) => prev.filter((c) => c.id !== id))
  }, [])

  // Add dynamic commands with inline results
  const commandsWithResults = useMemo(() => {
    return additionalCommands.map((cmd) => {
      if (cmd.hasInlineResult && !cmd.getInlineResult) {
        return {
          ...cmd,
          getInlineResult: () => getDefaultInlineResult(cmd.id),
        }
      }
      return cmd
    })
  }, [additionalCommands])

  const value = useMemo(
    () => ({
      open,
      setOpen,
      toggle,
      registerCommand,
      unregisterCommand,
    }),
    [open, toggle, registerCommand, unregisterCommand]
  )

  return (
    <CommandContext.Provider value={value}>
      {children}
      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        additionalCommands={commandsWithResults}
      />
    </CommandContext.Provider>
  )
}

// Default inline result fetchers for built-in commands
async function getDefaultInlineResult(commandId: string): Promise<InlineResultData> {
  switch (commandId) {
    case 'lookup-weather':
      return getWeatherResult()
    case 'lookup-time':
      return getTimeResult()
    case 'lookup-github':
      return getGitHubResult()
    case 'lookup-email':
      return getEmailResult()
    case 'lookup-calendar':
      return getCalendarResult()
    default:
      return { type: 'generic', title: 'Unknown' }
  }
}

async function getWeatherResult(): Promise<InlineResultData> {
  // In a real implementation, this would call the weather API
  // For now, return mock data
  return {
    type: 'weather',
    location: 'San Francisco',
    temperature: 68,
    condition: 'clear',
    high: 72,
    low: 58,
    humidity: 65,
  }
}

function getTimeResult(): Promise<InlineResultData> {
  const now = new Date()
  return Promise.resolve({
    type: 'time',
    time: now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
    date: now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
}

async function getGitHubResult(): Promise<InlineResultData> {
  // In a real implementation, this would call the GitHub API
  return {
    type: 'github',
    prsAwaitingReview: 3,
    myOpenPRs: 2,
    ciStatus: 'passing',
    recentCommits: 5,
    link: {
      label: 'Open GitHub',
      href: 'https://github.com',
    },
  }
}

async function getEmailResult(): Promise<InlineResultData> {
  // In a real implementation, this would call the Gmail API
  return {
    type: 'email',
    unreadCount: 12,
    latestSender: 'GitHub',
    latestSubject: 'Your PR was approved',
    link: {
      label: 'Open Gmail',
      href: 'https://mail.google.com',
    },
  }
}

async function getCalendarResult(): Promise<InlineResultData> {
  // In a real implementation, this would call the Calendar API
  return {
    type: 'calendar',
    nextEvent: 'Team Standup',
    nextEventTime: 'In 30 minutes',
    eventCount: 4,
    link: {
      label: 'Open Calendar',
      href: 'https://calendar.google.com',
    },
  }
}
