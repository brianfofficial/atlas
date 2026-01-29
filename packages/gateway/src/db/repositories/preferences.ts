/**
 * Preferences Repository
 *
 * Data access layer for user preferences.
 *
 * @module @atlas/gateway/db/repositories/preferences
 */

import { eq } from 'drizzle-orm';
import { getDatabase } from '../index.js';
import { preferences, type Preferences } from '../schema.js';
import { randomUUID } from 'crypto';

export interface PreferencesData {
  theme?: 'light' | 'dark' | 'system';
  notifications?: {
    email?: boolean;
    push?: boolean;
    security?: boolean;
    suggestions?: boolean;
  };
  privacy?: {
    shareAnalytics?: boolean;
    rememberHistory?: boolean;
  };
  ai?: {
    defaultModel?: string;
    temperature?: number;
    maxTokens?: number;
    verbosity?: 'concise' | 'balanced' | 'detailed';
    budget?: { daily?: number; weekly?: number; monthly?: number };
  };
  security?: {
    sessionTimeout?: number;
    requireMFAForSensitive?: boolean;
    autoLockOnIdle?: boolean;
  };
}

export interface PreferencesRepository {
  getByUserId(userId: string): Promise<PreferencesData | null>;
  update(userId: string, data: Partial<PreferencesData>): Promise<PreferencesData>;
  updateAiPreferences(userId: string, ai: PreferencesData['ai']): Promise<void>;
  reset(userId: string): Promise<void>;
}

class PreferencesRepositoryImpl implements PreferencesRepository {
  async getByUserId(userId: string): Promise<PreferencesData | null> {
    const db = getDatabase();
    const result = await db
      .select()
      .from(preferences)
      .where(eq(preferences.userId, userId))
      .limit(1);

    if (!result[0]) return null;

    const prefs = result[0];
    return {
      theme: prefs.theme as PreferencesData['theme'],
      notifications: prefs.notifications ? JSON.parse(prefs.notifications) : undefined,
      privacy: prefs.privacy ? JSON.parse(prefs.privacy) : undefined,
      ai: prefs.ai ? JSON.parse(prefs.ai) : undefined,
      security: prefs.security ? JSON.parse(prefs.security) : undefined,
    };
  }

  async update(userId: string, data: Partial<PreferencesData>): Promise<PreferencesData> {
    const db = getDatabase();

    // Check if preferences exist
    const existing = await this.getByUserId(userId);

    if (!existing) {
      // Create new preferences
      const id = randomUUID();
      await db.insert(preferences).values({
        id,
        userId,
        theme: data.theme,
        notifications: data.notifications ? JSON.stringify(data.notifications) : undefined,
        privacy: data.privacy ? JSON.stringify(data.privacy) : undefined,
        ai: data.ai ? JSON.stringify(data.ai) : undefined,
        security: data.security ? JSON.stringify(data.security) : undefined,
        updatedAt: new Date().toISOString(),
      });
      return data as PreferencesData;
    }

    // Merge with existing
    const merged: PreferencesData = {
      theme: data.theme ?? existing.theme,
      notifications: data.notifications
        ? { ...existing.notifications, ...data.notifications }
        : existing.notifications,
      privacy: data.privacy ? { ...existing.privacy, ...data.privacy } : existing.privacy,
      ai: data.ai ? { ...existing.ai, ...data.ai } : existing.ai,
      security: data.security ? { ...existing.security, ...data.security } : existing.security,
    };

    await db
      .update(preferences)
      .set({
        theme: merged.theme,
        notifications: merged.notifications ? JSON.stringify(merged.notifications) : undefined,
        privacy: merged.privacy ? JSON.stringify(merged.privacy) : undefined,
        ai: merged.ai ? JSON.stringify(merged.ai) : undefined,
        security: merged.security ? JSON.stringify(merged.security) : undefined,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(preferences.userId, userId));

    return merged;
  }

  async updateAiPreferences(userId: string, ai: PreferencesData['ai']): Promise<void> {
    await this.update(userId, { ai });
  }

  async reset(userId: string): Promise<void> {
    const db = getDatabase();
    await db.delete(preferences).where(eq(preferences.userId, userId));
  }
}

// Singleton instance
let instance: PreferencesRepository | null = null;

export function getPreferencesRepository(): PreferencesRepository {
  if (!instance) {
    instance = new PreferencesRepositoryImpl();
  }
  return instance;
}
