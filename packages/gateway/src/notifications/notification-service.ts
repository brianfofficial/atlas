/**
 * Notification Service
 *
 * Centralized notification sending with multiple adapter support.
 * Handles approval requests, security alerts, and daily digests.
 *
 * @module @atlas/gateway/notifications/notification-service
 */

import pino from 'pino';
import { SlackAdapter } from './adapters/slack.js';
import { DiscordAdapter } from './adapters/discord.js';
import { TelegramAdapter } from './adapters/telegram.js';
import { EmailAdapter } from './adapters/email.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const log = (pino as any)({ name: 'notification-service' });

export type NotificationType = 'approval_request' | 'security_alert' | 'daily_digest' | 'budget_warning';

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  metadata?: Record<string, unknown>;
  actionUrl?: string;
}

export interface NotificationAdapter {
  name: string;
  isConfigured(): boolean;
  send(payload: NotificationPayload): Promise<boolean>;
}

export interface NotificationConfig {
  slack?: {
    webhookUrl: string;
    channel?: string;
  };
  discord?: {
    webhookUrl: string;
  };
  telegram?: {
    botToken: string;
    chatId: string;
  };
  email?: {
    provider: 'smtp' | 'resend';
    from: string;
    to: string[];
    // SMTP config
    smtp?: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
    // Resend config
    resendApiKey?: string;
  };
}

export interface NotificationService {
  configure(config: Partial<NotificationConfig>): void;
  send(payload: NotificationPayload, adapters?: string[]): Promise<{ sent: string[]; failed: string[] }>;
  getConfiguredAdapters(): string[];
  sendApprovalRequest(request: {
    id: string;
    operation: string;
    riskLevel: string;
    context: string;
    expiresAt: string;
  }): Promise<void>;
  sendSecurityAlert(alert: {
    type: string;
    message: string;
    severity: 'warning' | 'error' | 'critical';
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  sendDailyDigest(digest: {
    approvals: { pending: number; approved: number; denied: number };
    security: { events: number; alerts: number };
    costs: { today: number; budget: number };
  }): Promise<void>;
  sendBudgetWarning(warning: {
    current: number;
    limit: number;
    percentage: number;
  }): Promise<void>;
}

class NotificationServiceImpl implements NotificationService {
  private adapters: Map<string, NotificationAdapter> = new Map();
  private config: NotificationConfig = {};

  constructor() {
    // Initialize adapters (they'll be inactive until configured)
    this.adapters.set('slack', new SlackAdapter());
    this.adapters.set('discord', new DiscordAdapter());
    this.adapters.set('telegram', new TelegramAdapter());
    this.adapters.set('email', new EmailAdapter());
  }

  configure(config: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...config };

    // Configure each adapter
    if (config.slack) {
      (this.adapters.get('slack') as SlackAdapter).configure(config.slack);
    }
    if (config.discord) {
      (this.adapters.get('discord') as DiscordAdapter).configure(config.discord);
    }
    if (config.telegram) {
      (this.adapters.get('telegram') as TelegramAdapter).configure(config.telegram);
    }
    if (config.email) {
      (this.adapters.get('email') as EmailAdapter).configure(config.email);
    }

    log.info(
      { configured: this.getConfiguredAdapters() },
      'Notification service configured'
    );
  }

  async send(
    payload: NotificationPayload,
    adapterNames?: string[]
  ): Promise<{ sent: string[]; failed: string[] }> {
    const sent: string[] = [];
    const failed: string[] = [];

    // Use specified adapters or all configured ones
    const targetAdapters = adapterNames
      ? adapterNames.filter((name) => this.adapters.has(name))
      : this.getConfiguredAdapters();

    for (const name of targetAdapters) {
      const adapter = this.adapters.get(name);
      if (!adapter || !adapter.isConfigured()) {
        failed.push(name);
        continue;
      }

      try {
        const success = await adapter.send(payload);
        if (success) {
          sent.push(name);
        } else {
          failed.push(name);
        }
      } catch (error) {
        log.error({ error, adapter: name }, 'Failed to send notification');
        failed.push(name);
      }
    }

    return { sent, failed };
  }

  getConfiguredAdapters(): string[] {
    const configured: string[] = [];
    for (const [name, adapter] of this.adapters.entries()) {
      if (adapter.isConfigured()) {
        configured.push(name);
      }
    }
    return configured;
  }

  async sendApprovalRequest(request: {
    id: string;
    operation: string;
    riskLevel: string;
    context: string;
    expiresAt: string;
  }): Promise<void> {
    const severity = this.riskToSeverity(request.riskLevel);

    await this.send({
      type: 'approval_request',
      title: `🔐 Approval Required: ${request.operation}`,
      message: request.context,
      severity,
      metadata: {
        requestId: request.id,
        riskLevel: request.riskLevel,
        expiresAt: request.expiresAt,
      },
      actionUrl: `/approvals/${request.id}`,
    });
  }

  async sendSecurityAlert(alert: {
    type: string;
    message: string;
    severity: 'warning' | 'error' | 'critical';
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const emoji = alert.severity === 'critical' ? '🚨' : alert.severity === 'error' ? '❌' : '⚠️';

    await this.send({
      type: 'security_alert',
      title: `${emoji} Security Alert: ${alert.type}`,
      message: alert.message,
      severity: alert.severity,
      metadata: alert.metadata,
    });
  }

  async sendDailyDigest(digest: {
    approvals: { pending: number; approved: number; denied: number };
    security: { events: number; alerts: number };
    costs: { today: number; budget: number };
  }): Promise<void> {
    const costPercentage = digest.costs.budget > 0
      ? Math.round((digest.costs.today / digest.costs.budget) * 100)
      : 0;

    const message = [
      `📋 **Approvals**`,
      `  • Pending: ${digest.approvals.pending}`,
      `  • Approved: ${digest.approvals.approved}`,
      `  • Denied: ${digest.approvals.denied}`,
      ``,
      `🔒 **Security**`,
      `  • Events: ${digest.security.events}`,
      `  • Alerts: ${digest.security.alerts}`,
      ``,
      `💰 **Costs**`,
      `  • Today: $${digest.costs.today.toFixed(2)}`,
      `  • Budget Used: ${costPercentage}%`,
    ].join('\n');

    await this.send({
      type: 'daily_digest',
      title: '📊 Atlas Daily Digest',
      message,
      severity: 'info',
      metadata: digest,
    });
  }

  async sendBudgetWarning(warning: {
    current: number;
    limit: number;
    percentage: number;
  }): Promise<void> {
    const severity = warning.percentage >= 100 ? 'error' : warning.percentage >= 90 ? 'warning' : 'info';

    await this.send({
      type: 'budget_warning',
      title: `💸 Budget Warning: ${warning.percentage}% Used`,
      message: `You have used $${warning.current.toFixed(2)} of your $${warning.limit.toFixed(2)} budget (${warning.percentage}%).`,
      severity,
      metadata: warning,
    });
  }

  private riskToSeverity(riskLevel: string): 'info' | 'warning' | 'error' | 'critical' {
    switch (riskLevel) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      default:
        return 'info';
    }
  }
}

// Singleton instance
let instance: NotificationService | null = null;

export function getNotificationService(): NotificationService {
  if (!instance) {
    instance = new NotificationServiceImpl();
  }
  return instance;
}
