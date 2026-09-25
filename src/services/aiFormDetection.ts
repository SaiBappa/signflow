/* ============================================================================
 * AI form-field detection — a drop-in alternative to the heuristic engine in
 * formDetection.ts that uses Gemini's multimodal vision to recognise where
 * AcroForm fields belong on a static PDF.
 *
 * Each page is rasterised locally with pdf.js and sent to the model, which
 * returns labelled field boxes. We map those back into the shared
 * DetectionResult contract (TOP-LEFT origin, PDF points at viewport scale 1)
 * so PrepareForm.tsx and the fillable exporter consume it unchanged.
 *
 * Follows the app's Gemini conventions (see AskAI.tsx / Convert.tsx): all calls
 * go through the backend proxy (geminiClient), so the API key stays server-side.
 * ========================================================================== */

import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - vite ?url import returns a string
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

import type {
  DetectedField,
  DetectedFieldType,
  DetectedPage,
  DetectionResult,
  DetectionOptions,
} from './formDetectionTypes';
import { DEFAULT_DETECTION_OPTIONS } from './formDetectionTypes';
import { generateContent, hasUserGeminiKey, serverKeyAvailable } from './geminiClient';

/** Latest Gemini model — Pro-level intelligence at Flash cost/latency, multimodal. */
export const AI_FORM_MODEL = 'gemini-3.5-flash';

const MAX_PAGES = 15;          // cap the number of pages we rasterise + upload
const RENDER_MAX_DIM = 1568;   // longest side (px) of each page image we send
const JPEG_QUALITY = 0.85;

/* ----------------------------------------------------------------------------
 * Public API — mirrors detectFormFields(input, options) from formDetection.ts
 * ------------------------------------------------------------------------- */

export async function detectFormFieldsAI(
  input: File | ArrayBuffer | Uint8Array,
  options?: DetectionOptions,
): Promise<DetectionResult> {
  const canUseAi = hasUserGeminiKey() || (await serverKeyAvailable());
  if (!canUseAi) {
    throw new Error('No Gemini API key available. Add one in the panel, or switch to the offline scanner.');
  }
  const opts: Required<DetectionOptions> = { ...DEFAULT_DETECTION_OPTIONS, ...(options ?? {}) };

  const bytes = await toUint8Array(input);
  // pdf.js may detach the buffer, so hand it a private copy.
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;

  const { pages, images, truncated } = await rasterisePages(doc, MAX_PAGES);
  if (truncated) {
    console.warn(`[aiFormDetection] document has ${doc.numPages} pages; only the first ${MAX_PAGES} were analysed.`);
  }

  const raw = await callGemini(images, opts);
  const fields = mapToFields(raw, pages, opts);
  return { fields, pages };
}

/* ----------------------------------------------------------------------------
 * Rasterise pages to JPEG (top-left origin viewport at scale 1 for geometry)
 * ------------------------------------------------------------------------- */

interface PageImage {
  pageIndex: number;
  base64: string;
  mime: string;
}

async function rasterisePages(
  doc: any,
  maxPages: number,
): Promise<{ pages: DetectedPage[]; images: PageImage[]; truncated: boolean }> {
  const pages: DetectedPage[] = [];
  const images: PageImage[] = [];
  const count = Math.min(doc.numPages, maxPages);

  for (let pageNum = 1; pageNum <= count; pageNum++) {
    const page = await doc.getPage(pageNum);
    const pageIndex = pageNum - 1;

    // Native geometry (points) — the coordinate space DetectedRect lives in.
    const base = page.getViewport({ scale: 1 });
    pages.push({ pageIndex, width: base.width, height: base.height });

    // Render at a scale that caps the longest side, for a legible-but-cheap image.
    const longest = Math.max(base.width, base.height) || 1;
    const scale = Math.min(2, RENDER_MAX_DIM / longest);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get a 2D canvas context to render the PDF.');
    // White backdrop so transparent PDFs don't render black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    images.push({ pageIndex, base64: dataUrl.split(',')[1] ?? '', mime: 'image/jpeg' });
    // Free the bitmap eagerly.
    canvas.width = canvas.height = 0;
  }

  return { pages, images, truncated: doc.numPages > maxPages };
}

