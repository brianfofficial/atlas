/**
 * Sessions Repository
 *
 * Data access layer for user sessions.
 *
 * @module @atlas/gateway/db/repositories/sessions
 */

import { eq, and, gt } from 'drizzle-orm';
import { getDatabase, getSQLite } from '../index.js';
import { sessions, type Session, type NewSession } from '../schema.js';
import { randomUUID } from 'crypto';

export interface CreateSessionData {
  userId: string;
  deviceId: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
}

export interface SessionStats {
  active: number;
  total: number;
  blocked: number;
}

export interface SessionRepository {
  create(data: CreateSessionData): Promise<Session>;
  findById(id: string): Promise<Session | null>;
  findByUserId(userId: string): Promise<Session[]>;
  updateLastActivity(id: string): Promise<void>;
  invalidate(id: string): Promise<void>;
  invalidateByDevice(userId: string, deviceId: string): Promise<void>;
  invalidateAllForUser(userId: string): Promise<void>;
  getStats(): Promise<SessionStats>;
  cleanupExpired(): Promise<number>;
}

class SessionRepositoryImpl implements SessionRepository {
  async create(data: CreateSessionData): Promise<Session> {
    const db = getDatabase();
    const id = randomUUID();
    const now = new Date().toISOString();

    const newSession: NewSession = {
      id,
      userId: data.userId,
      deviceId: data.deviceId,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      expiresAt: data.expiresAt.toISOString(),
      isActive: true,
      lastActivityAt: now,
      createdAt: now,
    };

    await db.insert(sessions).values(newSession);

    return newSession as Session;
  }

  async findById(id: string): Promise<Session | null> {
    const db = getDatabase();
    const result = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    return result[0] || null;
  }

  async findByUserId(userId: string): Promise<Session[]> {
    const db = getDatabase();
    return db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.isActive, true)));
  }

  async updateLastActivity(id: string): Promise<void> {
    const db = getDatabase();
    await db
      .update(sessions)
      .set({
        lastActivityAt: new Date().toISOString(),
      })
      .where(eq(sessions.id, id));
  }

  async invalidate(id: string): Promise<void> {
    const db = getDatabase();
    await db.update(sessions).set({ isActive: false }).where(eq(sessions.id, id));
  }

  async invalidateByDevice(userId: string, deviceId: string): Promise<void> {
    const db = getDatabase();
    await db
      .update(sessions)
      .set({ isActive: false })
      .where(and(eq(sessions.userId, userId), eq(sessions.deviceId, deviceId)));
  }

  async invalidateAllForUser(userId: string): Promise<void> {
    const db = getDatabase();
    await db.update(sessions).set({ isActive: false }).where(eq(sessions.userId, userId));
  }

  async getStats(): Promise<SessionStats> {
    const sqlite = getSQLite();

    const statsResult = sqlite
      .prepare(
        `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_active = 1 AND expires_at > datetime('now') THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as blocked
      FROM sessions
    `
      )
      .get() as { total: number; active: number; blocked: number };

    return {
      total: statsResult.total || 0,
      active: statsResult.active || 0,
      blocked: statsResult.blocked || 0,
    };
  }

  async cleanupExpired(): Promise<number> {
    const sqlite = getSQLite();

    const result = sqlite
      .prepare(
        `
      DELETE FROM sessions
      WHERE expires_at < datetime('now')
      OR (is_active = 0 AND created_at < datetime('now', '-7 days'))
    `
      )
      .run();

    return result.changes;
  }
}

// Singleton instance
let instance: SessionRepository | null = null;

export function getSessionRepository(): SessionRepository {
  if (!instance) {
    instance = new SessionRepositoryImpl();
  }
  return instance;
}
