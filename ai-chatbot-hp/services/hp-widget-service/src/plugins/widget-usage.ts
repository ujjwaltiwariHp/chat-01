import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import {
  redis,
  ApiError,
  logger,
  checkBusinessLimit,
  widgetConversationCounter,
} from '@hp-intelligence/core';

/**
 * Enforces plan-based rate limits and tracks monthly conversation usage.
 */
export const widgetUsageHook = async (request: FastifyRequest, reply: FastifyReply) => {
  const customer = (request as any).customer;
  if (!customer) return; // Should be handled by security hook

  const { id: customerId, plan, conversationsLimit } = customer;
  const sessionId = request.headers['x-session-id'] as string || 'anonymous';

  // 1. Plan-Based Rate Limiting (P4-03: Layer 2)
  const rpmLimit = plan === 'enterprise' ? 1000 : (plan === 'pro' ? 100 : 20);
  const rlKey = `widget:rl:${customerId}`;

  try {
    await checkBusinessLimit(rlKey, rpmLimit, 60);
  } catch (err: any) {
    logger.warn({ ns: 'usage:rl', customerId, plan }, 'Rate limit exceeded');
    throw err;
  }

  const usageKey = `widget:usage:${customerId}`;
  const sessionsKey = `widget:sessions:${customerId}`;

  try {
    // Check if this is a new session for the current billing cycle
    // We use a Set in Redis to track unique session IDs for the customer
    const isNewSession = await redis.sadd(sessionsKey, sessionId);

    if (isNewSession) {
      // Increment conversation counter
      const currentUsage = await redis.incr(usageKey);

      // Check against PG-backed limit
      if (currentUsage > conversationsLimit) {
        logger.warn({ ns: 'usage:quota', customerId, currentUsage, limit: conversationsLimit }, 'Monthly quota reached');
        throw new ApiError('CONVERSATION_CHAT_LIMIT_EXCEEDED', 'Monthly conversation limit reached for this widget');
      }

      widgetConversationCounter.inc({ plan });
    } else {
      // Just check if we are already over the limit even for existing sessions
      const usageStr = await redis.get(usageKey);
      const currentUsage = usageStr ? parseInt(usageStr, 10) : 0;

      if (currentUsage > conversationsLimit) {
        throw new ApiError('CONVERSATION_CHAT_LIMIT_EXCEEDED', 'Monthly conversation limit reached');
      }
    }
  } catch (err: any) {
    if (err instanceof ApiError) throw err;

    logger.error({ ns: 'usage:fallback', customerId, error: err.message }, 'Redis unreachable, failing over to permissive mode');
    return;
  }
};

/**
 * Fastify Plugin Wrapper for Widget Usage Tracking
 */
const widgetUsageModule: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', widgetUsageHook);
};

export const widgetUsagePlugin = fp(widgetUsageModule);
