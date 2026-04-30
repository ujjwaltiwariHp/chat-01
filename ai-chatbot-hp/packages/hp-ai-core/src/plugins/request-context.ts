import { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { randomUUID } from 'crypto';

declare module 'fastify' {
  interface FastifyRequest {
    id: string; // Standardized X-Request-ID
    tenantId?: string;
    customerId?: string;
    userId?: string;
    user?: any; // Generic user object for auth context
  }
}

/**
 * Request ID & Context Middleware
 * Standardizes X-Request-ID across all services for seamless tracing.
 */
const requestContextModule: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Use Fastify's native requestId generation but ensure header detection
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    // 1. Identify or Generate Request ID
    const requestId = (request.headers['x-request-id'] as string) || (request.headers['request-id'] as string) || randomUUID();
    
    // 2. Standardize request.id (Fastify sets this automatically but we force ours if found in headers)
    request.id = requestId;
    
    // Note: authenticated identity context is attached by downstream auth plugins.
    // We intentionally avoid trusting tenant/customer headers before verification.

    // Note: Fastify's default logger (request.log) will already contain this ID 
    // if configured via requestIdLogLabel in the main Fastify instance.
  });

  // Attach the ID to response headers for client-side tracking
  fastify.addHook('onSend', async (request, reply, payload) => {
    reply.header('X-Request-Id', request.id);

    const exposedHeaders = new Set(
      String(reply.getHeader('Access-Control-Expose-Headers') || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    );

    exposedHeaders.add('X-Request-Id');
    exposedHeaders.add('X-Session-ID');

    reply.header('Access-Control-Expose-Headers', Array.from(exposedHeaders).join(', '));
    return payload;
  });
};

export const requestContextPlugin = fp(requestContextModule);
export default requestContextPlugin;
