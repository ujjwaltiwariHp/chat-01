import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { CRISIS_PATTERNS, logger } from '@hp-intelligence/core';

/**
 * Chatbot-Specific Crisis Monitoring (Core Plugin)
 * Triggers specialized empathetic responses and sets crisis-state.
 */
export const crisisGuardHook = async (request: FastifyRequest, reply: FastifyReply) => {
  const message = (request.query as any).message || (request.body as any)?.message as string;
  if (!message) return;

  // Monitor for self-harm or immediate crisis that requires redirection to authorities
  for (const pattern of CRISIS_PATTERNS) {
    if (pattern.test(message)) {
      logger.info({ ns: 'guard:crisis', message }, 'Crisis content detected, triggering specialized response');
      (request as any).isCrisis = true;
      (request as any).crisisResponse = "I'm not equipped to handle such topics. Please reach out to professional authorities or a crisis helpline immediately.";
      break;
    }
  }
};

/**
 * Crisis Guard Plugin
 */
const crisisGuardModule: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // CRISIS guarding must be near the head of the preHandler chain
  fastify.addHook('preHandler', crisisGuardHook);
};

export const crisisGuardPlugin = fp(crisisGuardModule);
export default crisisGuardPlugin;
