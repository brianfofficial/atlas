/**
 * Events Module
 *
 * Event system and WebSocket server exports.
 */

// Event emitter
export {
  AtlasEventEmitter,
  getEventBus,
  emitEvent,
  type AtlasEvent,
  type AtlasEventHandlers,
  type ApprovalCreatedEvent,
  type ApprovalDecidedEvent,
  type ApprovalExpiredEvent,
  type SecurityEvent,
  type ExecutionEvent,
} from './event-emitter.js'

// WebSocket server
export {
  AtlasWSServer,
  getWSServer,
  startWSServer,
  stopWSServer,
  type WSMessage,
  type WSClient,
  type WSServerConfig,
} from './websocket-server.js'
