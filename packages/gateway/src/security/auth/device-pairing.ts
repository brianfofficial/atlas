/**
 * Atlas Device Pairing
 *
 * Cryptographic device verification and pairing system.
 * Each device must be explicitly paired before it can access the gateway.
 *
 * @module @atlas/gateway/security/auth/device-pairing
 */

import {
  randomBytes,
  createHash,
  generateKeyPairSync,
  createSign,
  createVerify,
  publicEncrypt,
  privateDecrypt,
} from 'node:crypto';
import { hostname, platform, release, cpus, networkInterfaces } from 'node:os';
import type { PairedDevice } from '@atlas/shared';

// Constants
const CHALLENGE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes
const MAX_DEVICES_PER_USER = 10;

interface PairingChallenge {
  challenge: string;
  deviceFingerprint: string;
  createdAt: number;
  expiresAt: number;
}

interface DeviceInfo {
  hostname: string;
  platform: string;
  release: string;
  cpuModel: string;
  macAddress: string;
}

/**
 * Device Pairing Manager for Atlas
 *
 * Implements cryptographic device verification to prevent unauthorized access.
 */
export class DevicePairingManager {
  private pendingChallenges: Map<string, PairingChallenge> = new Map();
  private pairedDevices: Map<string, PairedDevice[]> = new Map(); // userId -> devices

  /**
   * Generate a unique fingerprint for the current device
   */
  generateDeviceFingerprint(): string {
    const info = this.getDeviceInfo();
    const components = [
      info.hostname,
      info.platform,
      info.release,
      info.cpuModel,
      info.macAddress,
    ];
    return createHash('sha256').update(components.join('|')).digest('hex');
  }

