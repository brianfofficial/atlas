/**
 * Atlas - Security Presets Tests
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  PRESETS,
  PRESET_DESCRIPTIONS,
  getPreset,
  getPresetDescription,
  getPresetNames,
  isValidPreset,
  type SecurityPreset,
} from './presets.js'

describe('Security Presets', () => {
  describe('PRESETS', () => {
    it('should have all three presets defined', () => {
      assert.ok(PRESETS.paranoid)
      assert.ok(PRESETS.balanced)
      assert.ok(PRESETS.permissive)
    })

    it('paranoid preset should have strictest settings', () => {
      const paranoid = PRESETS.paranoid

      // Security
      assert.strictEqual(paranoid.security.requireMfa, true)
      assert.strictEqual(paranoid.security.sessionTimeoutMinutes, 15)
      assert.strictEqual(paranoid.security.maxFailedLogins, 3)

      // Network
      assert.strictEqual(paranoid.network.bindAddress, '127.0.0.1')
      assert.deepStrictEqual(paranoid.network.allowedIPs, ['127.0.0.1'])

      // Sandbox
      assert.strictEqual(paranoid.sandbox.enabled, true)
      assert.strictEqual(paranoid.sandbox.networkAccess, false)
      assert.strictEqual(paranoid.sandbox.readOnlyFilesystem, true)

      // Allowlist - most restrictive
      assert.strictEqual(paranoid.allowlist.defaultPolicy, 'deny')
      assert.ok(paranoid.allowlist.blockedCommands.length > 10)

      // Models - local only
      assert.strictEqual(paranoid.models.preferLocal, true)
      assert.strictEqual(paranoid.models.allowCloudModels, false)
      assert.strictEqual(paranoid.models.dailyBudgetLimit, 0)
    })

    it('balanced preset should have moderate settings', () => {
      const balanced = PRESETS.balanced

      // Security
      assert.strictEqual(balanced.security.requireMfa, true)
      assert.strictEqual(balanced.security.sessionTimeoutMinutes, 60)
      assert.strictEqual(balanced.security.maxFailedLogins, 5)

      // Sandbox
      assert.strictEqual(balanced.sandbox.enabled, true)
      assert.strictEqual(balanced.sandbox.networkAccess, false)

      // Allowlist
      assert.strictEqual(balanced.allowlist.defaultPolicy, 'deny')
      assert.ok(balanced.allowlist.safeCommands.length > 5)

      // Models - hybrid
      assert.strictEqual(balanced.models.preferLocal, true)
      assert.strictEqual(balanced.models.allowCloudModels, true)
      assert.ok(balanced.models.dailyBudgetLimit > 0)
    })

    it('permissive preset should have most relaxed settings', () => {
      const permissive = PRESETS.permissive

      // Security - still requires MFA
      assert.strictEqual(permissive.security.requireMfa, true)
      assert.ok(permissive.security.sessionTimeoutMinutes > 60)

      // Sandbox - still enabled but with network access
      assert.strictEqual(permissive.sandbox.enabled, true)
      assert.strictEqual(permissive.sandbox.networkAccess, true)
      assert.strictEqual(permissive.sandbox.readOnlyFilesystem, false)

      // Allowlist - more permissive
      assert.strictEqual(permissive.allowlist.defaultPolicy, 'allow-safe')
      assert.ok(permissive.allowlist.safeCommands.length > balanced.allowlist.safeCommands.length)

      // Models - cloud preferred
      assert.strictEqual(permissive.models.preferLocal, false)
      assert.strictEqual(permissive.models.allowCloudModels, true)
      assert.ok(permissive.models.dailyBudgetLimit > balanced.models.dailyBudgetLimit)
    })

    it('all presets should require MFA', () => {
      for (const preset of Object.values(PRESETS)) {
        assert.strictEqual(
          preset.security.requireMfa,
          true,
          'All presets must require MFA for security'
        )
      }
    })

    it('all presets should enable sandbox', () => {
      for (const preset of Object.values(PRESETS)) {
        assert.strictEqual(
          preset.sandbox.enabled,
          true,
          'All presets must enable sandbox for security'
        )
      }
    })
  })

  describe('PRESET_DESCRIPTIONS', () => {
    it('should have descriptions for all presets', () => {
      assert.ok(PRESET_DESCRIPTIONS.paranoid)
      assert.ok(PRESET_DESCRIPTIONS.balanced)
      assert.ok(PRESET_DESCRIPTIONS.permissive)
    })

    it('each description should have required fields', () => {
      for (const desc of Object.values(PRESET_DESCRIPTIONS)) {
        assert.ok(desc.name)
        assert.ok(desc.emoji)
        assert.ok(desc.tagline)
        assert.ok(desc.description)
        assert.ok(Array.isArray(desc.bestFor))
        assert.ok(Array.isArray(desc.tradeoffs))
      }
    })
  })

  describe('getPreset', () => {
    it('should return correct preset', () => {
      assert.deepStrictEqual(getPreset('paranoid'), PRESETS.paranoid)
      assert.deepStrictEqual(getPreset('balanced'), PRESETS.balanced)
      assert.deepStrictEqual(getPreset('permissive'), PRESETS.permissive)
    })
  })

  describe('getPresetDescription', () => {
    it('should return correct description', () => {
      assert.deepStrictEqual(
        getPresetDescription('paranoid'),
        PRESET_DESCRIPTIONS.paranoid
      )
    })
  })

  describe('getPresetNames', () => {
    it('should return all preset names', () => {
      const names = getPresetNames()
      assert.deepStrictEqual(names, ['paranoid', 'balanced', 'permissive'])
    })
  })

  describe('isValidPreset', () => {
    it('should validate correct preset names', () => {
      assert.strictEqual(isValidPreset('paranoid'), true)
      assert.strictEqual(isValidPreset('balanced'), true)
      assert.strictEqual(isValidPreset('permissive'), true)
    })

    it('should reject invalid preset names', () => {
      assert.strictEqual(isValidPreset('invalid'), false)
      assert.strictEqual(isValidPreset(''), false)
      assert.strictEqual(isValidPreset('PARANOID'), false)
    })
  })
})

// Reference for assertions
const balanced = PRESETS.balanced
