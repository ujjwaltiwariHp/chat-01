import { FastifyInstance } from 'fastify';
import { invokeController, getInvokeHistory } from '@controllers/invoke.controller.js';

export default async function invokeRoutes(fastify: FastifyInstance) {
  fastify.post('/invoke', {
    schema: {
      description: 'Stream AI chat response (SSE)',
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string', minLength: 1 },
          conversationId: { type: 'string' }
        }
      }
    }
  }, invokeController);

  fastify.get('/history/:sessionId', {
    schema: {
      description: 'Retrieve conversation history by session ID',
      params: {
        type: 'object',
        required: ['sessionId'],
        properties: {
          sessionId: { type: 'string' }
        }
      }
    }
  }, getInvokeHistory);
}
