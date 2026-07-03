/**
 * Export Service — Handles rendering all annotations onto PDFs and images for download.
 * Extracted from App.tsx handleDownload to keep the component lean.
 */
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { DocumentFile, SignatureState, TextInstance, StampInstance, RedactInstance } from '../types';
import { isPageInRange, downloadBlob } from '../utils';

export interface ExportOptions {
  documentFile: DocumentFile;
  signature: SignatureState | null;
  texts: TextInstance[];
  stamps: StampInstance[];
  redacts: RedactInstance[];
}

/**
 * Exports the document with all annotations embedded.
 * For PDFs: uses pdf-lib to embed images/text/shapes into the PDF.
 * For images: uses canvas to draw annotations on top and export as PNG.
 */
export async function exportDocument(options: ExportOptions): Promise<void> {
  const { documentFile, signature, texts, stamps, redacts } = options;

  // Find the rendered page element for coordinate mapping
  const pageEl = document.getElementById('document-canvas-content-1') ||
    document.getElementById('document-canvas-content');
  const container = document.getElementById('document-canvas-container-1') ||
    document.getElementById('document-canvas-container');
  if (!pageEl || !container) throw new Error("Could not find document page");

  const displayWidth = pageEl.clientWidth;
  const displayHeight = pageEl.clientHeight;

  if (documentFile.type === 'pdf') {
    await exportPdf({ documentFile, signature, texts, stamps, redacts, displayWidth, displayHeight, pageEl });
  } else {
    await exportImage({ documentFile, signature, texts, stamps, redacts, displayWidth, displayHeight });
  }
}

// ─── PDF Export ────────────────────────────────────────────────────

interface PdfExportContext extends ExportOptions {
  displayWidth: number;
  displayHeight: number;
  pageEl: HTMLElement;
}

async function exportPdf(ctx: PdfExportContext): Promise<void> {
  const { documentFile, signature, texts, stamps, redacts, pageEl } = ctx;

  const arrayBuffer = await documentFile.file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);

  // Embed unique signature images
  const embeddedImages = new Map<string, any>();
  if (signature && signature.instances.length > 0) {
    const allUrls: string[] = Array.from(new Set(signature.instances.map(i => i.url || signature.url)));
    if (allUrls.length === 0) allUrls.push(signature.url);
    for (const url of allUrls) {
      const sigRes = await fetch(url);
      const sigArrayBuffer = await sigRes.arrayBuffer();
      let embeddedImage;
      try {
        embeddedImage = await pdfDoc.embedPng(sigArrayBuffer);
      } catch (e) {
        embeddedImage = await pdfDoc.embedJpg(sigArrayBuffer);
      }
      embeddedImages.set(url, embeddedImage);
    }
  }

  // Embed unique stamp images
  const embeddedStampImages = new Map<string, any>();
  if (stamps.length > 0) {
    const stampUrls: string[] = Array.from(new Set(stamps.map(s => s.url)));
    for (const url of stampUrls) {
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      let img;
      try { img = await pdfDoc.embedPng(buf); } catch { img = await pdfDoc.embedJpg(buf); }
      embeddedStampImages.set(url, img);
    }
  }

  const pages = pdfDoc.getPages();

  // Embed text fonts
  const textFonts: Record<string, any> = {
    Helvetica: await pdfDoc.embedFont(StandardFonts.Helvetica),
    Times: await pdfDoc.embedFont(StandardFonts.TimesRoman),
    Courier: await pdfDoc.embedFont(StandardFonts.Courier),
  };

  // Load into pdfjs for viewport mapping
  const pdfjsDoc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pdfjsPage = await pdfjsDoc.getPage(i + 1);
    const viewport = pdfjsPage.getViewport({ scale: 1.0 });
    const rotation = page.getRotation().angle;

    // Draw redaction rectangles (below everything else)
    drawRedacts(redacts, i + 1, page, viewport, rotation, pageEl);

    // Draw signatures
    if (signature) {
      drawSignatures(signature, i + 1, page, viewport, rotation, embeddedImages, pageEl);
    }

    // Draw stamps
    drawStamps(stamps, i + 1, page, viewport, rotation, embeddedStampImages, pageEl);

    // Draw texts
    drawTexts(texts, i + 1, page, viewport, rotation, textFonts, pageEl);
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  downloadBlob(blob, `signed_${documentFile.name}`);
}

