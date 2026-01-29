/**
 * Rollout Module
 *
 * V1 Rollout & Trust Regression Plan implementation.
 * Exports all rollout-related services and types.
 *
 * @module @atlas/gateway/rollout
 */

// Types
export * from './types.js';

// Services
export {
  TrustMonitor,
  initializeTrustMonitor,
  getTrustMonitor,
  type TrustMonitorConfig,
} from './trust-monitor.js';

export {
  RolloutManager,
  initializeRolloutManager,
  getRolloutManager,
  type RolloutManagerConfig,
} from './rollout-manager.js';

export {
  DailyReviewService,
  initializeDailyReviewService,
  getDailyReviewService,
} from './daily-review.js';

// Convenience initialization function
import type { Database } from '../db/index.js';
import { initializeTrustMonitor, type TrustMonitorConfig } from './trust-monitor.js';
import { initializeRolloutManager, type RolloutManagerConfig } from './rollout-manager.js';
import { initializeDailyReviewService } from './daily-review.js';

export interface RolloutSystemConfig {
  trustMonitor?: TrustMonitorConfig;
  rolloutManager?: RolloutManagerConfig;
}

/**
 * Initialize the complete rollout system
 */
export async function initializeRolloutSystem(
  db: Database,
  config: RolloutSystemConfig = {}
): Promise<void> {
  // Initialize services in order
  const trustMonitor = initializeTrustMonitor(db, config.trustMonitor);
  const rolloutManager = initializeRolloutManager(db, config.rolloutManager);
  const dailyReviewService = initializeDailyReviewService(db);

  // Initialize rollout manager (creates singleton state if needed)
  await rolloutManager.initialize();

  // Start trust monitoring
  trustMonitor.start();
}
