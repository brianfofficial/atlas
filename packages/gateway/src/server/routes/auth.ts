/**
 * Auth Routes
 *
 * Authentication endpoints including login, MFA, and session management.
 * Integrates with JWTManager and MFAManager from P0.
 *
 * @module @atlas/gateway/server/routes/auth
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { ServerEnv } from '../index.js';
import { getJWTManager } from '../../security/auth/jwt-manager.js';
import { getMFAManager } from '../../security/auth/mfa.js';
import { getUserRepository } from '../../db/repositories/users.js';
import { getSessionRepository } from '../../db/repositories/sessions.js';
import { authRateLimitMiddleware } from '../middleware/rate-limit.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  ApiError,
  ValidationError,
  UnauthorizedError,
  ConflictError,
} from '../middleware/error-handler.js';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

const auth = new Hono<ServerEnv>();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  deviceFingerprint: z.string().optional(),
});

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email().optional(),
  password: z.string().min(8),
});

const mfaVerifySchema = z.object({
  mfaToken: z.string(),
  code: z.string().min(6).max(10),
  deviceFingerprint: z.string().optional(),
  trustDevice: z.boolean().optional(),
});

const mfaSetupCompleteSchema = z.object({
  userId: z.string(),
  code: z.string().min(6).max(8),
  deviceFingerprint: z.string().optional(),
});

const backupCodeSchema = z.object({
  mfaToken: z.string(),
  backupCode: z.string(),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

// Apply rate limiting to all auth routes
auth.use('/*', authRateLimitMiddleware());

/**
 * POST /api/auth/login
 * Login with email and password
 */
auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password, deviceFingerprint } = c.req.valid('json');

  const userRepo = getUserRepository();
  const user = await userRepo.findByEmail(email);

  if (!user) {
    throw new UnauthorizedError('Invalid credentials');
  }

  // Check lockout
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    const lockoutMinutes = Math.ceil(
      (new Date(user.lockedUntil).getTime() - Date.now()) / 60000
    );
    throw new ApiError(
      423,
      'ACCOUNT_LOCKED',
      `Account is locked. Try again in ${lockoutMinutes} minutes.`
    );
  }

  // Verify password
  const validPassword = await bcrypt.compare(password, user.passwordHash);

  if (!validPassword) {
    // Increment failed attempts
    await userRepo.incrementFailedAttempts(user.id);
    throw new UnauthorizedError('Invalid credentials');
  }

  // Reset failed attempts on successful password check
  await userRepo.resetFailedAttempts(user.id);

  // MFA is ALWAYS required in Atlas
  // Generate temporary MFA token
  const mfaToken = randomBytes(32).toString('hex');

  // Store MFA token temporarily (expires in 5 minutes)
  await userRepo.storeMfaToken(user.id, mfaToken, 5 * 60);

  return c.json({
    requiresMFA: true,
    mfaToken,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      mfaEnabled: true,
    },
  });
});

/**
 * POST /api/auth/register
 * Register a new user (initiates MFA setup)
 */
auth.post('/register', zValidator('json', registerSchema), async (c) => {
  const { username, email, password } = c.req.valid('json');

  const userRepo = getUserRepository();

  // Check for existing user
  if (email) {
    const existingEmail = await userRepo.findByEmail(email);
    if (existingEmail) {
      throw new ConflictError('Email already registered');
    }
  }

  const existingUsername = await userRepo.findByUsername(username);
  if (existingUsername) {
    throw new ConflictError('Username already taken');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Generate MFA secret
  const mfaManager = getMFAManager();
  const mfaSetup = mfaManager.generateSecret(username);

  // Hash backup codes for storage
  const hashedBackupCodes = mfaManager.hashBackupCodes(mfaSetup.backupCodes);

  // Create user
  const user = await userRepo.create({
    username,
    email,
    passwordHash,
    mfaSecret: mfaSetup.secret,
    backupCodes: hashedBackupCodes,
  });

  return c.json(
    {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        mfaEnabled: false, // Not yet verified
        createdAt: user.createdAt,
      },
      mfaSetup: {
        secret: mfaSetup.secret,
        qrCodeUrl: mfaSetup.otpauthUrl,
        backupCodes: mfaSetup.backupCodes, // Show plaintext codes once
      },
    },
    201
  );
});

/**
 * POST /api/auth/mfa/verify
 * Verify MFA code after login
 */
auth.post('/mfa/verify', zValidator('json', mfaVerifySchema), async (c) => {
  const { mfaToken, code, deviceFingerprint, trustDevice } = c.req.valid('json');

  const userRepo = getUserRepository();
  const user = await userRepo.findByMfaToken(mfaToken);

  if (!user) {
    throw new UnauthorizedError('Invalid or expired MFA token');
  }

  const mfaManager = getMFAManager();
  const isValid = mfaManager.verifyCode(user.mfaSecret, code);

  if (!isValid) {
    throw new UnauthorizedError('Invalid MFA code');
  }

  // Clear MFA token
  await userRepo.clearMfaToken(user.id);

  // Generate device ID
  const deviceId = deviceFingerprint || randomBytes(16).toString('hex');

  // Generate tokens
  const jwtManager = getJWTManager();
  const tokens = jwtManager.generateTokens(user.id, deviceId, true);

  // Create session
  const sessionRepo = getSessionRepository();
  await sessionRepo.create({
    userId: user.id,
    deviceId,
    ipAddress: c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP'),
    userAgent: c.req.header('User-Agent'),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });

  // Update last login
  await userRepo.updateLastLogin(user.id);

  return c.json({
    tokens: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    },
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      mfaEnabled: true,
      createdAt: user.createdAt,
      lastLoginAt: new Date().toISOString(),
    },
  });
});

