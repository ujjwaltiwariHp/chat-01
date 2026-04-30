import { FastifyPluginAsync } from 'fastify';
import { config } from '@/config/index.js';
import { botInvokeController, getInvokeHistory } from '@/controllers/invoke.controller.js';

const invokeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/invoke', {
    schema: {
      description: 'Answer policy questions using RAG, vector search, and SSE responses',
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string', minLength: 1, maxLength: config.POLICY_MAX_MESSAGE_LENGTH },
        }
      }
    }
  }, botInvokeController);

  fastify.post('/chat/invoke', {
    schema: {
      description: 'Gateway-compatible SSE policy chat invoke route',
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string', minLength: 1, maxLength: config.POLICY_MAX_MESSAGE_LENGTH },
        }
      }
    }
  }, botInvokeController);

  fastify.get('/chat/history/:sessionId', {
    schema: {
      description: 'Retrieve stored hr-policy history by plain session ID',
      params: {
        type: 'object',
        required: ['sessionId'],
        properties: {
          sessionId: { type: 'string', minLength: 1 },
        }
      }
    }
  }, getInvokeHistory);
};

export default invokeRoutes;
