/**
 * Service Types
 *
 * Common types and interfaces for external service integrations.
 *
 * @module @atlas/gateway/services/types
 */

/**
 * Base result for all service operations
 */
export interface ServiceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

/**
 * Email recipient
 */
export interface EmailRecipient {
  email: string;
  name?: string;
}

/**
 * Email draft to send
 */
export interface EmailDraft {
  id: string;
  to: EmailRecipient[];
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  subject: string;
  body: string;
  bodyFormat?: 'text' | 'html';
  replyToMessageId?: string;
  threadId?: string;
  attachments?: EmailAttachment[];
}

/**
 * Email attachment
 */
export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

/**
 * Sent email result
 */
export interface SentEmailResult {
  messageId: string;
  threadId?: string;
  sentAt: string;
}

/**
 * Calendar event
 */
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  attendees?: CalendarAttendee[];
  isAllDay?: boolean;
  recurrence?: string;
}

/**
 * Calendar attendee
 */
export interface CalendarAttendee {
  email: string;
  name?: string;
  status?: 'pending' | 'accepted' | 'declined' | 'tentative';
  required?: boolean;
}

/**
 * Calendar note/annotation
 */
export interface CalendarNote {
  id: string;
  eventId: string;
  content: string;
  type: 'prep' | 'follow_up' | 'reminder' | 'general';
  createdAt: string;
}

/**
 * Task item
 */
export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assignee?: string;
  tags?: string[];
  parentTaskId?: string;
  linkedEventId?: string;
  linkedEmailId?: string;
}

/**
 * Task reminder
 */
export interface TaskReminder {
  id: string;
  taskId?: string;
  title: string;
  description?: string;
  remindAt: string;
  recurring?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval?: number;
    endDate?: string;
  };
}

/**
 * Service configuration
 */
export interface ServiceConfig {
  enabled: boolean;
  mockMode: boolean; // For development/testing
  credentials?: {
    apiKey?: string;
    clientId?: string;
    clientSecret?: string;
    accessToken?: string;
    refreshToken?: string;
  };
  settings?: Record<string, unknown>;
}

/**
 * Service health status
 */
export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'unavailable';
  lastCheck: string;
  latencyMs?: number;
  error?: string;
}
