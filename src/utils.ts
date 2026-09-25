import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Fonts available for text fields. `value` maps to an embedded Liberation
// TTF (metric-compatible with the named family) on export via fontRegistry,
// falling back to the pdf-lib StandardFont; `css` renders the SAME Liberation
// face in the browser preview so screen and export match.
export const TEXT_FONTS = [
  { label: 'Sans-Serif', value: 'Helvetica', css: '"Liberation Sans", Arial, Helvetica, sans-serif' },
  { label: 'Serif', value: 'Times', css: '"Liberation Serif", "Times New Roman", Times, serif' },
  { label: 'Monospace', value: 'Courier', css: '"Liberation Mono", "Courier New", Courier, monospace' },
  { label: 'Faruma', value: 'Faruma', css: 'Faruma, sans-serif' },
] as const;

export type TextFontValue = (typeof TEXT_FONTS)[number]['value'];

export function fontCss(value?: string): string {
  return (TEXT_FONTS.find(f => f.value === value) || TEXT_FONTS[0]).css;
}

/** Canvas/ctx.font string for a text instance, including weight and style. */
export function canvasFontString(fontSizePx: number, family?: string, bold?: boolean, italic?: boolean): string {
  return `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${fontSizePx}px ${fontCss(family)}`;
}

/**
 * Ensures the @font-face faces used by the given text instances are loaded
 * before they are drawn onto an export canvas (fillText won't wait for lazily
 * loaded fonts and would silently render a fallback).
 */
export async function ensureTextFontsLoaded(
  texts: Array<{ fontFamily?: string; bold?: boolean; italic?: boolean }>
): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  await Promise.all(
    texts.map(t =>
      document.fonts.load(canvasFontString(16, t.fontFamily, t.bold, t.italic)).catch(() => [])
    )
  );
}

