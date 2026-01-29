/**
 * Request Batcher
 *
 * Batches similar requests to reduce API calls and improve efficiency.
 */

/**
 * Batched request
 */
export interface BatchedRequest<T = unknown> {
  /** Unique request ID */
  id: string

  /** The request data */
  data: T

  /** When the request was added */
  addedAt: Date

  /** Model to use */
  model: string

  /** Priority (higher = more urgent) */
  priority: number

  /** Resolve function for the promise */
  resolve: (result: unknown) => void

  /** Reject function for the promise */
  reject: (error: Error) => void
}

/**
 * Batch result
 */
export interface BatchResult {
  /** Request ID */
  requestId: string

  /** Whether the request succeeded */
  success: boolean

  /** The result if successful */
  result?: unknown

  /** The error if failed */
  error?: Error
}

/**
 * Batch processor function
 */
export type BatchProcessor<T, R> = (requests: T[]) => Promise<R[]>

/**
 * Batcher configuration
 */
export interface RequestBatcherConfig {
  /** Maximum batch size (default: 10) */
  maxBatchSize: number

  /** Maximum wait time before processing batch in ms (default: 100) */
  maxWaitMs: number

  /** Whether to process by model (default: true) */
  batchByModel: boolean

  /** Maximum concurrent batches (default: 5) */
  maxConcurrentBatches: number
}

const DEFAULT_CONFIG: RequestBatcherConfig = {
  maxBatchSize: 10,
  maxWaitMs: 100,
  batchByModel: true,
  maxConcurrentBatches: 5,
}

/**
 * Request Batcher
 *
 * Groups similar requests together for batch processing.
 */
export class RequestBatcher<T = unknown, R = unknown> {
  private config: RequestBatcherConfig
  private queues: Map<string, BatchedRequest<T>[]> = new Map()
  private timers: Map<string, NodeJS.Timeout> = new Map()
  private processor: BatchProcessor<T, R>
  private activeBatches: number = 0
  private stats = {
    requestsProcessed: 0,
    batchesProcessed: 0,
    averageBatchSize: 0,
    averageWaitMs: 0,
  }

  constructor(
    processor: BatchProcessor<T, R>,
    config?: Partial<RequestBatcherConfig>
  ) {
    this.processor = processor
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Add a request to the batch queue
   */
  async add(data: T, model: string, priority: number = 0): Promise<R> {
    return new Promise((resolve, reject) => {
      const queueKey = this.config.batchByModel ? model : 'default'
      const request: BatchedRequest<T> = {
        id: this.generateId(),
        data,
        addedAt: new Date(),
        model,
        priority,
        resolve: resolve as (result: unknown) => void,
        reject,
      }

      // Get or create queue
      if (!this.queues.has(queueKey)) {
        this.queues.set(queueKey, [])
      }
      const queue = this.queues.get(queueKey)!

      // Insert by priority (higher priority first)
      const insertIndex = queue.findIndex((r) => r.priority < priority)
      if (insertIndex === -1) {
        queue.push(request)
      } else {
        queue.splice(insertIndex, 0, request)
      }

      // Check if we should process immediately
      if (queue.length >= this.config.maxBatchSize) {
        this.processBatch(queueKey)
      } else if (!this.timers.has(queueKey)) {
        // Start timer for this queue
        this.timers.set(
          queueKey,
          setTimeout(() => {
            this.processBatch(queueKey)
          }, this.config.maxWaitMs)
        )
      }
    })
  }

  /**
   * Process a batch immediately
   */
  async flush(queueKey?: string): Promise<void> {
    if (queueKey) {
      await this.processBatch(queueKey)
    } else {
      // Flush all queues
      const keys = Array.from(this.queues.keys())
      await Promise.all(keys.map((k) => this.processBatch(k)))
    }
  }

  /**
   * Get queue sizes
   */
  getQueueSizes(): Record<string, number> {
    const sizes: Record<string, number> = {}
    for (const [key, queue] of this.queues) {
      sizes[key] = queue.length
    }
    return sizes
  }

  /**
   * Get batch statistics
   */
  getStats(): typeof this.stats & { pendingRequests: number; activeRequests: number } {
    let pending = 0
    for (const queue of this.queues.values()) {
      pending += queue.length
    }

    return {
      ...this.stats,
      pendingRequests: pending,
      activeRequests: this.activeBatches,
    }
  }

  /**
   * Shutdown the batcher
   */
  async shutdown(): Promise<void> {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()

    // Process remaining queues
    await this.flush()
  }

  // Private methods

  private async processBatch(queueKey: string): Promise<void> {
    // Clear timer
    const timer = this.timers.get(queueKey)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(queueKey)
    }

    // Get queue
    const queue = this.queues.get(queueKey)
    if (!queue || queue.length === 0) return

    // Wait if at capacity
    while (this.activeBatches >= this.config.maxConcurrentBatches) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }

    // Take batch from queue
    const batch = queue.splice(0, this.config.maxBatchSize)
    if (batch.length === 0) return

    this.activeBatches++

    try {
      // Calculate wait time
      const now = Date.now()
      const totalWait = batch.reduce(
        (sum, r) => sum + (now - r.addedAt.getTime()),
        0
      )
      const avgWait = totalWait / batch.length

      // Process batch
      const data = batch.map((r) => r.data)
      const results = await this.processor(data)

      // Resolve promises
      for (let i = 0; i < batch.length; i++) {
        const request = batch[i]
        const result = results[i]
        if (request && result !== undefined) {
          request.resolve(result)
        } else if (request) {
          request.reject(new Error('No result returned for request'))
        }
      }

      // Update stats
      this.stats.requestsProcessed += batch.length
      this.stats.batchesProcessed++
      this.stats.averageBatchSize =
        (this.stats.averageBatchSize * (this.stats.batchesProcessed - 1) +
          batch.length) /
        this.stats.batchesProcessed
      this.stats.averageWaitMs =
        (this.stats.averageWaitMs * (this.stats.batchesProcessed - 1) +
          avgWait) /
        this.stats.batchesProcessed
    } catch (error) {
      // Reject all promises in batch
      for (const request of batch) {
        request.reject(error instanceof Error ? error : new Error(String(error)))
      }
    } finally {
      this.activeBatches--

      // Process more if queue has items
      if (queue.length > 0) {
        this.processBatch(queueKey)
      }
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  }
}

/**
 * Create a simple request batcher
 */
export function createBatcher<T, R>(
  processor: BatchProcessor<T, R>,
  config?: Partial<RequestBatcherConfig>
): RequestBatcher<T, R> {
  return new RequestBatcher(processor, config)
}
