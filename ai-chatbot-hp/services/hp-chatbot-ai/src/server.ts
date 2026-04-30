import Fastify from 'fastify';
import { 
  logger, 
  healthPlugin, 
  metricsPlugin, 
  errorHandlerPlugin,
  multiModeAuthPlugin,
  requestContextPlugin,
  rateLimiterPlugin,
  contentGuardPlugin,
  redis
} from '@hp-intelligence/core';
import { db } from '@/db/connection.js';
import { config } from '@config/index.js';
import v1Routes from '@/routes/v1/index.js';
import cookie from '@fastify/cookie';

import { chatbotAuthPlugin } from '@/plugins/auth.js';
import { inputSanitizerPlugin } from '@/plugins/sanitizer.js';
import { crisisGuardPlugin } from '@/plugins/content-guard.js';
import { sessionChatLimitPlugin } from '@/plugins/rate-limiter.js';

const fastify = Fastify({
  logger: false,
  trustProxy: true,
  disableRequestLogging: true,
  bodyLimit: 1024 * 100, // 100KB limit for chat payloads
});

const appLogger = logger.child({ ns: 'server' });

// 1. Setup Phase
fastify.decorate('db', db);
fastify.decorate('redis', redis);
fastify.register(cookie);
fastify.register(errorHandlerPlugin);
fastify.register(requestContextPlugin);

// 2. Monitoring Phase
fastify.register(healthPlugin);
fastify.register(metricsPlugin);

// 3. Security Layer 1 (Global IP Rate Limiting)
fastify.register(rateLimiterPlugin);
// 4. Secure Domain (Encapsulated AI Logic)
fastify.register(async (protectedScope) => {
  protectedScope.register(contentGuardPlugin); // Injection/Hazardous content
  protectedScope.register(multiModeAuthPlugin);
  protectedScope.register(chatbotAuthPlugin);
  protectedScope.register(inputSanitizerPlugin);
  protectedScope.register(crisisGuardPlugin);
  protectedScope.register(sessionChatLimitPlugin);

  // Register the Bot Routes
  protectedScope.register(v1Routes, { prefix: '/v1' });
}, { prefix: '/api' });

const start = async () => {
  try {
    const port = config.CHATBOT_PORT;
    const host = '0.0.0.0';

    await fastify.listen({ port, host });
    appLogger.info({ port, host, msg: 'HangingPanda Chatbot-AI started' }, 'server.start');
  } catch (err: any) {
    appLogger.fatal({
      msg: 'Chatbot-AI startup failed',
      error: err.message
    }, 'server.fatal');
    process.exit(1);
  }
};

const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    appLogger.info({ signal }, 'Closing server gracefully...');
    try {
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
