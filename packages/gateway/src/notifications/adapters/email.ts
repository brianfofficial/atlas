/**
 * Email Notification Adapter
 *
 * Sends notifications via SMTP or Resend.
 *
 * @module @atlas/gateway/notifications/adapters/email
 */

import type { NotificationAdapter, NotificationPayload } from '../notification-service.js';
import pino from 'pino';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const log = (pino as any)({ name: 'email-adapter' });

interface EmailConfig {
  provider: 'smtp' | 'resend';
  from: string;
  to: string[];
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  resendApiKey?: string;
}

export class EmailAdapter implements NotificationAdapter {
  name = 'email';
  private config: EmailConfig | null = null;

  configure(config: EmailConfig): void {
    this.config = config;
  }

  isConfigured(): boolean {
    if (!this.config) return false;
    if (this.config.provider === 'resend') {
      return !!this.config.resendApiKey;
    }
    return !!this.config.smtp?.host;
  }

  async send(payload: NotificationPayload): Promise<boolean> {
    if (!this.config) {
      log.warn('Email adapter not configured');
      return false;
    }

    const html = this.buildHtmlEmail(payload);
    const subject = payload.title;

    if (this.config.provider === 'resend') {
      return this.sendViaResend(subject, html);
    }

    return this.sendViaSMTP(subject, html);
  }

  private async sendViaResend(subject: string, html: string): Promise<boolean> {
    if (!this.config?.resendApiKey) return false;

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.resendApiKey}`,
        },
        body: JSON.stringify({
          from: this.config.from,
          to: this.config.to,
          subject,
          html,
        }),
      });

      if (!response.ok) {
        log.error({ status: response.status }, 'Resend API failed');
        return false;
      }

      return true;
    } catch (error) {
      log.error({ error }, 'Resend API error');
      return false;
    }
  }

  private async sendViaSMTP(subject: string, html: string): Promise<boolean> {
    // SMTP sending would require nodemailer or similar
    // For now, log that it's not implemented
    log.warn('SMTP sending not implemented - use Resend or implement nodemailer');
    return false;
  }

  private buildHtmlEmail(payload: NotificationPayload): string {
    const severityColor = this.severityToColor(payload.severity);

    const metadataRows = payload.metadata
      ? Object.entries(payload.metadata)
          .filter(([_, v]) => v !== undefined)
          .map(
            ([key, value]) => `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 500; color: #6b7280;">
                  ${this.formatFieldName(key)}
                </td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #111827;">
                  ${this.escapeHtml(String(value))}
                </td>
              </tr>
            `
          )
          .join('')
      : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${this.escapeHtml(payload.title)}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header -->
            <tr>
              <td style="padding: 24px; background-color: ${severityColor};">
                <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">
                  ${this.escapeHtml(payload.title)}
                </h1>
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td style="padding: 24px;">
                <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.5;">
                  ${this.escapeHtml(payload.message).replace(/\n/g, '<br>')}
                </p>

                ${
                  metadataRows
                    ? `
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 16px; border: 1px solid #e5e7eb; border-radius: 8px;">
                    ${metadataRows}
                  </table>
                `
                    : ''
                }

                ${
                  payload.actionUrl
                    ? `
                  <p style="margin: 24px 0 0 0;">
                    <a href="${payload.actionUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;">
                      View Details
                    </a>
                  </p>
                `
                    : ''
                }
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding: 24px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; color: #6b7280; font-size: 14px;">
                  This notification was sent by Atlas Gateway.
                </p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
  }

  private severityToColor(severity?: string): string {
    switch (severity) {
      case 'critical':
        return '#dc2626';
      case 'error':
        return '#f97316';
      case 'warning':
        return '#eab308';
      default:
        return '#3b82f6';
    }
  }

  private formatFieldName(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
