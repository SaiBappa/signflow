import * as pdfjsLib from 'pdfjs-dist';
import { matchStandardFont, detectFontStyle, StandardFontKey } from '../utils/fontMatch';

export interface ExtractedRun {
  id: string; // crypto.randomUUID()
  pageIndex: number; // 1-based, the page these came from
  text: string; // the run's text content
  pos: { x: number; y: number; width: number; height: number }; // DISPLAY px, top-left origin
  fontSize: number; // DISPLAY px (font height)
  fontFamily: StandardFontKey;
  bold?: boolean; // recovered from the source font's name/flags
  italic?: boolean;
  canvasWidth: number; // = displayWidth passed in
  canvasHeight: number; // = displayHeight passed in
  bgColor?: string; // sampled later from the canvas (not set here)
  textColor?: string; // sampled later from the canvas (not set here)
}

/** Intermediate per-item record in display-px space, before line grouping. */
interface ItemRecord {
  str: string;
  x: number; // left edge (display px)
  baselineY: number; // baseline (display px)
  fontPx: number; // font height (display px)
  widthPx: number; // advance width (display px)
  fontName: string | undefined;
  bold: boolean;
  italic: boolean;
}

/**
 * Best-effort lookup of the translated pdf.js font object for an item's
 * internal fontName id. The font lands in page.commonObjs once the page has
 * been rendered (which the viewer does before edit mode is usable), and
 * carries the real BaseFont name plus bold/italic/black flags parsed by
 * pdf.js. Never throws — returns {} when the font isn't resolved yet.
 */
function lookupFontObject(
  page: pdfjsLib.PDFPageProxy,
  fontName: string | undefined
): { name?: string; bold?: boolean; italic?: boolean } {
  if (!fontName) return {};
  try {
    const commonObjs = (page as any).commonObjs;
    if (!commonObjs?.has?.(fontName)) return {};
    const font = commonObjs.get(fontName);
    if (!font) return {};
    return {
      name: typeof font.name === 'string' ? font.name : undefined,
      bold: !!(font.bold || font.black),
      italic: !!font.italic,
    };
  } catch {
    return {};
  }
}

/**
 * Extracts positioned text runs from a single PDF page and converts them into the
 * app's display-pixel coordinate space (top-left origin), so each run can later be
 * reproduced as an overlay.
 */
export async function extractPageRuns(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageIndex: number, // 1-based
  displayWidth: number, // clientWidth of the rendered page element in CSS px
  displayHeight: number // clientHeight
): Promise<ExtractedRun[]> {
  const page = await pdfDoc.getPage(pageIndex);
  const vp1 = page.getViewport({ scale: 1.0 }); // width/height in PDF points
  const displayScale = displayWidth / vp1.width;
  const vp = page.getViewport({ scale: displayScale }); // device space, top-left origin
  const tc = await page.getTextContent();
  // pdf.js exposes the resolved font family (e.g. 'serif', 'sans-serif',
  // 'monospace', or the real font name) in the styles map, keyed by the item's
  // internal fontName id. This classifies the font far better than the opaque
  // 'g_d0_f1'-style id, which would otherwise always fall back to Helvetica.
  const styles: Record<string, { fontFamily?: string }> = (tc as any).styles || {};

  // 1. Build intermediate per-item records in display-px space.
  const records: ItemRecord[] = [];
  for (const item of tc.items) {
    // Skip TextMarkedContent items which lack `str`.
    if (!('str' in item)) continue;

    const str = item.str;
    // Skip empty or whitespace-only items.
    if (!str || !str.trim()) continue;

    const t = pdfjsLib.Util.transform(vp.transform, item.transform); // [a,b,c,d,e,f]
    const fontPx = Math.hypot(t[2], t[3]); // font height in display px
    const x = t[4];
    const baselineY = t[5];
    const widthPx = item.width * displayScale; // item.width is advance width in PDF points

    // Prefer the resolved family from styles; fall back to the raw fontName id.
    const resolvedFamily =
      (item.fontName && styles[item.fontName]?.fontFamily) || item.fontName;
    // Style: pdf.js's parsed flags (via the translated font object) are the
    // primary source; the name-based heuristic catches fonts whose flags were
    // not set but whose BaseFont/family name carries '-Bold'/'-Italic'.
    const fontObj = lookupFontObject(page, item.fontName);
    const nameStyle = detectFontStyle(fontObj.name || resolvedFamily);
    records.push({
      str, x, baselineY, fontPx, widthPx,
      fontName: resolvedFamily, // classification still keyed off the styles family (v1.2)
      bold: fontObj.bold || nameStyle.bold,
      italic: fontObj.italic || nameStyle.italic,
    });
  }

  // 2. Sort by baselineY ascending, then x ascending.
  records.sort((a, b) => (a.baselineY - b.baselineY) || (a.x - b.x));

  // 3. Group into lines.
  const groups: ItemRecord[][] = [];
  let current: ItemRecord[] | null = null;
  let groupFontPx = 0;
  let groupBaseline = 0;

  for (const rec of records) {
    if (current) {
      const sameLine = Math.abs(rec.baselineY - groupBaseline) <= 0.5 * groupFontPx;
      const prev = current[current.length - 1];
      const gap = rec.x - (prev.x + prev.widthPx);
      const bigGap = gap > 1.5 * groupFontPx;

      if (sameLine && !bigGap) {
        current.push(rec);
        continue;
      }
    }
    // Start a new group.
    current = [rec];
    groups.push(current);
    groupFontPx = rec.fontPx;
    groupBaseline = rec.baselineY;
  }

  // 4 & 5. Produce one ExtractedRun per group.
  const runs: ExtractedRun[] = [];
  for (const group of groups) {
    const gFontPx = group[0].fontPx;

    // Concatenate text, inserting a space across moderate gaps.
    let text = group[0].str;
    for (let i = 1; i < group.length; i++) {
      const prev = group[i - 1];
      const cur = group[i];
      const gap = cur.x - (prev.x + prev.widthPx);
      const needSpace =
        gap > 0.25 * gFontPx &&
        !/\s$/.test(text) &&
        !/^\s/.test(cur.str);
      text += (needSpace ? ' ' : '') + cur.str;
    }
    text = text.trim();
    if (!text) continue;

    const minX = Math.min(...group.map((r) => r.x));
    const maxBaseline = Math.max(...group.map((r) => r.baselineY));
    const maxFontPx = Math.max(...group.map((r) => r.fontPx));
    const maxRight = Math.max(...group.map((r) => r.x + r.widthPx));

    runs.push({
      id: crypto.randomUUID(),
      pageIndex,
      text,
      pos: {
        x: minX,
        y: maxBaseline - maxFontPx, // top of the tallest glyph
        width: Math.max(maxRight - minX, 4),
        height: maxFontPx * 1.25,
      },
      fontSize: maxFontPx,
      fontFamily: matchStandardFont(group[0].fontName),
      bold: group[0].bold,
      italic: group[0].italic,
      canvasWidth: displayWidth,
      canvasHeight: displayHeight,
    });
  }

  return runs;
}
