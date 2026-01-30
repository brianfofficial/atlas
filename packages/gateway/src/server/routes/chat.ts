/**
 * Chat Routes
 *
 * REST and SSE endpoints for chat conversations and messages.
 * Supports real-time streaming of AI responses via Server-Sent Events.
 *
 * @module @atlas/gateway/server/routes/chat
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { streamSSE } from 'hono/streaming';
import { eq, desc, sql, like, and, or } from 'drizzle-orm';
import type { ServerEnv } from '../index.js';
import { getDatabase } from '../../db/index.js';
import { conversations, messages, messageAttachments } from '../../db/schema.js';
import { NotFoundError, ValidationError, UnauthorizedError } from '../middleware/error-handler.js';
import { getModelRouter } from '../../models/router.js';
import { getEventBroadcaster } from '../../events/event-broadcaster.js';

const chat = new Hono<ServerEnv>();

// ============================================================================
// Validation Schemas
// ============================================================================

const createConversationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateConversationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(100000),
  attachments: z.array(z.string()).optional(),
  stream: z.boolean().optional().default(true),
});

const searchMessagesSchema = z.object({
  q: z.string().min(1).max(500),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
  conversationId: z.string().optional(),
});

const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

/**
 * Verify conversation belongs to user
 */
async function verifyConversationOwnership(conversationId: string, userId: string) {
  const db = getDatabase();
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!conversation) {
    throw new NotFoundError('Conversation', conversationId);
  }

  if (conversation.userId !== userId) {
    throw new UnauthorizedError('Access denied to this conversation');
  }

  return conversation;
}

/**
 * Generate a title from message content
 */
function generateTitle(content: string): string {
  // Take first line or first 50 chars
  const firstLine = content.split('\n')[0] || content;
  if (firstLine.length <= 50) {
    return firstLine;
  }
  return firstLine.substring(0, 47) + '...';
}

// ============================================================================
// Conversation Routes
// ============================================================================

/**
 * GET /api/chat/conversations
 * List all conversations for the current user
 */
chat.get('/conversations', zValidator('query', paginationSchema), async (c) => {
  const userId = c.get('userId');
  if (!userId) throw new UnauthorizedError();

  const { limit, offset } = c.req.valid('query');
  const db = getDatabase();

  const userConversations = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(conversations)
    .where(eq(conversations.userId, userId));
  const count = countResult[0]?.count ?? 0;

  return c.json({
    conversations: userConversations,
    total: count,
    limit,
    offset,
  });
});

/**
 * POST /api/chat/conversations
 * Create a new conversation
 */
chat.post('/conversations', zValidator('json', createConversationSchema), async (c) => {
  const userId = c.get('userId');
  if (!userId) throw new UnauthorizedError();

  const { title, metadata } = c.req.valid('json');
  const db = getDatabase();

  const id = generateId();
  const timestamp = now();

  await db.insert(conversations).values({
    id,
    userId,
    title: title || 'New Conversation',
    messageCount: 0,
    metadata: metadata ? JSON.stringify(metadata) : '{}',
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id));

  return c.json(conversation, 201);
});

/**
 * GET /api/chat/conversations/:id
 * Get a conversation with its messages
 */
chat.get('/conversations/:id', async (c) => {
  const userId = c.get('userId');
  if (!userId) throw new UnauthorizedError();

  const conversationId = c.req.param('id');
  const conversation = await verifyConversationOwnership(conversationId, userId);

  const db = getDatabase();

  // Get messages
  const conversationMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);

  // Get attachments for all messages
  const messageIds = conversationMessages.map((m) => m.id);
  const attachments =
    messageIds.length > 0
      ? await db
          .select()
          .from(messageAttachments)
          .where(sql`${messageAttachments.messageId} IN ${messageIds}`)
      : [];

  // Attach attachments to messages
  const messagesWithAttachments = conversationMessages.map((msg) => ({
    ...msg,
    attachments: attachments.filter((a) => a.messageId === msg.id),
    metadata: msg.metadata ? JSON.parse(msg.metadata) : {},
  }));

  return c.json({
    ...conversation,
    metadata: conversation.metadata ? JSON.parse(conversation.metadata) : {},
    messages: messagesWithAttachments,
  });
});

