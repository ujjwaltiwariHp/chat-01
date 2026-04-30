import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { config } from '@config/index.js';
import { logger, safeCompare } from '@hp-intelligence/core';
import { gatewayClient } from '../services/gateway.client.js';
import { slackMessenger } from '../services/slack.messenger.js';
import { StreamingUpdater } from '../lib/streaming-updater.js';
import { markdownToBlocks } from '../lib/markdown-to-slack.js';

/**
 * Verifies the Slack request signature
 */
const verifySlackSignature = (req: FastifyRequest): boolean => {
  const signature = req.headers['x-slack-signature'] as string;
  const timestamp = req.headers['x-slack-request-timestamp'] as string;
  const body = req.rawBody as string; // Fastify needs a plugin to provide rawBody

  if (!signature || !timestamp || !body) return false;

  // Prevent replay attacks (5-minute max skew)
  const fiveMinAgo = Math.floor(Date.now() / 1000) - (5 * 60);
  if (parseInt(timestamp, 10) < fiveMinAgo) return false;

  const base = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac('sha256', config.SLACK_SIGNING_SECRET)
    .update(base)
    .digest('hex');

  const expected = `v0=${hmac}`;
  return safeCompare(signature, expected);
};

/**
 * Handle Phase 1 MVP (Slash Commands)
 */
export const slackEventsRouter = async (fastify: FastifyInstance) => {
  // POST /api/slack/events
  fastify.post('/events', async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.body as any;

    // 1. Handle Slack URL Verification (One-time setup)
    // We do this BEFORE signature check to ensure the handshake always succeeds
    if (payload?.type === 'url_verification') {
      logger.info('Received Slack URL verification challenge');
      return reply.status(200).type('text/plain').send(payload.challenge);
    }

    // 2. Signature Verification for all other events
    if (!verifySlackSignature(request)) {
      logger.warn({ ns: 'slack:auth' }, 'Invalid Slack signature detected');
      return reply.status(401).send('Unauthorized');
    }

    // 3. Extract logic based on payload type (Event vs Command)
    let text = '';
    let user_id = '';
    let team_id = payload.team_id || '';
    let channel_id = '';
    let thread_ts: string | undefined = undefined;
    let isEvent = false;

    if (payload.type === 'event_callback') {
      const event = payload.event;

      // 1. Ignore bot's own messages to prevent loops
      if (event?.bot_id || event?.user === payload.authorizations?.[0]?.user_id) {
        return reply.status(200).send();
      }

      // 2. Handle Mentions in Channels
      if (event?.type === 'app_mention') {
        isEvent = true;
        text = event.text.replace(/<@U[A-Z0-9]+>/g, '').trim();
        user_id = event.user;
        channel_id = event.channel;
        thread_ts = event.ts;
      }
      // 3. Handle Direct Messages (DMs)
      else if (event?.type === 'message' && event?.channel_type === 'im') {
        // Skip message if it was deleted or changed (has subtype)
        if (event.subtype) return reply.status(200).send();

        isEvent = true;
        text = event.text;
        user_id = event.user;
        channel_id = event.channel;
      } else {
        return reply.status(200).send(); // Ignore other events
      }
    } else {
      return reply.status(200).send();
    }

    logger.info({ type: payload.type, user_id, team_id, text }, 'Processing Slack Mention');

    // 4. IMMEDIATE ACK
    reply.status(200).send(); // Events just need an empty 200

    // 5. BACKGROUND TASK
    const processAiTask = async () => {
      let messageTs: string | undefined;
      const tenantResolver = fastify.tenantResolver;
      const lockKey = `slack:processing:${team_id}:${user_id}`;

      try {
        const lockAcquired = await fastify.redis.set(lockKey, "1", "EX", 30, "NX");
        if (!lockAcquired) {
          await slackMessenger.postMessage(
            channel_id,
            "I'm still processing your previous message, please wait a moment.",
            thread_ts
          );
          return;
        }
      } catch (err) {
        logger.warn({ err }, 'Failed to acquire Redis lock, continuing without it');
      }

      try {
        const tenantId = await tenantResolver.resolveTenantId(team_id);
        const sessionId = `slack:${team_id}:${channel_id}:${Date.now()}:${crypto.randomUUID().slice(0, 8)}`;

        messageTs = await slackMessenger.postInitialMessage(
          channel_id,
          'Thinking...',
          thread_ts
        );

        const updater = new StreamingUpdater(
          slackMessenger.client,
          channel_id,
          messageTs,
          thread_ts
        );

        const stream = gatewayClient.invokeSmartStream({
          message: text,
          tenantId,
          userId: user_id,
          sessionId,
        });

        let fullText = '';
        for await (const chunk of stream) {
          fullText += chunk;
          updater.feed(chunk);
        }

        const richBlocks = markdownToBlocks(fullText);
        await updater.finalize(richBlocks);

        logger.info({ team_id, user_id, sessionId }, 'Slack AI response delivered');
      } catch (err: any) {
        logger.error({ ns: 'slack:task', err: err.message, team_id: team_id, userId: user_id }, 'Failed to process Slack AI task');

        try {
          if (messageTs) {
            await slackMessenger.client.chat.update({
              channel: channel_id,
              ts: messageTs,
              text: `⚠️ Error: ${err.message}`, // Propagate error message for visibility
            });
          } else {
            await slackMessenger.postMessage(
              channel_id,
              '⚠️ Sorry, I encountered an error. Please try again.',
              thread_ts
            );
          }
        } catch (postErr: any) {
          logger.error({ ns: 'slack:task', err: postErr.message }, 'Failed to post error message back to Slack');
        }
      } finally {
        try {
          await fastify.redis.del(lockKey);
        } catch (err) {
          logger.warn({ err }, 'Failed to release Redis lock');
        }
      }
    };

    processAiTask();
  });
};