function drawRedacts(
  redacts: RedactInstance[], pageNum: number, page: any,
  viewport: any, rotation: number, fallbackEl: HTMLElement
) {
  redacts.forEach(redact => {
    if (redact.pageIndex !== pageNum) return;
    const el = document.getElementById(`document-canvas-content-${redact.pageIndex}`) || fallbackEl;
    const cw = redact.canvasWidth || el.clientWidth;
    const ch = redact.canvasHeight || el.clientHeight;
    const sx = viewport.width / cw;
    const sy = viewport.height / ch;
    const hex = redact.color.replace('#', '');
    const rr = parseInt(hex.substring(0, 2), 16) / 255 || 1;
    const rg = parseInt(hex.substring(2, 4), 16) / 255 || 1;
    const rb = parseInt(hex.substring(4, 6), 16) / 255 || 1;
    const visX = redact.pos.x * sx;
    const visY = redact.pos.y * sy;
    const visW = redact.pos.width * sx;
    const visH = redact.pos.height * sy;
    const bl = viewport.convertToPdfPoint(visX, visY + visH);
    page.drawRectangle({
      x: bl[0], y: bl[1],
      width: visW, height: visH,
      color: rgb(rr, rg, rb),
      rotate: degrees(-rotation),
    });
  });
}

function drawSignatures(
  signature: SignatureState, pageNum: number, page: any,
  viewport: any, rotation: number, embeddedImages: Map<string, any>, fallbackEl: HTMLElement
) {
  signature.instances.forEach(instance => {
    if (signature.applyMode === 'all') {
      if (isPageInRange(signature.excludedPages, pageNum)) return;
    } else if (signature.applyMode === 'custom') {
      if (!isPageInRange(signature.customPages, pageNum)) return;
    } else {
      if (instance.pageIndex !== pageNum) return;
    }

    const el = document.getElementById(`document-canvas-content-${instance.pageIndex}`) || fallbackEl;
    const instCanvasWidth = instance.canvasWidth || el.clientWidth;
    const instCanvasHeight = instance.canvasHeight || el.clientHeight;
    const scaleX = viewport.width / instCanvasWidth;
    const scaleY = viewport.height / instCanvasHeight;
    const pdfVisX = instance.pos.x * scaleX;
    const pdfVisY = instance.pos.y * scaleY;
    const pdfVisW = instance.pos.width * scaleX;
    const pdfVisH = instance.pos.height * scaleY;
    const instAspect = instance.aspectRatio || signature.aspectRatio;
    let drawW = pdfVisW, drawH = pdfVisH, drawX = pdfVisX, drawY = pdfVisY;
    if (instAspect) {
      const boxRatio = pdfVisW / pdfVisH;
      if (instAspect > boxRatio) { drawW = pdfVisW; drawH = pdfVisW / instAspect; drawY = pdfVisY + (pdfVisH - drawH) / 2; }
      else { drawH = pdfVisH; drawW = pdfVisH * instAspect; drawX = pdfVisX + (pdfVisW - drawW) / 2; }
    }
    const cx = drawX + drawW / 2;
    const cy = drawY + drawH / 2;
    const pdfCenter = viewport.convertToPdfPoint(cx, cy);
    const totalRotationDeg = -rotation - (instance.rotation || 0);
    const totalRotationRad = totalRotationDeg * Math.PI / 180;
    const dx = (drawW / 2) * Math.cos(totalRotationRad) - (drawH / 2) * Math.sin(totalRotationRad);
    const dy = (drawW / 2) * Math.sin(totalRotationRad) + (drawH / 2) * Math.cos(totalRotationRad);
    const finalX = pdfCenter[0] - dx;
    const finalY = pdfCenter[1] - dy;
    const imgToDraw = embeddedImages.get(instance.url || signature.url);
    if (imgToDraw) {
      page.drawImage(imgToDraw, { x: finalX, y: finalY, width: drawW, height: drawH, rotate: degrees(totalRotationDeg) });
    }
  });
}

