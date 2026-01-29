/**
 * WebSocket Server for Real-time Updates
 *
 * Provides real-time event streaming to connected clients
 * for approval notifications, execution updates, and more.
 */

import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import { randomUUID } from 'crypto'
import { getEventBus, AtlasEvent, AtlasEventHandlers } from './event-emitter.js'

/**
 * WebSocket message types
 */
export interface WSMessage {
  type: string
  payload: unknown
  id?: string
  timestamp: string
}

/**
 * Client connection info
 */
export interface WSClient {
  id: string
  socket: WebSocket
  sessionId?: string
  userId?: string
  connectedAt: Date
  lastPing: Date
  subscriptions: Set<string>
}

/**
 * Server configuration
 */
export interface WSServerConfig {
  port: number
  path?: string
  pingInterval?: number
  heartbeatTimeout?: number
  maxClients?: number
}

const DEFAULT_CONFIG: WSServerConfig = {
  port: 18790,
  path: '/ws',
  pingInterval: 30000, // 30 seconds
  heartbeatTimeout: 10000, // 10 seconds
  maxClients: 100,
}

/**
 * Atlas WebSocket Server
 *
 * Handles client connections and broadcasts events.
 */
export class AtlasWSServer {
  private wss: WebSocketServer | null = null
  private clients: Map<string, WSClient> = new Map()
  private config: WSServerConfig
  private pingInterval: NodeJS.Timeout | null = null
  private eventHandlers: Map<string, (...args: unknown[]) => void> = new Map()

  constructor(config?: Partial<WSServerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Start the WebSocket server
   */
  start(): void {
    if (this.wss) {
      throw new Error('WebSocket server is already running')
    }

    this.wss = new WebSocketServer({
      port: this.config.port,
      path: this.config.path,
    })

    this.wss.on('connection', this.handleConnection.bind(this))
    this.wss.on('error', this.handleError.bind(this))

    // Start heartbeat
    this.startHeartbeat()

    // Subscribe to events
    this.subscribeToEvents()

    console.log(`WebSocket server started on port ${this.config.port}`)
  }

  /**
   * Stop the WebSocket server
   */
  stop(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }

    // Unsubscribe from events
    this.unsubscribeFromEvents()

    // Close all connections
    for (const client of this.clients.values()) {
      client.socket.close(1000, 'Server shutting down')
    }
    this.clients.clear()

    if (this.wss) {
      this.wss.close()
      this.wss = null
    }
  }

  /**
   * Broadcast a message to all connected clients
   */
  broadcast(message: WSMessage, filter?: (client: WSClient) => boolean): void {
    const payload = JSON.stringify(message)

    for (const client of this.clients.values()) {
      if (client.socket.readyState !== WebSocket.OPEN) continue
      if (filter && !filter(client)) continue

      try {
        client.socket.send(payload)
      } catch (error) {
        console.error(`Failed to send to client ${client.id}:`, error)
      }
    }
  }

  /**
   * Send a message to a specific client
   */
  sendTo(clientId: string, message: WSMessage): boolean {
    const client = this.clients.get(clientId)
    if (!client || client.socket.readyState !== WebSocket.OPEN) {
      return false
    }

    try {
      client.socket.send(JSON.stringify(message))
      return true
    } catch (error) {
      console.error(`Failed to send to client ${clientId}:`, error)
      return false
    }
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size
  }

  /**
   * Get client info
   */
  getClients(): WSClient[] {
    return Array.from(this.clients.values())
  }

  // Private methods

