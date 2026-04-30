import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import {
  createSessionCookieAuthHook,
  SessionJwtPayloadSchema,
} from '@hp-intelligence/core';
import { config } from '@/config/index.js';
import { createSession, getSessionTTLMs, validateAndRefreshSession } from '@/services/session.service.js';

export const JwtPayloadSchema = SessionJwtPayloadSchema;

export const policyAuthHook = createSessionCookieAuthHook({
  sessionSecret: config.SESSION_SECRET,
  jwtSecret: config.JWT_SECRET,
  loggerNs: 'hr-policy:auth',
  store: {
    createSession,
    validateAndRefreshSession,
    getSessionTTLMs,
  },
});

const policyAuthModule: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('onRequest', policyAuthHook);
};

export const policyAuthPlugin = fp(policyAuthModule);
export default policyAuthPlugin;
