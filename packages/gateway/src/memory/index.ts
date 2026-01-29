/**
 * Memory Management Module
 *
 * Session management, deduplication, and memory monitoring.
 */

// Session store
export {
  SessionStore,
  getSessionStore,
  type Session,
  type SessionStoreConfig,
} from './session-store.js'

// Session manager
export {
  SessionManager,
  getSessionManager,
  type CreateSessionOptions,
  type SessionManagerConfig,
} from './session-manager.js'

// Deduplication
export {
  DeduplicationService,
  getDeduplicationService,
  type CachedResponse,
  type DeduplicationResult,
  type DeduplicationConfig,
} from './deduplication-service.js'

// Memory monitoring
export {
  MemoryMonitor,
  getMemoryMonitor,
  startMemoryMonitor,
  type MemoryStats,
  type MemoryAlert,
  type MemoryMonitorConfig,
} from './memory-monitor.js'

// GC scheduling
export {
  GCScheduler,
  getGCScheduler,
  startGCScheduler,
  type CleanupResult,
  type GCSchedulerConfig,
} from './gc-scheduler.js'
