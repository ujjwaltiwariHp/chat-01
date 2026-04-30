import { FastifyReply, FastifyRequest } from 'fastify';
import { ApiError, ApiResponse, HttpStatusCode } from '@hp-intelligence/core';
import { ingestPolicyDocument } from '@/services/document-ingestion.service.js';
import { PolicyDocumentInput } from '@/types/rag.js';

export const ingestDocumentController = async (request: FastifyRequest, reply: FastifyReply) => {
  const body: Partial<PolicyDocumentInput> = (request.body as PolicyDocumentInput | undefined) ?? {};

  if (!request.tenantId) {
    throw new ApiError('COMMON_AUTH_ERROR', 'Tenant context is required');
  }

  const title = body.title?.trim();
  const content = body.content?.trim();
  const sourceKey = body.sourceKey?.trim();

  if (!title || !content || !sourceKey) {
    throw new ApiError('COMMON_VALIDATION_ERROR', 'title, content, and sourceKey are required');
  }

  const result = await ingestPolicyDocument({
    tenantId: request.tenantId,
    title,
    content,
    sourceKey,
    sourceUrl: body.sourceUrl,
    metadata: body.metadata,
  });

  return reply.status(HttpStatusCode.OK).send(
    new ApiResponse(HttpStatusCode.OK, {
      bot: 'hr-policy',
      ...result,
    }, 'Policy document ingested')
  );
};
