import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFFont, StandardFonts } from 'pdf-lib';

/**
 * Embeds the app's text fonts into a pdf-lib document with real weight/style
 * fidelity. Each (family, bold, italic) combination maps to a bundled,
 * metric-compatible Liberation TTF (Sans≈Helvetica/Arial, Serif≈Times,
 * Mono≈Courier) embedded via fontkit — which also unlocks full-Unicode text
 * (e.g. Thaana via Faruma) that the Standard-14 WinAnsi fonts cannot encode.
 * Standard-14 fonts remain the fallback if a TTF cannot be fetched/embedded.
 */

export interface TextFontSpec {
  family?: string; // TEXT_FONTS value: 'Helvetica' | 'Times' | 'Courier' | 'Faruma'
  bold?: boolean;
  italic?: boolean;
}

/** Canonical lookup key for an embedded (family, bold, italic) combination. */
export function fontSpecKey(family?: string, bold?: boolean, italic?: boolean): string {
  return `${family || 'Helvetica'}${bold ? ':b' : ''}${italic ? ':i' : ''}`;
}

const LIBERATION_BASE: Record<string, string> = {
  Helvetica: 'LiberationSans',
  Times: 'LiberationSerif',
  Courier: 'LiberationMono',
};

const STANDARD_FALLBACK: Record<string, [StandardFonts, StandardFonts, StandardFonts, StandardFonts]> = {
  // [regular, bold, italic, boldItalic]
  Helvetica: [StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique, StandardFonts.HelveticaBoldOblique],
  Times: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold, StandardFonts.TimesRomanItalic, StandardFonts.TimesRomanBoldItalic],
  Courier: [StandardFonts.Courier, StandardFonts.CourierBold, StandardFonts.CourierOblique, StandardFonts.CourierBoldOblique],
};

function fontFileUrl(family: string, bold: boolean, italic: boolean): string | null {
  if (family === 'Faruma') return '/fonts/Faruma.ttf'; // single face; no bold/italic cuts exist
  const base = LIBERATION_BASE[family];
  if (!base) return null;
  const variant = bold && italic ? 'BoldItalic' : bold ? 'Bold' : italic ? 'Italic' : 'Regular';
  return `/fonts/liberation/${base}-${variant}.ttf`;
}

// Font bytes are cached across exports; a failed fetch is evicted so it can retry.
const fontBytesCache = new Map<string, Promise<ArrayBuffer>>();

function fetchFontBytes(url: string): Promise<ArrayBuffer> {
  let cached = fontBytesCache.get(url);
  if (!cached) {
    cached = fetch(url).then(res => {
      if (!res.ok) throw new Error(`Failed to fetch font ${url}: ${res.status}`);
      return res.arrayBuffer();
    });
    cached.catch(() => fontBytesCache.delete(url));
    fontBytesCache.set(url, cached);
  }
  return cached;
}

/**
 * Embeds one (family, bold, italic) combination, preferring the bundled TTF
 * and falling back to the style-matched Standard-14 font.
 */
export async function embedTextFont(
  pdfDoc: PDFDocument,
  family = 'Helvetica',
  bold = false,
  italic = false
): Promise<PDFFont> {
  const url = fontFileUrl(family, bold, italic);
  if (url) {
    try {
      pdfDoc.registerFontkit(fontkit);
      const bytes = await fetchFontBytes(url);
      return await pdfDoc.embedFont(bytes, { subset: true });
    } catch {
      // fall through to Standard-14
    }
  }
  const fallback = STANDARD_FALLBACK[family] || STANDARD_FALLBACK.Helvetica;
  return pdfDoc.embedFont(fallback[(bold ? 1 : 0) + (italic ? 2 : 0)]);
}

/**
 * Embeds every unique spec once and returns them keyed by fontSpecKey().
 * Always includes the regular Helvetica key as the universal fallback.
 */
export async function embedTextFonts(
  pdfDoc: PDFDocument,
  specs: TextFontSpec[]
): Promise<Record<string, PDFFont>> {
  const unique = new Map<string, TextFontSpec>();
  unique.set(fontSpecKey(), {});
  for (const spec of specs) {
    unique.set(fontSpecKey(spec.family, spec.bold, spec.italic), spec);
  }
  const fonts: Record<string, PDFFont> = {};
  await Promise.all(
    Array.from(unique.entries()).map(async ([key, spec]) => {
      fonts[key] = await embedTextFont(pdfDoc, spec.family, spec.bold, spec.italic);
    })
  );
  return fonts;
}
