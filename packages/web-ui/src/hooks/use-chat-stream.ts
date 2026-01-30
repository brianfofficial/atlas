'use client'

import { useState, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  streamMessage,
  type Message,
  type SendMessageRequest,
  type StreamChunk,
  type ConversationWithMessages,
} from '@/lib/api/chat'

interface UseChatStreamOptions {
  conversationId: string
  onStreamStart?: () => void
  onStreamEnd?: () => void
  onError?: (error: Error) => void
}

interface UseChatStreamReturn {
  sendStreamingMessage: (content: string, attachments?: string[]) => void
  cancelStream: () => void
  isStreaming: boolean
  streamingContent: string
  streamingMessage: Message | null
  error: Error | null
}

/**
 * Hook for sending messages with SSE streaming responses
 * Integrates with React Query for optimistic updates
 */
export function useChatStream({
  conversationId,
  onStreamStart,
  onStreamEnd,
  onError,
}: UseChatStreamOptions): UseChatStreamReturn {
  const queryClient = useQueryClient()
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [streamingMessage, setStreamingMessage] = useState<Message | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsStreaming(false)
    setStreamingContent('')
    setStreamingMessage(null)
  }, [])

  const sendStreamingMessage = useCallback(
    (content: string, attachments?: string[]) => {
      // Cancel any existing stream
      cancelStream()

      setError(null)
      setIsStreaming(true)
      setStreamingContent('')
      onStreamStart?.()

      // Create optimistic user message
      const userMessageId = crypto.randomUUID()
      const userMessage: Message = {
        id: userMessageId,
        conversationId,
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      }

      // Create placeholder for streaming message
      const streamingMessageId = `streaming-${crypto.randomUUID()}`
      const placeholderMessage: Message = {
        id: streamingMessageId,
        conversationId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
      }
      setStreamingMessage(placeholderMessage)

      // Optimistically add user message to cache
      queryClient.setQueryData<ConversationWithMessages>(
        ['conversation', conversationId],
        (old) => {
          if (!old) return old
          return {
            ...old,
            messages: [...old.messages, userMessage],
            messageCount: old.messageCount + 1,
          }
        }
      )

      const request: SendMessageRequest = {
        content,
        attachments,
        stream: true,
      }

      abortControllerRef.current = streamMessage(conversationId, request, {
        onChunk: (chunk: StreamChunk) => {
          if (chunk.delta) {
            setStreamingContent((prev) => {
              const newContent = prev + chunk.delta
              setStreamingMessage((msg) =>
                msg ? { ...msg, content: newContent } : null
              )
              return newContent
            })
          }
        },

        onComplete: (message: Message) => {
          setIsStreaming(false)
          setStreamingContent('')
          setStreamingMessage(null)
          abortControllerRef.current = null

          // Update cache with final message
          queryClient.setQueryData<ConversationWithMessages>(
            ['conversation', conversationId],
            (old) => {
              if (!old) return old
              return {
                ...old,
                messages: [...old.messages, message],
                messageCount: old.messageCount + 1,
                lastMessage: message.content.substring(0, 100),
              }
            }
          )

          // Invalidate conversations list to update last message preview
          queryClient.invalidateQueries({ queryKey: ['conversations'] })

          onStreamEnd?.()
        },

        onError: (err: Error) => {
          setIsStreaming(false)
          setStreamingContent('')
          setStreamingMessage(null)
          setError(err)
          abortControllerRef.current = null

          // Roll back optimistic update on error
          queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] })

          onError?.(err)
          onStreamEnd?.()
        },
      })
    },
    [conversationId, cancelStream, queryClient, onStreamStart, onStreamEnd, onError]
  )

  return {
    sendStreamingMessage,
    cancelStream,
    isStreaming,
    streamingContent,
    streamingMessage,
    error,
  }
}

/**
 * Alternative hook that returns the stream state without automatic React Query integration
 * Useful when you need more control over state management
 */
export function useChatStreamBasic() {
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [error, setError] = useState<Error | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const startStream = useCallback(
    (
      conversationId: string,
      content: string,
      attachments?: string[]
    ): Promise<Message> => {
      return new Promise((resolve, reject) => {
        // Cancel any existing stream
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }

        setError(null)
        setIsStreaming(true)
        setStreamingContent('')

        const request: SendMessageRequest = {
          content,
          attachments,
          stream: true,
        }

        abortControllerRef.current = streamMessage(conversationId, request, {
          onChunk: (chunk) => {
            if (chunk.delta) {
              setStreamingContent((prev) => prev + chunk.delta)
            }
          },
          onComplete: (message) => {
            setIsStreaming(false)
            setStreamingContent('')
            abortControllerRef.current = null
            resolve(message)
          },
          onError: (err) => {
            setIsStreaming(false)
            setStreamingContent('')
            setError(err)
            abortControllerRef.current = null
            reject(err)
          },
        })
      })
    },
    []
  )

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsStreaming(false)
    setStreamingContent('')
  }, [])

  return {
    startStream,
    cancelStream,
    isStreaming,
    streamingContent,
    error,
  }
}
