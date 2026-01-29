/**
 * Dashboard API functions
 *
 * Handles dashboard statistics and overview data.
 */

import { apiGet } from './client'

/**
 * Dashboard statistics
 */
export interface DashboardStats {
  credentials: {
    total: number
    encrypted: number
    needsRotation: number
  }
  sessions: {
    active: number
    total: number
    blocked: number
  }
  sandbox: {
    running: number
    completed: number
    failed: number
  }
  security: {
    score: number
    issues: number
  }
}

/**
 * Security event for the activity feed
 */
export interface SecurityEvent {
  id: string
  type: 'success' | 'warning' | 'danger' | 'info'
  title: string
  description: string
  timestamp: string
  category?: string
  metadata?: Record<string, unknown>
}

/**
 * Get dashboard statistics
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  return apiGet<DashboardStats>('/api/dashboard/stats')
}

/**
 * Get recent security events
 */
export async function getSecurityEvents(limit = 10): Promise<SecurityEvent[]> {
  return apiGet<SecurityEvent[]>(`/api/dashboard/events?limit=${limit}`)
}

/**
 * Get security posture overview
 */
export interface SecurityPosture {
  mfaEnabled: boolean
  dockerAvailable: boolean
  sandboxActive: boolean
  networkSecure: boolean
  credentialEncryption: 'AES-256-GCM' | 'keychain' | 'none'
  inputSanitization: boolean
  patternCount: number
}

export async function getSecurityPosture(): Promise<SecurityPosture> {
  return apiGet<SecurityPosture>('/api/dashboard/posture')
}
