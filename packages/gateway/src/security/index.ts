/**
 * Atlas Security Module
 *
 * Comprehensive security layer for Atlas gateway:
 * - Encrypted credential storage (keytar + AES-256-GCM)
 * - Mandatory MFA authentication
 * - Zero-trust networking
 * - Prompt injection defense
 * - Output validation
 *
 * @module @atlas/gateway/security
 */

// Credential storage
export { CredentialStore, getCredentialStore } from './credential-store.js';

// Authentication (MFA is mandatory)
export * from './auth/index.js';

// Network security (zero-trust)
export { NetworkSecurityManager, getNetworkSecurityManager } from './network.js';

// Input sanitization (prompt injection defense)
export { InputSanitizer, getInputSanitizer } from './input-sanitizer.js';

// Output validation (exfiltration prevention)
export { OutputValidator, getOutputValidator } from './output-validator.js';

// File permission security
export * from './file-permissions.js';

// Startup security verification
export { runSecurityVerification, quickSecurityCheck } from './startup-verification.js';
export type { SecurityCheck, SecurityVerificationResult, SecurityLevel } from './startup-verification.js';

// Data encryption for sensitive database fields
export { DataEncryptionManager, getDataEncryptionManager, SENSITIVE_FIELDS } from './data-encryption.js';
