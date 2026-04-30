import { initOTEL } from '@/utils/otel.js';
initOTEL();

import Fastify from 'fastify';
import { 
  errorHandlerPlugin,
  healthPlugin,
  metricsPlugin,
  redis,
  requestContextPlugin,
  rateLimiterPlugin,
} from '@hp-intelligence/core';
import { config } from '@/config.js';
import { db } from '@/db/connection.js';
import { createLeadLogger } from '@/logging/logger.js';
import { leadAuthPlugin } from '@/plugins/lead-auth.js';
import { rlsSessionPlugin } from '@/plugins/rls-session.js';
import swaggerPlugin from '@/plugins/swagger.js';
import routes from '@/routes/v1/index.js';
import { leadIntelligenceService } from '@/services/lead-intelligence.service.js';
import { startLeadIntelligenceWorkers, stopLeadIntelligenceWorkers } from '@/services/lead-intelligence-queue.service.js';
import { apiErrorsCounter } from '@/utils/metrics.js';

const appLogger = createLeadLogger('server');

const fastify = Fastify({
  logger: false,
  trustProxy: true,
  disableRequestLogging: true,
  bodyLimit: 1024 * 1024,
});

// Setup Phase
fastify.decorate('redis', redis);
fastify.decorate('db', db);
fastify.register(errorHandlerPlugin);
fastify.register(requestContextPlugin);
fastify.register(rateLimiterPlugin);

// 1. MONITORING
fastify.register(healthPlugin);
fastify.register(metricsPlugin);
fastify.register(swaggerPlugin);

fastify.addHook('onError', async (_request, reply, error) => {
  const code = (error as any).errorCodeSlug || (error as any).code || 'INTERNAL_SERVER_ERROR';
  apiErrorsCounter.inc({ code });
});

fastify.addHook('onSend', async (request, reply, payload) => {
  if (request.url.startsWith('/api')) {
    reply.header('X-API-Version', config.LEAD_API_VERSION);

    if (config.LEAD_API_SUNSET_AT) {
      const sunsetAt = new Date(config.LEAD_API_SUNSET_AT);
      if (!Number.isNaN(sunsetAt.getTime())) {
        reply.header('Deprecation', 'true');
        reply.header('Sunset', sunsetAt.toUTCString());
      }
    }
  }

  return payload;
});

// 2. SECURE Vault
fastify.register(async (protectedScope) => {
  protectedScope.register(leadAuthPlugin);
  protectedScope.register(rlsSessionPlugin);
  protectedScope.register(routes, { prefix: '/v1' });
}, { prefix: '/api' });

const start = async () => {
  try {
    await startLeadIntelligenceWorkers(leadIntelligenceService);
    const port = config.CATEGORIZER_PORT;
    const host = '0.0.0.0';

    await fastify.listen({ port, host });
    appLogger.info({ port, host }, 'Lead Intelligence server started');
  } catch (err: any) {
    appLogger.fatal({ err }, 'Lead Intelligence startup failed');
    process.exit(1);
  }
};

const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    appLogger.info({ signal }, 'Closing server gracefully');
    try {
      await stopLeadIntelligenceWorkers();
      await fastify.close();
      appLogger.info('Server closed');
      process.exit(0);
    } catch (err: any) {
      appLogger.error({ err }, 'Error during graceful shutdown');
      process.exit(1);
    }
  });
});

start();
