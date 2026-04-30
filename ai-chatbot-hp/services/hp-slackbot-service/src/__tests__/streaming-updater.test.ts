import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { StreamingUpdater } from '../lib/streaming-updater.js';
import type { WebClient } from '@slack/web-api';

describe('StreamingUpdater', () => {
  let mockClient: Partial<WebClient>;
  let updateMock: any;

  beforeEach(() => {
    updateMock = mock.fn(async () => ({ ok: true }));
    mockClient = {
      chat: {
        update: updateMock,
      } as any,
    };
  });

  it('appends typing cursor during streaming', async () => {
    const updater = new StreamingUpdater(mockClient as WebClient, 'C123', 'TS123', 'THREAD123', 50); // fast interval
    updater.feed('hello');
    
    // Wait for debounce flush
    await new Promise(r => setTimeout(r, 60));
    
    assert.strictEqual(updateMock.mock.calls.length, 1);
    assert.strictEqual(updateMock.mock.calls[0].arguments[0].text, 'hello ▌');
    
    await updater.finalize([]);
  });

  it('removes cursor and renders blocks on finalize', async () => {
    const updater = new StreamingUpdater(mockClient as WebClient, 'C123', 'TS123', undefined, 50);
    updater.feed('hello');
    await updater.finalize([{ type: 'section' }]);
    
    // We should get a call for finalize
    const finalCallArgs = updateMock.mock.calls[updateMock.mock.calls.length - 1].arguments[0];
    assert.strictEqual(finalCallArgs.text, 'hello');
    assert.deepStrictEqual(finalCallArgs.blocks, [{ type: 'section' }]);
  });
});
