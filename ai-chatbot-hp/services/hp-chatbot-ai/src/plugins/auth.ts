import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import {
  createSessionCookieAuthHook,
  SessionJwtPayloadSchema,
  SessionJwtUserPayload,
} from '@hp-intelligence/core';
import { config } from '@config/index.js';
import { createSession, validateAndRefreshSession, getSessionTTLMs } from '@services/session.service.js';

export const JwtPayloadSchema = SessionJwtPayloadSchema;
export type JwtUserPayload = SessionJwtUserPayload;

export const chatbotAuthHook = createSessionCookieAuthHook({
  sessionSecret: config.SESSION_SECRET,
  jwtSecret: config.JWT_SECRET,
  loggerNs: 'auth:chatbot',
  store: {
    createSession,
    validateAndRefreshSession,
    getSessionTTLMs,
  },
});

/**
 * Plugin Registry
 */
const chatbotAuthModule: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('onRequest', chatbotAuthHook);
};

export const chatbotAuthPlugin = fp(chatbotAuthModule);
export default chatbotAuthPlugin;
