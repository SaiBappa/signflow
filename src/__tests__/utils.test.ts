import { describe, it, expect, vi } from 'vitest';
import { cn, fontCss, TEXT_FONTS, isPageInRange, downloadBlob, removeImageBackground } from '../utils';

// ---------------------------------------------------------------------------
// cn – className merger (clsx + tailwind-merge)
// ---------------------------------------------------------------------------
describe('cn (className utility)', () => {
  it('should merge simple class strings', () => {
    const result = cn('foo', 'bar');
    expect(result).toContain('foo');
    expect(result).toContain('bar');
  });

  it('should handle conditional classes', () => {
    const result = cn('base', false && 'not-here', 'yes');
    expect(result).not.toContain('not-here');
    expect(result).toContain('yes');
  });

  it('should return an empty string when no inputs', () => {
    expect(cn()).toBe('');
  });

  it('should merge conflicting tailwind classes, keeping last', () => {
    const result = cn('px-4', 'px-8');
    expect(result).toBe('px-8');
  });

  it('should handle undefined and null inputs gracefully', () => {
    const result = cn(undefined, null, 'valid');
    expect(result).toBe('valid');
  });
});

// ---------------------------------------------------------------------------
// TEXT_FONTS constant
// ---------------------------------------------------------------------------
describe('TEXT_FONTS', () => {
<<<<<<< HEAD
  it('should have exactly 3 font entries', () => {
    expect(TEXT_FONTS).toHaveLength(3);
  });

  it('should include Sans, Serif, and Mono labels', () => {
    const labels = TEXT_FONTS.map(f => f.label);
    expect(labels).toEqual(['Sans', 'Serif', 'Mono']);
=======
  it('should have exactly 4 font entries', () => {
    expect(TEXT_FONTS).toHaveLength(4);
  });

  it('should include expected font labels', () => {
    const labels = TEXT_FONTS.map(f => f.label);
    expect(labels).toEqual([
      'Sans-Serif (Arial)',
      'Serif (Times)',
      'Monospace (Courier)',
      'Faruma (Dhivehi)',
    ]);
>>>>>>> feat/prepare-form
  });

  it('each entry should have label, value, and css properties', () => {
    for (const font of TEXT_FONTS) {
      expect(font).toHaveProperty('label');
      expect(font).toHaveProperty('value');
      expect(font).toHaveProperty('css');
      expect(typeof font.label).toBe('string');
      expect(typeof font.value).toBe('string');
      expect(typeof font.css).toBe('string');
    }
  });

<<<<<<< HEAD
  it('should map to valid pdf-lib StandardFont names', () => {
    const validNames = ['Helvetica', 'Times', 'Courier'];
=======
  it('should map to valid font value names', () => {
    const validNames = ['Helvetica', 'Times', 'Courier', 'Faruma'];
>>>>>>> feat/prepare-form
    TEXT_FONTS.forEach(f => {
      expect(validNames).toContain(f.value);
    });
  });
});

// ---------------------------------------------------------------------------
// fontCss
// ---------------------------------------------------------------------------
describe('fontCss', () => {
  it('should return correct CSS for Helvetica', () => {
<<<<<<< HEAD
    expect(fontCss('Helvetica')).toBe('Helvetica, Arial, sans-serif');
  });

  it('should return correct CSS for Times', () => {
    expect(fontCss('Times')).toBe('"Times New Roman", Times, serif');
  });

  it('should return correct CSS for Courier', () => {
    expect(fontCss('Courier')).toBe('"Courier New", Courier, monospace');
=======
    expect(fontCss('Helvetica')).toBe('"Liberation Sans", Arial, Helvetica, sans-serif');
  });

  it('should return correct CSS for Times', () => {
    expect(fontCss('Times')).toBe('"Liberation Serif", "Times New Roman", Times, serif');
  });

  it('should return correct CSS for Courier', () => {
    expect(fontCss('Courier')).toBe('"Liberation Mono", "Courier New", Courier, monospace');
>>>>>>> feat/prepare-form
  });

  it('should fall back to Sans (Helvetica) for undefined value', () => {
    expect(fontCss(undefined)).toBe(TEXT_FONTS[0].css);
  });

  it('should fall back to Sans (Helvetica) for unknown value', () => {
    expect(fontCss('ComicSans')).toBe(TEXT_FONTS[0].css);
  });

  it('should fall back to Sans for empty string', () => {
    expect(fontCss('')).toBe(TEXT_FONTS[0].css);
  });
});

// ---------------------------------------------------------------------------
// isPageInRange
// ---------------------------------------------------------------------------
describe('isPageInRange', () => {
  // --- Single pages ---
  it('should match a single exact page number', () => {
    expect(isPageInRange('3', 3)).toBe(true);
  });

  it('should not match a different page number', () => {
    expect(isPageInRange('3', 4)).toBe(false);
  });

  // --- Ranges ---
  it('should match pages within a range (inclusive)', () => {
    expect(isPageInRange('2-5', 2)).toBe(true);
    expect(isPageInRange('2-5', 3)).toBe(true);
    expect(isPageInRange('2-5', 5)).toBe(true);
  });

  it('should not match pages outside a range', () => {
    expect(isPageInRange('2-5', 1)).toBe(false);
    expect(isPageInRange('2-5', 6)).toBe(false);
  });

  // --- Comma-separated ---
  it('should handle comma-separated single pages', () => {
    expect(isPageInRange('1, 3, 7', 1)).toBe(true);
    expect(isPageInRange('1, 3, 7', 3)).toBe(true);
    expect(isPageInRange('1, 3, 7', 7)).toBe(true);
    expect(isPageInRange('1, 3, 7', 5)).toBe(false);
  });

  // --- Mixed formats ---
  it('should handle mixed single pages and ranges', () => {
    expect(isPageInRange('1, 3-5, 8', 1)).toBe(true);
    expect(isPageInRange('1, 3-5, 8', 3)).toBe(true);
    expect(isPageInRange('1, 3-5, 8', 4)).toBe(true);
    expect(isPageInRange('1, 3-5, 8', 5)).toBe(true);
    expect(isPageInRange('1, 3-5, 8', 8)).toBe(true);
    expect(isPageInRange('1, 3-5, 8', 2)).toBe(false);
    expect(isPageInRange('1, 3-5, 8', 6)).toBe(false);
    expect(isPageInRange('1, 3-5, 8', 9)).toBe(false);
  });

  // --- Edge cases ---
  it('should return false for an empty range string', () => {
    expect(isPageInRange('', 1)).toBe(false);
  });

  it('should handle range where start === end', () => {
    expect(isPageInRange('5-5', 5)).toBe(true);
    expect(isPageInRange('5-5', 4)).toBe(false);
  });

  it('should handle page index 0', () => {
    expect(isPageInRange('0', 0)).toBe(true);
    expect(isPageInRange('1', 0)).toBe(false);
  });

  it('should handle whitespace around values', () => {
    expect(isPageInRange(' 1 , 3 - 5 ', 3)).toBe(true);
    expect(isPageInRange(' 1 , 3 - 5 ', 1)).toBe(true);
  });

  it('should handle large page numbers', () => {
    expect(isPageInRange('100-200', 150)).toBe(true);
    expect(isPageInRange('100-200', 99)).toBe(false);
    expect(isPageInRange('100-200', 201)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// downloadBlob
// ---------------------------------------------------------------------------
describe('downloadBlob', () => {
  it('should create and click a download link', () => {
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(vi.fn());
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(vi.fn());
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(vi.fn());

    const blob = new Blob(['test'], { type: 'text/plain' });
    downloadBlob(blob, 'test.txt');

    // Verify a link was created and appended
    expect(appendChildSpy).toHaveBeenCalledTimes(1);
    const link = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(link.tagName).toBe('A');
    expect(link.download).toBe('test.txt');
    expect(link.href).toContain('blob:test-url');

    // Cleanup was called
    expect(removeChildSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test-url');

    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// removeImageBackground
// ---------------------------------------------------------------------------
describe('removeImageBackground', () => {
  // Note: This depends on Image loading and Canvas which we mocked in setup.ts

  it('should be a function', () => {
    expect(typeof removeImageBackground).toBe('function');
  });

  it('should return a promise', () => {
    // We need to trigger image.onload manually. The mock environment's Image
    // constructor in jsdom doesn't fire load events for data URIs synchronously.
    // We test that the function returns a promise shape.
    const result = removeImageBackground('data:image/png;base64,iVBORw', 50);
    expect(result).toBeInstanceOf(Promise);
  });

  it('should accept all valid bgRemovalMode values', () => {
    // Ensure function signature accepts all modes without error
    const modes: Array<'white' | 'black' | 'auto'> = ['white', 'black', 'auto'];
    modes.forEach(mode => {
      const result = removeImageBackground('data:image/png;base64,test', 50, undefined, mode);
      expect(result).toBeInstanceOf(Promise);
    });
  });
});
