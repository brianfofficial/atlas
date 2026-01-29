/**
 * Discord Notification Adapter
 *
 * Sends notifications via Discord webhook.
 *
 * @module @atlas/gateway/notifications/adapters/discord
 */

import type { NotificationAdapter, NotificationPayload } from '../notification-service.js';
import pino from 'pino';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const log = (pino as any)({ name: 'discord-adapter' });

interface DiscordConfig {
  webhookUrl: string;
}

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
}

interface DiscordMessage {
  content?: string;
  embeds: DiscordEmbed[];
}

export class DiscordAdapter implements NotificationAdapter {
  name = 'discord';
  private config: DiscordConfig | null = null;

  configure(config: DiscordConfig): void {
    this.config = config;
  }

  isConfigured(): boolean {
    return !!this.config?.webhookUrl;
  }

  async send(payload: NotificationPayload): Promise<boolean> {
    if (!this.config) {
      log.warn('Discord adapter not configured');
      return false;
    }

    const color = this.severityToColor(payload.severity);

    const embed: DiscordEmbed = {
      title: payload.title,
      description: payload.message,
      color,
      fields: payload.metadata
        ? Object.entries(payload.metadata)
            .filter(([_, v]) => v !== undefined)
            .map(([key, value]) => ({
              name: this.formatFieldName(key),
              value: String(value),
              inline: String(value).length < 30,
            }))
        : undefined,
      footer: payload.actionUrl
        ? { text: `View: ${payload.actionUrl}` }
        : { text: 'Atlas Gateway' },
      timestamp: new Date().toISOString(),
    };

    const message: DiscordMessage = {
      embeds: [embed],
    };

    try {
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        log.error({ status: response.status }, 'Discord webhook failed');
        return false;
      }

      return true;
    } catch (error) {
      log.error({ error }, 'Discord webhook error');
      return false;
    }
  }

  private severityToColor(severity?: string): number {
    switch (severity) {
      case 'critical':
        return 0xdc2626; // Red
      case 'error':
        return 0xf97316; // Orange
      case 'warning':
        return 0xeab308; // Yellow
      default:
        return 0x3b82f6; // Blue
    }
  }

  private formatFieldName(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }
}
