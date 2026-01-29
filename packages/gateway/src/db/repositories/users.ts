/**
 * Users Repository
 *
 * Data access layer for user accounts.
 *
 * @module @atlas/gateway/db/repositories/users
 */

import { eq } from 'drizzle-orm';
import { getDatabase, getSQLite } from '../index.js';
import { users, type User, type NewUser } from '../schema.js';
import { randomUUID } from 'crypto';

export interface CreateUserData {
  username: string;
  email?: string;
  passwordHash: string;
  mfaSecret: string;
  backupCodes: string[];
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByMfaToken(token: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
  updateLastLogin(id: string): Promise<void>;
  incrementFailedAttempts(id: string): Promise<void>;
  resetFailedAttempts(id: string): Promise<void>;
  storeMfaToken(id: string, token: string, expiresInSeconds: number): Promise<void>;
  clearMfaToken(id: string): Promise<void>;
  enableMfa(id: string): Promise<void>;
  useBackupCode(id: string, index: number): Promise<void>;
  updateMfaSecret(id: string, secret: string, backupCodes: string[]): Promise<void>;
}

class UserRepositoryImpl implements UserRepository {
  async findById(id: string): Promise<User | null> {
    const db = getDatabase();
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const db = getDatabase();
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0] || null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const db = getDatabase();
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0] || null;
  }

  async findByMfaToken(token: string): Promise<User | null> {
    const db = getDatabase();
    const sqlite = getSQLite();

    // Check token exists and not expired
    const result = sqlite
      .prepare(
        `
      SELECT * FROM users
      WHERE mfa_token = ?
      AND mfa_token_expires_at > datetime('now')
    `
      )
      .get(token) as User | undefined;

    if (!result) return null;

    // Parse backup codes
    return {
      ...result,
      backupCodes: JSON.parse(result.backupCodes as unknown as string),
    };
  }

  async create(data: CreateUserData): Promise<User> {
    const db = getDatabase();
    const id = randomUUID();
    const now = new Date().toISOString();

    const newUser: NewUser = {
      id,
      username: data.username,
      email: data.email,
      passwordHash: data.passwordHash,
      mfaSecret: data.mfaSecret,
      mfaEnabled: false,
      backupCodes: JSON.stringify(data.backupCodes),
      failedAttempts: 0,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(users).values(newUser);

    return {
      ...newUser,
      backupCodes: data.backupCodes as unknown as string,
    } as User;
  }

  async updateLastLogin(id: string): Promise<void> {
    const db = getDatabase();
    await db
      .update(users)
      .set({
        lastLoginAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, id));
  }

  async incrementFailedAttempts(id: string): Promise<void> {
    const sqlite = getSQLite();
    const MAX_FAILED_ATTEMPTS = 5;
    const LOCKOUT_DURATION_MINUTES = 30;

    sqlite
      .prepare(
        `
      UPDATE users
      SET
        failed_attempts = failed_attempts + 1,
        locked_until = CASE
          WHEN failed_attempts + 1 >= ?
          THEN datetime('now', '+' || ? || ' minutes')
          ELSE locked_until
        END,
        updated_at = datetime('now')
      WHERE id = ?
    `
      )
      .run(MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_MINUTES, id);
  }

  async resetFailedAttempts(id: string): Promise<void> {
    const db = getDatabase();
    await db
      .update(users)
      .set({
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, id));
  }

  async storeMfaToken(id: string, token: string, expiresInSeconds: number): Promise<void> {
    const sqlite = getSQLite();
    sqlite
      .prepare(
        `
      UPDATE users
      SET
        mfa_token = ?,
        mfa_token_expires_at = datetime('now', '+' || ? || ' seconds'),
        updated_at = datetime('now')
      WHERE id = ?
    `
      )
      .run(token, expiresInSeconds, id);
  }

  async clearMfaToken(id: string): Promise<void> {
    const db = getDatabase();
    await db
      .update(users)
      .set({
        mfaToken: null,
        mfaTokenExpiresAt: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, id));
  }

  async enableMfa(id: string): Promise<void> {
    const db = getDatabase();
    await db
      .update(users)
      .set({
        mfaEnabled: true,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, id));
  }

  async useBackupCode(id: string, index: number): Promise<void> {
    const user = await this.findById(id);
    if (!user) return;

    const backupCodes = JSON.parse(user.backupCodes as unknown as string) as string[];
    backupCodes.splice(index, 1);

    const db = getDatabase();
    await db
      .update(users)
      .set({
        backupCodes: JSON.stringify(backupCodes),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, id));
  }

  async updateMfaSecret(id: string, secret: string, backupCodes: string[]): Promise<void> {
    const db = getDatabase();
    await db
      .update(users)
      .set({
        mfaSecret: secret,
        backupCodes: JSON.stringify(backupCodes),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, id));
  }
}

// Singleton instance
let instance: UserRepository | null = null;

export function getUserRepository(): UserRepository {
  if (!instance) {
    instance = new UserRepositoryImpl();
  }
  return instance;
}