  /**
   * Get information about the current device
   */
  private getDeviceInfo(): DeviceInfo {
    const interfaces = networkInterfaces();
    let macAddress = 'unknown';

    // Find the first non-internal MAC address
    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name];
      if (iface) {
        const external = iface.find((i) => !i.internal && i.mac !== '00:00:00:00:00:00');
        if (external) {
          macAddress = external.mac;
          break;
        }
      }
    }

    return {
      hostname: hostname(),
      platform: platform(),
      release: release(),
      cpuModel: cpus()[0]?.model ?? 'unknown',
      macAddress,
    };
  }

  /**
   * Generate a device name from device info
   */
  generateDeviceName(): string {
    const info = this.getDeviceInfo();
    const platformName = info.platform === 'darwin' ? 'macOS' :
                         info.platform === 'win32' ? 'Windows' :
                         info.platform === 'linux' ? 'Linux' : info.platform;
    return `${platformName} - ${info.hostname}`;
  }

  /**
   * Initiate device pairing by generating a challenge
   */
  initiatePairing(userId: string): { challengeId: string; challenge: string } {
    const fingerprint = this.generateDeviceFingerprint();
    const challenge = randomBytes(32).toString('hex');
    const challengeId = randomBytes(16).toString('hex');
    const now = Date.now();

    this.pendingChallenges.set(challengeId, {
      challenge,
      deviceFingerprint: fingerprint,
      createdAt: now,
      expiresAt: now + CHALLENGE_EXPIRATION_MS,
    });

    // Clean up expired challenges
    this.cleanupExpiredChallenges();

    return { challengeId, challenge };
  }

  /**
   * Generate a key pair for device authentication
   */
  generateKeyPair(): { publicKey: string; privateKey: string } {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    return { publicKey, privateKey };
  }

  /**
   * Sign a challenge with a private key
   */
  signChallenge(challenge: string, privateKey: string): string {
    const sign = createSign('SHA256');
    sign.update(challenge);
    return sign.sign(privateKey, 'hex');
  }

  /**
   * Complete device pairing by verifying the signed challenge
   */
  completePairing(
    userId: string,
    challengeId: string,
    signedChallenge: string,
    publicKey: string,
    deviceName?: string
  ): PairedDevice {
    const pendingChallenge = this.pendingChallenges.get(challengeId);

    if (!pendingChallenge) {
      throw new Error('DEVICE_NOT_TRUSTED: Invalid or expired pairing challenge');
    }

    if (Date.now() > pendingChallenge.expiresAt) {
      this.pendingChallenges.delete(challengeId);
      throw new Error('DEVICE_NOT_TRUSTED: Pairing challenge has expired');
    }

    // Verify the signature
    const verify = createVerify('SHA256');
    verify.update(pendingChallenge.challenge);

    if (!verify.verify(publicKey, signedChallenge, 'hex')) {
      throw new Error('DEVICE_NOT_TRUSTED: Invalid challenge signature');
    }

    // Check device limit
    const userDevices = this.pairedDevices.get(userId) ?? [];
    if (userDevices.length >= MAX_DEVICES_PER_USER) {
      throw new Error(
        `DEVICE_NOT_TRUSTED: Maximum devices (${MAX_DEVICES_PER_USER}) reached. Remove a device first.`
      );
    }

    // Create paired device record
    const now = new Date();
    const device: PairedDevice = {
      id: randomBytes(16).toString('hex'),
      name: deviceName ?? this.generateDeviceName(),
      fingerprint: pendingChallenge.deviceFingerprint,
      publicKey,
      pairedAt: now,
      lastSeenAt: now,
      trusted: true,
    };

    // Store the paired device
    userDevices.push(device);
    this.pairedDevices.set(userId, userDevices);

    // Clean up the challenge
    this.pendingChallenges.delete(challengeId);

    return device;
  }

  /**
   * Verify that a request comes from a paired device
   */
  verifyDevice(
    userId: string,
    deviceId: string,
    signature: string,
    data: string
  ): boolean {
    const userDevices = this.pairedDevices.get(userId);
    if (!userDevices) return false;

    const device = userDevices.find((d) => d.id === deviceId);
    if (!device || !device.trusted) return false;

    // Verify the signature
    const verify = createVerify('SHA256');
    verify.update(data);

    const isValid = verify.verify(device.publicKey, signature, 'hex');

    if (isValid) {
      // Update last seen
      device.lastSeenAt = new Date();
    }

    return isValid;
  }

  /**
   * Verify device by fingerprint (for session validation)
   */
  verifyDeviceFingerprint(userId: string, fingerprint: string): PairedDevice | null {
    const userDevices = this.pairedDevices.get(userId);
    if (!userDevices) return null;

    const device = userDevices.find((d) => d.fingerprint === fingerprint && d.trusted);
    if (device) {
      device.lastSeenAt = new Date();
    }
    return device ?? null;
  }

  /**
   * Get all paired devices for a user
   */
  getUserDevices(userId: string): PairedDevice[] {
    return this.pairedDevices.get(userId) ?? [];
  }

  /**
   * Remove a paired device
   */
  removeDevice(userId: string, deviceId: string): boolean {
    const userDevices = this.pairedDevices.get(userId);
    if (!userDevices) return false;

    const index = userDevices.findIndex((d) => d.id === deviceId);
    if (index < 0) return false;

    userDevices.splice(index, 1);
    return true;
  }

  /**
   * Revoke trust for a device (without removing it)
   */
  revokeDeviceTrust(userId: string, deviceId: string): boolean {
    const userDevices = this.pairedDevices.get(userId);
    if (!userDevices) return false;

    const device = userDevices.find((d) => d.id === deviceId);
    if (!device) return false;

    device.trusted = false;
    return true;
  }

  /**
   * Restore trust for a device
   */
  restoreDeviceTrust(userId: string, deviceId: string): boolean {
    const userDevices = this.pairedDevices.get(userId);
    if (!userDevices) return false;

    const device = userDevices.find((d) => d.id === deviceId);
    if (!device) return false;

    device.trusted = true;
    return true;
  }

  /**
   * Clean up expired pairing challenges
   */
  private cleanupExpiredChallenges(): void {
    const now = Date.now();
    for (const [id, challenge] of this.pendingChallenges.entries()) {
      if (challenge.expiresAt < now) {
        this.pendingChallenges.delete(id);
      }
    }
  }

  /**
   * Get pairing statistics
   */
  getStats(): {
    totalUsers: number;
    totalDevices: number;
    pendingChallenges: number;
  } {
    let totalDevices = 0;
    for (const devices of this.pairedDevices.values()) {
      totalDevices += devices.length;
    }

    return {
      totalUsers: this.pairedDevices.size,
      totalDevices,
      pendingChallenges: this.pendingChallenges.size,
    };
  }

  /**
   * Export paired devices for persistence
   */
  exportDevices(): Map<string, PairedDevice[]> {
    return new Map(this.pairedDevices);
  }

  /**
   * Import paired devices from persistence
   */
  importDevices(devices: Map<string, PairedDevice[]>): void {
    this.pairedDevices = new Map(devices);
  }
}

// Default singleton instance
let defaultManager: DevicePairingManager | null = null;

export function getDevicePairingManager(): DevicePairingManager {
  if (!defaultManager) {
    defaultManager = new DevicePairingManager();
  }
  return defaultManager;
}

export default DevicePairingManager;
