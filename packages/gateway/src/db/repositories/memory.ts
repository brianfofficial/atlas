/**
 * Memory Repository
 *
 * Data access layer for AI memory entries.
 *
 * @module @atlas/gateway/db/repositories/memory
 */

import { eq, and, like, desc, sql } from 'drizzle-orm';
import { getDatabase, getSQLite } from '../index.js';
import { memoryEntries, type MemoryEntry } from '../schema.js';
import { randomUUID } from 'crypto';

export type MemoryType = 'fact' | 'preference' | 'context' | 'instruction' | 'skill' | 'relationship';
export type MemoryImportance = 'low' | 'medium' | 'high' | 'critical';
export type MemorySource = 'user' | 'conversation' | 'system' | 'inference';

export interface CreateMemoryData {
  type: MemoryType;
  content: string;
  summary?: string;
  importance: MemoryImportance;
  source: MemorySource;
  metadata?: Record<string, unknown>;
  tags?: string[];
  expiresAt?: string;
}

export interface MemoryQueryFilters {
  type?: MemoryType;
  importance?: MemoryImportance;
  source?: MemorySource;
  q?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}

export interface MemoryOutput {
  id: string;
  type: string;
  content: string;
  summary?: string;
  importance: string;
  source: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  accessCount: number;
  lastAccessedAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryStats {
  total: number;
  byType: Record<MemoryType, number>;
  byImportance: Record<MemoryImportance, number>;
  oldestEntry: string;
  newestEntry: string;
  storageUsed: number;
}

export interface MemoryRepository {
  query(userId: string, filters: MemoryQueryFilters): Promise<MemoryOutput[]>;
  search(userId: string, query: string, limit: number): Promise<MemoryOutput[]>;
  getById(id: string): Promise<(MemoryOutput & { userId: string }) | null>;
  create(userId: string, data: CreateMemoryData): Promise<MemoryOutput>;
  delete(id: string): Promise<void>;
  deleteBatch(userId: string, ids: string[]): Promise<number>;
  clearAll(userId: string): Promise<void>;
  recordAccess(id: string): Promise<void>;
  getStats(userId: string): Promise<MemoryStats>;
  exportAll(userId: string): Promise<MemoryOutput[]>;
  importBatch(userId: string, memories: CreateMemoryData[]): Promise<{ imported: number; failed: number }>;
}

class MemoryRepositoryImpl implements MemoryRepository {
  private toOutput(entry: MemoryEntry): MemoryOutput {
    return {
      id: entry.id,
      type: entry.type,
      content: entry.content,
      summary: entry.summary || undefined,
      importance: entry.importance,
      source: entry.source,
      metadata: entry.metadata ? JSON.parse(entry.metadata) : undefined,
      tags: entry.tags ? JSON.parse(entry.tags) : undefined,
      accessCount: entry.accessCount,
      lastAccessedAt: entry.lastAccessedAt || undefined,
      expiresAt: entry.expiresAt || undefined,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }

  async query(userId: string, filters: MemoryQueryFilters): Promise<MemoryOutput[]> {
    const sqlite = getSQLite();
    const conditions: string[] = ['user_id = ?'];
    const params: unknown[] = [userId];

    if (filters.type) {
      conditions.push('type = ?');
      params.push(filters.type);
    }

    if (filters.importance) {
      conditions.push('importance = ?');
      params.push(filters.importance);
    }

    if (filters.source) {
      conditions.push('source = ?');
      params.push(filters.source);
    }

    if (filters.q) {
      conditions.push('(content LIKE ? OR summary LIKE ?)');
      params.push(`%${filters.q}%`, `%${filters.q}%`);
    }

    if (filters.tag) {
      conditions.push('tags LIKE ?');
      params.push(`%"${filters.tag}"%`);
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const query = `
      SELECT * FROM memory_entries
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);

    const results = sqlite.prepare(query).all(...params) as MemoryEntry[];
    return results.map((e) => this.toOutput(e));
  }

  async search(userId: string, query: string, limit: number): Promise<MemoryOutput[]> {
    const sqlite = getSQLite();

    const results = sqlite
      .prepare(
        `
      SELECT * FROM memory_entries
      WHERE user_id = ?
      AND (content LIKE ? OR summary LIKE ?)
      ORDER BY importance DESC, access_count DESC
      LIMIT ?
    `
      )
      .all(userId, `%${query}%`, `%${query}%`, limit) as MemoryEntry[];

    return results.map((e) => this.toOutput(e));
  }

  async getById(id: string): Promise<(MemoryOutput & { userId: string }) | null> {
    const db = getDatabase();
    const result = await db.select().from(memoryEntries).where(eq(memoryEntries.id, id)).limit(1);

    if (!result[0]) return null;

    return {
      ...this.toOutput(result[0]),
      userId: result[0].userId,
    };
  }

  async create(userId: string, data: CreateMemoryData): Promise<MemoryOutput> {
    const db = getDatabase();
    const id = randomUUID();
    const now = new Date().toISOString();

    await db.insert(memoryEntries).values({
      id,
      userId,
      type: data.type,
      content: data.content,
      summary: data.summary,
      importance: data.importance,
      source: data.source,
      metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
      tags: data.tags ? JSON.stringify(data.tags) : undefined,
      expiresAt: data.expiresAt,
      accessCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id,
      type: data.type,
      content: data.content,
      summary: data.summary,
      importance: data.importance,
      source: data.source,
      metadata: data.metadata,
      tags: data.tags,
      accessCount: 0,
      expiresAt: data.expiresAt,
      createdAt: now,
      updatedAt: now,
    };
  }

  async delete(id: string): Promise<void> {
    const db = getDatabase();
    await db.delete(memoryEntries).where(eq(memoryEntries.id, id));
  }

  async deleteBatch(userId: string, ids: string[]): Promise<number> {
    const sqlite = getSQLite();
    const placeholders = ids.map(() => '?').join(',');

    const result = sqlite
      .prepare(
        `
      DELETE FROM memory_entries
      WHERE user_id = ? AND id IN (${placeholders})
    `
      )
      .run(userId, ...ids);

    return result.changes;
  }

  async clearAll(userId: string): Promise<void> {
    const db = getDatabase();
    await db.delete(memoryEntries).where(eq(memoryEntries.userId, userId));
  }

  async recordAccess(id: string): Promise<void> {
    const sqlite = getSQLite();
    sqlite
      .prepare(
        `
      UPDATE memory_entries
      SET access_count = access_count + 1,
          last_accessed_at = datetime('now')
      WHERE id = ?
    `
      )
      .run(id);
  }

  async getStats(userId: string): Promise<MemoryStats> {
    const sqlite = getSQLite();

    const total = sqlite
      .prepare('SELECT COUNT(*) as count FROM memory_entries WHERE user_id = ?')
      .get(userId) as { count: number };

    const byType = sqlite
      .prepare('SELECT type, COUNT(*) as count FROM memory_entries WHERE user_id = ? GROUP BY type')
      .all(userId) as { type: string; count: number }[];

    const byImportance = sqlite
      .prepare('SELECT importance, COUNT(*) as count FROM memory_entries WHERE user_id = ? GROUP BY importance')
      .all(userId) as { importance: string; count: number }[];

    const dateRange = sqlite
      .prepare(
        `
      SELECT
        MIN(created_at) as oldest,
        MAX(created_at) as newest
      FROM memory_entries
      WHERE user_id = ?
    `
      )
      .get(userId) as { oldest: string; newest: string };

    const storageUsed = sqlite
      .prepare('SELECT SUM(LENGTH(content) + LENGTH(COALESCE(summary, ""))) as size FROM memory_entries WHERE user_id = ?')
      .get(userId) as { size: number };

    const typeMap: Record<MemoryType, number> = {
      fact: 0,
      preference: 0,
      context: 0,
      instruction: 0,
      skill: 0,
      relationship: 0,
    };
    byType.forEach((t) => {
      if (t.type in typeMap) {
        typeMap[t.type as MemoryType] = t.count;
      }
    });

    const importanceMap: Record<MemoryImportance, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    byImportance.forEach((i) => {
      if (i.importance in importanceMap) {
        importanceMap[i.importance as MemoryImportance] = i.count;
      }
    });

    return {
      total: total.count,
      byType: typeMap,
      byImportance: importanceMap,
      oldestEntry: dateRange.oldest || '',
      newestEntry: dateRange.newest || '',
      storageUsed: storageUsed.size || 0,
    };
  }

  async exportAll(userId: string): Promise<MemoryOutput[]> {
    const db = getDatabase();
    const results = await db
      .select()
      .from(memoryEntries)
      .where(eq(memoryEntries.userId, userId))
      .orderBy(desc(memoryEntries.createdAt));

    return results.map((e) => this.toOutput(e));
  }

  async importBatch(
    userId: string,
    memories: CreateMemoryData[]
  ): Promise<{ imported: number; failed: number }> {
    let imported = 0;
    let failed = 0;

    for (const memory of memories) {
      try {
        await this.create(userId, memory);
        imported++;
      } catch {
        failed++;
      }
    }

    return { imported, failed };
  }
}

// Singleton instance
let instance: MemoryRepository | null = null;

export function getMemoryRepository(): MemoryRepository {
  if (!instance) {
    instance = new MemoryRepositoryImpl();
  }
  return instance;
}
