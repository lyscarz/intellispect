/**
 * Minimal client-side SSE reader. Streams an event-stream POST body and emits
 * one onEvent call per `event: ... \n data: ... \n\n` block.
 */
export async function streamSSE(
  url: string,
  body: unknown,
  onEvent: (event: string, data: unknown) => void
): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    // Split on blank-line separators between events.
    const parts = buf.split('\n\n');
    buf = parts.pop() ?? '';
    for (const part of parts) {
      const lines = part.split('\n');
      let event = 'message';
      let dataStr = '';
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
      }
      if (!dataStr) continue;
      try {
        onEvent(event, JSON.parse(dataStr));
      } catch {
        onEvent(event, dataStr);
      }
    }
  }
}
