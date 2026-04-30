import { WebClient } from '@slack/web-api';
import { config } from '@config/index.js';
import { logger } from '@hp-intelligence/core';

export class SlackMessenger {
  public readonly client: WebClient;
  private log = logger.child({ ns: 'slack:messenger' });

  constructor() {
    this.client = new WebClient(config.SLACK_BOT_TOKEN);
  }

  async postInitialMessage(channelId: string, text: string, threadTs?: string): Promise<string> {
    const result = await this.client.chat.postMessage({
      channel: channelId,
      text,
      thread_ts: threadTs,
      unfurl_links: false,
      unfurl_media: false,
    });

    if (!result.ok || !result.ts) {
      throw new Error(`Slack postMessage failed: ${result.error}`);
    }

    return result.ts;
  }

  async postMessage(channelId: string, text: string, threadTs?: string) {
    this.log.info({ channelId, threadTs, len: text.length }, 'Posting message to Slack');

    try {
      const result = await this.client.chat.postMessage({
        channel: channelId,
        text,
        thread_ts: threadTs,
        // Standard high-quality appearance
        unfurl_links: false,
        unfurl_media: false,
      });

      if (!result.ok) {
        this.log.error({ error: result.error }, 'Slack postMessage failed');
        throw new Error(`Slack API Error: ${result.error}`);
      }

      return result;
    } catch (err: any) {
      this.log.error({ err: err.message }, 'Failed to communicate with Slack API');
      throw err;
    }
  }

  // Phase 2: Add help or ephemeral messages if needed
  async postEphemeral(channelId: string, userId: string, text: string) {
    return this.client.chat.postEphemeral({
      channel: channelId,
      user: userId,
      text,
    });
  }
}

export const slackMessenger = new SlackMessenger();
