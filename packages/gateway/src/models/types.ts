/**
 * Atlas Model Provider Types
 *
 * Type definitions for model providers, routing, and cost tracking.
 */

/**
 * Supported model providers
 */
export type ModelProvider = 'anthropic' | 'openai' | 'ollama' | 'lmstudio' | 'harbor'

/**
 * Task complexity levels for routing decisions
 */
export type TaskComplexity = 'simple' | 'moderate' | 'complex'

/**
 * Model configuration
 */
export interface ModelConfig {
  provider: ModelProvider
  modelId: string
  displayName: string
  contextWindow: number
  costPer1kInputTokens: number // USD, 0 for local models
  costPer1kOutputTokens: number // USD, 0 for local models
  isLocal: boolean
  capabilities: ModelCapabilities
}

/**
 * Model capabilities for routing decisions
 */
export interface ModelCapabilities {
  codeGeneration: boolean
  codeExplanation: boolean
  reasoning: boolean
  creativity: boolean
  speed: 'fast' | 'medium' | 'slow'
  quality: 'basic' | 'good' | 'excellent'
}

/**
 * Request to a model provider
 */
export interface ModelRequest {
  prompt: string
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
  stopSequences?: string[]
  metadata?: Record<string, unknown>
}

/**
 * Response from a model provider
 */
export interface ModelResponse {
  content: string
  model: string
  provider: ModelProvider
  usage: TokenUsage
  latencyMs: number
  finishReason: 'stop' | 'max_tokens' | 'error'
  error?: string
}

/**
 * Streaming chunk from a model provider
 */
export interface StreamChunk {
  delta: string // Incremental content
  done: boolean
  model?: string
  provider?: ModelProvider
  // Final chunk includes usage info
  usage?: TokenUsage
  finishReason?: 'stop' | 'max_tokens' | 'error'
  error?: string
}

/**
 * Token usage for cost tracking
 */
export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCost: number // USD
}

/**
 * Provider health status
 */
export interface ProviderStatus {
  provider: ModelProvider
  isAvailable: boolean
  latencyMs?: number
  lastChecked: Date
  availableModels: string[]
  error?: string
}

/**
 * Routing configuration
 */
export interface RoutingConfig {
  /**
   * Map task complexity to preferred model order
   */
  routingRules: Record<TaskComplexity, string[]>

  /**
   * Fallback chain when primary model unavailable
   */
  fallbackChain: string[]

  /**
   * Maximum latency before falling back (ms)
   */
  maxLatencyMs: number

  /**
   * Enable automatic complexity detection
   */
  autoDetectComplexity: boolean
}

/**
 * Cost tracking entry
 */
export interface CostEntry {
  id: string
  timestamp: Date
  provider: ModelProvider
  model: string
  inputTokens: number
  outputTokens: number
  cost: number
  taskType?: string
  metadata?: Record<string, unknown>
}

/**
 * Cost summary for a time period
 */
export interface CostSummary {
  totalCost: number
  totalInputTokens: number
  totalOutputTokens: number
  byProvider: Record<ModelProvider, number>
  byModel: Record<string, number>
  entries: CostEntry[]
}

/**
 * Budget configuration
 */
export interface BudgetConfig {
  dailyLimit?: number
  weeklyLimit?: number
  monthlyLimit?: number
  alertThresholds: number[] // Percentages to alert at (e.g., [50, 75, 90])
}

/**
 * Provider interface that all model providers must implement
 */
export interface ModelProviderInterface {
  /**
   * Provider name
   */
  readonly name: ModelProvider

  /**
   * Check if the provider is available
   */
  checkHealth(): Promise<ProviderStatus>

  /**
   * List available models
   */
  listModels(): Promise<ModelConfig[]>

  /**
   * Send a request to the model
   */
  complete(request: ModelRequest, model: string): Promise<ModelResponse>

  /**
   * Send a streaming request to the model
   * Returns an async generator that yields chunks
   */
  completeStream?(request: ModelRequest, model: string): AsyncGenerator<StreamChunk, void, unknown>
}

/**
 * Default routing configuration
 */
export const DEFAULT_ROUTING_CONFIG: RoutingConfig = {
  routingRules: {
    simple: ['ollama:llama3', 'lmstudio:mistral', 'anthropic:claude-3-haiku'],
    moderate: ['ollama:codellama', 'anthropic:claude-3-haiku', 'anthropic:claude-3-sonnet'],
    complex: ['anthropic:claude-3.5-sonnet', 'openai:gpt-4o', 'anthropic:claude-3-opus'],
  },
  fallbackChain: [
    'anthropic:claude-3-haiku',
    'openai:gpt-4o-mini',
    'ollama:llama3',
  ],
  maxLatencyMs: 30000,
  autoDetectComplexity: true,
}

/**
 * Default budget configuration
 */
export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  dailyLimit: 10,
  weeklyLimit: 50,
  monthlyLimit: 100,
  alertThresholds: [50, 75, 90],
}
