/// <reference types="vite/client" />

// NOTE: Do NOT add the Gemini API key here. A VITE_-prefixed var is inlined into
// the client bundle and would leak. The key lives only on the server
// (GEMINI_API_KEY) and is used via the /api/ai proxy — see src/services/geminiClient.ts.
interface ImportMetaEnv {}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
