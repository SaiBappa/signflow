import { describe, it, expect, vi } from 'vitest';

// --- Mocks (mirror the project's other component tests) ---
// extractPdfText drives pdf.js; we mock it so tests run without a real worker.
// The factory is hoisted, so everything it needs is defined inline.
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn().mockReturnValue({
    promise: Promise.resolve({
      numPages: 3,
      getPage: vi.fn().mockResolvedValue({
        getTextContent: vi.fn().mockResolvedValue({
          items: [{ str: 'Hello' }, { str: 'world' }, { str: 'from a document with a real text layer.' }],
        }),
      }),
    }),
  }),
}));
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: 'mock-worker-url' }));

import {
  isScannedText,
  SCANNED_THRESHOLD,
  renderMarkdown,
  localSummary,
  extractPdfText,
} from '../components/AskAI';

// ---------------------------------------------------------------------------
// isScannedText – scanned-PDF detection
// ---------------------------------------------------------------------------
describe('isScannedText', () => {
  it('treats empty / whitespace text as scanned', () => {
    expect(isScannedText('')).toBe(true);
    expect(isScannedText('   \n  ')).toBe(true);
  });

  it('treats text shorter than the threshold as scanned', () => {
    expect(isScannedText('a'.repeat(SCANNED_THRESHOLD - 1))).toBe(true);
  });

  it('treats text at or above the threshold as having a real text layer', () => {
    expect(isScannedText('a'.repeat(SCANNED_THRESHOLD))).toBe(false);
    expect(isScannedText('a'.repeat(SCANNED_THRESHOLD + 50))).toBe(false);
  });

  it('handles null/undefined input without throwing', () => {
    expect(isScannedText(undefined as any)).toBe(true);
    expect(isScannedText(null as any)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// renderMarkdown – minimal, XSS-safe markdown rendering
// ---------------------------------------------------------------------------
describe('renderMarkdown', () => {
  it('escapes raw HTML to prevent injection from model output', () => {
    const html = renderMarkdown('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders bold text', () => {
    expect(renderMarkdown('this is **bold**')).toContain('<strong>bold</strong>');
  });

  it('renders inline code', () => {
    expect(renderMarkdown('use `npm run dev`')).toContain('<code');
  });

  it('wraps consecutive bullet lines in a single list', () => {
    const html = renderMarkdown('- one\n- two\n- three');
    expect((html.match(/<ul/g) || []).length).toBe(1);
    expect((html.match(/<li>/g) || []).length).toBe(3);
  });

  it('renders headings as bold blocks', () => {
    expect(renderMarkdown('# Title')).toContain('Title');
    expect(renderMarkdown('# Title')).not.toContain('#');
  });
});

// ---------------------------------------------------------------------------
// localSummary – offline fallback when no API key is set
// ---------------------------------------------------------------------------
describe('localSummary', () => {
  it('returns a scanned-PDF notice when there is no extractable text', () => {
    const out = localSummary('', 4);
    expect(out).toMatch(/scanned/i);
    expect(out).toContain('4 pages');
  });

  it('reports page count and word count for text documents', () => {
    const text = 'The contract is valid. Payment is due in thirty days. The parties agree to the terms.';
    const out = localSummary(text, 1);
    expect(out).toContain('1 page');
    expect(out).toMatch(/words/);
    expect(out).toMatch(/Gemini API key/); // prompts the user to unlock full AI
  });

  it('produces bullet points from the source sentences', () => {
    const text = 'Alpha beta gamma delta epsilon. Zeta eta theta iota kappa. Lambda mu nu xi omicron.';
    const out = localSummary(text, 2);
    expect(out).toContain('- ');
  });
});

// ---------------------------------------------------------------------------
// extractPdfText – pulls the text layer and page count from a PDF
// ---------------------------------------------------------------------------
describe('extractPdfText', () => {
  it('joins page text and returns the page count', async () => {
    const file = new File(['%PDF-1.4 fake'], 'doc.pdf', { type: 'application/pdf' });
    const { text, pages } = await extractPdfText(file);
    expect(pages).toBe(3);
    expect(text).toContain('Hello world');
    expect(text).toContain('--- Page 1 ---');
  });
});
