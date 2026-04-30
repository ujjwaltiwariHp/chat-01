import { 
  logger, 
  ErrorCodes, 
  ApiError, 
  HttpStatusCode, 
  ERROR_MESSAGES,
  ChatMessage,
  LLMStreamChunk,
  countChatTokens,
  countTokens,
  encrypt,
  decrypt,
  UUID_REGEX,
  redis
} from '@hp-intelligence/core';
import { db } from '../db/connection.js';
import { config } from '@config/index.js';
import { conversations, messages, request_logs } from '../db/schema.js';
import { eq, desc, asc, and, sql, lt } from 'drizzle-orm';
import { chatbotOrchestrator } from '../orchestration/chatbotOrchestrator.js';
import { PROMPT_VERSION, buildSystemPrompt } from '../prompts/promptBuilder.js';
import { generateConversationSummary } from './summary.service.js';
import { dbBreaker } from '../circuit/dbBreaker.js';

const securityLogger = logger.child({ ns: 'security' });
const databaseLogger = logger.child({ ns: 'database' });
const perfLogger = logger.child({ ns: 'database:perf' });

export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

/**
 * Estimates the USD cost of the interaction based on model price.
 * Prices are based on GPT-4o-mini (July 2024).
 */
function calculateCost(tokens: TokenUsage): number {
  const PROMPT_PRICE = 0.15 / 1_000_000; // $0.15 per 1M tokens
  const COMPLETION_PRICE = 0.60 / 1_000_000; // $0.60 per 1M tokens
  return (tokens.prompt * PROMPT_PRICE) + (tokens.completion * COMPLETION_PRICE);
}

/**
 * Sanitizes conversation ID by removing potential quote artifacts.
 */
