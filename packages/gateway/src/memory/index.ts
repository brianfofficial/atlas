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
} from './session-store'

// Session manager
export {
  SessionManager,
  getSessionManager,
  type CreateSessionOptions,
  type SessionManagerConfig,
} from './session-manager'

// Deduplication
export {
  DeduplicationService,
  getDeduplicationService,
  type CachedResponse,
  type DeduplicationResult,
  type DeduplicationConfig,
} from './deduplication-service'

// Memory monitoring
export {
  MemoryMonitor,
  getMemoryMonitor,
  startMemoryMonitor,
  type MemoryStats,
  type MemoryAlert,
  type MemoryMonitorConfig,
} from './memory-monitor'

// GC scheduling
export {
  GCScheduler,
  getGCScheduler,
  startGCScheduler,
  type CleanupResult,
  type GCSchedulerConfig,
} from './gc-scheduler'
