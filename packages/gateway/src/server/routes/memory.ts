/**
 * Memory Routes
 *
 * AI memory store management endpoints.
 *
 * @module @atlas/gateway/server/routes/memory
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { ServerEnv } from '../index.js';
import { getMemoryRepository } from '../../db/repositories/memory.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../middleware/error-handler.js';

const memory = new Hono<ServerEnv>();

// Memory types
const memoryTypes = ['fact', 'preference', 'context', 'instruction', 'skill', 'relationship'] as const;
const importanceLevels = ['low', 'medium', 'high', 'critical'] as const;
const sources = ['user', 'conversation', 'system', 'inference'] as const;

// Validation schemas
const memoryQuerySchema = z.object({
  type: z.enum(memoryTypes).optional(),
  importance: z.enum(importanceLevels).optional(),
  source: z.enum(sources).optional(),
  q: z.string().optional(),
  tag: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

const searchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().min(1).max(50).optional().default(10),
});

const memoryCreateSchema = z.object({
  type: z.enum(memoryTypes),
  content: z.string().min(1).max(10000),
  summary: z.string().max(500).optional(),
  importance: z.enum(importanceLevels),
  source: z.enum(sources),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  expiresAt: z.string().datetime().optional(),
});

const memoryBatchDeleteSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
});

const memoryImportSchema = z.object({
  memories: z.array(memoryCreateSchema),
});

/**
 * GET /api/memory
 * Get memories with optional filters
 */
memory.get('/', zValidator('query', memoryQuerySchema), async (c) => {
  const userId = c.get('userId');
  const filters = c.req.valid('query');

  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const memoryRepo = getMemoryRepository();
  const memories = await memoryRepo.query(userId, filters);

  return c.json(memories);
});

/**
 * GET /api/memory/search
 * Search memories by content
 */
memory.get('/search', zValidator('query', searchQuerySchema), async (c) => {
  const userId = c.get('userId');
  const { q, limit } = c.req.valid('query');

  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const memoryRepo = getMemoryRepository();
  const results = await memoryRepo.search(userId, q, limit);

  return c.json(results);
});

/**
 * GET /api/memory/stats
 * Get memory statistics
 */
memory.get('/stats', async (c) => {
  const userId = c.get('userId');

  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const memoryRepo = getMemoryRepository();
  const stats = await memoryRepo.getStats(userId);

  return c.json(stats);
});

/**
 * GET /api/memory/export
 * Export all memories
 */
memory.get('/export', async (c) => {
  const userId = c.get('userId');

  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const memoryRepo = getMemoryRepository();
  const memories = await memoryRepo.exportAll(userId);

  return c.json(memories);
});

/**
 * GET /api/memory/:id
 * Get a single memory
 */
memory.get('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const memoryRepo = getMemoryRepository();
  const entry = await memoryRepo.getById(id);

  if (!entry) {
    throw new NotFoundError('Memory', id);
  }

  if (entry.userId !== userId) {
    throw new ForbiddenError('Access denied to this memory');
  }

  // Increment access count
  await memoryRepo.recordAccess(id);

  return c.json(entry);
});

/**
 * POST /api/memory
 * Create a new memory
 */
memory.post('/', zValidator('json', memoryCreateSchema), async (c) => {
  const userId = c.get('userId');
  const memoryData = c.req.valid('json');

  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const memoryRepo = getMemoryRepository();
  const entry = await memoryRepo.create(userId, memoryData);

  return c.json(entry, 201);
});

/**
 * DELETE /api/memory/:id
 * Delete a memory
 */
memory.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const memoryRepo = getMemoryRepository();
  const existing = await memoryRepo.getById(id);

  if (!existing) {
    throw new NotFoundError('Memory', id);
  }

  if (existing.userId !== userId) {
    throw new ForbiddenError('Access denied to this memory');
  }

  await memoryRepo.delete(id);

  return c.json({ success: true });
});

/**
 * POST /api/memory/delete-batch
 * Delete multiple memories
 */
memory.post('/delete-batch', zValidator('json', memoryBatchDeleteSchema), async (c) => {
  const userId = c.get('userId');
  const { ids } = c.req.valid('json');

  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const memoryRepo = getMemoryRepository();
  const deleted = await memoryRepo.deleteBatch(userId, ids);

  return c.json({ deleted });
});

/**
 * DELETE /api/memory/all
 * Clear all memories (dangerous!)
 */
memory.delete('/all', async (c) => {
  const userId = c.get('userId');

  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const memoryRepo = getMemoryRepository();
  await memoryRepo.clearAll(userId);

  return c.json({ success: true });
});

/**
 * POST /api/memory/import
 * Import memories from JSON
 */
memory.post('/import', zValidator('json', memoryImportSchema), async (c) => {
  const userId = c.get('userId');
  const { memories } = c.req.valid('json');

  if (!userId) {
    throw new ValidationError('User ID required');
  }

  const memoryRepo = getMemoryRepository();
  const result = await memoryRepo.importBatch(userId, memories);

  return c.json(result);
});

export default memory;
