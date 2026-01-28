/**
 * Atlas - Skills Layer
 *
 * Exports for skill verification, manifest handling, and vulnerability scanning.
 */

// Types
export * from './types.js'

// Manifest handling
export {
  parseManifest,
  validateManifest,
  analyzePermissions,
  checkPermissionBounds,
  generateManifestTemplate,
} from './manifest.js'

// Verification
export {
  verifySkill,
  signSkill,
  addTrustedPublicKey,
  removeTrustedPublicKey,
  listTrustedPublicKeys,
  DEFAULT_VERIFICATION_OPTIONS,
  type VerificationOptions,
} from './verification.js'

// Vulnerability scanning
export {
  scanSkill,
  formatScanResult,
  checkScanResult,
} from './scanner.js'
