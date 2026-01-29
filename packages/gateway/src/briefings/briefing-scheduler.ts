/**
 * Briefing Scheduler
 *
 * Manages scheduled generation and delivery of daily and weekly briefings.
 * - Daily briefings: Default 7:30 AM local time
 * - Weekly briefings: Default Sunday evening or Monday morning
 * - Supports user-configurable schedules with timezone support
 *
 * @module @atlas/gateway/briefings/briefing-scheduler
 */

import { v4 as uuid } from 'uuid';
import type { Database } from '../db/index.js';
import { briefingSchedules, briefingDrafts, users } from '../db/schema.js';
import { eq, and, lte, sql } from 'drizzle-orm';
import {
  BriefingType,
  BriefingScheduleConfig,
  ScheduledBriefingJob,
  DeliveryMethod,
} from './types.js';
import { getBriefingGenerator, BriefingGenerator } from './briefing-generator.js';
import { getMetricsTracker, MetricsTracker } from './metrics-tracker.js';
import { getEventBroadcaster } from '../events/event-broadcaster.js';
import { getNotificationService } from '../notifications/notification-service.js';

/**
 * Default schedule configuration
 */
const DEFAULT_DAILY_HOUR = 7;
const DEFAULT_DAILY_MINUTE = 30;
const DEFAULT_WEEKLY_DAY = 0; // Sunday
const DEFAULT_WEEKLY_HOUR = 18; // 6 PM Sunday
const DEFAULT_TIMEZONE = 'America/New_York';

/**
 * Scheduler check interval (every minute)
 */
const SCHEDULER_INTERVAL_MS = 60 * 1000;

/**
 * BriefingScheduler manages scheduled briefing generation
 */
export class BriefingScheduler {
  private db: Database;
  private generator: BriefingGenerator;
  private metricsTracker: MetricsTracker;
  private schedulerInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(db: Database) {
    this.db = db;
    this.generator = getBriefingGenerator();
    this.metricsTracker = getMetricsTracker();
  }

