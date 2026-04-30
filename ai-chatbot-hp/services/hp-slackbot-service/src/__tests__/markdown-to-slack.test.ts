import { describe, it } from 'node:test';
import assert from 'node:assert';
import { markdownToSlack, markdownToBlocks } from '../lib/markdown-to-slack.js';

describe('markdownToSlack', () => {
  it('converts **bold** to *bold*', () => {
    assert.strictEqual(markdownToSlack('This is **bold** text'), 'This is *bold* text');
  });

  it('converts ### Heading to *Heading*', () => {
    assert.strictEqual(markdownToSlack('### Heading\nText'), '*Heading*\nText');
  });

  it('converts - item to • item', () => {
    assert.strictEqual(markdownToSlack('- list item'), '• list item');
  });

  it('converts [text](url) to <url|text>', () => {
    assert.strictEqual(markdownToSlack('[Example](https://example.com)'), '<https://example.com|Example>');
  });

  it('preserves code blocks', () => {
    const md = '```ts\nconst x = 1;\n```';
    assert.strictEqual(markdownToSlack(md), '```\nconst x = 1;\n```');
  });
});

describe('markdownToBlocks', () => {
  it('produces header blocks', () => {
    const blocks = markdownToBlocks('### Section');
    assert.strictEqual((blocks[0] as any).type, 'header');
    assert.strictEqual((blocks[0] as any).text.text, 'Section');
  });

  it('produces bullet blocks', () => {
    const blocks = markdownToBlocks('- Item 1\n- Item 2');
    assert.strictEqual((blocks[0] as any).type, 'rich_text');
    assert.strictEqual((blocks[0] as any).elements[0].type, 'rich_text_list');
    assert.strictEqual((blocks[0] as any).elements[0].elements.length, 2);
  });
});
