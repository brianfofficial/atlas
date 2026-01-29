'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  AtlasWSClient,
  WSClientConfig,
  WSConnectionState,
  WSMessage,
  getWSClient,
} from '@/lib/websocket-client'

/**
 * Hook for WebSocket connection
 *
 * Usage:
 * ```tsx
 * function ApprovalDashboard() {
 *   const { isConnected, subscribe, onMessage } = useWebSocket()
 *
 *   useEffect(() => {
 *     const unsub = onMessage('event:approval:created', (msg) => {
 *       console.log('New approval:', msg.payload)
 *     })
 *     return unsub
 *   }, [])
 *
 *   return <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
 * }
 * ```
 */
export function useWebSocket(config?: Partial<WSClientConfig>) {
  const [state, setState] = useState<WSConnectionState>('disconnected')
  const clientRef = useRef<AtlasWSClient | null>(null)

  useEffect(() => {
    const client = getWSClient(config)
    clientRef.current = client

    // Subscribe to state changes
    const unsubState = client.onStateChange(setState)

    // Connect if not connected
    if (!client.isConnected()) {
      client.connect()
    } else {
      setState(client.getState())
    }

    return () => {
      unsubState()
      // Don't disconnect on unmount - keep connection alive
    }
  }, [])

  const subscribe = useCallback((eventTypes: string[]) => {
    clientRef.current?.subscribe(eventTypes)
  }, [])

  const unsubscribe = useCallback((eventTypes: string[]) => {
    clientRef.current?.unsubscribe(eventTypes)
  }, [])

  const onMessage = useCallback((eventType: string, handler: (msg: WSMessage) => void) => {
    return clientRef.current?.on(eventType, handler) ?? (() => {})
  }, [])

  const send = useCallback((type: string, payload: unknown) => {
    return clientRef.current?.send(type, payload) ?? false
  }, [])

  const authenticate = useCallback((sessionId: string, userId?: string) => {
    clientRef.current?.authenticate(sessionId, userId)
  }, [])

  return {
    state,
    isConnected: state === 'connected',
    isConnecting: state === 'connecting',
    hasError: state === 'error',
    subscribe,
    unsubscribe,
    onMessage,
    send,
    authenticate,
  }
}

/**
 * Hook for subscribing to approval events
 */
export function useApprovalEvents(handlers: {
  onCreated?: (approval: unknown) => void
  onApproved?: (approval: unknown) => void
  onDenied?: (approval: unknown) => void
  onExpired?: (approval: unknown) => void
}) {
  const { onMessage, isConnected } = useWebSocket()

  useEffect(() => {
    if (!isConnected) return

    const unsubs: (() => void)[] = []

    if (handlers.onCreated) {
      unsubs.push(onMessage('event:approval:created', (msg) => handlers.onCreated!(msg.payload)))
    }
    if (handlers.onApproved) {
      unsubs.push(onMessage('event:approval:approved', (msg) => handlers.onApproved!(msg.payload)))
    }
    if (handlers.onDenied) {
      unsubs.push(onMessage('event:approval:denied', (msg) => handlers.onDenied!(msg.payload)))
    }
    if (handlers.onExpired) {
      unsubs.push(onMessage('event:approval:expired', (msg) => handlers.onExpired!(msg.payload)))
    }

    return () => {
      for (const unsub of unsubs) {
        unsub()
      }
    }
  }, [isConnected, handlers, onMessage])
}
