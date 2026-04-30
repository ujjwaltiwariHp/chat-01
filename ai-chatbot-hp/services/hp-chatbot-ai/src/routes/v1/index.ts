import { FastifyInstance } from 'fastify';
import invokeRoutes from '@/routes/v1/invoke.route.js';

export default async function v1Routes(fastify: FastifyInstance) {
  await fastify.register(invokeRoutes, { prefix: '/chat' });
}
