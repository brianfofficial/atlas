'use client'

import {
  Cloud,
  Sun,
  CloudRain,
  CloudSnow,
  Wind,
  Mail,
  Calendar,
  Github,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowUpRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type InlineResultType =
  | 'weather'
  | 'time'
  | 'github'
  | 'email'
  | 'calendar'
  | 'generic'

export interface InlineResultData {
  type: InlineResultType
  title?: string
  // Weather specific
  temperature?: number
  condition?: string
  high?: number
  low?: number
  humidity?: number
  location?: string
  // Time specific
  time?: string
  date?: string
  timezone?: string
  // GitHub specific
  prsAwaitingReview?: number
  myOpenPRs?: number
  ciStatus?: 'passing' | 'failing' | 'pending' | 'none'
  recentCommits?: number
  // Email specific
  unreadCount?: number
  latestSender?: string
  latestSubject?: string
  // Calendar specific
  nextEvent?: string
  nextEventTime?: string
  eventCount?: number
  // Generic
  value?: string | number
  description?: string
  items?: Array<{ label: string; value: string | number }>
  link?: { label: string; href: string }
}

interface InlineResultProps {
  data: InlineResultData
  className?: string
}

export function InlineResult({ data, className }: InlineResultProps) {
  switch (data.type) {
    case 'weather':
      return <WeatherResult data={data} className={className} />
    case 'time':
      return <TimeResult data={data} className={className} />
    case 'github':
      return <GitHubResult data={data} className={className} />
    case 'email':
      return <EmailResult data={data} className={className} />
    case 'calendar':
      return <CalendarResult data={data} className={className} />
    default:
      return <GenericResult data={data} className={className} />
  }
}

function WeatherResult({ data, className }: InlineResultProps) {
  const WeatherIcon = {
    clear: Sun,
    cloudy: Cloud,
    rain: CloudRain,
    snow: CloudSnow,
    windy: Wind,
  }[data.condition?.toLowerCase() || 'clear'] || Cloud

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <WeatherIcon className="h-5 w-5 text-primary" />
        <span className="font-medium text-sm">{data.location || 'Weather'}</span>
      </div>

      <div className="flex items-end gap-2">
        <span className="text-4xl font-bold">{data.temperature}°</span>
        <span className="text-muted-foreground mb-1 capitalize">{data.condition}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 rounded bg-muted/50">
          <p className="text-muted-foreground">High</p>
          <p className="font-medium">{data.high}°</p>
        </div>
        <div className="p-2 rounded bg-muted/50">
          <p className="text-muted-foreground">Low</p>
          <p className="font-medium">{data.low}°</p>
        </div>
        {data.humidity !== undefined && (
          <div className="p-2 rounded bg-muted/50 col-span-2">
            <p className="text-muted-foreground">Humidity</p>
            <p className="font-medium">{data.humidity}%</p>
          </div>
        )}
      </div>
    </div>
  )
}

function TimeResult({ data, className }: InlineResultProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <Clock className="h-5 w-5 text-primary" />
        <span className="font-medium text-sm">Current Time</span>
      </div>

      <div>
        <p className="text-3xl font-bold tabular-nums">{data.time}</p>
        <p className="text-muted-foreground text-sm">{data.date}</p>
      </div>

      {data.timezone && (
        <p className="text-xs text-muted-foreground">{data.timezone}</p>
      )}
    </div>
  )
}

function GitHubResult({ data, className }: InlineResultProps) {
  const statusColors = {
    passing: 'text-success',
    failing: 'text-danger',
    pending: 'text-warning',
    none: 'text-muted-foreground',
  }

  const StatusIcon = {
    passing: CheckCircle,
    failing: XCircle,
    pending: AlertCircle,
    none: AlertCircle,
  }[data.ciStatus || 'none']

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <Github className="h-5 w-5 text-primary" />
        <span className="font-medium text-sm">GitHub Status</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between p-2 rounded bg-muted/50">
          <span className="text-xs text-muted-foreground">PRs to Review</span>
          <span className="font-bold">{data.prsAwaitingReview || 0}</span>
        </div>

        <div className="flex items-center justify-between p-2 rounded bg-muted/50">
          <span className="text-xs text-muted-foreground">My Open PRs</span>
          <span className="font-bold">{data.myOpenPRs || 0}</span>
        </div>

        {data.ciStatus && (
          <div className="flex items-center justify-between p-2 rounded bg-muted/50">
            <span className="text-xs text-muted-foreground">CI Status</span>
            <div className={cn('flex items-center gap-1', statusColors[data.ciStatus])}>
              <StatusIcon className="h-4 w-4" />
              <span className="text-xs font-medium capitalize">{data.ciStatus}</span>
            </div>
          </div>
        )}
      </div>

      {data.link && (
        <a
          href={data.link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          {data.link.label}
          <ArrowUpRight className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}

function EmailResult({ data, className }: InlineResultProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-primary" />
        <span className="font-medium text-sm">Email</span>
      </div>

      <div className="flex items-end gap-2">
        <span className="text-4xl font-bold">{data.unreadCount || 0}</span>
        <span className="text-muted-foreground mb-1">unread</span>
      </div>

      {data.latestSender && (
        <div className="p-2 rounded bg-muted/50 space-y-1">
          <p className="text-xs text-muted-foreground">Latest from</p>
          <p className="font-medium text-sm truncate">{data.latestSender}</p>
          {data.latestSubject && (
            <p className="text-xs text-muted-foreground truncate">{data.latestSubject}</p>
          )}
        </div>
      )}

      {data.link && (
        <a
          href={data.link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          {data.link.label}
          <ArrowUpRight className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}

function CalendarResult({ data, className }: InlineResultProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5 text-primary" />
        <span className="font-medium text-sm">Calendar</span>
      </div>

      {data.nextEvent ? (
        <>
          <div>
            <p className="text-xs text-muted-foreground">Next Event</p>
            <p className="font-medium">{data.nextEvent}</p>
            {data.nextEventTime && (
              <p className="text-sm text-muted-foreground">{data.nextEventTime}</p>
            )}
          </div>

          {data.eventCount !== undefined && data.eventCount > 1 && (
            <p className="text-xs text-muted-foreground">
              +{data.eventCount - 1} more today
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No upcoming events</p>
      )}

      {data.link && (
        <a
          href={data.link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          {data.link.label}
          <ArrowUpRight className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}

function GenericResult({ data, className }: InlineResultProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {data.title && (
        <p className="font-medium text-sm">{data.title}</p>
      )}

      {data.value !== undefined && (
        <p className="text-3xl font-bold">{data.value}</p>
      )}

      {data.description && (
        <p className="text-sm text-muted-foreground">{data.description}</p>
      )}

      {data.items && data.items.length > 0 && (
        <div className="space-y-2">
          {data.items.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 rounded bg-muted/50"
            >
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <span className="font-medium text-sm">{item.value}</span>
            </div>
          ))}
        </div>
      )}

      {data.link && (
        <a
          href={data.link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          {data.link.label}
          <ArrowUpRight className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}
