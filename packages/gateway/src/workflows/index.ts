/**
 * Workflows Module
 *
 * Human-in-the-Loop approval system exports.
 */

// Types
export * from './approval-types.js'

// Queue
export { ApprovalQueue, getApprovalQueue } from './approval-queue.js'

// Auto-approve rules
export { AutoApproveRulesManager, getAutoApproveRulesManager } from './auto-approve-rules.js'

// Persistence
export { ApprovalPersistence, getApprovalPersistence } from './approval-persistence.js'

// Main manager
export { ApprovalManager, getApprovalManager } from './approval-manager.js'
