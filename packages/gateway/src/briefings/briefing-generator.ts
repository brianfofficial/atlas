/**
 * Briefing Generator
 *
 * Generates daily and weekly briefings by aggregating:
 * - Calendar events (with prep suggestions)
 * - Emails requiring response (with draft replies)
 * - Follow-ups from previous interactions
 * - 7-day rolling memory context
 *
 * Target: <3 minutes user review time for daily, 5-10 minutes for weekly
 *
 * @module @atlas/gateway/briefings/briefing-generator
 */

import { v4 as uuid } from 'uuid';
import type { Database } from '../db/index.js';
import {
  briefingDrafts,
  draftItems,
  memoryEntries,
  pinnedMemories,
  goals,
  users,
} from '../db/schema.js';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import {
  BriefingType,
  BriefingContent,
  BriefingCalendarEvent,
  BriefingEmailThread,
  BriefingFollowUp,
  DraftItemData,
  DraftItemType,
  DraftItemSurface,
  PinnedMemoryData,
} from './types.js';

/**
 * Maximum items per briefing (avoid decision fatigue)
 */
const MAX_CALENDAR_ITEMS = 3;
const MAX_EMAIL_ITEMS = 3;
const MAX_FOLLOWUP_ITEMS = 2;
const MAX_TOTAL_DRAFT_ITEMS = 5;

/**
 * Time constants
 */
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Integration interfaces (to be implemented with real services)
 */
export interface CalendarIntegration {
  getEventsForDate(userId: string, date: Date): Promise<BriefingCalendarEvent[]>;
  getEventsForWeek(userId: string, startDate: Date): Promise<BriefingCalendarEvent[]>;
}

export interface EmailIntegration {
  getThreadsNeedingResponse(userId: string, limit: number): Promise<BriefingEmailThread[]>;
  generateDraftReply(thread: BriefingEmailThread, context?: string): Promise<string>;
}

export interface AIService {
  generateMeetingPrep(event: BriefingCalendarEvent, context?: string): Promise<{
    prepSuggestion: string;
    talkingPoints: string[];
  }>;
  generateEmailDraft(thread: BriefingEmailThread, context?: string): Promise<{
    content: string;
    tone: 'formal' | 'casual' | 'urgent';
  }>;
  generateGreeting(hour: number, userName?: string): string;
}

/**
 * Configuration for the briefing generator
 */
export interface BriefingGeneratorConfig {
  maxCalendarItems?: number;
  maxEmailItems?: number;
  maxFollowupItems?: number;
  maxTotalDraftItems?: number;
  includeWeatherWidget?: boolean;
  timezone?: string;
}

/**
 * BriefingGenerator class
 */
export class BriefingGenerator {
  private db: Database;
  private calendarIntegration?: CalendarIntegration;
  private emailIntegration?: EmailIntegration;
  private aiService?: AIService;
  private config: Required<BriefingGeneratorConfig>;

  constructor(
    db: Database,
    config: BriefingGeneratorConfig = {},
    integrations?: {
      calendar?: CalendarIntegration;
      email?: EmailIntegration;
      ai?: AIService;
    }
  ) {
    this.db = db;
    this.config = {
      maxCalendarItems: config.maxCalendarItems ?? MAX_CALENDAR_ITEMS,
      maxEmailItems: config.maxEmailItems ?? MAX_EMAIL_ITEMS,
      maxFollowupItems: config.maxFollowupItems ?? MAX_FOLLOWUP_ITEMS,
      maxTotalDraftItems: config.maxTotalDraftItems ?? MAX_TOTAL_DRAFT_ITEMS,
      includeWeatherWidget: config.includeWeatherWidget ?? true,
      timezone: config.timezone ?? 'America/New_York',
    };
    this.calendarIntegration = integrations?.calendar;
    this.emailIntegration = integrations?.email;
    this.aiService = integrations?.ai;
  }

