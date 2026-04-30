import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import fastifyRateLimit from '@fastify/rate-limit';
import { logger } from '../logging/logger.js';
import { ApiError } from '../utils/api-error.js';
import { redis } from '../utils/redis-client.js';

const rlLogger = logger.child({ ns: 'core:rate-limit' });

/**
 * Global IP-based Rate Limiter
 * Protects against L7 DDoS and bulk script attacks.
 */
const rateLimiterModule: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  await fastify.register(fastifyRateLimit, {
    global: true,
    max: 100, // Standard Global Limit
    timeWindow: '1 minute',
    redis, // Reuse our managed ioredis connection
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: (req, context) => {
      return new ApiError('IP_RATE_LIMIT_EXCEEDED', undefined, [], {
        limit: context.max,
        window: context.after,
        ip: req.ip
      });
    }
  });

  rlLogger.info({ msg: 'Global Layer 1 Rate Limiter (IP) registered' }, 'rateLimit.setup');
};

/**
 * Business-Logic Rate Limit Hook
 * Can be reused by specific routes to enforce Tenant/Session/User quotas.
 */
export async function checkBusinessLimit(key: string, limit: number, windowSeconds: number = 60) {
  const now = Date.now();
  const windowStart = now - (windowSeconds * 1000);

  const pipeline = redis.multi();
  pipeline.zremrangebyscore(key, 0, windowStart);
  pipeline.zadd(key, now, `${now}_${Math.random()}`);
  pipeline.zcard(key);
  pipeline.expire(key, windowSeconds * 2);

  const results = await pipeline.exec();
  const currentCount = (results?.[2]?.[1] as number) || 0;

  if (currentCount > limit) {
    rlLogger.warn({ key, currentCount, limit }, 'Business Rate Limit Exceeded');
    throw new ApiError('SESSION_RATE_LIMIT_EXCEEDED', `Quota exceeded (${limit} per min)`);
  }
}

export const rateLimiterPlugin = fp(rateLimiterModule);
export default rateLimiterPlugin;
