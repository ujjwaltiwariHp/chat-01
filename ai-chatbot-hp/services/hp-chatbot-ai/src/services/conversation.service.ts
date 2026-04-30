import { eq, desc, and, isNull } from 'drizzle-orm';
import { db } from '@db/connection.js';
import { conversations, messages, request_logs } from '@db/schema.js';
import { ApiError, logger } from '@hp-intelligence/core';
import {
  ConversationScopeInput,
  getConversationScopeSignature,
  normalizeConversationScope,
} from '@services/conversation-scope.js';

/**
 * High-Standard Conversation Data Service
 * Orchestrates all database operations for chat sessions and message persistence.
 */
export class ConversationService {
  private log = logger.child({ ns: 'service:conversation' });

  /**
   * Fetch a conversation by its sessionId.
   * Ensures we are only accessing the conversation for the correct tenant.
   */
  async getConversation(scope: ConversationScopeInput) {
    const normalizedScope = normalizeConversationScope(scope);
    const filters = [
      eq(conversations.sessionId, normalizedScope.sessionId),
      eq(conversations.tenantId, normalizedScope.tenantId),
      eq(conversations.source, normalizedScope.source),
      eq(conversations.userId, normalizedScope.userId),
    ];

    try {
      const results = await db.select()
        .from(conversations)
        .where(and(...filters))
        .limit(1);

      return results[0] || null;
    } catch (err: any) {
      this.log.error({
        scope: getConversationScopeSignature(normalizedScope),
        error: err.message,
      }, 'getConversation.failed');
      throw new ApiError('DB_QUERY_FAILED', 'Failed to retrieve conversation');
    }
  }

  /**
   * Create a new conversation session.
   * Tracks technical markers like source, tenant, and customer.
   */
  async createConversation(data: ConversationScopeInput) {
    const normalizedScope = normalizeConversationScope(data);

    try {
      const [newConv] = await db.insert(conversations)
        .values({
          sessionId: normalizedScope.sessionId,
          tenantId: normalizedScope.tenantId,
          userId: normalizedScope.userId,
          source: normalizedScope.source,
        })
        .returning();

      this.log.info({
        scope: getConversationScopeSignature(normalizedScope),
        id: newConv.id,
      }, 'createConversation.success');
      return newConv;
    } catch (err: any) {
      if (err.code === '23505') { // Postgres Unique Violation
        return this.getConversation(normalizedScope);
      }
      this.log.error({
        scope: getConversationScopeSignature(normalizedScope),
        error: err.message,
      }, 'createConversation.failed');
      throw new ApiError('DB_QUERY_FAILED', 'Failed to initialize conversation');
    }
  }

  /**
   * Save a single message (User or Assistant) to the database.
   */
  async saveMessage(data: {
    conversationId: string;
    role: 'user' | 'assistant';
    content: string;
    status?: 'completed' | 'stopped' | 'error' | 'streaming';
    createdAt?: Date;
  }) {
    try {
      const [msg] = await db.insert(messages)
        .values({
          conversationId: data.conversationId,
          role: data.role,
          content: data.content,
          status: data.status || 'completed',
          createdAt: data.createdAt || new Date(),
        })
        .returning();

      return msg;
    } catch (err: any) {
      this.log.error({ conversationId: data.conversationId, error: err.message }, 'saveMessage.failed');
      throw new ApiError('DB_QUERY_FAILED', 'Failed to persist message');
    }
  }

  async saveRequestLog(data: {
    conversationId: string;
    model: string;
    promptVersion: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latencyMs: number;
  }) {
    try {
      const [log] = await db.insert(request_logs)
        .values({
          conversationId: data.conversationId,
          model: data.model,
          promptVersion: data.promptVersion,
          promptTokens: Math.floor(data.promptTokens),
          completionTokens: Math.floor(data.completionTokens),
          totalTokens: Math.floor(data.totalTokens),
          latencyMs: Math.floor(data.latencyMs),
        })
        .returning();

      return log;
    } catch (err: any) {
      this.log.error({ conversationId: data.conversationId, error: err.message }, 'saveRequestLog.failed');
      // Silently fail for logs to avoid disrupting user experience in production
      return null;
    }
  }

  /**
   * Fetch recent chat history to provide context for the LLM.
   */
  async getChatHistory(conversationId: string, limit: number = 10) {
    try {
      const history = await db.select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.createdAt))
        .limit(limit);

      return history.reverse();
    } catch (err: any) {
      this.log.error({ conversationId, error: err.message }, 'getChatHistory.failed');
      throw new ApiError('DB_QUERY_FAILED', 'Failed to fetch messages history');
    }
  }
}

export const conversationService = new ConversationService();
