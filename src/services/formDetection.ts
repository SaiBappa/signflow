/* ============================================================================
 * Form field detection engine — auto-recognises where AcroForm fields belong
 * in a static PDF (Acrobat "Prepare Form" style), using pdf.js to read text +
 * vector geometry, then a set of layout heuristics to emit DetectedField[].
 *
 * Browser-only, pure module (no React). All output rects follow the shared
 * COORDINATE CONVENTION in formDetectionTypes.ts: TOP-LEFT origin, PDF points,
 * page measured at getViewport({ scale: 1 }).
 * ========================================================================== */

import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - vite ?url import returns a string
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

import type {
  DetectedField,
  DetectedFieldType,
  DetectedRect,
  DetectedPage,
  DetectionResult,
  DetectionOptions,
} from './formDetectionTypes';
import { DEFAULT_DETECTION_OPTIONS } from './formDetectionTypes';

/* ----------------------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------------------- */

export async function detectFormFields(
  input: File | ArrayBuffer | Uint8Array,
  options?: DetectionOptions
): Promise<DetectionResult> {
  const opts: Required<DetectionOptions> = { ...DEFAULT_DETECTION_OPTIONS, ...(options ?? {}) };
  const sensitivity = clamp(opts.sensitivity, 0, 1);

  const bytes = await toUint8Array(input);
  // pdf.js may detach/transfer the buffer, so hand it a private COPY — the
  // caller reuses the original bytes for export.
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;

  const pages: DetectedPage[] = [];
  const fields: DetectedField[] = [];
  const usedNames = new Set<string>();

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    try {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      const pageIndex = pageNum - 1;
      const pageW = viewport.width;
      const pageH = viewport.height;
      pages.push({ pageIndex, width: pageW, height: pageH });

      // --- gather text items in top-left viewport space -------------------
      const textContent = await page.getTextContent();
      const items: TextItem[] = [];
      for (const raw of textContent.items as any[]) {
        if (typeof raw.str !== 'string') continue;
        const t = raw.transform as number[]; // [a,b,c,d,e,f], e,f = bottom-left x,y
        const [vx, vy] = viewport.convertToViewportPoint(t[4], t[5]); // baseline, top-left origin
        const fontSize = Math.hypot(t[2], t[3]) || raw.height || 10;
        const itemH = raw.height || fontSize;
        const width = raw.width ?? 0;
        items.push({
          str: raw.str,
          x: vx,
          baselineY: vy,
          top: vy - itemH,
          width,
          height: itemH,
          fontSize,
        });
      }

      // --- gather vector lines / rects from the operator list -------------
      let lines: VecLine[] = [];
      let rects: VecRect[] = [];
      try {
        const geo = await extractVectorGeometry(page, viewport);
        lines = geo.lines;
        rects = geo.rects;
      } catch (e) {
        // vector parsing is best-effort; fall back to text-only heuristics
        console.error(`formDetection: vector parse failed on page ${pageNum}`, e);
      }

      const candidates: DetectedField[] = [];

      if (opts.detectText) {
        detectUnderscoreRuns(items, pageIndex, pageW, pageH, sensitivity, opts, candidates);
        detectLabelGap(items, pageIndex, pageW, pageH, sensitivity, opts, candidates);
        detectRuledLines(lines, items, pageIndex, pageW, pageH, sensitivity, opts, candidates);
      }
      if (opts.detectCheckbox) {
        detectCheckboxRects(rects, items, pageIndex, pageW, pageH, candidates);
        detectCheckboxGlyphs(items, pageIndex, pageW, pageH, candidates);
      }

      // de-dup within the page, then assign unique names
      const deduped = dedupeByIoU(candidates, 0.6);
      for (const f of deduped) {
        f.name = uniqueName(f.name, usedNames);
        fields.push(f);
      }
    } catch (e) {
      // one bad page must not abort the whole document
      console.error(`formDetection: failed to process page ${pageNum}`, e);
    }
  }

  // Sort: page, then top-to-bottom, then left-to-right.
  fields.sort(
    (a, b) =>
      a.pageIndex - b.pageIndex ||
      a.rect.y - b.rect.y ||
      a.rect.x - b.rect.x
  );

  return { fields, pages };
}

