/**
 * Files Routes
 *
 * REST endpoints for file upload and management.
 * Files are stored locally with metadata in SQLite.
 *
 * @module @atlas/gateway/server/routes/files
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq, and } from 'drizzle-orm';
import { createHash } from 'crypto';
import { mkdir, writeFile, unlink, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname } from 'path';
import type { ServerEnv } from '../index.js';
import { getDatabase } from '../../db/index.js';
import { files } from '../../db/schema.js';
import { NotFoundError, ValidationError, UnauthorizedError } from '../middleware/error-handler.js';

const filesRoutes = new Hono<ServerEnv>();

// File storage directory (relative to gateway package)
const STORAGE_DIR = join(process.cwd(), '.atlas', 'files');

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_TYPES: Record<string, { ext: string; category: 'image' | 'document' | 'code' }> = {
  // Images
  'image/png': { ext: '.png', category: 'image' },
  'image/jpeg': { ext: '.jpg', category: 'image' },
  'image/gif': { ext: '.gif', category: 'image' },
  'image/webp': { ext: '.webp', category: 'image' },
  // Documents
  'application/pdf': { ext: '.pdf', category: 'document' },
  // Code/text
  'text/plain': { ext: '.txt', category: 'code' },
  'text/javascript': { ext: '.js', category: 'code' },
  'text/typescript': { ext: '.ts', category: 'code' },
  'application/json': { ext: '.json', category: 'code' },
  'text/html': { ext: '.html', category: 'code' },
  'text/css': { ext: '.css', category: 'code' },
  'text/markdown': { ext: '.md', category: 'code' },
  'text/x-python': { ext: '.py', category: 'code' },
  'application/x-python': { ext: '.py', category: 'code' },
  'application/octet-stream': { ext: '', category: 'code' }, // Fallback for code files
};

// Helper functions
function generateId(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

async function ensureStorageDir(): Promise<void> {
  if (!existsSync(STORAGE_DIR)) {
    await mkdir(STORAGE_DIR, { recursive: true });
  }
}

function computeChecksum(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function sanitizeFilename(name: string): string {
  // Remove path components and dangerous characters
  return name
    .split(/[/\\]/).pop() || 'file'
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 255);
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/files/upload
 * Upload a file
 */
filesRoutes.post('/upload', async (c) => {
  const userId = c.get('userId');
  if (!userId) throw new UnauthorizedError();

  await ensureStorageDir();

  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    throw new ValidationError('No file provided');
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new ValidationError(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
  }

  // Determine category from MIME type or extension
  let typeInfo = ALLOWED_TYPES[file.type];
  if (!typeInfo) {
    // Try to determine from extension for code files
    const ext = extname(file.name).toLowerCase();
    const codeExtensions = ['.js', '.ts', '.tsx', '.jsx', '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp', '.sh', '.yaml', '.yml', '.toml', '.sql', '.graphql'];
    if (codeExtensions.includes(ext)) {
      typeInfo = { ext, category: 'code' };
    } else {
      throw new ValidationError(`File type "${file.type || 'unknown'}" is not supported`);
    }
  }

  // Read file content
  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = computeChecksum(buffer);

  // Check for duplicate (same user, same checksum)
  const db = getDatabase();
  const [existing] = await db
    .select()
    .from(files)
    .where(and(eq(files.userId, userId), eq(files.checksum, checksum)))
    .limit(1);

  if (existing) {
    // Return existing file
    return c.json({
      id: existing.id,
      name: existing.name,
      size: existing.size,
      type: existing.mimeType,
      url: `/api/files/${existing.id}`,
      thumbnailUrl: existing.thumbnailUrl,
      createdAt: existing.createdAt,
      duplicate: true,
    });
  }

  // Generate storage path
  const fileId = generateId();
  const sanitizedName = sanitizeFilename(file.name);
  const storageName = `${fileId}${extname(sanitizedName) || typeInfo.ext}`;
  const storagePath = join(STORAGE_DIR, storageName);

  // Write file
  await writeFile(storagePath, buffer);

  // Save metadata
  await db.insert(files).values({
    id: fileId,
    userId,
    name: sanitizedName,
    originalName: file.name,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    category: typeInfo.category,
    storagePath: storageName,
    checksum,
    createdAt: now(),
  });

  return c.json({
    id: fileId,
    name: sanitizedName,
    size: file.size,
    type: file.type || 'application/octet-stream',
    url: `/api/files/${fileId}`,
    thumbnailUrl: typeInfo.category === 'image' ? `/api/files/${fileId}` : undefined,
    createdAt: now(),
  }, 201);
});

/**
 * GET /api/files/:id
 * Get file content
 */
filesRoutes.get('/:id', async (c) => {
  const userId = c.get('userId');
  if (!userId) throw new UnauthorizedError();

  const fileId = c.req.param('id');
  const db = getDatabase();

  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  if (!file) {
    throw new NotFoundError('File', fileId);
  }

  // Check ownership
  if (file.userId !== userId) {
    throw new UnauthorizedError('Access denied to this file');
  }

  const filePath = join(STORAGE_DIR, file.storagePath);

  if (!existsSync(filePath)) {
    throw new NotFoundError('File content', fileId);
  }

  const content = await readFile(filePath);

  c.header('Content-Type', file.mimeType);
  c.header('Content-Disposition', `inline; filename="${file.name}"`);
  c.header('Content-Length', file.size.toString());

  return c.body(content);
});

/**
 * GET /api/files/:id/info
 * Get file metadata
 */
filesRoutes.get('/:id/info', async (c) => {
  const userId = c.get('userId');
  if (!userId) throw new UnauthorizedError();

  const fileId = c.req.param('id');
  const db = getDatabase();

  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  if (!file) {
    throw new NotFoundError('File', fileId);
  }

  // Check ownership
  if (file.userId !== userId) {
    throw new UnauthorizedError('Access denied to this file');
  }

  return c.json({
    id: file.id,
    name: file.name,
    originalName: file.originalName,
    size: file.size,
    type: file.mimeType,
    category: file.category,
    url: `/api/files/${file.id}`,
    thumbnailUrl: file.category === 'image' ? `/api/files/${file.id}` : undefined,
    createdAt: file.createdAt,
  });
});

/**
 * DELETE /api/files/:id
 * Delete a file
 */
filesRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId');
  if (!userId) throw new UnauthorizedError();

  const fileId = c.req.param('id');
  const db = getDatabase();

  const [file] = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  if (!file) {
    throw new NotFoundError('File', fileId);
  }

  // Check ownership
  if (file.userId !== userId) {
    throw new UnauthorizedError('Access denied to this file');
  }

  // Delete from storage
  const filePath = join(STORAGE_DIR, file.storagePath);
  if (existsSync(filePath)) {
    await unlink(filePath);
  }

  // Delete metadata
  await db.delete(files).where(eq(files.id, fileId));

  return c.json({ success: true });
});

/**
 * Helper function to get file info by ID (for internal use)
 */
export async function getFileInfo(fileId: string): Promise<{ name: string; size: number; type: string } | null> {
  const db = getDatabase();
  const [file] = await db
    .select({ name: files.name, size: files.size, type: files.mimeType })
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  return file || null;
}

export default filesRoutes;
