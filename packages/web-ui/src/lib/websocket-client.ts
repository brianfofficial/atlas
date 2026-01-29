/**
 * WebSocket Client
 *
 * Client-side WebSocket connection manager for real-time updates.
 */

/**
 * WebSocket message from server
 */
export interface WSMessage {
  type: string
  payload: unknown
  id?: string
  timestamp: string
}

/**
 * Connection state
 */
export type WSConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

/**
 * Client configuration
 */
export interface WSClientConfig {
  url: string
  reconnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
  heartbeatInterval?: number
}

const DEFAULT_CONFIG: WSClientConfig = {
  url: 'ws://localhost:18790/ws',
  reconnect: true,
  reconnectInterval: 5000,
  maxReconnectAttempts: 10,
  heartbeatInterval: 30000,
}

/**
 * Event handlers
 */
type MessageHandler = (message: WSMessage) => void
type StateHandler = (state: WSConnectionState) => void

/**
 * WebSocket Client
 */
export class AtlasWSClient {
  private config: WSClientConfig
  private ws: WebSocket | null = null
  private reconnectAttempts: number = 0
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map()
  private stateHandlers: Set<StateHandler> = new Set()
  private currentState: WSConnectionState = 'disconnected'
  private sessionId?: string
  private userId?: string

  constructor(config?: Partial<WSClientConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return
    }

    this.setState('connecting')

    try {
      this.ws = new WebSocket(this.config.url)
      this.ws.onopen = this.handleOpen.bind(this)
      this.ws.onmessage = this.handleMessage.bind(this)
      this.ws.onclose = this.handleClose.bind(this)
      this.ws.onerror = this.handleError.bind(this)
    } catch (error) {
      this.setState('error')
      this.scheduleReconnect()
    }
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    this.clearTimers()
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }
    this.setState('disconnected')
  }

  /**
   * Send a message to the server
   */
  send(type: string, payload: unknown): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false
    }

    const message: WSMessage = {
      type,
      payload,
      timestamp: new Date().toISOString(),
    }

    try {
      this.ws.send(JSON.stringify(message))
      return true
    } catch {
      return false
    }
  }

  /**
   * Subscribe to specific event types
   */
  subscribe(eventTypes: string[]): void {
    this.send('subscribe', eventTypes)
  }

  /**
   * Unsubscribe from event types
   */
  unsubscribe(eventTypes: string[]): void {
    this.send('unsubscribe', eventTypes)
  }

  /**
   * Authenticate the connection
   */
  authenticate(sessionId: string, userId?: string): void {
    this.sessionId = sessionId
    this.userId = userId
    this.send('auth', { sessionId, userId })
  }

  /**
   * Add a message handler for a specific event type
   */
  on(eventType: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(eventType)) {
      this.messageHandlers.set(eventType, new Set())
    }
    this.messageHandlers.get(eventType)!.add(handler)

    // Return unsubscribe function
    return () => {
      this.messageHandlers.get(eventType)?.delete(handler)
    }
  }

  /**
   * Add a handler for any message
   */
  onAny(handler: MessageHandler): () => void {
    return this.on('*', handler)
  }

  /**
   * Add a state change handler
   */
  onStateChange(handler: StateHandler): () => void {
    this.stateHandlers.add(handler)
    return () => {
      this.stateHandlers.delete(handler)
    }
  }

  /**
   * Get current connection state
   */
  getState(): WSConnectionState {
    return this.currentState
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.currentState === 'connected'
  }

  // Private methods

  private handleOpen(): void {
    this.reconnectAttempts = 0
    this.setState('connected')
    this.startHeartbeat()

    // Re-authenticate if we have credentials
    if (this.sessionId) {
      this.authenticate(this.sessionId, this.userId)
    }
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data) as WSMessage
      this.dispatchMessage(message)
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error)
    }
  }

  private handleClose(event: CloseEvent): void {
    this.clearTimers()
    this.ws = null

    if (event.code === 1000) {
      // Normal close
      this.setState('disconnected')
    } else {
      // Abnormal close, try to reconnect
      this.setState('error')
      this.scheduleReconnect()
    }
  }

  private handleError(): void {
    this.setState('error')
  }

  private setState(state: WSConnectionState): void {
    if (this.currentState === state) return
    this.currentState = state

    for (const handler of this.stateHandlers) {
      try {
        handler(state)
      } catch (error) {
        console.error('State handler error:', error)
      }
    }
  }

  private dispatchMessage(message: WSMessage): void {
    // Dispatch to specific handlers
    const handlers = this.messageHandlers.get(message.type)
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(message)
        } catch (error) {
          console.error('Message handler error:', error)
        }
      }
    }

    // Dispatch to wildcard handlers
    const wildcardHandlers = this.messageHandlers.get('*')
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        try {
          handler(message)
        } catch (error) {
          console.error('Wildcard handler error:', error)
        }
      }
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.send('ping', null)
    }, this.config.heartbeatInterval ?? 30000)
  }

  private scheduleReconnect(): void {
    if (!this.config.reconnect) return
    if (this.reconnectAttempts >= (this.config.maxReconnectAttempts ?? 10)) {
      console.error('Max reconnect attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.config.reconnectInterval ?? 5000

    this.reconnectTimeout = setTimeout(() => {
      this.connect()
    }, delay)
  }

  private clearTimers(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }
}

// Singleton instance
let client: AtlasWSClient | null = null

/**
 * Get the WebSocket client instance
 */
export function getWSClient(config?: Partial<WSClientConfig>): AtlasWSClient {
  if (!client) {
    client = new AtlasWSClient(config)
  }
  return client
}

/**
 * Connect the client if not already connected
 */
export function connectWS(config?: Partial<WSClientConfig>): AtlasWSClient {
  const wsClient = getWSClient(config)
  if (!wsClient.isConnected()) {
    wsClient.connect()
  }
  return wsClient
}
