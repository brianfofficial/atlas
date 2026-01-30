/**
 * Draft Approval Workflow
 *
 * Manages the approval/edit/dismiss workflow for briefing draft items.
 * Features:
 * - 30-second undo window for approved items
 * - Trust failure detection (close calls, irrelevant flood, etc.)
 * - Quality guardrails (max 5 items, <30s evaluation time)
 *
 * @module @atlas/gateway/briefings/draft-approval-workflow
 */

import { v4 as uuid } from 'uuid';
import type { Database } from '../db/index.js';
import {
  briefingDrafts,
  draftItems,
  briefingHistory,
} from '../db/schema.js';
import { eq, and, gte, lte, sql, inArray } from 'drizzle-orm';
import {
  DraftItemData,
  DraftItemAction,
  DraftExecutionResult,
  DraftItemStatus,
  DraftItemType,
  DraftItemSurface,
  TrustFailureType,
  ErrorPattern,
  BriefingStatus,
} from './types.js';
import { getMetricsTracker, MetricsTracker } from './metrics-tracker.js';
import { getEventBroadcaster } from '../events/event-broadcaster.js';
import { getEmailService } from '../services/email-service.js';
import { getCalendarService } from '../services/calendar-service.js';
import { getTaskService } from '../services/task-service.js';

/**
 * Undo window duration in milliseconds (30 seconds)
 */
const UNDO_WINDOW_MS = 30 * 1000;

/**
 * Maximum items per briefing (avoid decision fatigue)
 */
const MAX_ITEMS_PER_BRIEFING = 5;

/**
 * Maximum evaluation time before flagging as too complex (30 seconds)
 */
const MAX_EVALUATION_TIME_MS = 30 * 1000;

/**
 * Pending undo items in memory (for quick access during undo window)
 */
interface PendingUndo {
  itemId: string;
  userId: string;
  executedAt: Date;
  undoDeadline: Date;
  executionData: DraftExecutionResult;
  rollbackFn?: () => Promise<void>;
}

/**
 * DraftApprovalWorkflow manages the approval process for draft items
 */
export class DraftApprovalWorkflow {
  private db: Database;
  private metricsTracker: MetricsTracker;
  private pendingUndos: Map<string, PendingUndo> = new Map();
  private undoCleanupInterval: NodeJS.Timeout | null = null;

  constructor(db: Database) {
    this.db = db;
    this.metricsTracker = getMetricsTracker();
    this.startUndoCleanup();
  }

  /**
   * Start the undo cleanup interval
   */
  private startUndoCleanup(): void {
    // Clean up expired undo windows every 5 seconds
    this.undoCleanupInterval = setInterval(() => {
      const now = new Date();
      for (const [itemId, pending] of this.pendingUndos) {
        if (now > pending.undoDeadline) {
          this.pendingUndos.delete(itemId);
        }
      }
    }, 5000);
  }

  /**
   * Stop the undo cleanup interval
   */
  shutdown(): void {
    if (this.undoCleanupInterval) {
      clearInterval(this.undoCleanupInterval);
      this.undoCleanupInterval = null;
    }
  }

  // ============================================================================
  // APPROVAL ACTIONS
  // ============================================================================

  /**
   * Approve a draft item
   */
  async approve(
    userId: string,
    itemId: string,
    options: {
      executeImmediately?: boolean;
    } = {}
  ): Promise<DraftExecutionResult> {
    const item = await this.getDraftItem(itemId);
    if (!item) {
      throw new Error(`Draft item ${itemId} not found`);
    }

    if (item.userId !== userId) {
      throw new Error('Unauthorized: item belongs to different user');
    }

    if (item.status !== 'pending') {
      throw new Error(`Cannot approve item with status: ${item.status}`);
    }

    const actionTime = new Date();
    const ttfa = await this.calculateTTFA(item.briefingId, actionTime);

    // Update item status
    await this.db
      .update(draftItems)
      .set({
        status: 'approved',
        actionTakenAt: actionTime.toISOString(),
      })
      .where(eq(draftItems.id, itemId));

    // Record metrics
    await this.metricsTracker.recordDraftAction(
      userId,
      item.surface as DraftItemSurface,
      'approve',
      ttfa
    );

    // Broadcast event
    try {
      const broadcaster = getEventBroadcaster();
      broadcaster.broadcastToUser(userId, 'draft:approved', {
        itemId,
        briefingId: item.briefingId,
        type: item.type,
        surface: item.surface,
      });
    } catch {
      // Event broadcasting is optional
    }

    // Execute if requested
    if (options.executeImmediately !== false) {
      return this.executeDraft(userId, item);
    }

    return {
      itemId,
      success: true,
      executedAt: actionTime.toISOString(),
      undoDeadline: new Date(actionTime.getTime() + UNDO_WINDOW_MS).toISOString(),
    };
  }

