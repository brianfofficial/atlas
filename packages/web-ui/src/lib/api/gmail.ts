/**
 * Gmail API Client
 *
 * Integration with Gmail API for inbox management and email operations.
 * Requires OAuth 2.0 authentication with Google.
 */

import { apiGet, apiPost, apiDelete } from './client'

export interface GmailProfile {
  emailAddress: string
  messagesTotal: number
  threadsTotal: number
  historyId: string
}

export interface GmailLabel {
  id: string
  name: string
  type: 'system' | 'user'
  messagesTotal: number
  messagesUnread: number
  color?: {
    backgroundColor: string
    textColor: string
  }
}

export interface EmailAddress {
  name?: string
  email: string
}

export interface GmailMessage {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  subject: string
  from: EmailAddress
  to: EmailAddress[]
  cc?: EmailAddress[]
  date: Date
  isUnread: boolean
  isStarred: boolean
  hasAttachments: boolean
  body?: {
    plain?: string
    html?: string
  }
  attachments?: Array<{
    id: string
    filename: string
    mimeType: string
    size: number
  }>
}

export interface GmailThread {
  id: string
  snippet: string
  historyId: string
  messages: GmailMessage[]
  messagesCount: number
}

export interface GmailDraft {
  id: string
  message: Partial<GmailMessage>
}

export interface EmailComposition {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  isHtml?: boolean
  replyTo?: string
  threadId?: string
}

/**
 * Check if Gmail is connected
 */
export async function isGmailConnected(): Promise<boolean> {
  try {
    const result = await apiGet<{ connected: boolean }>('/api/integrations/gmail/status')
    return result.connected
  } catch {
    return false
  }
}

/**
 * Get Gmail OAuth URL
 */
export async function getGmailAuthUrl(): Promise<string> {
  const result = await apiGet<{ url: string }>('/api/integrations/gmail/auth-url')
  return result.url
}

/**
 * Disconnect Gmail
 */
export async function disconnectGmail(): Promise<void> {
  return apiDelete('/api/integrations/gmail/disconnect')
}

/**
 * Get Gmail profile
 */
export async function getGmailProfile(): Promise<GmailProfile> {
  return apiGet<GmailProfile>('/api/integrations/gmail/profile')
}

/**
 * Get all labels
 */
export async function getLabels(): Promise<GmailLabel[]> {
  return apiGet<GmailLabel[]>('/api/integrations/gmail/labels')
}

/**
 * Get inbox summary
 */
export async function getInboxSummary(): Promise<{
  unreadCount: number
  starredCount: number
  importantCount: number
  draftsCount: number
  recentThreads: GmailThread[]
}> {
  return apiGet('/api/integrations/gmail/inbox/summary')
}

/**
 * List messages with optional filters
 */
export async function listMessages(options?: {
  query?: string
  labelIds?: string[]
  maxResults?: number
  pageToken?: string
}): Promise<{
  messages: GmailMessage[]
  nextPageToken?: string
  resultSizeEstimate: number
}> {
  const params = new URLSearchParams()
  if (options?.query) params.set('q', options.query)
  if (options?.labelIds) params.set('labelIds', options.labelIds.join(','))
  if (options?.maxResults) params.set('maxResults', options.maxResults.toString())
  if (options?.pageToken) params.set('pageToken', options.pageToken)

  return apiGet(`/api/integrations/gmail/messages?${params}`)
}

/**
 * Get a single message
 */
export async function getMessage(id: string): Promise<GmailMessage> {
  return apiGet<GmailMessage>(`/api/integrations/gmail/messages/${id}`)
}

/**
 * Get a thread with all messages
 */
export async function getThread(id: string): Promise<GmailThread> {
  return apiGet<GmailThread>(`/api/integrations/gmail/threads/${id}`)
}

/**
 * Search messages
 */
export async function searchMessages(query: string, maxResults = 20): Promise<GmailMessage[]> {
  const result = await listMessages({ query, maxResults })
  return result.messages
}

/**
 * Mark message as read
 */
export async function markAsRead(messageId: string): Promise<void> {
  return apiPost(`/api/integrations/gmail/messages/${messageId}/read`)
}

/**
 * Mark message as unread
 */
export async function markAsUnread(messageId: string): Promise<void> {
  return apiPost(`/api/integrations/gmail/messages/${messageId}/unread`)
}

/**
 * Star a message
 */
export async function starMessage(messageId: string): Promise<void> {
  return apiPost(`/api/integrations/gmail/messages/${messageId}/star`)
}

/**
 * Unstar a message
 */
export async function unstarMessage(messageId: string): Promise<void> {
  return apiPost(`/api/integrations/gmail/messages/${messageId}/unstar`)
}

/**
 * Archive a message (remove from INBOX)
 */
export async function archiveMessage(messageId: string): Promise<void> {
  return apiPost(`/api/integrations/gmail/messages/${messageId}/archive`)
}

/**
 * Move message to trash
 */
export async function trashMessage(messageId: string): Promise<void> {
  return apiPost(`/api/integrations/gmail/messages/${messageId}/trash`)
}

/**
 * Permanently delete a message
 */
export async function deleteMessage(messageId: string): Promise<void> {
  return apiDelete(`/api/integrations/gmail/messages/${messageId}`)
}

/**
 * Add labels to a message
 */
export async function addLabels(messageId: string, labelIds: string[]): Promise<void> {
  return apiPost(`/api/integrations/gmail/messages/${messageId}/labels/add`, { labelIds })
}

/**
 * Remove labels from a message
 */
export async function removeLabels(messageId: string, labelIds: string[]): Promise<void> {
  return apiPost(`/api/integrations/gmail/messages/${messageId}/labels/remove`, { labelIds })
}

/**
 * Create a draft
 */
export async function createDraft(email: EmailComposition): Promise<GmailDraft> {
  return apiPost<GmailDraft>('/api/integrations/gmail/drafts', email)
}

/**
 * Update a draft
 */
export async function updateDraft(draftId: string, email: EmailComposition): Promise<GmailDraft> {
  return apiPost<GmailDraft>(`/api/integrations/gmail/drafts/${draftId}`, email)
}

/**
 * Send a draft
 */
export async function sendDraft(draftId: string): Promise<GmailMessage> {
  return apiPost<GmailMessage>(`/api/integrations/gmail/drafts/${draftId}/send`)
}

/**
 * Send an email directly
 */
export async function sendEmail(email: EmailComposition): Promise<GmailMessage> {
  return apiPost<GmailMessage>('/api/integrations/gmail/send', email)
}

/**
 * Get VIP senders (frequent or important contacts)
 */
export async function getVIPSenders(): Promise<string[]> {
  return apiGet<string[]>('/api/integrations/gmail/vip-senders')
}

/**
 * Set VIP senders
 */
export async function setVIPSenders(emails: string[]): Promise<void> {
  return apiPost('/api/integrations/gmail/vip-senders', { emails })
}

// Gmail query helpers
export const GmailQueries = {
  unread: 'is:unread',
  starred: 'is:starred',
  important: 'is:important',
  fromVIP: (emails: string[]) => emails.map((e) => `from:${e}`).join(' OR '),
  hasAttachment: 'has:attachment',
  inInbox: 'in:inbox',
  inSent: 'in:sent',
  today: 'newer_than:1d',
  thisWeek: 'newer_than:7d',
  larger: (size: string) => `larger:${size}`,
}

/**
 * Build a Gmail search query
 */
export function buildQuery(parts: string[]): string {
  return parts.filter(Boolean).join(' ')
}