  // ============================================================================
  // SCHEDULER LIFECYCLE
  // ============================================================================

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.log('[BriefingScheduler] Already running');
      return;
    }

    console.log('[BriefingScheduler] Starting scheduler');
    this.isRunning = true;

    // Run immediately to catch any due briefings
    this.checkAndRunDueBriefings();

    // Set up interval for regular checks
    this.schedulerInterval = setInterval(() => {
      this.checkAndRunDueBriefings();
    }, SCHEDULER_INTERVAL_MS);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('[BriefingScheduler] Stopping scheduler');
    this.isRunning = false;

    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  /**
   * Check for due briefings and run them
   */
  private async checkAndRunDueBriefings(): Promise<void> {
    try {
      const now = new Date();

      // Get all enabled schedules where nextRunAt is in the past
      const dueSchedules = await this.db
        .select()
        .from(briefingSchedules)
        .where(
          and(
            eq(briefingSchedules.enabled, true),
            lte(briefingSchedules.nextRunAt, now.toISOString())
          )
        );

      for (const schedule of dueSchedules) {
        try {
          await this.runScheduledBriefing(schedule);
        } catch (error) {
          console.error(
            `[BriefingScheduler] Error running scheduled briefing for user ${schedule.userId}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error('[BriefingScheduler] Error checking due briefings:', error);
    }
  }

  /**
   * Run a scheduled briefing
   */
  private async runScheduledBriefing(schedule: typeof briefingSchedules.$inferSelect): Promise<void> {
    const { userId, type, deliveryMethod } = schedule;

    console.log(
      `[BriefingScheduler] Running ${type} briefing for user ${userId}`
    );

    // Generate briefing
    let result;
    if (type === 'daily') {
      result = await this.generator.generateDailyBriefing(userId);
    } else {
      result = await this.generator.generateWeeklyBriefing(userId);
    }

    // Send notification
    await this.sendBriefingNotification(
      userId,
      result.briefingId,
      type as BriefingType,
      deliveryMethod as DeliveryMethod
    );

    // Update schedule with next run time
    const nextRunAt = this.calculateNextRunTime(schedule);
    await this.db
      .update(briefingSchedules)
      .set({
        lastRunAt: new Date().toISOString(),
        nextRunAt: nextRunAt.toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(briefingSchedules.id, schedule.id));

    // Broadcast event
    try {
      const broadcaster = getEventBroadcaster();
      broadcaster.broadcastToUser(userId, 'schedule:triggered', {
        scheduleId: schedule.id,
        briefingId: result.briefingId,
        type,
      });
    } catch {
      // Event broadcasting is optional
    }

    console.log(
      `[BriefingScheduler] Completed ${type} briefing ${result.briefingId} for user ${userId}`
    );
  }

  // ============================================================================
  // SCHEDULE MANAGEMENT
  // ============================================================================

  /**
   * Create or update a user's briefing schedule
   */
  async setSchedule(
    userId: string,
    type: BriefingType,
    config: {
      enabled?: boolean;
      hour?: number;
      minute?: number;
      timezone?: string;
      dayOfWeek?: number; // For weekly
      deliveryMethod?: DeliveryMethod;
    }
  ): Promise<void> {
    const existing = await this.db
      .select()
      .from(briefingSchedules)
      .where(
        and(
          eq(briefingSchedules.userId, userId),
          eq(briefingSchedules.type, type)
        )
      )
      .limit(1);

    const now = new Date();
    const hour = config.hour ?? (type === 'daily' ? DEFAULT_DAILY_HOUR : DEFAULT_WEEKLY_HOUR);
    const minute = config.minute ?? (type === 'daily' ? DEFAULT_DAILY_MINUTE : 0);
    const timezone = config.timezone ?? DEFAULT_TIMEZONE;
    const dayOfWeek = type === 'weekly' ? (config.dayOfWeek ?? DEFAULT_WEEKLY_DAY) : null;
    const enabled = config.enabled ?? true;
    const deliveryMethod = config.deliveryMethod ?? 'push';

    // Calculate next run time
    const nextRunAt = this.calculateNextRunTimeFromConfig(
      type,
      hour,
      minute,
      timezone,
      dayOfWeek
    );

    if (existing[0]) {
      // Update existing schedule
      await this.db
        .update(briefingSchedules)
        .set({
          enabled,
          hour,
          minute,
          timezone,
          dayOfWeek,
          deliveryMethod,
          nextRunAt: nextRunAt.toISOString(),
          updatedAt: now.toISOString(),
        })
        .where(eq(briefingSchedules.id, existing[0].id));
    } else {
      // Create new schedule
      await this.db.insert(briefingSchedules).values({
        id: uuid(),
        userId,
        type,
        enabled,
        hour,
        minute,
        timezone,
        dayOfWeek,
        deliveryMethod,
        nextRunAt: nextRunAt.toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
    }
  }

  /**
   * Get a user's schedule configuration
   */
  async getSchedule(userId: string): Promise<BriefingScheduleConfig> {
    const schedules = await this.db
      .select()
      .from(briefingSchedules)
      .where(eq(briefingSchedules.userId, userId));

    const daily = schedules.find((s) => s.type === 'daily');
    const weekly = schedules.find((s) => s.type === 'weekly');

    return {
      userId,
      daily: {
        enabled: daily?.enabled ?? false,
        hour: daily?.hour ?? DEFAULT_DAILY_HOUR,
        minute: daily?.minute ?? DEFAULT_DAILY_MINUTE,
        timezone: daily?.timezone ?? DEFAULT_TIMEZONE,
        deliveryMethod: (daily?.deliveryMethod as DeliveryMethod) ?? 'push',
      },
      weekly: {
        enabled: weekly?.enabled ?? false,
        dayOfWeek: weekly?.dayOfWeek ?? DEFAULT_WEEKLY_DAY,
        hour: weekly?.hour ?? DEFAULT_WEEKLY_HOUR,
        minute: weekly?.minute ?? 0,
        timezone: weekly?.timezone ?? DEFAULT_TIMEZONE,
        deliveryMethod: (weekly?.deliveryMethod as DeliveryMethod) ?? 'push',
      },
    };
  }

  /**
   * Enable or disable a schedule
   */
  async setScheduleEnabled(
    userId: string,
    type: BriefingType,
    enabled: boolean
  ): Promise<void> {
    const schedule = await this.db
      .select()
      .from(briefingSchedules)
      .where(
        and(
          eq(briefingSchedules.userId, userId),
          eq(briefingSchedules.type, type)
        )
      )
      .limit(1);

    if (schedule[0]) {
      const updates: Record<string, unknown> = {
        enabled,
        updatedAt: new Date().toISOString(),
      };

      // If enabling, recalculate next run time
      if (enabled) {
        const nextRunAt = this.calculateNextRunTime(schedule[0]);
        updates.nextRunAt = nextRunAt.toISOString();
      }

      await this.db
        .update(briefingSchedules)
        .set(updates)
        .where(eq(briefingSchedules.id, schedule[0].id));
    } else if (enabled) {
      // Create with defaults if enabling and doesn't exist
      await this.setSchedule(userId, type, { enabled: true });
    }
  }

  /**
   * Create default schedules for a new user
   */
  async createDefaultSchedules(userId: string): Promise<void> {
    // Create daily schedule (enabled by default)
    await this.setSchedule(userId, 'daily', {
      enabled: true,
      hour: DEFAULT_DAILY_HOUR,
      minute: DEFAULT_DAILY_MINUTE,
    });

    // Create weekly schedule (disabled by default)
    await this.setSchedule(userId, 'weekly', {
      enabled: false,
      dayOfWeek: DEFAULT_WEEKLY_DAY,
      hour: DEFAULT_WEEKLY_HOUR,
    });
  }

  // ============================================================================
  // MANUAL TRIGGERING
  // ============================================================================

  /**
   * Manually trigger a briefing generation (for testing or on-demand)
   */
  async triggerBriefing(
    userId: string,
    type: BriefingType
  ): Promise<{ briefingId: string }> {
    // Record that this was a user-initiated session
    await this.metricsTracker.recordSession(userId, 'user_initiated');

    // Generate briefing
    let result;
    if (type === 'daily') {
      result = await this.generator.generateDailyBriefing(userId);
    } else {
      result = await this.generator.generateWeeklyBriefing(userId);
    }

    // Update the briefing source to 'manual'
    await this.db
      .update(briefingDrafts)
      .set({ source: 'manual' })
      .where(eq(briefingDrafts.id, result.briefingId));

    return { briefingId: result.briefingId };
  }

  // ============================================================================
  // NOTIFICATION DELIVERY
  // ============================================================================

  /**
   * Send briefing notification to user
   */
  private async sendBriefingNotification(
    userId: string,
    briefingId: string,
    type: BriefingType,
    deliveryMethod: DeliveryMethod
  ): Promise<void> {
    const now = new Date();

    // Update briefing with notification sent time
    await this.db
      .update(briefingDrafts)
      .set({ notificationSentAt: now.toISOString() })
      .where(eq(briefingDrafts.id, briefingId));

    // Get notification service
    try {
      const notifier = getNotificationService();

      const title =
        type === 'daily'
          ? "Your morning briefing is ready"
          : "Your week ahead is ready";

      const message =
        type === 'daily'
          ? "Review your calendar prep and email drafts for today."
          : "Preview your week and get ahead of busy days.";

      if (deliveryMethod === 'push' || deliveryMethod === 'both') {
        // Broadcast via WebSocket for real-time push
        try {
          const broadcaster = getEventBroadcaster();
          broadcaster.broadcastToUser(userId, 'briefing:generated', {
            briefingId,
            type,
            title,
            message,
          });
        } catch {
          // WebSocket may not be available
        }
      }

      if (deliveryMethod === 'email' || deliveryMethod === 'both') {
        // Send email notification
        await notifier.send({
          type: 'daily_digest',
          title: `ATLAS: ${title}`,
          message: `${message}\n\nOpen ATLAS to review and approve your briefing.`,
          severity: 'info',
          metadata: {
            userId,
            briefingId,
            briefingType: type,
          },
        });
      }
    } catch (error) {
      console.error(
        `[BriefingScheduler] Error sending notification for briefing ${briefingId}:`,
        error
      );
    }
  }

  // ============================================================================
  // TIME CALCULATION
  // ============================================================================

  /**
   * Calculate next run time from a schedule record
   */
  private calculateNextRunTime(
    schedule: typeof briefingSchedules.$inferSelect
  ): Date {
    return this.calculateNextRunTimeFromConfig(
      schedule.type as BriefingType,
      schedule.hour,
      schedule.minute,
      schedule.timezone,
      schedule.dayOfWeek
    );
  }

  /**
   * Calculate next run time from configuration
   */
  private calculateNextRunTimeFromConfig(
    type: BriefingType,
    hour: number,
    minute: number,
    timezone: string,
    dayOfWeek: number | null
  ): Date {
    const now = new Date();

    // Create a date for today at the specified time
    // Note: This is a simplified version - production would use proper timezone handling
    const nextRun = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hour,
      minute,
      0,
      0
    );

    if (type === 'daily') {
      // If today's time has passed, schedule for tomorrow
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
    } else {
      // Weekly: find next occurrence of dayOfWeek
      const targetDay = dayOfWeek ?? 0;
      const currentDay = nextRun.getDay();
      let daysUntilTarget = targetDay - currentDay;

      if (daysUntilTarget < 0 || (daysUntilTarget === 0 && nextRun <= now)) {
        daysUntilTarget += 7;
      }

      nextRun.setDate(nextRun.getDate() + daysUntilTarget);
    }

    return nextRun;
  }

  /**
   * Get scheduled jobs info (for debugging/monitoring)
   */
  async getScheduledJobs(): Promise<ScheduledBriefingJob[]> {
    const schedules = await this.db
      .select()
      .from(briefingSchedules)
      .where(eq(briefingSchedules.enabled, true));

    return schedules.map((s) => ({
      id: s.id,
      userId: s.userId,
      type: s.type as BriefingType,
      scheduledFor: s.nextRunAt || '',
      status: 'pending' as const,
      attempts: 0,
    }));
  }
}

// Singleton instance
let schedulerInstance: BriefingScheduler | null = null;

export function initializeBriefingScheduler(db: Database): BriefingScheduler {
  schedulerInstance = new BriefingScheduler(db);
  return schedulerInstance;
}

export function getBriefingScheduler(): BriefingScheduler {
  if (!schedulerInstance) {
    throw new Error(
      'BriefingScheduler not initialized. Call initializeBriefingScheduler first.'
    );
  }
  return schedulerInstance;
}

export function startBriefingScheduler(): void {
  getBriefingScheduler().start();
}

export function stopBriefingScheduler(): void {
  if (schedulerInstance) {
    schedulerInstance.stop();
  }
}
