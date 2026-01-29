/**
 * Atlas - Model Router
 *
 * Intelligent routing of requests to appropriate models based on:
 * - Task complexity
 * - Model availability
 * - Cost optimization
 * - Latency requirements
 *
 * Simple tasks → Local models (free)
 * Complex tasks → Cloud APIs (paid)
 */

import {
  ModelProvider,
  ModelRequest,
  ModelResponse,
  ModelConfig,
  TaskComplexity,
  RoutingConfig,
  ProviderStatus,
  DEFAULT_ROUTING_CONFIG,
} from './types.js'
import { OllamaProvider, ollamaProvider } from './providers/ollama.js'
import { LMStudioProvider, lmstudioProvider } from './providers/lmstudio.js'

/**
 * Complexity detection patterns
 */
const COMPLEXITY_PATTERNS = {
  simple: [
    /^(list|show|display|get|what is|who is|when|where)/i,
    /^(summarize|explain simply|give me a quick)/i,
    /^(format|convert|translate from \w+ to \w+)/i,
  ],
  complex: [
    /^(analyze|evaluate|compare|design|architect|implement)/i,
    /^(debug|fix|refactor|optimize|improve)/i,
    /^(create a.*system|build.*application|develop)/i,
    /^(review|audit|assess|investigate)/i,
    /(security|vulnerability|exploit|attack)/i,
    /(algorithm|data structure|complexity)/i,
  ],
}

/**
 * Model router for intelligent request routing
 */
export class ModelRouter {
  private config: RoutingConfig
  private providers: Map<ModelProvider, OllamaProvider | LMStudioProvider>
  private providerStatus: Map<ModelProvider, ProviderStatus>
  private modelCache: Map<string, ModelConfig>

  constructor(config: Partial<RoutingConfig> = {}) {
    this.config = { ...DEFAULT_ROUTING_CONFIG, ...config }
    this.providers = new Map()
    this.providerStatus = new Map()
    this.modelCache = new Map()

    // Register default local providers
    this.providers.set('ollama', ollamaProvider)
    this.providers.set('lmstudio', lmstudioProvider)
  }

  /**
   * Route a request to the most appropriate model
   */
  async route(request: ModelRequest, preferredComplexity?: TaskComplexity): Promise<ModelResponse> {
    // Detect or use provided complexity
    const complexity = preferredComplexity ?? this.detectComplexity(request.prompt)

    // Get ordered list of models to try
    const modelOrder = this.getModelOrder(complexity)

    // Try each model in order until one succeeds
    for (const modelSpec of modelOrder) {
      const [providerName, modelId] = this.parseModelSpec(modelSpec)
      const provider = this.providers.get(providerName as ModelProvider)

      if (!provider) {
        continue
      }

      // Check provider health
      const status = await this.getProviderStatus(providerName as ModelProvider)
      if (!status.isAvailable) {
        console.log(`Provider ${providerName} unavailable, trying next...`)
        continue
      }

      // Check if model is available
      if (!status.availableModels.includes(modelId)) {
        console.log(`Model ${modelId} not available on ${providerName}, trying next...`)
        continue
      }

      // Try to complete the request
      const response = await provider.complete(request, modelId)

      if (response.finishReason !== 'error') {
        return response
      }

      console.log(`Model ${modelSpec} failed, trying next...`)
    }

    // All models failed - return error
    return {
      content: '',
      model: 'none',
      provider: 'ollama',
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      },
      latencyMs: 0,
      finishReason: 'error',
      error: 'All models failed or unavailable',
    }
  }

  /**
   * Detect task complexity from the prompt
   */
  detectComplexity(prompt: string): TaskComplexity {
    if (!this.config.autoDetectComplexity) {
      return 'moderate'
    }

    // Check for complex patterns first
    for (const pattern of COMPLEXITY_PATTERNS.complex) {
      if (pattern.test(prompt)) {
        return 'complex'
      }
    }

    // Check for simple patterns
    for (const pattern of COMPLEXITY_PATTERNS.simple) {
      if (pattern.test(prompt)) {
        return 'simple'
      }
    }

    // Check prompt length as heuristic
    if (prompt.length < 100) {
      return 'simple'
    } else if (prompt.length > 1000) {
      return 'complex'
    }

    return 'moderate'
  }

  /**
   * Get ordered list of models to try for a complexity level
   */
  private getModelOrder(complexity: TaskComplexity): string[] {
    const primary = this.config.routingRules[complexity] ?? []
    const fallback = this.config.fallbackChain

    // Combine primary models with fallback, removing duplicates
    const seen = new Set<string>()
    const result: string[] = []

    for (const model of [...primary, ...fallback]) {
      if (!seen.has(model)) {
        seen.add(model)
        result.push(model)
      }
    }

    return result
  }

  /**
   * Parse model specification into provider and model ID
   * e.g., "ollama:llama3" → ["ollama", "llama3"]
   */
  private parseModelSpec(spec: string): [string, string] {
    const parts = spec.split(':')
    if (parts.length === 2 && parts[0] && parts[1]) {
      return [parts[0], parts[1]]
    }
    // Default to ollama if no provider specified
    return ['ollama', spec]
  }

  /**
   * Get cached provider status or refresh if stale
   */
  private async getProviderStatus(provider: ModelProvider): Promise<ProviderStatus> {
    const cached = this.providerStatus.get(provider)
    const now = new Date()

    // Use cached status if less than 30 seconds old
    if (cached && now.getTime() - cached.lastChecked.getTime() < 30000) {
      return cached
    }

    // Refresh status
    const providerInstance = this.providers.get(provider)
    if (!providerInstance) {
      return {
        provider,
        isAvailable: false,
        lastChecked: now,
        availableModels: [],
        error: 'Provider not registered',
      }
    }

    const status = await providerInstance.checkHealth()
    this.providerStatus.set(provider, status)
    return status
  }

  /**
   * Refresh health status of all providers
   */
  async refreshAllProviders(): Promise<Map<ModelProvider, ProviderStatus>> {
    const results = new Map<ModelProvider, ProviderStatus>()

    for (const [name, provider] of this.providers) {
      const status = await provider.checkHealth()
      this.providerStatus.set(name, status)
      results.set(name, status)
    }

    return results
  }

  /**
   * Get all available local models
   */
  async getLocalModels(): Promise<ModelConfig[]> {
    const models: ModelConfig[] = []

    for (const [, provider] of this.providers) {
      const providerModels = await provider.listModels()
      models.push(...providerModels)
    }

    return models
  }

  /**
   * Check if any local models are available
   */
  async hasLocalModels(): Promise<boolean> {
    const models = await this.getLocalModels()
    return models.length > 0
  }

  /**
   * Update routing configuration
   */
  updateConfig(config: Partial<RoutingConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get current routing configuration
   */
  getConfig(): RoutingConfig {
    return { ...this.config }
  }
}

// Export singleton instance
export const modelRouter = new ModelRouter()

// Getter for singleton
export function getModelRouter(): ModelRouter {
  return modelRouter
}
