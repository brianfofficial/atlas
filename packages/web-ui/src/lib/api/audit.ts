/**
 * Audit Log API functions
 *
 * Handles audit log retrieval and management.
 */

import { apiGet } from './client'

/**
 * Audit log entry types
 */
export type AuditEventType =
  | 'auth:login'
  | 'auth:logout'
  | 'auth:mfa_verify'
  | 'auth:failed_login'
  | 'approval:created'
  | 'approval:approved'
  | 'approval:denied'
  | 'approval:expired'
  | 'approval:auto_approved'
  | 'credential:created'
  | 'credential:accessed'
  | 'credential:rotated'
  | 'credential:deleted'
  | 'sandbox:execution'
  | 'sandbox:blocked'
  | 'security:injection_blocked'
  | 'security:exfiltration_blocked'
  | 'network:request_blocked'
  | 'session:created'
  | 'session:invalidated'
  | 'config:changed'

/**
 * Audit severity levels
 */
export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical'

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string
  type: AuditEventType
  severity: AuditSeverity
  message: string
  userId?: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, unknown>
  timestamp: string
}

/**
 * Audit log filters
 */
export interface AuditLogFilters {
  type?: AuditEventType | AuditEventType[]
  severity?: AuditSeverity | AuditSeverity[]
  userId?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}

/**
 * Audit statistics
 */
export interface AuditStats {
  total: number
  byType: Record<string, number>
  bySeverity: Record<AuditSeverity, number>
  last24Hours: number
  criticalCount: number
}

/**
 * Get audit logs with optional filters
 */
export async function getAuditLogs(filters?: AuditLogFilters): Promise<AuditLogEntry[]> {
  const params = new URLSearchParams()

  if (filters?.type) {
    const types = Array.isArray(filters.type) ? filters.type : [filters.type]
    types.forEach(t => params.append('type', t))
  }
  if (filters?.severity) {
    const severities = Array.isArray(filters.severity) ? filters.severity : [filters.severity]
    severities.forEach(s => params.append('severity', s))
  }
  if (filters?.userId) params.set('userId', filters.userId)
  if (filters?.startDate) params.set('startDate', filters.startDate)
  if (filters?.endDate) params.set('endDate', filters.endDate)
  if (filters?.limit) params.set('limit', String(filters.limit))
  if (filters?.offset) params.set('offset', String(filters.offset))

  const query = params.toString()
  return apiGet<AuditLogEntry[]>(`/api/audit/logs${query ? `?${query}` : ''}`)
}

/**
 * Get a single audit log entry
 */
export async function getAuditLogEntry(id: string): Promise<AuditLogEntry> {
  return apiGet<AuditLogEntry>(`/api/audit/logs/${id}`)
}

/**
 * Get audit statistics
 */
export async function getAuditStats(): Promise<AuditStats> {
  return apiGet<AuditStats>('/api/audit/stats')
}

/**
 * Search audit logs
 */
export async function searchAuditLogs(query: string, limit = 50): Promise<AuditLogEntry[]> {
  return apiGet<AuditLogEntry[]>(`/api/audit/search?q=${encodeURIComponent(query)}&limit=${limit}`)
}

/**
 * Export audit logs
 */
export async function exportAuditLogs(filters?: AuditLogFilters): Promise<Blob> {
  const params = new URLSearchParams()
  if (filters?.startDate) params.set('startDate', filters.startDate)
  if (filters?.endDate) params.set('endDate', filters.endDate)
  const query = params.toString()

  const response = await fetch(`/api/audit/export${query ? `?${query}` : ''}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('atlas_token')}`,
    },
  })
  return response.blob()
}
