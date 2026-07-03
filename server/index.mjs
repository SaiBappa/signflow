/* ============================================================================
 * SignFlow backend — serves the built SPA and proxies Gemini calls.
 *
 * The Gemini API key lives ONLY here, in the server's environment
 * (GEMINI_API_KEY). It is never sent to the browser, so it can't be read out
 * of the client bundle. The frontend posts its request payload to
 * /api/ai/generate and the server attaches the key before forwarding to Google.
 *
 * Users may still "bring their own key": the client sends it per-request in the
 * x-gemini-key header, which takes precedence over the server key and is used
 * only for that single request (never logged, never persisted server-side).
 * ========================================================================== */

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load .env then let .env.local override (mirrors Vite's env precedence).
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 8080;
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Only proxy to Gemini model ids — never an arbitrary upstream path.
const ALLOWED_MODEL = /^gemini-[a-z0-9.\-]+$/i;

const app = express();
// Inline PDFs / page images are base64 in the payload, so allow a large body.
app.use(express.json({ limit: '32mb' }));

/** Tells the client whether the server has a key, so the UI can decide whether
 *  to prompt the user for one. Deliberately returns only a boolean. */
app.get('/api/ai/status', (_req, res) => {
  res.json({ available: !!GEMINI_API_KEY });
});

/** Proxy a single generateContent call to Gemini. */
app.post('/api/ai/generate', async (req, res) => {
  try {
    const { model, payload } = req.body || {};

    if (typeof model !== 'string' || !ALLOWED_MODEL.test(model)) {
      return res.status(400).json({ error: 'Invalid or missing "model".' });
    }
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Missing request "payload".' });
    }

    const userKey = (req.get('x-gemini-key') || '').trim();
    const key = userKey || GEMINI_API_KEY;
    if (!key) {
      return res.status(503).json({
        error: 'No Gemini API key configured on the server. Add your own key in the panel.',
      });
    }

    const upstream = await fetch(
      `${GEMINI_BASE}/${model}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );

    // Pass the upstream status + body straight through (it's already JSON).
    const text = await upstream.text();
    res.status(upstream.status).type('application/json').send(text);
  } catch (err) {
    // Never echo the error verbatim — it could contain the key in a URL.
    console.error('[ai proxy] request failed:', err?.message || err);
    res.status(502).json({ error: 'Upstream AI request failed.' });
  }
});

// ── Static SPA ──────────────────────────────────────────────────────────────
const distDir = path.join(__dirname, '..', 'dist');
app.get('/healthz', (_req, res) => res.type('text').send('ok'));
app.use(express.static(distDir));
// SPA fallback — any non-API route serves index.html.
app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

app.listen(PORT, () => {
  console.log(`SignFlow server listening on :${PORT}`);
  console.log(`Gemini key: ${GEMINI_API_KEY ? 'configured (server-side)' : 'NOT set — users must supply their own'}`);
});
