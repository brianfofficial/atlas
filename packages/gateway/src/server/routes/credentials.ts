/**
 * Credentials Routes
 *
 * Encrypted credential management endpoints.
 * Integrates with CredentialStore from P0.
 *
 * @module @atlas/gateway/server/routes/credentials
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { ServerEnv } from '../index.js';
import { getCredentialStore } from '../../security/credential-store.js';
import { NotFoundError, ValidationError, ConflictError } from '../middleware/error-handler.js';
import type { CredentialService } from '@atlas/shared';
import { randomUUID } from 'crypto';

const credentials = new Hono<ServerEnv>();

// Valid credential services
const credentialServices: CredentialService[] = [
  'anthropic',
  'openai',
  'google',
  'azure',
  'aws',
  'github',
  'slack',
  'discord',
  'telegram',
  'custom',
];

// Validation schemas
const createCredentialSchema = z.object({
  name: z.string().min(1).max(100),
  service: z.enum(credentialServices as [string, ...string[]]),
  value: z.string().min(1),
});

const updateCredentialSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  value: z.string().min(1).optional(),
});

/**
 * GET /api/credentials
 * List all credentials (without values)
 */
credentials.get('/', async (c) => {
  const store = getCredentialStore();
  await store.initialize();
  const creds = await store.list();

  return c.json(
    creds.map((cred) => ({
      id: cred.id,
      name: cred.name,
      service: cred.service,
      createdAt: cred.createdAt,
      lastRotatedAt: cred.lastRotatedAt,
    }))
  );
});

/**
 * GET /api/credentials/:id
 * Get a single credential (without value)
 */
credentials.get('/:id', async (c) => {
  const id = c.req.param('id');
  const store = getCredentialStore();
  await store.initialize();

  const creds = await store.list();
  const cred = creds.find((cr) => cr.id === id);

  if (!cred) {
    throw new NotFoundError('Credential', id);
  }

  return c.json({
    id: cred.id,
    name: cred.name,
    service: cred.service,
    createdAt: cred.createdAt,
    lastRotatedAt: cred.lastRotatedAt,
  });
});

/**
 * POST /api/credentials
 * Create a new credential
 */
credentials.post('/', zValidator('json', createCredentialSchema), async (c) => {
  const { name, service, value } = c.req.valid('json');
  const store = getCredentialStore();
  await store.initialize();

  // Check for duplicate name
  const creds = await store.list();
  const existing = creds.find((cr) => cr.name === name);
  if (existing) {
    throw new ConflictError(`Credential with name '${name}' already exists`);
  }

  const id = randomUUID();
  const cred = await store.store(id, name, service as CredentialService, value);

  return c.json(
    {
      id: cred.id,
      name: cred.name,
      service: cred.service,
      createdAt: cred.createdAt,
    },
    201
  );
});

/**
 * PUT /api/credentials/:id
 * Update a credential (re-store with new value)
 */
credentials.put('/:id', zValidator('json', updateCredentialSchema), async (c) => {
  const id = c.req.param('id');
  const updates = c.req.valid('json');
  const store = getCredentialStore();
  await store.initialize();

  const creds = await store.list();
  const existing = creds.find((cr) => cr.id === id);

  if (!existing) {
    throw new NotFoundError('Credential', id);
  }

  // If updating value, delete old and re-store
  if (updates.value) {
    await store.delete(id);
    const newCred = await store.store(
      id,
      updates.name || existing.name,
      existing.service as CredentialService,
      updates.value
    );
    return c.json({
      id: newCred.id,
      name: newCred.name,
      service: newCred.service,
      createdAt: newCred.createdAt,
      lastRotatedAt: newCred.lastRotatedAt,
    });
  }

  // If only updating name, we can't easily do that without the value
  throw new ValidationError('Must provide new value to update credential');
});

/**
 * DELETE /api/credentials/:id
 * Delete a credential
 */
credentials.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const store = getCredentialStore();
  await store.initialize();

  const creds = await store.list();
  const existing = creds.find((cr) => cr.id === id);

  if (!existing) {
    throw new NotFoundError('Credential', id);
  }

  await store.delete(id);

  return c.json({ success: true });
});

/**
 * POST /api/credentials/:id/rotate
 * Rotate a credential (mark as rotated with new value)
 */
credentials.post('/:id/rotate', zValidator('json', z.object({ value: z.string().min(1) })), async (c) => {
  const id = c.req.param('id');
  const { value } = c.req.valid('json');
  const store = getCredentialStore();
  await store.initialize();

  const creds = await store.list();
  const existing = creds.find((cr) => cr.id === id);

  if (!existing) {
    throw new NotFoundError('Credential', id);
  }

  // Delete old and re-store with new value
  await store.delete(id);
  const rotated = await store.store(id, existing.name, existing.service as CredentialService, value);

  return c.json({
    id: rotated.id,
    name: rotated.name,
    service: rotated.service,
    createdAt: rotated.createdAt,
    lastRotatedAt: rotated.lastRotatedAt,
  });
});

/**
 * GET /api/credentials/:id/value
 * Get the decrypted credential value (sensitive!)
 */
credentials.get('/:id/value', async (c) => {
  const id = c.req.param('id');
  const store = getCredentialStore();
  await store.initialize();

  try {
    const value = await store.retrieve(id);
    return c.json({ id, value });
  } catch {
    throw new NotFoundError('Credential', id);
  }
});

export default credentials;
