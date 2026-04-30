import { FastifyInstance } from 'fastify';
import documentRoutes from '@/routes/v1/documents.js';
import invokeRoutes from '@/routes/v1/invoke.js';

export default async function v1Routes(fastify: FastifyInstance) {
  await fastify.register(invokeRoutes);
  await fastify.register(documentRoutes);
}
