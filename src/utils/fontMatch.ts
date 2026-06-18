export type StandardFontKey = 'Helvetica' | 'Times' | 'Courier';

/**
 * Maps a PDF font name to one of the three standard font keys the app supports.
 * Matching is case-insensitive substring matching.
 *
 * - 'courier' | 'mono' | 'consol' -> 'Courier'
 * - 'times' | 'georgia' | 'serif' (NOT 'sans-serif'/'sansserif') | 'roman' | 'minion' | 'garamond' -> 'Times'
 * - otherwise (and for undefined/null/empty) -> 'Helvetica'
 */
export function matchStandardFont(pdfFontName: string | undefined | null): StandardFontKey {
  if (!pdfFontName) return 'Helvetica';

  const name = pdfFontName.toLowerCase();
  if (!name.trim()) return 'Helvetica';

  // Monospace family -> Courier
  if (name.includes('courier') || name.includes('mono') || name.includes('consol')) {
    return 'Courier';
  }

  // Strip 'sans' tokens so that 'sans-serif' / 'sansserif' do NOT trigger the 'serif' rule.
  // Remove 'sans-serif', 'sansserif', and bare 'sans' occurrences before checking 'serif'.
  const deSansed = name
    .replace(/sans-?serif/g, '')
    .replace(/sans/g, '');

  // Serif family -> Times
  if (
    deSansed.includes('times') ||
    deSansed.includes('georgia') ||
    deSansed.includes('serif') ||
    deSansed.includes('roman') ||
    deSansed.includes('minion') ||
    deSansed.includes('garamond')
  ) {
    return 'Times';
  }

  return 'Helvetica';
}
