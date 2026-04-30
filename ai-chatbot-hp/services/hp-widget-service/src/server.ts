import Fastify from 'fastify';
import { 
  logger, 
  healthPlugin, 
  metricsPlugin, 
  errorHandlerPlugin, 
  requestContextPlugin,
  multiModeAuthPlugin,
  rateLimiterPlugin,
  contentGuardPlugin,
  redis
} from '@hp-intelligence/core';
import { db } from '@/db/connection.js';
import { config } from '@/config.js';
import widgetRoutes from '@/routes/v1/widget-api.js';
import { startUsageJobs, stopUsageJobs } from '@/jobs/usage-sync.job.js';

import { widgetSecurityPlugin } from '@/plugins/widget-security.js';
import { widgetUsagePlugin } from '@/plugins/widget-usage.js';

const fastify = Fastify({
  logger: false,
  trustProxy: true,
  bodyLimit: 1024 * 100, // 100KB limit for widget payloads
});

// Setup Phase
fastify.decorate('db', db);
fastify.decorate('redis', redis);
fastify.register(errorHandlerPlugin);
fastify.register(requestContextPlugin);
fastify.register(rateLimiterPlugin);

// 1. MONITORING
fastify.register(healthPlugin);
fastify.register(metricsPlugin);

// 2. SECURE Vault
fastify.register(async (protectedScope) => {
  // Global AI Protection (Hardened P4)
  protectedScope.register(contentGuardPlugin);

  // Local Widget Business Logic
  protectedScope.register(multiModeAuthPlugin); // Provides centralized credits and multi-mode identity
  protectedScope.register(widgetSecurityPlugin);
  protectedScope.register(widgetUsagePlugin);
  
  protectedScope.register(widgetRoutes, { prefix: '/v1' });
}, { prefix: '/api' });

const start = async () => {
  try {
    const port = config.WIDGET_PORT;
    const host = '0.0.0.0';

    startUsageJobs();

    await fastify.listen({ port, host });
    logger.info(`HP-Widget-Service started on port: ${port}`);
  } catch (err: any) {
    logger.error({
      msg: 'Widget-Service startup failed',
      error: err.message
    });
    process.exit(1);
  }
};

const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    logger.info({ signal }, 'Closing server gracefully...');
    try {
      stopUsageJobs();
      await fastify.close();
      logger.info('Server closed');
      process.exit(0);
    } catch (err: any) {
      logger.error({ err }, 'Error during graceful shutdown');
      process.exit(1);
    }
  });
});

start();
