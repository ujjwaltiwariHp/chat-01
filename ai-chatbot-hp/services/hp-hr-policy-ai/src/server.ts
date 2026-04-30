import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import {
  contentGuardPlugin,
  errorHandlerPlugin,
  healthPlugin,
  logger,
  metricsPlugin,
  multiModeAuthPlugin,
  rateLimiterPlugin,
  redis,
  requestContextPlugin
} from '@hp-intelligence/core';
import { config } from '@/config/index.js';
import { db, pool } from '@/db/connection.js';
import { policyAuthPlugin } from '@/plugins/auth.js';
import v1Routes from '@/routes/v1/index.js';

const fastify = Fastify({
  logger: false,
  trustProxy: true,
  bodyLimit: 1024 * 1024 * 2,
});

const appLogger = logger.child({ ns: 'hr-policy:server' });

fastify.decorate('db', db);
fastify.decorate('redis', redis);
fastify.register(cookie);
fastify.register(errorHandlerPlugin);
fastify.register(requestContextPlugin);
fastify.register(rateLimiterPlugin);

fastify.register(healthPlugin);
fastify.register(metricsPlugin);

fastify.register(async (protectedScope) => {
  protectedScope.register(contentGuardPlugin);
  protectedScope.register(multiModeAuthPlugin);
  protectedScope.register(policyAuthPlugin);
  protectedScope.register(v1Routes, { prefix: '/v1' });
}, { prefix: '/api' });

const start = async () => {
  try {
    const host = '0.0.0.0';
    const port = config.HR_POLICY_PORT;

    await fastify.listen({ port, host });
    appLogger.info({ port, host, msg: 'hp-hr-policy-ai started' });
  } catch (err: any) {
    appLogger.error({
      msg: 'hp-hr-policy-ai startup failed',
      error: err.message,
    });
    process.exit(1);
  }
};

const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    appLogger.info({ signal }, 'Closing server gracefully...');

    try {
      await fastify.close();
      await pool.end();
      appLogger.info('Server closed');
      process.exit(0);
    } catch (err: any) {
      appLogger.error({ err }, 'Error during graceful shutdown');
      process.exit(1);
    }
  });
});

start();
