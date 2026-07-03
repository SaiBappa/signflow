import { describe, it, expect, vi } from 'vitest';

// pdfjs-dist's main entry evaluates `canvas.js`, which references DOMMatrix /
// Path2D at module-load time. jsdom does not provide these, so importing the
// service (which imports pdfjsLib) throws ReferenceError before any test runs.
// Polyfill the few globals pdf.js touches at import time, BEFORE the static
// imports below are evaluated (vi.hoisted runs before the import phase).
vi.hoisted(() => {
  const g = globalThis as any;
  if (typeof g.DOMMatrix === 'undefined') {
    g.DOMMatrix = class DOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      constructor(_init?: any) {}
    };
  }
  if (typeof g.Path2D === 'undefined') {
    g.Path2D = class Path2D {
      constructor(_init?: any) {}
      addPath() {}
      moveTo() {}
      lineTo() {}
      closePath() {}
    };
  }
  if (typeof g.ImageData === 'undefined') {
    g.ImageData = class ImageData {
      constructor(_w?: any, _h?: any) {}
    };
  }
});

import { matchStandardFont, detectFontStyle } from '../utils/fontMatch';
import { extractPageRuns } from '../services/textExtraction';

describe('matchStandardFont', () => {
  it('maps courier to Courier', () => {
    expect(matchStandardFont('CourierNewPSMT')).toBe('Courier');
  });
  it('maps mono to Courier', () => {
    expect(matchStandardFont('Roboto Mono')).toBe('Courier');
  });
  it('maps consol to Courier', () => {
    expect(matchStandardFont('Consolas')).toBe('Courier');
  });
  it('maps times to Times', () => {
    expect(matchStandardFont('TimesNewRomanPSMT')).toBe('Times');
  });
  it('maps georgia to Times', () => {
    expect(matchStandardFont('Georgia-Bold')).toBe('Times');
  });
  it('maps serif to Times', () => {
    expect(matchStandardFont('Some Serif Font')).toBe('Times');
  });
  it('maps roman to Times', () => {
    expect(matchStandardFont('Roman')).toBe('Times');
  });
  it('maps garamond to Times', () => {
    expect(matchStandardFont('EB Garamond')).toBe('Times');
  });
  it('maps minion to Times', () => {
    expect(matchStandardFont('MinionPro')).toBe('Times');
  });
  it('does NOT match sans-serif as serif -> Helvetica', () => {
    expect(matchStandardFont('Open Sans-Serif')).toBe('Helvetica');
  });
  it('does NOT match sansserif as serif -> Helvetica', () => {
    expect(matchStandardFont('SansSerif')).toBe('Helvetica');
  });
  it('maps plain sans font -> Helvetica', () => {
    expect(matchStandardFont('Open Sans')).toBe('Helvetica');
  });
  it('defaults undefined -> Helvetica', () => {
    expect(matchStandardFont(undefined)).toBe('Helvetica');
  });
  it('defaults null -> Helvetica', () => {
    expect(matchStandardFont(null)).toBe('Helvetica');
  });
  it('defaults empty string -> Helvetica', () => {
    expect(matchStandardFont('')).toBe('Helvetica');
  });
  it('defaults whitespace-only -> Helvetica', () => {
    expect(matchStandardFont('   ')).toBe('Helvetica');
  });
  it('defaults Arial -> Helvetica', () => {
    expect(matchStandardFont('ArialMT')).toBe('Helvetica');
  });
  it('matches case-insensitively', () => {
    expect(matchStandardFont('COURIER')).toBe('Courier');
    expect(matchStandardFont('TIMES')).toBe('Times');
  });
});

