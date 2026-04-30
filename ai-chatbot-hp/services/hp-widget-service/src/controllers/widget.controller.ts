import { FastifyReply, FastifyRequest } from 'fastify';
import { db } from '../db/connection.js';
import { widgetCustomers } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { ApiResponse, HttpStatusCode, logger, ApiError } from '@hp-intelligence/core';
import { config as serviceConfig } from '../config.js';
import { buildWidgetChatProxyRequest } from '@/lib/chatbot-proxy.js';

/**
 * Handles the main widget chat proxy requests.
 * Proxies to Chatbot AI while maintaining the SSE stream.
 */
export const widgetChatController = async (request: FastifyRequest, reply: FastifyReply) => {
  const customerId = request.customerId;
  const tenantId = request.tenantId;

  if (!customerId || !tenantId) {
    throw new ApiError('COMMON_AUTH_ERROR', 'Verified Customer Identity is required for widget chat proxy');
  }

  logger.info({ ns: 'widget:proxy', customerId, tenantId }, 'Proxying verified chat request to AI engine');
  
  // Step 1: Centralized Credit Deduction (P7)
  // We use the tenantId extracted by widgetSecurityHook
  const COST_PER_CHAT = 1;
  await request.server.credits.checkAndDeduct(tenantId, COST_PER_CHAT);

  try {
    const proxyRequest = buildWidgetChatProxyRequest({
      chatbotServiceUrl: serviceConfig.CHATBOT_SERVICE_URL,
      widgetServiceSecret: serviceConfig.WIDGET_SERVICE_SECRET,
      customerId,
      tenantId,
      requestId: request.id,
      sessionId: request.headers['x-session-id'] as string | undefined,
      authorization: request.headers.authorization || undefined,
    });

    const aiResponse = await fetch(proxyRequest.url, {
      method: 'POST',
      headers: proxyRequest.headers,
      body: JSON.stringify(request.body)
    });

    if (!aiResponse.ok) {
      const errorData = await aiResponse.json().catch(() => ({}));
      return reply.status(aiResponse.status).send(errorData);
    }

    // Set SSE headers for streaming through
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');

    // Pipeline the stream directly (for Node 18+ fetch)
    const reader = aiResponse.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get readable stream from AI service');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      reply.raw.write(value);
    }

    reply.raw.end();
  } catch (error: any) {
    logger.error({ ns: 'widget:proxy:error', error: error.message }, 'Failed to proxy request');
    throw new ApiError('COMMON_INTERNAL_ERROR', 'The chat service is temporarily unavailable');
  }
};

/**
 * Returns the widget configuration for a specific customer.
 */
export const widgetConfigController = async (request: FastifyRequest, reply: FastifyReply) => {
  // Rely on verified customer identity from security middleware
  const customerId = request.customerId;

  if (!customerId) {
    throw new ApiError('COMMON_VALIDATION_ERROR', 'Verified customer identity is required');
  }

  const [customer] = await db
    .select()
    .from(widgetCustomers)
    .where(eq(widgetCustomers.id, customerId))
    .limit(1);

  if (!customer) {
    throw new ApiError('CUSTOMER_NOT_FOUND', 'Widget configuration could not be found');
  }

  if (!customer.enabled) {
    throw new ApiError('CUSTOMER_DISABLED', 'Widget is currently disabled for this customer');
  }

  return new ApiResponse(HttpStatusCode.OK, {
    config: customer.widgetConfig,
    tenantId: customer.id, // Assuming tenantId maps to customer ID in simple case
    id: customer.id
  }, 'Widget configuration retrieved');
};
