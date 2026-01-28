/**
 * Atlas Credential Store
 *
 * Secure credential storage using OS keychain (keytar) with AES-256-GCM fallback.
 * Addresses: Plaintext credential storage targeted by infostealers (Redline, Lumma, Vidar)
 *
 * @module @atlas/gateway/security/credential-store
 */

import { randomBytes, createCipheriv, createDecipheriv, createHash, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, access, rename } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir, hostname, platform, cpus, networkInterfaces } from 'node:os';
import type {
  StoredCredential,
  CredentialService,
  CredentialStoreConfig,
  AtlasSecurityError,
} from '@atlas/shared';

const scryptAsync = promisify(scrypt);

// Constants
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEYCHAIN_SERVICE = 'atlas-gateway';

/**
 * Device fingerprint for key derivation when keychain unavailable
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
 * Derive encryption key from device fingerprint
 */
async function deriveKey(salt: Buffer): Promise<Buffer> {
  const fingerprint = generateDeviceFingerprint();
  return (await scryptAsync(fingerprint, salt, KEY_LENGTH)) as Buffer;
}

/**
 * Credential Store implementation
 *
 * Priority: OS Keychain (keytar) > Encrypted file storage
 * NEVER stores credentials in plaintext
 */
export class CredentialStore {
  private config: CredentialStoreConfig;
  private keytar: typeof import('keytar') | null = null;
  private keytarAvailable = false;
  private initialized = false;
  private encryptionKey: Buffer | null = null;
  private salt: Buffer | null = null;

  constructor(config?: Partial<CredentialStoreConfig>) {
    this.config = {
      useKeychain: true,
      fallbackToFile: true,
      storagePath: join(homedir(), '.atlas', 'credentials.enc'),
      rotationReminderDays: 90,
      ...config,
    };
  }

  /**
   * Initialize the credential store
   * Attempts keytar first, falls back to encrypted file storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Try to load keytar for OS keychain access
    if (this.config.useKeychain) {
      try {
        // Dynamic import to handle missing native module gracefully
        this.keytar = await import('keytar');
        // Test keychain access
        await this.keytar.findCredentials(KEYCHAIN_SERVICE);
        this.keytarAvailable = true;
      } catch {
        console.warn(
          '[Atlas] OS keychain (keytar) unavailable, using encrypted file storage'
        );
        this.keytarAvailable = false;
      }
    }

    // Initialize file-based storage if needed
    if (!this.keytarAvailable && this.config.fallbackToFile) {
      await this.initializeFileStorage();
    }

    if (!this.keytarAvailable && !this.config.fallbackToFile) {
      throw new Error(
        'CREDENTIAL_STORE_UNAVAILABLE: No credential storage backend available'
      );
    }

    this.initialized = true;
  }

  /**
   * Initialize encrypted file storage with derived key
   */
  private async initializeFileStorage(): Promise<void> {
    const saltPath = join(dirname(this.config.storagePath), '.atlas-salt');

    // Ensure directory exists
    await mkdir(dirname(this.config.storagePath), { recursive: true });

    try {
      // Try to read existing salt
      await access(saltPath);
      this.salt = await readFile(saltPath);
    } catch {
      // Generate new salt
      this.salt = randomBytes(SALT_LENGTH);
      await writeFile(saltPath, this.salt, { mode: 0o600 });
    }

    this.encryptionKey = await deriveKey(this.salt);
  }

  /**
   * Store a credential securely
   */
  async store(
    id: string,
    name: string,
    service: CredentialService,
    value: string
  ): Promise<StoredCredential> {
    await this.ensureInitialized();

    if (this.keytarAvailable && this.keytar) {
      // Use OS keychain
      const keychainKey = `${KEYCHAIN_SERVICE}:${id}`;
      await this.keytar.setPassword(KEYCHAIN_SERVICE, keychainKey, value);

      // Store metadata in encrypted file
      const credential: StoredCredential = {
        id,
        name,
        service,
        encryptedValue: '[KEYCHAIN]', // Marker that value is in keychain
        iv: '',
        authTag: '',
        createdAt: new Date(),
        lastRotatedAt: new Date(),
      };
      await this.saveMetadata(credential);
      return credential;
    }

    // File-based encrypted storage
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.encryptionKey!, iv);

    let encrypted = cipher.update(value, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    const credential: StoredCredential = {
      id,
      name,
      service,
      encryptedValue: encrypted,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      createdAt: new Date(),
      lastRotatedAt: new Date(),
    };

    await this.saveCredential(credential);
    return credential;
  }

