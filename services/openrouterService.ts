
import { api, ApiClientError } from './api.ts';

/**
 * ShiftBot chat — proxied through the backend (`/api/v1/ai/chat`).
 * The server owns the OpenRouter key and builds RAG context from the
 * restaurant's knowledge base, so no key is exposed to the browser.
 */
export const generateRestaurantAssistantResponse = async (
  prompt: string,
  _contextData: string,
  systemInstructionOverride?: string
): Promise<string> => {
  try {
    const res = await api.post<{ text: string }>('/ai/chat', {
      message: prompt,
      systemPrompt: systemInstructionOverride,
    });
    return res.text;
  } catch (e) {
    if (e instanceof ApiClientError && e.status === 503) {
      return 'AI is not configured on the server. Add OPENROUTER_API_KEY to the server .env to enable ShiftBot.';
    }
    console.error('AI chat error:', e);
    return 'Sorry, I could not connect to the AI brain.';
  }
};