/* ----------------------------------------------------------------------------
 * Internal working types
 * ------------------------------------------------------------------------- */

interface TextItem {
  str: string;
  x: number;          // left edge, top-left origin
  baselineY: number;  // text baseline y (top-left origin)
  top: number;        // approx top of glyph box
  width: number;
  height: number;
  fontSize: number;
}

/** A horizontal vector segment in top-left viewport space. */
interface VecLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** A vector rectangle in top-left viewport space. */
interface VecRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/* ----------------------------------------------------------------------------
 * Heuristic 1a — underscore runs ("Name: _______")
 * ------------------------------------------------------------------------- */

function detectUnderscoreRuns(
  items: TextItem[],
  pageIndex: number,
  pageW: number,
  pageH: number,
  sensitivity: number,
  opts: Required<DetectionOptions>,
  out: DetectedField[]
): void {
  // Higher sensitivity → accept shorter runs (down to 3 underscores).
  const minUnderscores = lerpInt(5, 3, sensitivity);

  for (const item of items) {
    const matches = [...item.str.matchAll(/_{3,}/g)];
    if (!matches.length) continue;
    if (item.width <= 0) continue;
    // average glyph width to position the run inside the text item
    const glyphW = item.width / Math.max(1, item.str.length);

    for (const m of matches) {
      const run = m[0];
      if (run.length < minUnderscores) continue;
      const startIdx = m.index ?? 0;
      const runX = item.x + startIdx * glyphW;
      const runW = run.length * glyphW;
      if (runW < 12) continue;

      const fh = clamp(item.fontSize * 1.6, 14, 28);
      // The underscore sits near the baseline; place the field bottom there.
      const top = item.baselineY - fh + Math.min(4, item.fontSize * 0.3);
      const rect = clampRect({ x: runX, y: top, width: runW, height: fh }, pageW, pageH);
      if (!rect) continue;

      // Label = text before this run in the same item, else nearest item to left.
      const inlineLabel = item.str.slice(0, startIdx).replace(/[_:\s]+$/g, '').trim();
      const label = inlineLabel || findLabelLeft(items, item, item.baselineY) || undefined;

      const type = classifyByLabel(label, opts);
      out.push(makeField(type, pageIndex, rect, label, 0.85));
    }
  }
}

/* ----------------------------------------------------------------------------
 * Heuristic 1b — "Label:" followed by a horizontal gap
 * ------------------------------------------------------------------------- */

function detectLabelGap(
  items: TextItem[],
  pageIndex: number,
  pageW: number,
  pageH: number,
  sensitivity: number,
  opts: Required<DetectionOptions>,
  out: DetectedField[]
): void {
  // Higher sensitivity → accept smaller gaps.
  const minGap = lerp(60, 28, sensitivity);

  // group items by line (similar baseline)
  const sorted = [...items].sort((a, b) => a.baselineY - b.baselineY || a.x - b.x);

  for (let i = 0; i < sorted.length; i++) {
    const it = sorted[i];
    const trimmed = it.str.trimEnd();
    if (!trimmed.endsWith(':')) continue;
    if (it.width <= 0) continue;

    const colonRight = it.x + it.width;
    const lineTol = Math.max(3, it.fontSize * 0.5);

    // find the next text item to the right on the same line
    let next: TextItem | null = null;
    for (const other of items) {
      if (other === it) continue;
      if (Math.abs(other.baselineY - it.baselineY) > lineTol) continue;
      if (other.x <= colonRight + 1) continue;
      if (!next || other.x < next.x) next = other;
    }

    const rightBound = next ? next.x - 2 : pageW - 36; // right margin fallback
    const gap = rightBound - colonRight;
    if (gap < minGap) continue;

    const fh = clamp(it.fontSize * 1.6, 14, 28);
    const top = it.baselineY - fh + Math.min(4, it.fontSize * 0.3);
    const rect = clampRect(
      { x: colonRight + 2, y: top, width: gap, height: fh },
      pageW,
      pageH
    );
    if (!rect) continue;

    const label = trimmed.replace(/:\s*$/, '').trim() || undefined;
    const type = classifyByLabel(label, opts);
    out.push(makeField(type, pageIndex, rect, label, 0.7));
  }
}