  /**
   * Set integrations after construction
   */
  setIntegrations(integrations: {
    calendar?: CalendarIntegration;
    email?: EmailIntegration;
    ai?: AIService;
  }): void {
    if (integrations.calendar) this.calendarIntegration = integrations.calendar;
    if (integrations.email) this.emailIntegration = integrations.email;
    if (integrations.ai) this.aiService = integrations.ai;
  }

  // ============================================================================
  // DAILY BRIEFING GENERATION
  // ============================================================================

  /**
   * Generate a daily briefing for a user
   */
  async generateDailyBriefing(userId: string): Promise<{
    briefingId: string;
    content: BriefingContent;
    draftItems: DraftItemData[];
  }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get user info
    const user = await this.getUser(userId);

    // Fetch data in parallel
    const [calendarEvents, emailThreads, followUps, memoryContext, pinnedMemoriesData] =
      await Promise.all([
        this.getCalendarEvents(userId, today),
        this.getEmailsNeedingResponse(userId),
        this.getFollowUps(userId),
        this.getMemoryContext(userId),
        this.getPinnedMemories(userId),
      ]);

    // Generate greeting
    const greeting = this.generateGreeting(now.getHours(), user?.username);

    // Build calendar section with prep suggestions
    const calendarSection = await this.buildCalendarSection(
      calendarEvents,
      memoryContext,
      pinnedMemoriesData
    );

    // Build email section with draft replies
    const emailSection = await this.buildEmailSection(
      emailThreads,
      memoryContext,
      pinnedMemoriesData
    );

    // Build content
    const content: BriefingContent = {
      type: 'daily',
      generatedAt: now.toISOString(),
      greeting,
      summary: {
        meetingsToday: calendarEvents.length,
        emailsNeedingResponse: emailThreads.length,
        followUpsFromYesterday: followUps.length,
      },
      calendar: calendarSection,
      email: emailSection,
      followUps,
      memoryContext: memoryContext.map((m) => ({
        id: m.id,
        type: m.type,
        summary: m.summary || m.content.substring(0, 100),
        usedFor: 'context',
      })),
    };

    // Create briefing draft in database
    const briefingId = uuid();
    const approvalDeadline = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes

    await this.db.insert(briefingDrafts).values({
      id: briefingId,
      userId,
      type: 'daily',
      status: 'pending',
      generatedAt: now.toISOString(),
      approvalDeadline: approvalDeadline.toISOString(),
      content: JSON.stringify(content),
      draftItems: '[]', // Will be populated below
      source: 'scheduled',
    });

    // Generate draft items
    const draftItemsData = await this.generateDraftItems(
      userId,
      briefingId,
      calendarSection,
      emailSection,
      followUps
    );

    // Update briefing with draft items
    await this.db
      .update(briefingDrafts)
      .set({
        draftItems: JSON.stringify(draftItemsData.map((d) => d.id)),
      })
      .where(eq(briefingDrafts.id, briefingId));

