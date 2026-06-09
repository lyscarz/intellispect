import OpenAI from 'openai';

// Default to gpt-4o-mini: fast, cheap, supports streaming + tool calls.
// Swap to 'gpt-4o' for higher quality, or 'gpt-4.1-mini' if available on
// your account. Override at runtime via the OPENAI_MODEL env var.
export const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
export const MAX_TOKENS = 4096;

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set. Add it to .env.local.');
  }
  client = new OpenAI({ apiKey });
  return client;
}