/* ----------------------------------------------------------------------------
 * Heuristic 1c — ruled horizontal lines used as write-on rules
 * ------------------------------------------------------------------------- */

function detectRuledLines(
  lines: VecLine[],
  items: TextItem[],
  pageIndex: number,
  pageW: number,
  pageH: number,
  sensitivity: number,
  opts: Required<DetectionOptions>,
  out: DetectedField[]
): void {
  const minLen = lerp(60, 40, sensitivity);

  // Keep near-horizontal, long, thin segments.
  const horiz = lines
    .filter((l) => Math.abs(l.y2 - l.y1) < 3 && Math.abs(l.x2 - l.x1) >= minLen)
    .map((l) => ({
      x: Math.min(l.x1, l.x2),
      y: (l.y1 + l.y2) / 2,
      w: Math.abs(l.x2 - l.x1),
    }));

  if (!horiz.length) return;

  // Detect table-like grids: many horizontal lines sharing near-identical
  // x-extent at regular spacing → treat as a table, lower confidence / skip.
  const tableYs = detectGridRows(horiz);

  for (const ln of horiz) {
    const isTableRow = tableYs.has(Math.round(ln.y));
    const fh = 18;
    const top = ln.y - fh + 3; // field rests on the line
    const rect = clampRect({ x: ln.x, y: top, width: ln.w, height: fh }, pageW, pageH);
    if (!rect) continue;

    // label: a "...:" item just to the left, or a word directly above
    const label =
      findLabelLeft(items, { x: ln.x, baselineY: ln.y, width: 0 } as any, ln.y) ||
      findLabelAbove(items, ln.x, ln.x + ln.w, ln.y) ||
      undefined;

    const type = classifyByLabel(label, opts);
    const confidence = isTableRow ? 0.35 : 0.6;
    // In a likely table, only emit at high sensitivity.
    if (isTableRow && sensitivity < 0.7) continue;
    out.push(makeField(type, pageIndex, rect, label, confidence));
  }
}

/** Returns the set of (rounded) y values that look like rows of a table grid. */
function detectGridRows(horiz: { x: number; y: number; w: number }[]): Set<number> {
  const result = new Set<number>();
  if (horiz.length <= 6) return result;
  // bucket lines that share near-identical left x and width
  const byExtent = new Map<string, { x: number; y: number; w: number }[]>();
  for (const l of horiz) {
    const key = `${Math.round(l.x / 4)}:${Math.round(l.w / 4)}`;
    const arr = byExtent.get(key) ?? [];
    arr.push(l);
    byExtent.set(key, arr);
  }
  for (const arr of byExtent.values()) {
    if (arr.length <= 6) continue;
    const ys = arr.map((a) => a.y).sort((a, b) => a - b);
    // check for roughly regular spacing
    const gaps: number[] = [];
    for (let i = 1; i < ys.length; i++) gaps.push(ys[i] - ys[i - 1]);
    const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const regular = gaps.every((g) => Math.abs(g - avg) < Math.max(3, avg * 0.4));
    if (regular) ys.forEach((y) => result.add(Math.round(y)));
  }
  return result;
}

/* ----------------------------------------------------------------------------
 * Heuristic 2a — vector checkbox squares
 * ------------------------------------------------------------------------- */

