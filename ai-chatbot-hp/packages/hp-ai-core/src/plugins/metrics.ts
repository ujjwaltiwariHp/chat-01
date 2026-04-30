import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import client from 'prom-client';
import { config } from '../config/base-config.js';
import { cacheCounter } from '../cache/semantic-cache.js';

// Export AI-specific counters for core instruments (OpenAIClient)
export const tokenCounter = new client.Counter({
  name: 'hp_ai_tokens_total',
  help: 'Total tokens consumed by AI services',
  labelNames: ['service', 'model', 'type'],
});

export const aiErrorCounter = new client.Counter({
  name: 'hp_ai_errors_total',
  help: 'Total errors from AI providers',
  labelNames: ['service', 'error_type'],
});

export const widgetConversationCounter = new client.Counter({
  name: 'hp_widget_conversations_total',
  help: 'Total accepted widget conversations tracked by billing plan',
  labelNames: ['plan'],
});

let defaultMetricsInitialized = false;

/**
 * Prometheus Metrics Plugin
 * Standardizes observability across all services.
 */
const metricsPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const register = client.register;
  if (!defaultMetricsInitialized) {
    client.collectDefaultMetrics({ register });
    defaultMetricsInitialized = true;
  }

  // 2. Custom Business Metrics
  const requestCount = register.getSingleMetric('hp_http_request_total') as client.Counter<string> || new client.Counter({
    name: 'hp_http_request_total',
    help: 'Total number of HTTP requests processed',
    labelNames: ['method', 'route', 'status', 'service'],
    registers: [register],
  });

  const requestDuration = register.getSingleMetric('hp_http_request_duration_seconds') as client.Histogram<string> || new client.Histogram({
    name: 'hp_http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'service'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30],
    registers: [register],
  });

  const activeConnections = register.getSingleMetric('hp_http_active_connections') as client.Gauge<string> || new client.Gauge({
    name: 'hp_http_active_connections',
    help: 'Number of active HTTP connections',
    labelNames: ['service'],
    registers: [register],
  });

  const serviceName = config.SERVICE_NAME;

  // 3. Hooks for Automatic Tracking
  fastify.addHook('onRequest', async () => {
    activeConnections.inc({ service: serviceName });
  });

  fastify.addHook('onResponse', async (request, reply) => {
    activeConnections.dec({ service: serviceName });
    
    const route = request.routeOptions.url || 'unknown';
    const method = request.method;
    const status = reply.statusCode.toString();

    requestCount.inc({ method, route, status, service: serviceName });
    requestDuration.observe({ method, route, service: serviceName }, reply.elapsedTime / 1000);
  });

  // 4. Exposed Metrics Endpoint
  fastify.get('/metrics', async (_request, reply) => {
    reply.header('Content-Type', register.contentType);
    return await register.metrics();
  });
};

export default metricsPlugin;
