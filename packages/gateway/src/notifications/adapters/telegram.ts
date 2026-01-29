/**
 * Telegram Notification Adapter
 *
 * Sends notifications via Telegram Bot API.
 *
 * @module @atlas/gateway/notifications/adapters/telegram
 */

import type { NotificationAdapter, NotificationPayload } from '../notification-service.js';
import pino from 'pino';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const log = (pino as any)({ name: 'telegram-adapter' });

interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export class TelegramAdapter implements NotificationAdapter {
  name = 'telegram';
  private config: TelegramConfig | null = null;

  configure(config: TelegramConfig): void {
    this.config = config;
  }

  isConfigured(): boolean {
    return !!this.config?.botToken && !!this.config?.chatId;
  }

  async send(payload: NotificationPayload): Promise<boolean> {
    if (!this.config) {
      log.warn('Telegram adapter not configured');
      return false;
    }

    const emoji = this.severityToEmoji(payload.severity);
    const typeEmoji = this.typeToEmoji(payload.type);

    // Build message with Markdown formatting
    const lines: string[] = [
      `${typeEmoji} *${this.escapeMarkdown(payload.title)}*`,
      '',
      this.escapeMarkdown(payload.message),
    ];

    // Add metadata as bullet points
    if (payload.metadata) {
      lines.push('');
      for (const [key, value] of Object.entries(payload.metadata)) {
        if (value !== undefined) {
          lines.push(`• *${this.formatFieldName(key)}:* ${this.escapeMarkdown(String(value))}`);
        }
      }
    }

    // Add action URL
    if (payload.actionUrl) {
      lines.push('');
      lines.push(`[View Details](${payload.actionUrl})`);
    }

    const message = lines.join('\n');

    try {
      const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.config.chatId,
          text: message,
          parse_mode: 'MarkdownV2',
          disable_web_page_preview: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        log.error({ status: response.status, error }, 'Telegram API failed');

        // Try without Markdown if parsing fails
        const errorObj = error as { description?: string };
        if (errorObj.description?.includes('parse')) {
          return this.sendPlainText(payload);
        }
        return false;
      }

      return true;
    } catch (error) {
      log.error({ error }, 'Telegram API error');
      return false;
    }
  }

  /**
   * Fallback: send plain text without formatting
   */
  private async sendPlainText(payload: NotificationPayload): Promise<boolean> {
    if (!this.config) return false;

    const lines: string[] = [payload.title, '', payload.message];

    if (payload.metadata) {
      lines.push('');
      for (const [key, value] of Object.entries(payload.metadata)) {
        if (value !== undefined) {
          lines.push(`${this.formatFieldName(key)}: ${value}`);
        }
      }
    }

    try {
      const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.config.chatId,
          text: lines.join('\n'),
        }),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  private severityToEmoji(severity?: string): string {
    switch (severity) {
      case 'critical':
        return '🚨';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      default:
        return 'ℹ️';
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

  private formatFieldName(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  /**
   * Escape special characters for Telegram MarkdownV2
   */
  private escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  }
}