describe('extractPageRuns coordinate math', () => {
  const displayWidth = 306; // scale 0.5 of 612pt
  const displayHeight = 396; // scale 0.5 of 792pt

  // pdf.js display viewport at scale 0.5 with height 792 -> [0.5, 0, 0, -0.5, 0, 396]
  const vpTransform = [0.5, 0, 0, -0.5, 0, 396];

  const fakePage = {
    getViewport({ scale }: { scale: number }) {
      return {
        width: 612 * scale,
        height: 792 * scale,
        transform: scale === 0.5 ? vpTransform : [scale, 0, 0, -scale, 0, 792 * scale],
      };
    },
    async getTextContent() {
      return {
        items: [
          { str: 'Hello', fontName: 'g_f1', width: 40, height: 12, transform: [12, 0, 0, 12, 72, 700] },
          { str: '   ', fontName: 'g_f1', width: 10, height: 12, transform: [12, 0, 0, 12, 72, 680] },
          { /* no str -> TextMarkedContent, skip */ type: 'beginMarkedContent' },
        ],
      };
    },
  };

  const fakeDoc = {
    async getPage(_pageIndex: number) {
      return fakePage;
    },
  } as any;

  it('produces exactly one run, skipping whitespace and no-str items', async () => {
    const runs = await extractPageRuns(fakeDoc, 1, displayWidth, displayHeight);
    expect(runs).toHaveLength(1);
  });

  it('computes correct display-px coordinates for Hello', async () => {
    const runs = await extractPageRuns(fakeDoc, 1, displayWidth, displayHeight);
    const run = runs[0];

    // Util.transform([0.5,0,0,-0.5,0,396], [12,0,0,12,72,700]):
    //   a = 0.5*12 = 6, b = 0, c = 0, d = -0.5*12 = -6
    //   e = 0.5*72 + 0 = 36
    //   f = -0.5*700 + 396 = 46
    // fontPx = hypot(c=0, d=-6) = 6
    // x = 36, baselineY = 46, topY = 46 - 6 = 40
    // width = 40 * 0.5 = 20
    expect(run.text).toBe('Hello');
    expect(run.pos.x).toBeCloseTo(36, 5);
    expect(run.pos.y).toBeCloseTo(40, 5);
    expect(run.pos.width).toBeCloseTo(20, 5);
    expect(run.pos.height).toBeCloseTo(7.5, 5); // 6 * 1.25
    expect(run.fontSize).toBeCloseTo(6, 5);
    expect(run.fontFamily).toBe('Helvetica');
    expect(run.pageIndex).toBe(1);
    expect(run.canvasWidth).toBe(displayWidth);
    expect(run.canvasHeight).toBe(displayHeight);
    expect(typeof run.id).toBe('string');
    expect(run.id.length).toBeGreaterThan(0);
  });

  it('merges two close items on the same baseline into ONE run with a space', async () => {
    // First: x=72pt -> display x=36, width 40pt -> 20 display px, right edge = 56.
    // Second: x=120pt -> display x=60, gap = 60-56 = 4.
    //   groupFontPx = 6; 0.25*6 = 1.5 -> 4 > 1.5 => space; 1.5*6 = 9 -> 4 <= 9 => same group.
    const mergePage = {
      getViewport: fakePage.getViewport,
      async getTextContent() {
        return {
          items: [
            { str: 'Hello', fontName: 'g_f1', width: 40, height: 12, transform: [12, 0, 0, 12, 72, 700] },
            { str: 'World', fontName: 'g_f1', width: 40, height: 12, transform: [12, 0, 0, 12, 120, 700] },
          ],
        };
      },
    };
    const mergeDoc = { async getPage() { return mergePage; } } as any;
    const runs = await extractPageRuns(mergeDoc, 1, displayWidth, displayHeight);
    expect(runs).toHaveLength(1);
    expect(runs[0].text).toBe('Hello World');
    expect(runs[0].pos.x).toBeCloseTo(36, 5);
    // combined width: maxRight (60+20=80) - minX (36) = 44
    expect(runs[0].pos.width).toBeCloseTo(44, 5);
    expect(runs[0].fontSize).toBeCloseTo(6, 5);
  });

  it('keeps two items on DIFFERENT baselines as TWO separate runs', async () => {
    // Same x, baselines 700 and 660 (display 46 and 66, diff 20 >> 0.5*6=3).
    const twoLinePage = {
      getViewport: fakePage.getViewport,
      async getTextContent() {
        return {
          items: [
            { str: 'Hello', fontName: 'g_f1', width: 40, height: 12, transform: [12, 0, 0, 12, 72, 700] },
            { str: 'World', fontName: 'g_f1', width: 40, height: 12, transform: [12, 0, 0, 12, 72, 660] },
          ],
        };
      },
    };
    const twoLineDoc = { async getPage() { return twoLinePage; } } as any;
    const runs = await extractPageRuns(twoLineDoc, 1, displayWidth, displayHeight);
    expect(runs).toHaveLength(2);
    const texts = runs.map((r) => r.text).sort();
    expect(texts).toEqual(['Hello', 'World']);
  });

  it('does NOT set bgColor/textColor in this module', async () => {
    const runs = await extractPageRuns(fakeDoc, 1, displayWidth, displayHeight);
    expect(runs[0].bgColor).toBeUndefined();
    expect(runs[0].textColor).toBeUndefined();
  });

  it('resolves font family from the styles map (serif -> Times, monospace -> Courier)', async () => {
    const styledPage = {
      getViewport: fakePage.getViewport,
      async getTextContent() {
        return {
          // The styles map keys the resolved family by the item's fontName id.
          styles: { g_serif: { fontFamily: 'serif' }, g_mono: { fontFamily: 'monospace' } },
          items: [
            { str: 'Serif', fontName: 'g_serif', width: 40, height: 12, transform: [12, 0, 0, 12, 72, 700] },
            { str: 'Mono', fontName: 'g_mono', width: 40, height: 12, transform: [12, 0, 0, 12, 72, 660] },
          ],
        };
      },
    };
    const styledDoc = { async getPage() { return styledPage; } } as any;
    const runs = await extractPageRuns(styledDoc, 1, displayWidth, displayHeight);
    const byText = Object.fromEntries(runs.map((r) => [r.text, r.fontFamily]));
    expect(byText['Serif']).toBe('Times');
    expect(byText['Mono']).toBe('Courier');
  });

  it('falls back to fontName id when no styles map is present', async () => {
    // fakeDoc has no styles map; 'g_f1' is opaque -> Helvetica.
    const runs = await extractPageRuns(fakeDoc, 1, displayWidth, displayHeight);
    expect(runs[0].fontFamily).toBe('Helvetica');
  });

  it('enforces minimum width of 4px', async () => {
    const narrowPage = {
      getViewport: fakePage.getViewport,
      async getTextContent() {
        return {
          items: [
            { str: 'i', fontName: 'g_f1', width: 1, height: 12, transform: [12, 0, 0, 12, 72, 700] },
          ],
        };
      },
    };
    const narrowDoc = { async getPage() { return narrowPage; } } as any;
    const runs = await extractPageRuns(narrowDoc, 1, displayWidth, displayHeight);
    // width = 1 * 0.5 = 0.5 -> clamped to 4
    expect(runs[0].pos.width).toBe(4);
  });
});

