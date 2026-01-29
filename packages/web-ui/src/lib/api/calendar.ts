/**
 * Google Calendar API Client
 *
 * Integration with Google Calendar API for event management.
 * Requires OAuth 2.0 authentication with Google.
 */

import { apiGet, apiPost, apiPut, apiDelete } from './client'

export interface Calendar {
  id: string
  summary: string
  description?: string
  timeZone: string
  backgroundColor?: string
  foregroundColor?: string
  selected: boolean
  primary: boolean
  accessRole: 'owner' | 'writer' | 'reader' | 'freeBusyReader'
}

export interface EventAttendee {
  email: string
  displayName?: string
  responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted'
  organizer?: boolean
  self?: boolean
}

export interface EventReminder {
  method: 'email' | 'popup'
  minutes: number
}

export interface CalendarEvent {
  id: string
  calendarId: string
  summary: string
  description?: string
  location?: string
  start: Date
  end: Date
  timeZone?: string
  isAllDay: boolean
  status: 'confirmed' | 'tentative' | 'cancelled'
  creator?: {
    email: string
    displayName?: string
    self?: boolean
  }
  organizer?: {
    email: string
    displayName?: string
    self?: boolean
  }
  attendees?: EventAttendee[]
  hangoutLink?: string
  conferenceData?: {
    conferenceId: string
    conferenceSolution: {
      name: string
      iconUri?: string
    }
    entryPoints?: Array<{
      entryPointType: string
      uri: string
      label?: string
    }>
  }
  recurrence?: string[]
  recurringEventId?: string
  visibility: 'default' | 'public' | 'private' | 'confidential'
  reminders?: {
    useDefault: boolean
    overrides?: EventReminder[]
  }
  colorId?: string
  htmlLink?: string
  updated: Date
}

export interface EventCreate {
  summary: string
  description?: string
  location?: string
  start: Date
  end: Date
  timeZone?: string
  isAllDay?: boolean
  attendees?: string[]
  addConference?: boolean
  reminders?: EventReminder[]
  visibility?: 'default' | 'public' | 'private'
  calendarId?: string
}

export interface FreeBusyQuery {
  timeMin: Date
  timeMax: Date
  items: Array<{ id: string }>
}

export interface FreeBusyResponse {
  calendars: Record<
    string,
    {
      busy: Array<{ start: string; end: string }>
      errors?: Array<{ domain: string; reason: string }>
    }
  >
}

/**
 * Check if Calendar is connected
 */
export async function isCalendarConnected(): Promise<boolean> {
  try {
    const result = await apiGet<{ connected: boolean }>('/api/integrations/calendar/status')
    return result.connected
  } catch {
    return false
  }
}

/**
 * Get Calendar OAuth URL (shared with Gmail)
 */
export async function getCalendarAuthUrl(): Promise<string> {
  const result = await apiGet<{ url: string }>('/api/integrations/calendar/auth-url')
  return result.url
}

/**
 * Disconnect Calendar
 */
export async function disconnectCalendar(): Promise<void> {
  return apiDelete('/api/integrations/calendar/disconnect')
}

/**
 * Get all calendars
 */
export async function getCalendars(): Promise<Calendar[]> {
  return apiGet<Calendar[]>('/api/integrations/calendar/calendars')
}

/**
 * Get today's events
 */
export async function getTodayEvents(calendarIds?: string[]): Promise<CalendarEvent[]> {
  const params = new URLSearchParams()
  if (calendarIds?.length) {
    params.set('calendarIds', calendarIds.join(','))
  }
  return apiGet<CalendarEvent[]>(`/api/integrations/calendar/today?${params}`)
}

/**
 * Get events for a date range
 */
export async function getEvents(
  startDate: Date,
  endDate: Date,
  options?: {
    calendarIds?: string[]
    maxResults?: number
    singleEvents?: boolean
  }
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: startDate.toISOString(),
    timeMax: endDate.toISOString(),
  })

  if (options?.calendarIds?.length) {
    params.set('calendarIds', options.calendarIds.join(','))
  }
  if (options?.maxResults) {
    params.set('maxResults', options.maxResults.toString())
  }
  if (options?.singleEvents !== undefined) {
    params.set('singleEvents', options.singleEvents.toString())
  }

  return apiGet<CalendarEvent[]>(`/api/integrations/calendar/events?${params}`)
}