/* ----------------------------------------------------------------------------
 * Gemini call
 * ------------------------------------------------------------------------- */

/** One raw field as returned by the model (normalised box, page-relative). */
interface RawField {
  pageIndex: number;
  type: DetectedFieldType;
  /** [ymin, xmin, ymax, xmax], each 0..1000 relative to that page. */
  box: number[];
  label?: string;
  groupName?: string;
  confidence?: number;
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    fields: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pageIndex: { type: 'integer', description: '0-based page index this field appears on.' },
          type: { type: 'string', enum: ['text', 'checkbox', 'radio', 'signature', 'date'] },
          box: {
            type: 'array',
            description: 'Bounding box [ymin, xmin, ymax, xmax], each 0-1000 relative to the page.',
            items: { type: 'number' },
            minItems: 4,
            maxItems: 4,
          },
          label: { type: 'string', description: 'Nearby human label, e.g. "Full Name".' },
          groupName: { type: 'string', description: 'Shared group for radio buttons that belong together.' },
          confidence: { type: 'number', description: '0..1 confidence this is a fillable field.' },
        },
        required: ['pageIndex', 'type', 'box'],
        propertyOrdering: ['pageIndex', 'type', 'box', 'label', 'groupName', 'confidence'],
      },
    },
  },
  required: ['fields'],
} as const;

function buildSystemInstruction(opts: Required<DetectionOptions>): string {
  const wanted = [
    opts.detectText && 'text inputs (blank underlines, "Label:" + gap, ruled write-in lines, empty boxes)',
    opts.detectCheckbox && 'checkboxes (small empty squares, ☐, "[ ]") and radio buttons (small circles / ○ in a group)',
    opts.detectSignature && 'signature lines ("Signature", "Sign here", "Authorised by")',
    opts.detectDate && 'date fields ("Date", "DOB", dd/mm/yyyy blanks)',
  ].filter(Boolean);

  return [
    'You are a meticulous PDF "Prepare Form" engine, like Adobe Acrobat. You are given the rendered pages of a static (non-interactive) document.',
    'Find every place a person would need to WRITE, TYPE, CHECK or SIGN — the empty input regions, not the printed labels themselves.',
    `Detect these field kinds: ${wanted.join('; ')}.`,
    'Rules:',
    '- Return the box for the INPUT area (the blank space / line / box), not the label text.',
    '- Use type "radio" (not "checkbox") for mutually-exclusive option circles, and give every radio in the same question the same groupName.',
    '- Prefer a tight box that a widget would occupy. For underline/ruled lines, give a box of reasonable height above the line.',
    '- Set label to the closest descriptive caption when one exists; omit it otherwise.',
    '- Do NOT invent fields where there is only body text, headings, or already-filled values.',
    '- confidence reflects how sure you are it is a fillable field (1 = certain).',
    'Coordinates: box = [ymin, xmin, ymax, xmax], each an integer 0..1000 relative to the page the field is on. pageIndex is 0-based.',
  ].join('\n');
}