function detectCheckboxRects(
  rects: VecRect[],
  items: TextItem[],
  pageIndex: number,
  pageW: number,
  pageH: number,
  out: DetectedField[]
): void {
  for (const r of rects) {
    const side = (r.width + r.height) / 2;
    if (side < 6 || side > 20) continue;
    const aspect = r.width / Math.max(0.1, r.height);
    if (aspect < 0.7 || aspect > 1.4) continue; // near-square only

    const rect = clampRect(
      { x: r.x, y: r.y, width: clamp(r.width, 10, 18), height: clamp(r.height, 10, 18) },
      pageW,
      pageH
    );
    if (!rect) continue;

    // checkbox label is preferably the text to the right, else to the left
    const cy = r.y + r.height / 2;
    const label =
      findLabelRight(items, r.x + r.width, cy) || findLabelLeft2(items, r.x, cy) || undefined;
    out.push(makeField('checkbox', pageIndex, rect, label, 0.75));
  }
}

/* ----------------------------------------------------------------------------
 * Heuristic 2b — checkbox-like glyphs in text
 * ------------------------------------------------------------------------- */

const CHECKBOX_GLYPHS = ['[ ]', '[]', '☐', '❏', '□', '▢', '( )'];

function detectCheckboxGlyphs(
  items: TextItem[],
  pageIndex: number,
  pageW: number,
  pageH: number,
  out: DetectedField[]
): void {
  for (const item of items) {
    if (item.width <= 0) continue;
    const glyphW = item.width / Math.max(1, item.str.length);

    for (const g of CHECKBOX_GLYPHS) {
      let from = 0;
      let idx: number;
      while ((idx = item.str.indexOf(g, from)) !== -1) {
        from = idx + g.length;
        const gx = item.x + idx * glyphW;
        const sizePts = clamp(item.fontSize, 10, 18);
        const top = item.baselineY - sizePts + 2;
        const rect = clampRect(
          { x: gx, y: top, width: sizePts, height: sizePts },
          pageW,
          pageH
        );
        if (!rect) continue;

        // label = remaining text after the glyph in the same item, else nearest right
        const after = item.str.slice(idx + g.length).replace(/^[\s:]+/, '').trim();
        const label =
          after || findLabelRight(items, gx + sizePts, item.baselineY) || undefined;
        out.push(makeField('checkbox', pageIndex, rect, label, 0.65));
      }
    }
  }
}

/* ----------------------------------------------------------------------------
 * Vector geometry extraction from the operator list (best-effort)
 * ------------------------------------------------------------------------- */

async function extractVectorGeometry(
  page: any,
  viewport: any
): Promise<{ lines: VecLine[]; rects: VecRect[] }> {
  const ops = await page.getOperatorList();
  const OPS = pdfjsLib.OPS;
  const lines: VecLine[] = [];
  const rects: VecRect[] = [];

  // Maintain a current transform matrix stack (PDF user space).
  let ctm: number[] = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];

  const toVP = (x: number, y: number): [number, number] => {
    // apply current transform, then viewport (→ top-left origin)
    const ux = ctm[0] * x + ctm[2] * y + ctm[4];
    const uy = ctm[1] * x + ctm[3] * y + ctm[5];
    return viewport.convertToViewportPoint(ux, uy) as [number, number];
  };

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];

    if (fn === OPS.save) {
      stack.push(ctm.slice());
    } else if (fn === OPS.restore) {
      ctm = stack.pop() ?? ctm;
    } else if (fn === OPS.transform) {
      ctm = multiply(ctm, args as number[]);
    } else if (fn === OPS.constructPath) {
      // The constructPath arg shape changed across pdf.js majors:
      //   v3/v4: [subOps:number[], coords:number[]]
      //   v5+  : [opCode:number, pathBuffers:any[], bbox:Float32Array]
      // Handle both; v5 exposes a stable per-path bounding box we lean on.
      handleConstructPath(args, toVP, lines, rects);
    } else if (fn === OPS.rectangle) {
      // args = [x, y, w, h] in user space (legacy standalone `re`)
      pushRect(args[0], args[1], args[2], args[3], toVP, rects);
    }
  }
  return { lines, rects };
}

