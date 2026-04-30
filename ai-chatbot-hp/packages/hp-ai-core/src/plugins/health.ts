import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { ApiResponse } from '../utils/api-response.js';
import { HttpStatusCode } from '../utils/http-status.js';
import { config } from '../config/base-config.js';

const healthPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * Simple Health Endpoint
   * Returns OK if the server is running.
   */
  fastify.get('/health', async (_request, reply) => {
    const data = {
      status: 'UP',
      uptime: process.uptime(),
      service: config.SERVICE_NAME,
      timestamp: new Date().toISOString(),
    };
    
    return reply.status(HttpStatusCode.OK).send(
      new ApiResponse(HttpStatusCode.OK, data, 'Health check passed')
    );
  });

  /**
   * Readiness Endpoint
   * Checks core infrastructure dependencies.
   */
  fastify.get('/ready', async (_request, reply) => {
    const checks: Record<string, any> = {};
    let isReady = true;

    // 1. Database Check (If prisma or db decorated)
    if (fastify.db || (fastify as any).prisma) {
      try {
        const db = fastify.db || (fastify as any).prisma;
        // Drizzle uses execute, Prisma uses $queryRaw, standard pg uses query
        if (db.execute) {
          await db.execute('SELECT 1');
        } else if (db.$queryRaw) {
          await db.$queryRaw`SELECT 1`;
        } else {
          await db.query('SELECT 1');
        }
        checks.database = 'connected';
      } catch (err) {
        checks.database = 'disconnected';
        isReady = false;
      }
    }

    // 2. Redis Check
    if (fastify.redis) {
      try {
        await fastify.redis.ping();
        checks.redis = 'connected';
      } catch (err) {
        checks.redis = 'disconnected';
        isReady = false;
      }
    }

    const data = {
      status: isReady ? 'ready' : 'degraded',
      checks,
      timestamp: new Date().toISOString()
    };

    const statusCode = isReady ? HttpStatusCode.OK : HttpStatusCode.SERVICE_UNAVAILABLE;
    
    return reply.status(statusCode).send(
      new ApiResponse(statusCode, data, isReady ? 'All systems ready' : 'Service degraded')
    );
  });
};

export default healthPlugin;