  private handleConnection(socket: WebSocket, request: IncomingMessage): void {
    // Check max clients
    if (this.clients.size >= (this.config.maxClients ?? 100)) {
      socket.close(1013, 'Maximum clients reached')
      return
    }

    const clientId = randomUUID()
    const client: WSClient = {
      id: clientId,
      socket,
      connectedAt: new Date(),
      lastPing: new Date(),
      subscriptions: new Set(['*']), // Subscribe to all by default
    }

    this.clients.set(clientId, client)

    // Send welcome message
    this.sendTo(clientId, {
      type: 'connected',
      payload: { clientId },
      timestamp: new Date().toISOString(),
    })

    socket.on('message', (data) => this.handleMessage(client, data))
    socket.on('close', () => this.handleDisconnect(client))
    socket.on('pong', () => {
      client.lastPing = new Date()
    })
    socket.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error)
    })
  }

  private handleMessage(client: WSClient, data: unknown): void {
    try {
      const message = JSON.parse(String(data)) as WSMessage

      switch (message.type) {
        case 'subscribe':
          // Subscribe to specific event types
          if (Array.isArray(message.payload)) {
            for (const eventType of message.payload) {
              client.subscriptions.add(eventType)
            }
          }
          break

        case 'unsubscribe':
          // Unsubscribe from event types
          if (Array.isArray(message.payload)) {
            for (const eventType of message.payload) {
              client.subscriptions.delete(eventType)
            }
          }
          break

        case 'auth':
          // Associate session/user with this client
          const payload = message.payload as { sessionId?: string; userId?: string }
          if (payload.sessionId) client.sessionId = payload.sessionId
          if (payload.userId) client.userId = payload.userId
          break

        case 'ping':
          // Respond to client pings
          this.sendTo(client.id, {
            type: 'pong',
            payload: null,
            timestamp: new Date().toISOString(),
          })
          break
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error)
    }
  }

  private handleDisconnect(client: WSClient): void {
    this.clients.delete(client.id)
  }

  private handleError(error: Error): void {
    console.error('WebSocket server error:', error)
  }

  private startHeartbeat(): void {
    this.pingInterval = setInterval(() => {
      const now = Date.now()
      const timeout = this.config.heartbeatTimeout ?? 10000

      for (const [id, client] of this.clients) {
        // Check for dead connections
        if (now - client.lastPing.getTime() > timeout * 2) {
          client.socket.terminate()
          this.clients.delete(id)
          continue
        }

        // Send ping
        if (client.socket.readyState === WebSocket.OPEN) {
          client.socket.ping()
        }
      }
    }, this.config.pingInterval ?? 30000)
  }

  private subscribeToEvents(): void {
    const eventBus = getEventBus()

    // List of event types to forward
    const eventTypes: (keyof AtlasEventHandlers)[] = [
      'approval:created',
      'approval:approved',
      'approval:denied',
      'approval:auto_approved',
      'approval:expired',
      'security:injection_blocked',
      'security:credential_access',
      'security:rate_limited',
      'execution:started',
      'execution:completed',
      'execution:failed',
    ]

    for (const eventType of eventTypes) {
      const handler = (event: AtlasEvent) => {
        this.broadcastEvent(event)
      }

      eventBus.on(eventType, handler)
      this.eventHandlers.set(eventType, handler as (...args: unknown[]) => void)
    }
  }

  private unsubscribeFromEvents(): void {
    const eventBus = getEventBus()

    for (const [eventType, handler] of this.eventHandlers) {
      eventBus.off(eventType, handler)
    }
    this.eventHandlers.clear()
  }

  private broadcastEvent(event: AtlasEvent): void {
    const message: WSMessage = {
      type: `event:${event.type}`,
      payload: event,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    }

    // Broadcast to clients subscribed to this event type or '*'
    this.broadcast(message, (client) => {
      return client.subscriptions.has('*') || client.subscriptions.has(event.type)
    })
  }
}

// Default singleton instance
let defaultServer: AtlasWSServer | null = null

export function getWSServer(config?: Partial<WSServerConfig>): AtlasWSServer {
  if (!defaultServer) {
    defaultServer = new AtlasWSServer(config)
  }
  return defaultServer
}

/**
 * Start the default WebSocket server
 */
export function startWSServer(config?: Partial<WSServerConfig>): AtlasWSServer {
  const server = getWSServer(config)
  server.start()
  return server
}

/**
 * Stop the default WebSocket server
 */
export function stopWSServer(): void {
  if (defaultServer) {
    defaultServer.stop()
    defaultServer = null
  }
}
