/**
 * Atlas Authentication Module
 *
 * Exports all authentication-related components.
 * MFA is MANDATORY in Atlas - there is no bypass option.
 *
 * @module @atlas/gateway/security/auth
 */

export { JWTManager, getJWTManager } from './jwt-manager.js';
export { MFAManager, getMFAManager } from './mfa.js';
export type { MFASetupResult, MFAVerificationResult } from './mfa.js';
export { DevicePairingManager, getDevicePairingManager } from './device-pairing.js';
