import * as pdfjsLib from 'pdfjs-dist';

/* ============================================================================
 * pdfCompare — core, dependency-free logic for the "Compare PDFs" tool.
 *
 * Two comparison strategies, both 100% client-side:
 *   1. Text diff   — extract each page's text via pdf.js getTextContent(), then
 *                    run a word-level LCS diff to flag additions / removals.
 *   2. Visual diff — rasterise each page to a canvas at a shared scale and
 *                    compare pixels, producing a heat overlay of changed areas.
 *
 * The pure functions here (tokenisation, diffWords, summarise, pixel compare)
 * are unit-tested; the pdf.js-touching helpers are thin wrappers around them.
 * ========================================================================== */

export type DiffOp = 'equal' | 'add' | 'remove';

export interface DiffSegment {
  type: DiffOp;
  /** The token text (word or whitespace run). */
  value: string;
}

/** Per-page text-diff result. */
export interface PageTextDiff {
  /** 1-based page number (of the longer document). */
  page: number;
  /** Diff segments for rendering. Empty `removed`/`added` => page-level add/remove. */
  segments: DiffSegment[];
  added: number;
  removed: number;
  /** True when the page exists in only one of the two documents. */
  status: 'changed' | 'unchanged' | 'added' | 'removed';
}

export interface CompareSummary {
  pagesCompared: number;
  pagesChanged: number;
  pagesAdded: number;
  pagesRemoved: number;
  wordsAdded: number;
  wordsRemoved: number;
}

/**
 * Split text into tokens: each word and each run of whitespace becomes its own
 * token, so the diff aligns on words while preserving spacing for rendering.
 */
export function tokenize(text: string): string[] {
  if (!text) return [];
  // Keep the delimiters (whitespace) as their own tokens.
  return text.match(/\s+|[^\s]+/g) ?? [];
}

/**
 * Word-level diff via the classic LCS dynamic-programming table.
 * Whitespace tokens are diffed too, but compared case- and space-insensitively
 * so a re-flowed line doesn't show up as a sea of changes.
 *
 * Complexity is O(n·m). Pages are tokenised to words (hundreds, not millions),
 * so this stays well within budget; we guard pathological inputs with a cap.
 */
export function diffWords(before: string, after: string): DiffSegment[] {
  const a = tokenize(before);
  const b = tokenize(after);

  // Guard: extremely large token counts fall back to a coarse whole-page diff
  // rather than allocating a huge DP matrix.
  const CAP = 4000;
  if (a.length > CAP || b.length > CAP) {
    const segs: DiffSegment[] = [];
    if (before.trim()) segs.push({ type: 'remove', value: before });
    if (after.trim()) segs.push({ type: 'add', value: after });
    return segs.length ? segs : [{ type: 'equal', value: after }];
  }

  const norm = (t: string) => t.replace(/\s+/g, ' ').trim().toLowerCase();

  // dp[i][j] = LCS length of a[i:] and b[j:]
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = norm(a[i]) === norm(b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  // Backtrack into a segment list, coalescing consecutive ops of the same type.
  const segments: DiffSegment[] = [];
  const push = (type: DiffOp, value: string) => {
    const last = segments[segments.length - 1];
    if (last && last.type === type) last.value += value;
    else segments.push({ type, value });
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (norm(a[i]) === norm(b[j])) {
      push('equal', b[j]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push('remove', a[i]);
      i++;
    } else {
      push('add', b[j]);
      j++;
    }
  }
  while (i < n) push('remove', a[i++]);
  while (j < m) push('add', b[j++]);

  return segments;
}

/** Count added / removed words (whitespace-only segments don't count). */
export function countChanges(segments: DiffSegment[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const s of segments) {
    if (s.value.trim() === '') continue;
    const words = (s.value.match(/[^\s]+/g) ?? []).length;
    if (s.type === 'add') added += words;
    else if (s.type === 'remove') removed += words;
  }
  return { added, removed };
}

/** Extract the plain text of every page of a loaded pdf.js document. */
export async function extractAllPageText(pdf: pdfjsLib.PDFDocumentProxy): Promise<string[]> {
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Re-introduce line breaks at items flagged with EOL so paragraphs survive.
    let text = '';
    for (const item of content.items as Array<{ str?: string; hasEOL?: boolean }>) {
      if (typeof item.str !== 'string') continue;
      text += item.str;
      text += item.hasEOL ? '\n' : ' ';
    }
    pages.push(text.replace(/[ \t]+\n/g, '\n').trim());
    page.cleanup();
  }
  return pages;
}

/** Build the page-by-page text diff for two arrays of page texts. */
export function buildTextDiff(before: string[], after: string[]): { pages: PageTextDiff[]; summary: CompareSummary } {
  const maxPages = Math.max(before.length, after.length);
  const pages: PageTextDiff[] = [];
  const summary: CompareSummary = {
    pagesCompared: maxPages,
    pagesChanged: 0,
    pagesAdded: 0,
    pagesRemoved: 0,
    wordsAdded: 0,
    wordsRemoved: 0,
  };

  for (let p = 0; p < maxPages; p++) {
    const a = before[p];
    const b = after[p];

    if (a === undefined) {
      const { added } = countChanges([{ type: 'add', value: b }]);
      pages.push({ page: p + 1, segments: [{ type: 'add', value: b }], added, removed: 0, status: 'added' });
      summary.pagesAdded++;
      summary.wordsAdded += added;
      continue;
    }
    if (b === undefined) {
      const { removed } = countChanges([{ type: 'remove', value: a }]);
      pages.push({ page: p + 1, segments: [{ type: 'remove', value: a }], added: 0, removed, status: 'removed' });
      summary.pagesRemoved++;
      summary.wordsRemoved += removed;
      continue;
    }

    const segments = diffWords(a, b);
    const { added, removed } = countChanges(segments);
    const status = added === 0 && removed === 0 ? 'unchanged' : 'changed';
    if (status === 'changed') summary.pagesChanged++;
    summary.wordsAdded += added;
    summary.wordsRemoved += removed;
    pages.push({ page: p + 1, segments, added, removed, status });
  }

  return { pages, summary };
}

/** Render a single page of a pdf.js document to a fresh canvas at `scale`. */
export async function renderPageToCanvas(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  scale: number,
): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d')!;
  // White backdrop so transparent PDFs diff against a stable colour.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport } as any).promise;
  return canvas;
}

