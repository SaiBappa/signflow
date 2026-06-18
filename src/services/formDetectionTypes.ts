/* ============================================================================
 * Shared contract for the "Detect & convert to fillable form" feature.
 *
 * Acrobat's "Prepare Form" auto-recognises where form fields belong (blank
 * underlines, label-then-gap, checkbox squares, signature/date lines) and turns
 * the static PDF into an interactive AcroForm. This module is the single source
 * of truth for the data shapes shared between:
 *   - the detection engine   (services/formDetection.ts)
 *   - the fillable exporter   (services/fillableFormExport.ts)
 *   - the UI tool             (components/PrepareForm.tsx)
 *
 * COORDINATE CONVENTION (important — every module must agree):
 *   All rects use a TOP-LEFT origin in PDF *points*, i.e. the page measured by
 *   `pdfjsPage.getViewport({ scale: 1 })` where (0,0) is the top-left corner,
 *   x grows right, y grows DOWN. This matches pdf.js viewport space and makes
 *   the on-screen overlay trivial (screenRect = rect * displayScale).
 *
 *   The exporter converts to pdf-lib's bottom-left origin per page via:
 *     pdfX = rect.x
 *     pdfY = pageHeightPts - rect.y - rect.height
 *     w/h  = rect.width / rect.height
 * ========================================================================== */

/** Kinds of fields we can recognise and emit as interactive AcroForm widgets. */
export type DetectedFieldType = 'text' | 'checkbox' | 'radio' | 'signature' | 'date';

/** A rectangle in TOP-LEFT-origin PDF points (page viewport at scale 1.0). */
export interface DetectedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A single recognised form field candidate. */
export interface DetectedField {
  id: string;
  type: DetectedFieldType;
  /** 0-based page index. */
  pageIndex: number;
  /** Field bounds, top-left origin, PDF points. */
  rect: DetectedRect;
  /** Sanitised, unique AcroForm field name (e.g. "FullName"). */
  name: string;
  /** Human-readable label detected near the field, if any. */
  label?: string;
  /** Detection confidence, 0..1 (drives sort order + low-confidence styling). */
  confidence: number;
  /** User can toggle a field off before exporting; only enabled fields export. */
  enabled: boolean;
  /** Radio buttons that belong together share a groupName. */
  groupName?: string;
}

/** Native (scale-1) geometry of a page, needed to scale overlays and export. */
export interface DetectedPage {
  /** 0-based page index. */
  pageIndex: number;
  /** Page width in PDF points. */
  width: number;
  /** Page height in PDF points. */
  height: number;
}

/** Full result of a detection pass over a document. */
export interface DetectionResult {
  fields: DetectedField[];
  pages: DetectedPage[];
}

/** Tunables for which heuristics run and how aggressive they are. */
export interface DetectionOptions {
  detectText?: boolean;       // blank underlines, "Label:" + gap, ruled lines
  detectCheckbox?: boolean;   // small empty squares, "[ ]", ☐ glyphs
  detectSignature?: boolean;  // "signature" / "sign here" lines
  detectDate?: boolean;       // "date" labelled blanks
  /** 0..1, higher = more aggressive / more candidates. Default 0.5. */
  sensitivity?: number;
}

export const DEFAULT_DETECTION_OPTIONS: Required<DetectionOptions> = {
  detectText: true,
  detectCheckbox: true,
  detectSignature: true,
  detectDate: true,
  sensitivity: 0.5,
};
