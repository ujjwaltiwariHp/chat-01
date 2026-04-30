import Fastify from 'fastify';
import { 
  errorHandlerPlugin, 
  logger, 
  healthPlugin, 
  metricsPlugin, 
  requestContextPlugin,
  rateLimiterPlugin,
  multiModeAuthPlugin,
  redis
} from '@hp-intelligence/core';
import { db } from '@/db/connection.js';
import { config } from '@/config.js';
import { dashboardSessionPlugin } from '@/plugins/session.js';
import { registryPlugin } from '@/plugins/registry.js';
import { gatewayCorsPlugin } from '@/plugins/cors.js';
import botRouter from '@/routes/v1/bot-router.js';
import authRoutes from '@/routes/v1/auth.route.js';
import dashboardRoutes from '@/routes/v1/dashboard.route.js';
import slackRelayRoutes from '@/routes/slack.route.js';
import cookie from '@fastify/cookie';

const fastify = Fastify({
  logger: false,
  trustProxy: true,
  bodyLimit: 1024 * 100, // 100KB limit for relay payloads
});

// 1. GLOBAL Middlewares
fastify.decorate('redis', redis);
fastify.decorate('db', db);
fastify.register(gatewayCorsPlugin);
fastify.register(requestContextPlugin);
fastify.register(errorHandlerPlugin);
fastify.register(rateLimiterPlugin);
fastify.register(cookie);

// 2. PUBLIC Routes (Auth)
fastify.register(authRoutes, { prefix: '/api/v1/auth' });
fastify.register(slackRelayRoutes, { prefix: '/api/slack' });

// 2. MONITORING
fastify.register(healthPlugin);
fastify.register(metricsPlugin);

// 3. SECURE Vault
fastify.register(async (protectedScope) => {
  // Dashboard Session Verification
  protectedScope.register(dashboardSessionPlugin);

  // Dashboard APIs rely on session cookies rather than bearer tokens.
  protectedScope.register(dashboardRoutes, { prefix: '/v1/dashboard' });

  // Common identity & validation (P7 Centralized)
  protectedScope.register(multiModeAuthPlugin);
  protectedScope.register(registryPlugin);

  // Register the Bot Router
  protectedScope.register(botRouter, { prefix: '/v1' });
}, { prefix: '/api' });

const start = async () => {
  try {
    const port = config.PORT;
    const host = '0.0.0.0';

    await fastify.listen({ port, host });
    logger.info(`HP-Intelligence-Gateway listening on ${host}:${port}`);
  } catch (err: any) {
    logger.error({
      msg: 'Gateway startup failed',
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
