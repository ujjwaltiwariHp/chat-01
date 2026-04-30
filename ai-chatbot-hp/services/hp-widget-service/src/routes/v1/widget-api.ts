import { FastifyInstance } from 'fastify';
import { widgetChatController, widgetConfigController } from '@/controllers/widget.controller.js';
import { widgetSecurityHook } from '@/plugins/widget-security.js';
import { widgetUsageHook } from '@/plugins/widget-usage.js';

export default async function widgetRoutes(fastify: FastifyInstance) {
  // Widget Chat Endpoint
  fastify.post('/widget/chat', widgetChatController);

  // Widget Configuration Endpoint (Public for first-time fetching)
  fastify.get('/widget/config', widgetConfigController);
}
