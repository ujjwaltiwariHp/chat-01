import { FastifyRequest, FastifyReply } from 'fastify';
import { 
  ApiResponse, 
  HttpStatusCode, 
  logger, 
  LLMStreamChunk, 
  getCachedResponse, 
  setCachedResponse,
  ApiError,
  hashSessionId,
  encrypt,
  countTokens,
  countChatTokens,
} from '@hp-intelligence/core';
import { config } from '@config/index.js';
import { 
  handleMessage, 
  getConversationHistory,
} from '@services/chat.service.js';
import { conversationService } from '@services/conversation.service.js';
import { getConversationScopeSignature, normalizeConversationScope } from '@services/conversation-scope.js';
import { PROMPT_VERSION } from '../prompts/promptBuilder.js';
import { Message, ChatMessage } from '@hp-intelligence/core';

const CONTACT_DETAILS_TAG_REGEX =
  /\[CONTACT_DETAILS:\s*email=([^,\]]+),\s*phone=([^,\]]+),\s*whatsapp=([^\]]+)\]/i;

/**
 * High-Standard AI Invocation
 * Orchestrates streaming chat with semantic caching and persistence.
 */
export const invokeController = async (req: FastifyRequest, reply: FastifyReply) => {
  const { message: rawMessage } = (req.body as { message?: string; conversationId?: string }) || {};
  const message = (rawMessage || '').trim();

  if (!message) {
    return reply.status(HttpStatusCode.BAD_REQUEST).send(
      new ApiResponse(HttpStatusCode.BAD_REQUEST, null, 'Message is required')
    );
  }

  // Identity extraction from request context (previously verified by auth hooks)
  const sessionId = req.sessionId;
  const tenantId = req.tenantId; 
  const userId = req.userId;
  const authMode = req.authMode;
  const source = authMode?.toLowerCase() || 'standalone';

  if (!tenantId || !sessionId || !userId) {
    logger.warn({ 
      ns: 'invoke:security', 
      requestId: req.id, 
      hasTenant: !!tenantId, 
      hasSession: !!sessionId,
      hasUser: !!userId 
    }, 'Denying invocation: Identity context unreachable');
    throw new ApiError('COMMON_AUTH_ERROR', 'Access denied: Valid user identity context is required for AI interaction');
  }

  // Centralized Credit Deduction (Only for STANDALONE direct calls to avoid double-charging)
  if (req.authMode === 'STANDALONE') {
    const COST_PER_CHAT = 1;
    await req.server.credits.checkAndDeduct(tenantId, COST_PER_CHAT);
  }

  const conversationScope = normalizeConversationScope({
    sessionId,
    tenantId,
    source,
    userId,
  });

  logger.debug({ 
    ns: 'invoke:auth', 
    requestId: req.id, 
    authMode, 
    tenantId, 
    userId,
    source,
    scope: getConversationScopeSignature(conversationScope),
  }, 'Invocation identity check');

  // 1. Resolve or Create Conversation
  let conversation = await conversationService.getConversation(conversationScope);
  if (!conversation) {
    conversation = await conversationService.createConversation(conversationScope);
  }

  const conversationId = conversation.id;

  // Standardized SSE headers
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.setHeader('X-Accel-Buffering', 'no');
  if (req.plainSessionId) {
    reply.raw.setHeader('X-Session-ID', req.plainSessionId);
  }

  const startTime = Date.now();
  let clientClosed = false;
  const controller = new AbortController();

  reply.raw.on('close', () => {
    clientClosed = true;
    controller.abort();
  });

  try {
    // 2. Parallel Pre-checks (History + Cache)
    const [history, cached] = await Promise.all([
       getConversationHistory(conversationId, sessionId, userId, 6),
       getCachedResponse(message, [], 'chatbot') // Pass empty history if we only want message-based hit, or history if context-sensitive
    ]);
    
    let stream: any;
    const isCacheHit = !!cached;

    if (isCacheHit) {
      stream = simulateStreaming(cached!);
    } else {
      stream = await handleMessage(message, conversationId, history, sessionId, controller.signal);
    }

    // Single unified start message with full context
    sendSSE(reply, new ApiResponse(HttpStatusCode.OK, {
      type: 'start',
      conversationId: conversationId,
      sessionId: req.plainSessionId,
      isNewSession: req.isNewSession,
    }, isCacheHit ? 'Cache Hit' : 'Stream Started'));

    let fullResponse = '';
    let officialUsage: any = null;
    
    for await (const chunk of stream) {
      if (clientClosed) break;
      
      if (chunk.usage) {
        officialUsage = chunk.usage;
      }

      if (chunk.done) break;
      
      fullResponse += chunk.content;
      // High-Standard: Minimal payload for content chunks to reduce overhead
      reply.raw.write(`data: ${JSON.stringify({ type: 'content', content: chunk.content })}\n\n`);
    }

    if (!clientClosed) {
      reply.raw.write(`data: ${JSON.stringify({
        type: 'done',
        meta: buildCompletionMeta(fullResponse),
      })}\n\n`);
    }

    // 3. Parallelized & Non-blocking Persistence
    if (!clientClosed && fullResponse) {
      const nowMs = Date.now();
      const latencyMs = nowMs - startTime;

      const persistenceTasks: Promise<any>[] = [
        conversationService.saveMessage({ 
          conversationId, 
          role: 'user', 
          content: encrypt(message),
          createdAt: new Date(nowMs - 1) 
        }).catch(e => logger.error({ ns: 'invoke:persist', err: e.message }, 'Failed to save user message')),
        
        conversationService.saveMessage({ 
          conversationId, 
          role: 'assistant', 
          content: encrypt(fullResponse), 
          status: 'completed',
          createdAt: new Date(nowMs)
        }).catch(e => logger.error({ ns: 'invoke:persist', err: e.message }, 'Failed to save assistant message')),

        // P10: Hybrid Accuracy Logic (Official > Estimated)
        conversationService.saveRequestLog({
           conversationId,
           model: config.OPENAI_MODEL, 
           promptVersion: PROMPT_VERSION,
           promptTokens: officialUsage?.promptTokens ?? countChatTokens('system', message, []),
           completionTokens: officialUsage?.completionTokens ?? countTokens(fullResponse),
           totalTokens: officialUsage?.totalTokens ?? (countChatTokens('system', message, []) + countTokens(fullResponse)),
           latencyMs
        }).catch(e => logger.error({ ns: 'invoke:log', err: e.message }, 'Failed to save request log'))
      ];

      if (!isCacheHit) {
        persistenceTasks.push(setCachedResponse(message, fullResponse, history).catch(() => {}));
      }

      await Promise.all(persistenceTasks);
    }

    const latencyMs = Date.now() - startTime;
    logger.info({ ns: 'invoke:perf', latencyMs, isCacheHit, conversationId }, 'Invocation cycle complete');

  } catch (err: any) {
    if (!controller.signal.aborted) {
      const statusCode = err.statusCode || HttpStatusCode.INTERNAL_SERVER_ERROR;
      sendSSEError(reply, statusCode, err);
    }
  } finally {
    reply.raw.end();
  }
};