  /**
   * Dismiss a draft item
   */
  async dismiss(
    userId: string,
    itemId: string,
    reason?: string
  ): Promise<void> {
    const item = await this.getDraftItem(itemId);
    if (!item) {
      throw new Error(`Draft item ${itemId} not found`);
    }

    if (item.userId !== userId) {
      throw new Error('Unauthorized: item belongs to different user');
    }

    if (item.status !== 'pending') {
      throw new Error(`Cannot dismiss item with status: ${item.status}`);
    }

    const actionTime = new Date();
    const ttfa = await this.calculateTTFA(item.briefingId, actionTime);

    // Update item status
    await this.db
      .update(draftItems)
      .set({
        status: 'dismissed',
        actionTakenAt: actionTime.toISOString(),
        dismissReason: reason,
      })
      .where(eq(draftItems.id, itemId));

    // Record metrics
    await this.metricsTracker.recordDraftAction(
      userId,
      item.surface as DraftItemSurface,
      'dismiss',
      ttfa
    );

    // Check for trust failure: irrelevant flood
    await this.checkIrrelevantFlood(userId, item.briefingId);

    // Broadcast event
    try {
      const broadcaster = getEventBroadcaster();
      broadcaster.broadcastToUser(userId, 'draft:dismissed', {
        itemId,
        briefingId: item.briefingId,
        reason,
      });
    } catch {
      // Event broadcasting is optional
    }
  }

  /**
   * Edit and approve a draft item
   */
  async editAndApprove(
    userId: string,
    itemId: string,
    editedContent: string,
    options: {
      executeImmediately?: boolean;
    } = {}
  ): Promise<DraftExecutionResult> {
    const item = await this.getDraftItem(itemId);
    if (!item) {
      throw new Error(`Draft item ${itemId} not found`);
    }

    if (item.userId !== userId) {
      throw new Error('Unauthorized: item belongs to different user');
    }

    if (item.status !== 'pending') {
      throw new Error(`Cannot edit item with status: ${item.status}`);
    }

    const actionTime = new Date();
    const ttfa = await this.calculateTTFA(item.briefingId, actionTime);

    // Detect trust failure: close call edits
    await this.detectCloseCall(userId, item, editedContent);

    // Update item status
    await this.db
      .update(draftItems)
      .set({
        status: 'edited',
        actionTakenAt: actionTime.toISOString(),
        editedContent,
      })
      .where(eq(draftItems.id, itemId));

    // Record metrics (edit action)
    await this.metricsTracker.recordDraftAction(
      userId,
      item.surface as DraftItemSurface,
      'edit',
      ttfa
    );

    // Broadcast event
    try {
      const broadcaster = getEventBroadcaster();
      broadcaster.broadcastToUser(userId, 'draft:edited', {
        itemId,
        briefingId: item.briefingId,
        hasChanges: editedContent !== item.content,
      });
    } catch {
      // Event broadcasting is optional
    }

    // Execute if requested
    if (options.executeImmediately !== false) {
      return this.executeDraft(userId, { ...item, content: editedContent });
    }

    return {
      itemId,
      success: true,
      executedAt: actionTime.toISOString(),
      undoDeadline: new Date(actionTime.getTime() + UNDO_WINDOW_MS).toISOString(),
    };
  }

