/**
 * Email Service
 *
 * Abstraction for sending emails, managing drafts, and handling recalls.
 * V1 uses mock implementation; future versions can integrate with
 * Gmail API, Outlook, or other providers.
 *
 * @module @atlas/gateway/services/email-service
 */

import { v4 as uuid } from 'uuid';
import pino from 'pino';
import type {
  ServiceResult,
  ServiceConfig,
  ServiceHealth,
  EmailDraft,
  SentEmailResult,
} from './types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const log = (pino as any)({
  name: 'email-service',
  level: process.env.LOG_LEVEL || 'info',
});

/**
 * Email service interface
 */
export interface IEmailService {
  /**
   * Send an email draft
   */
  sendDraft(draft: EmailDraft): Promise<ServiceResult<SentEmailResult>>;

  /**
   * Recall a sent message (if supported within time window)
   */
  recallMessage(messageId: string): Promise<ServiceResult>;

  /**
   * Get service health status
   */
  getHealth(): Promise<ServiceHealth>;
}

/**
 * Mock email service for V1 development
 * Simulates email operations without actual delivery
 */
class MockEmailService implements IEmailService {
  private sentMessages: Map<string, { draft: EmailDraft; sentAt: Date }> = new Map();
  private recalledMessages: Set<string> = new Set();

  async sendDraft(draft: EmailDraft): Promise<ServiceResult<SentEmailResult>> {
    const messageId = `mock_msg_${uuid()}`;
    const threadId = draft.threadId || `mock_thread_${uuid()}`;
    const sentAt = new Date();

    log.info({
      action: 'send_draft',
      draftId: draft.id,
      messageId,
      to: draft.to.map((r) => r.email),
      subject: draft.subject,
      mock: true,
    });

    // Store for potential recall
    this.sentMessages.set(messageId, { draft, sentAt });

    return {
      success: true,
      data: {
        messageId,
        threadId,
        sentAt: sentAt.toISOString(),
      },
    };
  }

  async recallMessage(messageId: string): Promise<ServiceResult> {
    const message = this.sentMessages.get(messageId);

    if (!message) {
      return {
        success: false,
        error: 'Message not found',
        errorCode: 'MESSAGE_NOT_FOUND',
      };
    }

    if (this.recalledMessages.has(messageId)) {
      return {
        success: false,
        error: 'Message already recalled',
        errorCode: 'ALREADY_RECALLED',
      };
    }

    // Check if within recall window (30 seconds for mock)
    const now = new Date();
    const secondsSinceSent = (now.getTime() - message.sentAt.getTime()) / 1000;

    if (secondsSinceSent > 30) {
      return {
        success: false,
        error: 'Recall window expired',
        errorCode: 'RECALL_WINDOW_EXPIRED',
      };
    }

    log.info({
      action: 'recall_message',
      messageId,
      secondsSinceSent,
      mock: true,
    });

    this.recalledMessages.add(messageId);
    this.sentMessages.delete(messageId);

    return { success: true };
  }

  async getHealth(): Promise<ServiceHealth> {
    return {
      service: 'email',
      status: 'healthy',
      lastCheck: new Date().toISOString(),
      latencyMs: 5, // Mock latency
    };
  }
}

/**
 * Gmail API implementation placeholder
 * TODO: Implement when ready for real Gmail integration
 */
// class GmailEmailService implements IEmailService { ... }

/**
 * Get email service instance
 */
let emailServiceInstance: IEmailService | null = null;

export function getEmailService(config?: ServiceConfig): IEmailService {
  if (!emailServiceInstance) {
    // For V1, always use mock service
    // Future: Check config to use real Gmail/Outlook service
    emailServiceInstance = new MockEmailService();
    log.info('Email service initialized (mock mode)');
  }
  return emailServiceInstance;
}

/**
 * Reset email service (for testing)
 */
export function resetEmailService(): void {
  emailServiceInstance = null;
}