function drawStamps(
  stamps: StampInstance[], pageNum: number, page: any,
  viewport: any, rotation: number, embeddedStampImages: Map<string, any>, fallbackEl: HTMLElement
) {
  stamps.forEach(stamp => {
    if (stamp.pageIndex !== pageNum) return;
    const el = document.getElementById(`document-canvas-content-${stamp.pageIndex}`) || fallbackEl;
    const cw = stamp.canvasWidth || el.clientWidth;
    const ch = stamp.canvasHeight || el.clientHeight;
    const sx = viewport.width / cw;
    const sy = viewport.height / ch;
    const visX = stamp.pos.x * sx;
    const visY = stamp.pos.y * sy;
    const visW = stamp.pos.width * sx;
    const visH = stamp.pos.height * sy;
    const cx = visX + visW / 2;
    const cy = visY + visH / 2;
    const pdfCenter = viewport.convertToPdfPoint(cx, cy);
    const totalRotDeg = -rotation - (stamp.rotation || 0);
    const totalRotRad = totalRotDeg * Math.PI / 180;
    const dx = (visW / 2) * Math.cos(totalRotRad) - (visH / 2) * Math.sin(totalRotRad);
    const dy = (visW / 2) * Math.sin(totalRotRad) + (visH / 2) * Math.cos(totalRotRad);
    const imgToDraw = embeddedStampImages.get(stamp.url);
    if (imgToDraw) {
      page.drawImage(imgToDraw, { x: pdfCenter[0] - dx, y: pdfCenter[1] - dy, width: visW, height: visH, rotate: degrees(totalRotDeg) });
    }
  });
}

function drawTexts(
  texts: TextInstance[], pageNum: number, page: any,
  viewport: any, rotation: number, textFonts: Record<string, any>, fallbackEl: HTMLElement
) {
  texts.forEach(text => {
    if (text.pageIndex !== pageNum) return;
    const el = document.getElementById(`document-canvas-content-${text.pageIndex}`) || fallbackEl;
    const instCanvasWidth = text.canvasWidth || el.clientWidth;
    const instCanvasHeight = text.canvasHeight || el.clientHeight;
    const scaleX = viewport.width / instCanvasWidth;
    const scaleY = viewport.height / instCanvasHeight;
    const pdfVisX = text.pos.x * scaleX;
    const pdfVisY = text.pos.y * scaleY;
    const hex = text.color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255 || 0;
    const g = parseInt(hex.substring(2, 4), 16) / 255 || 0;
    const b = parseInt(hex.substring(4, 6), 16) / 255 || 0;
    const fontSize = text.fontSize * scaleY;
    const textFont = textFonts[text.fontFamily || 'Helvetica'] || textFonts.Helvetica;
    const lines = text.text.split('\n');
    const lineHeight = fontSize * 1.2;
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      const visualBottomLeft = viewport.convertToPdfPoint(pdfVisX, pdfVisY + (lineIdx * lineHeight) + fontSize);
      page.drawText(line, { x: visualBottomLeft[0], y: visualBottomLeft[1], size: fontSize, font: textFont, color: rgb(r, g, b), rotate: degrees(-rotation) });
    }
  });
}

// ─── Image Export ──────────────────────────────────────────────────

interface ImageExportContext extends ExportOptions {
  displayWidth: number;
  displayHeight: number;
}

