import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { ApiError, logger } from '@hp-intelligence/core';
import { config } from '@/config.js';

const slackRelayLogger = logger.child({ ns: 'gateway:slack-relay' });

const FORWARDED_HEADER_NAMES = new Set([
  'content-type',
  'x-slack-signature',
  'x-slack-request-timestamp',
  'x-slack-retry-num',
  'x-slack-retry-reason',
  'user-agent',
]);

const buildForwardHeaders = (request: FastifyRequest) => {
  const headers: Record<string, string> = {
    'x-request-id': request.id,
  };

  for (const [headerName, headerValue] of Object.entries(request.headers)) {
    const normalizedName = headerName.toLowerCase();
    if (!FORWARDED_HEADER_NAMES.has(normalizedName)) {
      continue;
    }

    if (typeof headerValue === 'string') {
      headers[headerName] = headerValue;
      continue;
    }

    if (Array.isArray(headerValue)) {
      headers[headerName] = headerValue.join(', ');
    }
  }

  return headers;
};

const slackRelayRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Capture raw body for forwarding to Slackbot service (required for signature verification)
  fastify.addContentTypeParser(['application/json', 'application/x-www-form-urlencoded'], { parseAs: 'buffer' }, (_request, body, done) => {
    done(null, body);
  });

  fastify.post('/events', { config: { rateLimit: false } }, async (request: FastifyRequest, reply: FastifyReply) => {
    const bodyBuffer = Buffer.isBuffer(request.body)
      ? request.body
      : Buffer.from(typeof request.body === 'string' ? request.body : '');

    const relayUrl = `${config.SLACKBOT_SERVICE_URL}/api/slack/events`;
    const forwardHeaders = buildForwardHeaders(request);
    const relayBody = new Uint8Array(bodyBuffer);

    slackRelayLogger.info(
      {
        relayUrl,
        requestId: request.id,
        contentType: request.headers['content-type'],
        bodyBytes: bodyBuffer.length,
      },
      'Forwarding Slack callback through gateway',
    );

    try {
      const response = await fetch(relayUrl, {
        method: 'POST',
        headers: forwardHeaders,
        body: relayBody,
        signal: AbortSignal.timeout(15_000),
      });

      const responseBody = await response.text();
      const responseType = response.headers.get('content-type');

      if (responseType) {
        reply.header('Content-Type', responseType);
      }

      return reply.status(response.status).send(responseBody);
    } catch (error: any) {
      slackRelayLogger.error(
        {
          requestId: request.id,
          relayUrl,
          error: error.message,
        },
        'Failed to relay Slack callback to slackbot service',
      );

      throw new ApiError('INTERNAL_SERVER_ERROR', 'Slack relay is temporarily unavailable');
    }
  });
};

export default slackRelayRoutes;
