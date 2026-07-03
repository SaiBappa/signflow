/* ============================================================================
 * Fillable-PDF exporter for the "Detect & convert to fillable form" feature.
 *
 * Takes a static PDF plus the list of detected field rectangles and writes a NEW
 * PDF containing real interactive AcroForm widgets (text fields, checkboxes,
 * radio groups) — the browser-only equivalent of Acrobat's "Prepare Form".
 *
 * Pure module, no React. Only depends on pdf-lib (already installed).
 *
 * COORDINATE CONVENTION (see formDetectionTypes.ts):
 *   DetectedField.rect uses a TOP-LEFT origin in PDF points. pdf-lib uses a
 *   BOTTOM-LEFT origin, so each rect is flipped per page via toBottomLeft().
 * ========================================================================== */

import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  rgb,
} from 'pdf-lib';
import type {
  DetectedField,
  DetectedPage,
  DetectedFieldType,
} from './formDetectionTypes';

/** Light tint used as the background fill so fields are visible on white pages. */
const FIELD_TINT = rgb(0.93, 0.96, 1); // pale blue
const BORDER_COLOR = rgb(0.45, 0.55, 0.75);

/* ---------------------------------------------------------------------------
 * Small helpers
 * ------------------------------------------------------------------------- */

/**
 * Convert a top-left-origin rect (PDF points) into pdf-lib's bottom-left origin
 * for a specific page. We trust the actual pdf-lib page height for the flip,
 * since that's the space the widgets are drawn against.
 */
function toBottomLeft(
  rect: { x: number; y: number; width: number; height: number },
  pageHeight: number
) {
  return {
    x: rect.x,
    y: pageHeight - rect.y - rect.height, // flip vertical axis
    width: rect.width,
    height: rect.height,
  };
}

/** Sanitise a candidate field name to a safe AcroForm charset. */
function sanitizeName(raw: string | undefined, fallback: string): string {
  const base = (raw ?? '').trim();
  // Keep it to a conservative charset; AcroForm names should avoid '.' (it is
  // the partial-name separator) and other control characters.
  const cleaned = base.replace(/[^A-Za-z0-9 _\-]/g, '').replace(/\s+/g, '_');
  return cleaned.length > 0 ? cleaned : fallback;
}

/**
 * Ensure a name is unique within the document by suffixing _2, _3, … on
 * collision. AcroForm field names (incl. radio group names) must be unique or
 * pdf-lib throws. The set is mutated to record the chosen name.
 */
function uniqueName(desired: string, used: Set<string>): string {
  if (!used.has(desired)) {
    used.add(desired);
    return desired;
  }
  let i = 2;
  let candidate = `${desired}_${i}`;
  while (used.has(candidate)) {
    i += 1;
    candidate = `${desired}_${i}`;
  }
  used.add(candidate);
  return candidate;
}

/**
 * Clamp a (already flipped, bottom-left) widget box to the page bounds so a
 * slightly-overflowing rect doesn't produce an invalid or off-page widget.
 * Returns null if the box is degenerate (no positive area).
 */
