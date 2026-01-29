/**
 * Notifications Module
 *
 * Re-exports notification service and adapters.
 *
 * @module @atlas/gateway/notifications
 */

export { getNotificationService } from './notification-service.js';
export type {
  NotificationService,
  NotificationPayload,
  NotificationType,
  NotificationConfig,
  NotificationAdapter,
} from './notification-service.js';

export { SlackAdapter } from './adapters/slack.js';
export { DiscordAdapter } from './adapters/discord.js';
export { TelegramAdapter } from './adapters/telegram.js';
export { EmailAdapter } from './adapters/email.js';
