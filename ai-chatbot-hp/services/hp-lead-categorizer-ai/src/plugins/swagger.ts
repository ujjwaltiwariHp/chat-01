import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import swagger, { FastifyDynamicSwaggerOptions } from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from '@/config.js';

export default fp(async (fastify: FastifyInstance) => {
  const swaggerOptions: FastifyDynamicSwaggerOptions = {
    swagger: {
      info: {
        title: 'HP-Lead-Intelligence API',
        description: 'Elite sales intelligence and lead categorization engine',
        version: '1.0.0',
      },
      host: `localhost:${config.CATEGORIZER_PORT}`,
      schemes: ['http', 'https'],
      consumes: ['application/json'],
      produces: ['application/json'],
      securityDefinitions: {
        apiKey: {
          type: 'apiKey',
          name: 'X-Service-Token',
          in: 'header',
        },
        tenantId: {
          type: 'apiKey',
          name: 'X-Tenant-ID',
          in: 'header',
        },
      },
    },
  };

  await fastify.register(swagger, swaggerOptions);

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    staticCSP: true,
    transformStaticCSP: (header: string) => header,
  });
});
