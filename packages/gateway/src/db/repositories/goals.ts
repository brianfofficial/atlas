/**
 * Goals Repository
 *
 * Data access layer for user goals.
 *
 * @module @atlas/gateway/db/repositories/goals
 */

import { eq, and } from 'drizzle-orm';
import { getDatabase } from '../index.js';
import { goals, type Goal } from '../schema.js';
import { randomUUID } from 'crypto';

export interface CreateGoalData {
  title: string;
  description?: string;
  category: 'personal' | 'professional' | 'health' | 'learning' | 'other';
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  progress?: number;
}

export interface UpdateGoalData {
  title?: string;
  description?: string;
  category?: 'personal' | 'professional' | 'health' | 'learning' | 'other';
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
  progress?: number;
}

export interface GoalOutput {
  id: string;
  title: string;
  description?: string;
  category: string;
  priority: string;
  dueDate?: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export interface GoalsRepository {
  getByUserId(userId: string): Promise<GoalOutput[]>;
  getById(id: string): Promise<(GoalOutput & { userId: string }) | null>;
  create(userId: string, data: CreateGoalData): Promise<GoalOutput>;
  update(id: string, data: UpdateGoalData): Promise<GoalOutput>;
  delete(id: string): Promise<void>;
}

class GoalsRepositoryImpl implements GoalsRepository {
  async getByUserId(userId: string): Promise<GoalOutput[]> {
    const db = getDatabase();
    const result = await db.select().from(goals).where(eq(goals.userId, userId));

    return result.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description || undefined,
      category: g.category,
      priority: g.priority,
      dueDate: g.dueDate || undefined,
      progress: g.progress,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    }));
  }

  async getById(id: string): Promise<(GoalOutput & { userId: string }) | null> {
    const db = getDatabase();
    const result = await db.select().from(goals).where(eq(goals.id, id)).limit(1);

    if (!result[0]) return null;

    const g = result[0];
    return {
      id: g.id,
      userId: g.userId,
      title: g.title,
      description: g.description || undefined,
      category: g.category,
      priority: g.priority,
      dueDate: g.dueDate || undefined,
      progress: g.progress,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    };
  }

  async create(userId: string, data: CreateGoalData): Promise<GoalOutput> {
    const db = getDatabase();
    const id = randomUUID();
    const now = new Date().toISOString();

    await db.insert(goals).values({
      id,
      userId,
      title: data.title,
      description: data.description,
      category: data.category,
      priority: data.priority,
      dueDate: data.dueDate,
      progress: data.progress ?? 0,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id,
      title: data.title,
      description: data.description,
      category: data.category,
      priority: data.priority,
      dueDate: data.dueDate,
      progress: data.progress ?? 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  async update(id: string, data: UpdateGoalData): Promise<GoalOutput> {
    const db = getDatabase();
    const now = new Date().toISOString();

    await db
      .update(goals)
      .set({
        ...data,
        updatedAt: now,
      })
      .where(eq(goals.id, id));

    const updated = await this.getById(id);
    if (!updated) throw new Error('Goal not found after update');

    return updated;
  }

  async delete(id: string): Promise<void> {
    const db = getDatabase();
    await db.delete(goals).where(eq(goals.id, id));
  }
}

// Singleton instance
let instance: GoalsRepository | null = null;

export function getGoalsRepository(): GoalsRepository {
  if (!instance) {
    instance = new GoalsRepositoryImpl();
  }
  return instance;
}