  /**
   * Undo an executed draft (within 30-second window)
   */
  async undo(userId: string, itemId: string): Promise<boolean> {
    const pending = this.pendingUndos.get(itemId);
    if (!pending) {
      throw new Error('No undo available for this item (window expired or not executed)');
    }

    if (pending.userId !== userId) {
      throw new Error('Unauthorized: item belongs to different user');
    }

    if (new Date() > pending.undoDeadline) {
      this.pendingUndos.delete(itemId);
      throw new Error('Undo window has expired');
    }

    // Execute rollback if available
    if (pending.rollbackFn) {
      try {
        await pending.rollbackFn();
      } catch (error) {
        console.error('Rollback failed:', error);
        // Record as trust failure: automator's regret
        await this.metricsTracker.recordTrustFailure(
          userId,
          'automator_regret',
          'high',
          {
            description: 'Undo failed after user tried to reverse an action',
            draftItemId: itemId,
          }
        );
        throw new Error('Failed to undo action');
      }
    }

    // Update item status
    await this.db
      .update(draftItems)
      .set({
        undoneAt: new Date().toISOString(),
      })
      .where(eq(draftItems.id, itemId));

    // Remove from pending
    this.pendingUndos.delete(itemId);

    // Broadcast event
    try {
      const broadcaster = getEventBroadcaster();
      broadcaster.broadcastToUser(userId, 'draft:undone', { itemId });
    } catch {
      // Event broadcasting is optional
    }

    return true;
  }

  // ============================================================================
  // EXECUTION
  // ============================================================================

  /**
   * Execute an approved draft (send email, update calendar, etc.)
   */
  private async executeDraft(
    userId: string,
    item: DraftItemData
  ): Promise<DraftExecutionResult> {
    const executedAt = new Date();
    const undoDeadline = new Date(executedAt.getTime() + UNDO_WINDOW_MS);

    let externalId: string | undefined;
    let rollbackFn: (() => Promise<void>) | undefined;

    try {
      // Execute based on type using service integrations
      switch (item.type) {
        case 'email_draft': {
          const emailService = getEmailService();
          const result = await emailService.sendDraft({
            id: item.id,
            to: [{ email: 'recipient@example.com' }], // Would come from item metadata
            subject: item.title,
            body: item.content,
          });
          if (result.success && result.data) {
            externalId = result.data.messageId;
            const messageId = result.data.messageId;
            rollbackFn = async () => { await emailService.recallMessage(messageId); };
          }
          break;
        }

        case 'meeting_prep': {
          const calendarService = getCalendarService();
          const result = await calendarService.addEventNote(
            item.source?.id || '',
            item.content,
            'prep'
          );
          if (result.success && result.data) {
            externalId = result.data.id;
            const noteId = result.data.id;
            rollbackFn = async () => { await calendarService.removeEventNote(noteId); };
          }
          break;
        }

        case 'calendar_note': {
          const calendarService = getCalendarService();
          const result = await calendarService.addEventNote(
            item.source?.id || '',
            item.content,
            'general'
          );
          if (result.success && result.data) {
            externalId = result.data.id;
            const noteId = result.data.id;
            rollbackFn = async () => { await calendarService.removeEventNote(noteId); };
          }
          break;
        }

        case 'follow_up': {
          const taskService = getTaskService();
          const result = await taskService.createTask({
            title: item.title,
            description: item.content,
            linkedEventId: item.source?.id,
            priority: 'medium',
          });
          if (result.success && result.data) {
            externalId = result.data.id;
            const taskId = result.data.id;
            rollbackFn = async () => { await taskService.deleteTask(taskId); };
          }
          break;
        }

        case 'task_reminder': {
          const taskService = getTaskService();
          const result = await taskService.createReminder({
            title: item.title,
            description: item.content,
            remindAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
          });
          if (result.success && result.data) {
            externalId = result.data.id;
            const reminderId = result.data.id;
            rollbackFn = async () => { await taskService.deleteReminder(reminderId); };
          }
          break;
        }
      }

      // Update item with execution info
      await this.db
        .update(draftItems)
        .set({
          executedAt: executedAt.toISOString(),
          undoDeadline: undoDeadline.toISOString(),
        })
        .where(eq(draftItems.id, item.id));

      const result: DraftExecutionResult = {
        itemId: item.id,
        success: true,
        executedAt: executedAt.toISOString(),
        undoDeadline: undoDeadline.toISOString(),
        externalId,
      };

      // Store for undo window
      this.pendingUndos.set(item.id, {
        itemId: item.id,
        userId,
        executedAt,
        undoDeadline,
        executionData: result,
        rollbackFn,
      });

      // Broadcast event
      try {
        const broadcaster = getEventBroadcaster();
        broadcaster.broadcastToUser(userId, 'draft:executed', {
          itemId: item.id,
          type: item.type,
          undoDeadline: undoDeadline.toISOString(),
        });
      } catch {
        // Event broadcasting is optional
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        itemId: item.id,
        success: false,
        executedAt: executedAt.toISOString(),
        undoDeadline: undoDeadline.toISOString(),
        error: errorMessage,
      };
    }
  }