function clampToPage(
  box: { x: number; y: number; width: number; height: number },
  page: PDFPage
): { x: number; y: number; width: number; height: number } | null {
  const pw = page.getWidth();
  const ph = page.getHeight();

  let { x, y, width, height } = box;

  // Clamp the origin into the page, then shrink the size to fit.
  if (x < 0) {
    width += x; // x is negative → reduce width
    x = 0;
  }
  if (y < 0) {
    height += y;
    y = 0;
  }
  if (x + width > pw) width = pw - x;
  if (y + height > ph) height = ph - y;

  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

/* ---------------------------------------------------------------------------
 * Input normalisation
 * ------------------------------------------------------------------------- */

async function toBytes(
  input: File | ArrayBuffer | Uint8Array
): Promise<Uint8Array> {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  // File (or Blob) → ArrayBuffer
  const buf = await input.arrayBuffer();
  return new Uint8Array(buf);
}

/* ---------------------------------------------------------------------------
 * Main exporter
 * ------------------------------------------------------------------------- */

/**
 * Build a new PDF (bytes) from a static source PDF, adding interactive AcroForm
 * widgets for every enabled detected field.
 *
 * @param input  Source PDF as File | ArrayBuffer | Uint8Array.
 * @param fields Detected fields (top-left origin rects). Only `enabled !== false`
 *               fields are emitted.
 * @param pages  Native page geometry; used only as a sanity reference — the
 *               actual pdf-lib page size drives the coordinate flip.
 * @returns The new PDF as a Uint8Array.
 */
export async function buildFillablePdf(
  input: File | ArrayBuffer | Uint8Array,
  fields: DetectedField[],
  // `pages` is part of the shared contract; kept for sanity logging / parity.
  pages: DetectedPage[]
): Promise<Uint8Array> {
  const bytes = await toBytes(input);

  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const pdfPages = pdfDoc.getPages();

  // A Helvetica font we pass to text fields + appearance generation to avoid
  // missing-appearance issues.
  const helvetica: PDFFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Track all used field names (incl. radio group names) for uniqueness.
  const usedNames = new Set<string>();

  // Only enabled fields export.
  const enabled = fields.filter((f) => f.enabled !== false);

  // Split radio fields out: they're grouped by groupName into single
  // RadioGroups; every other field type is created individually.
  const radios = enabled.filter((f) => f.type === 'radio');
  const nonRadios = enabled.filter((f) => f.type !== 'radio');

  let created = 0;

  /* ---- Non-radio fields (text / date / signature / checkbox) ---- */
  for (const field of nonRadios) {
    try {
      const page = pdfPages[field.pageIndex];
      if (!page) {
        console.error(
          `[fillableFormExport] skip "${field.name}": pageIndex ${field.pageIndex} out of range`
        );
        continue;
      }

      // Degenerate source rect → skip.
      if (field.rect.width <= 0 || field.rect.height <= 0) {
        console.error(
          `[fillableFormExport] skip "${field.name}": degenerate rect`
        );
        continue;
      }

      const flipped = toBottomLeft(field.rect, page.getHeight());
      const box = clampToPage(flipped, page);
      if (!box) {
        console.error(
          `[fillableFormExport] skip "${field.name}": rect off-page after clamp`
        );
        continue;
      }

      const fieldName = uniqueName(
        sanitizeName(field.name, `Field_${created + 1}`),
        usedNames
      );

      if (field.type === 'checkbox') {
        const checkbox = form.createCheckBox(fieldName);
        checkbox.addToPage(page, {
          ...box,
          borderWidth: 1,
          borderColor: BORDER_COLOR,
          backgroundColor: FIELD_TINT,
        });
        // Leave unchecked (default).
        created += 1;
        continue;
      }

      // text | date | signature → all rendered as text fields.
      const textField = form.createTextField(fieldName);
      // Auto-size font (0) so any amount of typed text fits the box.
      textField.setFontSize(0);
      textField.addToPage(page, {
        ...box,
        font: helvetica,
        textColor: rgb(0, 0, 0),
        borderWidth: 1,
        borderColor: BORDER_COLOR,
        backgroundColor: FIELD_TINT,
      });
      // Not marked required (per spec). Date/signature are plain text fields;
      // the UI/label communicates their intent.
      created += 1;
    } catch (err) {
      console.error(
        `[fillableFormExport] failed to create field "${field.name}":`,
        err
      );
    }
  }

  /* ---- Radio fields grouped into RadioGroups ---- */
  // Group members by their shared groupName (falling back to the field name so
  // a lone radio still becomes a valid single-option group).
  const radioGroups = new Map<string, DetectedField[]>();
  for (const field of radios) {
    const key = field.groupName?.trim() || field.name;
    const list = radioGroups.get(key) ?? [];
    list.push(field);
    radioGroups.set(key, list);
  }

  for (const [groupKey, members] of radioGroups) {
    let radio:
      | ReturnType<ReturnType<typeof pdfDoc.getForm>['createRadioGroup']>
      | null = null;
    try {
      const groupName = uniqueName(
        sanitizeName(groupKey, `RadioGroup_${created + 1}`),
        usedNames
      );
      radio = form.createRadioGroup(groupName);
    } catch (err) {
      console.error(
        `[fillableFormExport] failed to create radio group "${groupKey}":`,
        err
      );
      continue;
    }

    // Track option labels so each member gets a distinct option value within
    // the group (pdf-lib keys widgets by option value).
    const usedOptions = new Set<string>();

    for (const member of members) {
      try {
        const page = pdfPages[member.pageIndex];
        if (!page) {
          console.error(
            `[fillableFormExport] skip radio option "${member.name}": pageIndex ${member.pageIndex} out of range`
          );
          continue;
        }
        if (member.rect.width <= 0 || member.rect.height <= 0) {
          console.error(
            `[fillableFormExport] skip radio option "${member.name}": degenerate rect`
          );
          continue;
        }

        const flipped = toBottomLeft(member.rect, page.getHeight());
        const box = clampToPage(flipped, page);
        if (!box) {
          console.error(
            `[fillableFormExport] skip radio option "${member.name}": rect off-page after clamp`
          );
          continue;
        }

        const optionLabel = uniqueName(
          sanitizeName(member.label || member.name, `Option_${usedOptions.size + 1}`),
          usedOptions
        );

        radio.addOptionToPage(optionLabel, page, {
          ...box,
          borderWidth: 1,
          borderColor: BORDER_COLOR,
          backgroundColor: FIELD_TINT,
        });
        created += 1;
      } catch (err) {
        console.error(
          `[fillableFormExport] failed to add radio option "${member.name}":`,
          err
        );
      }
    }
  }

  // Regenerate appearances so fields render consistently across viewers. Guard
  // the empty-fields case — calling it with nothing created is harmless but we
  // skip to avoid any edge-case throw.
  if (created > 0) {
    try {
      form.updateFieldAppearances(helvetica);
    } catch (err) {
      console.error('[fillableFormExport] updateFieldAppearances failed:', err);
    }
  }

  // (pages is a sanity reference only; nothing to do with it beyond parity.)
  void pages;

  return pdfDoc.save();
}

/* ---------------------------------------------------------------------------
 * Optional download helper (UI convenience).
 * ------------------------------------------------------------------------- */

/**
 * Convenience helper: build the fillable PDF and trigger a browser download.
 * The UI may prefer to call buildFillablePdf directly and use the app's own
 * downloadBlob — this is offered purely for convenience.
 */
export async function downloadFillablePdf(
  input: File | ArrayBuffer | Uint8Array,
  fields: DetectedField[],
  pages: DetectedPage[],
  filename = 'fillable-form.pdf'
): Promise<void> {
  const out = await buildFillablePdf(input, fields, pages);
  // Copy into a fresh ArrayBuffer so the Blob is backed by exactly these bytes.
  const ab = out.slice().buffer;
  const blob = new Blob([ab], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Re-export the field-type union so callers importing from this module have it
// handy without a second import (no redefinition — just a type re-export).
export type { DetectedFieldType };