describe('detectFontStyle', () => {
  it('detects bold from BaseFont suffixes', () => {
    expect(detectFontStyle('ABCDEF+Arial-Bold')).toEqual({ bold: true, italic: false });
    expect(detectFontStyle('Helvetica-Black')).toEqual({ bold: true, italic: false });
    expect(detectFontStyle('OpenSans-SemiBold')).toEqual({ bold: true, italic: false });
  });
  it('detects italic and oblique', () => {
    expect(detectFontStyle('Times-Italic')).toEqual({ bold: false, italic: true });
    expect(detectFontStyle('Courier-Oblique')).toEqual({ bold: false, italic: true });
  });
  it('detects combined bold italic', () => {
    expect(detectFontStyle('ABCDEF+TimesNewRomanPS-BoldItalicMT')).toEqual({ bold: true, italic: true });
  });
  it('returns plain for regular names and empty input', () => {
    expect(detectFontStyle('ArialMT')).toEqual({ bold: false, italic: false });
    expect(detectFontStyle(undefined)).toEqual({ bold: false, italic: false });
    expect(detectFontStyle(null)).toEqual({ bold: false, italic: false });
  });
});

describe('extractPageRuns style recovery', () => {
  const displayWidth = 306;
  const displayHeight = 396;
  const vpTransform = [0.5, 0, 0, -0.5, 0, 396];
  const getViewport = ({ scale }: { scale: number }) => ({
    width: 612 * scale,
    height: 792 * scale,
    transform: scale === 0.5 ? vpTransform : [scale, 0, 0, -scale, 0, 792 * scale],
  });

  it('recovers bold/italic from the translated font object in commonObjs', async () => {
    const page = {
      getViewport,
      commonObjs: {
        has: (id: string) => id === 'g_f1',
        get: (_id: string) => ({ name: 'ABCDEF+SomeFont', bold: true, italic: true }),
      },
      async getTextContent() {
        return {
          items: [{ str: 'Hello', fontName: 'g_f1', width: 40, height: 12, transform: [12, 0, 0, 12, 72, 700] }],
        };
      },
    };
    const doc = { async getPage() { return page; } } as any;
    const runs = await extractPageRuns(doc, 1, displayWidth, displayHeight);
    expect(runs[0].bold).toBe(true);
    expect(runs[0].italic).toBe(true);
  });

  it('falls back to name-based detection from the font object name', async () => {
    const page = {
      getViewport,
      commonObjs: {
        has: () => true,
        get: () => ({ name: 'ABCDEF+Arial-BoldItalic', bold: false, italic: false }),
      },
      async getTextContent() {
        return {
          items: [{ str: 'Hello', fontName: 'g_f1', width: 40, height: 12, transform: [12, 0, 0, 12, 72, 700] }],
        };
      },
    };
    const doc = { async getPage() { return page; } } as any;
    const runs = await extractPageRuns(doc, 1, displayWidth, displayHeight);
    expect(runs[0].bold).toBe(true);
    expect(runs[0].italic).toBe(true);
  });

  it('defaults to regular when no font info is available (no commonObjs)', async () => {
    const page = {
      getViewport,
      async getTextContent() {
        return {
          items: [{ str: 'Hello', fontName: 'g_f1', width: 40, height: 12, transform: [12, 0, 0, 12, 72, 700] }],
        };
      },
    };
    const doc = { async getPage() { return page; } } as any;
    const runs = await extractPageRuns(doc, 1, displayWidth, displayHeight);
    expect(runs[0].bold).toBe(false);
    expect(runs[0].italic).toBe(false);
  });

  it('does not let commonObjs.get errors break extraction', async () => {
    const page = {
      getViewport,
      commonObjs: {
        has: () => true,
        get: () => { throw new Error('not resolved yet'); },
      },
      async getTextContent() {
        return {
          items: [{ str: 'Hello', fontName: 'g_f1', width: 40, height: 12, transform: [12, 0, 0, 12, 72, 700] }],
        };
      },
    };
    const doc = { async getPage() { return page; } } as any;
    const runs = await extractPageRuns(doc, 1, displayWidth, displayHeight);
    expect(runs).toHaveLength(1);
    expect(runs[0].bold).toBe(false);
  });
});
