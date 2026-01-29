/**
 * Approvals API functions
 *
 * Handles approval workflow operations.
 */

import { apiGet, apiPost } from './client'

/**
 * Approval request types
 */
export type ApprovalCategory =
  | 'file_write'
  | 'file_delete'
  | 'network_call'
  | 'credential_use'
  | 'dangerous_command'
  | 'external_api'
  | 'system_config'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'denied'
  | 'expired'
  | 'auto_approved'

export interface ApprovalRequest {
  id: string
  category: ApprovalCategory
  operation: string
  action: string
  riskLevel: RiskLevel
  context: string
  technicalDetails?: string
  sessionId: string
  userId?: string
  createdAt: string
  expiresAt: string
  status: ApprovalStatus
  metadata?: Record<string, unknown>
}

export interface ApprovalAuditEntry {
  id: string
  requestId: string
  action: 'created' | 'approved' | 'denied' | 'expired' | 'auto_approved'
  timestamp: string
  userId?: string
  details?: Record<string, unknown>
  ipAddress?: string
}

export interface ApprovalStats {
  pending: number
  approvedToday: number
  deniedToday: number
  autoApprovedToday: number
  expiredToday: number
  averageDecisionTimeMs: number
  topCategories: { category: ApprovalCategory; count: number }[]
}

/**
 * Get pending approval requests
 */
export async function getPendingApprovals(): Promise<ApprovalRequest[]> {
  return apiGet<ApprovalRequest[]>('/api/approvals/pending')
}

/**
 * Get approval history
 */
export async function getApprovalHistory(params?: {
  limit?: number
  offset?: number
}): Promise<ApprovalAuditEntry[]> {
  const query = new URLSearchParams()
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.offset) query.set('offset', String(params.offset))
  const queryStr = query.toString()
  return apiGet<ApprovalAuditEntry[]>(`/api/approvals/history${queryStr ? `?${queryStr}` : ''}`)
}

/**
 * Get approval statistics
 */
export async function getApprovalStats(): Promise<ApprovalStats> {
  return apiGet<ApprovalStats>('/api/approvals/stats')
}

/**
 * Approve a request
 */
export async function approveRequest(id: string, remember?: boolean): Promise<ApprovalRequest> {
  return apiPost<ApprovalRequest>(`/api/approvals/${id}/approve`, { remember })
}

/**
 * Deny a request
 */
export async function denyRequest(id: string, reason?: string): Promise<ApprovalRequest> {
  return apiPost<ApprovalRequest>(`/api/approvals/${id}/deny`, { reason })
}

/**
 * Get a single approval request
 */
export async function getApprovalRequest(id: string): Promise<ApprovalRequest> {
  return apiGet<ApprovalRequest>(`/api/approvals/${id}`)
}
