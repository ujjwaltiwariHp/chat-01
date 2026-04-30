import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { botInvokeController, botHistoryController } from '@/controllers/bot.controller.js';

const botRouter: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.post('/bots/:botName/invoke', botInvokeController);
  fastify.get('/bots/:botName/history/:sessionId', botHistoryController);
};

export default botRouter;