// Advanced background removal with smooth alpha edge blending and adaptive thresholding
export function removeImageBackground(
  imageUrl: string,
  tolerance: number,
  tintColor?: string, // hex color like "#000000"
<<<<<<< HEAD
  bgRemovalMode: 'white' | 'black' | 'auto' = 'white'
=======
  bgRemovalMode: 'white' | 'black' | 'auto' = 'auto'
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Could not get 2d context"));
      
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const w = canvas.width;
      const h = canvas.height;
      
      let targetR = -1;
      let targetG = -1;
      let targetB = -1;
      
      if (tintColor && tintColor.startsWith("#")) {
        const hex = tintColor.replace("#", "");
        if (hex.length === 6) {
          targetR = parseInt(hex.substring(0, 2), 16);
          targetG = parseInt(hex.substring(2, 4), 16);
          targetB = parseInt(hex.substring(4, 6), 16);
        }
      }
      
      // Determine the background color to remove
      let bgR = 255;
      let bgG = 255;
      let bgB = 255;
      
      if (bgRemovalMode === 'black') {
        bgR = 0;
        bgG = 0;
        bgB = 0;
      } else if (bgRemovalMode === 'auto') {
        // Sample edge pixels robustly using the median of each channel to ignore stamps or marks
        const samplePixels: [number, number][] = [];
        // Top and bottom edge
        for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 40))) {
          samplePixels.push([x, 0], [x, h - 1]);
        }
        // Left and right edge
        for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 40))) {
          samplePixels.push([0, y], [w - 1, y]);
        }
        
        const rValues: number[] = [];
        const gValues: number[] = [];
        const bValues: number[] = [];
        const aValues: number[] = [];

        samplePixels.forEach(([cx, cy]) => {
          if (cx >= 0 && cx < w && cy >= 0 && cy < h) {
            const idx = (cy * w + cx) * 4;
            rValues.push(data[idx]);
            gValues.push(data[idx + 1]);
            bValues.push(data[idx + 2]);
            aValues.push(data[idx + 3]);
          }
        });

        if (rValues.length > 0) {
          rValues.sort((a, b) => a - b);
          gValues.sort((a, b) => a - b);
          bValues.sort((a, b) => a - b);
          aValues.sort((a, b) => a - b);
          const mid = Math.floor(rValues.length / 2);
          bgR = rValues[mid];
          bgG = gValues[mid];
          bgB = bValues[mid];

          // If the edges are already transparent (e.g. a drawn signature or a
          // PNG with a transparent background), the background is already gone.
          // Removing a "color" here would strip the actual ink (the median RGB of
          // transparent pixels reads as black), so skip removal and only tint.
          if (aValues[mid] < 128) {
            if (targetR !== -1) {
              for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] > 0) {
                  data[i] = targetR;
                  data[i + 1] = targetG;
                  data[i + 2] = targetB;
                }
              }
            }
            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL("image/png"));
            return;
          }
        }
      }
      
      const bgLum = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB;
      const isLightBg = bgLum > 120;
      
      if (bgRemovalMode === 'auto' && isLightBg) {
        // --- ADAPTIVE THRESHOLDING FOR LIGHT PAPER SIGNATURES ---
        // 1. Create grayscale representation
        const gray = new Uint8ClampedArray(w * h);
        for (let i = 0; i < data.length; i += 4) {
          gray[i / 4] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        }
        
        // 2. Compute Integral Image (Summed-Area Table)
        const integral = new Uint32Array((w + 1) * (h + 1));
        for (let y = 0; y < h; y++) {
          let rowSum = 0;
          for (let x = 0; x < w; x++) {
            rowSum += gray[y * w + x];
            integral[(y + 1) * (w + 1) + (x + 1)] = rowSum + integral[y * (w + 1) + (x + 1)];
          }
        }
        
        // 3. Apply local thresholding with window S and tolerance-derived sensitivity
        const S = Math.max(31, Math.floor(Math.max(w, h) * 0.05)); // local neighborhood window size
        const sHalf = Math.floor(S / 2);
        
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const val = gray[y * w + x];
            
            // Window bounds
            const x1 = Math.max(0, x - sHalf);
            const y1 = Math.max(0, y - sHalf);
            const x2 = Math.min(w - 1, x + sHalf);
            const y2 = Math.min(h - 1, y + sHalf);
            
            // Calculate sum using Integral Image
            const sum = integral[(y2 + 1) * (w + 1) + (x2 + 1)] 
                      - integral[y1 * (w + 1) + (x2 + 1)] 
                      - integral[(y2 + 1) * (w + 1) + x1] 
                      + integral[y1 * (w + 1) + x1];
            const count = (x2 - x1 + 1) * (y2 - y1 + 1);
            const localAvg = sum / count;
            
            // Map tolerance: lower tolerance keeps more, higher tolerance removes more
            // threshold determines the minimum drop in brightness to be considered ink
            const threshold = localAvg * (0.02 + tolerance * 0.0035);
            const minDiff = threshold;
            const maxDiff = threshold * 1.5;
            
            const diff = localAvg - val;
            let alpha = 0;
            
            if (diff >= maxDiff) {
              alpha = data[idx + 3]; // keep original alpha
            } else if (diff <= minDiff) {
              alpha = 0; // make transparent
            } else {
              // Smooth alpha transition
              const factor = (diff - minDiff) / (maxDiff - minDiff);
              alpha = Math.round(data[idx + 3] * factor);
            }
            
            data[idx + 3] = alpha;
            
            // Apply tint to remaining visible strokes
            if (targetR !== -1 && alpha > 0) {
              data[idx] = targetR;
              data[idx + 1] = targetG;
              data[idx + 2] = targetB;
            }
          }
        }
      } else {
        // --- GLOBAL COLOR DISTANCE FOR WHITE/BLACK OR DARK BACKGROUNDS ---
        const softEdge = tolerance * 0.35;
        
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          
          let dist = Math.sqrt(
            Math.pow(bgR - r, 2) + Math.pow(bgG - g, 2) + Math.pow(bgB - b, 2)
          );
          
          if (dist < tolerance) {
            if (softEdge > 0 && dist > (tolerance - softEdge)) {
              const edgeFactor = (dist - (tolerance - softEdge)) / softEdge;
              data[i + 3] = Math.round(a * edgeFactor);
            } else {
              data[i + 3] = 0;
            }
          }
          
          if (targetR !== -1 && data[i + 3] > 0) {
            data[i] = targetR;
            data[i + 1] = targetG;
            data[i + 2] = targetB;
          }
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
  });
}

// Enhance signature: boost contrast, darken strokes, sharpen edges to look like real ink
export function enhanceSignature(
  imageUrl: string,
  strength: number = 50 // 0–100
>>>>>>> feat/prepare-form
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Could not get 2d context"));
      
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      const factor = strength / 100;
      
<<<<<<< HEAD
      // Determine the background color to remove
      let bgR = 255;
      let bgG = 255;
      let bgB = 255;
      
      if (bgRemovalMode === 'black') {
        bgR = 0;
        bgG = 0;
        bgB = 0;
      } else if (bgRemovalMode === 'auto') {
        // Sample edge pixels (four corners)
        const corners = [
          [0, 0],
          [canvas.width - 1, 0],
          [0, canvas.height - 1],
          [canvas.width - 1, canvas.height - 1]
        ];
        let sumR = 0, sumG = 0, sumB = 0;
        let sampleCount = 0;
        corners.forEach(([cx, cy]) => {
          if (cx >= 0 && cx < canvas.width && cy >= 0 && cy < canvas.height) {
            const idx = (cy * canvas.width + cx) * 4;
            sumR += data[idx];
            sumG += data[idx + 1];
            sumB += data[idx + 2];
            sampleCount++;
          }
        });
        if (sampleCount > 0) {
          bgR = Math.round(sumR / sampleCount);
          bgG = Math.round(sumG / sampleCount);
          bgB = Math.round(sumB / sampleCount);
        }
      }
      
=======
      // --- Pass 1: Contrast boost + ink darkening ---
>>>>>>> feat/prepare-form
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a === 0) continue; // skip fully transparent
        
