export const OPENROUTER_BASE = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
export const CHAT_MODEL = process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini';
export const EMBED_MODEL = process.env.OPENROUTER_EMBED_MODEL ?? '';
export const EMBEDDING_DIM = 1536;

const apiKey = process.env.OPENROUTER_API_KEY ?? '';

export const openrouterAvailable = () => apiKey.length > 0;

export async function openrouterChat(
  prompt: string,
  systemPrompt?: string,
): Promise<string | null> {
  if (!apiKey) return null;
  try {
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      }),
    });
    if (!res.ok) {
      console.error('OpenRouter chat error:', res.status, await res.text());
      return null;
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.error('OpenRouter chat error:', err);
    return null;
  }
}

/**
 * Best-effort embeddings via OpenRouter (only a few providers expose them).
 * Returns null when unavailable, so RAG falls back to a deterministic
 * structural vector / keyword search. Must match EMBEDDING_DIM (1536).
 */
export async function embed(text: string): Promise<number[] | null> {
  if (!apiKey || !EMBED_MODEL) return null;
  try {
    const res = await fetch(`${OPENROUTER_BASE}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: EMBED_MODEL, input: text }),
    });
    if (!res.ok) {
      console.warn('OpenRouter embeddings unavailable:', res.status);
      return null;
    }
    const data = (await res.json()) as { data?: { embedding?: number[] }[] };
    const vec = data.data?.[0]?.embedding;
    if (!vec || vec.length !== EMBEDDING_DIM) return null;
    return normalize(vec);
  } catch (err) {
    console.warn('OpenRouter embeddings unavailable:', err);
    return null;
  }
}

export function normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

/** Deterministic fallback vector used only for pgvector structural consistency. */
export function fallbackVector(text: string, dim = EMBEDDING_DIM): number[] {
  const vec = new Array(dim).fill(0);
  const tokens = text.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    let h = 0;
    for (let i = 0; i < token.length; i++) h = (h * 31 + token.charCodeAt(i)) >>> 0;
    vec[h % dim] += 1;
  }
  return normalize(vec);
}