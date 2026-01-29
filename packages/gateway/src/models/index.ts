/**
 * Atlas - Model Layer
 *
 * Exports for model providers, routing, cost tracking, and optimization.
 */

// Types
export * from './types.js'

// Providers
export { OllamaProvider, ollamaProvider } from './providers/ollama.js'
export { LMStudioProvider, lmstudioProvider } from './providers/lmstudio.js'

// Router
export { ModelRouter, modelRouter } from './router.js'

// Cost Tracking
export { CostTracker, costTracker, type TimePeriod, type BudgetAlertCallback } from './cost-tracker.js'

// Prompt Cache
export {
  PromptCache,
  getPromptCache,
  type PromptCacheEntry,
  type PromptCacheStats,
  type PromptCacheConfig,
} from './prompt-cache.js'

// Context Compression
export {
  ContextCompressor,
  getContextCompressor,
  type ConversationTurn,
  type CompressedContext,
  type ContextCompressorConfig,
} from './context-compressor.js'

// Request Batching
export {
  RequestBatcher,
  createBatcher,
  type BatchedRequest,
  type BatchResult,
  type BatchProcessor,
  type RequestBatcherConfig,
} from './request-batcher.js'

// Optimization Statistics
export {
  OptimizationStatsTracker,
  getOptimizationStats,
  MODEL_PRICING,
  type OptimizationStats,
} from './optimization-stats.js'
