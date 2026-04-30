import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ApiError, ApiResponse, HttpStatusCode } from '@hp-intelligence/core';
import { dashboardService } from '@/services/dashboard.service.js';

const widgetConfigSchema = z.object({
  primaryColor: z.string().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/, 'primaryColor must be a valid hex color').optional(),
  position: z.enum(['bottom-right', 'bottom-left']).optional(),
  avatarUrl: z.union([
    z.string().url(),
    z.literal(''),
    z.null(),
  ]).optional(),
  chatTitle: z.string().trim().min(1).max(80).optional(),
  greeting: z.string().trim().min(1).max(500).optional(),
  placeholderText: z.string().trim().min(1).max(120).optional(),
  autoOpenDelay: z.coerce.number().int().min(0).max(60000).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one widget configuration field must be provided',
});

const rotateApiKeySchema = z.object({
  confirm: z.boolean().refine((value) => value === true, {
    message: 'API key rotation requires explicit confirmation',
  }),
});

const getSessionEmail = (request: FastifyRequest): string => {
  const email = request.user?.email;

  if (!email || typeof email !== 'string') {
    throw new ApiError('AUTH_INVALID', 'Session is missing the dashboard user email');
  }

  return email;
};

export default async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.get('/usage', async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await dashboardService.getUsage(getSessionEmail(request));

    return reply.status(HttpStatusCode.OK).send(
      new ApiResponse(HttpStatusCode.OK, data, 'Dashboard usage loaded'),
    );
  });

  fastify.put('/config', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = widgetConfigSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new ApiError(
        'COMMON_VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Invalid widget configuration payload',
        parsed.error.issues,
      );
    }

    const data = await dashboardService.updateConfig(getSessionEmail(request), parsed.data);

    return reply.status(HttpStatusCode.OK).send(
      new ApiResponse(HttpStatusCode.OK, data, 'Widget configuration updated'),
    );
  });

  fastify.post('/api-key', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = rotateApiKeySchema.safeParse(request.body);

    if (!parsed.success) {
      throw new ApiError(
        'COMMON_VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Confirmation is required to rotate the API key',
        parsed.error.issues,
      );
    }

    const data = await dashboardService.rotateApiKey(getSessionEmail(request));

    return reply.status(HttpStatusCode.OK).send(
      new ApiResponse(HttpStatusCode.OK, data, 'Widget API key rotated'),
    );
  });
}
