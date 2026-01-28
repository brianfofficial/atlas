/**
 * Atlas - LM Studio Provider
 *
 * Integration with LM Studio for local model inference.
 * LM Studio provides an OpenAI-compatible API for local models.
 *
 * @see https://lmstudio.ai/
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
 * Default LM Studio server URL (OpenAI-compatible endpoint)
 */
const DEFAULT_LMSTUDIO_URL = 'http://127.0.0.1:1234'

/**
 * Default capabilities for LM Studio models
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
 * OpenAI-compatible API response types
 */
interface LMStudioModelsResponse {
  data: Array<{
    id: string
    object: string
    owned_by: string
  }>
}

interface LMStudioChatResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * LM Studio provider implementation
 */
export class LMStudioProvider implements ModelProviderInterface {
  readonly name: ModelProvider = 'lmstudio'
  private baseUrl: string
  private cachedModels: ModelConfig[] | null = null
  private lastHealthCheck: ProviderStatus | null = null

  constructor(baseUrl: string = DEFAULT_LMSTUDIO_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
  }

  /**
   * Check if LM Studio server is running and accessible
   */
  async checkHealth(): Promise<ProviderStatus> {
    const startTime = Date.now()

    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        throw new Error(`LM Studio server returned ${response.status}`)
      }

      const data = (await response.json()) as LMStudioModelsResponse
      const availableModels = data.data?.map((m) => m.id) ?? []

      this.lastHealthCheck = {
        provider: 'lmstudio',
        isAvailable: true,
        latencyMs: Date.now() - startTime,
        lastChecked: new Date(),
        availableModels,
      }

      return this.lastHealthCheck
    } catch (error) {
      this.lastHealthCheck = {
        provider: 'lmstudio',
        isAvailable: false,
        lastChecked: new Date(),
        availableModels: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      }

      return this.lastHealthCheck
    }
  }

  /**
   * List all available models from LM Studio
   */
  async listModels(): Promise<ModelConfig[]> {
    if (this.cachedModels) {
      return this.cachedModels
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.status}`)
      }

      const data = (await response.json()) as LMStudioModelsResponse

      this.cachedModels = (data.data ?? []).map((model) => ({
        provider: 'lmstudio' as ModelProvider,
        modelId: model.id,
        displayName: this.formatModelName(model.id),
        contextWindow: this.estimateContextWindow(model.id),
        costPer1kInputTokens: 0, // Local = free
        costPer1kOutputTokens: 0,
        isLocal: true,
        capabilities: DEFAULT_CAPABILITIES,
      }))

      return this.cachedModels
    } catch (error) {
      console.error('Failed to list LM Studio models:', error)
      return []
    }
  }

  /**
   * Send a completion request to LM Studio using OpenAI-compatible API
   */
  async complete(request: ModelRequest, model: string): Promise<ModelResponse> {
    const startTime = Date.now()

    try {
      const messages: Array<{ role: string; content: string }> = []

      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt })
      }
      messages.push({ role: 'user', content: request.prompt })

      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: request.maxTokens ?? 2048,
          temperature: request.temperature ?? 0.7,
          stop: request.stopSequences,
          stream: false,
        }),
        signal: AbortSignal.timeout(60000), // 60 second timeout
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`LM Studio error: ${response.status} - ${errorText}`)
      }

      const data = (await response.json()) as LMStudioChatResponse
      const latencyMs = Date.now() - startTime

      const choice = data.choices[0]
      const content = choice?.message?.content ?? ''
      const finishReason = choice?.finish_reason === 'stop' ? 'stop' : 'max_tokens'

      return {
        content,
        model,
        provider: 'lmstudio',
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0,
          estimatedCost: 0, // Local = free
        },
        latencyMs,
        finishReason,
      }
    } catch (error) {
      return {
        content: '',
        model,
        provider: 'lmstudio',
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
   * Format model name for display
   */
  private formatModelName(modelId: string): string {
    // LM Studio model IDs often include path-like names
    // e.g., "TheBloke/Mistral-7B-Instruct-v0.2-GGUF"
    const parts = modelId.split('/')
    const name = parts[parts.length - 1] || modelId
    return name.replace(/-GGUF$/i, '').replace(/-/g, ' ')
  }

  /**
   * Estimate context window based on model name
   */
  private estimateContextWindow(modelId: string): number {
    const id = modelId.toLowerCase()

    if (id.includes('32k')) return 32768
    if (id.includes('16k')) return 16384
    if (id.includes('8k')) return 8192
    if (id.includes('llama-3') || id.includes('llama3')) return 8192
    if (id.includes('mistral')) return 32768
    if (id.includes('mixtral')) return 32768
    if (id.includes('codellama')) return 16384
    if (id.includes('phi')) return 4096

    return 4096 // Conservative default
  }

  /**
   * Invalidate the model cache
   */
  invalidateCache(): void {
    this.cachedModels = null
  }
}

// Export singleton instance with default URL
export const lmstudioProvider = new LMStudioProvider()