/** Dispatch a constructPath op to the legacy or v5 parser by arg shape. */
function handleConstructPath(
  args: any,
  toVP: (x: number, y: number) => [number, number],
  lines: VecLine[],
  rects: VecRect[]
): void {
  const a0 = args?.[0];
  const a1 = args?.[1];
  const a2 = args?.[2];

  // ---- Legacy (v3/v4): a0 = sub-ops array, a1 = flat coords ----
  if (Array.isArray(a0) && Array.isArray(a1)) {
    parseConstructPathLegacy(a0, a1, toVP, lines, rects);
    return;
  }

  // ---- v5+: classify the path by its bounding box (a2). This reliably
  // captures checkbox squares (square bbox) and single ruled lines (thin
  // bbox) without depending on the internal path-buffer encoding. ----
  const bbox = toNumArray(a2);
  if (bbox && bbox.length >= 4) {
    // bbox = [minX, minY, maxX, maxY] in path-local user space.
    const [ax, ay] = toVP(bbox[0], bbox[1]);
    const [bx, by] = toVP(bbox[2], bbox[3]);
    const x = Math.min(ax, bx);
    const y = Math.min(ay, by);
    const w = Math.abs(bx - ax);
    const h = Math.abs(by - ay);
    classifyBox(x, y, w, h, lines, rects);
  }
}

/** Legacy constructPath parser: walk sub-ops (moveTo/lineTo/rectangle/curve). */
function parseConstructPathLegacy(
  subOps: number[],
  coords: number[],
  toVP: (x: number, y: number) => [number, number],
  lines: VecLine[],
  rects: VecRect[]
): void {
  const OPS = pdfjsLib.OPS;

  let ci = 0;
  let cur: [number, number] | null = null;
  const next = (): number => coords[ci++];

  for (const sub of subOps) {
    if (sub === OPS.moveTo) {
      const x = next();
      const y = next();
      cur = [x, y];
    } else if (sub === OPS.lineTo) {
      const x = next();
      const y = next();
      if (cur) {
        const [ax, ay] = toVP(cur[0], cur[1]);
        const [bx, by] = toVP(x, y);
        lines.push({ x1: ax, y1: ay, x2: bx, y2: by });
      }
      cur = [x, y];
    } else if (sub === OPS.curveTo) {
      // skip the control points; advance the cursor to the end point
      next(); next(); next(); next();
      const x = next();
      const y = next();
      cur = [x, y];
    } else if (sub === OPS.rectangle) {
      const x = next();
      const y = next();
      const w = next();
      const h = next();
      pushRect(x, y, w, h, toVP, rects);
      cur = null;
    } else {
      // unknown sub-op: we can't know its arg count, so stop parsing this path
      break;
    }
  }
}

/** Classify a viewport-space bounding box as a thin line or a filled rect. */
function classifyBox(
  x: number,
  y: number,
  w: number,
  h: number,
  lines: VecLine[],
  rects: VecRect[]
): void {
  const minDim = Math.min(w, h);
  const maxDim = Math.max(w, h);
  if (maxDim <= 1) return;
  if (minDim < 3 && maxDim >= 8) {
    // A thin elongated box → treat as a rule along its long axis.
    if (w >= h) lines.push({ x1: x, y1: y + h / 2, x2: x + w, y2: y + h / 2 });
    else lines.push({ x1: x + w / 2, y1: y, x2: x + w / 2, y2: y + h });
  } else if (w > 1 && h > 1) {
    rects.push({ x, y, width: w, height: h });
  }
}

/** Coerce a Float32Array / number[] / array-like into a plain number[]. */
function toNumArray(v: any): number[] | null {
  if (!v) return null;
  if (Array.isArray(v)) return v;
  if (ArrayBuffer.isView(v) && typeof (v as any).length === 'number') {
    return Array.from(v as any as ArrayLike<number>);
  }
  if (typeof v.length === 'number') return Array.from(v as ArrayLike<number>);
  return null;
}

