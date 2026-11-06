import { env } from '../config/env.js';
import { aiError } from '../lib/errors.js';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * One non-streaming call to any OpenAI-compatible Chat Completions API
 * (OpenRouter, Groq, Gemini's OpenAI endpoint, Ollama, OpenAI...).
 */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function complete(messages: LlmMessage[], opts: { maxTokens?: number; temperature?: number } = {}): Promise<string> {
  // Free tiers (e.g. Gemini) often answer 503 "high demand" / 429 for a moment — retry with backoff.
  for (let attempt = 1; ; attempt++) {
    try {
      return await completeOnce(messages, opts);
    } catch (err) {
      const status = (err as { providerStatus?: number }).providerStatus;
      if (attempt >= MAX_ATTEMPTS || status === undefined || !RETRYABLE.has(status)) throw err;
      console.warn(`AI provider returned ${status}, retrying (${attempt}/${MAX_ATTEMPTS - 1})...`);
      await sleep(1000 * 2 ** (attempt - 1));
    }
  }
}

async function completeOnce(messages: LlmMessage[], opts: { maxTokens?: number; temperature?: number }): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${env.AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.AI_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Title': 'Kanbot', // OpenRouter app attribution; ignored elsewhere
      },
      body: JSON.stringify({
        model: env.AI_MODEL,
        messages,
        max_tokens: opts.maxTokens ?? 1500,
        temperature: opts.temperature ?? 0.4,
      }),
      signal: AbortSignal.timeout(env.AI_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    throw aiError(timedOut ? 'The AI took too long to answer. Try again.' : 'Could not reach the AI provider.');
  }

  const text = await res.text();
  if (!res.ok) {
    console.error(`AI provider error ${res.status}: ${text.slice(0, 500)}`);
    const fail = (message: string) => Object.assign(aiError(message), { providerStatus: res.status });
    if (res.status === 401 || res.status === 403) throw fail('The AI provider rejected the API key (check AI_API_KEY).');
    if (res.status === 404) throw fail(`The AI model "${env.AI_MODEL}" was not found (check AI_MODEL).`);
    if (res.status === 429) throw fail('The AI provider rate limit was reached. Wait a moment and try again.');
    if (res.status === 503) throw fail('The AI provider is busy right now. Try again in a moment.');
    throw fail(`The AI provider returned an error (${res.status}).`);
  }
  try {
    const json = JSON.parse(text) as { choices?: { message?: { content?: string | null } }[] };
    const content = json.choices?.[0]?.message?.content?.trim();
    if (content) return content;
  } catch {
    // fall through
  }
  throw aiError('The AI returned an empty answer. Try again.');
}

/** Pulls the first JSON object out of a reply (models love wrapping JSON in ```fences``` or prose). */
export function extractJson(reply: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(reply)?.[1];
  const candidate = fenced ?? reply;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) throw aiError('The AI answer was not in the expected format. Try again.');
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw aiError('The AI answer was not in the expected format. Try again.');
  }
}
