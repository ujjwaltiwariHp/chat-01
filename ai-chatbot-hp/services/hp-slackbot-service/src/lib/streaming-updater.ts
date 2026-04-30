import type { WebClient } from '@slack/web-api';

const UPDATE_INTERVAL_MS = process.env.SLACK_STREAM_DEBOUNCE_MS ? parseInt(process.env.SLACK_STREAM_DEBOUNCE_MS, 10) : 600;
const TYPING_CURSOR = ' ▌';

export class StreamingUpdater {
  private accumulated = '';
  private lastUpdateText = '';
  private updateTimer: NodeJS.Timeout | null = null;
  private isClosed = false;

  constructor(
    private readonly client: WebClient,
    private readonly channelId: string,
    private readonly messageTs: string,
    private readonly threadTs?: string,
    private readonly intervalMs = UPDATE_INTERVAL_MS
  ) {}

  feed(chunk: string): void {
    this.accumulated += chunk;
    if (!this.updateTimer) {
      this.updateTimer = setInterval(() => this.flush(), this.intervalMs);
    }
  }

  private async flush(): Promise<void> {
    if (this.isClosed) return;
    const current = this.accumulated;
    if (current === this.lastUpdateText) return;
    this.lastUpdateText = current;

    try {
      await this.client.chat.update({
        channel: this.channelId,
        ts: this.messageTs,
        text: current + TYPING_CURSOR,
      });
    } catch (err: any) {
      if (err.data?.error === 'ratelimited') {
        // back off — next interval will retry
      }
    }
  }

  async finalize(richBlocks: any[]): Promise<void> {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    this.isClosed = true;

    await this.client.chat.update({
      channel: this.channelId,
      ts: this.messageTs,
      text: this.accumulated || 'Done.', // fallback for notifications
      blocks: richBlocks,
    });
  }
}