/** Push a rectangle (user-space x,y,w,h) into the rect list, in viewport space. */
function pushRect(
  x: number,
  y: number,
  w: number,
  h: number,
  toVP: (x: number, y: number) => [number, number],
  rects: VecRect[]
): void {
  const [ax, ay] = toVP(x, y);
  const [bx, by] = toVP(x + w, y + h);
  const rx = Math.min(ax, bx);
  const ry = Math.min(ay, by);
  const rw = Math.abs(bx - ax);
  const rh = Math.abs(by - ay);
  if (rw <= 0 || rh <= 0) return;
  rects.push({ x: rx, y: ry, width: rw, height: rh });
}

/** Multiply two 2x3 affine matrices ([a,b,c,d,e,f]); applies m2 then m1. */
function multiply(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

/* ----------------------------------------------------------------------------
 * Label lookup helpers
 * ------------------------------------------------------------------------- */

/** Nearest text item ending before x on the same line, returned as label text. */
function findLabelLeft(
  items: TextItem[],
  ref: { x: number; baselineY: number; width: number },
  lineY: number
): string | undefined {
  const tol = 6;
  let best: TextItem | null = null;
  for (const it of items) {
    if (Math.abs(it.baselineY - lineY) > tol) continue;
    const right = it.x + it.width;
    if (right > ref.x + 1) continue; // must be to the left
    if (!it.str.trim()) continue;
    if (!best || right > best.x + best.width) best = it;
  }
  return best ? cleanLabel(best.str) : undefined;
}

/** Like findLabelLeft but takes a center-y (for checkboxes/lines). */
function findLabelLeft2(items: TextItem[], leftX: number, cy: number): string | undefined {
  let best: TextItem | null = null;
  let bestDist = Infinity;
  for (const it of items) {
    if (Math.abs(it.baselineY - cy) > 8) continue;
    const right = it.x + it.width;
    if (right > leftX + 1) continue;
    const d = leftX - right;
    if (d < bestDist && it.str.trim()) {
      bestDist = d;
      best = it;
    }
  }
  return best && bestDist < 120 ? cleanLabel(best.str) : undefined;
}

/** Nearest text item starting after x on the same line. */
function findLabelRight(items: TextItem[], rightX: number, cy: number): string | undefined {
  let best: TextItem | null = null;
  let bestDist = Infinity;
  for (const it of items) {
    if (Math.abs(it.baselineY - cy) > 8) continue;
    if (it.x < rightX - 1) continue;
    const d = it.x - rightX;
    if (d < bestDist && it.str.trim()) {
      bestDist = d;
      best = it;
    }
  }
  return best && bestDist < 140 ? cleanLabel(best.str) : undefined;
}

/** A word sitting directly above an x-span (for ruled lines). */
function findLabelAbove(
  items: TextItem[],
  x1: number,
  x2: number,
  lineY: number
): string | undefined {
  let best: TextItem | null = null;
  let bestDy = Infinity;
  for (const it of items) {
    const dy = lineY - it.baselineY;
    if (dy <= 0 || dy > 26) continue; // just above
    const midX = it.x + it.width / 2;
    if (midX < x1 - 10 || midX > x2 + 10) continue;
    if (dy < bestDy && it.str.trim()) {
      bestDy = dy;
      best = it;
    }
  }
  return best ? cleanLabel(best.str) : undefined;
}

function cleanLabel(s: string): string {
  return s.replace(/[_]+/g, '').replace(/[:\s]+$/g, '').trim();
}

/* ----------------------------------------------------------------------------
 * Field-type classification by label keywords
 * ------------------------------------------------------------------------- */

function classifyByLabel(
  label: string | undefined,
  opts: Required<DetectionOptions>
): DetectedFieldType {
  if (!label) return 'text';
  const l = label.toLowerCase();
  if (opts.detectSignature && /\b(signature|sign here|signed by|sign)\b/.test(l)) {
    return 'signature';
  }
  if (opts.detectDate && /\bdate\b/.test(l)) {
    return 'date';
  }
  return 'text';
}

/* ----------------------------------------------------------------------------
 * Field construction, naming, dedup, geometry helpers
 * ------------------------------------------------------------------------- */

function makeField(
  type: DetectedFieldType,
  pageIndex: number,
  rect: DetectedRect,
  label: string | undefined,
  confidence: number
): DetectedField {
  return {
    id: crypto.randomUUID(),
    type,
    pageIndex,
    rect,
    name: baseName(label, type),
    label,
    confidence: clamp(confidence, 0, 1),
    enabled: true,
  };
}

/** Base (pre-uniqueness) field name from a label, falling back per type. */
function baseName(label: string | undefined, type: DetectedFieldType): string {
  const sanitized = label ? sanitizeName(label) : '';
  if (sanitized) return sanitized;
  switch (type) {
    case 'checkbox':
      return 'Checkbox_1';
    case 'signature':
      return 'Signature_1';
    case 'date':
      return 'Date_1';
    default:
      return 'Field_1';
  }
}

/** Make a valid AcroForm field name: alphanumeric + underscore, no leading digit. */
function sanitizeName(label: string): string {
  let s = label
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
  if (!s) return '';
  if (/^[0-9]/.test(s)) s = 'F_' + s;
  return s.slice(0, 40);
}

/** Ensure a name is unique across the document by suffixing _2, _3, … */
function uniqueName(base: string, used: Set<string>): string {
  let name = base;
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  // If base already ends in _1, treat that as the first instance counter.
  const m = base.match(/^(.*?)_(\d+)$/);
  const stem = m ? m[1] : base;
  let n = m ? parseInt(m[2], 10) + 1 : 2;
  while (used.has(`${stem}_${n}`)) n++;
  name = `${stem}_${n}`;
  used.add(name);
  return name;
}

/** Drop candidates that overlap a higher-confidence one (IoU > threshold). */
function dedupeByIoU(fields: DetectedField[], threshold: number): DetectedField[] {
  const sorted = [...fields].sort((a, b) => b.confidence - a.confidence);
  const kept: DetectedField[] = [];
  for (const f of sorted) {
    let overlaps = false;
    for (const k of kept) {
      if (iou(f.rect, k.rect) > threshold) {
        overlaps = true;
        break;
      }
    }
    if (!overlaps) kept.push(f);
  }
  return kept;
}

/** Intersection-over-union of two top-left rects. */
function iou(a: DetectedRect, b: DetectedRect): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const iw = x2 - x1;
  const ih = y2 - y1;
  if (iw <= 0 || ih <= 0) return 0;
  const inter = iw * ih;
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}

/** Clamp a rect into page bounds; reject degenerate (<=0 sized) rects. */
function clampRect(r: DetectedRect, pageW: number, pageH: number): DetectedRect | null {
  let { x, y, width, height } = r;
  if (width <= 0 || height <= 0) return null;
  if (x < 0) {
    width += x;
    x = 0;
  }
  if (y < 0) {
    height += y;
    y = 0;
  }
  if (x + width > pageW) width = pageW - x;
  if (y + height > pageH) height = pageH - y;
  if (width <= 1 || height <= 1) return null;
  return { x, y, width, height };
}

/* ----------------------------------------------------------------------------
 * Small math / input utilities
 * ------------------------------------------------------------------------- */

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Linear interpolation between a (sensitivity 0) and b (sensitivity 1). */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

function lerpInt(a: number, b: number, t: number): number {
  return Math.round(lerp(a, b, t));
}

/** Normalise any accepted input to a Uint8Array (without mutating the input). */
async function toUint8Array(input: File | ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  // File / Blob
  const buf = await input.arrayBuffer();
  return new Uint8Array(buf);
}
