import { FastifyReply } from 'fastify';
import { AuthError, ApiError, logger, config, HttpStatusCode } from '@hp-intelligence/core';
import { buildGatewayBotProxyRequest } from '@/lib/chatbot-proxy.js';

/**
 * Handles the gateway bot invocation proxy logic.
 */
export const botInvokeController = async (request: any, reply: FastifyReply) => {
  const { botName } = request.params;
  const fastify = request.server;
  const bot = fastify.botRegistry.getBot(botName);

  if (!bot) {
    throw new AuthError(`Bot '${botName}' not found in registry`, 'GATEWAY_AUTH_003');
  }

  // Step 1: Strict Identity Verification
  // We require that multi-mode-auth (or dashboardSession) has already verified this request.
  if (!request.tenantId || !request.authMode) {
    throw new AuthError('Access denied: Authentication context is required', 'GATEWAY_AUTH_REQUIRED');
  }

  // Step 2: Check & Deduct Credits
  // Some bots meter exact token usage inside the target service to avoid flat-charge mismatch.
  if (bot.billingMode !== 'service-metered') {
    await fastify.credits.checkAndDeduct(request.tenantId, bot.costPerInvoke);
  }

  // Step 3: Proxy to Bot Service
  const { GATEWAY_SERVICE_SECRET } = config;
  
  logger.info({
    msg: `Forwarding request to bot: ${botName}`,
    botBaseUrl: bot.baseUrl,
    tenantId: request.tenantId,
    botName
  });

  try {
    const proxyRequest = buildGatewayBotProxyRequest({
      botBaseUrl: bot.baseUrl,
      path: bot.invokePath,
      gatewayServiceSecret: GATEWAY_SERVICE_SECRET || '',
      tenantId: request.tenantId,
      requestId: request.id,
      sessionId: request.headers['x-session-id'] as string | undefined,
      customerId: request.customerId,
      // High-Standard: Pass forwarding headers so Chatbot sets the correct cookie flags
      forwardedProto: request.protocol as string,
      forwardedHost: request.hostname as string,
      forwardedCookie: request.headers['cookie'],
    });

    logger.debug({ 
      ns: 'gateway:proxy', 
      url: proxyRequest.url, 
      hasServiceToken: !!proxyRequest.headers['X-Service-Token'],
      tenantId: proxyRequest.headers['X-Tenant-ID'] 
    }, 'Gateway Proxy request built');

    const response = await fetch(proxyRequest.url, {
      method: 'POST',
      headers: proxyRequest.headers,
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(60_000), // Increased to 60s for streaming AI responses
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      reply.status(response.status).send(errorData);
      return;
    }

    // Force CORS headers at the raw level to ensure they are sent before streaming starts
    const origin = request.headers.origin || '*';
    reply.raw.setHeader('Access-Control-Allow-Origin', origin);
    reply.raw.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    reply.raw.setHeader('Access-Control-Allow-Headers', '*');
    reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
    reply.raw.setHeader('Access-Control-Allow-Private-Network', 'true');
    reply.raw.setHeader('Access-Control-Expose-Headers', 'X-Session-ID, X-Request-ID, Content-Type');
    reply.raw.setHeader('Vary', 'Origin');

    // High-Standard: Proxy ALL Session Cookies back to the client
    let setCookies: string[] | string | null = null;
    if (typeof (response.headers as any).getSetCookie === 'function') {
      setCookies = (response.headers as any).getSetCookie();
    } else {
      setCookies = response.headers.get('set-cookie');
    }

    if (setCookies) {
      reply.header('Set-Cookie', setCookies);
    }

    const sessionIdInternal = response.headers.get('x-session-id');
    if (sessionIdInternal) {
      reply.header('X-Session-ID', sessionIdInternal);
    }

    const contentType = response.headers.get('content-type') || 'application/json';
    reply.header('Content-Type', contentType);
    
    if (contentType.includes('text/event-stream')) {
      reply.header('Cache-Control', 'no-cache');
      reply.header('Connection', 'keep-alive');
      reply.header('X-Accel-Buffering', 'no');
    }

    // High-Standard: Use Fastify's native stream support to ensure CORS/Security headers from hooks are preserved
    if (!response.body) {
      throw new Error(`Bot service returned empty body: ${botName}`);
    }

    return reply.send(response.body);
  } catch (error: any) {
    logger.error({
      msg: `Failed to proxy request to bot: ${botName}`,
      error: error.message
    });
    throw new ApiError('GATEWAY_AUTH_004', `Bot service unavailable: ${botName}`);
  }
};

/**
 * Handles the gateway bot history proxy logic.
 */
export const botHistoryController = async (request: any, reply: FastifyReply) => {
  const { botName, sessionId } = request.params;
  const fastify = request.server;
  const bot = fastify.botRegistry.getBot(botName);

  if (!bot) {
    throw new AuthError(`Bot '${botName}' not found in registry`, 'GATEWAY_AUTH_003');
  }

  if (!request.tenantId || !request.authMode) {
    throw new AuthError('Access denied: Authentication context is required', 'GATEWAY_AUTH_REQUIRED');
  }

  const { GATEWAY_SERVICE_SECRET } = config;
  const queryStr = request.url.split('?')[1] || '';
  const historyPath = `/api/v1/chat/history/${sessionId}${queryStr ? '?' + queryStr : ''}`;

  try {
    const proxyRequest = buildGatewayBotProxyRequest({
      botBaseUrl: bot.baseUrl,
      path: historyPath,
      gatewayServiceSecret: GATEWAY_SERVICE_SECRET || '',
      tenantId: request.tenantId,
      requestId: request.id,
      sessionId,
      customerId: request.customerId,
      forwardedProto: request.protocol as string,
      forwardedHost: request.hostname as string,
      forwardedCookie: request.headers['cookie'],
      method: 'GET',
    });

    const response = await fetch(proxyRequest.url, {
      method: 'GET',
      headers: proxyRequest.headers,
    });

    const data = await response.json().catch(() => ({}));

    // If the bot returns a 404/Error, we forward it
    if (!response.ok) {
       return reply.status(response.status).send(data);
    }

    return reply.status(HttpStatusCode.OK).send(data);
  } catch (error: any) {
    logger.error({
      msg: `Failed to fetch history from bot: ${botName}`,
      error: error.message
    });
    throw new ApiError('GATEWAY_AUTH_004', `Bot history service unavailable: ${botName}`);
  }
};
