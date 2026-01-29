/**
 * Atlas Data Encryption
 *
 * Application-level encryption for sensitive database fields.
 * Provides field-level encryption using AES-256-GCM.
 *
 * This supplements file permission security by ensuring that even if
 * an attacker gains read access to the database file, sensitive fields
 * remain encrypted.
 *
 * @module @atlas/gateway/security/data-encryption
 */

import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHash,
  scrypt,
} from 'node:crypto';
import { promisify } from 'node:util';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir, hostname, platform, cpus, networkInterfaces } from 'node:os';
import { mkdirSync } from 'node:fs';
import pinoModule from 'pino';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const log = (pinoModule as any)({ name: 'security:data-encryption' });

const scryptAsync = promisify(scrypt);

// Encryption constants
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

// Encrypted value prefix to identify encrypted strings
const ENCRYPTED_PREFIX = 'ENC:';

/**
 * Generate a device fingerprint for key derivation
 */
function generateDeviceFingerprint(): string {
  const components = [
    hostname(),
    platform(),
    cpus()[0]?.model ?? 'unknown-cpu',
    Object.values(networkInterfaces())
      .flat()
      .find((i) => i && !i.internal && i.family === 'IPv4')?.mac ?? 'no-mac',
  ];
  return createHash('sha256').update(components.join('|')).digest('hex');
}

/**
 * Data Encryption Manager for sensitive database fields
 */
export class DataEncryptionManager {
  private masterKey: Buffer | null = null;
  private salt: Buffer | null = null;
  private initialized = false;
  private readonly keyPath: string;
  private readonly saltPath: string;

  constructor(dataDir?: string) {
    const baseDir = dataDir ?? join(homedir(), '.atlas', 'data');
    this.keyPath = join(baseDir, '.master_key');
    this.saltPath = join(baseDir, '.encryption_salt');
  }

  /**
   * Initialize the encryption manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Ensure directory exists
    const dir = dirname(this.keyPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
    }

    // Load or generate salt
    if (existsSync(this.saltPath)) {
      this.salt = readFileSync(this.saltPath);
    } else {
      this.salt = randomBytes(SALT_LENGTH);
      writeFileSync(this.saltPath, this.salt, { mode: 0o600 });
      log.info('Generated new encryption salt');
    }

    // Derive master key from environment or device fingerprint
    const keySource = process.env.ATLAS_MASTER_KEY ?? generateDeviceFingerprint();
    this.masterKey = (await scryptAsync(keySource, this.salt, KEY_LENGTH)) as Buffer;

    this.initialized = true;
    log.info('Data encryption initialized');
  }

  /**
   * Ensure the manager is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.masterKey) {
      throw new Error('DataEncryptionManager not initialized. Call initialize() first.');
    }
  }

  /**
   * Encrypt a value for storage
   */
  encrypt(plaintext: string): string {
    this.ensureInitialized();

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.masterKey!, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    // Format: ENC:iv:authTag:ciphertext
    return `${ENCRYPTED_PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  }

  /**
   * Decrypt a value from storage
   */
  decrypt(encryptedValue: string): string {
    this.ensureInitialized();

    if (!encryptedValue.startsWith(ENCRYPTED_PREFIX)) {
      // Not encrypted, return as-is (for migration compatibility)
      return encryptedValue;
    }

    const withoutPrefix = encryptedValue.slice(ENCRYPTED_PREFIX.length);
    const [ivStr, authTagStr, ciphertext] = withoutPrefix.split(':');

    if (!ivStr || !authTagStr || !ciphertext) {
      throw new Error('Invalid encrypted value format');
    }

    const iv = Buffer.from(ivStr, 'base64');
    const authTag = Buffer.from(authTagStr, 'base64');

    const decipher = createDecipheriv(ALGORITHM, this.masterKey!, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Check if a value is encrypted
   */
  isEncrypted(value: string): boolean {
    return value.startsWith(ENCRYPTED_PREFIX);
  }

  /**
   * Encrypt an object's sensitive fields
   */
  encryptFields<T extends Record<string, unknown>>(
    obj: T,
    sensitiveFields: (keyof T)[]
  ): T {
    const result = { ...obj };

    for (const field of sensitiveFields) {
      const value = obj[field];
      if (typeof value === 'string' && !this.isEncrypted(value)) {
        (result[field] as string) = this.encrypt(value);
      }
    }

    return result;
  }

  /**
   * Decrypt an object's sensitive fields
   */
  decryptFields<T extends Record<string, unknown>>(
    obj: T,
    sensitiveFields: (keyof T)[]
  ): T {
    const result = { ...obj };

    for (const field of sensitiveFields) {
      const value = obj[field];
      if (typeof value === 'string' && this.isEncrypted(value)) {
        (result[field] as string) = this.decrypt(value);
      }
    }

    return result;
  }

  /**
   * Create a secure hash of a value (for indexing encrypted fields)
   */
  hash(value: string): string {
    return createHash('sha256')
      .update(this.masterKey!)
      .update(value)
      .digest('hex');
  }

  /**
   * Rotate the master key (re-encrypts all data with new key)
   * This is a placeholder - actual implementation would need to
   * re-encrypt all sensitive data in the database
   */
  async rotateKey(newKeySource?: string): Promise<void> {
    this.ensureInitialized();

    const oldKey = this.masterKey!;

    // Generate new salt and key
    const newSalt = randomBytes(SALT_LENGTH);
    const keySource = newKeySource ?? generateDeviceFingerprint() + Date.now();
    const newKey = (await scryptAsync(keySource, newSalt, KEY_LENGTH)) as Buffer;

    // Store old values for re-encryption
    const _oldSalt = this.salt;

    // Update to new key
    this.salt = newSalt;
    this.masterKey = newKey;

    // Save new salt
    writeFileSync(this.saltPath, newSalt, { mode: 0o600 });

    log.info('Master key rotated - sensitive data needs re-encryption');

    // Note: The actual re-encryption of database records would be done
    // by the calling code using the old key to decrypt and new key to encrypt
  }
}

// Sensitive field definitions for common data types
export const SENSITIVE_FIELDS = {
  user: ['mfa_secret', 'backup_codes', 'password_hash'] as const,
  credential: ['encryptedValue', 'iv', 'authTag'] as const,
  memory: ['content', 'summary'] as const,
  auditLog: ['metadata'] as const,
};

// Singleton instance
let defaultManager: DataEncryptionManager | null = null;

export function getDataEncryptionManager(): DataEncryptionManager {
  if (!defaultManager) {
    defaultManager = new DataEncryptionManager();
  }
  return defaultManager;
}

export default DataEncryptionManager;