/**
 * History Retrieval (Multi-Tenant Secure)
 */
export const getInvokeHistory = async (req: FastifyRequest, reply: FastifyReply) => {
  const { sessionId: paramSessionId } = req.params as { sessionId: string };
  const { limit, before } = (req.query as { limit?: string; before?: string }) || {};

  const internalSessionId = hashSessionId(paramSessionId);
  const tenantId = req.tenantId;
  const userId = req.userId || 'anonymous';
  const source = req.authMode?.toLowerCase() || 'standalone';
  
  if (!tenantId) {
     throw new ApiError('COMMON_AUTH_ERROR', 'Access denied: Tenant context required for history lookup');
  }

  const conversation = await conversationService.getConversation({
    sessionId: internalSessionId,
    tenantId,
    source,
    userId,
  });
  if (!conversation) {
    return reply.status(HttpStatusCode.OK).send(new ApiResponse(HttpStatusCode.OK, { messages: [] }, 'No session found for provided ID'));
  }

  // Maintain consistency: use the same standard history service for the API endpoint
  const history = await getConversationHistory(
    conversation.id, 
    internalSessionId, 
    userId, 
    limit ? parseInt(limit, 10) : 20, 
    before
  );

  return reply.status(HttpStatusCode.OK).send(
    new ApiResponse(HttpStatusCode.OK, { messages: history }, 'History retrieved')
  );
};


// --- Helpers ---

async function* simulateStreaming(content: string): AsyncIterator<LLMStreamChunk> {
  const chunks = content.split(' ');
  for (const chunk of chunks) {
    // No artificial delay for cached hits to maximize performance
    yield { content: chunk + ' ', done: false } as LLMStreamChunk;
  }
  yield { content: '', done: true } as LLMStreamChunk;
}

function sendSSEError(reply: FastifyReply, statusCode: number, err: any) {
  const message = err.clientMessage || err.message || 'An unexpected error occurred';
  sendSSE(reply, new ApiResponse(statusCode, null, message, buildErrorMeta(statusCode, err)));
}

function sendSSE(reply: FastifyReply, payload: ApiResponse<any>) {
  reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function buildCompletionMeta(fullResponse: string): Record<string, unknown> {
  const contactMatch = fullResponse.match(CONTACT_DETAILS_TAG_REGEX);
  if (!contactMatch) {
    return {};
  }

  return {
    openForm: true,
    contactDetails: {
      email: contactMatch[1].trim(),
      phone: contactMatch[2].trim(),
      whatsapp: contactMatch[3].trim(),
    },
  };
}

function buildErrorMeta(statusCode: number, err: any): Record<string, unknown> {
  const meta = {
    ...(err instanceof ApiError ? err.meta : {}),
  } as Record<string, unknown>;

  if (statusCode === HttpStatusCode.TOO_MANY_REQUESTS) {
    meta.openForm = true;
  }

  return meta;
}
