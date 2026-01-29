/**
 * Typed Event Emitter
 *
 * A type-safe event emitter for Atlas events.
 */

import { EventEmitter } from 'events'

/**
 * Base interface for all Atlas events
 */
export interface AtlasEventBase {
  type: string
  timestamp: Date
}

/**
 * Approval-related events
 */
export interface ApprovalCreatedEvent extends AtlasEventBase {
  type: 'approval:created'
  requestId: string
  category: string
  operation: string
  riskLevel: string
  sessionId: string
}

export interface ApprovalDecidedEvent extends AtlasEventBase {
  type: 'approval:approved' | 'approval:denied' | 'approval:auto_approved'
  requestId: string
  decidedBy?: string
}

export interface ApprovalExpiredEvent extends AtlasEventBase {
  type: 'approval:expired'
  requestId: string
}

/**
 * Security events
 */
export interface SecurityEvent extends AtlasEventBase {
  type: 'security:injection_blocked' | 'security:credential_access' | 'security:rate_limited'
  details: Record<string, unknown>
  sessionId?: string
}

/**
 * Execution events
 */
export interface ExecutionEvent extends AtlasEventBase {
  type: 'execution:started' | 'execution:completed' | 'execution:failed'
  command?: string
  exitCode?: number
  durationMs?: number
  sessionId: string
}

/**
 * All possible Atlas events
 */
export type AtlasEvent =
  | ApprovalCreatedEvent
  | ApprovalDecidedEvent
  | ApprovalExpiredEvent
  | SecurityEvent
  | ExecutionEvent

/**
 * Event handlers map
 */
export interface AtlasEventHandlers {
  'approval:created': (event: ApprovalCreatedEvent) => void
  'approval:approved': (event: ApprovalDecidedEvent) => void
  'approval:denied': (event: ApprovalDecidedEvent) => void
  'approval:auto_approved': (event: ApprovalDecidedEvent) => void
  'approval:expired': (event: ApprovalExpiredEvent) => void
  'security:injection_blocked': (event: SecurityEvent) => void
  'security:credential_access': (event: SecurityEvent) => void
  'security:rate_limited': (event: SecurityEvent) => void
  'execution:started': (event: ExecutionEvent) => void
  'execution:completed': (event: ExecutionEvent) => void
  'execution:failed': (event: ExecutionEvent) => void
}

/**
 * Type-safe event emitter for Atlas
 */
export class AtlasEventEmitter extends EventEmitter {
  /**
   * Emit a typed event
   */
  emitTyped<K extends keyof AtlasEventHandlers>(
    eventType: K,
    event: Parameters<AtlasEventHandlers[K]>[0]
  ): boolean {
    return this.emit(eventType, event)
  }

  /**
   * Subscribe to a typed event
   */
  onTyped<K extends keyof AtlasEventHandlers>(
    eventType: K,
    handler: AtlasEventHandlers[K]
  ): this {
    return this.on(eventType, handler as (...args: unknown[]) => void)
  }

  /**
   * Subscribe once to a typed event
   */
  onceTyped<K extends keyof AtlasEventHandlers>(
    eventType: K,
    handler: AtlasEventHandlers[K]
  ): this {
    return this.once(eventType, handler as (...args: unknown[]) => void)
  }

  /**
   * Unsubscribe from a typed event
   */
  offTyped<K extends keyof AtlasEventHandlers>(
    eventType: K,
    handler: AtlasEventHandlers[K]
  ): this {
    return this.off(eventType, handler as (...args: unknown[]) => void)
  }
}

// Global event bus
let globalEventBus: AtlasEventEmitter | null = null

export function getEventBus(): AtlasEventEmitter {
  if (!globalEventBus) {
    globalEventBus = new AtlasEventEmitter()
  }
  return globalEventBus
}

/**
 * Convenience function to emit an event
 */
export function emitEvent<K extends keyof AtlasEventHandlers>(
  eventType: K,
  eventData: Omit<Parameters<AtlasEventHandlers[K]>[0], 'type' | 'timestamp'>
): void {
  const event = {
    type: eventType,
    timestamp: new Date(),
    ...eventData,
  } as Parameters<AtlasEventHandlers[K]>[0]

  getEventBus().emitTyped(eventType, event)
}