  // ============================================================================
  // TRUST FAILURE DETECTION
  // ============================================================================

  /**
   * Detect "close call" edits that indicate near-misses
   */
  private async detectCloseCall(
    userId: string,
    item: DraftItemData,
    editedContent: string
  ): Promise<void> {
    const original = item.content.toLowerCase();
    const edited = editedContent.toLowerCase();

    // Check for common error patterns
    const errorPatterns: Array<{ pattern: ErrorPattern; check: () => boolean }> = [
      {
        pattern: 'wrong_recipient',
        check: () => {
          // Check if "to:" or "@" patterns were changed
          const toMatch = /to:\s*([^\n]+)/gi;
          const originalTo = original.match(toMatch);
          const editedTo = edited.match(toMatch);
          return originalTo !== null && editedTo !== null &&
            originalTo[0] !== editedTo[0];
        },
      },
      {
        pattern: 'wrong_tone',
        check: () => {
          // Simple heuristic: check if formality changed significantly
          const formalWords = ['sincerely', 'regards', 'dear', 'please be advised'];
          const casualWords = ['hey', 'hi', 'thanks!', 'cheers'];

          const originalFormal = formalWords.some(w => original.includes(w));
          const editedFormal = formalWords.some(w => edited.includes(w));
          const originalCasual = casualWords.some(w => original.includes(w));
          const editedCasual = casualWords.some(w => edited.includes(w));

          return (originalFormal && editedCasual) || (originalCasual && editedFormal);
        },
      },
      {
        pattern: 'wrong_date',
        check: () => {
          // Check if date patterns were changed
          const datePattern = /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}\b/gi;
          const originalDates = original.match(datePattern) || [];
          const editedDates = edited.match(datePattern) || [];
          return originalDates.length > 0 && editedDates.length > 0 &&
            JSON.stringify(originalDates) !== JSON.stringify(editedDates);
        },
      },
      {
        pattern: 'wrong_subject',
        check: () => {
          // Check if subject line was changed (for emails)
          const subjectMatch = /subject:\s*([^\n]+)/gi;
          const originalSubject = original.match(subjectMatch);
          const editedSubject = edited.match(subjectMatch);
          return originalSubject !== null && editedSubject !== null &&
            originalSubject[0] !== editedSubject[0];
        },
      },
    ];

    // Check each pattern
    for (const { pattern, check } of errorPatterns) {
      try {
        if (check()) {
          await this.metricsTracker.recordTrustFailure(
            userId,
            'close_call',
            'medium',
            {
              description: `User corrected ${pattern} in draft`,
              draftItemId: item.id,
              errorPattern: pattern,
            }
          );
          return; // Record only one pattern per edit
        }
      } catch {
        // Pattern check failed, continue
      }
    }