/**
 * PATCH /api/chat/conversations/:id
 * Update a conversation
 */
chat.patch('/conversations/:id', zValidator('json', updateConversationSchema), async (c) => {
  const userId = c.get('userId');
  if (!userId) throw new UnauthorizedError();

  const conversationId = c.req.param('id');
  await verifyConversationOwnership(conversationId, userId);

  const { title, metadata } = c.req.valid('json');
  const db = getDatabase();

  const updates: Record<string, unknown> = {
    updatedAt: now(),
  };

  if (title !== undefined) {
    updates.title = title;
  }

  if (metadata !== undefined) {
    updates.metadata = JSON.stringify(metadata);
  }

  await db
    .update(conversations)
    .set(updates)
    .where(eq(conversations.id, conversationId));

  const [updated] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId));

  return c.json(updated);
});

/**
 * DELETE /api/chat/conversations/:id
 * Delete a conversation and all its messages
 */
chat.delete('/conversations/:id', async (c) => {
  const userId = c.get('userId');
  if (!userId) throw new UnauthorizedError();

  const conversationId = c.req.param('id');
  await verifyConversationOwnership(conversationId, userId);

  const db = getDatabase();

  // Cascading delete will handle messages and attachments
  await db.delete(conversations).where(eq(conversations.id, conversationId));

  return c.json({ success: true });
});

// ============================================================================
// Message Routes
// ============================================================================

/**
 * GET /api/chat/conversations/:id/messages
 * Get messages for a conversation
 */
chat.get('/conversations/:id/messages', zValidator('query', paginationSchema), async (c) => {
  const userId = c.get('userId');
  if (!userId) throw new UnauthorizedError();

  const conversationId = c.req.param('id');
  await verifyConversationOwnership(conversationId, userId);

  const { limit, offset } = c.req.valid('query');
  const db = getDatabase();

  const conversationMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt)
    .limit(limit)
    .offset(offset);

  return c.json(conversationMessages);
});

/**
 * POST /api/chat/conversations/:id/messages
 * Send a message and get AI response
 * Supports streaming via SSE
 */
