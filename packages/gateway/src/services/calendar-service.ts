/**
 * Calendar Service
 *
 * Abstraction for calendar operations: event notes, meeting prep, and reminders.
 * V1 uses mock implementation; future versions can integrate with
 * Google Calendar, Outlook Calendar, or other providers.
 *
 * @module @atlas/gateway/services/calendar-service
 */

import { v4 as uuid } from 'uuid';
import pino from 'pino';
import type {
  ServiceResult,
  ServiceConfig,
  ServiceHealth,
  CalendarEvent,
  CalendarNote,
} from './types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const log = (pino as any)({
  name: 'calendar-service',
  level: process.env.LOG_LEVEL || 'info',
});

/**
 * Calendar service interface
 */
export interface ICalendarService {
  /**
   * Add a note to a calendar event
   */
  addEventNote(eventId: string, content: string, type: CalendarNote['type']): Promise<ServiceResult<CalendarNote>>;

  /**
   * Remove a note from a calendar event
   */
  removeEventNote(noteId: string): Promise<ServiceResult>;

  /**
   * Get events for a date range
   */
  getEvents(start: Date, end: Date): Promise<ServiceResult<CalendarEvent[]>>;

  /**
   * Get a specific event
   */
  getEvent(eventId: string): Promise<ServiceResult<CalendarEvent>>;

  /**
   * Get notes for an event
   */
  getEventNotes(eventId: string): Promise<ServiceResult<CalendarNote[]>>;

  /**
   * Get service health status
   */
  getHealth(): Promise<ServiceHealth>;
}

/**
 * Mock calendar service for V1 development
 * Simulates calendar operations without actual calendar access
 */
class MockCalendarService implements ICalendarService {
  private notes: Map<string, CalendarNote> = new Map();
  private eventNotes: Map<string, Set<string>> = new Map(); // eventId -> noteIds

  // Sample mock events for development
  private mockEvents: CalendarEvent[] = [
    {
      id: 'mock_event_1',
      title: 'Team Standup',
      description: 'Daily sync with the team',
      startTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      endTime: new Date(Date.now() + 5400000).toISOString(),
      attendees: [
        { email: 'alice@example.com', name: 'Alice', status: 'accepted' },
        { email: 'bob@example.com', name: 'Bob', status: 'tentative' },
      ],
    },
    {
      id: 'mock_event_2',
      title: 'Product Review',
      description: 'Weekly product review meeting',
      startTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      endTime: new Date(Date.now() + 90000000).toISOString(),
      location: 'Conference Room A',
    },
  ];

  async addEventNote(
    eventId: string,
    content: string,
    type: CalendarNote['type']
  ): Promise<ServiceResult<CalendarNote>> {
    const noteId = `mock_note_${uuid()}`;
    const note: CalendarNote = {
      id: noteId,
      eventId,
      content,
      type,
      createdAt: new Date().toISOString(),
    };

    log.info({
      action: 'add_event_note',
      eventId,
      noteId,
      type,
      contentPreview: content.substring(0, 50),
      mock: true,
    });

    this.notes.set(noteId, note);

    if (!this.eventNotes.has(eventId)) {
      this.eventNotes.set(eventId, new Set());
    }
    this.eventNotes.get(eventId)!.add(noteId);

    return {
      success: true,
      data: note,
    };
  }

  async removeEventNote(noteId: string): Promise<ServiceResult> {
    const note = this.notes.get(noteId);

    if (!note) {
      return {
        success: false,
        error: 'Note not found',
        errorCode: 'NOTE_NOT_FOUND',
      };
    }

    log.info({
      action: 'remove_event_note',
      noteId,
      eventId: note.eventId,
      mock: true,
    });

    this.notes.delete(noteId);
    this.eventNotes.get(note.eventId)?.delete(noteId);

    return { success: true };
  }

  async getEvents(start: Date, end: Date): Promise<ServiceResult<CalendarEvent[]>> {
    const events = this.mockEvents.filter((event) => {
      const eventStart = new Date(event.startTime);
      return eventStart >= start && eventStart <= end;
    });

    log.debug({
      action: 'get_events',
      start: start.toISOString(),
      end: end.toISOString(),
      count: events.length,
      mock: true,
    });

    return {
      success: true,
      data: events,
    };
  }

  async getEvent(eventId: string): Promise<ServiceResult<CalendarEvent>> {
    const event = this.mockEvents.find((e) => e.id === eventId);

    if (!event) {
      return {
        success: false,
        error: 'Event not found',
        errorCode: 'EVENT_NOT_FOUND',
      };
    }

    return {
      success: true,
      data: event,
    };
  }

  async getEventNotes(eventId: string): Promise<ServiceResult<CalendarNote[]>> {
    const noteIds = this.eventNotes.get(eventId) || new Set();
    const notes: CalendarNote[] = [];

    for (const noteId of noteIds) {
      const note = this.notes.get(noteId);
      if (note) {
        notes.push(note);
      }
    }

    return {
      success: true,
      data: notes,
    };
  }

  async getHealth(): Promise<ServiceHealth> {
    return {
      service: 'calendar',
      status: 'healthy',
      lastCheck: new Date().toISOString(),
      latencyMs: 8, // Mock latency
    };
  }
}

/**
 * Google Calendar API implementation placeholder
 * TODO: Implement when ready for real Google Calendar integration
 */
// class GoogleCalendarService implements ICalendarService { ... }

/**
 * Get calendar service instance
 */
let calendarServiceInstance: ICalendarService | null = null;

export function getCalendarService(config?: ServiceConfig): ICalendarService {
  if (!calendarServiceInstance) {
    // For V1, always use mock service
    calendarServiceInstance = new MockCalendarService();
    log.info('Calendar service initialized (mock mode)');
  }
  return calendarServiceInstance;
}

/**
 * Reset calendar service (for testing)
 */
export function resetCalendarService(): void {
  calendarServiceInstance = null;
}
