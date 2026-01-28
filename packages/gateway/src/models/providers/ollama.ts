/**
 * Atlas - Ollama Provider
 *
 * Integration with Ollama for local model inference.
 * Ollama runs models locally with zero API costs.
 *
 * @see https://ollama.ai/
 */

import {
  ModelProviderInterface,
  ModelProvider,
  ModelConfig,
  ModelRequest,
  ModelResponse,
  ProviderStatus,
  ModelCapabilities,
} from '../types.js'

/**
 * Default Ollama server URL
 */
const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434'

/**
 * Known Ollama models with their capabilities
 */
const KNOWN_MODELS: Record<string, Partial<ModelConfig>> = {
  'llama3': {
    displayName: 'Llama 3 8B',
    contextWindow: 8192,
    capabilities: {
      codeGeneration: true,
      codeExplanation: true,
      reasoning: true,
      creativity: true,
      speed: 'fast',
      quality: 'good',
    },
  },
  'llama3:70b': {
    displayName: 'Llama 3 70B',
    contextWindow: 8192,
    capabilities: {
      codeGeneration: true,
      codeExplanation: true,
      reasoning: true,
      creativity: true,
      speed: 'slow',
      quality: 'excellent',
    },
  },
  'codellama': {
    displayName: 'Code Llama 7B',
    contextWindow: 16384,
    capabilities: {
      codeGeneration: true,
      codeExplanation: true,
      reasoning: false,
      creativity: false,
      speed: 'fast',
      quality: 'good',
    },
  },
  'codellama:34b': {
    displayName: 'Code Llama 34B',
    contextWindow: 16384,
    capabilities: {
      codeGeneration: true,
      codeExplanation: true,
      reasoning: true,
      creativity: false,
      speed: 'medium',
      quality: 'excellent',
    },
  },
  'mistral': {
    displayName: 'Mistral 7B',
    contextWindow: 32768,
    capabilities: {
      codeGeneration: true,
      codeExplanation: true,
      reasoning: true,
      creativity: true,
      speed: 'fast',
      quality: 'good',
    },
  },
  'mixtral': {
    displayName: 'Mixtral 8x7B',
    contextWindow: 32768,
    capabilities: {
      codeGeneration: true,
      codeExplanation: true,
      reasoning: true,
      creativity: true,
      speed: 'medium',
      quality: 'excellent',
    },
  },
  'phi3': {
    displayName: 'Phi-3 Mini',
    contextWindow: 4096,
    capabilities: {
      codeGeneration: true,
      codeExplanation: true,
      reasoning: true,
      creativity: false,
      speed: 'fast',
      quality: 'basic',
    },
  },
  'deepseek-coder': {
    displayName: 'DeepSeek Coder',
    contextWindow: 16384,
    capabilities: {
      codeGeneration: true,
      codeExplanation: true,
      reasoning: false,
      creativity: false,
      speed: 'fast',
      quality: 'good',
    },
  },
}

/**
 * Default capabilities for unknown models
 */
const DEFAULT_CAPABILITIES: ModelCapabilities = {
  codeGeneration: true,
  codeExplanation: true,
  reasoning: true,
  creativity: true,
  speed: 'medium',
  quality: 'good',
}

/**
 * Ollama API response types
 */
interface OllamaTagsResponse {
  models: Array<{
    name: string
    size: number
    digest: string
    modified_at: string
  }>
}

interface OllamaGenerateResponse {
  model: string
  response: string
  done: boolean
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
  eval_count?: number
  eval_duration?: number
}

/**
 * Ollama provider implementation
 */
export class OllamaProvider implements ModelProviderInterface {
  readonly name: ModelProvider = 'ollama'
  private baseUrl: string
  private cachedModels: ModelConfig[] | null = null
  private lastHealthCheck: ProviderStatus | null = null

  constructor(baseUrl: string = DEFAULT_OLLAMA_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
  }

  /**
   * Check if Ollama server is running and accessible
   */
  async checkHealth(): Promise<ProviderStatus> {
    const startTime = Date.now()

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        throw new Error(`Ollama server returned ${response.status}`)
      }

      const data = (await response.json()) as OllamaTagsResponse
      const availableModels = data.models?.map((m) => m.name) ?? []

      this.lastHealthCheck = {
        provider: 'ollama',
        isAvailable: true,
        latencyMs: Date.now() - startTime,
        lastChecked: new Date(),
        availableModels,
      }

      return this.lastHealthCheck
    } catch (error) {
      this.lastHealthCheck = {
        provider: 'ollama',
        isAvailable: false,
        lastChecked: new Date(),
        availableModels: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      }

      return this.lastHealthCheck
    }
  }

  /**
   * List all available models from Ollama
   */
  async listModels(): Promise<ModelConfig[]> {
    if (this.cachedModels) {
      return this.cachedModels
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.status}`)
      }

      const data = (await response.json()) as OllamaTagsResponse

      this.cachedModels = (data.models ?? []).map((model) => {
        const baseModel = model.name.split(':')[0]
        const known = KNOWN_MODELS[model.name] ?? KNOWN_MODELS[baseModel]

        return {
          provider: 'ollama' as ModelProvider,
          modelId: model.name,
          displayName: known?.displayName ?? model.name,
          contextWindow: known?.contextWindow ?? 4096,
          costPer1kInputTokens: 0, // Local = free
          costPer1kOutputTokens: 0,
          isLocal: true,
          capabilities: known?.capabilities ?? DEFAULT_CAPABILITIES,
        }
      })

      return this.cachedModels
    } catch (error) {
      console.error('Failed to list Ollama models:', error)
      return []
    }
  }

  /**
   * Send a completion request to Ollama
   */
  async complete(request: ModelRequest, model: string): Promise<ModelResponse> {
    const startTime = Date.now()

    try {
      // Build the prompt with system prompt if provided
      let fullPrompt = request.prompt
      if (request.systemPrompt) {
        fullPrompt = `${request.systemPrompt}\n\n${request.prompt}`
      }

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt: fullPrompt,
          stream: false,
          options: {
            num_predict: request.maxTokens ?? 2048,
            temperature: request.temperature ?? 0.7,
            stop: request.stopSequences,
          },
        }),
        signal: AbortSignal.timeout(60000), // 60 second timeout
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Ollama error: ${response.status} - ${errorText}`)
      }

      const data = (await response.json()) as OllamaGenerateResponse
      const latencyMs = Date.now() - startTime

      // Estimate token counts (Ollama provides these in some versions)
      const inputTokens = data.prompt_eval_count ?? Math.ceil(fullPrompt.length / 4)
      const outputTokens = data.eval_count ?? Math.ceil(data.response.length / 4)

      return {
        content: data.response,
        model,
        provider: 'ollama',
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          estimatedCost: 0, // Local = free
        },
        latencyMs,
        finishReason: data.done ? 'stop' : 'max_tokens',
      }
    } catch (error) {
      return {
        content: '',
        model,
        provider: 'ollama',
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
        },
        latencyMs: Date.now() - startTime,
        finishReason: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Invalidate the model cache (call after pulling new models)
   */
  invalidateCache(): void {
    this.cachedModels = null
  }

  /**
   * Pull a model from Ollama registry
   */
  async pullModel(modelName: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: modelName }),
      })

      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.status}`)
      }

      // Invalidate cache after pulling
      this.invalidateCache()
      return true
    } catch (error) {
      console.error(`Failed to pull model ${modelName}:`, error)
      return false
    }
  }
}

// Export singleton instance with default URL
export const ollamaProvider = new OllamaProvider()
