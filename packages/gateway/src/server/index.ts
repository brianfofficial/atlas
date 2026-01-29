/**
 * Atlas Gateway Server
 *
 * Hono-based HTTP server providing API endpoints for the Atlas frontend.
 * Integrates with the security foundation (P0), models (P1), and workflows (P2).
 *
 * @module @atlas/gateway/server
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { timing } from 'hono/timing';
import pino from 'pino';

import { authMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rate-limit.js';
import { corsMiddleware } from './middleware/cors.js';
import { errorHandler } from './middleware/error-handler.js';
import { auditMiddleware } from './middleware/audit.js';

import authRoutes from './routes/auth.js';
import approvalsRoutes from './routes/approvals.js';
import dashboardRoutes from './routes/dashboard.js';
import modelsRoutes from './routes/models.js';
import credentialsRoutes from './routes/credentials.js';
import preferencesRoutes from './routes/preferences.js';
import memoryRoutes from './routes/memory.js';
import auditRoutes from './routes/audit.js';

import { initializeDatabase } from '../db/index.js';
import { EventBroadcaster, getEventBroadcaster } from '../events/event-broadcaster.js';
import { DEFAULT_CONFIG, type AtlasConfig } from '../index.js';

// Server logger
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const log = (pino as any)({
  name: 'atlas-server',
  level: process.env.LOG_LEVEL || 'info',
});

// Environment type extension for Hono context
export interface ServerEnv {
  Variables: {
    userId?: string;
    deviceId?: string;
    sessionId?: string;
    requestId: string;
    startTime: number;
  };
}

/**
 * Create and configure the Atlas server
 */
export function createServer(config: Partial<AtlasConfig> = {}): Hono<ServerEnv> {
  const app = new Hono<ServerEnv>();
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Request ID and timing
  app.use('*', async (c, next) => {
    c.set('requestId', crypto.randomUUID());
    c.set('startTime', Date.now());
    await next();
  });

  // Security headers
  app.use('*', secureHeaders());

  // CORS
  app.use('*', corsMiddleware(mergedConfig));

  // Request logging
  if (process.env.NODE_ENV !== 'test') {
    app.use('*', logger());
  }

  // Timing headers (for development)
  if (process.env.NODE_ENV === 'development') {
    app.use('*', timing());
  }

  // Rate limiting
  app.use('/api/*', rateLimitMiddleware());

  // Audit logging for all API requests
  app.use('/api/*', auditMiddleware());

  // Error handling
  app.onError(errorHandler);

  // Health check (no auth required)
  app.get('/health', (c) => {
    return c.json({
      status: 'healthy',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    });
  });

  // API routes
  // Auth routes (partially protected)
  app.route('/api/auth', authRoutes);

  // Protected routes (require authentication)
  app.use('/api/approvals/*', authMiddleware());
  app.use('/api/dashboard/*', authMiddleware());
  app.use('/api/models/*', authMiddleware());
  app.use('/api/credentials/*', authMiddleware());
  app.use('/api/preferences/*', authMiddleware());
  app.use('/api/memory/*', authMiddleware());
  app.use('/api/audit/*', authMiddleware());

  app.route('/api/approvals', approvalsRoutes);
  app.route('/api/dashboard', dashboardRoutes);
  app.route('/api/models', modelsRoutes);
  app.route('/api/credentials', credentialsRoutes);
  app.route('/api/preferences', preferencesRoutes);
  app.route('/api/memory', memoryRoutes);
  app.route('/api/audit', auditRoutes);

  // 404 handler
  app.notFound((c) => {
    return c.json(
      {
        error: 'Not Found',
        message: `Route ${c.req.method} ${c.req.path} not found`,
        code: 'NOT_FOUND',
      },
      404
    );
  });

  return app;
}

/**
 * Start the Atlas server
 */
export async function startServer(config: Partial<AtlasConfig> = {}): Promise<void> {
  // Support environment variable overrides
  const envConfig: Partial<AtlasConfig> = {
    network: {
      port: process.env.ATLAS_PORT ? parseInt(process.env.ATLAS_PORT, 10) : DEFAULT_CONFIG.network.port,
      bindAddress: process.env.ATLAS_HOST || DEFAULT_CONFIG.network.bindAddress,
      allowedIPs: DEFAULT_CONFIG.network.allowedIPs,
      tlsEnabled: DEFAULT_CONFIG.network.tlsEnabled,
    },
  };
  const mergedConfig = { ...DEFAULT_CONFIG, ...envConfig, ...config };

  // Initialize database
  log.info('Initializing database...');
  await initializeDatabase();

  // Initialize event broadcaster (for WebSocket)
  log.info('Initializing event broadcaster...');
  getEventBroadcaster();

  // Create server
  const app = createServer(mergedConfig);

  // Display startup warnings
  displayStartupWarnings(mergedConfig);

  // Start HTTP server
  const port = mergedConfig.network.port;
  const hostname = mergedConfig.network.bindAddress;

  log.info(`Starting Atlas Gateway on ${hostname}:${port}...`);

  serve(
    {
      fetch: app.fetch,
      port,
      hostname,
    },
    (info) => {
      log.info(`Atlas Gateway running at http://${info.address}:${info.port}`);
      log.info('Security Features:');
      log.info('  - Mandatory MFA: Enabled');
      log.info('  - JWT Tokens: 15-minute expiration');
      log.info('  - Rate Limiting: 100 req/min');
      log.info('  - CORS: Restricted origins');
      log.info('  - Audit Logging: All API requests');
    }
  );
}

/**
 * Display security warnings on startup
 */
function displayStartupWarnings(config: AtlasConfig): void {
  // Check for unsafe configurations
  const warnings: string[] = [];

  if (config.network.bindAddress !== '127.0.0.1' && config.network.bindAddress !== 'localhost') {
    warnings.push(
      'WARNING: Server is binding to non-localhost address. Ensure proper firewall configuration.'
    );
  }

  if (config.network.allowedIPs.length === 0 && config.network.bindAddress !== '127.0.0.1') {
    warnings.push('WARNING: No IP allowlist configured. Consider restricting access.');
  }

  if (!config.network.tlsEnabled && config.network.bindAddress !== '127.0.0.1') {
    warnings.push('WARNING: TLS is disabled on non-localhost binding. Traffic will be unencrypted.');
  }

  // Check if running from personal directory (ClawdBot recommendation)
  const cwd = process.cwd();
  const unsafePaths = ['/Desktop', '/Documents', '/Downloads'];
  if (unsafePaths.some((p) => cwd.includes(p))) {
    warnings.push(
      'WARNING: Running from personal directory. Consider running from dedicated workspace.'
    );
  }

  // Display warnings
  for (const warning of warnings) {
    log.warn(warning);
  }
}

// Run server if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((err) => {
    log.error({ err }, 'Failed to start server');
    process.exit(1);
  });
}
