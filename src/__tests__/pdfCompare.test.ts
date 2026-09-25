import { describe, it, expect } from 'vitest';
import {
  tokenize,
  diffWords,
  countChanges,
  buildTextDiff,
  diffImageData,
} from '../utils/pdfCompare';

describe('tokenize', () => {
  it('keeps words and whitespace runs as separate tokens', () => {
    expect(tokenize('hello  world')).toEqual(['hello', '  ', 'world']);
  });
  it('returns empty array for empty input', () => {
    expect(tokenize('')).toEqual([]);
  });
});

describe('diffWords', () => {
  it('marks identical text as all equal', () => {
    const segs = diffWords('the quick fox', 'the quick fox');
    expect(segs.every(s => s.type === 'equal')).toBe(true);
  });

  it('detects an added word', () => {
    const segs = diffWords('the fox', 'the quick fox');
    const added = segs.filter(s => s.type === 'add').map(s => s.value.trim()).join('');
    expect(added).toContain('quick');
    expect(segs.some(s => s.type === 'remove')).toBe(false);
  });

  it('detects a removed word', () => {
    const segs = diffWords('the quick fox', 'the fox');
    const removed = segs.filter(s => s.type === 'remove').map(s => s.value.trim()).join('');
    expect(removed).toContain('quick');
  });

  it('detects a replacement as one remove + one add', () => {
    const segs = diffWords('the quick fox', 'the slow fox');
    const { added, removed } = countChanges(segs);
    expect(added).toBe(1);
    expect(removed).toBe(1);
  });

  it('ignores pure whitespace/casing reflow', () => {
    const { added, removed } = countChanges(diffWords('Hello   World', 'Hello World'));
    expect(added).toBe(0);
    expect(removed).toBe(0);
  });
});

describe('countChanges', () => {
  it('does not count whitespace-only segments', () => {
    const { added, removed } = countChanges([
      { type: 'add', value: '   ' },
      { type: 'remove', value: '\n\n' },
    ]);
    expect(added).toBe(0);
    expect(removed).toBe(0);
  });
});

describe('buildTextDiff', () => {
  it('summarises per-page changes across documents', () => {
    const before = ['page one same', 'second page old text'];
    const after = ['page one same', 'second page new text', 'a brand new page'];
    const { pages, summary } = buildTextDiff(before, after);

    expect(summary.pagesCompared).toBe(3);
    expect(pages[0].status).toBe('unchanged');
    expect(pages[1].status).toBe('changed');
    expect(pages[2].status).toBe('added');
    expect(summary.pagesAdded).toBe(1);
    expect(summary.wordsAdded).toBeGreaterThan(0);
  });

  it('flags removed pages when the revised doc is shorter', () => {
    const { pages, summary } = buildTextDiff(['a', 'b'], ['a']);
    expect(pages[1].status).toBe('removed');
    expect(summary.pagesRemoved).toBe(1);
  });
});

describe('diffImageData', () => {
  const makeImage = (rgb: [number, number, number], w: number, h: number): ImageData => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = 255;
    }
    // Minimal ImageData-like object (jsdom provides ImageData, but stay safe).
    return { data, width: w, height: h, colorSpace: 'srgb' } as ImageData;
  };

  it('reports zero changed ratio for identical images', () => {
    const a = makeImage([255, 255, 255], 4, 4);
    const b = makeImage([255, 255, 255], 4, 4);
    const { changedRatio } = diffImageData(a, b, 4, 4);
    expect(changedRatio).toBe(0);
  });

  it('reports full change for completely different images', () => {
    const a = makeImage([255, 255, 255], 4, 4);
    const b = makeImage([0, 0, 0], 4, 4);
    const { changedRatio } = diffImageData(a, b, 4, 4);
    expect(changedRatio).toBe(1);
  });
});
