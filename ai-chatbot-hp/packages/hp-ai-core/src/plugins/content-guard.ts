import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { ApiError } from '../utils/api-error.js';
import { INJECTION_PATTERNS, THREAT_PATTERNS } from '../utils/regex.js';
import { logger } from '../logging/logger.js';

const SAFE_CONVERSATIONAL_INVOKE_PATHS = new Set([
  '/api/v1/invoke',
  '/api/v1/chat/invoke',
  '/api/v1/bots/chatbot/invoke',
  '/api/v1/bots/hr-policy/invoke',
  '/api/v1/widget/chat',
]);

function shouldAllowPromptLevelThreatHandling(request: FastifyRequest): boolean {
  if ((request.method || '').toUpperCase() !== 'POST') {
    return false;
  }

  const requestPath = String(request.url || '').split('?')[0];
  return SAFE_CONVERSATIONAL_INVOKE_PATHS.has(requestPath);
}

/**
 * Global Security Hook (Core)
 * Protects services from common AI-related threats / injection.
 */
export const coreSecurityGuardHook = async (request: FastifyRequest, reply: FastifyReply) => {
  const body = request.body as any;
  const message = ((request.query as any).message || body?.message || body?.payload || '') as string;
  if (!message) return;

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(message)) {
      const truncated = message.substring(0, 20) + (message.length > 20 ? '...' : '');
      logger.warn({ ns: 'security:injection', message: truncated }, 'Prompt injection attempt detected');
      throw new ApiError('PROMPT_INJECTION_DETECTED', 'Security validation failed');
    }
  }

  for (const pattern of THREAT_PATTERNS) {
    if (pattern.test(message)) {
      const truncated = message.substring(0, 20) + (message.length > 20 ? '...' : '');
      logger.warn({ ns: 'security:threat', message: truncated }, 'Harmful content detected');
      if (shouldAllowPromptLevelThreatHandling(request)) {
        return;
      }
      throw new ApiError('THREAT_DETECTED', 'Message violates security policy');
    }
  }
};

/**
 * Content Guard Plugin
 */
const contentGuardModule: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', coreSecurityGuardHook);
};

export const contentGuardPlugin = fp(contentGuardModule);
export default contentGuardPlugin;