/**
 * Get upcoming events (next 7 days)
 */
export async function getUpcomingEvents(maxResults = 10): Promise<CalendarEvent[]> {
  const now = new Date()
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  return getEvents(now, weekFromNow, { maxResults, singleEvents: true })
}

/**
 * Get a single event
 */
export async function getEvent(calendarId: string, eventId: string): Promise<CalendarEvent> {
  return apiGet<CalendarEvent>(
    `/api/integrations/calendar/calendars/${calendarId}/events/${eventId}`
  )
}

/**
 * Create a new event
 */
export async function createEvent(event: EventCreate): Promise<CalendarEvent> {
  const calendarId = event.calendarId || 'primary'
  return apiPost<CalendarEvent>(
    `/api/integrations/calendar/calendars/${calendarId}/events`,
    event
  )
}

/**
 * Update an event
 */
export async function updateEvent(
  calendarId: string,
  eventId: string,
  updates: Partial<EventCreate>
): Promise<CalendarEvent> {
  return apiPut<CalendarEvent>(
    `/api/integrations/calendar/calendars/${calendarId}/events/${eventId}`,
    updates
  )
}

/**
 * Delete an event
 */
export async function deleteEvent(calendarId: string, eventId: string): Promise<void> {
  return apiDelete(`/api/integrations/calendar/calendars/${calendarId}/events/${eventId}`)
}

/**
 * RSVP to an event
 */
export async function respondToEvent(
  calendarId: string,
  eventId: string,
  response: 'accepted' | 'declined' | 'tentative'
): Promise<CalendarEvent> {
  return apiPost<CalendarEvent>(
    `/api/integrations/calendar/calendars/${calendarId}/events/${eventId}/respond`,
    { response }
  )
}

/**
 * Check free/busy status
 */
export async function checkFreeBusy(
  startTime: Date,
  endTime: Date,
  calendarIds?: string[]
): Promise<FreeBusyResponse> {
  return apiPost<FreeBusyResponse>('/api/integrations/calendar/freebusy', {
    timeMin: startTime.toISOString(),
    timeMax: endTime.toISOString(),
    items: (calendarIds || ['primary']).map((id) => ({ id })),
  })
}

/**
 * Find available meeting slots
 */
export async function findAvailableSlots(
  startDate: Date,
  endDate: Date,
  durationMinutes: number,
  attendeeCalendars?: string[]
): Promise<Array<{ start: Date; end: Date }>> {
  const result = await apiPost<Array<{ start: string; end: string }>>(
    '/api/integrations/calendar/find-slots',
    {
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      durationMinutes,
      attendees: attendeeCalendars,
    }
  )

  return result.map((slot) => ({
    start: new Date(slot.start),
    end: new Date(slot.end),
  }))
}

/**
 * Quick add event (natural language parsing)
 */
export async function quickAddEvent(
  text: string,
  calendarId = 'primary'
): Promise<CalendarEvent> {
  return apiPost<CalendarEvent>('/api/integrations/calendar/quick-add', {
    text,
    calendarId,
  })
}

// Utility functions

/**
 * Check if two events overlap
 */
export function eventsOverlap(event1: CalendarEvent, event2: CalendarEvent): boolean {
  return event1.start < event2.end && event2.start < event1.end
}

/**
 * Get the duration of an event in minutes
 */
export function getEventDuration(event: CalendarEvent): number {
  return (event.end.getTime() - event.start.getTime()) / 60000
}

/**
 * Check if an event has a video conference
 */
export function hasVideoConference(event: CalendarEvent): boolean {
  return !!(event.hangoutLink || event.conferenceData)
}

/**
 * Get the video conference link
 */
export function getConferenceLink(event: CalendarEvent): string | null {
  if (event.hangoutLink) return event.hangoutLink

  const videoEntry = event.conferenceData?.entryPoints?.find(
    (e) => e.entryPointType === 'video'
  )
  return videoEntry?.uri || null
}

/**
 * Format event time for display
 */
export function formatEventTime(event: CalendarEvent): string {
  if (event.isAllDay) {
    return 'All day'
  }

  const startTime = event.start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  const endTime = event.end.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return `${startTime} - ${endTime}`
}
