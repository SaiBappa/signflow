import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Fonts available for text fields. `value` maps to a pdf-lib StandardFont on
// export; `css` is used to render the same font in the browser preview.
export const TEXT_FONTS = [
  { label: 'Sans', value: 'Helvetica', css: 'Helvetica, Arial, sans-serif' },
  { label: 'Serif', value: 'Times', css: '"Times New Roman", Times, serif' },
  { label: 'Mono', value: 'Courier', css: '"Courier New", Courier, monospace' },
] as const;

export type TextFontValue = (typeof TEXT_FONTS)[number]['value'];

export function fontCss(value?: string): string {
  return (TEXT_FONTS.find(f => f.value === value) || TEXT_FONTS[0]).css;
}

// simple bg removal
export function removeImageBackground(
  imageUrl: string,
  tolerance: number,
  tintColor?: string // hex color like "#000000"
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
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        
        // Euclidean distance from white (255, 255, 255)
        const dist = Math.sqrt(
          Math.pow(255 - r, 2) + Math.pow(255 - g, 2) + Math.pow(255 - b, 2)
        );
        
        // If color is close enough to white, make it transparent
        if (dist < tolerance) {
          data[i + 3] = 0; 
        } else if (targetR !== -1 && a > 0) {
          // If a target color is specified, we tint the pixel.
          // For signatures (black/dark on white), we want to preserve the alpha/anti-aliasing, 
          // and apply the target color. 
          // To keep it simple, we just set the color to the target color.
          // Or if we want better anti-aliasing, we could compute alpha from darkness if originally white bg.
          data[i] = targetR;
          data[i + 1] = targetG;
          data[i + 2] = targetB;
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
  });
}

// download utility
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
