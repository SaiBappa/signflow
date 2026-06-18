import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  Sparkles, Key, AlertCircle, Loader2, Send, Bot, User as UserIcon,
  FileText, RefreshCw, Eye, EyeOff, Copy, Check, ListChecks, FileSearch, Languages,
} from 'lucide-react';
import { ToolLayout, ToolField, ToolInput } from './shared/ToolLayout';
import { UploadDropzone } from './shared/UploadDropzone';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

/* ============================================================================
 * AskAI — "Ask AI" tool. Chat with a PDF and get instant summaries.
 *
 * Follows the app's established AI conventions (see Convert.tsx): Gemini 2.5
 * Flash via the generativelanguage REST API, key read from localStorage with a
 * VITE_GEMINI_API_KEY env fallback, and a graceful local fallback when no key
 * is present.
 *
 * To keep multi-turn chat cheap and private, the document's text layer is
 * extracted once locally with pdf.js and sent as system context — the full PDF
 * is only uploaded (as inline data) when the document is scanned and has no
 * usable text layer.
 * ========================================================================== */

const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_CONTEXT_CHARS = 120_000; // keep the prompt well within model limits
export const SCANNED_THRESHOLD = 120; // below this many chars we treat the PDF as scanned

/** A PDF is treated as "scanned" (no usable text layer) when its extracted text
 *  falls below SCANNED_THRESHOLD characters. Such docs are sent to the model as
 *  inline image data instead of text. */
export function isScannedText(text: string): boolean {
  return (text?.trim().length ?? 0) < SCANNED_THRESHOLD;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'summary',
    label: 'Summarize',
    icon: <FileText className="w-3.5 h-3.5" />,
    prompt:
      'Summarize this document in clear, concise prose. Start with a one-sentence overview, then give the key points as a short bullet list.',
  },
  {
    id: 'keypoints',
    label: 'Key points',
    icon: <ListChecks className="w-3.5 h-3.5" />,
    prompt: 'List the most important points, facts, figures, dates and parties mentioned in this document as a bullet list.',
  },
  {
    id: 'actions',
    label: 'Action items',
    icon: <FileSearch className="w-3.5 h-3.5" />,
    prompt:
      'Extract any action items, obligations, deadlines or next steps from this document. If there are none, say so clearly.',
  },
  {
    id: 'translate',
    label: 'Explain simply',
    icon: <Languages className="w-3.5 h-3.5" />,
    prompt: 'Explain what this document is and what it means in plain, simple language a non-expert could understand.',
  },
];

/** Encode a File to base64 in chunks (avoids call-stack limits on large files). */
async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const binary = new Uint8Array(buffer);
  let binaryString = '';
  const chunkSize = 8192;
  for (let i = 0; i < binary.byteLength; i += chunkSize) {
    binaryString += String.fromCharCode.apply(
      null,
      Array.from(binary.subarray(i, Math.min(i + chunkSize, binary.byteLength))),
    );
  }
  return btoa(binaryString);
}

/** Extract the text layer from a PDF, page by page. Returns combined text + page count. */
export async function extractPdfText(file: File): Promise<{ text: string; pages: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  let text = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pageText = (content.items as any[]).map(it => it.str).join(' ');
    text += `\n\n--- Page ${p} ---\n${pageText}`;
    if (text.length > MAX_CONTEXT_CHARS) break;
  }
  return { text: text.trim(), pages: pdf.numPages };
}

