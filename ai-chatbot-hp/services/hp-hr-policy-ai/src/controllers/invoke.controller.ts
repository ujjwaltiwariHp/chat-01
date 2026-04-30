import { FastifyReply, FastifyRequest } from 'fastify';
import {
  ApiError,
  ApiResponse,
  encrypt,
  hashSessionId,
  HttpStatusCode,
  logger,
} from '@hp-intelligence/core';
import { config } from '@/config/index.js';
import { PROMPT_VERSION } from '@/prompts/system.v1.js';
import { answerPolicyQuestion } from '@/services/policy-chat.service.js';
import { conversationService } from '@/services/conversation.service.js';
import { getConversationScopeSignature, normalizeConversationScope } from '@/services/conversation-scope.js';

const controllerLogger = logger.child({ ns: 'hr-policy:invoke' });

export const botInvokeController = async (request: FastifyRequest, reply: FastifyReply) => {
  const payload = (request.body as { message?: string } | undefined) ?? {};
  const message = payload.message?.trim();

  if (!message) {
    throw new ApiError('COMMON_VALIDATION_ERROR', 'Message is required');
  }

  if (message.length > config.POLICY_MAX_MESSAGE_LENGTH) {
    throw new ApiError(
      'COMMON_VALIDATION_ERROR',
      `Message exceeds maximum length of ${config.POLICY_MAX_MESSAGE_LENGTH} characters`,
    );
  }

  if (!request.tenantId) {
    throw new ApiError('COMMON_AUTH_ERROR', 'Tenant context is required');
  }

  const sessionId = request.sessionId;
  const tenantId = request.tenantId;
  const userId = request.userId || 'anonymous';
  const customerId = request.customerId || undefined;
  const authMode = request.authMode;
  const source = authMode?.toLowerCase() || 'standalone';

  if (!tenantId || !sessionId) {
    controllerLogger.warn({
      requestId: request.id,
      hasTenant: !!tenantId,
      hasSession: !!sessionId,
    }, 'Policy invocation denied due to incomplete identity context');
    throw new ApiError('COMMON_AUTH_ERROR', 'Access denied: Identity context could not be established');
  }

  const conversationScope = normalizeConversationScope({
    sessionId,
    tenantId,
    source,
    customerId,
    userId,
  });

  let conversation = await conversationService.getConversation(conversationScope);
  if (!conversation) {
    conversation = await conversationService.createConversation(conversationScope);
  }

  const conversationId = conversation.id;
  const abortController = new AbortController();

  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.setHeader('X-Accel-Buffering', 'no');
  if (request.plainSessionId) {
    reply.raw.setHeader('X-Session-ID', request.plainSessionId);
  }

  controllerLogger.info({
    msg: 'Policy question received',
    requestId: request.id,
    tenantId,
    conversationId,
    scope: getConversationScopeSignature(conversationScope),
  });

  const startTime = Date.now();
  let clientClosed = false;
  request.raw.on('close', () => {
    clientClosed = true;
    abortController.abort();
  });

  try {
    const history = await conversationService.getChatHistory(conversationId, config.POLICY_HISTORY_LIMIT);
    const result = await answerPolicyQuestion({
      requestId: request.id,
      tenantId,
      message,
      history,
      signal: abortController.signal,
    });

    sendSSE(reply, new ApiResponse(HttpStatusCode.OK, {
      type: 'start',
      bot: 'hr-policy',
      conversationId,
      sessionId: request.plainSessionId,
    }, 'Stream Started'));

    for await (const chunk of simulateStreaming(result.answer)) {
      if (clientClosed || chunk.done) {
        break;
      }

      reply.raw.write(`data: ${JSON.stringify({ type: 'content', content: chunk.content })}\n\n`);
    }

    if (!clientClosed) {
      reply.raw.write(`data: ${JSON.stringify({
        type: 'done',
        citations: result.citations,
        retrievedChunks: result.matches,
        usage: result.usage,
      })}\n\n`);
    }

    const latencyMs = Date.now() - startTime;
    await Promise.all([
      conversationService.saveMessage({
        conversationId,
        role: 'user',
        content: encrypt(message),
        createdAt: new Date(Date.now() - 1),
      }),
      conversationService.saveMessage({
        conversationId,
        role: 'assistant',
        content: encrypt(result.answer),
        status: clientClosed ? 'stopped' : 'completed',
        createdAt: new Date(),
      }),
      conversationService.saveRequestLog({
        conversationId,
        model: config.RAG_CHAT_MODEL || config.OPENAI_MODEL,
        promptVersion: PROMPT_VERSION,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        latencyMs,
      }),
    ]);

    controllerLogger.info({
      msg: 'Policy response generated',
      requestId: request.id,
      conversationId,
      tenantId,
      matchedChunks: result.matches.length,
      retrievalQuery: result.retrievalQuery,
      latencyMs,
    });
  } catch (error: any) {
    if (!abortController.signal.aborted) {
      const statusCode = error.statusCode || HttpStatusCode.INTERNAL_SERVER_ERROR;
      sendSSE(reply, new ApiResponse(statusCode, null, error.clientMessage || error.message || 'Unexpected policy service error'));
    }
  } finally {
    reply.raw.end();
  }
};

export const getInvokeHistory = async (request: FastifyRequest, reply: FastifyReply) => {
  const { sessionId: plainSessionId } = request.params as { sessionId: string };
  const tenantId = request.tenantId;
  const userId = request.userId || 'anonymous';
  const customerId = request.customerId || undefined;
  const source = request.authMode?.toLowerCase() || 'standalone';

  if (!tenantId) {
    throw new ApiError('COMMON_AUTH_ERROR', 'Tenant context is required for history lookup');
  }

  const conversation = await conversationService.getConversation({
    sessionId: hashSessionId(plainSessionId),
    tenantId,
    source,
    customerId,
    userId,
  });

  if (!conversation) {
    return reply.status(HttpStatusCode.OK).send(
      new ApiResponse(HttpStatusCode.OK, { messages: [] }, 'No session found for provided ID')
    );
  }

  const history = await conversationService.getStoredMessages(conversation.id, 20);
  return reply.status(HttpStatusCode.OK).send(
    new ApiResponse(HttpStatusCode.OK, { messages: history }, 'History retrieved')
  );
};

async function* simulateStreaming(content: string): AsyncGenerator<{ content: string; done: boolean }> {
  const chunks = content.split(' ');
  for (const chunk of chunks) {
    yield { content: `${chunk} `, done: false };
  }
  yield { content: '', done: true };
}

function sendSSE(reply: FastifyReply, payload: ApiResponse<any>) {
  reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
}