async function callGemini(
  images: PageImage[],
  opts: Required<DetectionOptions>,
): Promise<RawField[]> {
  const parts: any[] = [
    { text: 'Analyse the following page image(s) and return all form fields. Each image is prefixed by its page index.' },
  ];
  for (const img of images) {
    parts.push({ text: `Page index ${img.pageIndex}:` });
    parts.push({ inlineData: { mimeType: img.mime, data: img.base64 } });
  }

  const data = await generateContent(AI_FORM_MODEL, {
    systemInstruction: { parts: [{ text: buildSystemInstruction(opts) }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const text: string = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? '';
  if (!text.trim()) throw new Error('Gemini returned an empty response.');

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Gemini returned malformed JSON.');
  }
  const fields = parsed?.fields;
  return Array.isArray(fields) ? (fields as RawField[]) : [];
}

/* ----------------------------------------------------------------------------
 * Map model output → DetectedField[] in the shared contract
 * ------------------------------------------------------------------------- */

function mapToFields(
  raw: RawField[],
  pages: DetectedPage[],
  opts: Required<DetectionOptions>,
): DetectedField[] {
  const pageByIndex = new Map(pages.map(p => [p.pageIndex, p]));
  const enabledTypes = new Set<DetectedFieldType>([
    ...(opts.detectText ? (['text'] as const) : []),
    ...(opts.detectCheckbox ? (['checkbox', 'radio'] as const) : []),
    ...(opts.detectSignature ? (['signature'] as const) : []),
    ...(opts.detectDate ? (['date'] as const) : []),
  ]);
  // Higher sensitivity keeps lower-confidence fields. 0.5 -> 0.3 threshold.
  const minConfidence = clamp(0.55 - opts.sensitivity * 0.45, 0, 0.9);

  const used = new Set<string>();
  const out: DetectedField[] = [];

  for (const r of raw) {
    const page = pageByIndex.get(r.pageIndex);
    if (!page) continue;
    const type = r.type;
    if (!enabledTypes.has(type)) continue;
    if (!Array.isArray(r.box) || r.box.length < 4) continue;

    const confidence = clamp(typeof r.confidence === 'number' ? r.confidence : 0.75, 0, 1);
    if (confidence < minConfidence) continue;

    // box = [ymin, xmin, ymax, xmax] in 0..1000 → top-left PDF points.
    let [ymin, xmin, ymax, xmax] = r.box.map(Number);
    if (xmax < xmin) [xmin, xmax] = [xmax, xmin];
    if (ymax < ymin) [ymin, ymax] = [ymax, ymin];

    const x = (clamp(xmin, 0, 1000) / 1000) * page.width;
    const y = (clamp(ymin, 0, 1000) / 1000) * page.height;
    const width = ((clamp(xmax, 0, 1000) - clamp(xmin, 0, 1000)) / 1000) * page.width;
    const height = ((clamp(ymax, 0, 1000) - clamp(ymin, 0, 1000)) / 1000) * page.height;
    if (width < 2 || height < 2) continue; // discard degenerate boxes

    const name = uniqueName(baseName(r.label, type), used);

    out.push({
      id: `ai-${r.pageIndex}-${out.length}-${name}`,
      type,
      pageIndex: r.pageIndex,
      rect: { x, y, width, height },
      name,
      label: r.label?.trim() || undefined,
      confidence,
      enabled: true,
      groupName: type === 'radio' ? r.groupName?.trim() || undefined : undefined,
    });
  }

  // Stable, useful order: by page, then top-to-bottom, then left-to-right.
  out.sort((a, b) =>
    a.pageIndex - b.pageIndex || a.rect.y - b.rect.y || a.rect.x - b.rect.x,
  );
  return out;
}

/* ----------------------------------------------------------------------------
 * Small helpers (mirrors the conventions in formDetection.ts)
 * ------------------------------------------------------------------------- */

function baseName(label: string | undefined, type: DetectedFieldType): string {
  const sanitized = label ? sanitizeName(label) : '';
  if (sanitized) return sanitized;
  switch (type) {
    case 'checkbox': return 'Checkbox_1';
    case 'radio': return 'Option_1';
    case 'signature': return 'Signature_1';
    case 'date': return 'Date_1';
    default: return 'Field_1';
  }
}

/** Valid AcroForm field name: alphanumeric + underscore, no leading digit. */
function sanitizeName(label: string): string {
  let s = label
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
  if (!s) return '';
  if (/^[0-9]/.test(s)) s = 'F_' + s;
  return s.slice(0, 40);
}

function uniqueName(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  const m = base.match(/^(.*?)_(\d+)$/);
  const stem = m ? m[1] : base;
  let n = m ? parseInt(m[2], 10) + 1 : 2;
  while (used.has(`${stem}_${n}`)) n++;
  const name = `${stem}_${n}`;
  used.add(name);
  return name;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));
}

async function toUint8Array(input: File | ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  return new Uint8Array(await input.arrayBuffer());
}
