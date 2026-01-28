/**
 * Atlas - Model Router Tests
 */

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import { ModelRouter, type TaskComplexity } from './router.js'

describe('Model Router', () => {
  let router: ModelRouter

  beforeEach(() => {
    router = new ModelRouter({
      autoDetectComplexity: true,
    })
  })

  describe('detectComplexity', () => {
    it('should detect simple tasks', () => {
      const simplePrompts = [
        'What time is it?',
        'Hello, how are you?',
        'List the files in this directory',
        'What is 2 + 2?',
      ]

      for (const prompt of simplePrompts) {
        const complexity = router.detectComplexity(prompt)
        assert.strictEqual(
          complexity,
          'simple',
          `Expected "${prompt}" to be simple, got ${complexity}`
        )
      }
    })

    it('should detect moderate tasks', () => {
      // Moderate = prompts 100-1000 chars that don't match simple/complex patterns
      const moderatePrompts = [
        'Write a function that takes a list of numbers and returns the second largest value. The function should handle edge cases like empty lists and lists with duplicate values appropriately.',
        'Can you help me understand how to structure my project files? I have a React application with TypeScript and I want to organize the components, hooks, and utility functions in a maintainable way.',
      ]

      for (const prompt of moderatePrompts) {
        const complexity = router.detectComplexity(prompt)
        assert.strictEqual(
          complexity,
          'moderate',
          `Expected "${prompt.slice(0, 40)}..." to be moderate, got ${complexity}`
        )
      }
    })

    it('should detect complex tasks', () => {
      const complexPrompts = [
        'Refactor this entire codebase to use TypeScript and add comprehensive tests',
        'Implement a distributed consensus algorithm with fault tolerance',
        'Design and architect a microservices system for handling 1M requests per second',
        'Analyze this security vulnerability and develop a comprehensive mitigation strategy',
      ]

      for (const prompt of complexPrompts) {
        const complexity = router.detectComplexity(prompt)
        assert.strictEqual(
          complexity,
          'complex',
          `Expected "${prompt}" to be complex, got ${complexity}`
        )
      }
    })

    it('should return moderate when auto-detect is disabled', () => {
      const router = new ModelRouter({
        autoDetectComplexity: false,
      })

      const complexity = router.detectComplexity('Any prompt here')
      assert.strictEqual(complexity, 'moderate')
    })
  })

  describe('parseModelSpec', () => {
    it('should parse provider:model format', () => {
      // Access private method through prototype
      const parseModelSpec = (router as any).parseModelSpec.bind(router)

      assert.deepStrictEqual(parseModelSpec('ollama:llama3'), ['ollama', 'llama3'])
      assert.deepStrictEqual(parseModelSpec('anthropic:claude-3'), ['anthropic', 'claude-3'])
      assert.deepStrictEqual(parseModelSpec('lmstudio:mistral'), ['lmstudio', 'mistral'])
    })

    it('should default to ollama for bare model names', () => {
      const parseModelSpec = (router as any).parseModelSpec.bind(router)

      assert.deepStrictEqual(parseModelSpec('llama3'), ['ollama', 'llama3'])
      assert.deepStrictEqual(parseModelSpec('codellama'), ['ollama', 'codellama'])
    })
  })
})

describe('TaskComplexity', () => {
  it('should have correct values', () => {
    const validComplexities: TaskComplexity[] = ['simple', 'moderate', 'complex']

    for (const c of validComplexities) {
      assert.ok(['simple', 'moderate', 'complex'].includes(c))
    }
  })
})
