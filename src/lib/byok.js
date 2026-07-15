// Single source of truth for reading/writing the user's own API key.
// Kept in localStorage on purpose (see disclaimer in the UI) — never sent
// anywhere except as part of a /api/convert request body, and never
// persisted server-side (route.js uses it for one call, then drops it).

const STORAGE_KEY = 'recode_byok_v1';

export const BYOK_PROVIDERS = [
  { id: 'openai', label: 'OpenAI', defaultModel: 'gpt-4o', keyPlaceholder: 'sk-...' },
  { id: 'anthropic', label: 'Anthropic', defaultModel: 'claude-sonnet-4-6', keyPlaceholder: 'sk-ant-...' },
  { id: 'google', label: 'Google', defaultModel: 'gemini-3.5-flash', keyPlaceholder: 'AIza...' },
  { id: 'groq', label: 'Groq', defaultModel: 'llama-3.3-70b-versatile', keyPlaceholder: 'gsk_...' },
  { id: 'mistral', label: 'Mistral', defaultModel: 'mistral-large-latest', keyPlaceholder: 'Paste your Mistral API key' },
  { id: 'deepseek', label: 'DeepSeek', defaultModel: 'deepseek-v4-flash', keyPlaceholder: 'sk-...' },
  { id: 'xai', label: 'xAI', defaultModel: 'grok-4.5', keyPlaceholder: 'xai-...' },
  { id: 'openrouter', label: 'OpenRouter', defaultModel: 'openrouter/auto', keyPlaceholder: 'sk-or-v1-...' },
];

export function getByokKey() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.provider || !parsed?.apiKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveByokKey({ provider, apiKey, model }) {
  if (typeof window === 'undefined') return;
  if (!provider || !apiKey?.trim()) return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ provider, apiKey: apiKey.trim(), model: model || null })
  );
}

export function clearByokKey() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

// For display only — never log or render the real key.
export function maskByokKey(apiKey) {
  if (!apiKey) return '';
  if (apiKey.length <= 8) return '•'.repeat(apiKey.length);
  return `${apiKey.slice(0, 4)}${'•'.repeat(Math.max(apiKey.length - 8, 4))}${apiKey.slice(-4)}`;
}