'use client'

import { useState, useEffect } from 'react'
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Video,
  AlertCircle,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

interface CalendarEvent {
  id: string
  title: string
  startTime: Date
  endTime: Date
  location?: string
  isVideoCall?: boolean
  attendees?: number
  description?: string
  color?: string
  isAllDay?: boolean
}

interface CalendarWidgetProps {
  className?: string
  events?: CalendarEvent[]
  isLoading?: boolean
  onRefresh?: () => void
  onEventClick?: (event: CalendarEvent) => void
}

export function CalendarWidget({
  className,
  events = [],
  isLoading,
  onRefresh,
  onEventClick,
}: CalendarWidgetProps) {
  const now = new Date()
  const todayEvents = events.filter((e) => isSameDay(e.startTime, now))
  const nextEvent = todayEvents.find((e) => e.startTime > now) || todayEvents[0]

  // Calculate time until next event
  const timeUntil = nextEvent ? getTimeUntil(nextEvent.startTime) : null

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Today's Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-12 w-1 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Today's Schedule
          </CardTitle>
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-xs">
              {todayEvents.length} event{todayEvents.length !== 1 ? 's' : ''}
            </Badge>
            {onRefresh && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {todayEvents.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No events scheduled for today</p>
          </div>
        ) : (
          <div className="space-y-1">
            {/* Next event highlight */}
            {nextEvent && timeUntil && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-primary">Up Next</span>
                  <span className="text-xs text-muted-foreground">{timeUntil}</span>
                </div>
                <p className="font-medium">{nextEvent.title}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTime(nextEvent.startTime)}
                  </span>
                  {nextEvent.isVideoCall && (
                    <span className="flex items-center gap-1 text-primary">
                      <Video className="h-3 w-3" />
                      Video call
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Event timeline */}
            <div className="space-y-1">
              {todayEvents.map((event, index) => (
                <EventItem
                  key={event.id}
                  event={event}
                  isNext={event.id === nextEvent?.id}
                  isPast={event.endTime < now}
                  onClick={() => onEventClick?.(event)}
                />
              ))}
            </div>

            {/* Conflicts warning */}
            {hasConflicts(todayEvents) && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-warning/10 text-warning text-sm mt-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>You have overlapping meetings today</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface EventItemProps {
  event: CalendarEvent
  isNext?: boolean
  isPast?: boolean
  onClick?: () => void
}

function EventItem({ event, isNext, isPast, onClick }: EventItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 p-2 rounded-lg text-left transition-colors',
        isPast ? 'opacity-50' : 'hover:bg-muted',
        isNext && 'ring-1 ring-primary/20'
      )}
    >
      {/* Color bar */}
      <div
        className={cn('w-1 h-12 rounded-full shrink-0', event.color || 'bg-primary')}
        style={event.color ? { backgroundColor: event.color } : undefined}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn('font-medium text-sm truncate', isPast && 'line-through')}>
            {event.title}
          </p>
          {event.isVideoCall && <Video className="h-3 w-3 text-muted-foreground shrink-0" />}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {event.isAllDay ? 'All day' : `${formatTime(event.startTime)} - ${formatTime(event.endTime)}`}
          </span>

          {event.location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{event.location}</span>
            </span>
          )}

          {event.attendees && event.attendees > 1 && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {event.attendees}
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 self-center" />
    </button>
  )
}

// Utility functions
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function getTimeUntil(date: Date): string {
  const now = new Date()
  const diff = date.getTime() - now.getTime()

  if (diff < 0) return 'Now'

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)

  if (minutes < 1) return 'Starting now'
  if (minutes < 60) return `In ${minutes} min`
  if (hours < 24) return `In ${hours}h ${minutes % 60}m`
  return 'Tomorrow'
}

function hasConflicts(events: CalendarEvent[]): boolean {
  const sorted = [...events].sort((a, b) => a.startTime.getTime() - b.startTime.getTime())

  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].endTime > sorted[i + 1].startTime) {
      return true
    }
  }

  return false
}

// Event color palette for visual variety
const EVENT_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4']

// Hook for fetching calendar data
export function useCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState<boolean | null>(null)

  const fetchEvents = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Import the calendar API client dynamically
      const { isCalendarConnected, getTodayEvents, hasVideoConference } = await import('@/lib/api/calendar')

      // Check if calendar is connected
      const connected = await isCalendarConnected()
      setIsConnected(connected)

      if (!connected) {
        // Return empty array if not connected - UI will show connection prompt
        setEvents([])
        return
      }

      // Fetch real events
      const apiEvents = await getTodayEvents()

      // Transform API events to widget format
      const widgetEvents: CalendarEvent[] = apiEvents.map((event, index) => ({
        id: event.id,
        title: event.summary,
        startTime: new Date(event.start),
        endTime: new Date(event.end),
        location: event.location,
        isVideoCall: hasVideoConference(event),
        attendees: event.attendees?.length ?? 1,
        description: event.description,
        color: EVENT_COLORS[index % EVENT_COLORS.length],
        isAllDay: event.isAllDay,
      }))

      setEvents(widgetEvents)
    } catch (err) {
      console.error('Calendar fetch error:', err)
      setError('Failed to load calendar')
      setEvents([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  return { events, isLoading, error, isConnected, refresh: fetchEvents }
}