<<<<<<< HEAD
        // Euclidean distance from the background color
        const dist = Math.sqrt(
          Math.pow(bgR - r, 2) + Math.pow(bgG - g, 2) + Math.pow(bgB - b, 2)
        );
        
        // If color is close enough to background, make it transparent
        if (dist < tolerance) {
          data[i + 3] = 0; 
        } else if (targetR !== -1 && a > 0) {
          // If a target color is specified, we tint the pixel.
          // For signatures (black/dark on white), we want to preserve the alpha/anti-aliasing, 
          // and apply the target color. 
          // To keep it simple, we just set the color to the target color.
          data[i] = targetR;
          data[i + 1] = targetG;
          data[i + 2] = targetB;
=======
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];
        
        // Calculate luminance (perceived brightness)
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        
        // Contrast enhancement: push darks darker, lights lighter
        const contrastAmount = 1 + factor * 1.8; // up to 2.8x contrast
        const midpoint = 128;
        r = Math.max(0, Math.min(255, midpoint + (r - midpoint) * contrastAmount));
        g = Math.max(0, Math.min(255, midpoint + (g - midpoint) * contrastAmount));
        b = Math.max(0, Math.min(255, midpoint + (b - midpoint) * contrastAmount));
        
        // For dark pixels (ink strokes), make them even darker
        if (lum < 128) {
          const darkenFactor = 1 - factor * 0.6 * (1 - lum / 128);
          r = Math.max(0, Math.round(r * darkenFactor));
          g = Math.max(0, Math.round(g * darkenFactor));
          b = Math.max(0, Math.round(b * darkenFactor));
>>>>>>> feat/prepare-form
        }
        
        // Boost alpha on semi-transparent stroke edges to make them crisper
        if (a > 20 && a < 255) {
          const alphaBoost = Math.min(255, a + Math.round(a * factor * 0.8));
          data[i + 3] = alphaBoost;
        }
        
        data[i] = Math.round(r);
        data[i + 1] = Math.round(g);
        data[i + 2] = Math.round(b);
      }
      
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
  });
}

// download utility
// Rotate an image data URL by the given angle (in degrees, multiples of 90)
// and return a new PNG data URL with the rotation baked in. For 90°/270° the
// output canvas swaps width/height so the rotated image isn't clipped.
export function rotateImage(dataUrl: string, degrees: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const rad = (degrees * Math.PI) / 180;
      const swap = Math.abs(degrees % 180) === 90;
      const canvas = document.createElement("canvas");
      canvas.width = swap ? img.height : img.width;
      canvas.height = swap ? img.width : img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Parse a hex color (e.g. "#1d4ed8" or "1d4ed8") into normalized 0–1 RGB
// channels for pdf-lib's rgb(). Falls back to black on malformed input.
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = (hex || '').replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) / 255;
    const g = parseInt(clean[1] + clean[1], 16) / 255;
    const b = parseInt(clean[2] + clean[2], 16) / 255;
    return { r, g, b };
  }
  if (clean.length === 6) {
    return {
      r: parseInt(clean.substring(0, 2), 16) / 255,
      g: parseInt(clean.substring(2, 4), 16) / 255,
      b: parseInt(clean.substring(4, 6), 16) / 255,
    };
  }
  return { r: 0, g: 0, b: 0 };
}

// Parse a page-range string like "1, 3-5, 8" into a sorted, de-duplicated
// array of 1-based page numbers, clamped to [1, totalPages]. An empty or
// blank string means "all pages".
export function parsePageRange(rangeStr: string, totalPages: number): number[] {
  const trimmed = (rangeStr || '').trim();
  if (!trimmed) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set<number>();
  for (const part of trimmed.split(',')) {
    const seg = part.trim();
    if (!seg) continue;
    const range = seg.split('-');
    if (range.length === 1) {
      const n = parseInt(range[0], 10);
      if (!isNaN(n) && n >= 1 && n <= totalPages) pages.add(n);
    } else if (range.length === 2) {
      let start = parseInt(range[0], 10);
      let end = parseInt(range[1], 10);
      if (isNaN(start) || isNaN(end)) continue;
      if (start > end) [start, end] = [end, start];
      for (let n = start; n <= end; n++) {
        if (n >= 1 && n <= totalPages) pages.add(n);
      }
    }
  }
  return Array.from(pages).sort((a, b) => a - b);
}

export function isPageInRange(rangeStr: string, pageIndex: number): boolean {
  if (!rangeStr) return false;
  const parts = rangeStr.split(',');
  for (const part of parts) {
    const range = part.trim().split('-');
    if (range.length === 1) {
      if (parseInt(range[0]) === pageIndex) return true;
    } else if (range.length === 2) {
      const start = parseInt(range[0]);
      const end = parseInt(range[1]);
      if (pageIndex >= start && pageIndex <= end) return true;
    }
  }
  return false;
}