/** Lightweight extractive summary used when no API key is configured. */
export function localSummary(text: string, pages: number): string {
  const clean = text.replace(/--- Page \d+ ---/g, ' ').replace(/\s+/g, ' ').trim();
  const words = clean ? clean.split(' ').length : 0;
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [];
  // Score sentences by frequency of their (non-trivial) words — classic extractive ranking.
  const freq: Record<string, number> = {};
  clean.toLowerCase().split(/\W+/).forEach(w => {
    if (w.length > 4) freq[w] = (freq[w] || 0) + 1;
  });
  const ranked = sentences
    .map((s, i) => {
      const score = s.toLowerCase().split(/\W+/).reduce((acc, w) => acc + (freq[w] || 0), 0);
      return { s: s.trim(), i, score: score / Math.max(1, s.split(' ').length) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .sort((a, b) => a.i - b.i)
    .map(x => `- ${x.s}`);

  if (!clean) {
    return `This looks like a scanned PDF with no extractable text layer (${pages} page${pages > 1 ? 's' : ''}). Add a Gemini API key to summarize scanned documents, or run the OCR tool first.`;
  }
  return [
    `**Quick local summary** (${pages} page${pages > 1 ? 's' : ''}, ~${words.toLocaleString()} words)`,
    '',
    ...ranked,
    '',
    '_Add a Gemini API key in the panel for full AI chat and higher-quality summaries._',
  ].join('\n');
}

/** Escape HTML then apply a minimal subset of Markdown for chat rendering. */
export function renderMarkdown(src: string): string {
  let html = src
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // code spans
  html = html.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-slate-100 rounded text-[0.85em] font-mono">$1</code>');
  // bold / italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  html = html.replace(/_([^_\n]+)_/g, '<em>$1</em>');
  // headings
  html = html.replace(/^#{1,6}\s+(.+)$/gm, '<div class="font-bold text-slate-800 mt-2 mb-1">$1</div>');
  // bullets -> wrap consecutive list items
  const lines = html.split('\n');
  const out: string[] = [];
  let inList = false;
  for (const line of lines) {
    const m = line.match(/^\s*[-*]\s+(.*)$/);
    if (m) {
      if (!inList) { out.push('<ul class="list-disc pl-4 space-y-0.5 my-1">'); inList = true; }
      out.push(`<li>${m[1]}</li>`);
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(line.trim() ? `<p class="my-1">${line}</p>` : '');
    }
  }
  if (inList) out.push('</ul>');
  return out.join('');
}

export function AskAI({ initialFile = null }: { initialFile?: File | null } = {}) {
  const [file, setFile] = useState<File | null>(null);
  const [docText, setDocText] = useState('');
  const [pageCount, setPageCount] = useState(0);
  const [isScanned, setIsScanned] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('signflow_gemini_api_key') || '');
  const [showKey, setShowKey] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('signflow_gemini_api_key', apiKey);
  }, [apiKey]);

  const hasEnvKey = !!import.meta.env.VITE_GEMINI_API_KEY;
  const activeKey = apiKey || import.meta.env.VITE_GEMINI_API_KEY || '';
  const hasValidKey = !!activeKey && activeKey !== 'MY_GEMINI_API_KEY' && activeKey.trim() !== '';

  // Auto-scroll the transcript as messages stream in.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isSending]);

  const loadFile = async (f: File) => {
    setFile(f);
    setMessages([]);
    setError('');
    setExtracting(true);
    try {
      const { text, pages } = await extractPdfText(f);
      setDocText(text);
      setPageCount(pages);
      setIsScanned(isScannedText(text));
    } catch (e) {
      console.error(e);
      setDocText('');
      setPageCount(0);
      setIsScanned(true);
    } finally {
      setExtracting(false);
    }
  };

  // When opened from an already-open document (via the viewer toolbar), load it.
  useEffect(() => {
    if (initialFile) loadFile(initialFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  const reset = () => {
    setFile(null);
    setDocText('');
    setPageCount(0);
    setMessages([]);
    setInput('');
    setError('');
  };

  const callGemini = useCallback(
    async (history: ChatMessage[]): Promise<string> => {
      const systemText = isScanned
        ? 'You are a helpful assistant analysing a PDF document that is attached as inline data. Answer the user\'s questions about it accurately and concisely. Use Markdown (bullet lists, bold) where it aids clarity.'
        : `You are a helpful assistant answering questions about the following document. Base your answers only on its content; if something is not in the document, say so. Use Markdown (bullet lists, bold) where it aids clarity.\n\n=== DOCUMENT TEXT START ===\n${docText.slice(0, MAX_CONTEXT_CHARS)}\n=== DOCUMENT TEXT END ===`;

      const contents = history.map((m, idx) => {
        // For a scanned PDF, attach the raw file to the very first user turn.
        if (isScanned && idx === 0 && m.role === 'user') {
          return {
            role: 'user',
            parts: [m.text ? { text: m.text } : { text: 'Please review the attached document.' }],
          };
        }
        return { role: m.role, parts: [{ text: m.text }] };
      });

      // Inline the PDF on the first user turn for scanned documents.
      if (isScanned && file && contents[0]) {
        const base64 = await fileToBase64(file);
        (contents[0].parts as any[]).unshift({ inlineData: { mimeType: 'application/pdf', data: base64 } });
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${activeKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemText }] },
            contents,
            generationConfig: { temperature: 0.3 },
          }),
        },
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`AI service error: ${response.status} — ${errText}`);
      }
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? '';
      if (!text) throw new Error('Empty response from AI service.');
      return text;
    },
    [activeKey, docText, isScanned, file],
  );

  const send = async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || isSending || !file) return;
    setError('');
    setInput('');

    // No key: serve a local extractive summary instead of a chat reply.
    if (!hasValidKey) {
      const userMsg: ChatMessage = { role: 'user', text: trimmed };
      setMessages(m => [...m, userMsg, { role: 'model', text: localSummary(docText, pageCount) }]);
      return;
    }

    const nextHistory: ChatMessage[] = [...messages, { role: 'user', text: trimmed }];
    setMessages(nextHistory);
    setIsSending(true);
    try {
      const reply = await callGemini(nextHistory);
      setMessages(m => [...m, { role: 'model', text: reply }]);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const copyMessage = (text: string, idx: number) => {
    navigator.clipboard?.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  /* ── Left functions panel ── */
  const panel = (
    <>
      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">AI engine</span>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-indigo-50/60 border border-indigo-100 rounded-xl p-2.5">
          <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
          <span>Gemini 2.5 Flash — chat &amp; summarize</span>
        </div>
      </div>

      {hasEnvKey ? (
        <span className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1">
          <Key className="w-3 h-3" /> AI ready
        </span>
      ) : (
        <ToolField label="API key" hint="Stored locally in your browser only.">
          <div className="relative">
            <ToolInput
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Enter your Gemini API key…"
              className="pr-10 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {!apiKey && (
            <div className="flex items-start gap-1.5 text-[10px] text-amber-600 bg-amber-50/50 p-2 rounded-lg border border-amber-100 mt-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
              <span>No key set. You'll still get a basic local summary.</span>
            </div>
          )}
        </ToolField>
      )}

      {file && (
        <div className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Quick actions</span>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map(a => (
              <button
                key={a.id}
                onClick={() => send(a.prompt)}
                disabled={isSending || extracting}
                className="flex items-center gap-1.5 px-2.5 py-2 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <span className="text-indigo-500">{a.icon}</span>
                {a.label}
              </button>
            ))}
          </div>

          <button
            onClick={reset}
            className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-rose-500 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> New document
          </button>
        </div>
      )}
    </>
  );

  /* ── Main work area ── */
  const mainArea = !file ? (
    <UploadDropzone
      onFiles={fs => fs[0] && loadFile(fs[0])}
      accept="application/pdf"
      title="Chat with your PDF"
      subtitle={
        <>
          Drag &amp; drop a PDF here, or <span className="text-indigo-600 font-semibold">browse</span>. Ask questions or get an instant summary.
        </>
      }
      chips={['📄 PDF', '✨ AI summary', '💬 Q&A']}
      icon={<Sparkles className="w-9 h-9" strokeWidth={2} />}
    />
  ) : (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Document header */}
      <div className="shrink-0 px-4 md:px-6 py-3 border-b border-slate-200/60 bg-white/70 backdrop-blur-sm flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 shrink-0">
          <FileText className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-700 truncate" title={file.name}>{file.name}</p>
          <p className="text-[11px] text-slate-400 font-medium">
            {extracting ? 'Reading document…' : `${pageCount} page${pageCount > 1 ? 's' : ''}${isScanned ? ' · scanned (AI vision)' : ''}`}
          </p>
        </div>
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-4">
        {messages.length === 0 && !isSending && (
          <div className="max-w-md mx-auto text-center mt-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white mx-auto mb-4 shadow-lg">
              <Sparkles className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-700">Ask anything about this PDF</h3>
            <p className="text-xs text-slate-400 font-medium mt-1.5 leading-relaxed">
              Use a quick action in the panel, or type a question below — like “What are the payment terms?” or “Summarize page 2.”
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div
              className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-white ${
                m.role === 'user' ? 'bg-slate-400' : 'bg-gradient-to-tr from-indigo-500 to-violet-500'
              }`}
            >
              {m.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={`group max-w-[80%] ${m.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
              <div
                className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-sm'
                    : 'bg-white border border-slate-200/70 text-slate-700 rounded-tl-sm shadow-sm'
                }`}
              >
                {m.role === 'user' ? (
                  <span className="whitespace-pre-wrap">{m.text}</span>
                ) : (
                  <div className="prose-chat" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }} />
                )}
              </div>
              {m.role === 'model' && (
                <button
                  onClick={() => copyMessage(m.text, i)}
                  className="mt-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-semibold text-slate-400 hover:text-indigo-600 flex items-center gap-1 cursor-pointer"
                >
                  {copiedIdx === i ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                </button>
              )}
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-white bg-gradient-to-tr from-indigo-500 to-violet-500">
              <Bot className="w-4 h-4" />
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white border border-slate-200/70 shadow-sm">
              <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-xs text-rose-600 bg-rose-50/70 border border-rose-100 rounded-xl p-3 max-w-md mx-auto">
            <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
            <span className="break-words">{error}</span>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 px-4 md:px-6 py-3 border-t border-slate-200/60 bg-white/80 backdrop-blur-sm">
        <form
          onSubmit={e => { e.preventDefault(); send(input); }}
          className="flex items-end gap-2 max-w-3xl mx-auto"
        >
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
            }}
            disabled={extracting}
            rows={1}
            placeholder={hasValidKey ? 'Ask a question about this PDF…' : 'Type to get a local summary (add a key for full chat)…'}
            className="flex-1 resize-none max-h-32 px-4 py-2.5 text-sm border border-slate-200 rounded-2xl text-slate-700 bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim() || isSending || extracting}
            className="w-11 h-11 shrink-0 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white flex items-center justify-center shadow-[0_4px_14px_0_rgb(79,70,229,0.39)] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <ToolLayout
      icon={<Sparkles size={20} strokeWidth={2} />}
      title="Ask AI"
      description="Chat with your PDF and get instant AI summaries."
      accentClass="from-indigo-500 to-violet-500"
      panel={panel}
      hideSecurityNote
    >
      {mainArea}
    </ToolLayout>
  );
}
