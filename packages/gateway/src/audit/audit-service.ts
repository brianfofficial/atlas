/**
 * Audit Service
 *
 * Centralized audit logging service.
 * Writes to SQLite database and supports querying, searching, and export.
 *
 * @module @atlas/gateway/audit/audit-service
 */

import { getDatabase, getSQLite } from '../db/index.js';
import { auditLogs } from '../db/schema.js';
import { randomUUID } from 'crypto';
import pino from 'pino';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const log = (pino as any)({ name: 'audit-service' });

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
  | 'config:changed';

export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface AuditLogEntry {
  id: string;
  type: AuditEventType;
  severity: AuditSeverity;
  message: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface AuditLogInput {
  type: AuditEventType;
  severity: AuditSeverity;
  message: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditQueryFilters {
  type?: AuditEventType[];
  severity?: AuditSeverity[];
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditStats {
  total: number;
  byType: Record<string, number>;
  bySeverity: Record<AuditSeverity, number>;
  last24Hours: number;
  criticalCount: number;
}

export interface AuditService {
  log(entry: AuditLogInput): Promise<AuditLogEntry>;
  getById(id: string): Promise<AuditLogEntry | null>;
  query(filters: AuditQueryFilters): Promise<AuditLogEntry[]>;
  search(query: string, limit: number): Promise<AuditLogEntry[]>;
  getStats(): Promise<AuditStats>;
  cleanup(retentionDays: number): Promise<number>;
}

class AuditServiceImpl implements AuditService {
  async log(entry: AuditLogInput): Promise<AuditLogEntry> {
    const db = getDatabase();
    const id = randomUUID();
    const timestamp = new Date().toISOString();

    await db.insert(auditLogs).values({
      id,
      type: entry.type,
      severity: entry.severity,
      message: entry.message,
      userId: entry.userId,
      sessionId: entry.sessionId,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : undefined,
      timestamp,
    });

    // Also log to console for critical events
    if (entry.severity === 'critical' || entry.severity === 'error') {
      log.warn(
        {
          type: entry.type,
          severity: entry.severity,
          userId: entry.userId,
        },
        entry.message
      );
    }

    return {
      id,
      type: entry.type,
      severity: entry.severity,
      message: entry.message,
      userId: entry.userId,
      sessionId: entry.sessionId,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      metadata: entry.metadata,
      timestamp,
    };
  }

  async getById(id: string): Promise<AuditLogEntry | null> {
    const sqlite = getSQLite();
    const result = sqlite.prepare('SELECT * FROM audit_logs WHERE id = ?').get(id) as
      | AuditLogEntry
      | undefined;

    if (!result) return null;

    return {
      ...result,
      metadata: result.metadata ? JSON.parse(result.metadata as unknown as string) : undefined,
    };
  }

  async query(filters: AuditQueryFilters): Promise<AuditLogEntry[]> {
    const sqlite = getSQLite();
    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];

    if (filters.type && filters.type.length > 0) {
      const placeholders = filters.type.map(() => '?').join(',');
      conditions.push(`type IN (${placeholders})`);
      params.push(...filters.type);
    }

    if (filters.severity && filters.severity.length > 0) {
      const placeholders = filters.severity.map(() => '?').join(',');
      conditions.push(`severity IN (${placeholders})`);
      params.push(...filters.severity);
    }

    if (filters.userId) {
      conditions.push('user_id = ?');
      params.push(filters.userId);
    }

    if (filters.startDate) {
      conditions.push('timestamp >= ?');
      params.push(filters.startDate.toISOString());
    }

    if (filters.endDate) {
      conditions.push('timestamp <= ?');
      params.push(filters.endDate.toISOString());
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const query = `
      SELECT * FROM audit_logs
      WHERE ${conditions.join(' AND ')}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);

    const results = sqlite.prepare(query).all(...params) as AuditLogEntry[];

    return results.map((r) => ({
      ...r,
      metadata: r.metadata ? JSON.parse(r.metadata as unknown as string) : undefined,
    }));
  }

  async search(query: string, limit: number): Promise<AuditLogEntry[]> {
    const sqlite = getSQLite();

    const results = sqlite
      .prepare(
        `
      SELECT * FROM audit_logs
      WHERE message LIKE ?
      ORDER BY timestamp DESC
      LIMIT ?
    `
      )
      .all(`%${query}%`, limit) as AuditLogEntry[];

    return results.map((r) => ({
      ...r,
      metadata: r.metadata ? JSON.parse(r.metadata as unknown as string) : undefined,
    }));
  }

  async getStats(): Promise<AuditStats> {
    const sqlite = getSQLite();

    const total = sqlite.prepare('SELECT COUNT(*) as count FROM audit_logs').get() as {
      count: number;
    };

    const byType = sqlite
      .prepare('SELECT type, COUNT(*) as count FROM audit_logs GROUP BY type')
      .all() as { type: string; count: number }[];

    const bySeverity = sqlite
      .prepare('SELECT severity, COUNT(*) as count FROM audit_logs GROUP BY severity')
      .all() as { severity: string; count: number }[];

    const last24Hours = sqlite
      .prepare(
        `
      SELECT COUNT(*) as count FROM audit_logs
      WHERE timestamp >= datetime('now', '-24 hours')
    `
      )
      .get() as { count: number };

    const criticalCount = sqlite
      .prepare("SELECT COUNT(*) as count FROM audit_logs WHERE severity = 'critical'")
      .get() as { count: number };

    const typeMap: Record<string, number> = {};
    byType.forEach((t) => {
      typeMap[t.type] = t.count;
    });

    const severityMap: Record<AuditSeverity, number> = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
    };
    bySeverity.forEach((s) => {
      if (s.severity in severityMap) {
        severityMap[s.severity as AuditSeverity] = s.count;
      }
    });

    return {
      total: total.count,
      byType: typeMap,
      bySeverity: severityMap,
      last24Hours: last24Hours.count,
      criticalCount: criticalCount.count,
    };
  }

  async cleanup(retentionDays: number): Promise<number> {
    const sqlite = getSQLite();

    const result = sqlite
      .prepare(
        `
      DELETE FROM audit_logs
      WHERE timestamp < datetime('now', '-' || ? || ' days')
    `
      )
      .run(retentionDays);

    log.info({ deleted: result.changes, retentionDays }, 'Audit log cleanup completed');

    return result.changes;
  }
}

// Singleton instance
let instance: AuditService | null = null;

export function getAuditService(): AuditService {
  if (!instance) {
    instance = new AuditServiceImpl();
  }
  return instance;
}
