import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

/**
 * Service-Specific Input Sanitizer
 */
export const sanitizeInputHook = async (request: FastifyRequest, reply: FastifyReply) => {
  const q = (request.query as any) || (request.body as any);
  if (q.message && typeof q.message === 'string') {
    q.message = q.message.trim().replace(/^["']|["']$/g, '');
  }
};

/**
 * Input Sanitizer Plugin
 */
const inputSanitizerModule: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // MUST run before security guards to ensure clean patterns
  fastify.addHook('preHandler', sanitizeInputHook);
};

export const inputSanitizerPlugin = fp(inputSanitizerModule);
export default inputSanitizerPlugin;