chat.post('/conversations/:id/messages', zValidator('json', sendMessageSchema), async (c) => {
  const userId = c.get('userId');
  if (!userId) throw new UnauthorizedError();

  const conversationId = c.req.param('id');
  const conversation = await verifyConversationOwnership(conversationId, userId);
  const { content, attachments, stream } = c.req.valid('json');

  const db = getDatabase();
  const timestamp = now();

  // Create user message
  const userMessageId = generateId();
  await db.insert(messages).values({
    id: userMessageId,
    conversationId,
    role: 'user',
    content,
    createdAt: timestamp,
  });

  // Add attachments if any
  if (attachments && attachments.length > 0) {
    for (const fileId of attachments) {
      await db.insert(messageAttachments).values({
        id: generateId(),
        messageId: userMessageId,
        fileId,
        fileName: fileId, // TODO: Fetch actual file name from file storage
        createdAt: timestamp,
      });
    }
  }

  // Update conversation title if this is the first message
  if (conversation.messageCount === 0) {
    await db
      .update(conversations)
      .set({
        title: generateTitle(content),
        updatedAt: timestamp,
      })
      .where(eq(conversations.id, conversationId));
  }

  // Get conversation history for context
  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt)
    .limit(20); // Last 20 messages for context

  // Build context for AI
  const contextMessages = history.map((m) => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content,
  }));

  // If streaming is requested, use SSE
  if (stream) {
    return streamSSE(c, async (stream) => {
      const assistantMessageId = generateId();
      let fullContent = '';
      const startTime = Date.now();

      try {
        // Use model router to get AI response
        const router = getModelRouter();
        const response = await router.route({
          prompt: content,
          systemPrompt: `You are Atlas, a helpful AI assistant. Be concise and helpful. Current conversation context has ${contextMessages.length} previous messages.`,
          maxTokens: 4096,
          temperature: 0.7,
        });

        fullContent = response.content;

        // For now, simulate streaming by chunking the response
        // TODO: Implement true streaming with model providers
        const words = fullContent.split(' ');
        const chunkSize = 5;

        for (let i = 0; i < words.length; i += chunkSize) {
          const chunk = words.slice(i, i + chunkSize).join(' ') + (i + chunkSize < words.length ? ' ' : '');
          await stream.writeSSE({
            data: JSON.stringify({ delta: chunk }),
            event: 'delta',
          });
          // Small delay to simulate streaming
          await new Promise((resolve) => setTimeout(resolve, 20));
        }

        // Save assistant message
        const durationMs = Date.now() - startTime;
        await db.insert(messages).values({
          id: assistantMessageId,
          conversationId,
          role: 'assistant',
          content: fullContent,
          model: response.model,
          provider: response.provider,
          tokensInput: response.usage.inputTokens,
          tokensOutput: response.usage.outputTokens,
          durationMs,
          estimatedCost: response.usage.estimatedCost,
          finishReason: response.finishReason,
          error: response.error,
          createdAt: now(),
        });

        // Update conversation stats
        await db
          .update(conversations)
          .set({
            messageCount: sql`${conversations.messageCount} + 2`,
            lastMessageAt: now(),
            lastMessage: fullContent.substring(0, 100),
            updatedAt: now(),
          })
          .where(eq(conversations.id, conversationId));

        // Send completion event
        await stream.writeSSE({
          data: JSON.stringify({
            done: true,
            id: assistantMessageId,
            model: response.model,
            tokensUsed: response.usage.totalTokens,
            duration: durationMs,
          }),
          event: 'done',
        });

        // Broadcast event for real-time updates
        const broadcaster = getEventBroadcaster();
        broadcaster.broadcastToUser(userId, 'chat:message_complete', {
          conversationId,
          messageId: assistantMessageId,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Save error message
        await db.insert(messages).values({
          id: assistantMessageId,
          conversationId,
          role: 'assistant',
          content: 'I apologize, but I encountered an error processing your request.',
          error: errorMessage,
          finishReason: 'error',
          createdAt: now(),
        });

        await stream.writeSSE({
          data: JSON.stringify({ error: errorMessage }),
          event: 'error',
        });
      }
    });
  }

  // Non-streaming response
  const assistantMessageId = generateId();
  const startTime = Date.now();

  try {
    const router = getModelRouter();
    const response = await router.route({
      prompt: content,
      systemPrompt: `You are Atlas, a helpful AI assistant. Be concise and helpful.`,
      maxTokens: 4096,
      temperature: 0.7,
    });

    const durationMs = Date.now() - startTime;

    // Save assistant message
    await db.insert(messages).values({
      id: assistantMessageId,
      conversationId,
      role: 'assistant',
      content: response.content,
      model: response.model,
      provider: response.provider,
      tokensInput: response.usage.inputTokens,
      tokensOutput: response.usage.outputTokens,
      durationMs,
      estimatedCost: response.usage.estimatedCost,
      finishReason: response.finishReason,
      error: response.error,
      createdAt: now(),
    });

    // Update conversation stats
    await db
      .update(conversations)
      .set({
        messageCount: sql`${conversations.messageCount} + 2`,
        lastMessageAt: now(),
        lastMessage: response.content.substring(0, 100),
        updatedAt: now(),
      })
      .where(eq(conversations.id, conversationId));

    // Get the saved messages
    const [userMessage] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, userMessageId));

    const [assistantMessage] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, assistantMessageId));

    return c.json({
      userMessage,
      assistantMessage: {
        ...assistantMessage,
        metadata: {
          model: response.model,
          tokensUsed: response.usage.totalTokens,
          duration: durationMs,
        },
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Save error response
    await db.insert(messages).values({
      id: assistantMessageId,
      conversationId,
      role: 'assistant',
      content: 'I apologize, but I encountered an error processing your request.',
      error: errorMessage,
      finishReason: 'error',
      createdAt: now(),
    });

    throw error;
  }
});

