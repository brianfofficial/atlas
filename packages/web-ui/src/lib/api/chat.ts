/**
 * Chat API
 *
 * Handles chat conversations and message management.
 * Supports SSE streaming for real-time AI responses.
 */

import { apiGet, apiPost, apiDelete, apiPatch, tokenManager, apiClient } from './client'
import type { UploadedFile } from './files'

// Get API base URL from the client configuration
const getApiBase = () => {
  // Use the same base URL as the apiClient
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:18789'
}

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
  stream?: boolean
}

export interface SendMessageResponse {
  userMessage: Message
  assistantMessage: Message
}

export interface StreamChunk {
  delta?: string
  done?: boolean
  id?: string
  model?: string
  tokensUsed?: number
  duration?: number
  error?: string
}

export type StreamCallback = (chunk: StreamChunk) => void

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
 * Send a message to a conversation (non-streaming)
 */
export async function sendMessage(
  conversationId: string,
  request: SendMessageRequest
): Promise<SendMessageResponse> {
  return apiPost<SendMessageResponse>(
    `/api/chat/conversations/${conversationId}/messages`,
    { ...request, stream: false }
  )
}

/**
 * Send a message with SSE streaming response
 * Returns an AbortController that can be used to cancel the stream
 */
export function streamMessage(
  conversationId: string,
  request: SendMessageRequest,
  callbacks: {
    onChunk: StreamCallback
    onComplete: (message: Message) => void
    onError: (error: Error) => void
  }
): AbortController {
  const controller = new AbortController()

  const fetchStream = async () => {
    const token = tokenManager.getToken()

    try {
      const response = await fetch(
        `${getApiBase()}/api/chat/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ ...request, stream: true }),
          signal: controller.signal,
        }
      )

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }))
        throw new Error(error.message || `HTTP ${response.status}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''
      let messageId = ''
      let model = ''
      let tokensUsed = 0
      let duration = 0

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue

          try {
            const data = JSON.parse(line.slice(6)) as StreamChunk

            if (data.error) {
              callbacks.onError(new Error(data.error))
              return
            }

            if (data.delta) {
              fullContent += data.delta
              callbacks.onChunk(data)
            }

            if (data.done) {
              messageId = data.id || messageId
              model = data.model || model
              tokensUsed = data.tokensUsed || tokensUsed
              duration = data.duration || duration
            }
          } catch {
            // Ignore parse errors for incomplete JSON
          }
        }
      }

      // Call completion callback with final message
      callbacks.onComplete({
        id: messageId,
        conversationId,
        role: 'assistant',
        content: fullContent,
        metadata: {
          model,
          tokensUsed,
          duration,
        },
        createdAt: new Date().toISOString(),
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Stream was cancelled, don't report as error
        return
      }
      callbacks.onError(error instanceof Error ? error : new Error(String(error)))
    }
  }

  // Start fetching in background
  fetchStream()

  return controller
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
