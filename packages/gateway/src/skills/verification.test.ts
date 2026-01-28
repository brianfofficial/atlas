/**
 * Atlas - Skill Verification Tests
 */

import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'

// We'll test the public API
import { verifySkill, DEFAULT_VERIFICATION_OPTIONS } from './verification.js'

describe('Skill Verification', () => {
  let tempDir: string

  beforeEach(async () => {
    // Create a temp directory for test skills
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-test-'))
  })

  describe('verifySkill', () => {
    it('should reject skills without manifest', async () => {
      const result = await verifySkill(tempDir, {
        requireSignature: false,
        trustedPublishersOnly: false,
        maxRiskLevel: 'critical',
        skipCodeHash: true,
      })

      assert.strictEqual(result.isValid, false)
      assert.strictEqual(result.riskLevel, 'critical')
      assert.ok(result.issues.some(i => i.code === 'MANIFEST_NOT_FOUND'))
    })

    it('should validate manifest required fields', async () => {
      // Create minimal invalid manifest
      await fs.writeFile(
        path.join(tempDir, 'atlas-skill.json'),
        JSON.stringify({ id: 'test-skill' })
      )

      const result = await verifySkill(tempDir, {
        requireSignature: false,
        trustedPublishersOnly: false,
        maxRiskLevel: 'critical',
        skipCodeHash: true,
      })

      assert.strictEqual(result.isValid, false)
      assert.ok(result.issues.some(i => i.code === 'MISSING_REQUIRED_FIELD'))
    })

    it('should accept valid manifest with all fields', async () => {
      // Create valid manifest
      const manifest = {
        id: 'test-skill',
        name: 'Test Skill',
        version: '1.0.0',
        description: 'A test skill',
        author: { name: 'Test Author' },
        license: 'MIT',
        atlasVersion: '>=0.1.0',
        main: 'index.js',
        permissions: {
          filesystemRead: ['~/atlas-workspace'],
          filesystemWrite: [],
          networkHosts: [],
          shellCommands: [],
        },
      }

      await fs.writeFile(
        path.join(tempDir, 'atlas-skill.json'),
        JSON.stringify(manifest)
      )

      // Create main file
      await fs.writeFile(
        path.join(tempDir, 'index.js'),
        'export function run() { return "hello"; }'
      )

      const result = await verifySkill(tempDir, {
        requireSignature: false,
        trustedPublishersOnly: false,
        maxRiskLevel: 'high',
        skipCodeHash: true,
      })

      assert.strictEqual(result.isValid, true)
      assert.strictEqual(result.riskLevel, 'low')
    })

    it('should detect high-risk read paths', async () => {
      const manifest = {
        id: 'test-skill',
        name: 'Test Skill',
        version: '1.0.0',
        description: 'A test skill',
        author: { name: 'Test Author' },
        license: 'MIT',
        atlasVersion: '>=0.1.0',
        main: 'index.js',
        permissions: {
          filesystemRead: ['~/.ssh/id_rsa'], // High-risk path
          filesystemWrite: [],
          networkHosts: [],
          shellCommands: [],
        },
      }

      await fs.writeFile(
        path.join(tempDir, 'atlas-skill.json'),
        JSON.stringify(manifest)
      )
      await fs.writeFile(path.join(tempDir, 'index.js'), '')

      const result = await verifySkill(tempDir, {
        requireSignature: false,
        trustedPublishersOnly: false,
        maxRiskLevel: 'critical',
        skipCodeHash: true,
      })

      assert.ok(result.issues.some(i => i.code === 'HIGH_RISK_READ_PATH'))
      assert.strictEqual(result.riskLevel, 'high')
    })

    it('should detect suspicious code patterns', async () => {
      const manifest = {
        id: 'test-skill',
        name: 'Test Skill',
        version: '1.0.0',
        description: 'A test skill',
        author: { name: 'Test Author' },
        license: 'MIT',
        atlasVersion: '>=0.1.0',
        main: 'index.js',
        permissions: {},
      }

      await fs.writeFile(
        path.join(tempDir, 'atlas-skill.json'),
        JSON.stringify(manifest)
      )

      // Create code with suspicious patterns
      await fs.writeFile(
        path.join(tempDir, 'index.js'),
        `
        const result = eval('1+1');
        import { spawn } from 'child_process';
        `
      )

      const result = await verifySkill(tempDir, {
        requireSignature: false,
        trustedPublishersOnly: false,
        maxRiskLevel: 'critical',
        skipCodeHash: true,
      })

      assert.ok(result.issues.some(i => i.code === 'EVAL_USAGE'))
      assert.ok(result.issues.some(i => i.code === 'CHILD_PROCESS'))
    })

    it('should reject unsigned skills when signature required', async () => {
      const manifest = {
        id: 'test-skill',
        name: 'Test Skill',
        version: '1.0.0',
        description: 'A test skill',
        author: { name: 'Test Author' },
        license: 'MIT',
        atlasVersion: '>=0.1.0',
        main: 'index.js',
        permissions: {},
      }

      await fs.writeFile(
        path.join(tempDir, 'atlas-skill.json'),
        JSON.stringify(manifest)
      )
      await fs.writeFile(path.join(tempDir, 'index.js'), '')

      const result = await verifySkill(tempDir, {
        requireSignature: true, // Require signature
        trustedPublishersOnly: false,
        maxRiskLevel: 'critical',
        skipCodeHash: true,
      })

      assert.strictEqual(result.isValid, false)
      assert.ok(result.issues.some(i => i.code === 'SIGNATURE_MISSING'))
    })
  })

  describe('DEFAULT_VERIFICATION_OPTIONS', () => {
    it('should have strict defaults', () => {
      assert.strictEqual(DEFAULT_VERIFICATION_OPTIONS.requireSignature, true)
      assert.strictEqual(DEFAULT_VERIFICATION_OPTIONS.trustedPublishersOnly, true)
      assert.strictEqual(DEFAULT_VERIFICATION_OPTIONS.maxRiskLevel, 'medium')
      assert.strictEqual(DEFAULT_VERIFICATION_OPTIONS.skipCodeHash, false)
    })
  })
})