/**
 * POST /api/auth/mfa/setup/complete
 * Complete MFA setup during registration
 */
auth.post('/mfa/setup/complete', zValidator('json', mfaSetupCompleteSchema), async (c) => {
  const { userId, code, deviceFingerprint } = c.req.valid('json');

  const userRepo = getUserRepository();
  const user = await userRepo.findById(userId);

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  if (user.mfaEnabled) {
    throw new ConflictError('MFA already enabled');
  }

  const mfaManager = getMFAManager();
  const isValid = mfaManager.verifyCode(user.mfaSecret, code);

  if (!isValid) {
    throw new UnauthorizedError('Invalid MFA code');
  }

  // Enable MFA
  await userRepo.enableMfa(user.id);

  // Generate device ID
  const deviceId = deviceFingerprint || randomBytes(16).toString('hex');

  // Generate tokens
  const jwtManager = getJWTManager();
  const tokens = jwtManager.generateTokens(user.id, deviceId, true);

  // Create session
  const sessionRepo = getSessionRepository();
  await sessionRepo.create({
    userId: user.id,
    deviceId,
    ipAddress: c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP'),
    userAgent: c.req.header('User-Agent'),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return c.json({
    tokens: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    },
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      mfaEnabled: true,
      createdAt: user.createdAt,
    },
  });
});

/**
 * POST /api/auth/mfa/backup
 * Use a backup code for recovery
 */
auth.post('/mfa/backup', zValidator('json', backupCodeSchema), async (c) => {
  const { mfaToken, backupCode } = c.req.valid('json');

  const userRepo = getUserRepository();
  const user = await userRepo.findByMfaToken(mfaToken);

  if (!user) {
    throw new UnauthorizedError('Invalid or expired MFA token');
  }

  const mfaManager = getMFAManager();
  // Parse backup codes if stored as JSON string
  const backupCodes = typeof user.backupCodes === 'string'
    ? JSON.parse(user.backupCodes) as string[]
    : user.backupCodes as string[];
  const backupIndex = mfaManager.verifyHashedBackupCode(backupCode, backupCodes);

  if (backupIndex < 0) {
    throw new UnauthorizedError('Invalid backup code');
  }

  // Remove used backup code
  await userRepo.useBackupCode(user.id, backupIndex);

  // Clear MFA token
  await userRepo.clearMfaToken(user.id);

  // Generate tokens
  const deviceId = randomBytes(16).toString('hex');
  const jwtManager = getJWTManager();
  const tokens = jwtManager.generateTokens(user.id, deviceId, true);

  // Create session
  const sessionRepo = getSessionRepository();
  await sessionRepo.create({
    userId: user.id,
    deviceId,
    ipAddress: c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP'),
    userAgent: c.req.header('User-Agent'),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return c.json({
    tokens: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    },
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      mfaEnabled: true,
      createdAt: user.createdAt,
    },
    remainingBackupCodes: user.backupCodes.length - 1,
  });
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
auth.post('/refresh', zValidator('json', refreshTokenSchema), async (c) => {
  const { refreshToken } = c.req.valid('json');

  try {
    const jwtManager = getJWTManager();
    const tokens = jwtManager.refreshAccessTokens(refreshToken);

    return c.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token refresh failed';
    throw new UnauthorizedError(message);
  }
});

/**
 * POST /api/auth/me
 * Get current user info (requires auth)
 */
auth.post('/me', authMiddleware(), async (c) => {
  const userId = c.get('userId');

  if (!userId) {
    throw new UnauthorizedError();
  }

  const userRepo = getUserRepository();
  const user = await userRepo.findById(userId);

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  return c.json({
    id: user.id,
    username: user.username,
    email: user.email,
    mfaEnabled: user.mfaEnabled,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  });
});

/**
 * POST /api/auth/logout
 * Logout and invalidate session
 */
auth.post('/logout', authMiddleware(), async (c) => {
  const userId = c.get('userId');
  const deviceId = c.get('deviceId');

  if (userId && deviceId) {
    // Revoke refresh tokens for this device
    const jwtManager = getJWTManager();
    jwtManager.revokeDeviceTokens(userId, deviceId);

    // Invalidate session
    const sessionRepo = getSessionRepository();
    await sessionRepo.invalidateByDevice(userId, deviceId);
  }

  return c.json({ success: true });
});

/**
 * POST /api/auth/mfa/refresh
 * Get new MFA secret/QR code (requires auth)
 */
auth.post('/mfa/refresh', authMiddleware(), async (c) => {
  const userId = c.get('userId');

  if (!userId) {
    throw new UnauthorizedError();
  }

  const userRepo = getUserRepository();
  const user = await userRepo.findById(userId);

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  const mfaManager = getMFAManager();
  const mfaSetup = mfaManager.generateSecret(user.username);

  // Hash backup codes
  const hashedBackupCodes = mfaManager.hashBackupCodes(mfaSetup.backupCodes);

  // Update user's MFA secret and backup codes
  await userRepo.updateMfaSecret(user.id, mfaSetup.secret, hashedBackupCodes);

  return c.json({
    secret: mfaSetup.secret,
    qrCodeUrl: mfaSetup.otpauthUrl,
    backupCodes: mfaSetup.backupCodes,
  });
});

export default auth;
