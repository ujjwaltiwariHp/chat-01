import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { AuthError } from '../utils/api-error.js';
import { logger } from '../logging/logger.js';
import { CoreErrorCode } from '../errors/error-codes.js';
import { AuthMode, AuthResult } from '../types/auth.js';
import { config } from '../config/base-config.js';
import { safeCompare } from '../utils/safe-compare.js';
import { checkAndDeductCredits } from '../utils/credits.js';
import { validateSignedServiceRequest } from './service-request-signing.js';
import { validateGatewayToken } from './gateway-auth.js';
import { validateWidgetToken } from './widget-auth.js';
import { validateStandaloneApiKey } from './standalone-auth.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: any; // Allow services to decorate with their specific DB instance
    redis: any;
    credits: {
      checkAndDeduct: (tenantId: string, cost: number) => Promise<boolean>;
    };
  }
  
  interface FastifyRequest {
    authMode: AuthMode;
    tenantId?: string;
    role?: string; // New: RBAC Role support
    customerId?: string;
    externalId?: string;
    sessionId?: string;
    plainSessionId?: string;
    isNewSession?: boolean;
    plan?: string;
    customer?: any;
    userId?: string;
    user?: any;
  }
}

/**
 * Unified Authentication Hook
 * Dispatches to individual validators based on request headers.
 */
export const authenticateSessionHook = async (request: FastifyRequest, reply?: FastifyReply) => {
  const serviceToken = request.headers['x-service-token'] as string;
  const authHeader = request.headers['authorization'] as string;
  const { GATEWAY_SERVICE_SECRET, WIDGET_SERVICE_SECRET, INTERNAL_SERVICE_TOKEN } = config;

  try {
    let result: AuthResult;

    logger.debug({ 
      ns: 'auth:multi:check', 
      hasServiceToken: !!serviceToken,
      hasAuthHeader: !!authHeader
    }, 'Multi-mode auth check started');

    // High Standard: Support both dedicated gateway secret and dynamic internal token rotation via Redis
    const { redis } = request.server;
    let isInternalService = false;

    if (serviceToken) {
      // Priority 1: Check against dedicated/static secrets
      if (safeCompare(serviceToken, GATEWAY_SERVICE_SECRET) || safeCompare(serviceToken, INTERNAL_SERVICE_TOKEN)) {
        isInternalService = true;
      } 
      // Priority 2: Check against dynamic rotation set in Redis (Zero-Downtime Rotation)
      else if (redis) {
        const isDynamicValid = await redis.sismember('hp:auth:internal_tokens', serviceToken);
        if (isDynamicValid) isInternalService = true;
      }
    }

    if (isInternalService) {
      result = await validateGatewayToken(request);
      result.mode = 'INTERNAL'; // If coming via service token, treat as internal
      if (safeCompare(serviceToken, GATEWAY_SERVICE_SECRET)) {
        await validateSignedServiceRequest({
          request,
          serviceSecret: GATEWAY_SERVICE_SECRET,
          expectedServiceName: 'gateway',
          redis: request.server.redis,
        });
      }
    } else if (serviceToken && safeCompare(serviceToken, WIDGET_SERVICE_SECRET)) {
      result = await validateWidgetToken(request);
      await validateSignedServiceRequest({
        request,
        serviceSecret: WIDGET_SERVICE_SECRET,
        expectedServiceName: 'widget-service',
        redis: request.server.redis,
      });
    } else if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { HP_BIZ_API_KEY } = config;

      // High Standard: Support both simple HP-Biz API Key and full JWT Standalone tokens
      if (HP_BIZ_API_KEY && safeCompare(token, HP_BIZ_API_KEY)) {
         const tenantId = request.headers['x-tenant-id'] as string | undefined;
         if (!tenantId) {
           throw new AuthError('Missing X-Tenant-ID header for HP Biz API access', CoreErrorCode.AUTH_MISSING);
         }

         // Extract optional identity context for session-aware bots (like Chatbot)
         const customerId = request.headers['x-customer-id'] as string || 'biz-api-tester';
         const sessionId = request.headers['x-session-id'] as string;

         result = {
           mode: 'GATEWAY',
           tenantId,
           customerId,
           sessionId
         };
      } else {
        try {
          result = await validateStandaloneApiKey(request);
        } catch (error) {
          // If signature fails, skip and allow downstream hooks (like session-cookie) to attempt validation
          return;
        }
      }
    } else {
      // Graceful fallback for unidentified guest sessions handled by downstream hooks
      return; 
    }

    // Apply resolved context to request object
    request.authMode = result.mode;
    request.tenantId = result.tenantId;
    request.role = result.role; // Apply role to context
    request.customerId = result.customerId;
    request.externalId = result.externalId;
    if (result.sessionId) {
      request.sessionId = result.sessionId;
    }
    
    // Map established identity to standard userId
    if (!request.userId) {
      request.userId = result.externalId || result.customerId;
    }
    
    logger.debug({ 
      ns: 'auth:multi', 
      mode: result.mode, 
      tenantId: result.tenantId,
      userId: request.userId 
    }, 'Identity established');

  } catch (error: any) {
    if (error instanceof AuthError) throw error;
    logger.error({ ns: 'auth:multi', error: error.message }, 'Consolidated auth failure');
    throw new AuthError('Identity verification failed', CoreErrorCode.AUTH_INVALID);
  }
};

const multiModeAuthPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Centralized Credit Management Logic (High-Standard: Call shared util)
  fastify.decorate('credits', {
    checkAndDeduct: async (tenantId: string, cost: number) => {
      // Passes the service's DB instance if available
      return checkAndDeductCredits(fastify.db, tenantId, cost);
    }
  });

  fastify.addHook('onRequest', authenticateSessionHook);
};

export default fp(multiModeAuthPlugin, {
  name: 'hp-multi-mode-auth',
  fastify: '5.x'
});
