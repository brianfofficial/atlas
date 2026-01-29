/**
 * Slack API Client
 *
 * Integration with Slack Web API for messaging and notifications.
 * Requires OAuth with workspace.
 */

import { apiGet, apiPost, apiDelete } from './client'

export interface SlackUser {
  id: string
  name: string
  realName: string
  displayName: string
  email?: string
  avatar?: string
  isBot: boolean
  isAdmin: boolean
  status?: {
    text: string
    emoji: string
    expiration?: Date
  }
  presence?: 'active' | 'away'
}

export interface SlackChannel {
  id: string
  name: string
  isPrivate: boolean
  isArchived: boolean
  isMember: boolean
  topic?: string
  purpose?: string
  memberCount?: number
  unreadCount?: number
  lastRead?: string
}

export interface SlackMessage {
  ts: string // timestamp, used as message ID
  channelId: string
  userId: string
  user?: SlackUser
  text: string
  blocks?: unknown[]
  attachments?: Array<{
    title?: string
    text?: string
    color?: string
    imageUrl?: string
  }>
  threadTs?: string
  replyCount?: number
  reactions?: Array<{
    name: string
    count: number
    users: string[]
  }>
  files?: Array<{
    id: string
    name: string
    mimetype: string
    size: number
    url: string
    thumbnailUrl?: string
  }>
  timestamp: Date
}

export interface SlackThread {
  parentMessage: SlackMessage
  replies: SlackMessage[]
  replyCount: number
  latestReply?: Date
}

export interface SlackMention {
  channelId: string
  channelName: string
  message: SlackMessage
  mentionType: 'direct' | 'channel' | 'here' | 'thread'
}

export interface SlackNotification {
  id: string
  type: 'mention' | 'dm' | 'reaction' | 'reply'
  channelId: string
  channelName?: string
  message?: SlackMessage
  timestamp: Date
  read: boolean
}

/**
 * Check if Slack is connected
 */
export async function isSlackConnected(): Promise<boolean> {
  try {
    const result = await apiGet<{ connected: boolean }>('/api/integrations/slack/status')
    return result.connected
  } catch {
    return false
  }
}

/**
 * Get Slack OAuth URL
 */
export async function getSlackAuthUrl(): Promise<string> {
  const result = await apiGet<{ url: string }>('/api/integrations/slack/auth-url')
  return result.url
}

/**
 * Disconnect Slack
 */
export async function disconnectSlack(): Promise<void> {
  return apiDelete('/api/integrations/slack/disconnect')
}

/**
 * Get current user info
 */
export async function getCurrentUser(): Promise<SlackUser> {
  return apiGet<SlackUser>('/api/integrations/slack/me')
}

/**
 * Get workspace info
 */
export async function getWorkspaceInfo(): Promise<{
  id: string
  name: string
  domain: string
  icon?: string
}> {
  return apiGet('/api/integrations/slack/workspace')
}

/**
 * Get all channels
 */
export async function getChannels(options?: {
  excludeArchived?: boolean
  types?: ('public_channel' | 'private_channel' | 'mpim' | 'im')[]
}): Promise<SlackChannel[]> {
  const params = new URLSearchParams()
  if (options?.excludeArchived) params.set('exclude_archived', 'true')
  if (options?.types) params.set('types', options.types.join(','))

  return apiGet<SlackChannel[]>(`/api/integrations/slack/channels?${params}`)
}

/**
 * Get recent DMs
 */
export async function getDirectMessages(limit = 20): Promise<SlackChannel[]> {
  return apiGet<SlackChannel[]>(`/api/integrations/slack/dms?limit=${limit}`)
}

/**
 * Get channel messages
 */
export async function getMessages(
  channelId: string,
  options?: {
    limit?: number
    oldest?: string
    latest?: string
  }
): Promise<SlackMessage[]> {
  const params = new URLSearchParams()
  if (options?.limit) params.set('limit', options.limit.toString())
  if (options?.oldest) params.set('oldest', options.oldest)
  if (options?.latest) params.set('latest', options.latest)

  return apiGet<SlackMessage[]>(
    `/api/integrations/slack/channels/${channelId}/messages?${params}`
  )
}

/**
 * Get thread replies
 */
export async function getThread(channelId: string, threadTs: string): Promise<SlackThread> {
  return apiGet<SlackThread>(
    `/api/integrations/slack/channels/${channelId}/threads/${threadTs}`
  )
}

/**
 * Get unread mentions
 */