async function exportImage(ctx: ImageExportContext): Promise<void> {
  const { documentFile, signature, texts, stamps, redacts, displayWidth, displayHeight } = ctx;

  const img = new Image();
  img.src = documentFile.url;
  await new Promise(resolve => img.onload = resolve);

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const canvasCtx = canvas.getContext('2d');
  if (!canvasCtx) throw new Error("Could not create canvas context");

  canvasCtx.drawImage(img, 0, 0);

  // Draw redaction rectangles first (below everything)
  redacts.forEach(redact => {
    if (redact.pageIndex !== 1) return;
    const cw = redact.canvasWidth || displayWidth;
    const ch = redact.canvasHeight || displayHeight;
    const x = (redact.pos.x / cw) * img.width;
    const y = (redact.pos.y / ch) * img.height;
    const w = (redact.pos.width / cw) * img.width;
    const h = (redact.pos.height / ch) * img.height;
    canvasCtx.fillStyle = redact.color;
    canvasCtx.fillRect(x, y, w, h);
  });

  // Draw signatures
  if (signature && signature.instances.length > 0) {
    const allUrls: string[] = Array.from(new Set(signature.instances.map(i => i.url || signature.url)));
    if (allUrls.length === 0) allUrls.push(signature.url);
    const loadedImages = new Map<string, HTMLImageElement>();
    for (const url of allUrls) {
      const sigImg = new Image();
      sigImg.src = url;
      await new Promise((resolve, reject) => { sigImg.onload = resolve; sigImg.onerror = reject; });
      loadedImages.set(url, sigImg);
    }
    signature.instances.forEach(instance => {
      if (signature.applyMode === 'all') { if (isPageInRange(signature.excludedPages, 1)) return; }
      else if (signature.applyMode === 'custom') { if (!isPageInRange(signature.customPages, 1)) return; }
      else { if (instance.pageIndex !== 1) return; }
      const instCanvasWidth = instance.canvasWidth || displayWidth;
      const instCanvasHeight = instance.canvasHeight || displayHeight;
      const normX = instance.pos.x / instCanvasWidth;
      const normY = instance.pos.y / instCanvasHeight;
      const normW = instance.pos.width / instCanvasWidth;
      const normH = instance.pos.height / instCanvasHeight;
      const imgToDraw = loadedImages.get(instance.url || signature.url);
      if (imgToDraw) {
        canvasCtx.save();
        const drawX = normX * img.width;
        const drawY = normY * img.height;
        const drawW = normW * img.width;
        const drawH = normH * img.height;
        canvasCtx.translate(drawX + drawW / 2, drawY + drawH / 2);
        canvasCtx.rotate((instance.rotation || 0) * Math.PI / 180);
        canvasCtx.drawImage(imgToDraw, -drawW / 2, -drawH / 2, drawW, drawH);
        canvasCtx.restore();
      }
    });
  }

  // Draw stamps
  for (const stamp of stamps) {
    if (stamp.pageIndex !== 1) continue;
    const stampImg = new Image();
    stampImg.src = stamp.url;
    await new Promise((resolve, reject) => { stampImg.onload = resolve; stampImg.onerror = reject; });
    const cw = stamp.canvasWidth || displayWidth;
    const ch = stamp.canvasHeight || displayHeight;
    const drawX = (stamp.pos.x / cw) * img.width;
    const drawY = (stamp.pos.y / ch) * img.height;
    const drawW = (stamp.pos.width / cw) * img.width;
    const drawH = (stamp.pos.height / ch) * img.height;
    canvasCtx.save();
    canvasCtx.translate(drawX + drawW / 2, drawY + drawH / 2);
    canvasCtx.rotate((stamp.rotation || 0) * Math.PI / 180);
    canvasCtx.drawImage(stampImg, -drawW / 2, -drawH / 2, drawW, drawH);
    canvasCtx.restore();
  }

  // Draw text annotations
  texts.forEach(text => {
    if (text.pageIndex !== 1) return;
    const cw = text.canvasWidth || displayWidth;
    const ch = text.canvasHeight || displayHeight;
    const drawX = (text.pos.x / cw) * img.width;
    const drawY = (text.pos.y / ch) * img.height;
    const fontSize = text.fontSize * (img.height / ch);
    canvasCtx.save();
    canvasCtx.font = `${fontSize}px ${text.fontFamily === 'Times' ? 'Times New Roman' : text.fontFamily === 'Courier' ? 'Courier New' : text.fontFamily === 'Faruma' ? 'Faruma, MV Boli' : 'Helvetica, Arial, sans-serif'}`;
    canvasCtx.fillStyle = text.color;
    canvasCtx.textBaseline = 'top';
    const lines = text.text.split('\n');
    const lineHeight = fontSize * 1.2;
    lines.forEach((line, lineIdx) => {
      canvasCtx.fillText(line, drawX, drawY + lineIdx * lineHeight);
    });
    canvasCtx.restore();
  });

  canvas.toBlob((blob) => {
    if (blob) {
      downloadBlob(blob, `signed_${documentFile.name.replace(/\.[^/.]+$/, "")}.png`);
    }
  }, 'image/png');
}
