import { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { ApiError, logger } from '@hp-intelligence/core';

declare module 'fastify' {
  interface FastifyRequest {
    user?: any;
    userId?: string;
    tenantId?: string;
  }
}


const dashboardSessionModule: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    // Only apply to /api/v1/dashboard paths
    if (!request.url.startsWith('/api/v1/dashboard/')) {
        return;
    }

    const token = request.cookies.hp_jwt;

    if (!token) {
        throw new ApiError('AUTH_MISSING', 'Session required. Please log in.');
    }

    try {
        const decoded = jwt.verify(token, config.JWT_SECRET) as any;
        request.user = decoded;
        request.userId = decoded.id;
        request.tenantId = decoded.tid;
    } catch (err: any) {
        logger.warn({ ns: 'auth:session', error: err.message }, 'Invalid dashboard session');
        throw new ApiError('AUTH_INVALID', 'Session expired or invalid. Please log in again.');
    }
  });
};

export const dashboardSessionPlugin = fp(dashboardSessionModule);
export default dashboardSessionPlugin;