export async function getUnreadMentions(): Promise<SlackMention[]> {
  return apiGet<SlackMention[]>('/api/integrations/slack/mentions')
}

/**
 * Get notifications summary
 */
export async function getNotificationsSummary(): Promise<{
  unreadMentions: number
  unreadDMs: number
  totalUnread: number
  recentMentions: SlackMention[]
}> {
  return apiGet('/api/integrations/slack/notifications/summary')
}

/**
 * Send a message to a channel
 */
export async function sendMessage(
  channelId: string,
  text: string,
  options?: {
    threadTs?: string
    blocks?: unknown[]
    unfurlLinks?: boolean
    unfurlMedia?: boolean
  }
): Promise<SlackMessage> {
  return apiPost<SlackMessage>(`/api/integrations/slack/channels/${channelId}/messages`, {
    text,
    ...options,
  })
}

/**
 * Send a DM to a user
 */
export async function sendDirectMessage(
  userId: string,
  text: string
): Promise<SlackMessage> {
  return apiPost<SlackMessage>('/api/integrations/slack/dm', { userId, text })
}

/**
 * Reply to a thread
 */
export async function replyToThread(
  channelId: string,
  threadTs: string,
  text: string
): Promise<SlackMessage> {
  return sendMessage(channelId, text, { threadTs })
}

/**
 * Add a reaction to a message
 */
export async function addReaction(
  channelId: string,
  timestamp: string,
  emoji: string
): Promise<void> {
  return apiPost('/api/integrations/slack/reactions/add', {
    channel: channelId,
    timestamp,
    name: emoji,
  })
}

/**
 * Remove a reaction from a message
 */
export async function removeReaction(
  channelId: string,
  timestamp: string,
  emoji: string
): Promise<void> {
  return apiPost('/api/integrations/slack/reactions/remove', {
    channel: channelId,
    timestamp,
    name: emoji,
  })
}

/**
 * Mark channel as read
 */
export async function markChannelRead(channelId: string, timestamp: string): Promise<void> {
  return apiPost(`/api/integrations/slack/channels/${channelId}/mark`, { ts: timestamp })
}

/**
 * Search messages
 */
export async function searchMessages(
  query: string,
  options?: {
    sort?: 'score' | 'timestamp'
    sortDir?: 'asc' | 'desc'
    count?: number
  }
): Promise<{
  messages: SlackMessage[]
  total: number
}> {
  const params = new URLSearchParams({ query })
  if (options?.sort) params.set('sort', options.sort)
  if (options?.sortDir) params.set('sort_dir', options.sortDir)
  if (options?.count) params.set('count', options.count.toString())

  return apiGet(`/api/integrations/slack/search?${params}`)
}

/**
 * Get user info
 */
export async function getUser(userId: string): Promise<SlackUser> {
  return apiGet<SlackUser>(`/api/integrations/slack/users/${userId}`)
}

/**
 * Get multiple users
 */
export async function getUsers(userIds: string[]): Promise<SlackUser[]> {
  return apiPost<SlackUser[]>('/api/integrations/slack/users/bulk', { userIds })
}

/**
 * Set user status
 */
export async function setStatus(
  text: string,
  emoji?: string,
  expiration?: Date
): Promise<void> {
  return apiPost('/api/integrations/slack/status', {
    text,
    emoji,
    expiration: expiration?.toISOString(),
  })
}

/**
 * Clear user status
 */
export async function clearStatus(): Promise<void> {
  return apiPost('/api/integrations/slack/status/clear')
}

/**
 * Set presence (active/away)
 */
export async function setPresence(presence: 'auto' | 'away'): Promise<void> {
  return apiPost('/api/integrations/slack/presence', { presence })
}

// Utility functions

/**
 * Parse Slack message text to extract mentions
 */
export function parseMentions(text: string): string[] {
  const mentionRegex = /<@([A-Z0-9]+)>/g
  const mentions: string[] = []
  let match

  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1])
  }

  return mentions
}

/**
 * Format message text for display (replace user IDs with names)
 */
export function formatMessageText(
  text: string,
  users: Map<string, SlackUser>
): string {
  return text.replace(/<@([A-Z0-9]+)>/g, (_, userId) => {
    const user = users.get(userId)
    return `@${user?.displayName || user?.name || userId}`
  })
}

/**
 * Convert Slack timestamp to Date
 */
export function tsToDate(ts: string): Date {
  return new Date(parseFloat(ts) * 1000)
}

/**
 * Convert Date to Slack timestamp
 */
export function dateToTs(date: Date): string {
  return (date.getTime() / 1000).toFixed(6)
}
