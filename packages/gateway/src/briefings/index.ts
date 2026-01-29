/**
 * Briefings Module
 *
 * ATLAS Product Validation Framework - Daily briefings, approval workflows,
 * and metrics tracking for habit formation.
 *
 * @module @atlas/gateway/briefings
 */

// Types
export * from './types.js';

// Core Services
export {
  BriefingService,
  initializeBriefingService,
  getBriefingService,
  startBriefingService,
  stopBriefingService,
} from './briefing-service.js';

// Briefing Generator
export {
  BriefingGenerator,
  initializeBriefingGenerator,
  getBriefingGenerator,
  type CalendarIntegration,
  type EmailIntegration,
  type AIService,
  type BriefingGeneratorConfig,
} from './briefing-generator.js';

// Metrics Tracker
export {
  MetricsTracker,
  initializeMetricsTracker,
  getMetricsTracker,
  type MetricsTrackerConfig,
} from './metrics-tracker.js';

// Draft Approval Workflow
export {
  DraftApprovalWorkflow,
  initializeDraftApprovalWorkflow,
  getDraftApprovalWorkflow,
} from './draft-approval-workflow.js';

// Scheduler
export {
  BriefingScheduler,
  initializeBriefingScheduler,
  getBriefingScheduler,
  startBriefingScheduler,
  stopBriefingScheduler,
} from './briefing-scheduler.js';