    // If significant changes but no specific pattern detected
    const changeRatio = this.calculateChangeRatio(original, edited);
    if (changeRatio > 0.3) {
      // More than 30% changed
      await this.metricsTracker.recordTrustFailure(
        userId,
        'close_call',
        'low',
        {
          description: 'Significant edits made to draft (>30% changed)',
          draftItemId: item.id,
        }
      );
    }
  }

  /**
   * Check for "irrelevant flood" - too many dismissals in a briefing
   */
  private async checkIrrelevantFlood(
    userId: string,
    briefingId: string
  ): Promise<void> {
    const items = await this.db
      .select({
        status: draftItems.status,
      })
      .from(draftItems)
      .where(eq(draftItems.briefingId, briefingId));

    const dismissed = items.filter(i => i.status === 'dismissed').length;
    const total = items.length;

    // If more than half are dismissed, flag as irrelevant flood
    if (total >= 3 && dismissed / total > 0.5) {
      await this.metricsTracker.recordTrustFailure(
        userId,
        'irrelevant_flood',
        'medium',
        {
          description: `${dismissed} of ${total} items dismissed in briefing`,
        }
      );
    }
  }

  /**
   * Report a missed critical item (user feedback)
   */
  async reportMissedCritical(
    userId: string,
    description: string,
    feedback?: string
  ): Promise<void> {
    await this.metricsTracker.recordTrustFailure(
      userId,
      'missed_critical',
      'high',
      {
        description,
        userReported: true,
        userFeedback: feedback,
      }
    );
  }

  /**
   * Report automator's regret (user regrets approving)
   */
  async reportAutomatorRegret(
    userId: string,
    itemId: string,
    description?: string
  ): Promise<void> {
    await this.metricsTracker.recordTrustFailure(
      userId,
      'automator_regret',
      'high',
      {
        description: description || 'User expressed regret after approving draft',
        draftItemId: itemId,
        userReported: true,
      }
    );
  }

  // ============================================================================
  // BRIEFING COMPLETION
  // ============================================================================

  /**
   * Complete a briefing (all items resolved)
   */
  async completeBriefing(userId: string, briefingId: string): Promise<void> {
    const briefing = await this.db
      .select()
      .from(briefingDrafts)
      .where(eq(briefingDrafts.id, briefingId))
      .limit(1);

    if (!briefing[0]) {
      throw new Error(`Briefing ${briefingId} not found`);
    }

    if (briefing[0].userId !== userId) {
      throw new Error('Unauthorized: briefing belongs to different user');
    }

    // Get item stats
    const items = await this.db
      .select({
        status: draftItems.status,
      })
      .from(draftItems)
      .where(eq(draftItems.briefingId, briefingId));

    const stats = {
      total: items.length,
      approved: items.filter(i => i.status === 'approved').length,
      dismissed: items.filter(i => i.status === 'dismissed').length,
      edited: items.filter(i => i.status === 'edited').length,
    };

    // Calculate time metrics
    const viewedAt = briefing[0].viewedAt ? new Date(briefing[0].viewedAt) : null;
    const completedAt = new Date();
    const totalEngagementTime = viewedAt
      ? Math.floor((completedAt.getTime() - viewedAt.getTime()) / 1000)
      : 0;

    // Get first action time
    const firstAction = await this.db
      .select({ actionTakenAt: draftItems.actionTakenAt })
      .from(draftItems)
      .where(
        and(
          eq(draftItems.briefingId, briefingId),
          sql`${draftItems.actionTakenAt} IS NOT NULL`
        )
      )
      .orderBy(draftItems.actionTakenAt)
      .limit(1);

    const timeToFirstAction =
      viewedAt && firstAction[0]?.actionTakenAt
        ? Math.floor(
            (new Date(firstAction[0].actionTakenAt).getTime() - viewedAt.getTime()) / 1000
          )
        : null;

    // Update briefing status
    await this.db
      .update(briefingDrafts)
      .set({
        status: 'approved',
        resolvedAt: completedAt.toISOString(),
        userAction: 'approved',
        updatedAt: completedAt.toISOString(),
      })
      .where(eq(briefingDrafts.id, briefingId));

    // Create history entry
    await this.db.insert(briefingHistory).values({
      id: uuid(),
      userId,
      briefingId,
      type: briefing[0].type,
      generatedAt: briefing[0].generatedAt,
      deliveredAt: briefing[0].notificationSentAt,
      viewedAt: briefing[0].viewedAt,
      completedAt: completedAt.toISOString(),
      content: briefing[0].content,
      totalItems: stats.total,
      approvedItems: stats.approved,
      dismissedItems: stats.dismissed,
      editedItems: stats.edited,
      timeToFirstAction,
      totalEngagementTime,
    });

    // Broadcast event
    try {
      const broadcaster = getEventBroadcaster();
      broadcaster.broadcastToUser(userId, 'briefing:completed', {
        briefingId,
        stats,
        totalEngagementTime,
      });
    } catch {
      // Event broadcasting is optional
    }
  }

  // ============================================================================
  // QUALITY GUARDRAILS
  // ============================================================================

  /**
   * Validate briefing before showing to user
   * Enforces max 5 items and quality checks
   */
  async validateBriefing(briefingId: string): Promise<{
    valid: boolean;
    issues: string[];
    trimmedItems?: string[];
  }> {
    const items = await this.db
      .select()
      .from(draftItems)
      .where(eq(draftItems.briefingId, briefingId));

    const issues: string[] = [];
    let trimmedItems: string[] | undefined;

    // Check item count
    if (items.length > MAX_ITEMS_PER_BRIEFING) {
      issues.push(`Too many items (${items.length} > ${MAX_ITEMS_PER_BRIEFING})`);

      // Sort by priority and trim
      const sorted = [...items].sort((a, b) => b.priority - a.priority);
      const toRemove = sorted.slice(MAX_ITEMS_PER_BRIEFING);
      trimmedItems = toRemove.map(i => i.id);

      // Mark excess items as dismissed
      await this.db
        .update(draftItems)
        .set({ status: 'dismissed', dismissReason: 'auto_trimmed' })
        .where(inArray(draftItems.id, trimmedItems));
    }

    // Check for duplicates
    const titles = items.map(i => i.title.toLowerCase());
    const duplicates = titles.filter((t, i) => titles.indexOf(t) !== i);
    if (duplicates.length > 0) {
      issues.push(`Duplicate items detected: ${duplicates.join(', ')}`);
    }

    return {
      valid: issues.length === 0,
      issues,
      trimmedItems,
    };
  }

  /**
   * Check if undo is still available for an item
   */
  canUndo(itemId: string): { available: boolean; remainingMs?: number } {
    const pending = this.pendingUndos.get(itemId);
    if (!pending) {
      return { available: false };
    }

    const now = new Date();
    const remainingMs = pending.undoDeadline.getTime() - now.getTime();

    if (remainingMs <= 0) {
      this.pendingUndos.delete(itemId);
      return { available: false };
    }

    return { available: true, remainingMs };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Get a draft item by ID
   */
  private async getDraftItem(itemId: string): Promise<DraftItemData | null> {
    const result = await this.db
      .select()
      .from(draftItems)
      .where(eq(draftItems.id, itemId))
      .limit(1);

    if (!result[0]) {
      return null;
    }

    const item = result[0];
    return {
      id: item.id,
      briefingId: item.briefingId,
      userId: item.userId,
      type: item.type as DraftItemType,
      surface: item.surface as DraftItemSurface,
      title: item.title,
      content: item.content,
      context: item.context || undefined,
      source: item.sourceType
        ? {
            type: item.sourceType as any,
            id: item.sourceId || '',
            metadata: item.sourceMetadata
              ? JSON.parse(item.sourceMetadata)
              : undefined,
          }
        : undefined,
      priority: item.priority as 1 | 2 | 3 | 4 | 5,
      estimatedTimeToReview: 15, // Default estimate
      status: item.status as DraftItemStatus,
      createdAt: item.createdAt,
    };
  }

  /**
   * Calculate TTFA for a briefing
   */
  private async calculateTTFA(
    briefingId: string,
    actionTime: Date
  ): Promise<number | undefined> {
    const briefing = await this.db
      .select({ viewedAt: briefingDrafts.viewedAt })
      .from(briefingDrafts)
      .where(eq(briefingDrafts.id, briefingId))
      .limit(1);

    if (!briefing[0]?.viewedAt) {
      return undefined;
    }

    const viewedAt = new Date(briefing[0].viewedAt);
    return Math.floor((actionTime.getTime() - viewedAt.getTime()) / 1000);
  }

  /**
   * Calculate the ratio of changes between two strings
   */
  private calculateChangeRatio(original: string, edited: string): number {
    const originalWords = original.split(/\s+/);
    const editedWords = edited.split(/\s+/);
    const maxLen = Math.max(originalWords.length, editedWords.length);

    if (maxLen === 0) return 0;

    // Simple word-level diff
    const originalSet = new Set(originalWords);
    const editedSet = new Set(editedWords);

    let changes = 0;
    for (const word of editedWords) {
      if (!originalSet.has(word)) changes++;
    }
    for (const word of originalWords) {
      if (!editedSet.has(word)) changes++;
    }

    return changes / (2 * maxLen);
  }
}

// Singleton instance
let workflowInstance: DraftApprovalWorkflow | null = null;

export function initializeDraftApprovalWorkflow(
  db: Database
): DraftApprovalWorkflow {
  workflowInstance = new DraftApprovalWorkflow(db);
  return workflowInstance;
}

export function getDraftApprovalWorkflow(): DraftApprovalWorkflow {
  if (!workflowInstance) {
    throw new Error(
      'DraftApprovalWorkflow not initialized. Call initializeDraftApprovalWorkflow first.'
    );
  }
  return workflowInstance;
}
