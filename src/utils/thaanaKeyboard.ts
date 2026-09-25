import React from 'react';

/**
 * Standard Dhivehi (Thaana) keyboard layout mapping.
 * Maps QWERTY Latin keys to their corresponding Thaana Unicode characters.
 * This allows typing Dhivehi without switching the OS keyboard layout.
 */
const THAANA_MAP: Record<string, string> = {
  // Lower-case — consonants & vowel marks (fili)
  'q': 'ް', 'w': 'އ', 'e': 'ެ', 'r': 'ރ', 't': 'ތ', 'y': 'ޔ', 'u': 'ު', 'i': 'ި', 'o': 'ޮ', 'p': 'ޕ',
  'a': 'ަ', 's': 'ސ', 'd': 'ދ', 'f': 'ފ', 'g': 'ގ', 'h': 'ހ', 'j': 'ޖ', 'k': 'ކ', 'l': 'ލ',
  'z': 'ޒ', 'x': '×', 'c': 'ޗ', 'v': 'ވ', 'b': 'ބ', 'n': 'ނ', 'm': 'މ',

  // Upper-case (Shift) — Arabic-origin letters & extended vowel marks
  'Q': 'ޤ', 'W': 'ޢ', 'E': 'ޭ', 'R': 'ޜ', 'T': 'ޓ', 'Y': 'ޠ', 'U': 'ޫ', 'I': 'ީ', 'O': 'ޯ', 'P': 'ޕ',
  'A': 'ާ', 'S': 'ށ', 'D': 'ޑ', 'F': 'ﷲ', 'G': 'ޣ', 'H': 'ޙ', 'J': 'ޛ', 'K': 'ޚ', 'L': 'ޅ',
  'Z': 'ޡ', 'X': 'ޘ', 'C': 'ޝ', 'V': 'ޥ', 'B': 'ޞ', 'N': 'ޏ', 'M': 'ޟ',

  // Punctuation
  ',': '،', ';': '؛', '?': '؟',
};

/**
 * Handle keydown events to translate Latin keystrokes into Thaana characters.
 * Call this inside onKeyDown on a textarea/input when Dhivehi input is enabled.
 *
 * @param e         - The keyboard event
 * @param isEnabled - Whether Thaana input is active (e.g. Faruma font is selected)
 * @param setValue  - Callback to set the new string value
 */
export const handleThaanaKeyDown = (
  e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  isEnabled: boolean,
  setValue: (val: string) => void
) => {
  if (!isEnabled) return;
  // Don't intercept shortcuts or special keys
  if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;

  const thaanaChar = THAANA_MAP[e.key];
  if (thaanaChar) {
    e.preventDefault();
    const input = e.target as HTMLInputElement | HTMLTextAreaElement;
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const value = input.value;
    const newValue = value.slice(0, start) + thaanaChar + value.slice(end);

    setValue(newValue);

    // Restore cursor position after the inserted character
    setTimeout(() => {
      input.setSelectionRange(start + thaanaChar.length, start + thaanaChar.length);
    }, 0);
  }
};

/**
 * Check if a font family value indicates Dhivehi/Thaana script.
 */
export const isDhivehiFont = (fontFamily: string | undefined): boolean => {
  if (!fontFamily) return false;
  const lower = fontFamily.toLowerCase();
  return lower === 'faruma' || lower === 'mv boli' || lower.includes('thaana');
};
