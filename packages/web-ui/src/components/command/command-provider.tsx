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
  try {
    const { getWeatherForCurrentLocation, getWeatherByCity } = await import('@/lib/api/weather')
    let weatherData
    try {
      weatherData = await getWeatherForCurrentLocation()
    } catch {
      weatherData = await getWeatherByCity('New York')
    }
    return {
      type: 'weather',
      location: weatherData.current.location,
      temperature: Math.round(weatherData.current.temperature),
      condition: weatherData.current.condition.main.toLowerCase(),
      high: Math.round(weatherData.forecast[0]?.high ?? weatherData.current.temperature + 5),
      low: Math.round(weatherData.forecast[0]?.low ?? weatherData.current.temperature - 10),
      humidity: weatherData.current.humidity,
    }
  } catch {
    // Fallback if API fails
    return {
      type: 'weather',
      location: 'Weather unavailable',
      temperature: 0,
      condition: 'unknown',
      high: 0,
      low: 0,
      humidity: 0,
    }
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
  try {
    const { isGitHubConnected, getPRsAwaitingReview, getMyOpenPRs } = await import('@/lib/api/github')
    const connected = await isGitHubConnected()

    if (!connected) {
      return {
        type: 'github',
        prsAwaitingReview: 0,
        myOpenPRs: 0,
        ciStatus: 'none',
        recentCommits: 0,
        link: { label: 'Connect GitHub', href: '/settings/integrations' },
      }
    }

    const [prsToReview, myPRs] = await Promise.all([
      getPRsAwaitingReview().catch(() => []),
      getMyOpenPRs().catch(() => []),
    ])

    return {
      type: 'github',
      prsAwaitingReview: prsToReview.length,
      myOpenPRs: myPRs.length,
      ciStatus: 'none',
      recentCommits: 0,
      link: { label: 'Open GitHub', href: 'https://github.com' },
    }
  } catch {
    return {
      type: 'github',
      prsAwaitingReview: 0,
      myOpenPRs: 0,
      ciStatus: 'none',
      recentCommits: 0,
      link: { label: 'Open GitHub', href: 'https://github.com' },
    }
  }
}

async function getEmailResult(): Promise<InlineResultData> {
  try {
    const { isGmailConnected, getInboxSummary } = await import('@/lib/api/gmail')
    const connected = await isGmailConnected()

    if (!connected) {
      return {
        type: 'email',
        unreadCount: 0,
        latestSender: '',
        latestSubject: 'Connect Gmail to see emails',
        link: { label: 'Connect Gmail', href: '/settings/integrations' },
      }
    }

    const summary = await getInboxSummary()
    const latest = summary.recentThreads[0]?.messages[0]

    return {
      type: 'email',
      unreadCount: summary.unreadCount,
      latestSender: latest?.from?.name || 'Unknown',
      latestSubject: latest?.subject || 'No recent emails',
      link: { label: 'Open Gmail', href: 'https://mail.google.com' },
    }
  } catch {
    return {
      type: 'email',
      unreadCount: 0,
      latestSender: '',
      latestSubject: 'Email unavailable',
      link: { label: 'Open Gmail', href: 'https://mail.google.com' },
    }
  }
}

async function getCalendarResult(): Promise<InlineResultData> {
  try {
    const { isCalendarConnected, getTodayEvents } = await import('@/lib/api/calendar')
    const connected = await isCalendarConnected()

    if (!connected) {
      return {
        type: 'calendar',
        nextEvent: 'Connect Calendar',
        nextEventTime: 'to see your schedule',
        eventCount: 0,
        link: { label: 'Connect Calendar', href: '/settings/integrations' },
      }
    }

    const events = await getTodayEvents()
    const now = new Date()
    const nextEvent = events.find(e => new Date(e.start) > now)

    let nextEventTime = 'No more events today'
    if (nextEvent) {
      const diff = new Date(nextEvent.start).getTime() - now.getTime()
      const mins = Math.round(diff / 60000)
      if (mins < 1) nextEventTime = 'Starting now'
      else if (mins < 60) nextEventTime = `In ${mins} minutes`
      else nextEventTime = `In ${Math.round(mins / 60)} hours`
    }

    return {
      type: 'calendar',
      nextEvent: nextEvent?.summary || 'No upcoming events',
      nextEventTime,
      eventCount: events.length,
      link: { label: 'Open Calendar', href: 'https://calendar.google.com' },
    }
  } catch {
    return {
      type: 'calendar',
      nextEvent: 'Calendar unavailable',
      nextEventTime: '',
      eventCount: 0,
      link: { label: 'Open Calendar', href: 'https://calendar.google.com' },
    }
  }
}
