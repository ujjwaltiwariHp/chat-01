import { FastifyPluginAsync } from 'fastify';
import { ingestDocumentController } from '@/controllers/documents.controller.js';

const documentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/documents/ingest', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute',
      },
    },
    schema: {
      description: 'Ingest a policy document and generate vector embeddings for retrieval',
      body: {
        type: 'object',
        required: ['sourceKey', 'title', 'content'],
        properties: {
          sourceKey: { type: 'string', minLength: 1 },
          title: { type: 'string', minLength: 1 },
          content: { type: 'string', minLength: 1 },
          sourceUrl: { type: 'string' },
          metadata: { type: 'object', additionalProperties: true },
        }
      }
    }
  }, ingestDocumentController);
};

export default documentRoutes;
