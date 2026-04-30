import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const ALLOWED_HEADERS = [
  'Authorization',
  'Content-Type',
  'X-Request-ID',
  'X-Session-ID',
  'X-Session-Id',
  'X-CSRF-Token',
  'X-Tenant-ID',
  'X-Tenant-Id',
  'X-Customer-ID',
  'X-Customer-Id',
  'X-Service-Token',
];

const corsModule: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    const originToReturn = origin || '*';

    reply.header('Access-Control-Allow-Origin', originToReturn);
    reply.header('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
    reply.header('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));
    reply.header('Access-Control-Allow-Credentials', 'true');
    reply.header('Access-Control-Allow-Private-Network', 'true');
    reply.header('Access-Control-Max-Age', '86400');
    reply.header('Vary', 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers');

    const isPreflight = request.method.toUpperCase() === 'OPTIONS';
    if (isPreflight) {
      return reply.status(204).header('Content-Length', '0').send();
    }
  });
};

export const gatewayCorsPlugin = fp(corsModule);
export default gatewayCorsPlugin;
