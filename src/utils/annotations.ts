import { CommentInstance, DrawInstance, DrawShape } from '../types';

// ── Palettes ─────────────────────────────────────────────────────────────────
export const COMMENT_COLORS: { name: string; value: string }[] = [
  { name: 'Amber', value: '#F59E0B' },
  { name: 'Sky', value: '#0EA5E9' },
  { name: 'Rose', value: '#F43F5E' },
  { name: 'Emerald', value: '#10B981' },
  { name: 'Violet', value: '#8B5CF6' },
];

export const DRAW_COLORS: { name: string; value: string }[] = [
  { name: 'Red', value: '#EF4444' },
  { name: 'Blue', value: '#2563EB' },
  { name: 'Green', value: '#16A34A' },
  { name: 'Yellow', value: '#FACC15' },
  { name: 'Black', value: '#111827' },
];

export const DRAW_SHAPES: { id: DrawShape; label: string }[] = [
  { id: 'freehand', label: 'Pen' },
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'ellipse', label: 'Circle' },
  { id: 'line', label: 'Line' },
  { id: 'arrow', label: 'Arrow' },
  { id: 'highlight', label: 'Highlight' },
];

export const COMMENT_DEFAULT = { width: 220, height: 120 };

// ── Colour helpers ───────────────────────────────────────────────────────────
export function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16) / 255 || 0,
    g: parseInt(h.substring(2, 4), 16) / 255 || 0,
    b: parseInt(h.substring(4, 6), 16) / 255 || 0,
  };
}

// Light tint of a colour (mix with white), used for comment backgrounds.
export function lightTint(hex: string, amount = 0.85): string {
  const { r, g, b } = hexToRgb01(hex);
  const mix = (c: number) => Math.round((c + (1 - c) * amount) * 255);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export function lightTintRgb01(hex: string, amount = 0.85): { r: number; g: number; b: number } {
  const { r, g, b } = hexToRgb01(hex);
  return { r: r + (1 - r) * amount, g: g + (1 - g) * amount, b: b + (1 - b) * amount };
}

// ── Geometry helpers ─────────────────────────────────────────────────────────
// Map normalised bbox points (0-1) into absolute coordinates within a target box.
function boxPoints(d: DrawInstance, boxX: number, boxY: number, boxW: number, boxH: number): { x: number; y: number }[] {
  const pts = d.points || [];
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < pts.length; i += 2) {
    out.push({ x: boxX + pts[i] * boxW, y: boxY + pts[i + 1] * boxH });
  }
  return out;
}

function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    if (para.length === 0) { lines.push(''); continue; }
    const words = para.split(' ');
    let cur = '';
    for (const w of words) {
      if (cur.length === 0) { cur = w; }
      else if ((cur + ' ' + w).length <= maxChars) { cur += ' ' + w; }
      else { lines.push(cur); cur = w; }
    }
    if (cur.length) lines.push(cur);
  }
  return lines;
}

