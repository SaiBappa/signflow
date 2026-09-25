import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export interface PreviewBox {
  /** Displayed CSS pixel size of the rendered page. */
  width: number;
  height: number;
  /** Native (scale 1) PDF page size. */
  nativeWidth: number;
  nativeHeight: number;
  /** displayedWidth / nativeWidth — multiply native sizes by this for the overlay. */
  scale: number;
  pageNumber: number;
  totalPages: number;
}

interface PdfPagePreviewProps {
  file: File;
  /** Render an HTML overlay positioned over the page (e.g. a live watermark). */
  overlay?: (box: PreviewBox) => React.ReactNode;
  /** Show prev/next page controls (default true when the doc has >1 page). */
  showPager?: boolean;
}

/* Renders a single PDF page to a canvas and exposes its displayed geometry so
 * callers can overlay live, faithfully-scaled HTML previews on top of it. */
export function PdfPagePreview({ file, overlay, showPager = true }: PdfPagePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const docRef = useRef<any>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [native, setNative] = useState({ width: 0, height: 0 });
  const [displayed, setDisplayed] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);

  // (Re)load the document whenever the file changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPageNumber(1);
    (async () => {
      try {
        const buf = await file.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
        if (cancelled) return;
        docRef.current = doc;
        setTotalPages(doc.numPages);
      } catch (e) {
        console.error('Preview load failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Render the active page to the canvas.
  useEffect(() => {
    let cancelled = false;
    const doc = docRef.current;
    if (!doc) return;
    setLoading(true);
    (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1 });
        const renderScale = Math.min(2, Math.max(1, 1000 / viewport.width));
        const rv = page.getViewport({ scale: renderScale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = rv.width;
        canvas.height = rv.height;
        await page.render({ canvasContext: ctx, viewport: rv }).promise;
        if (cancelled) return;
        setNative({ width: viewport.width, height: viewport.height });
        setLoading(false);
      } catch (e) {
        if (!cancelled) console.error('Preview render failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pageNumber, totalPages]);

  // Track the displayed size so overlays scale to the page on screen.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setDisplayed({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [native.width, native.height]);

  const scale = native.width ? displayed.width / native.width : 1;
  const box: PreviewBox = {
    width: displayed.width,
    height: displayed.height,
    nativeWidth: native.width,
    nativeHeight: native.height,
    scale,
    pageNumber,
    totalPages,
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-start gap-3 p-4 md:p-8 min-h-0">
      <div className="relative shadow-[0_10px_40px_-12px_rgba(0,0,0,0.25)] rounded-sm bg-white" style={{ aspectRatio: native.width ? `${native.width} / ${native.height}` : undefined, width: '100%', maxWidth: 720 }}>
        <div ref={wrapRef} className="relative w-full h-full">
          <canvas ref={canvasRef} className="block w-full h-full rounded-sm" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
          )}
          {/* Live overlay, positioned over the rendered page. */}
          {!loading && native.width > 0 && displayed.width > 0 && overlay && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">{overlay(box)}</div>
          )}
        </div>
      </div>

      {showPager && totalPages > 1 && (
        <div className="flex items-center gap-3 bg-white/90 border border-slate-200 rounded-full px-2 py-1 shadow-sm">
          <button
            onClick={() => setPageNumber(p => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
            className="w-7 h-7 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-bold text-slate-600 tabular-nums">
            {pageNumber} / {totalPages}
          </span>
          <button
            onClick={() => setPageNumber(p => Math.min(totalPages, p + 1))}
            disabled={pageNumber >= totalPages}
            className="w-7 h-7 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
