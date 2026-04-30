export async function* parseSSE(
  stream: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>
): AsyncGenerator<{ type: string; content?: string; [key: string]: any }, void, unknown> {
  const decoder = new TextDecoder();
  let buffer = '';

  for await (const chunk of stream) {
    buffer += decoder.decode(chunk as Uint8Array, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const dataStr = line.slice(6).trim();
      if (!dataStr) continue;

      if (dataStr === '[DONE]') continue; // Sometimes SSE terminates with [DONE]

      try {
        const data = JSON.parse(dataStr);
        yield data;
      } catch (err) {
        // malformed SSE line — skip
      }
    }
  }
}