    return {
      briefingId,
      content,
      draftItems: draftItemsData,
    };
  }

  // ============================================================================
  // WEEKLY BRIEFING GENERATION
  // ============================================================================

  /**
   * Generate a weekly briefing for a user
   */
  async generateWeeklyBriefing(userId: string): Promise<{
    briefingId: string;
    content: BriefingContent;
    draftItems: DraftItemData[];
  }> {
    const now = new Date();
    const weekStart = this.getWeekStart(now);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Get user info
    const user = await this.getUser(userId);

    // Fetch data
    const [calendarEvents, emailThreads, memoryContext, pinnedMemoriesData] =
      await Promise.all([
        this.getCalendarEventsForWeek(userId, weekStart),
        this.getEmailsNeedingResponse(userId),
        this.getMemoryContext(userId),
        this.getPinnedMemories(userId),
      ]);

    // Analyze week
    const weekAnalysis = this.analyzeWeek(calendarEvents);

    // Generate greeting
    const greeting = this.generateWeeklyGreeting(user?.username);

    // Build sections
    const calendarSection = await this.buildCalendarSection(
      calendarEvents.filter((e) => e.requiresPrep),
      memoryContext,
      pinnedMemoriesData
    );

    const emailSection = await this.buildEmailSection(
      emailThreads,
      memoryContext,
      pinnedMemoriesData
    );

    // Build content
    const content: BriefingContent = {
      type: 'weekly',
      generatedAt: now.toISOString(),
      greeting,
      summary: {
        meetingsToday: calendarEvents.filter((e) =>
          this.isToday(new Date(e.startTime))
        ).length,
        emailsNeedingResponse: emailThreads.length,
        followUpsFromYesterday: 0,
        busiestDay: weekAnalysis.busiestDay,
      },
      calendar: calendarSection,
      email: emailSection,
      followUps: [],
      weekly: {
        busiestDays: weekAnalysis.busiestDays,
        suggestedDeepWorkBlocks: weekAnalysis.suggestedDeepWork,
        threadsLikelyToNeedFollowUp: emailThreads
          .filter((t) => t.threadLength > 3)
          .map((t) => t.id),
      },
      memoryContext: memoryContext.map((m) => ({
        id: m.id,
        type: m.type,
        summary: m.summary || m.content.substring(0, 100),
        usedFor: 'context',
      })),
    };

    // Create briefing draft
    const briefingId = uuid();
    const approvalDeadline = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour for weekly

    await this.db.insert(briefingDrafts).values({
      id: briefingId,
      userId,
      type: 'weekly',
      status: 'pending',
      generatedAt: now.toISOString(),
      approvalDeadline: approvalDeadline.toISOString(),
      content: JSON.stringify(content),
      draftItems: '[]',
      source: 'scheduled',
    });

    // Generate draft items
    const draftItemsData = await this.generateDraftItems(
      userId,
      briefingId,
      calendarSection,
      emailSection,
      []
    );

    // Update briefing
    await this.db
      .update(briefingDrafts)
      .set({
        draftItems: JSON.stringify(draftItemsData.map((d) => d.id)),
      })
      .where(eq(briefingDrafts.id, briefingId));

    return {
      briefingId,
      content,
      draftItems: draftItemsData,
    };
  }

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  /**
   * Get user info
   */
  private async getUser(userId: string): Promise<{ username: string } | null> {
    const result = await this.db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Get calendar events for a date
   */
  private async getCalendarEvents(
    userId: string,
    date: Date
  ): Promise<BriefingCalendarEvent[]> {
    if (this.calendarIntegration) {
      return this.calendarIntegration.getEventsForDate(userId, date);
    }

    // Fallback: return mock/placeholder events
    return this.getMockCalendarEvents(date);
  }

  /**
   * Get calendar events for a week
   */
  private async getCalendarEventsForWeek(
    userId: string,
    startDate: Date
  ): Promise<BriefingCalendarEvent[]> {
    if (this.calendarIntegration) {
      return this.calendarIntegration.getEventsForWeek(userId, startDate);
    }

    // Fallback: return mock events
    return this.getMockCalendarEvents(startDate);
  }

  /**
   * Get emails needing response
   */
  private async getEmailsNeedingResponse(
    userId: string
  ): Promise<BriefingEmailThread[]> {
    if (this.emailIntegration) {
      return this.emailIntegration.getThreadsNeedingResponse(
        userId,
        this.config.maxEmailItems
      );
    }

    // Fallback: return mock emails
    return this.getMockEmails();
  }

  /**
   * Get follow-ups from previous interactions
   */
  private async getFollowUps(userId: string): Promise<BriefingFollowUp[]> {
    // Query memory entries for follow-up items
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const followUpMemories = await this.db
      .select()
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.userId, userId),
          eq(memoryEntries.type, 'follow_up'),
          gte(memoryEntries.createdAt, yesterday.toISOString())
        )
      )
      .limit(this.config.maxFollowupItems);

    return followUpMemories.map((m) => ({
      id: m.id,
      type: 'yesterday_action' as const,
      title: m.summary || 'Follow-up item',
      context: m.content,
      originalDate: m.createdAt,
      priority: this.mapImportanceToPriority(m.importance),
    }));
  }

  /**
   * Get 7-day rolling memory context
   */
  private async getMemoryContext(
    userId: string
  ): Promise<Array<{ id: string; type: string; content: string; summary: string | null }>> {
    const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);

    const memories = await this.db
      .select({
        id: memoryEntries.id,
        type: memoryEntries.type,
        content: memoryEntries.content,
        summary: memoryEntries.summary,
      })
      .from(memoryEntries)
      .where(
        and(
          eq(memoryEntries.userId, userId),
          gte(memoryEntries.createdAt, sevenDaysAgo.toISOString())
        )
      )
      .orderBy(desc(memoryEntries.importance))
      .limit(10);

    return memories;
  }

  /**
   * Get pinned memories (persist beyond 7 days)
   */
  private async getPinnedMemories(userId: string): Promise<PinnedMemoryData[]> {
    const pinned = await this.db
      .select()
      .from(pinnedMemories)
      .where(eq(pinnedMemories.userId, userId))
      .limit(20);

    return pinned.map((p) => ({
      id: p.id,
      userId: p.userId,
      type: p.type as PinnedMemoryData['type'],
      title: p.title,
      content: p.content,
      sourceType: p.sourceType as PinnedMemoryData['sourceType'],
      extractedFrom: p.extractedFrom || undefined,
      useCount: p.useCount,
      lastUsedAt: p.lastUsedAt || undefined,
      validUntil: p.validUntil || undefined,
      createdAt: p.createdAt,
    }));
  }

  // ============================================================================
  // SECTION BUILDING
  // ============================================================================

  /**
   * Build calendar section with prep suggestions
   */
  private async buildCalendarSection(
    events: BriefingCalendarEvent[],
    memoryContext: Array<{ id: string; type: string; content: string; summary: string | null }>,
    pinnedMemories: PinnedMemoryData[]
  ): Promise<BriefingContent['calendar']> {
    const prepSuggestions: BriefingContent['calendar']['prepSuggestions'] = [];

    // Filter to events that need prep
    const eventsNeedingPrep = events
      .filter((e) => e.requiresPrep || e.attendees.length > 2)
      .slice(0, this.config.maxCalendarItems);

    for (const event of eventsNeedingPrep) {
      // Find relevant context
      const relevantContext = this.findRelevantContext(
        event,
        memoryContext,
        pinnedMemories
      );

      let prepSuggestion: string;
      let talkingPoints: string[] = [];

      if (this.aiService) {
        const prep = await this.aiService.generateMeetingPrep(
          event,
          relevantContext
        );
        prepSuggestion = prep.prepSuggestion;
        talkingPoints = prep.talkingPoints;
      } else {
        // Fallback prep suggestion
        prepSuggestion = this.generateFallbackPrepSuggestion(event);
        talkingPoints = this.generateFallbackTalkingPoints(event);
      }

      prepSuggestions.push({
        eventId: event.id,
        suggestion: prepSuggestion,
        talkingPoints,
      });
    }

    return {
      events: events.slice(0, this.config.maxCalendarItems),
      prepSuggestions,
    };
  }

  /**
   * Build email section with draft replies
   */
  private async buildEmailSection(
    threads: BriefingEmailThread[],
    memoryContext: Array<{ id: string; type: string; content: string; summary: string | null }>,
    pinnedMemories: PinnedMemoryData[]
  ): Promise<BriefingContent['email']> {
    const draftReplies: BriefingContent['email']['draftReplies'] = [];

    const threadsToProcess = threads.slice(0, this.config.maxEmailItems);

    for (const thread of threadsToProcess) {
      // Find relevant context
      const relevantContext = this.findRelevantContextForEmail(
        thread,
        memoryContext,
        pinnedMemories
      );

      let draftContent: string;
      let tone: 'formal' | 'casual' | 'urgent';

      if (this.aiService) {
        const draft = await this.aiService.generateEmailDraft(
          thread,
          relevantContext
        );
        draftContent = draft.content;
        tone = draft.tone;
      } else {
        // Fallback draft
        const fallback = this.generateFallbackEmailDraft(thread);
        draftContent = fallback.content;
        tone = fallback.tone;
      }

      draftReplies.push({
        threadId: thread.id,
        draftContent,
        tone,
      });
    }

    return {
      threads: threadsToProcess,
      draftReplies,
    };
  }

  // ============================================================================
  // DRAFT ITEM GENERATION
  // ============================================================================

  /**
   * Generate draft items for approval
   */
  private async generateDraftItems(
    userId: string,
    briefingId: string,
    calendarSection: BriefingContent['calendar'],
    emailSection: BriefingContent['email'],
    followUps: BriefingFollowUp[]
  ): Promise<DraftItemData[]> {
    const items: DraftItemData[] = [];
    let priority = 5;

    // Add meeting prep items
    for (const prep of calendarSection.prepSuggestions) {
      if (items.length >= this.config.maxTotalDraftItems) break;

      const event = calendarSection.events.find((e) => e.id === prep.eventId);
      if (!event) continue;

      const item = await this.createDraftItem(
        userId,
        briefingId,
        {
          type: 'meeting_prep',
          surface: 'calendar',
          title: `Prep for: ${event.title}`,
          content: prep.suggestion,
          context: prep.talkingPoints?.join('\n') || undefined,
          sourceType: 'calendar_event',
          sourceId: event.id,
          priority: priority--,
        }
      );
      items.push(item);
    }

    // Add email draft items
    for (const draft of emailSection.draftReplies) {
      if (items.length >= this.config.maxTotalDraftItems) break;

      const thread = emailSection.threads.find((t) => t.id === draft.threadId);
      if (!thread) continue;

      const item = await this.createDraftItem(
        userId,
        briefingId,
        {
          type: 'email_draft',
          surface: 'email',
          title: `Reply to: ${thread.subject}`,
          content: draft.draftContent,
          context: `From: ${thread.from}\n${thread.snippet}`,
          sourceType: 'email_thread',
          sourceId: thread.id,
          priority: priority--,
        }
      );
      items.push(item);
    }

    // Add follow-up items
    for (const followUp of followUps) {
      if (items.length >= this.config.maxTotalDraftItems) break;

      const item = await this.createDraftItem(
        userId,
        briefingId,
        {
          type: 'follow_up',
          surface: 'tasks',
          title: followUp.title,
          content: followUp.context,
          sourceType: 'memory',
          sourceId: followUp.id,
          priority: priority--,
        }
      );
      items.push(item);
    }

    return items;
  }

  /**
   * Create a draft item in the database
   */
  private async createDraftItem(
    userId: string,
    briefingId: string,
    data: {
      type: DraftItemType;
      surface: DraftItemSurface;
      title: string;
      content: string;
      context?: string;
      sourceType?: string;
      sourceId?: string;
      priority: number;
    }
  ): Promise<DraftItemData> {
    const id = uuid();
    const now = new Date().toISOString();

    await this.db.insert(draftItems).values({
      id,
      briefingId,
      userId,
      type: data.type,
      surface: data.surface,
      title: data.title,
      content: data.content,
      context: data.context,
      sourceType: data.sourceType,
      sourceId: data.sourceId,
      priority: data.priority,
      status: 'pending',
      createdAt: now,
    });

    return {
      id,
      briefingId,
      type: data.type,
      surface: data.surface,
      title: data.title,
      content: data.content,
      context: data.context,
      source: data.sourceType
        ? {
            type: data.sourceType as any,
            id: data.sourceId || '',
          }
        : undefined,
      priority: data.priority as 1 | 2 | 3 | 4 | 5,
      estimatedTimeToReview: 15,
      status: 'pending',
      createdAt: now,
    };
  }

  // ============================================================================
  // CONTEXT MATCHING
  // ============================================================================

  /**
   * Find relevant context for a calendar event
   */
  private findRelevantContext(
    event: BriefingCalendarEvent,
    memories: Array<{ id: string; type: string; content: string; summary: string | null }>,
    pinned: PinnedMemoryData[]
  ): string {
    const relevant: string[] = [];

    // Check pinned memories for relationship context
    for (const p of pinned) {
      if (p.type === 'relationship') {
        // Check if any attendee name appears in the pinned memory
        for (const attendee of event.attendees) {
          if (
            p.content.toLowerCase().includes(attendee.toLowerCase()) ||
            p.title.toLowerCase().includes(attendee.toLowerCase())
          ) {
            relevant.push(`[Relationship] ${p.title}: ${p.content}`);
          }
        }
      }
    }

    // Check recent memories
    for (const m of memories) {
      // Check for meeting/event mentions
      if (
        m.content.toLowerCase().includes(event.title.toLowerCase()) ||
        event.attendees.some((a) =>
          m.content.toLowerCase().includes(a.toLowerCase())
        )
      ) {
        relevant.push(`[Recent] ${m.summary || m.content.substring(0, 100)}`);
      }
    }

    return relevant.slice(0, 3).join('\n');
  }

  /**
   * Find relevant context for an email thread
   */
  private findRelevantContextForEmail(
    thread: BriefingEmailThread,
    memories: Array<{ id: string; type: string; content: string; summary: string | null }>,
    pinned: PinnedMemoryData[]
  ): string {
    const relevant: string[] = [];

    // Check pinned memories for sender relationship
    for (const p of pinned) {
      if (
        p.content.toLowerCase().includes(thread.from.toLowerCase()) ||
        p.title.toLowerCase().includes(thread.from.toLowerCase())
      ) {
        relevant.push(`[Relationship] ${p.title}: ${p.content}`);
      }
    }

    // Check recent memories for thread subject
    for (const m of memories) {
      if (m.content.toLowerCase().includes(thread.subject.toLowerCase())) {
        relevant.push(`[Recent] ${m.summary || m.content.substring(0, 100)}`);
      }
    }

    return relevant.slice(0, 3).join('\n');
  }

  // ============================================================================
  // WEEK ANALYSIS
  // ============================================================================

  /**
   * Analyze a week's calendar for the weekly briefing
   */
  private analyzeWeek(events: BriefingCalendarEvent[]): {
    busiestDay: string;
    busiestDays: string[];
    suggestedDeepWork: Array<{
      day: string;
      startTime: string;
      duration: number;
    }>;
  } {
    // Group events by day
    const eventsByDay = new Map<string, BriefingCalendarEvent[]>();
    for (const event of events) {
      const day = new Date(event.startTime).toISOString().split('T')[0];
      const existing = eventsByDay.get(day) || [];
      existing.push(event);
      eventsByDay.set(day, existing);
    }

    // Find busiest days
    const sortedDays = Array.from(eventsByDay.entries())
      .sort((a, b) => b[1].length - a[1].length);

    const busiestDay = sortedDays[0]?.[0] || '';
    const busiestDays = sortedDays.slice(0, 3).map(([day]) => day);

    // Find potential deep work blocks (days with fewer meetings)
    const suggestedDeepWork: Array<{
      day: string;
      startTime: string;
      duration: number;
    }> = [];

    for (const [day, dayEvents] of eventsByDay) {
      if (dayEvents.length <= 2) {
        // Light day - suggest deep work
        suggestedDeepWork.push({
          day,
          startTime: '09:00',
          duration: 120, // 2 hours
        });
      }
    }

    return {
      busiestDay,
      busiestDays,
      suggestedDeepWork: suggestedDeepWork.slice(0, 3),
    };
  }

  // ============================================================================
  // GREETING GENERATION
  // ============================================================================

  /**
   * Generate time-based greeting
   */
  private generateGreeting(hour: number, userName?: string): string {
    let timeGreeting: string;
    if (hour < 12) {
      timeGreeting = 'Good morning';
    } else if (hour < 17) {
      timeGreeting = 'Good afternoon';
    } else {
      timeGreeting = 'Good evening';
    }

    return userName
      ? `${timeGreeting}, ${userName}. Here's your briefing for today.`
      : `${timeGreeting}. Here's your briefing for today.`;
  }

  /**
   * Generate weekly greeting
   */
  private generateWeeklyGreeting(userName?: string): string {
    const greeting = userName
      ? `Here's your week ahead, ${userName}.`
      : "Here's your week ahead.";

    return greeting;
  }

  // ============================================================================
  // FALLBACK GENERATORS
  // ============================================================================

  /**
   * Generate fallback prep suggestion when AI is not available
   */
  private generateFallbackPrepSuggestion(event: BriefingCalendarEvent): string {
    if (event.attendees.length > 3) {
      return `Review agenda and prepare questions for the ${event.attendees.length} attendees.`;
    }
    return `Review any previous notes or context for this meeting.`;
  }

  /**
   * Generate fallback talking points
   */
  private generateFallbackTalkingPoints(
    event: BriefingCalendarEvent
  ): string[] {
    const points: string[] = [];

    if (event.description) {
      points.push('Review meeting description and objectives');
    }
    if (event.attendees.length > 0) {
      points.push(`Prepare introductions for ${event.attendees.length} attendees`);
    }
    points.push('Identify key decisions or outcomes needed');

    return points;
  }

  /**
   * Generate fallback email draft
   */
  private generateFallbackEmailDraft(thread: BriefingEmailThread): {
    content: string;
    tone: 'formal' | 'casual' | 'urgent';
  } {
    const tone = thread.isUrgent ? 'urgent' : 'casual';

    const content = thread.isUrgent
      ? `Hi,\n\nThank you for your message. I wanted to respond quickly regarding ${thread.subject}.\n\n[Your response here]\n\nBest regards`
      : `Hi,\n\nThanks for reaching out about ${thread.subject}.\n\n[Your response here]\n\nBest`;

    return { content, tone };
  }

  /**
   * Get mock calendar events for testing
   */
  private getMockCalendarEvents(date: Date): BriefingCalendarEvent[] {
    const dateStr = date.toISOString().split('T')[0];
    return [
      {
        id: `event_${dateStr}_1`,
        title: 'Team Standup',
        startTime: `${dateStr}T09:00:00`,
        endTime: `${dateStr}T09:30:00`,
        attendees: ['team@example.com'],
        isRecurring: true,
        requiresPrep: false,
      },
      {
        id: `event_${dateStr}_2`,
        title: 'Product Review',
        startTime: `${dateStr}T14:00:00`,
        endTime: `${dateStr}T15:00:00`,
        attendees: ['product@example.com', 'engineering@example.com'],
        description: 'Review Q1 product roadmap',
        isRecurring: false,
        requiresPrep: true,
        prepSuggestion: 'Review roadmap document before meeting',
      },
    ];
  }

  /**
   * Get mock emails for testing
   */
  private getMockEmails(): BriefingEmailThread[] {
    return [
      {
        id: 'email_1',
        subject: 'Project Update Request',
        from: 'manager@example.com',
        receivedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        snippet: 'Can you send me an update on the current project status?',
        isUrgent: false,
        threadLength: 1,
      },
    ];
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  /**
   * Get start of week (Monday)
   */
  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  /**
   * Check if date is today
   */
  private isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  /**
   * Map importance string to priority number
   */
  private mapImportanceToPriority(importance: string): 1 | 2 | 3 | 4 | 5 {
    switch (importance.toLowerCase()) {
      case 'critical':
        return 5;
      case 'high':
        return 4;
      case 'medium':
        return 3;
      case 'low':
        return 2;
      default:
        return 1;
    }
  }
}

// Singleton instance
let generatorInstance: BriefingGenerator | null = null;

export function initializeBriefingGenerator(
  db: Database,
  config?: BriefingGeneratorConfig,
  integrations?: {
    calendar?: CalendarIntegration;
    email?: EmailIntegration;
    ai?: AIService;
  }
): BriefingGenerator {
  generatorInstance = new BriefingGenerator(db, config, integrations);
  return generatorInstance;
}

export function getBriefingGenerator(): BriefingGenerator {
  if (!generatorInstance) {
    throw new Error(
      'BriefingGenerator not initialized. Call initializeBriefingGenerator first.'
    );
  }
  return generatorInstance;
}
