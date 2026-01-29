/**
 * Chat API
 *
 * Handles chat conversations and message management.
 */

import { apiGet, apiPost, apiDelete, apiPatch } from './client'
import type { UploadedFile } from './files'

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  attachments?: MessageAttachment[]
  metadata?: {
    model?: string
    tokensUsed?: number
    duration?: number
  }
  createdAt: string
}

export interface MessageAttachment {
  id: string
  name: string
  size: number
  type: string
  url: string
  thumbnailUrl?: string
}

export interface Conversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
  lastMessage?: string
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[]
}

export interface SendMessageRequest {
  content: string
  attachments?: string[] // File IDs
}

export interface SendMessageResponse {
  userMessage: Message
  assistantMessage: Message
}

/**
 * Get all conversations
 */
export async function getConversations(): Promise<Conversation[]> {
  return apiGet<Conversation[]>('/api/chat/conversations')
}

/**
 * Get a single conversation with messages
 */
export async function getConversation(id: string): Promise<ConversationWithMessages> {
  return apiGet<ConversationWithMessages>(`/api/chat/conversations/${id}`)
}

/**
 * Create a new conversation
 */
export async function createConversation(title?: string): Promise<Conversation> {
  return apiPost<Conversation>('/api/chat/conversations', { title })
}

/**
 * Delete a conversation
 */
export async function deleteConversation(id: string): Promise<void> {
  return apiDelete(`/api/chat/conversations/${id}`)
}

/**
 * Update conversation title
 */
export async function updateConversation(
  id: string,
  updates: { title?: string }
): Promise<Conversation> {
  return apiPatch<Conversation>(`/api/chat/conversations/${id}`, updates)
}

/**
 * Send a message to a conversation
 */
export async function sendMessage(
  conversationId: string,
  request: SendMessageRequest
): Promise<SendMessageResponse> {
  return apiPost<SendMessageResponse>(
    `/api/chat/conversations/${conversationId}/messages`,
    request
  )
}

/**
 * Search messages across all conversations
 */
export async function searchMessages(
  query: string,
  options?: {
    conversationId?: string
    startDate?: string
    endDate?: string
    limit?: number
  }
): Promise<{ messages: Message[]; total: number }> {
  const params = new URLSearchParams({ q: query })
  if (options?.conversationId) params.set('conversationId', options.conversationId)
  if (options?.startDate) params.set('startDate', options.startDate)
  if (options?.endDate) params.set('endDate', options.endDate)
  if (options?.limit) params.set('limit', options.limit.toString())

  return apiGet(`/api/chat/messages/search?${params}`)
}

/**
 * Export conversation to Markdown
 */
export function exportToMarkdown(
  conversation: ConversationWithMessages,
  options?: { includeSystem?: boolean }
): string {
  const lines: string[] = []

  lines.push(`# ${conversation.title}`)
  lines.push('')
  lines.push(`_Exported on ${new Date().toLocaleDateString()}_`)
  lines.push('')
  lines.push('---')
  lines.push('')

  for (const message of conversation.messages) {
    if (message.role === 'system' && !options?.includeSystem) continue

    const roleLabel = {
      user: '**You**',
      assistant: '**Atlas**',
      system: '_System_',
    }[message.role]

    const time = new Date(message.createdAt).toLocaleString()

    lines.push(`### ${roleLabel}`)
    lines.push(`_${time}_`)
    lines.push('')
    lines.push(message.content)
    lines.push('')

    if (message.attachments && message.attachments.length > 0) {
      lines.push('**Attachments:**')
      for (const attachment of message.attachments) {
        lines.push(`- [${attachment.name}](${attachment.url})`)
      }
      lines.push('')
    }

    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Convert file list to MessageAttachment format
 */
export function filesToAttachments(files: UploadedFile[]): MessageAttachment[] {
  return files.map((file) => ({
    id: file.id,
    name: file.name,
    size: file.size,
    type: file.type,
    url: file.url,
    thumbnailUrl: file.thumbnailUrl,
  }))
}
