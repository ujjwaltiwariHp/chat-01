export function markdownToSlack(markdown: string): string {
  return markdown
    // Headings → bold (Slack has no heading concept in mrkdwn)
    .replace(/^#{1,3}\s+(.+)$/gm, '*$1*')
    // Bold **text** → *text*
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    // Italic *text* or _text_ → _text_
    // Note: We do this AFTER bold to avoid matching parts of **bold**
    .replace(/(?<![\w*])\*([\w\s]+)\*(?![\w*])/g, '_$1_')
    .replace(/(?<![\w_])_([\w\s]+)_(?![\w_])/g, '_$1_')
    // Inline code `code` → `code` (same)
    .replace(/`([^`]+)`/g, '`$1`')
    // Code blocks ```lang\n...\n``` → ```...```
    .replace(/```[\w]*\n([\s\S]*?)```/g, '```\n$1```')
    // Unordered list - item → • item
    .replace(/^[-*]\s+/gm, '• ')
    // Ordered list 1. item → 1. item (Slack doesn't render ol, keep numbers)
    .replace(/^\d+\.\s+/gm, (match) => match)
    // Blockquotes > text → > text (Slack supports this)
    // Links [text](url) → <url|text>
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>')
    // Remove excessive blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function markdownToBlocks(markdown: string): any[] {
  const blocks: any[] = [];
  const sections = markdown.split(/\n\n+/);

  for (const section of sections) {
    const trimmedSection = section.trim();
    if (!trimmedSection) continue;

    // Heading detection
    const headingMatch = trimmedSection.match(/^#+\s+(.+)/);
    if (headingMatch) {
      blocks.push({
        type: 'header',
        text: { type: 'plain_text', text: headingMatch[1], emoji: true },
      });
      continue;
    }

    // Code block
    if (trimmedSection.startsWith('```')) {
      const code = trimmedSection.replace(/^```[\w]*\n?/, '').replace(/```$/, '');
      blocks.push({
        type: 'rich_text',
        elements: [{
          type: 'rich_text_preformatted',
          elements: [{ type: 'text', text: code }],
        }],
      });
      continue;
    }

    // Default: section text with inline mrkdwn
    // This also handles bullet lists correctly because markdownToSlack handles the bullets
    // and Slack's section block with mrkdwn type parses the styling.
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: markdownToSlack(trimmedSection) },
    });
  }

  return blocks;
}