export interface PixelDiffResult {
  /** Canvas with changed pixels tinted; unchanged pixels dimmed. */
  canvas: HTMLCanvasElement;
  /** Fraction (0–1) of pixels that differ beyond the threshold. */
  changedRatio: number;
}

/**
 * Pixel-compare two equally sized ImageData buffers. Pixels whose colour delta
 * exceeds `threshold` (0–255) are painted in `highlight`; matching pixels are
 * faded to grey so the changes pop. Mismatched sizes are handled by the caller.
 */
export function diffImageData(
  a: ImageData,
  b: ImageData,
  width: number,
  height: number,
  threshold = 32,
  highlight: [number, number, number] = [225, 29, 72], // rose-600
): { data: Uint8ClampedArray; changedRatio: number } {
  const out = new Uint8ClampedArray(width * height * 4);
  let changed = 0;
  for (let i = 0; i < out.length; i += 4) {
    const dr = Math.abs(a.data[i] - b.data[i]);
    const dg = Math.abs(a.data[i + 1] - b.data[i + 1]);
    const db = Math.abs(a.data[i + 2] - b.data[i + 2]);
    const delta = (dr + dg + db) / 3;
    if (delta > threshold) {
      out[i] = highlight[0];
      out[i + 1] = highlight[1];
      out[i + 2] = highlight[2];
      out[i + 3] = 255;
      changed++;
    } else {
      // Dim the matching base image so highlighted changes stand out.
      const grey = (b.data[i] + b.data[i + 1] + b.data[i + 2]) / 3;
      const faded = 200 + grey * 0.22; // wash toward light grey
      out[i] = faded;
      out[i + 1] = faded;
      out[i + 2] = faded;
      out[i + 3] = 255;
    }
  }
  return { data: out, changedRatio: changed / (width * height) };
}

/** Visual-diff two rendered page canvases, returning a tinted overlay canvas. */
export function diffCanvases(a: HTMLCanvasElement, b: HTMLCanvasElement, threshold = 32): PixelDiffResult {
  const width = Math.max(a.width, b.width);
  const height = Math.max(a.height, b.height);

  const normalize = (src: HTMLCanvasElement) => {
    if (src.width === width && src.height === height) {
      return src.getContext('2d')!.getImageData(0, 0, width, height);
    }
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const cx = c.getContext('2d')!;
    cx.fillStyle = '#ffffff';
    cx.fillRect(0, 0, width, height);
    cx.drawImage(src, 0, 0);
    return cx.getImageData(0, 0, width, height);
  };

  const da = normalize(a);
  const db = normalize(b);
  const { data, changedRatio } = diffImageData(da, db, width, height, threshold);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.putImageData(new ImageData(data, width, height), 0, 0);
  return { canvas, changedRatio };
}
