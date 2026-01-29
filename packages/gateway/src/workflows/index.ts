/**
 * Workflows Module
 *
 * Human-in-the-Loop approval system exports.
 */

// Types
export * from './approval-types'

// Queue
export { ApprovalQueue, getApprovalQueue } from './approval-queue'

// Auto-approve rules
export { AutoApproveRulesManager, getAutoApproveRulesManager } from './auto-approve-rules'

// Persistence
export { ApprovalPersistence, getApprovalPersistence } from './approval-persistence'

// Main manager
export { ApprovalManager, getApprovalManager } from './approval-manager'
