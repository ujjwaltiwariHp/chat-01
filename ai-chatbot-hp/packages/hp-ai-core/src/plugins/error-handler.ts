import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { logger } from '../logging/logger.js';
import { HttpStatusCode } from '../utils/http-status.js';
import { ApiError } from '../utils/api-error.js';
import { config } from '../config/base-config.js';

const CHATBOT_INVOKE_PATHS = new Set([
  '/api/v1/chat/invoke',
  '/api/v1/bots/chatbot/invoke',
]);

function shouldOpenFormForRateLimit(request: FastifyRequest, statusCode: number, errorCodeSlug: string): boolean {
  if (statusCode !== HttpStatusCode.TOO_MANY_REQUESTS) {
    return false;
  }

  if (errorCodeSlug !== 'IP_RATE_LIMIT_EXCEEDED' && errorCodeSlug !== 'SESSION_RATE_LIMIT_EXCEEDED') {
    return false;
  }

  const requestPath = String(request.url || '').split('?')[0];
  return CHATBOT_INVOKE_PATHS.has(requestPath);
}

/**
 * Functional Error Handler
 */
export const errorHandler = (error: any, request: FastifyRequest, reply: FastifyReply) => {
  const statusCode = error.statusCode || HttpStatusCode.INTERNAL_SERVER_ERROR;
  const requestId = (request as any).id || 'N/A';

  const apiError = error instanceof ApiError ? error : null;
  const errorCodeSlug = apiError?.errorCodeSlug || 'COMMON_UNKNOWN_ERROR';
  const clientMessage = apiError?.clientMessage || error.message || 'Something went wrong';
  const meta = {
    errorCodeSlug,
    errorCode: apiError?.errorCode,
    severity: apiError?.severity,
    requestId,
    ...(apiError?.meta || {}),
  } as Record<string, unknown>;

  if (shouldOpenFormForRateLimit(request, statusCode, errorCodeSlug)) {
    meta.openForm = true;
  }

  if (config.NODE_ENV !== 'production') {
    meta.stack = error.stack;
  }

  logger.error({
    msg: error.message,
    statusCode,
    errorCodeSlug,
    requestId,
    stack: config.NODE_ENV !== 'production' ? error.stack : undefined,
  });

  reply.status(statusCode).send({
    success: false,
    statusCode,
    message: clientMessage,
    data: null,
    errors: apiError?.errors || [],
    meta,
  });
};

/**
 * Error Handler Plugin (P4-10)
 */
const errorHandlerModule: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.setErrorHandler(errorHandler);
};

export const errorHandlerPlugin = fp(errorHandlerModule);
export default errorHandlerPlugin;
