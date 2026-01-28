/**
 * Atlas MFA (Multi-Factor Authentication)
 *
 * TOTP-based MFA using speakeasy library.
 * MFA is MANDATORY - there is no bypass option.
 *
 * Addresses: 300+ exposed instances with zero authentication
 *
 * @module @atlas/gateway/security/auth/mfa
 */

import { randomBytes } from 'node:crypto';
import speakeasy from 'speakeasy';

// Constants
const ISSUER = 'Atlas Gateway';
const TOTP_WINDOW = 1; // Allow 1 step before/after for clock drift
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 8;

export interface MFASetupResult {
  /** Base32-encoded secret for the authenticator app */
  secret: string;
  /** URI for QR code generation */
  otpauthUrl: string;
  /** One-time backup codes */
  backupCodes: string[];
}

export interface MFAVerificationResult {
  valid: boolean;
  usedBackupCode?: boolean;
  remainingBackupCodes?: number;
}

/**
 * MFA Manager for Atlas
 *
 * Implements TOTP-based two-factor authentication.
 * CRITICAL: MFA is NOT optional in Atlas - it is always required.
 */
export class MFAManager {
  /**
   * Generate a new MFA secret and backup codes for user enrollment
   */
  generateSecret(username: string): MFASetupResult {
    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: `${ISSUER}:${username}`,
      issuer: ISSUER,
      length: 32, // 256 bits for strong security
    });

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url ?? this.generateOtpauthUrl(username, secret.base32),
      backupCodes,
    };
  }

  /**
   * Generate otpauth URL manually if speakeasy doesn't provide one
   */
  private generateOtpauthUrl(username: string, secret: string): string {
    const encodedIssuer = encodeURIComponent(ISSUER);
    const encodedUsername = encodeURIComponent(username);
    return `otpauth://totp/${encodedIssuer}:${encodedUsername}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
  }

  /**
   * Generate random backup codes
   */
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      // Generate random alphanumeric code
      const bytes = randomBytes(BACKUP_CODE_LENGTH);
      const code = bytes
        .toString('hex')
        .toUpperCase()
        .slice(0, BACKUP_CODE_LENGTH);
      // Format as XXXX-XXXX for readability
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }
    return codes;
  }

  /**
   * Verify a TOTP code
   */
  verifyCode(secret: string, code: string): boolean {
    // Remove any spaces or dashes from the code
    const cleanCode = code.replace(/[\s-]/g, '');

    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: cleanCode,
      window: TOTP_WINDOW,
    });
  }

  /**
   * Verify MFA with support for backup codes
   *
   * @param secret - The user's TOTP secret
   * @param code - The code entered by the user
   * @param backupCodes - Array of unused backup codes
   * @returns Verification result with backup code status
   */
  verifyWithBackup(
    secret: string,
    code: string,
    backupCodes: string[]
  ): MFAVerificationResult {
    const cleanCode = code.replace(/[\s-]/g, '').toUpperCase();

    // First try TOTP
    if (this.verifyCode(secret, cleanCode)) {
      return {
        valid: true,
        usedBackupCode: false,
        remainingBackupCodes: backupCodes.length,
      };
    }

    // Check backup codes
    const formattedInput = cleanCode.length === 8
      ? `${cleanCode.slice(0, 4)}-${cleanCode.slice(4)}`
      : cleanCode;

    const backupIndex = backupCodes.findIndex(
      (bc) => bc.replace(/[\s-]/g, '').toUpperCase() === cleanCode ||
              bc.toUpperCase() === formattedInput
    );

    if (backupIndex >= 0) {
      // Remove the used backup code
      backupCodes.splice(backupIndex, 1);
      return {
        valid: true,
        usedBackupCode: true,
        remainingBackupCodes: backupCodes.length,
      };
    }

    return {
      valid: false,
      remainingBackupCodes: backupCodes.length,
    };
  }

  /**
   * Generate a QR code data URL for the authenticator app
   * Returns a data URL that can be displayed as an image
   */
  async generateQRCodeDataUrl(otpauthUrl: string): Promise<string> {
    // Use a simple QR code approach - in production you'd use a QR library
    // For now, return the URL that can be used with any QR generator
    // The frontend should use a library like qrcode to generate the actual QR
    return otpauthUrl;
  }

  /**
   * Get the current TOTP code (for testing purposes only)
   * WARNING: Never expose this in production
   */
  getCurrentCode(secret: string): string {
    return speakeasy.totp({
      secret,
      encoding: 'base32',
    });
  }

  /**
   * Validate that a secret is properly formatted
   */
  isValidSecret(secret: string): boolean {
    // Base32 alphabet
    const base32Regex = /^[A-Z2-7]+=*$/;
    return base32Regex.test(secret) && secret.length >= 16;
  }

  /**
   * Generate new backup codes (when user runs out)
   */
  regenerateBackupCodes(): string[] {
    return this.generateBackupCodes();
  }

  /**
   * Hash backup codes for secure storage
   * Backup codes should be stored hashed, not in plaintext
   */
  hashBackupCodes(codes: string[]): string[] {
    const { createHash } = require('node:crypto');
    return codes.map((code) =>
      createHash('sha256')
        .update(code.replace(/[\s-]/g, '').toUpperCase())
        .digest('hex')
    );
  }

  /**
   * Verify a backup code against hashed codes
   */
  verifyHashedBackupCode(code: string, hashedCodes: string[]): number {
    const { createHash } = require('node:crypto');
    const codeHash = createHash('sha256')
      .update(code.replace(/[\s-]/g, '').toUpperCase())
      .digest('hex');

    return hashedCodes.findIndex((h) => h === codeHash);
  }
}

// Default singleton instance
let defaultManager: MFAManager | null = null;

export function getMFAManager(): MFAManager {
  if (!defaultManager) {
    defaultManager = new MFAManager();
  }
  return defaultManager;
}

export default MFAManager;
