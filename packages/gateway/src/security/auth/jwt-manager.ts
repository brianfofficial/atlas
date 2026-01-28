/**
 * Atlas JWT Manager
 *
 * Handles JWT token generation, validation, and refresh.
 * Implements 15-minute access token expiration with refresh tokens.
 *
 * @module @atlas/gateway/security/auth/jwt-manager
 */

import { randomBytes, createHash } from 'node:crypto';
import { sign, verify, TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';
import type { JWTPayload, AuthTokens, AtlasSecurityError } from '@atlas/shared';

// Constants
const ACCESS_TOKEN_EXPIRATION = 15 * 60; // 15 minutes in seconds
const REFRESH_TOKEN_EXPIRATION = 7 * 24 * 60 * 60; // 7 days in seconds
const TOKEN_ALGORITHM = 'HS256';

interface RefreshTokenData {
  userId: string;
  deviceId: string;
  createdAt: number;
  expiresAt: number;
  revoked: boolean;
}

/**
 * JWT Manager for Atlas authentication
 */
export class JWTManager {
  private readonly secret: string;
  private readonly accessExpiration: number;
  private readonly refreshExpiration: number;
  private refreshTokens: Map<string, RefreshTokenData> = new Map();

  constructor(config?: {
    secret?: string;
    accessExpiration?: number;
    refreshExpiration?: number;
  }) {
    // Use provided secret or generate secure random one
    this.secret = config?.secret ?? this.generateSecureSecret();
    this.accessExpiration = config?.accessExpiration ?? ACCESS_TOKEN_EXPIRATION;
    this.refreshExpiration = config?.refreshExpiration ?? REFRESH_TOKEN_EXPIRATION;
  }

  /**
   * Generate a cryptographically secure secret
   */
  private generateSecureSecret(): string {
    return randomBytes(64).toString('hex');
  }

  /**
   * Generate access and refresh tokens for a user
   */
  generateTokens(userId: string, deviceId: string, mfaVerified: boolean): AuthTokens {
    const now = Math.floor(Date.now() / 1000);

    // Create access token payload
    const payload: JWTPayload = {
      sub: userId,
      deviceId,
      iat: now,
      exp: now + this.accessExpiration,
      mfaVerified,
    };

    // Generate access token
    const accessToken = sign(payload, this.secret, {
      algorithm: TOKEN_ALGORITHM,
    });

    // Generate refresh token (opaque token stored server-side)
    const refreshToken = this.generateRefreshToken(userId, deviceId);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessExpiration,
    };
  }

  /**
   * Generate and store a refresh token
   */
  private generateRefreshToken(userId: string, deviceId: string): string {
    const token = randomBytes(32).toString('hex');
    const now = Math.floor(Date.now() / 1000);

    this.refreshTokens.set(token, {
      userId,
      deviceId,
      createdAt: now,
      expiresAt: now + this.refreshExpiration,
      revoked: false,
    });

    return token;
  }

  /**
   * Verify an access token and return the payload
   */
  verifyAccessToken(token: string): JWTPayload {
    try {
      const payload = verify(token, this.secret, {
        algorithms: [TOKEN_ALGORITHM],
      }) as JWTPayload;

      // CRITICAL: MFA must be verified for all operations
      if (!payload.mfaVerified) {
        throw new Error('MFA_REQUIRED: Multi-factor authentication required');
      }

      return payload;
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new Error('TOKEN_EXPIRED: Access token has expired');
      }
      if (error instanceof JsonWebTokenError) {
        throw new Error('INVALID_TOKEN: Invalid access token');
      }
      throw error;
    }
  }

  /**
   * Refresh tokens using a refresh token
   */
  refreshAccessTokens(refreshToken: string): AuthTokens {
    const tokenData = this.refreshTokens.get(refreshToken);

    if (!tokenData) {
      throw new Error('INVALID_TOKEN: Invalid refresh token');
    }

    if (tokenData.revoked) {
      // Potential token theft - revoke all tokens for this user
      this.revokeAllUserTokens(tokenData.userId);
      throw new Error('INVALID_TOKEN: Refresh token has been revoked');
    }

    const now = Math.floor(Date.now() / 1000);
    if (tokenData.expiresAt < now) {
      this.refreshTokens.delete(refreshToken);
      throw new Error('TOKEN_EXPIRED: Refresh token has expired');
    }

    // Invalidate the old refresh token (rotation)
    this.refreshTokens.delete(refreshToken);

    // Generate new token pair
    return this.generateTokens(tokenData.userId, tokenData.deviceId, true);
  }

  /**
   * Revoke a specific refresh token
   */
  revokeRefreshToken(refreshToken: string): void {
    const tokenData = this.refreshTokens.get(refreshToken);
    if (tokenData) {
      tokenData.revoked = true;
    }
  }

  /**
   * Revoke all refresh tokens for a user
   */
  revokeAllUserTokens(userId: string): void {
    for (const [token, data] of this.refreshTokens.entries()) {
      if (data.userId === userId) {
        data.revoked = true;
      }
    }
  }

  /**
   * Revoke all refresh tokens for a specific device
   */
  revokeDeviceTokens(userId: string, deviceId: string): void {
    for (const [token, data] of this.refreshTokens.entries()) {
      if (data.userId === userId && data.deviceId === deviceId) {
        data.revoked = true;
      }
    }
  }

  /**
   * Clean up expired tokens (should be called periodically)
   */
  cleanupExpiredTokens(): number {
    const now = Math.floor(Date.now() / 1000);
    let cleaned = 0;

    for (const [token, data] of this.refreshTokens.entries()) {
      if (data.expiresAt < now || data.revoked) {
        this.refreshTokens.delete(token);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get token statistics
   */
  getStats(): { activeTokens: number; revokedTokens: number } {
    let active = 0;
    let revoked = 0;
    const now = Math.floor(Date.now() / 1000);

    for (const data of this.refreshTokens.values()) {
      if (data.revoked || data.expiresAt < now) {
        revoked++;
      } else {
        active++;
      }
    }

    return { activeTokens: active, revokedTokens: revoked };
  }

  /**
   * Decode a token without verification (for debugging)
   */
  decodeToken(token: string): JWTPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString());
      return payload as JWTPayload;
    } catch {
      return null;
    }
  }
}

// Default singleton instance
let defaultManager: JWTManager | null = null;

export function getJWTManager(config?: {
  secret?: string;
  accessExpiration?: number;
  refreshExpiration?: number;
}): JWTManager {
  if (!defaultManager) {
    defaultManager = new JWTManager(config);
  }
  return defaultManager;
}

export default JWTManager;
