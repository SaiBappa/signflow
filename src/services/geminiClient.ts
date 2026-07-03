/* ============================================================================
 * Gemini client — the single way the frontend talks to Gemini.
 *
 * All calls go through the backend proxy (/api/ai/*), which holds the API key
 * server-side. The key is therefore NEVER bundled into the client or visible in
 * the browser. A user may still bring their own key (stored in localStorage);
 * when present it is sent per-request and the server uses it instead.
 *
 * See server/index.mjs for the proxy.
 * ========================================================================== */

import { useEffect, useState } from 'react';

/** localStorage slot shared by every AI tool for a user-supplied key. */
export const GEMINI_KEY_STORAGE = 'signflow_gemini_api_key';

const PLACEHOLDER = 'MY_GEMINI_API_KEY';

/** The user-entered key from localStorage, or '' if none/placeholder. */
export function getUserGeminiKey(): string {
  try {
    const k = (localStorage.getItem(GEMINI_KEY_STORAGE) || '').trim();
    return k && k !== PLACEHOLDER ? k : '';
  } catch {
    return ''; // localStorage unavailable (SSR / privacy mode)
  }
}

export function hasUserGeminiKey(): boolean {
  return getUserGeminiKey() !== '';
}

/** Whether a user-supplied key string is usable. */
export function isUsableKey(key: string | undefined | null): boolean {
  const k = (key ?? '').trim();
  return k !== '' && k !== PLACEHOLDER;
}

// Cache the server-status probe — it doesn't change within a page session.
let serverStatus: Promise<boolean> | null = null;

/** Does the server have its own key configured? Cached after first call. */
export function serverKeyAvailable(): Promise<boolean> {
  if (!serverStatus) {
    serverStatus = fetch('/api/ai/status')
      .then(r => (r.ok ? r.json() : { available: false }))
      .then(d => !!d?.available)
      .catch(() => false);
  }
  return serverStatus;
}

export interface GenerateOptions {
  signal?: AbortSignal;
}

/**
 * Call Gemini's generateContent through the backend proxy.
 * Returns the parsed Gemini response JSON (with `.candidates`, etc.).
 * Throws on a non-OK response.
 */
export async function generateContent(
  model: string,
  payload: unknown,
  opts: GenerateOptions = {},
): Promise<any> {
  const userKey = getUserGeminiKey();
  const res = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(userKey ? { 'x-gemini-key': userKey } : {}),
    },
    body: JSON.stringify({ model, payload }),
    signal: opts.signal,
  });

  if (!res.ok) {
    let detail = '';
    try {
      const data = await res.json();
      detail = data?.error?.message || data?.error || '';
    } catch {
      detail = await res.text().catch(() => '');
    }
    throw new Error(`AI service error: ${res.status}${detail ? ` — ${detail}` : ''}`);
  }
  return res.json();
}

/** React hook: does the server hold a key? (Reactive, cached probe.) */
export function useServerKeyAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let active = true;
    serverKeyAvailable().then(v => {
      if (active) setAvailable(v);
    });
    return () => {
      active = false;
    };
  }, []);
  return available;
}

/**
 * React hook: is AI usable right now — either the server has a key, or the
 * caller passes a usable user key. Pass your local key-input state so the
 * result stays reactive as the user types.
 */
export function useAiAvailable(userKey?: string): boolean {
  const hasServerKey = useServerKeyAvailable();
  return hasServerKey || isUsableKey(userKey) || hasUserGeminiKey();
}