  /**
   * Retrieve a credential
   */
  async retrieve(id: string): Promise<string> {
    await this.ensureInitialized();

    const credential = await this.getCredential(id);
    if (!credential) {
      throw new Error(`CREDENTIAL_NOT_FOUND: Credential '${id}' not found`);
    }

    if (this.keytarAvailable && this.keytar && credential.encryptedValue === '[KEYCHAIN]') {
      const keychainKey = `${KEYCHAIN_SERVICE}:${id}`;
      const value = await this.keytar.getPassword(KEYCHAIN_SERVICE, keychainKey);
      if (!value) {
        throw new Error(`CREDENTIAL_NOT_FOUND: Credential '${id}' not in keychain`);
      }
      return value;
    }

    // Decrypt from file storage
    try {
      const iv = Buffer.from(credential.iv, 'base64');
      const authTag = Buffer.from(credential.authTag, 'base64');
      const decipher = createDecipheriv(ALGORITHM, this.encryptionKey!, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(credential.encryptedValue, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      throw new Error(
        `CREDENTIAL_DECRYPTION_FAILED: Failed to decrypt credential '${id}'`
      );
    }
  }

  /**
   * Delete a credential
   */
  async delete(id: string): Promise<void> {
    await this.ensureInitialized();

    if (this.keytarAvailable && this.keytar) {
      const keychainKey = `${KEYCHAIN_SERVICE}:${id}`;
      await this.keytar.deletePassword(KEYCHAIN_SERVICE, keychainKey);
    }

    await this.removeCredential(id);
  }

  /**
   * List all stored credentials (metadata only, not values)
   */
  async list(): Promise<Omit<StoredCredential, 'encryptedValue' | 'iv' | 'authTag'>[]> {
    await this.ensureInitialized();

    const credentials = await this.loadAllCredentials();
    return credentials.map(({ encryptedValue, iv, authTag, ...metadata }) => metadata);
  }

  /**
   * Check if a credential needs rotation
   */
  async needsRotation(id: string): Promise<boolean> {
    const credential = await this.getCredential(id);
    if (!credential) return false;

    const daysSinceRotation = Math.floor(
      (Date.now() - new Date(credential.lastRotatedAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceRotation >= this.config.rotationReminderDays;
  }

  /**
   * Migrate plaintext auth-profiles.json to encrypted storage
   */
  async migrateFromPlaintext(plaintextPath: string): Promise<number> {
    await this.ensureInitialized();

    let migrated = 0;
    try {
      const content = await readFile(plaintextPath, 'utf8');
      const profiles = JSON.parse(content);

      for (const [key, value] of Object.entries(profiles)) {
        if (typeof value === 'string') {
          await this.store(
            key,
            `Migrated: ${key}`,
            this.inferService(key),
            value
          );
          migrated++;
        } else if (typeof value === 'object' && value !== null) {
          // Handle nested credentials (e.g., { apiKey: "xxx", orgId: "yyy" })
          for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
            if (typeof subValue === 'string' && this.looksLikeCredential(subKey)) {
              await this.store(
                `${key}.${subKey}`,
                `Migrated: ${key}.${subKey}`,
                this.inferService(key),
                subValue
              );
              migrated++;
            }
          }
        }
      }

      // Rename the old file to prevent accidental use
      if (migrated > 0) {
        const backupPath = `${plaintextPath}.migrated.${Date.now()}`;
        await rename(plaintextPath, backupPath);
        console.log(
          `[Atlas] Migrated ${migrated} credentials. Original file backed up to: ${backupPath}`
        );
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    return migrated;
  }

  /**
   * Infer service type from key name
   */
  private inferService(key: string): CredentialService {
    const keyLower = key.toLowerCase();
    if (keyLower.includes('anthropic') || keyLower.includes('claude')) return 'anthropic';
    if (keyLower.includes('openai') || keyLower.includes('gpt')) return 'openai';
    if (keyLower.includes('google')) return 'google';
    if (keyLower.includes('azure')) return 'azure';
    if (keyLower.includes('aws')) return 'aws';
    if (keyLower.includes('github') || keyLower.includes('gh')) return 'github';
    if (keyLower.includes('slack')) return 'slack';
    if (keyLower.includes('discord')) return 'discord';
    if (keyLower.includes('telegram')) return 'telegram';
    return 'custom';
  }

  /**
   * Check if a key name suggests it's a credential
   */
  private looksLikeCredential(key: string): boolean {
    const credentialKeywords = [
      'key', 'secret', 'token', 'password', 'apikey', 'api_key',
      'auth', 'credential', 'private', 'access'
    ];
    const keyLower = key.toLowerCase();
    return credentialKeywords.some((kw) => keyLower.includes(kw));
  }

  // ============================================================================
  // File Storage Helpers
  // ============================================================================

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async loadAllCredentials(): Promise<StoredCredential[]> {
    try {
      const content = await readFile(this.config.storagePath, 'utf8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  private async getCredential(id: string): Promise<StoredCredential | undefined> {
    const credentials = await this.loadAllCredentials();
    return credentials.find((c) => c.id === id);
  }

  private async saveCredential(credential: StoredCredential): Promise<void> {
    const credentials = await this.loadAllCredentials();
    const index = credentials.findIndex((c) => c.id === credential.id);

    if (index >= 0) {
      credentials[index] = credential;
    } else {
      credentials.push(credential);
    }

    await writeFile(
      this.config.storagePath,
      JSON.stringify(credentials, null, 2),
      { mode: 0o600 }
    );
  }

  private async saveMetadata(credential: StoredCredential): Promise<void> {
    // Same as saveCredential but ensures we only save metadata for keychain creds
    await this.saveCredential(credential);
  }

  private async removeCredential(id: string): Promise<void> {
    const credentials = await this.loadAllCredentials();
    const filtered = credentials.filter((c) => c.id !== id);

    await writeFile(
      this.config.storagePath,
      JSON.stringify(filtered, null, 2),
      { mode: 0o600 }
    );
  }
}

// Default singleton instance
let defaultStore: CredentialStore | null = null;

export function getCredentialStore(config?: Partial<CredentialStoreConfig>): CredentialStore {
  if (!defaultStore) {
    defaultStore = new CredentialStore(config);
  }
  return defaultStore;
}

export default CredentialStore;