// ── Canvas rendering (image export + PNG export) ─────────────────────────────
export function drawDrawingToCanvas(
  ctx: CanvasRenderingContext2D,
  d: DrawInstance,
  cw: number,
  ch: number,
  targetW: number,
  targetH: number,
) {
  const sx = targetW / cw;
  const sy = targetH / ch;
  const boxX = d.pos.x * sx;
  const boxY = d.pos.y * sy;
  const boxW = d.pos.width * sx;
  const boxH = d.pos.height * sy;
  const sw = Math.max(1, d.strokeWidth * ((sx + sy) / 2));

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = d.color;
  ctx.fillStyle = d.color;
  ctx.lineWidth = sw;
  ctx.globalAlpha = d.opacity ?? (d.shape === 'highlight' ? 0.4 : 1);

  if (d.shape === 'rectangle') {
    ctx.strokeRect(boxX, boxY, boxW, boxH);
  } else if (d.shape === 'highlight') {
    ctx.fillRect(boxX, boxY, boxW, boxH);
  } else if (d.shape === 'ellipse') {
    ctx.beginPath();
    ctx.ellipse(boxX + boxW / 2, boxY + boxH / 2, Math.abs(boxW / 2), Math.abs(boxH / 2), 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (d.shape === 'line' || d.shape === 'arrow') {
    const p = boxPoints(d, boxX, boxY, boxW, boxH);
    if (p.length >= 2) {
      const a = p[0], b = p[1];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      if (d.shape === 'arrow') drawArrowHeadCanvas(ctx, a, b, sw);
    }
  } else if (d.shape === 'freehand') {
    const p = boxPoints(d, boxX, boxY, boxW, boxH);
    if (p.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(p[0].x, p[0].y);
      for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawArrowHeadCanvas(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  sw: number,
) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const len = Math.max(10, sw * 3.5);
  const spread = Math.PI / 7;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - len * Math.cos(angle - spread), to.y - len * Math.sin(angle - spread));
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - len * Math.cos(angle + spread), to.y - len * Math.sin(angle + spread));
  ctx.stroke();
}

export function drawCommentToCanvas(
  ctx: CanvasRenderingContext2D,
  c: CommentInstance,
  cw: number,
  ch: number,
  targetW: number,
  targetH: number,
) {
  const sx = targetW / cw;
  const sy = targetH / ch;
  const x = c.pos.x * sx;
  const y = c.pos.y * sy;
  const w = c.pos.width * sx;
  const h = c.pos.height * sy;
  const s = (sx + sy) / 2;
  const radius = 8 * s;
  const pad = 10 * s;

  ctx.save();
  // Card background (light tint) + accent border
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.fillStyle = lightTint(c.color, 0.86);
  ctx.fill();
  ctx.lineWidth = Math.max(1, 1.5 * s);
  ctx.strokeStyle = c.color;
  ctx.stroke();
  // Accent header strip
  const headerH = 20 * s;
  ctx.save();
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.clip();
  ctx.fillStyle = c.color;
  ctx.fillRect(x, y, w, headerH);
  ctx.restore();

  // Header text: author + time
  const headerFont = Math.max(8, 10 * s);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${headerFont}px Helvetica, Arial, sans-serif`;
  ctx.textBaseline = 'middle';
  // A small speech-bubble glyph drawn as a rounded square + tail (avoids emoji
  // tofu, which Canvas/PDF standard fonts can't render).
  const icon = headerH * 0.42;
  const iy = y + (headerH - icon) / 2;
  roundRectPath(ctx, x + pad, iy, icon * 1.2, icon, icon * 0.28);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.fillText(`${c.author || 'Comment'}`, x + pad + icon * 1.2 + 5 * s, y + headerH / 2);

  // Body text (wrapped)
  const bodyFont = Math.max(9, 12 * s);
  ctx.fillStyle = '#1F2937';
  ctx.font = `${bodyFont}px Helvetica, Arial, sans-serif`;
  ctx.textBaseline = 'top';
  const maxChars = Math.max(6, Math.floor((w - pad * 2) / (bodyFont * 0.52)));
  const lines = wrapText(c.text || '', maxChars);
  const lineH = bodyFont * 1.3;
  let ty = y + headerH + pad * 0.6;
  for (const line of lines) {
    if (ty + lineH > y + h - 2) break;
    ctx.fillText(line, x + pad, ty);
    ty += lineH;
  }
  ctx.restore();
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// ── PDF rendering (pdf-lib) ──────────────────────────────────────────────────
// viewport: pdfjs viewport at scale 1. cw/ch: display canvas dims the annotation
// was placed against. rotation: page.getRotation().angle. rgb/degrees: pdf-lib.
type Rgb = (r: number, g: number, b: number) => any;
type Degrees = (n: number) => any;

export function drawDrawingToPdf(
  page: any,
  d: DrawInstance,
  viewport: any,
  cw: number,
  ch: number,
  rotation: number,
  rgb: Rgb,
  degrees: Degrees,
) {
  const sx = viewport.width / cw;
  const sy = viewport.height / ch;
  const boxX = d.pos.x * sx;
  const boxY = d.pos.y * sy;
  const boxW = d.pos.width * sx;
  const boxH = d.pos.height * sy;
  const thickness = Math.max(0.5, d.strokeWidth * ((sx + sy) / 2));
  const { r, g, b } = hexToRgb01(d.color);
  const color = rgb(r, g, b);
  const opacity = d.opacity ?? 1;

  // Convert a viewport-space point to PDF space (rotation-correct).
  const toPdf = (vx: number, vy: number) => {
    const p = viewport.convertToPdfPoint(vx, vy);
    return { x: p[0], y: p[1] };
  };
  const stroke = (pts: { x: number; y: number }[], closed = false) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = toPdf(pts[i].x, pts[i].y);
      const c = toPdf(pts[i + 1].x, pts[i + 1].y);
      page.drawLine({ start: a, end: c, thickness, color, opacity });
    }
    if (closed && pts.length > 2) {
      const a = toPdf(pts[pts.length - 1].x, pts[pts.length - 1].y);
      const c = toPdf(pts[0].x, pts[0].y);
      page.drawLine({ start: a, end: c, thickness, color, opacity });
    }
  };

  if (d.shape === 'highlight') {
    const { r: hr, g: hg, b: hb } = hexToRgb01(d.color);
    const bl = toPdf(boxX, boxY + boxH);
    page.drawRectangle({
      x: bl.x, y: bl.y, width: boxW, height: boxH,
      color: rgb(hr, hg, hb), opacity: d.opacity ?? 0.4, rotate: degrees(-rotation),
    });
    return;
  }
  if (d.shape === 'rectangle') {
    stroke([
      { x: boxX, y: boxY }, { x: boxX + boxW, y: boxY },
      { x: boxX + boxW, y: boxY + boxH }, { x: boxX, y: boxY + boxH },
    ], true);
    return;
  }
  if (d.shape === 'ellipse') {
    const cx = boxX + boxW / 2, cy = boxY + boxH / 2;
    const rx = boxW / 2, ry = boxH / 2;
    const N = 48;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * Math.PI * 2;
      pts.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) });
    }
    stroke(pts);
    return;
  }
  const p = boxPoints(d, boxX, boxY, boxW, boxH);
  if (d.shape === 'freehand') {
    stroke(p);
    return;
  }
  if ((d.shape === 'line' || d.shape === 'arrow') && p.length >= 2) {
    const a = p[0], e = p[1];
    stroke([a, e]);
    if (d.shape === 'arrow') {
      const angle = Math.atan2(e.y - a.y, e.x - a.x);
      const len = Math.max(8, thickness * 3.5);
      const spread = Math.PI / 7;
      const h1 = { x: e.x - len * Math.cos(angle - spread), y: e.y - len * Math.sin(angle - spread) };
      const h2 = { x: e.x - len * Math.cos(angle + spread), y: e.y - len * Math.sin(angle + spread) };
      stroke([h1, e]);
      stroke([e, h2]);
    }
  }
}

export function drawCommentToPdf(
  page: any,
  c: CommentInstance,
  viewport: any,
  cw: number,
  ch: number,
  rotation: number,
  rgb: Rgb,
  degrees: Degrees,
  font: any,
) {
  const sx = viewport.width / cw;
  const sy = viewport.height / ch;
  const x = c.pos.x * sx;
  const y = c.pos.y * sy;
  const w = c.pos.width * sx;
  const h = c.pos.height * sy;

  const accent = hexToRgb01(c.color);
  const tint = lightTintRgb01(c.color, 0.86);

  // Card background + accent border (bottom-left origin like redactions)
  const bl = viewport.convertToPdfPoint(x, y + h);
  page.drawRectangle({
    x: bl[0], y: bl[1], width: w, height: h,
    color: rgb(tint.r, tint.g, tint.b),
    borderColor: rgb(accent.r, accent.g, accent.b),
    borderWidth: 1.5,
    rotate: degrees(-rotation),
  });
  // Header strip
  const headerH = Math.min(h, 18 * sy);
  const hbl = viewport.convertToPdfPoint(x, y + headerH);
  page.drawRectangle({
    x: hbl[0], y: hbl[1], width: w, height: headerH,
    color: rgb(accent.r, accent.g, accent.b),
    rotate: degrees(-rotation),
  });

  const pad = 8 * sx;
  const headerFont = Math.max(7, 9 * sy);
  const author = c.author || 'Comment';
  const hpt = viewport.convertToPdfPoint(x + pad, y + headerH - (headerH - headerFont) / 2);
  page.drawText(author, { x: hpt[0], y: hpt[1], size: headerFont, font, color: rgb(1, 1, 1), rotate: degrees(-rotation) });

  // Body text
  const bodyFont = Math.max(8, 11 * sy);
  const maxChars = Math.max(6, Math.floor((w - pad * 2) / (bodyFont * 0.52)));
  const lines = wrapText(c.text || '', maxChars);
  const lineH = bodyFont * 1.3;
  let ty = y + headerH + pad * 0.6 + bodyFont;
  for (const line of lines) {
    if (ty > y + h - 2) break;
    const pt = viewport.convertToPdfPoint(x + pad, ty);
    page.drawText(line, { x: pt[0], y: pt[1], size: bodyFont, font, color: rgb(0.12, 0.16, 0.22), rotate: degrees(-rotation) });
    ty += lineH;
  }
}
