import type { StampAsset } from '../types';

/**
 * Generates a data URL from a raw SVG string.
 */
function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Returns the set of built-in default stamps available out of the box.
 *
 * Each stamp is a self-contained inline SVG encoded as a data URL so no
 * network requests or external assets are required.
 */
export function getDefaultStamps(): StampAsset[] {
  // ── APPROVED ──────────────────────────────────────────────────────────
  // Green, slightly rotated (-12 deg), rounded-rect border, rubber-stamp feel.
  const approvedSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80">
  <g transform="rotate(-12, 100, 40)" opacity="0.85">
    <rect x="8" y="8" width="184" height="64" rx="10" ry="10"
          fill="none" stroke="#1a8d1a" stroke-width="3"/>
    <rect x="14" y="14" width="172" height="52" rx="7" ry="7"
          fill="none" stroke="#1a8d1a" stroke-width="1.5" stroke-dasharray="4,2"/>
    <text x="100" y="48" text-anchor="middle"
          font-family="Impact, 'Arial Black', sans-serif" font-size="30"
          font-weight="bold" fill="#1a8d1a" letter-spacing="4">APPROVED</text>
  </g>
</svg>`.trim();

  // ── CONFIDENTIAL ──────────────────────────────────────────────────────
  // Red, double-border rectangle, upright, authoritative.
  const confidentialSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80">
  <g opacity="0.82">
    <rect x="6" y="6" width="188" height="68" rx="3" ry="3"
          fill="none" stroke="#c0272d" stroke-width="3"/>
    <rect x="12" y="12" width="176" height="56" rx="2" ry="2"
          fill="none" stroke="#c0272d" stroke-width="1.5"/>
    <text x="100" y="49" text-anchor="middle"
          font-family="Impact, 'Arial Black', sans-serif" font-size="24"
          font-weight="bold" fill="#c0272d" letter-spacing="3">CONFIDENTIAL</text>
  </g>
</svg>`.trim();

  // ── DRAFT ─────────────────────────────────────────────────────────────
  // Gray, dashed border, large faded text — clearly a work-in-progress marker.
  const draftSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80">
  <g opacity="0.55">
    <rect x="8" y="8" width="184" height="64" rx="4" ry="4"
          fill="none" stroke="#6b6b6b" stroke-width="2.5"
          stroke-dasharray="8,4"/>
    <text x="100" y="52" text-anchor="middle"
          font-family="Impact, 'Arial Black', sans-serif" font-size="38"
          font-weight="bold" fill="#6b6b6b" letter-spacing="8">DRAFT</text>
  </g>
</svg>`.trim();

  // ── COPY ──────────────────────────────────────────────────────────────
  // Blue, clean single border, slight rotation for a hand-stamped look.
  const copySvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80">
  <g transform="rotate(-6, 100, 40)" opacity="0.80">
    <rect x="10" y="10" width="180" height="60" rx="4" ry="4"
          fill="none" stroke="#1a5fb4" stroke-width="3"/>
    <text x="100" y="50" text-anchor="middle"
          font-family="Impact, 'Arial Black', sans-serif" font-size="36"
          font-weight="bold" fill="#1a5fb4" letter-spacing="10">COPY</text>
  </g>
</svg>`.trim();

  // ── RECEIVED ───────────────────────────────────────────────────────────
  // Teal, double border, slight tilt — common for incoming mail/documents.
  const receivedSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80">
  <g transform="rotate(-8, 100, 40)" opacity="0.82">
    <rect x="6" y="6" width="188" height="68" rx="6" ry="6"
          fill="none" stroke="#0d7377" stroke-width="3"/>
    <rect x="12" y="12" width="176" height="56" rx="4" ry="4"
          fill="none" stroke="#0d7377" stroke-width="1.2"/>
    <text x="100" y="49" text-anchor="middle"
          font-family="Impact, 'Arial Black', sans-serif" font-size="28"
          font-weight="bold" fill="#0d7377" letter-spacing="4">RECEIVED</text>
  </g>
</svg>`.trim();

  // ── REJECTED ───────────────────────────────────────────────────────────
  // Dark red, bold X-marks in corners, authoritative refusal.
  const rejectedSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80">
  <g transform="rotate(-5, 100, 40)" opacity="0.85">
    <rect x="8" y="8" width="184" height="64" rx="4" ry="4"
          fill="none" stroke="#a11" stroke-width="3"/>
    <line x1="12" y1="12" x2="30" y2="28" stroke="#a11" stroke-width="2"/>
    <line x1="30" y1="12" x2="12" y2="28" stroke="#a11" stroke-width="2"/>
    <line x1="170" y1="52" x2="188" y2="68" stroke="#a11" stroke-width="2"/>
    <line x1="188" y1="52" x2="170" y2="68" stroke="#a11" stroke-width="2"/>
    <text x="100" y="50" text-anchor="middle"
          font-family="Impact, 'Arial Black', sans-serif" font-size="28"
          font-weight="bold" fill="#a11" letter-spacing="4">REJECTED</text>
  </g>
</svg>`.trim();

  // ── VOID ───────────────────────────────────────────────────────────────
  // Red, diagonal text with large dashed border — indicates nullification.
  const voidSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80">
  <g opacity="0.80">
    <rect x="8" y="8" width="184" height="64" rx="4" ry="4"
          fill="none" stroke="#cc0000" stroke-width="3"
          stroke-dasharray="10,4"/>
    <text x="100" y="54" text-anchor="middle"
          font-family="Impact, 'Arial Black', sans-serif" font-size="42"
          font-weight="bold" fill="#cc0000" letter-spacing="12"
          transform="rotate(-15, 100, 40)">VOID</text>
  </g>
</svg>`.trim();

  // ── ORIGINAL ───────────────────────────────────────────────────────────
  // Dark green, triple border, upright — certifies original document.
  const originalSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80">
  <g opacity="0.82">
    <rect x="4" y="4" width="192" height="72" rx="5" ry="5"
          fill="none" stroke="#1a6b1a" stroke-width="2.5"/>
    <rect x="10" y="10" width="180" height="60" rx="3" ry="3"
          fill="none" stroke="#1a6b1a" stroke-width="1.5"/>
    <rect x="16" y="16" width="168" height="48" rx="2" ry="2"
          fill="none" stroke="#1a6b1a" stroke-width="0.8" stroke-dasharray="3,2"/>
    <text x="100" y="48" text-anchor="middle"
          font-family="Impact, 'Arial Black', sans-serif" font-size="26"
          font-weight="bold" fill="#1a6b1a" letter-spacing="5">ORIGINAL</text>
  </g>
</svg>`.trim();

  // ── URGENT ─────────────────────────────────────────────────────────────
  // Orange-red, thick border, bold text with exclamation feel.
  const urgentSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80">
  <g transform="rotate(-10, 100, 40)" opacity="0.88">
    <rect x="8" y="8" width="184" height="64" rx="8" ry="8"
          fill="none" stroke="#d4380d" stroke-width="4"/>
    <text x="100" y="50" text-anchor="middle"
          font-family="Impact, 'Arial Black', sans-serif" font-size="32"
          font-weight="bold" fill="#d4380d" letter-spacing="6">URGENT</text>
  </g>
</svg>`.trim();

  // ── FINAL ──────────────────────────────────────────────────────────────
  // Navy blue, clean double border, solid authoritative look.
  const finalSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80">
  <g opacity="0.80">
    <rect x="6" y="6" width="188" height="68" rx="4" ry="4"
          fill="none" stroke="#1b2a4a" stroke-width="3"/>
    <rect x="12" y="12" width="176" height="56" rx="3" ry="3"
          fill="none" stroke="#1b2a4a" stroke-width="1.2"/>
    <text x="100" y="50" text-anchor="middle"
          font-family="Impact, 'Arial Black', sans-serif" font-size="36"
          font-weight="bold" fill="#1b2a4a" letter-spacing="10">FINAL</text>
  </g>
</svg>`.trim();

  // ── REVISED ────────────────────────────────────────────────────────────
  // Purple, dashed inner border, slight tilt — indicates updated version.
  const revisedSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80">
  <g transform="rotate(-7, 100, 40)" opacity="0.78">
    <rect x="8" y="8" width="184" height="64" rx="6" ry="6"
          fill="none" stroke="#6b21a8" stroke-width="3"/>
    <rect x="14" y="14" width="172" height="52" rx="4" ry="4"
          fill="none" stroke="#6b21a8" stroke-width="1.2"
          stroke-dasharray="5,3"/>
    <text x="100" y="49" text-anchor="middle"
          font-family="Impact, 'Arial Black', sans-serif" font-size="28"
          font-weight="bold" fill="#6b21a8" letter-spacing="5">REVISED</text>
  </g>
</svg>`.trim();

  // ── PAID ───────────────────────────────────────────────────────────────
  // Green, rotated, bold — common for financial/accounting documents.
  const paidSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80">
  <g transform="rotate(-14, 100, 40)" opacity="0.82">
    <rect x="10" y="10" width="180" height="60" rx="8" ry="8"
          fill="none" stroke="#15803d" stroke-width="3.5"/>
    <text x="100" y="52" text-anchor="middle"
          font-family="Impact, 'Arial Black', sans-serif" font-size="40"
          font-weight="bold" fill="#15803d" letter-spacing="12">PAID</text>
  </g>
</svg>`.trim();

  // ── CANCELLED ──────────────────────────────────────────────────────────
  // Red, strikethrough line through text, clear revocation.
  const cancelledSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80">
  <g transform="rotate(-5, 100, 40)" opacity="0.82">
    <rect x="6" y="6" width="188" height="68" rx="4" ry="4"
          fill="none" stroke="#b91c1c" stroke-width="3"/>
    <text x="100" y="49" text-anchor="middle"
          font-family="Impact, 'Arial Black', sans-serif" font-size="24"
          font-weight="bold" fill="#b91c1c" letter-spacing="3">CANCELLED</text>
    <line x1="20" y1="42" x2="180" y2="42" stroke="#b91c1c" stroke-width="2.5"/>
  </g>
</svg>`.trim();

  // ── NOT APPROVED ───────────────────────────────────────────────────────
  // Red, double border, two-line text — formal disapproval.
  const notApprovedSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80">
  <g transform="rotate(-6, 100, 40)" opacity="0.82">
    <rect x="6" y="6" width="188" height="68" rx="5" ry="5"
          fill="none" stroke="#c0272d" stroke-width="3"/>
    <rect x="12" y="12" width="176" height="56" rx="3" ry="3"
          fill="none" stroke="#c0272d" stroke-width="1.2"/>
    <text x="100" y="35" text-anchor="middle"
          font-family="Impact, 'Arial Black', sans-serif" font-size="18"
          font-weight="bold" fill="#c0272d" letter-spacing="2">NOT</text>
    <text x="100" y="58" text-anchor="middle"
          font-family="Impact, 'Arial Black', sans-serif" font-size="22"
          font-weight="bold" fill="#c0272d" letter-spacing="3">APPROVED</text>
  </g>
</svg>`.trim();

  // ── FOR REVIEW ─────────────────────────────────────────────────────────
  // Amber/dark yellow, dashed border, pending action feel.
  const forReviewSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80">
  <g transform="rotate(-4, 100, 40)" opacity="0.80">
    <rect x="8" y="8" width="184" height="64" rx="5" ry="5"
          fill="none" stroke="#b45309" stroke-width="2.5"
          stroke-dasharray="7,3"/>
    <text x="100" y="35" text-anchor="middle"
          font-family="Impact, 'Arial Black', sans-serif" font-size="18"
          font-weight="bold" fill="#b45309" letter-spacing="2">FOR</text>
    <text x="100" y="58" text-anchor="middle"
          font-family="Impact, 'Arial Black', sans-serif" font-size="24"
          font-weight="bold" fill="#b45309" letter-spacing="3">REVIEW</text>
  </g>
</svg>`.trim();

  // ── VERIFIED ───────────────────────────────────────────────────────────
  // Teal/green, checkmark accent, solid border — confirms authenticity.
  const verifiedSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80">
  <g transform="rotate(-8, 100, 40)" opacity="0.82">
    <rect x="8" y="8" width="184" height="64" rx="6" ry="6"
          fill="none" stroke="#0f766e" stroke-width="3"/>
    <polyline points="25,42 35,52 50,34" fill="none" stroke="#0f766e"
              stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="115" y="50" text-anchor="middle"
          font-family="Impact, 'Arial Black', sans-serif" font-size="26"
          font-weight="bold" fill="#0f766e" letter-spacing="4">VERIFIED</text>
  </g>
</svg>`.trim();

  return [
    {
      id: 'default-approved',
      url: svgToDataUrl(approvedSvg),
      label: 'Approved',
    },
    {
      id: 'default-confidential',
      url: svgToDataUrl(confidentialSvg),
      label: 'Confidential',
    },
    {
      id: 'default-draft',
      url: svgToDataUrl(draftSvg),
      label: 'Draft',
    },
    {
      id: 'default-copy',
      url: svgToDataUrl(copySvg),
      label: 'Copy',
    },
    {
      id: 'default-received',
      url: svgToDataUrl(receivedSvg),
      label: 'Received',
    },
    {
      id: 'default-rejected',
      url: svgToDataUrl(rejectedSvg),
      label: 'Rejected',
    },
    {
      id: 'default-void',
      url: svgToDataUrl(voidSvg),
      label: 'Void',
    },
    {
      id: 'default-original',
      url: svgToDataUrl(originalSvg),
      label: 'Original',
    },
    {
      id: 'default-urgent',
      url: svgToDataUrl(urgentSvg),
      label: 'Urgent',
    },
    {
      id: 'default-final',
      url: svgToDataUrl(finalSvg),
      label: 'Final',
    },
    {
      id: 'default-revised',
      url: svgToDataUrl(revisedSvg),
      label: 'Revised',
    },
    {
      id: 'default-paid',
      url: svgToDataUrl(paidSvg),
      label: 'Paid',
    },
    {
      id: 'default-cancelled',
      url: svgToDataUrl(cancelledSvg),
      label: 'Cancelled',
    },
    {
      id: 'default-not-approved',
      url: svgToDataUrl(notApprovedSvg),
      label: 'Not Approved',
    },
    {
      id: 'default-for-review',
      url: svgToDataUrl(forReviewSvg),
      label: 'For Review',
    },
    {
      id: 'default-verified',
      url: svgToDataUrl(verifiedSvg),
      label: 'Verified',
    },
  ];
}
