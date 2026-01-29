/**
 * Event Broadcaster
 *
 * Real-time event broadcasting to WebSocket clients.
 * Used for approval notifications, security alerts, cost updates, etc.
 *
 * @module @atlas/gateway/events/event-broadcaster
 */

import { WebSocketServer, WebSocket } from 'ws';
import pino from 'pino';
import { getJWTManager } from '../security/auth/jwt-manager.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const log = (pino as any)({ name: 'event-broadcaster' });

export type EventType =
  | 'approval:new'
  | 'approval:resolved'
  | 'security:alert'
  | 'cost:update'
  | 'session:expired';

export interface BroadcastEvent<T = unknown> {
  type: EventType;
  data: T;
  timestamp: string;
}

interface AuthenticatedClient {
  ws: WebSocket;
  userId: string;
  deviceId?: string;
  lastPing: number;
}

export interface EventBroadcaster {
  broadcast<T>(type: EventType, data: T): void;
  broadcastToUser<T>(userId: string, type: EventType, data: T): void;
  getConnectedCount(): number;
  getConnectedUsers(): string[];
  attachToServer(server: { on: (event: string, handler: (...args: unknown[]) => void) => void }): void;
}

class EventBroadcasterImpl implements EventBroadcaster {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, AuthenticatedClient> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start ping interval to keep connections alive
    this.pingInterval = setInterval(() => {
      this.pingClients();
    }, 30000); // 30 seconds
  }

  /**
   * Attach to an HTTP server for WebSocket upgrade
   */
  attachToServer(server: { on: (event: string, handler: (...args: unknown[]) => void) => void }): void {
    this.wss = new WebSocketServer({ noServer: true });

    const upgradeHandler = (...args: unknown[]): void => {
      const [request, socket, head] = args as [
        { url?: string; headers: Record<string, string> },
        unknown,
        unknown
      ];

      // Only handle /ws path
      if (!request.url?.startsWith('/ws')) {
        return;
      }

      // Verify authentication from query string
      const url = new URL(request.url, 'http://localhost');
      const token = url.searchParams.get('token');

      if (!token) {
        log.warn('WebSocket connection attempt without token');
        return;
      }

      try {
        const jwtManager = getJWTManager();
        const payload = jwtManager.verifyAccessToken(token);

        this.wss!.handleUpgrade(request as never, socket as never, head as never, (ws) => {
          this.handleConnection(ws, payload.sub, payload.deviceId);
        });
      } catch (error) {
        log.warn({ error }, 'WebSocket authentication failed');
      }
    };

    server.on('upgrade', upgradeHandler);
    log.info('WebSocket server attached');
  }

  /**
   * Handle a new WebSocket connection
   */
  private handleConnection(ws: WebSocket, userId: string, deviceId?: string): void {
    const client: AuthenticatedClient = {
      ws,
      userId,
      deviceId,
      lastPing: Date.now(),
    };

    this.clients.set(ws, client);
    log.info({ userId, deviceId }, 'WebSocket client connected');

    // Handle messages (for future bidirectional communication)
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        this.handleMessage(client, data);
      } catch {
        // Ignore invalid messages
      }
    });

    // Handle pong responses
    ws.on('pong', () => {
      client.lastPing = Date.now();
    });

    // Handle disconnect
    ws.on('close', () => {
      this.clients.delete(ws);
      log.info({ userId, deviceId }, 'WebSocket client disconnected');
    });

    // Handle errors
    ws.on('error', (error) => {
      log.error({ error, userId }, 'WebSocket error');
      this.clients.delete(ws);
    });

    // Send welcome message
    this.sendToClient(ws, {
      type: 'session:expired' as EventType, // Reusing type, should be 'connected'
      data: { message: 'Connected to Atlas event stream' },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle incoming messages from clients
   */
  private handleMessage(client: AuthenticatedClient, data: unknown): void {
    // Future: handle client-initiated events
    // For now, just acknowledge
  }

  /**
   * Send event to a specific client
   */
  private sendToClient<T>(ws: WebSocket, event: BroadcastEvent<T>): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }

  /**
   * Broadcast event to all connected clients
   */
  broadcast<T>(type: EventType, data: T): void {
    const event: BroadcastEvent<T> = {
      type,
      data,
      timestamp: new Date().toISOString(),
    };

    const message = JSON.stringify(event);
    let sentCount = 0;

    for (const [ws, client] of this.clients.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        sentCount++;
      }
    }

    log.debug({ type, sentCount }, 'Event broadcast');
  }

  /**
   * Broadcast event to a specific user
   */
  broadcastToUser<T>(userId: string, type: EventType, data: T): void {
    const event: BroadcastEvent<T> = {
      type,
      data,
      timestamp: new Date().toISOString(),
    };

    const message = JSON.stringify(event);
    let sentCount = 0;

    for (const [ws, client] of this.clients.entries()) {
      if (client.userId === userId && ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        sentCount++;
      }
    }

    log.debug({ type, userId, sentCount }, 'Event sent to user');
  }

  /**
   * Get count of connected clients
   */
  getConnectedCount(): number {
    return this.clients.size;
  }

  /**
   * Get list of connected user IDs
   */
  getConnectedUsers(): string[] {
    const userIds = new Set<string>();
    for (const client of this.clients.values()) {
      userIds.add(client.userId);
    }
    return Array.from(userIds);
  }

  /**
   * Ping clients to keep connections alive and detect stale ones
   */
  private pingClients(): void {
    const now = Date.now();
    const timeout = 60000; // 60 seconds

    for (const [ws, client] of this.clients.entries()) {
      if (now - client.lastPing > timeout) {
        // Client hasn't responded to pings, terminate
        ws.terminate();
        this.clients.delete(ws);
        log.info({ userId: client.userId }, 'Terminated stale WebSocket connection');
      } else if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }
  }

  /**
   * Shutdown the broadcaster
   */
  shutdown(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Close all connections
    for (const ws of this.clients.keys()) {
      ws.close();
    }
    this.clients.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    log.info('Event broadcaster shutdown');
  }
}

// Singleton instance
let instance: EventBroadcasterImpl | null = null;

export function getEventBroadcaster(): EventBroadcaster {
  if (!instance) {
    instance = new EventBroadcasterImpl();
  }
  return instance;
}
