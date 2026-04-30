import Fastify from 'fastify';
import formbody from '@fastify/formbody';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Redis } from 'ioredis';
import { 
  logger, 
  errorHandlerPlugin, 
  healthPlugin 
} from '@hp-intelligence/core';
import { config } from '@config/index.js';
import { slackEventsRouter } from '@routes/slack.events.js';
import { createTenantResolver, TenantResolver } from './services/tenant.resolver.js';
import { slackMessenger } from './services/slack.messenger.js';

const fastify = Fastify({
  logger: false,
  trustProxy: true,
});

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string;
  }
  interface FastifyInstance {
    db: any; // Synchronized with @hp-intelligence/core
    redis: any;
    tenantResolver: TenantResolver;
  }
}

const appLogger = logger.child({ ns: 'slackbot:server' });

// 1. Setup Phase: Platform Integration
const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
const db = drizzle(pool as any);
const redisInstance = new Redis(config.REDIS_URL);

fastify.decorate('db', db);
fastify.decorate('redis', redisInstance);

const tenantResolverInstance = createTenantResolver(db, redisInstance);
fastify.decorate('tenantResolver', tenantResolverInstance);

fastify.register(errorHandlerPlugin);
fastify.register(healthPlugin);

// 2. Body Parsing with RawBody Capture (Critical for Slack Signature)
// The preParsing hook MUST be added before formbody is registered to ensure it runs before formbody consumes the stream.
fastify.addHook('preParsing', async (request: any, _reply: any, payload: any) => {
  let rawBody = '';
  // High-performance streaming capture
  for await (const chunk of payload) {
    rawBody += chunk.toString();
  }
  
  // Attach rawBody for downstream Slack Signature verification
  request.rawBody = rawBody;
  
  // Return the data as a stream again for the next parser
  const Readable = await import('stream').then(m => m.Readable);
  return Readable.from([rawBody]);
});

fastify.register(formbody);

// 3. Service Routes
fastify.register(slackEventsRouter, { prefix: '/api/slack' });

const start = async () => {
  try {
    const { PORT } = config;
    const host = '0.0.0.0';

    await fastify.listen({ port: PORT, host });
    appLogger.info({ port: PORT, host, msg: 'HangingPanda Slackbot started' }, 'server.start');
  } catch (err: any) {
    appLogger.fatal({
      msg: 'Slackbot startup failed',
      error: err.message
    }, 'server.fatal');
    process.exit(1);
  }
};

start();