// ============================================================================
// Search Routes
// ============================================================================

/**
 * GET /api/chat/messages/search
 * Search messages across conversations
 */
chat.get('/messages/search', zValidator('query', searchMessagesSchema), async (c) => {
  const userId = c.get('userId');
  if (!userId) throw new UnauthorizedError();

  const { q, limit, offset, conversationId } = c.req.valid('query');
  const db = getDatabase();

  // Build search conditions
  const searchPattern = `%${q}%`;

  let results;
  if (conversationId) {
    // Verify ownership
    await verifyConversationOwnership(conversationId, userId);

    results = await db
      .select({
        message: messages,
        conversation: conversations,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(
        and(
          eq(messages.conversationId, conversationId),
          like(messages.content, searchPattern)
        )
      )
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .offset(offset);
  } else {
    // Search across all user's conversations
    results = await db
      .select({
        message: messages,
        conversation: conversations,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(
        and(
          eq(conversations.userId, userId),
          like(messages.content, searchPattern)
        )
      )
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .offset(offset);
  }

  // Format results with excerpts
  const formattedResults = results.map(({ message, conversation }) => ({
    ...message,
    conversationTitle: conversation.title,
    excerpt: extractExcerpt(message.content, q),
  }));

  return c.json({
    messages: formattedResults,
    total: formattedResults.length,
    query: q,
  });
});

/**
 * Extract excerpt around search term
 */
function extractExcerpt(content: string, term: string, contextChars = 50): string {
  const lowerContent = content.toLowerCase();
  const lowerTerm = term.toLowerCase();
  const index = lowerContent.indexOf(lowerTerm);

  if (index === -1) {
    return content.substring(0, 100) + (content.length > 100 ? '...' : '');
  }

  const start = Math.max(0, index - contextChars);
  const end = Math.min(content.length, index + term.length + contextChars);

  let excerpt = '';
  if (start > 0) excerpt += '...';
  excerpt += content.substring(start, end);
  if (end < content.length) excerpt += '...';

  return excerpt;
}

// ============================================================================
// Export Route
// ============================================================================

/**
 * GET /api/chat/conversations/:id/export
 * Export conversation to Markdown
 */
chat.get('/conversations/:id/export', async (c) => {
  const userId = c.get('userId');
  if (!userId) throw new UnauthorizedError();

  const conversationId = c.req.param('id');
  const conversation = await verifyConversationOwnership(conversationId, userId);

  const db = getDatabase();

  const conversationMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);

  // Generate Markdown
  let markdown = `# ${conversation.title}\n\n`;
  markdown += `*Exported: ${new Date().toLocaleString()}*\n\n`;
  markdown += `---\n\n`;

  for (const msg of conversationMessages) {
    const roleLabel = msg.role === 'user' ? '**You**' : '**Atlas**';
    const timestamp = new Date(msg.createdAt).toLocaleString();

    markdown += `### ${roleLabel} *${timestamp}*\n\n`;
    markdown += `${msg.content}\n\n`;
    markdown += `---\n\n`;
  }

  // Return as downloadable file
  c.header('Content-Type', 'text/markdown');
  c.header('Content-Disposition', `attachment; filename="${conversation.title.replace(/[^a-z0-9]/gi, '_')}.md"`);

  return c.body(markdown);
});

export default chat;