export function sanitizeConversationId(id?: string): string | undefined {
  return id?.replace(/['"]+/g, '').trim();
}

/**
 * Validates existence and optionally the ownership of a conversation.
 * For guests, possessing the UUID conversationId is sufficient (like a secret link).
 * For authenticated users, we verify the userId if available.
 */
export async function validateConversationAccess(conversationId: string, sessionId?: string, userId?: string, tx?: any): Promise<void> {
  return dbBreaker.fire(async () => {
    const cleanId = sanitizeConversationId(conversationId);
    if (!cleanId || cleanId === 'new-conv') return;

    if (!UUID_REGEX.test(cleanId)) {
      securityLogger.warn({ conversationId: cleanId }, 'Invalid UUID format for conversationId');
      throw new ApiError('COMMON_VALIDATION_ERROR', 'Invalid conversation ID format');
    }

    const queryTx = tx || db;

    // Search by either sessionId OR userId if available
    const [existing] = await queryTx.select({ id: conversations.id, sessionId: conversations.sessionId, userId: conversations.userId })
      .from(conversations)
      .where(eq(conversations.id, cleanId))
      .limit(1);

    if (!existing) {
      securityLogger.warn({ conversationId: cleanId }, 'Conversation not found');
      throw new ApiError('CONVERSATION_NOT_FOUND');
    }

    // Security Verification
    // If the conversation has a userId, and the current user is authenticated, they must match.
    if (existing.userId && userId && userId !== 'anonymous' && existing.userId !== userId) {
      securityLogger.warn({ conversationId: cleanId, currentUserId: userId, ownerUserId: existing.userId }, 'User ID mismatch for conversation');
      throw new ApiError('WIDGET_AUTH_INVALID', 'Access denied to this conversation');
    }

    // Note: Guest users sharing a link is permitted as the UUID acts as a secret key.
    // We will re-bind the sessionId during the next saveConversation call.
  }) as Promise<void>;
}

/**
 * Counts total messages in a conversation.
 */
export async function getConversationMessageCount(conversationId: string): Promise<number> {
  return dbBreaker.fire(async () => {
    const cleanId = sanitizeConversationId(conversationId);
    if (!cleanId || cleanId === 'new-conv') return 0;

    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(eq(messages.conversationId, cleanId));

    return Number(result?.count || 0);
  }) as Promise<number>;
}

/**
 * Fetches the most recent conversation history with cursor-based pagination.
 * Limits history by default to prevent context window overflow.
 */
export async function getConversationHistory(
  conversationId: string, 
  sessionId?: string, 
  userId?: string, 
  limit = config.CHAT_HISTORY_LIMIT,
  before?: string
): Promise<ChatMessage[]> {
  return dbBreaker.fire(async () => {
    const cleanId = sanitizeConversationId(conversationId);
    if (!cleanId || cleanId === 'new-conv') return [];

    try {
      // Validate accessibility (and ownership if sessionId or userId provided)
      await validateConversationAccess(cleanId, sessionId, userId);
    } catch (err) {
      if (err instanceof ApiError && err.errorCodeSlug === 'CONVERSATION_NOT_FOUND') {
        return [];
      }
      throw err;
    }

    // Build the history query
    let conditions = eq(messages.conversationId, cleanId);
    
    // Apply cursor-based pagination if 'before' timestamp is provided
    if (before) {
      const beforeDate = new Date(before);
      if (!isNaN(beforeDate.getTime())) {
        conditions = and(conditions, lt(messages.createdAt, beforeDate)) as any;
      }
    }

    // Fetch the latest N messages
    const results = await db
      .select({
        role: messages.role,
        content: messages.content,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(conditions)
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    // Results are in desc order (newest first), reverse to restore chronologically
    const chronological = [...results].reverse();

    databaseLogger.debug({
      count: chronological.length,
      conversationId: cleanId,
      limit
    }, 'History retrieval completed');

    // Decrypt and map to ChatMessage format
    return chronological.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: decrypt(msg.content) ?? msg.content,
      createdAt: msg.createdAt || undefined
    }));
  }) as Promise<ChatMessage[]>;
}

/**
 * Saves a chat interaction and logs performance/token usage.
 */
export async function saveConversation(
  sessionId: string,
  userId: string,
  tenantId: string,
  userMsg: string,
  aiResponse: string,
  tokens: TokenUsage,
  latencyMs: number,
  conversationId?: string,
  status: string = 'completed'
) {
  // Guard against negative or zeroes in aborted cases (we calculate ourselves)
  if (tokens.total <= 0) {
    const prompt = countChatTokens(buildSystemPrompt(), userMsg, []); // Approximate prompt
    const completion = countTokens(aiResponse);
    tokens = { prompt, completion, total: prompt + completion };
  }

  const start = Date.now();
  try {
    const finalConvId = await dbBreaker.fire(async () => {
      return await db.transaction(async (tx: any) => {
        let currentConvId: string;
        const cleanId = sanitizeConversationId(conversationId);

        if (cleanId && cleanId !== 'new-conv') {
          if (UUID_REGEX.test(cleanId)) {
            const [existing] = await tx.select({ id: conversations.id, sessionId: conversations.sessionId, userId: conversations.userId })
              .from(conversations)
              .where(eq(conversations.id, cleanId))
              .limit(1);

            if (existing) {
              currentConvId = cleanId;
              
              // Re-bind: If the sessionId or userId has changed/re-associated, update it
              const updates: any = {};
              if (existing.sessionId !== sessionId) updates.sessionId = sessionId;
              if (userId && userId !== 'anonymous' && existing.userId !== userId) updates.userId = userId;

              if (Object.keys(updates).length > 0) {
                await tx.update(conversations).set(updates).where(eq(conversations.id, cleanId));
                databaseLogger.info({ conversationId: cleanId, updates }, 'Updated conversation metadata for active session');
              }
            } else {
              // New conversation with pre-assigned ID
              const [conv] = await tx.insert(conversations).values({
                id: cleanId,
                sessionId,
                tenantId,
                userId: userId === 'anonymous' ? null : userId
              }).returning();
              currentConvId = conv.id;
            }
          } else {
            // Input was not clean UUID, generate new
            const [conv] = await tx.insert(conversations).values({
              sessionId,
              tenantId,
              userId: userId === 'anonymous' ? null : userId
            }).returning();
            currentConvId = conv.id;
          }
        } else {
          const [conv] = await tx.insert(conversations).values({
            sessionId,
            tenantId,
            userId: userId === 'anonymous' ? null : userId
          }).returning();
          currentConvId = conv.id;
        }

        // Save messages (encrypted) with proper status and sequential timestamps to avoid out-of-order bugs
        const nowMs = Date.now();
        await tx.insert(messages).values([
          { conversationId: currentConvId, role: 'user', content: encrypt(userMsg), status: 'completed', createdAt: new Date(nowMs - 1) },
          { conversationId: currentConvId, role: 'assistant', content: encrypt(aiResponse), status, createdAt: new Date(nowMs) }
        ]);

        // Log request tokens and latency
        await tx.insert(request_logs).values({
          conversationId: currentConvId,
          model: config.OPENAI_MODEL,
          promptVersion: PROMPT_VERSION,
          promptTokens: tokens.prompt,
          completionTokens: tokens.completion,
          totalTokens: tokens.total,
          latencyMs: Date.now() - start,
        });

        // Update conversation summary trigger logic
        const [msgCount] = await tx.select({ count: sql`count(*)` })
          .from(messages)
          .where(eq(messages.conversationId, currentConvId));

        if (Number(msgCount.count) >= config.SUMMARY_TRIGGER_COUNT) {
          databaseLogger.info({ conversationId: currentConvId }, 'triggering.summary');
          // In a real app we'd queue this or run async
          generateConversationSummary(currentConvId).catch(err => 
            databaseLogger.error({ err: err.message }, 'summary.failed')
          );
        }

        return currentConvId;
      });
    });

    const durationMs = Date.now() - start;
    const estimatedCost = calculateCost(tokens);

    perfLogger.info({
      durationMs,
      conversationId: finalConvId,
      tokens: tokens.total,
      estimatedCost: `$${estimatedCost.toFixed(6)}`
    }, 'Interaction saved successfully');

    return finalConvId;
  } catch (err: unknown) {
    const error = err as Error;
    const msg = error.message || 'Unknown database error';
    databaseLogger.error({ error: msg, stack: error.stack }, 'Database query failed');

    // Handle circuit breaker opening specifically if we want
    if (msg === 'The circuit is open' || msg === 'Operation timed out') {
      throw new ApiError('DB_CONNECTION_FAILED', 'Database service is temporarily unavailable. Please try again later.');
    }

    throw new ApiError('INTERNAL_ERROR');
  }
}


/**
 * Streams a chat response from the LLM or orchestrator.
 */
export async function* handleMessage(message: string, conversationId: string, history?: ChatMessage[], sessionId?: string, signal?: AbortSignal): AsyncGenerator<LLMStreamChunk> {
  // Use provided history or fetch recent (validated) history
  const currentHistory = history || await getConversationHistory(conversationId, sessionId);
  const stream = await chatbotOrchestrator.getChatResponse(message, currentHistory, conversationId, signal);

  for await (const chunk of stream) {
    yield chunk;
  }
}
