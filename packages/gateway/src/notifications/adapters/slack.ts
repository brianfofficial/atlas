/**
 * Slack Notification Adapter
 *
 * Sends notifications via Slack webhook.
 *
 * @module @atlas/gateway/notifications/adapters/slack
 */

import type { NotificationAdapter, NotificationPayload } from '../notification-service.js';
import pino from 'pino';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const log = (pino as any)({ name: 'slack-adapter' });

interface SlackConfig {
  webhookUrl: string;
  channel?: string;
}

interface SlackMessage {
  text: string;
  channel?: string;
  attachments?: SlackAttachment[];
}

interface SlackAttachment {
  color: string;
  title: string;
  text: string;
  fields?: { title: string; value: string; short?: boolean }[];
  footer?: string;
  ts?: number;
}

export class SlackAdapter implements NotificationAdapter {
  name = 'slack';
  private config: SlackConfig | null = null;

  configure(config: SlackConfig): void {
    this.config = config;
  }

  isConfigured(): boolean {
    return !!this.config?.webhookUrl;
  }

  async send(payload: NotificationPayload): Promise<boolean> {
    if (!this.config) {
      log.warn('Slack adapter not configured');
      return false;
    }

    const color = this.severityToColor(payload.severity);
    const emoji = this.typeToEmoji(payload.type);

    const message: SlackMessage = {
      text: `${emoji} ${payload.title}`,
      channel: this.config.channel,
      attachments: [
        {
          color,
          title: payload.title,
          text: payload.message,
          fields: payload.metadata
            ? Object.entries(payload.metadata)
                .filter(([_, v]) => v !== undefined)
                .map(([key, value]) => ({
                  title: this.formatFieldTitle(key),
                  value: String(value),
                  short: String(value).length < 30,
                }))
            : undefined,
          footer: payload.actionUrl ? `View: ${payload.actionUrl}` : undefined,
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    try {
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        log.error({ status: response.status }, 'Slack webhook failed');
        return false;
      }

      return true;
    } catch (error) {
      log.error({ error }, 'Slack webhook error');
      return false;
    }
  }

  private severityToColor(severity?: string): string {
    switch (severity) {
      case 'critical':
        return '#dc2626'; // Red
      case 'error':
        return '#f97316'; // Orange
      case 'warning':
        return '#eab308'; // Yellow
      default:
        return '#3b82f6'; // Blue
    }
  }

  private typeToEmoji(type: string): string {
    switch (type) {
      case 'approval_request':
        return '🔐';
      case 'security_alert':
        return '🚨';
      case 'daily_digest':
        return '📊';
      case 'budget_warning':
        return '💸';
      default:
        return '📢';
    }
  }

  private formatFieldTitle(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }
}
