import { and, desc, eq, isNull } from 'drizzle-orm';
import { ApiError, decrypt, logger } from '@hp-intelligence/core';
import { db } from '@/db/connection.js';
import { policyConversations, policyMessages, policyRequestLogs } from '@/db/schema.js';
import {
  ConversationScopeInput,
  getConversationScopeSignature,
  normalizeConversationScope,
} from '@/services/conversation-scope.js';

export class ConversationService {
  private log = logger.child({ ns: 'hr-policy:conversation' });

  async getConversation(scope: ConversationScopeInput) {
    const normalizedScope = normalizeConversationScope(scope);
    const filters = [
      eq(policyConversations.sessionId, normalizedScope.sessionId),
      eq(policyConversations.tenantId, normalizedScope.tenantId),
      eq(policyConversations.source, normalizedScope.source),
      normalizedScope.customerId
        ? eq(policyConversations.customerId, normalizedScope.customerId)
        : isNull(policyConversations.customerId),
      normalizedScope.userId
        ? eq(policyConversations.userId, normalizedScope.userId)
        : isNull(policyConversations.userId),
    ];

    try {
      const results = await db.select()
        .from(policyConversations)
        .where(and(...filters))
        .limit(1);

      return results[0] || null;
    } catch (error: any) {
      this.log.error({
        scope: getConversationScopeSignature(normalizedScope),
        error: error.message,
      }, 'getConversation.failed');
      throw new ApiError('DB_QUERY_FAILED', 'Failed to retrieve policy conversation');
    }
  }

  async createConversation(scope: ConversationScopeInput) {
    const normalizedScope = normalizeConversationScope(scope);

    try {
      const [conversation] = await db.insert(policyConversations)
        .values({
          sessionId: normalizedScope.sessionId,
          tenantId: normalizedScope.tenantId,
          source: normalizedScope.source,
          customerId: normalizedScope.customerId,
          userId: normalizedScope.userId,
        })
        .returning();

      this.log.info({
        scope: getConversationScopeSignature(normalizedScope),
        conversationId: conversation.id,
      }, 'createConversation.success');

      return conversation;
    } catch (error: any) {
      this.log.error({
        scope: getConversationScopeSignature(normalizedScope),
        error: error.message,
      }, 'createConversation.failed');
      throw new ApiError('DB_QUERY_FAILED', 'Failed to initialize policy conversation');
    }
  }

  async saveMessage(data: {
    conversationId: string;
    role: 'user' | 'assistant';
    content: string;
    status?: 'completed' | 'stopped' | 'error' | 'streaming';
    createdAt?: Date;
  }) {
    try {
      const [message] = await db.insert(policyMessages)
        .values({
          conversationId: data.conversationId,
          role: data.role,
          content: data.content,
          status: data.status || 'completed',
          createdAt: data.createdAt || new Date(),
        })
        .returning();

      return message;
    } catch (error: any) {
      this.log.error({
        conversationId: data.conversationId,
        error: error.message,
      }, 'saveMessage.failed');
      throw new ApiError('DB_QUERY_FAILED', 'Failed to persist policy message');
    }
  }

  async saveRequestLog(data: {
    conversationId?: string | null;
    model: string;
    promptVersion: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latencyMs: number;
  }) {
    try {
      const [requestLog] = await db.insert(policyRequestLogs)
        .values({
          conversationId: data.conversationId ?? null,
          model: data.model,
          promptVersion: data.promptVersion,
          promptTokens: data.promptTokens,
          completionTokens: data.completionTokens,
          totalTokens: data.totalTokens,
          latencyMs: data.latencyMs,
        })
        .returning();

      return requestLog;
    } catch (error: any) {
      this.log.error({
        conversationId: data.conversationId,
        error: error.message,
      }, 'saveRequestLog.failed');
      throw new ApiError('DB_QUERY_FAILED', 'Failed to persist policy request log');
    }
  }

  async getChatHistory(conversationId: string, limit: number = 8) {
    try {
      const rows = await db.select({
        role: policyMessages.role,
        content: policyMessages.content,
        createdAt: policyMessages.createdAt,
      })
        .from(policyMessages)
        .where(eq(policyMessages.conversationId, conversationId))
        .orderBy(desc(policyMessages.createdAt))
        .limit(limit);

      return rows
        .reverse()
        .map((row: any) => ({
          role: row.role as 'user' | 'assistant',
          content: decrypt(row.content) ?? row.content,
          createdAt: row.createdAt || undefined,
        }));
    } catch (error: any) {
      this.log.error({ conversationId, error: error.message }, 'getChatHistory.failed');
      throw new ApiError('DB_QUERY_FAILED', 'Failed to fetch policy history');
    }
  }

  async getStoredMessages(conversationId: string, limit: number = 20) {
    try {
      const rows = await db.select()
        .from(policyMessages)
        .where(eq(policyMessages.conversationId, conversationId))
        .orderBy(desc(policyMessages.createdAt))
        .limit(limit);

      return rows
        .reverse()
        .map((row: any) => ({
          id: row.id,
          conversationId: row.conversationId,
          role: row.role,
          content: decrypt(row.content) ?? row.content,
          status: row.status,
          createdAt: row.createdAt,
        }));
    } catch (error: any) {
      this.log.error({ conversationId, error: error.message }, 'getStoredMessages.failed');
      throw new ApiError('DB_QUERY_FAILED', 'Failed to fetch stored policy messages');
    }
  }
}

export const conversationService = new ConversationService();
