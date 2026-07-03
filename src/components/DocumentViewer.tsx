import React, { useRef, useEffect, useState } from 'react';
import { Rnd } from 'react-rnd';
<<<<<<< HEAD
import { ChevronLeft, ChevronRight, RotateCw, ShieldCheck, MapPin, CheckCircle, RefreshCw, X } from 'lucide-react';
import { DocumentFile, SignatureState, TextInstance } from '../types';
=======
import { ChevronLeft, ChevronRight, RotateCw, ShieldCheck, MapPin, CheckCircle, RefreshCw, X, CheckSquare, Circle, AlignLeft, Lock } from 'lucide-react';
import { DocumentFile, SignatureState, TextInstance, StampInstance, RedactInstance, FormFieldInstance, FormFieldType, CommentInstance, DrawInstance, DrawShape } from '../types';
import { extractPageRuns, ExtractedRun } from '../services/textExtraction';

// Shared offscreen canvas for measuring reprint width (CSS px) for width-fit.
let _measureCtx: CanvasRenderingContext2D | null = null;
function measureCtx(): CanvasRenderingContext2D | null {
  if (_measureCtx) return _measureCtx;
  const c = window.document.createElement('canvas');
  _measureCtx = c.getContext('2d');
  return _measureCtx;
}
function toHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Sample the rendered page canvas under a text run to recover the original
 * background colour (for the cover rectangle) and ink colour (for the reprint),
 * and shrink the reprint font so it fits the run's width with a standard font.
 * Pure read of an untainted same-origin canvas; falls back gracefully.
 */
function enrichRunFromCanvas(
  canvas: HTMLCanvasElement | null,
  run: ExtractedRun,
  cssWidth: number,
  cssHeight: number,
): ExtractedRun {
  let bgColor: string | undefined;
  let textColor: string | undefined;
  let fontSize = run.fontSize;

  try {
    if (canvas && cssWidth > 0 && cssHeight > 0) {
      const sx = canvas.width / cssWidth;
      const sy = canvas.height / cssHeight;
      let rx = Math.floor(run.pos.x * sx);
      let ry = Math.floor(run.pos.y * sy);
      let rw = Math.max(1, Math.floor(run.pos.width * sx));
      let rh = Math.max(1, Math.floor(run.pos.height * sy));
      rx = Math.max(0, Math.min(rx, canvas.width - 1));
      ry = Math.max(0, Math.min(ry, canvas.height - 1));
      rw = Math.min(rw, canvas.width - rx);
      rh = Math.min(rh, canvas.height - ry);
      const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null;
      if (ctx && rw > 0 && rh > 0) {
        const data = ctx.getImageData(rx, ry, rw, rh).data;
        // Histogram by coarse luma bucket; brightest dominant = background.
        const counts = new Map<number, { n: number; r: number; g: number; b: number }>();
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const key = (r >> 4) * 256 + (g >> 4) * 16 + (b >> 4);
          const e = counts.get(key) || { n: 0, r: 0, g: 0, b: 0 };
          e.n++; e.r += r; e.g += g; e.b += b;
          counts.set(key, e);
        }
        let bg = { n: 0, r: 255, g: 255, b: 255 };
        for (const e of counts.values()) if (e.n > bg.n) bg = e;
        const bgR = bg.r / bg.n, bgG = bg.g / bg.n, bgB = bg.b / bg.n;
        bgColor = toHex(bgR, bgG, bgB);
        // Ink = pixels notably darker than background; average them.
        const bgLuma = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB;
        let tn = 0, tr = 0, tg = 0, tb = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const luma = 0.299 * r + 0.587 * g + 0.114 * b;
          if (bgLuma - luma > 40) { tn++; tr += r; tg += g; tb += b; }
        }
        if (tn > 0) textColor = toHex(tr / tn, tg / tn, tb / tn);
      }
    }
  } catch {
    // Tainted/unreadable canvas — keep defaults.
  }

  // Width-fit: shrink the reprint to fit the original box width, measured
  // with the same weight/style the reprint will render and export with.
  const mctx = measureCtx();
  if (mctx && run.text.trim()) {
    mctx.font = canvasFontString(run.fontSize, run.fontFamily, run.bold, run.italic);
    const w = mctx.measureText(run.text).width;
    if (w > run.pos.width && run.pos.width > 0) {
      fontSize = Math.max(8, run.fontSize * (run.pos.width / w));
    }
  }

  return { ...run, bgColor, textColor, fontSize };
}
>>>>>>> feat/prepare-form
import { usePdf } from '../hooks/usePdf';
import { cn, isPageInRange, fontCss, canvasFontString, TEXT_FONTS } from '../utils';
import { handleThaanaKeyDown, isDhivehiFont } from '../utils/thaanaKeyboard';
import { CommentOverlay } from './overlays/CommentOverlay';
import { DrawingOverlay } from './overlays/DrawingOverlay';
import { DrawingLayer } from './overlays/DrawingLayer';
import { useIsMobile } from '../hooks/useIsMobile';

// Enlarged resize handles so draggable overlays can be resized with a finger on
// touch devices (default react-rnd handles are ~10px — too small to grab).
const TOUCH_HANDLE = 28;
const TH_OFF = -TOUCH_HANDLE / 2;
const cornerTouchResizeHandleStyles = {
  topLeft: { width: TOUCH_HANDLE, height: TOUCH_HANDLE, top: TH_OFF, left: TH_OFF },
  topRight: { width: TOUCH_HANDLE, height: TOUCH_HANDLE, top: TH_OFF, right: TH_OFF },
  bottomLeft: { width: TOUCH_HANDLE, height: TOUCH_HANDLE, bottom: TH_OFF, left: TH_OFF },
  bottomRight: { width: TOUCH_HANDLE, height: TOUCH_HANDLE, bottom: TH_OFF, right: TH_OFF },
};
const edgeTouchResizeHandleStyles = {
  ...cornerTouchResizeHandleStyles,
  top: { height: TOUCH_HANDLE, top: TH_OFF },
  bottom: { height: TOUCH_HANDLE, bottom: TH_OFF },
  left: { width: TOUCH_HANDLE, left: TH_OFF },
  right: { width: TOUCH_HANDLE, right: TH_OFF },
};

interface DocumentViewerProps {
  document: DocumentFile | null;
  signature: SignatureState | null;
  setSignature: React.Dispatch<React.SetStateAction<SignatureState | null>>;
  texts: TextInstance[];
  setTexts: React.Dispatch<React.SetStateAction<TextInstance[]>>;
<<<<<<< HEAD
=======
  stamps: StampInstance[];
  setStamps: React.Dispatch<React.SetStateAction<StampInstance[]>>;
  redacts: RedactInstance[];
  setRedacts: React.Dispatch<React.SetStateAction<RedactInstance[]>>;
>>>>>>> feat/prepare-form
  isPlacementMode?: boolean;
  setIsPlacementMode?: (v: boolean) => void;
  placedForConfirmation?: boolean;
  setPlacedForConfirmation?: (v: boolean) => void;
  lastPlacedInstanceId?: string | null;
  setLastPlacedInstanceId?: (id: string | null) => void;
  onOpenTools?: () => void;
<<<<<<< HEAD
=======
  stampPlacementMode?: boolean;
  stampPlacementAsset?: { url: string; aspectRatio: number } | null;
  redactPlacementMode?: boolean;
  redactPlacementColor?: string;
  onStampPlaced?: () => void;
  onRedactPlaced?: () => void;
  textPlacementMode?: boolean;
  onTextPlacementModeChange?: (v: boolean) => void;
  formFields?: FormFieldInstance[];
  setFormFields?: React.Dispatch<React.SetStateAction<FormFieldInstance[]>>;
  formFieldPlacementMode?: boolean;
  formFieldPlacementType?: FormFieldType;
  formFieldColor?: string;
  onFormFieldPlaced?: () => void;
  onSetDefaultColor?: (type: FormFieldType, color: string) => void;
  // Comments & freehand/shape markup
  comments?: CommentInstance[];
  setComments?: React.Dispatch<React.SetStateAction<CommentInstance[]>>;
  drawings?: DrawInstance[];
  setDrawings?: React.Dispatch<React.SetStateAction<DrawInstance[]>>;
  commentPlacementMode?: boolean;
  commentColor?: string;
  commentAuthor?: string;
  onCommentPlaced?: () => void;
  drawMode?: boolean;
  drawShape?: DrawShape;
  drawColor?: string;
  drawStrokeWidth?: number;
  drawOpacity?: number;
  // In-place text editing
  editTextMode?: boolean;
  onEditTextRun?: (run: ExtractedRun) => void;
>>>>>>> feat/prepare-form
}

interface PdfPageProps {
  key?: React.Key;
  pageNum: number;
  pdfDoc: any;
  containerWidth: number;
  signature: SignatureState | null;
  setSignature: React.Dispatch<React.SetStateAction<SignatureState | null>>;
  texts: TextInstance[];
  setTexts: React.Dispatch<React.SetStateAction<TextInstance[]>>;
  stamps: StampInstance[];
  setStamps: React.Dispatch<React.SetStateAction<StampInstance[]>>;
  redacts: RedactInstance[];
  setRedacts: React.Dispatch<React.SetStateAction<RedactInstance[]>>;
  editingTextId: string | null;
  setEditingTextId: (id: string | null) => void;
  selectedTextId: string | null;
  setSelectedTextId: (id: string | null) => void;
  selectedStampId: string | null;
  setSelectedStampId: (id: string | null) => void;
  selectedRedactId: string | null;
  setSelectedRedactId: (id: string | null) => void;
  selectedFormFieldId: string | null;
  setSelectedFormFieldId: (id: string | null) => void;
  formFields?: FormFieldInstance[];
  setFormFields?: React.Dispatch<React.SetStateAction<FormFieldInstance[]>>;
  onSetDefaultColor?: (type: FormFieldType, color: string) => void;
  comments: CommentInstance[];
  setComments: React.Dispatch<React.SetStateAction<CommentInstance[]>>;
  drawings: DrawInstance[];
  setDrawings: React.Dispatch<React.SetStateAction<DrawInstance[]>>;
  selectedCommentId: string | null;
  setSelectedCommentId: (id: string | null) => void;
  selectedDrawingId: string | null;
  setSelectedDrawingId: (id: string | null) => void;
  drawMode?: boolean;
  drawShape?: DrawShape;
  drawColor?: string;
  drawStrokeWidth?: number;
  drawOpacity?: number;
  editTextMode?: boolean;
  onEditTextRun?: (run: ExtractedRun) => void;
}

function PdfPage({
  pageNum,
  pdfDoc,
  containerWidth,
  signature,
  setSignature,
  texts,
  setTexts,
<<<<<<< HEAD
  isPlacementMode = false,
  setIsPlacementMode,
  placedForConfirmation = false,
  setPlacedForConfirmation,
  lastPlacedInstanceId,
  setLastPlacedInstanceId,
  onOpenTools,
}: DocumentViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
=======
  stamps,
  setStamps,
  redacts,
  setRedacts,
  editingTextId,
  setEditingTextId,
  selectedTextId,
  setSelectedTextId,
  selectedStampId,
  setSelectedStampId,
  selectedRedactId,
  setSelectedRedactId,
  selectedFormFieldId,
  setSelectedFormFieldId,
  formFields,
  setFormFields,
  onSetDefaultColor,
  comments,
  setComments,
  drawings,
  setDrawings,
  selectedCommentId,
  setSelectedCommentId,
  selectedDrawingId,
  setSelectedDrawingId,
  drawMode,
  drawShape,
  drawColor,
  drawStrokeWidth,
  drawOpacity,
  editTextMode,
  onEditTextRun,
}: PdfPageProps) {
>>>>>>> feat/prepare-form
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMobile = useIsMobile();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [renderScale, setRenderScale] = useState(1);
<<<<<<< HEAD
  const [renderedDimensions, setRenderedDimensions] = useState({ width: 0, height: 0 });
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
=======
  const [loading, setLoading] = useState(false);
  const prevDimensionsRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  // ── In-place text editing: extract positioned text runs for this page ──
  const [editRuns, setEditRuns] = useState<ExtractedRun[]>([]);
  const [consumedRunIds, setConsumedRunIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    if (!editTextMode || !pdfDoc || dimensions.width === 0 || dimensions.height === 0) {
      setEditRuns([]);
      return;
    }
    extractPageRuns(pdfDoc, pageNum, dimensions.width, dimensions.height)
      .then(runs => { if (!cancelled) setEditRuns(runs); })
      .catch(() => { if (!cancelled) setEditRuns([]); });
    return () => { cancelled = true; };
  }, [editTextMode, pdfDoc, pageNum, dimensions.width, dimensions.height]);

  // Clear consumed markers when leaving edit mode so re-entering shows all runs.
  useEffect(() => {
    if (!editTextMode) setConsumedRunIds(new Set());
  }, [editTextMode]);

  // When dimensions change due to container resize, rescale signature/text positions
  useEffect(() => {
    const prev = prevDimensionsRef.current;
    const curr = dimensions;

    if (prev.width > 0 && prev.height > 0 && curr.width > 0 && curr.height > 0) {
      const scaleX = curr.width / prev.width;
      const scaleY = curr.height / prev.height;

      if (Math.abs(scaleX - 1) > 0.001 || Math.abs(scaleY - 1) > 0.001) {
        setSignature(prevSig => {
          if (!prevSig || !prevSig.instances.length) return prevSig;
          return {
            ...prevSig,
            instances: prevSig.instances.map(inst => {
              if (inst.pageIndex !== pageNum) return inst;
              return {
                ...inst,
                pos: {
                  x: inst.pos.x * scaleX,
                  y: inst.pos.y * scaleY,
                  width: inst.pos.width * scaleX,
                  height: inst.pos.height * scaleY,
                },
                canvasWidth: curr.width,
                canvasHeight: curr.height,
              };
            }),
          };
        });

        setTexts(prevTexts => {
          if (!prevTexts.length) return prevTexts;
          return prevTexts.map(t => {
            if (t.pageIndex !== pageNum) return t;
            return {
              ...t,
              pos: {
                x: t.pos.x * scaleX,
                y: t.pos.y * scaleY,
                width: t.pos.width * scaleX,
                height: t.pos.height * scaleY,
              },
              fontSize: t.fontSize * scaleY,
              canvasWidth: curr.width,
              canvasHeight: curr.height,
            };
          });
        });

        setStamps(prevStamps => {
          if (!prevStamps.length) return prevStamps;
          return prevStamps.map(s => {
            if (s.pageIndex !== pageNum) return s;
            return {
              ...s,
              pos: {
                x: s.pos.x * scaleX,
                y: s.pos.y * scaleY,
                width: s.pos.width * scaleX,
                height: s.pos.height * scaleY,
              },
              canvasWidth: curr.width,
              canvasHeight: curr.height,
            };
          });
        });

        setRedacts(prevRedacts => {
          if (!prevRedacts.length) return prevRedacts;
          return prevRedacts.map(r => {
            if (r.pageIndex !== pageNum) return r;
            return {
              ...r,
              pos: {
                x: r.pos.x * scaleX,
                y: r.pos.y * scaleY,
                width: r.pos.width * scaleX,
                height: r.pos.height * scaleY,
              },
              canvasWidth: curr.width,
              canvasHeight: curr.height,
            };
          });
        });
      }
    }

    prevDimensionsRef.current = curr;
  }, [dimensions, pageNum, setSignature, setTexts, setStamps, setRedacts]);
>>>>>>> feat/prepare-form

  // Track previous rendered dimensions so we can rescale signature/text positions
  // when the canvas resizes (e.g. settings panel open/close).
  const prevDimensionsRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;

  // When renderedDimensions change due to a resize (same page), rescale all instances
  useEffect(() => {
    const prev = prevDimensionsRef.current;
    const curr = renderedDimensions;

    // Only rescale if we had a valid previous size and the new size is also valid
    if (prev.width > 0 && prev.height > 0 && curr.width > 0 && curr.height > 0) {
      const scaleX = curr.width / prev.width;
      const scaleY = curr.height / prev.height;

      // Only rescale if dimensions actually changed (skip identity transforms)
      if (Math.abs(scaleX - 1) > 0.001 || Math.abs(scaleY - 1) > 0.001) {
        setSignature(prevSig => {
          if (!prevSig || !prevSig.instances.length) return prevSig;
          return {
            ...prevSig,
            instances: prevSig.instances.map(inst => ({
              ...inst,
              pos: {
                x: inst.pos.x * scaleX,
                y: inst.pos.y * scaleY,
                width: inst.pos.width * scaleX,
                height: inst.pos.height * scaleY,
              },
              canvasWidth: curr.width,
              canvasHeight: curr.height,
            })),
          };
        });

        setTexts(prevTexts => {
          if (!prevTexts.length) return prevTexts;
          return prevTexts.map(t => ({
            ...t,
            pos: {
              x: t.pos.x * scaleX,
              y: t.pos.y * scaleY,
              width: t.pos.width * scaleX,
              height: t.pos.height * scaleY,
            },
            fontSize: t.fontSize * scaleY,
            canvasWidth: curr.width,
            canvasHeight: curr.height,
          }));
        });
      }
    }

    // Always update the ref to current dimensions
    prevDimensionsRef.current = curr;
  }, [renderedDimensions, setSignature, setTexts]);

  // Track container width via ResizeObserver so PDF always re-renders at the right scale.
  // We subtract 16px (8px padding on each side) to get true available width for the canvas.
  const SCROLL_PADDING = 8; // px each side (matches style={{ padding: '0.5rem' }})
  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;

    // Take an immediate measurement in case ResizeObserver fires late
    const measure = () => {
      const w = el.clientWidth - SCROLL_PADDING * 2;
      if (w > 0) setContainerWidth(w);
    };
    measure();

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        // contentRect.width already excludes scrollbar but not our CSS padding,
        // so subtract our explicit padding to get the true render width.
        const w = entry.contentRect.width - SCROLL_PADDING * 2;
        if (w > 0) setContainerWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Render PDF page — re-runs whenever pdfDoc, page, or container width changes.
  useEffect(() => {
    let renderTask: any = null;
    let cancelled = false;

    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current) return;
<<<<<<< HEAD

      // Resolve an available width: prefer measured containerWidth, fall back to
      // the element's live offsetWidth minus padding (handles cases where the
      // ResizeObserver hasn't fired yet when pdfDoc first becomes ready).
      let availableWidth = containerWidth;
      if (availableWidth <= 0 && scrollAreaRef.current) {
        availableWidth = scrollAreaRef.current.clientWidth - SCROLL_PADDING * 2;
      }
      if (availableWidth <= 0) return; // still not laid out — wait
=======
      if (containerWidth <= 0) return;
>>>>>>> feat/prepare-form

      setLoading(true);
      try {
<<<<<<< HEAD
        const page = await pdfDoc.getPage(currentPage);
        if (cancelled) return;

        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(availableWidth / unscaledViewport.width, 2.5);
=======
        const page = await pdfDoc.getPage(pageNum);
        if (cancelled) return;

        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(containerWidth / unscaledViewport.width, 2.5);
>>>>>>> feat/prepare-form
        setRenderScale(scale);

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;

        // Cancel any previous in-flight render task before resizing the canvas
        // (resizing a canvas clears it, which is fine — we're about to redraw).
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        setDimensions({ width: viewport.width, height: viewport.height });

        renderTask = page.render({
          canvasContext: context,
          viewport: viewport,
        });

        await renderTask.promise;
      } catch (err) {
        if (err instanceof Error && err.name === 'RenderingCancelledException') {
<<<<<<< HEAD
          // Ignore cancelled renders — a new one will follow.
        } else {
          console.error("PDF render error", err);
=======
          // Ignore
        } else {
          console.error(`PDF render error page ${pageNum}`, err);
>>>>>>> feat/prepare-form
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    renderPage();

    return () => {
      cancelled = true;
      if (renderTask) renderTask.cancel();
    };
<<<<<<< HEAD
  }, [pdfDoc, currentPage, containerWidth]);
=======
  }, [pdfDoc, pageNum, containerWidth]);
>>>>>>> feat/prepare-form

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const sigType = e.dataTransfer.getData("application/my-signature");
    const textType = e.dataTransfer.getData("application/my-text");
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const pageEl = e.currentTarget.querySelector(`#document-canvas-content-${pageNum}`) as HTMLElement | null;
    const canvasWidth = pageEl?.clientWidth || e.currentTarget.clientWidth;
    const canvasHeight = pageEl?.clientHeight || e.currentTarget.clientHeight;

    if (textType) {
      setTexts(prev => [...prev, {
        id: crypto.randomUUID(),
        text: 'Double click to edit',
        pageIndex: pageNum,
        pos: { x, y, width: 200, height: 40 },
        fontSize: 24,
        color: '#000000',
        fontFamily: TEXT_FONTS[0].value,
        canvasWidth,
        canvasHeight
      }]);
      return;
    }

    if (sigType) {
      let payloadUrl = signature?.url || "";
      let payloadAspect = signature?.aspectRatio || 2.5;
      try {
        if (sigType !== "true") {
          const parsed = JSON.parse(sigType);
          if (parsed.url) payloadUrl = parsed.url;
          if (parsed.aspectRatio) payloadAspect = parsed.aspectRatio;
        }
      } catch (e) {}

      setSignature(prev => {
        const newInstance = {
          id: crypto.randomUUID(),
          pos: { x, y, width: 150, height: payloadAspect ? 150 / payloadAspect : 60 },
          pageIndex: pageNum,
          canvasWidth,
          canvasHeight,
          url: payloadUrl,
          aspectRatio: payloadAspect
        };

        if (!prev) {
          return {
             url: payloadUrl,
             originalUrl: payloadUrl,
             bgRemovalTolerance: 50,
             pos: { x: 100, y: 100, width: 150, height: payloadAspect ? 150 / payloadAspect : 60 },
             applyMode: 'single',
             customPages: '',
             excludedPages: '',
             instances: [newInstance],
             aspectRatio: payloadAspect
          };
        }
        
        return {
          ...prev,
          instances: [...prev.instances, newInstance]
        };
      });
    }
  };

  return (
    <div 
      className="relative bg-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] rounded-sm overflow-hidden shrink-0 transition-all duration-300"
      style={{
        width: dimensions.width || 'auto',
        height: dimensions.height || 'auto'
      }}
      id={`document-canvas-container-${pageNum}`}
      data-page-number={pageNum}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDrop={handleDrop}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      )}

      <canvas ref={canvasRef} id={`document-canvas-content-${pageNum}`} className="block" />

      {/* In-place text edit hotspots — click an existing text run to edit it */}
      {editTextMode && dimensions.width > 0 && editRuns.filter(r => !consumedRunIds.has(r.id)).map(run => (
        <div
          key={run.id}
          className="absolute z-40 cursor-text rounded-[2px] border border-indigo-300/40 bg-indigo-400/5 hover:border-indigo-500 hover:bg-indigo-400/15 transition-colors"
          style={{ left: run.pos.x, top: run.pos.y, width: run.pos.width, height: run.pos.height }}
          title="Click to edit this text"
          onMouseDown={(e) => { e.stopPropagation(); }}
          onClick={(e) => {
            e.stopPropagation();
            const enriched = enrichRunFromCanvas(canvasRef.current, run, dimensions.width, dimensions.height);
            onEditTextRun?.(enriched);
            setConsumedRunIds(prev => { const next = new Set(prev); next.add(run.id); return next; });
          }}
        />
      ))}

      {/* Signature Overlays */}
      {signature && dimensions.width > 0 && signature.instances?.filter((instance) => {
        if (signature.applyMode === 'all') {
          return !isPageInRange(signature.excludedPages, pageNum);
        } else if (signature.applyMode === 'custom') {
          return isPageInRange(signature.customPages, pageNum);
        }
        return instance.pageIndex === pageNum;
      }).map((instance, index) => (
        <Rnd
          key={instance.id}
          size={{ width: instance.pos.width, height: instance.pos.height }}
          position={{ x: instance.pos.x, y: instance.pos.y }}
          lockAspectRatio={true}
          onDragStop={(e, d) => {
            const pageEl = window.document.getElementById(`document-canvas-content-${pageNum}`);
            setSignature(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                instances: prev.instances.map(inst => 
                  inst.id === instance.id ? { 
                    ...inst, 
                    pos: { ...inst.pos, x: d.x, y: d.y },
                    canvasWidth: pageEl?.clientWidth,
                    canvasHeight: pageEl?.clientHeight
                  } : inst
                )
              };
            });
          }}
          onResizeStop={(e, direction, ref, delta, position) => {
            const pageEl = window.document.getElementById(`document-canvas-content-${pageNum}`);
            setSignature(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                instances: prev.instances.map(inst => 
                  inst.id === instance.id ? {
                    ...inst,
                    pos: {
                      x: position.x,
                      y: position.y,
                      width: parseInt(ref.style.width, 10),
                      height: parseInt(ref.style.height, 10),
                    },
                    canvasWidth: pageEl?.clientWidth,
                    canvasHeight: pageEl?.clientHeight
                  } : inst
                )
              };
            });
          }}
          bounds="parent"
          resizeHandleStyles={isMobile ? cornerTouchResizeHandleStyles : undefined}
          className={cn("group rounded touch-none z-50")}
        >
          <div
            className="w-full h-full relative"
            style={{ transform: `rotate(${instance.rotation || 0}deg)` }}
          >
            <div className="absolute inset-0 border-2 border-indigo-400 border-dashed rounded pointer-events-none group-active:border-indigo-500 z-10"></div>
            <div className={cn("absolute -top-1 -left-1 w-3 h-3 bg-indigo-600 rounded-full border border-white shadow-sm pointer-events-none", isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100")}></div>
            <div className={cn("absolute -top-1 -right-1 w-3 h-3 bg-indigo-600 rounded-full border border-white shadow-sm pointer-events-none", isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100")}></div>
            <div className={cn("absolute -bottom-1 -left-1 w-3 h-3 bg-indigo-600 rounded-full border border-white shadow-sm pointer-events-none", isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100")}></div>
            <div className={cn("absolute -bottom-1 -right-1 w-3 h-3 bg-indigo-600 rounded-full border border-white shadow-sm pointer-events-none", isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100")}></div>

            {/* Rotation Handle */}
            <div
              className={cn("absolute -top-9 md:-top-6 left-1/2 -translate-x-1/2 w-9 h-9 md:w-6 md:h-6 bg-white border border-slate-200 shadow-md rounded-full flex items-center justify-center cursor-crosshair pointer-events-auto z-50 hover:bg-slate-50 hover:text-indigo-600 text-slate-400 transition-colors touch-none", isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100")}
              style={{ touchAction: 'none' }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
                const startX = e.clientX;
                const startY = e.clientY;
                const startRot = instance.rotation || 0;
                
                const rect = e.currentTarget.parentElement!.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;

                const onPointerMove = (moveEvent: PointerEvent) => {
                  const currentAngle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX) * 180 / Math.PI;
                  const startAngle = Math.atan2(startY - centerY, startX - centerX) * 180 / Math.PI;
                  let newRot = startRot + (currentAngle - startAngle);
                  
                  setSignature(prev => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      instances: prev.instances.map(inst => 
                        inst.id === instance.id ? { ...inst, rotation: newRot } : inst
                      )
                    };
                  });
                };

                const onPointerUp = () => {
                  window.removeEventListener('pointermove', onPointerMove);
                  window.removeEventListener('pointerup', onPointerUp);
                };

                window.addEventListener('pointermove', onPointerMove);
                window.addEventListener('pointerup', onPointerUp);
              }}
            >
              <RotateCw size={12} />
            </div>

            <img 
              src={instance.url || signature.url} 
              className="w-full h-full object-contain pointer-events-none select-none" 
              draggable={false}
            />
          </div>
          <div className={cn("absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-slate-800 text-white pl-2 pr-1 py-1 rounded text-[10px] flex gap-2 items-center shadow-xl transition-opacity whitespace-nowrap z-50 font-sans", isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
            <span>Signature #{index + 1}</span>
            <div className="h-3 w-[1px] bg-slate-600"></div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSignature(prev => prev ? { ...prev, instances: prev.instances.filter(i => i.id !== instance.id) } : null);
              }}
              className="hover:text-red-400 text-red-300 cursor-pointer min-h-[36px] md:min-h-0 flex items-center px-1"
            >Delete</button>
          </div>
        </Rnd>
      ))}

      {/* Custom Text Overlays */}
      {texts.filter(t => t.pageIndex === pageNum).map(text => {
        const isSelected = selectedTextId === text.id;
        const isEditing = editingTextId === text.id;
        return (
        <Rnd
          key={text.id}
          size={{ width: text.pos.width, height: text.pos.height }}
          position={{ x: text.pos.x, y: text.pos.y }}
          onDragStart={() => {
            setSelectedTextId(text.id);
          }}
          onDragStop={(e, d) => {
            const pageEl = window.document.getElementById(`document-canvas-content-${pageNum}`);
            setTexts(prev => prev.map(t => 
              t.id === text.id ? { 
                ...t, 
                pos: { ...t.pos, x: d.x, y: d.y },
                canvasWidth: pageEl?.clientWidth,
                canvasHeight: pageEl?.clientHeight
              } : t
            ));
          }}
          onResizeStop={(e, direction, ref, delta, position) => {
            const pageEl = window.document.getElementById(`document-canvas-content-${pageNum}`);
            setTexts(prev => prev.map(t => 
              t.id === text.id ? {
                ...t,
                pos: {
                  x: position.x,
                  y: position.y,
                  width: parseInt(ref.style.width, 10),
                  height: parseInt(ref.style.height, 10)
                },
                fontSize: Math.max(12, parseInt(ref.style.height, 10) * 0.7),
                canvasWidth: pageEl?.clientWidth,
                canvasHeight: pageEl?.clientHeight
              } : t
            ));
          }}
          bounds="parent"
          enableResizing={isSelected && !isEditing}
          resizeHandleStyles={isMobile && isSelected && !isEditing ? cornerTouchResizeHandleStyles : undefined}
          disableDragging={isEditing}
          className={`rounded z-50 ${!isEditing ? 'touch-none' : ''} ${
            isEditing ? 'ring-2 ring-indigo-500 shadow-lg' :
            isSelected ? 'ring-2 ring-indigo-400 shadow-md' :
            'hover:ring-1 hover:ring-indigo-300/50'
          } ${!isEditing ? 'cursor-move' : ''}`}
          style={{ background: isSelected || isEditing ? 'rgba(255,255,255,0.15)' : 'transparent' }}
          onMouseDown={(e: React.MouseEvent) => {
            // Select on click (but don't interfere with toolbar interactions)
            if (!isEditing) {
              setSelectedTextId(text.id);
            }
          }}
        >
          {/* Border indicator — only when selected */}
          {isSelected && !isEditing && (
            <div className="absolute inset-0 border-2 border-indigo-400/50 border-dashed rounded pointer-events-none z-10"></div>
          )}

          {/* Visible corner dots when selected on mobile */}
          {isSelected && !isEditing && isMobile && (
            <>
              <span className="absolute -top-1 -left-1 w-3 h-3 bg-indigo-500 rounded-full border border-white shadow pointer-events-none z-10" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border border-white shadow pointer-events-none z-10" />
              <span className="absolute -bottom-1 -left-1 w-3 h-3 bg-indigo-500 rounded-full border border-white shadow pointer-events-none z-10" />
              <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border border-white shadow pointer-events-none z-10" />
            </>
          )}

          {isEditing ? (
            <textarea 
              autoFocus
              dir={isDhivehiFont(text.fontFamily) ? 'rtl' : 'ltr'}
              onBlur={() => setEditingTextId(null)}
              value={text.text}
              onChange={(e) => setTexts(prev => prev.map(t => t.id === text.id ? { ...t, text: e.target.value } : t))}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                handleThaanaKeyDown(
                  e,
                  isDhivehiFont(text.fontFamily),
                  (val) => setTexts(prev => prev.map(t => t.id === text.id ? { ...t, text: val } : t))
                );
                if (e.key === 'Escape') {
                  setEditingTextId(null);
                  e.currentTarget.blur();
                }
              }}
              className="w-full h-full bg-transparent resize-none overflow-hidden outline-none break-words leading-tight"
              style={{ fontSize: `${text.fontSize}px`, color: text.color, fontFamily: fontCss(text.fontFamily), fontWeight: text.bold ? 'bold' : undefined, fontStyle: text.italic ? 'italic' : undefined }}
              spellCheck={false}
            />
          ) : (
            <div 
               onDoubleClick={() => {
                 setSelectedTextId(text.id);
                 setEditingTextId(text.id);
               }}
               className="w-full h-full overflow-hidden select-none"
            >
               <p className="w-full h-full whitespace-pre-wrap break-words leading-tight pointer-events-none" dir={isDhivehiFont(text.fontFamily) ? 'rtl' : 'ltr'} style={{ fontSize: `${text.fontSize}px`, color: text.color, fontFamily: fontCss(text.fontFamily), fontWeight: text.bold ? 'bold' : undefined, fontStyle: text.italic ? 'italic' : undefined }}>
                 {text.text}
               </p>
            </div>
          )}

          {/* Toolbar — only when selected or editing */}
          {(isSelected || isEditing) && (
          <div
            className="absolute -bottom-12 md:-bottom-10 left-1/2 -translate-x-1/2 bg-white border border-slate-200 shadow-xl rounded-lg px-1.5 py-1 flex items-center gap-1 z-[60] whitespace-nowrap max-w-[calc(100vw-2rem)] overflow-x-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
             <select
               value={text.fontFamily || TEXT_FONTS[0].value}
               onMouseDown={(e) => e.stopPropagation()}
               onChange={(e) => {
                 const val = e.target.value;
                 setTexts(prev => prev.map(t => t.id === text.id ? { ...t, fontFamily: val } : t));
               }}
               className="h-9 md:h-7 px-1.5 text-xs sm:text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-md cursor-pointer focus:outline-none focus:border-indigo-400 hover:border-indigo-300 w-[88px] sm:w-[120px] shrink-0"
               title="Font"
             >
               {TEXT_FONTS.map(f => (
                 <option key={f.value} value={f.value} style={{ fontFamily: f.css }}>{f.label}</option>
               ))}
             </select>
             <div className="w-[1px] h-5 bg-slate-200"></div>
             <button
               onClick={(e) => {
                 e.stopPropagation();
                 setTexts(prev => prev.map(t => t.id === text.id ? { ...t, bold: !t.bold } : t));
               }}
               className={cn("w-9 h-9 md:w-7 md:h-7 flex items-center justify-center rounded-md text-sm font-bold cursor-pointer shrink-0", text.bold ? "text-indigo-600 bg-indigo-50" : "text-slate-600 hover:text-indigo-600 hover:bg-indigo-50")}
               title="Bold"
             >
               B
             </button>
             <button
               onClick={(e) => {
                 e.stopPropagation();
                 setTexts(prev => prev.map(t => t.id === text.id ? { ...t, italic: !t.italic } : t));
               }}
               className={cn("w-9 h-9 md:w-7 md:h-7 flex items-center justify-center rounded-md text-sm italic font-serif cursor-pointer shrink-0", text.italic ? "text-indigo-600 bg-indigo-50" : "text-slate-600 hover:text-indigo-600 hover:bg-indigo-50")}
               title="Italic"
             >
               I
             </button>
             <div className="w-[1px] h-5 bg-slate-200"></div>
             <button
               onClick={(e) => {
                 e.stopPropagation();
                 setTexts(prev => prev.map(t => t.id === text.id ? { ...t, fontSize: Math.max(8, t.fontSize - 2) } : t));
               }}
               className="w-9 h-9 md:w-7 md:h-7 flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md text-xs font-bold cursor-pointer"
               title="Decrease font size"
             >
               A-
             </button>
             <button 
               onClick={(e) => {
                 e.stopPropagation();
                 setTexts(prev => prev.map(t => t.id === text.id ? { ...t, fontSize: t.fontSize + 2 } : t));
               }}
               className="w-9 h-9 md:w-7 md:h-7 flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md text-sm font-bold cursor-pointer"
               title="Increase font size"
             >
               A+
             </button>
             <div className="w-[1px] h-5 bg-slate-200"></div>
             <input 
               type="color" 
               value={text.color}
               onChange={e => setTexts(prev => prev.map(t => t.id === text.id ? { ...t, color: e.target.value } : t))}
               className="w-9 h-9 md:w-7 md:h-7 p-0.5 border border-slate-200 rounded-md cursor-pointer" 
             />
             <div className="w-[1px] h-5 bg-slate-200"></div>
             <button 
               onClick={(e) => {
                 e.stopPropagation();
                 setTexts(prev => prev.filter(t => t.id !== text.id));
                 setSelectedTextId(null);
               }}
               className="w-9 h-9 md:w-7 md:h-7 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md cursor-pointer"
               title="Delete text"
             >
               ✕
             </button>
          </div>
          )}
        </Rnd>
        );
      })}

      {/* Form Field Overlays */}
      {(formFields || []).filter(f => f.pageIndex === pageNum).map(field => {
        const isFieldSelected = selectedFormFieldId === field.id;
        return (
        <Rnd
          key={field.id}
          size={{ width: field.pos.width, height: field.pos.height }}
          position={{ x: field.pos.x, y: field.pos.y }}
          onDragStart={() => setSelectedFormFieldId(field.id)}
          onDragStop={(e, d) => {
            const pageEl = window.document.getElementById(`document-canvas-content-${pageNum}`);
            setFormFields?.(prev => prev.map(f => f.id === field.id ? {
              ...f, pos: { ...f.pos, x: d.x, y: d.y },
              canvasWidth: pageEl?.clientWidth, canvasHeight: pageEl?.clientHeight
            } : f));
          }}
          onResizeStop={(e, direction, ref, delta, position) => {
            const pageEl = window.document.getElementById(`document-canvas-content-${pageNum}`);
            setFormFields?.(prev => prev.map(f => f.id === field.id ? {
              ...f, pos: { x: position.x, y: position.y, width: parseInt(ref.style.width, 10), height: parseInt(ref.style.height, 10) },
              canvasWidth: pageEl?.clientWidth, canvasHeight: pageEl?.clientHeight
            } : f));
          }}
          bounds="parent"
          enableResizing={field.type === 'textarea'}
          resizeHandleStyles={isMobile && isFieldSelected && field.type === 'textarea' ? edgeTouchResizeHandleStyles : undefined}
          className={cn("z-50 cursor-move rounded transition-all touch-none", isFieldSelected ? "ring-2 ring-indigo-500" : "hover:ring-2 hover:ring-indigo-300/50")}
          style={{ background: 'transparent' }}
          onMouseDown={(e) => {
            e.stopPropagation();
            setSelectedFormFieldId(field.id);
          }}
        >
          {field.type === 'checkbox' && (
            <div className="w-full h-full flex items-center justify-center select-none">
              <div
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setSelectedFormFieldId(field.id);
                  setFormFields?.(prev => prev.map(f => f.id === field.id ? { ...f, checked: !f.checked } : f)); 
                }}
                className="shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all"
                style={field.checked ? { backgroundColor: field.color || '#000', borderColor: field.color || '#000', color: '#fff' } : { backgroundColor: '#fff', borderColor: field.color || '#000' }}
              >
                {field.checked && <span className="text-xs font-bold">✓</span>}
              </div>
            </div>
          )}
          {field.type === 'radio' && (
            <div className="w-full h-full flex items-center justify-center select-none">
              <div
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setSelectedFormFieldId(field.id);
                  setFormFields?.(prev => prev.map(f => f.id === field.id ? { ...f, checked: !f.checked } : f)); 
                }}
                className="shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all"
                style={{ borderColor: field.color || '#000' }}
              >
                {field.checked && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: field.color || '#000' }} />}
              </div>
            </div>
          )}
          {field.type === 'textarea' && (
            <div className="w-full h-full border border-slate-300 rounded-lg bg-white/80 p-1.5 flex flex-col">
              <textarea
                value={field.text || ''}
                onChange={(e) => setFormFields?.(prev => prev.map(f => f.id === field.id ? { ...f, text: e.target.value } : f))}
                onMouseDown={(e) => e.stopPropagation()}
                onFocus={() => setSelectedFormFieldId(field.id)}
                placeholder="Type here..."
                className="flex-1 w-full bg-transparent resize-none outline-none text-sm text-slate-700 leading-snug"
                style={{ fontSize: `${field.fontSize || 14}px` }}
              />
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/50">
                <span className="text-[9px] text-slate-400 font-semibold">Text Area</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setFormFields?.(prev => prev.filter(f => f.id !== field.id)); }}
                  className="text-slate-400 hover:text-red-500 cursor-pointer"
                  onMouseDown={(e) => e.stopPropagation()}
                ><X size={10} /></button>
              </div>
            </div>
          )}

          {/* Comment placed under the field */}
          {field.comment && (
            <div 
              className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 text-[10px] font-semibold select-none pointer-events-none bg-white/95 px-1.5 py-0.5 rounded shadow-sm border border-slate-100 whitespace-nowrap z-[55]"
              style={{ color: field.color || '#000000', fontFamily: 'Inter, system-ui, sans-serif' }}
            >
              {field.comment}
            </div>
          )}

          {/* Toolbar — only when selected */}
          {isFieldSelected && (
            <div 
              className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white border border-slate-200 shadow-xl rounded-lg px-2 py-1 flex items-center gap-1.5 z-[60] whitespace-nowrap max-w-[calc(100vw-2rem)] overflow-x-auto"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <input
                type="color"
                value={field.color || '#000000'}
                onChange={e => {
                  const color = e.target.value;
                  setFormFields?.(prev => prev.map(f => f.id === field.id ? { ...f, color } : f));
                  onSetDefaultColor?.(field.type, color);
                }}
                className="w-9 h-9 md:w-7 md:h-7 p-0.5 border border-slate-200 rounded-md cursor-pointer"
                title="Pick colour — also sets the default for new fields"
              />
              <div className="w-[1px] h-5 bg-slate-200"></div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFormFields?.(prev => prev.filter(f => f.id !== field.id));
                  setSelectedFormFieldId(null);
                }}
                className="w-9 h-9 md:w-7 md:h-7 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md cursor-pointer"
                title="Delete field"
              >
                ✕
              </button>
            </div>
          )}
        </Rnd>
        );
      })}

      {/* Redact Overlays (rendered below signatures/stamps) */}
      {redacts.filter(r => r.pageIndex === pageNum).map(redact => {
        const isRedactSelected = selectedRedactId === redact.id;
        return (
        <Rnd
          key={redact.id}
          size={{ width: redact.pos.width, height: redact.pos.height }}
          position={{ x: redact.pos.x, y: redact.pos.y }}
          onDragStart={() => setSelectedRedactId(redact.id)}
          onDragStop={(e, d) => {
            const pageEl = window.document.getElementById(`document-canvas-content-${pageNum}`);
            setRedacts(prev => prev.map(r => r.id === redact.id ? {
              ...r, pos: { ...r.pos, x: d.x, y: d.y },
              canvasWidth: pageEl?.clientWidth, canvasHeight: pageEl?.clientHeight
            } : r));
          }}
          onResizeStop={(e, direction, ref, delta, position) => {
            const pageEl = window.document.getElementById(`document-canvas-content-${pageNum}`);
            setRedacts(prev => prev.map(r => r.id === redact.id ? {
              ...r, pos: { x: position.x, y: position.y, width: parseInt(ref.style.width, 10), height: parseInt(ref.style.height, 10) },
              canvasWidth: pageEl?.clientWidth, canvasHeight: pageEl?.clientHeight
            } : r));
          }}
          bounds="parent"
          resizeHandleStyles={isMobile && isRedactSelected ? edgeTouchResizeHandleStyles : undefined}
          className={`z-30 cursor-move touch-none ${isRedactSelected ? 'ring-2 ring-rose-400' : 'hover:ring-2 hover:ring-rose-400'}`}
          style={{ background: redact.color }}
          onMouseDown={() => setSelectedRedactId(redact.id)}
        >
          <div className="w-full h-full" />
          {isRedactSelected && (
          <div
            className="absolute -bottom-12 md:-bottom-10 left-1/2 -translate-x-1/2 bg-white border border-slate-200 shadow-xl rounded-lg px-1.5 py-1 flex items-center gap-1 z-[60] whitespace-nowrap max-w-[calc(100vw-2rem)] overflow-x-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <input
              type="color"
              value={redact.color}
              onChange={e => setRedacts(prev => prev.map(r => r.id === redact.id ? { ...r, color: e.target.value } : r))}
              className="w-9 h-9 md:w-7 md:h-7 p-0.5 border border-slate-200 rounded-md cursor-pointer"
            />
            <div className="w-[1px] h-5 bg-slate-200"></div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRedacts(prev => prev.filter(r => r.id !== redact.id));
                setSelectedRedactId(null);
              }}
              className="w-9 h-9 md:w-7 md:h-7 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md cursor-pointer"
              title="Delete redaction"
            >
              ✕
            </button>
          </div>
          )}
        </Rnd>
        );
      })}

      {/* Stamp Overlays */}
      {stamps.filter(s => s.pageIndex === pageNum).map(stamp => {
        const isStampSelected = selectedStampId === stamp.id;
        return (
        <Rnd
          key={stamp.id}
          size={{ width: stamp.pos.width, height: stamp.pos.height }}
          position={{ x: stamp.pos.x, y: stamp.pos.y }}
          lockAspectRatio
          onDragStart={() => setSelectedStampId(stamp.id)}
          onDragStop={(e, d) => {
            const pageEl = window.document.getElementById(`document-canvas-content-${pageNum}`);
            setStamps(prev => prev.map(s => s.id === stamp.id ? {
              ...s, pos: { ...s.pos, x: d.x, y: d.y },
              canvasWidth: pageEl?.clientWidth, canvasHeight: pageEl?.clientHeight
            } : s));
          }}
          onResizeStop={(e, direction, ref, delta, position) => {
            const pageEl = window.document.getElementById(`document-canvas-content-${pageNum}`);
            setStamps(prev => prev.map(s => s.id === stamp.id ? {
              ...s, pos: { x: position.x, y: position.y, width: parseInt(ref.style.width, 10), height: parseInt(ref.style.height, 10) },
              canvasWidth: pageEl?.clientWidth, canvasHeight: pageEl?.clientHeight
            } : s));
          }}
          bounds="parent"
          resizeHandleStyles={isMobile && isStampSelected ? cornerTouchResizeHandleStyles : undefined}
          className={`rounded z-40 cursor-move touch-none ${isStampSelected ? 'ring-2 ring-amber-400' : 'hover:ring-2 hover:ring-amber-400'}`}
          onMouseDown={() => setSelectedStampId(stamp.id)}
        >
          <img src={stamp.url} className="w-full h-full object-contain pointer-events-none select-none" draggable={false} />
          {isStampSelected && (
          <div
            className="absolute -bottom-12 md:-bottom-10 left-1/2 -translate-x-1/2 bg-white border border-slate-200 shadow-xl rounded-lg px-1.5 py-1 flex items-center gap-1 z-[60] whitespace-nowrap max-w-[calc(100vw-2rem)] overflow-x-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setStamps(prev => prev.filter(s => s.id !== stamp.id));
                setSelectedStampId(null);
              }}
              className="w-9 h-9 md:w-7 md:h-7 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md cursor-pointer"
              title="Delete stamp"
            >
              ✕
            </button>
          </div>
          )}
        </Rnd>
        );
      })}

      {/* Drawing Overlays (shapes / freehand markup) */}
      {drawings.filter(d => d.pageIndex === pageNum).map(drawing => (
        <DrawingOverlay
          key={drawing.id}
          drawing={drawing}
          isSelected={selectedDrawingId === drawing.id}
          pageElId={`document-canvas-content-${pageNum}`}
          onUpdate={(id, update) => setDrawings(prev => prev.map(d => d.id === id ? { ...d, ...update } : d))}
          onDelete={(id) => setDrawings(prev => prev.filter(d => d.id !== id))}
          onSelect={setSelectedDrawingId}
        />
      ))}

      {/* Comment Overlays */}
      {comments.filter(c => c.pageIndex === pageNum).map(comment => (
        <CommentOverlay
          key={comment.id}
          comment={comment}
          isSelected={selectedCommentId === comment.id}
          pageElId={`document-canvas-content-${pageNum}`}
          onUpdate={(id, update) => setComments(prev => prev.map(c => c.id === id ? { ...c, ...update } : c))}
          onDelete={(id) => setComments(prev => prev.filter(c => c.id !== id))}
          onSelect={setSelectedCommentId}
        />
      ))}

      {/* Freehand / shape drawing capture surface */}
      <DrawingLayer
        active={!!drawMode}
        pageIndex={pageNum}
        shape={drawShape || 'freehand'}
        color={drawColor || '#EF4444'}
        strokeWidth={drawStrokeWidth || 3}
        opacity={drawOpacity ?? 0.4}
        onCreate={(d) => { setDrawings(prev => [...prev, d]); setSelectedDrawingId(d.id); }}
      />
    </div>
  );
}

export function DocumentViewer({
  document,
  signature,
  setSignature,
  texts,
  setTexts,
  stamps = [],
  setStamps,
  redacts = [],
  setRedacts,
  isPlacementMode = false,
  setIsPlacementMode,
  placedForConfirmation = false,
  setPlacedForConfirmation,
  lastPlacedInstanceId,
  setLastPlacedInstanceId,
  onOpenTools,
  stampPlacementMode,
  stampPlacementAsset,
  redactPlacementMode,
  redactPlacementColor,
  onStampPlaced,
  onRedactPlaced,
  textPlacementMode,
  onTextPlacementModeChange,
  formFields = [],
  setFormFields,
  formFieldPlacementMode,
  formFieldPlacementType,
  formFieldColor,
  onFormFieldPlaced,
  onSetDefaultColor,
  comments = [],
  setComments,
  drawings = [],
  setDrawings,
  commentPlacementMode,
  commentColor,
  commentAuthor,
  onCommentPlaced,
  drawMode,
  drawShape,
  drawColor,
  drawStrokeWidth,
  drawOpacity,
  editTextMode,
  onEditTextRun,
}: DocumentViewerProps) {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { pdfDoc, numPages, currentPage, setCurrentPage, loading, needsPassword, passwordError, submitPassword } = usePdf(document?.type === 'pdf' ? document.file : null);
  const [passwordInput, setPasswordInput] = useState('');
  const [renderScale, setRenderScale] = useState(1);
  const [renderedDimensions, setRenderedDimensions] = useState({ width: 0, height: 0 });
  const [imgNatural, setImgNatural] = useState({ width: 0, height: 0 });
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [selectedStampId, setSelectedStampId] = useState<string | null>(null);
  const [selectedRedactId, setSelectedRedactId] = useState<string | null>(null);
  const [selectedFormFieldId, setSelectedFormFieldId] = useState<string | null>(null);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const noopSetComments = React.useCallback<React.Dispatch<React.SetStateAction<CommentInstance[]>>>(() => {}, []);
  const noopSetDrawings = React.useCallback<React.Dispatch<React.SetStateAction<DrawInstance[]>>>(() => {}, []);
  const commentsSetter = setComments || noopSetComments;
  const drawingsSetter = setDrawings || noopSetDrawings;
  const [containerWidth, setContainerWidth] = useState(0);

  // Track previous rendered dimensions (for image fallback)
  const prevDimensionsRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  // Handle resizing scaling for image type
  useEffect(() => {
    if (document?.type !== 'image') return;
    const prev = prevDimensionsRef.current;
    const curr = renderedDimensions;

    if (prev.width > 0 && prev.height > 0 && curr.width > 0 && curr.height > 0) {
      const scaleX = curr.width / prev.width;
      const scaleY = curr.height / prev.height;

      if (Math.abs(scaleX - 1) > 0.001 || Math.abs(scaleY - 1) > 0.001) {
        setSignature(prevSig => {
          if (!prevSig || !prevSig.instances.length) return prevSig;
          return {
            ...prevSig,
            instances: prevSig.instances.map(inst => ({
              ...inst,
              pos: {
                x: inst.pos.x * scaleX,
                y: inst.pos.y * scaleY,
                width: inst.pos.width * scaleX,
                height: inst.pos.height * scaleY,
              },
              canvasWidth: curr.width,
              canvasHeight: curr.height,
            })),
          };
        });

        setTexts(prevTexts => {
          if (!prevTexts.length) return prevTexts;
          return prevTexts.map(t => ({
            ...t,
            pos: {
              x: t.pos.x * scaleX,
              y: t.pos.y * scaleY,
              width: t.pos.width * scaleX,
              height: t.pos.height * scaleY,
            },
            fontSize: t.fontSize * scaleY,
            canvasWidth: curr.width,
            canvasHeight: curr.height,
          }));
        });

        setStamps(prevStamps => {
          if (!prevStamps.length) return prevStamps;
          return prevStamps.map(s => ({
            ...s,
            pos: {
              x: s.pos.x * scaleX,
              y: s.pos.y * scaleY,
              width: s.pos.width * scaleX,
              height: s.pos.height * scaleY,
            },
            canvasWidth: curr.width,
            canvasHeight: curr.height,
          }));
        });

        setRedacts(prevRedacts => {
          if (!prevRedacts.length) return prevRedacts;
          return prevRedacts.map(r => ({
            ...r,
            pos: {
              x: r.pos.x * scaleX,
              y: r.pos.y * scaleY,
              width: r.pos.width * scaleX,
              height: r.pos.height * scaleY,
            },
            canvasWidth: curr.width,
            canvasHeight: curr.height,
          }));
        });
      }
    }

    prevDimensionsRef.current = curr;
  }, [renderedDimensions, document?.type, setSignature, setTexts, setStamps, setRedacts]);

  // Track container width via ResizeObserver so canvas/content rescales dynamically
  const SCROLL_PADDING = 8;
  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;

    const measure = () => {
      const w = el.clientWidth - SCROLL_PADDING * 2;
      if (w > 0) setContainerWidth(w);
    };
    measure();

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width - SCROLL_PADDING * 2;
        if (w > 0) setContainerWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Track active page via IntersectionObserver as user scrolls
  useEffect(() => {
    if (document?.type !== 'pdf' || !scrollAreaRef.current || !pdfDoc) return;

    const observerOptions = {
      root: scrollAreaRef.current,
      threshold: 0.3,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const pageNum = parseInt(entry.target.getAttribute('data-page-number') || '1', 10);
          setCurrentPage(pageNum);
        }
      });
    }, observerOptions);

    const pageElements = scrollAreaRef.current.querySelectorAll('[data-page-number]');
    pageElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [pdfDoc, document?.type, numPages, setCurrentPage]);

  // Smooth scroll to target page
  const scrollToPage = (pageNum: number) => {
    if (!scrollAreaRef.current) return;
    const pageEl = scrollAreaRef.current.querySelector(`[data-page-number="${pageNum}"]`);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentPage(pageNum);
    }
  };

  // Handle Image loading dimensions — capture the intrinsic size so we can
  // scale the image responsively to fit the available container width.
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setImgNatural({
      width: e.currentTarget.naturalWidth,
      height: e.currentTarget.naturalHeight,
    });
  };

  // Compute the displayed image size: never wider than the container, never
  // upscaled beyond the image's natural width. Re-runs when the container
  // resizes (e.g. orientation change) so the page always fills the viewport.
  useEffect(() => {
    if (document?.type !== 'image' || imgNatural.width <= 0) return;
    const targetWidth = containerWidth > 0
      ? Math.min(imgNatural.width, containerWidth)
      : imgNatural.width;
    const targetHeight = targetWidth * (imgNatural.height / imgNatural.width);
    setRenderedDimensions(prev =>
      Math.abs(prev.width - targetWidth) < 0.5 && Math.abs(prev.height - targetHeight) < 0.5
        ? prev
        : { width: targetWidth, height: targetHeight }
    );
  }, [document?.type, imgNatural, containerWidth]);

  // --- Mobile Placement Mode Helpers ---
  const handleCanvasTap = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!isPlacementMode || !signature || !setIsPlacementMode || !setPlacedForConfirmation || !setLastPlacedInstanceId) return;

    const pageEl = (window.document.getElementById(`document-canvas-content-${currentPage}`) || 
                    window.document.getElementById('document-canvas-content')) as HTMLElement | null;
    const canvasWidth = pageEl?.clientWidth || 300;
    const canvasHeight = pageEl?.clientHeight || 400;

    const canvasRect = pageEl?.getBoundingClientRect();
    let tapX: number, tapY: number;
    if (canvasRect) {
      let clientX: number, clientY: number;
      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
      }
      tapX = clientX - canvasRect.left;
      tapY = clientY - canvasRect.top;
    } else {
      tapX = canvasWidth * 0.6;
      tapY = canvasHeight * 0.72;
    }

    const sigWidth = Math.min(canvasWidth * 0.35, 180);
    const sigHeight = signature.aspectRatio ? sigWidth / signature.aspectRatio : sigWidth * 0.4;
    const x = Math.max(0, Math.min(canvasWidth - sigWidth, tapX - sigWidth / 2));
    const y = Math.max(0, Math.min(canvasHeight - sigHeight, tapY - sigHeight / 2));

    const newInstanceId = crypto.randomUUID();
    const newInstance = {
      id: newInstanceId,
      pos: { x, y, width: sigWidth, height: sigHeight },
      pageIndex: currentPage,
      canvasWidth,
      canvasHeight,
      url: signature.url,
      aspectRatio: signature.aspectRatio,
    };

    setSignature(prev => {
      if (!prev) return prev;
      return { ...prev, instances: [...(prev.instances || []), newInstance] };
    });

    setLastPlacedInstanceId(newInstanceId);
    setIsPlacementMode(false);
    setPlacedForConfirmation(true);
  };

  const handlePlacementTap = () => {
    if (!isPlacementMode || !signature || !setIsPlacementMode || !setPlacedForConfirmation || !setLastPlacedInstanceId) return;

    const pageEl = (window.document.getElementById(`document-canvas-content-${currentPage}`) || 
                    window.document.getElementById('document-canvas-content')) as HTMLElement | null;
    const canvasWidth = pageEl?.clientWidth || 300;
    const canvasHeight = pageEl?.clientHeight || 400;

    const sigWidth = Math.min(canvasWidth * 0.35, 180);
    const sigHeight = signature.aspectRatio ? sigWidth / signature.aspectRatio : sigWidth * 0.4;
    const x = canvasWidth * 0.6 - sigWidth / 2;
    const y = canvasHeight * 0.72 - sigHeight / 2;

    const newInstanceId = crypto.randomUUID();
    const newInstance = {
      id: newInstanceId,
      pos: { x, y, width: sigWidth, height: sigHeight },
      pageIndex: currentPage,
      canvasWidth,
      canvasHeight,
      url: signature.url,
      aspectRatio: signature.aspectRatio,
    };

    setSignature(prev => {
      if (!prev) return prev;
      return { ...prev, instances: [...(prev.instances || []), newInstance] };
    });

    setLastPlacedInstanceId(newInstanceId);
    setIsPlacementMode(false);
    setPlacedForConfirmation(true);
  };

  const handlePlacementCancel = () => {
    if (!setIsPlacementMode) return;
    setIsPlacementMode(false);
  };

  const handleConfirmDone = () => {
    if (!setPlacedForConfirmation) return;
    setPlacedForConfirmation(false);
    setLastPlacedInstanceId?.(null);
  };

  const handleReposition = () => {
    if (!setIsPlacementMode || !setPlacedForConfirmation) return;
    if (lastPlacedInstanceId) {
      setSignature(prev => {
        if (!prev) return prev;
        return { ...prev, instances: prev.instances.filter(i => i.id !== lastPlacedInstanceId) };
      });
      setLastPlacedInstanceId?.(null);
    }
    setPlacedForConfirmation(false);
    setIsPlacementMode(true);
  };

  const handleCancelPlacement = () => {
    if (!setPlacedForConfirmation) return;
    if (lastPlacedInstanceId) {
      setSignature(prev => {
        if (!prev) return prev;
        return { ...prev, instances: prev.instances.filter(i => i.id !== lastPlacedInstanceId) };
      });
      setLastPlacedInstanceId?.(null);
    }
    setPlacedForConfirmation(false);
  };

  // --- Mobile Placement Mode Helpers ---
  // Called when user taps on the document canvas in placement mode
  const handleCanvasTap = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!isPlacementMode || !signature || !setIsPlacementMode || !setPlacedForConfirmation || !setLastPlacedInstanceId) return;

    const pageEl = window.document.getElementById('document-canvas-content') as HTMLElement | null;
    const canvasWidth = pageEl?.clientWidth || 300;
    const canvasHeight = pageEl?.clientHeight || 400;

    // Get tap position relative to the actual document canvas (not the full overlay)
    const canvasRect = pageEl?.getBoundingClientRect();
    let tapX: number, tapY: number;
    if (canvasRect) {
      let clientX: number, clientY: number;
      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
      }
      tapX = clientX - canvasRect.left;
      tapY = clientY - canvasRect.top;
    } else {
      // Fallback: smart default bottom-right quadrant
      tapX = canvasWidth * 0.6;
      tapY = canvasHeight * 0.72;
    }

    const sigWidth = Math.min(canvasWidth * 0.35, 180);
    const sigHeight = signature.aspectRatio ? sigWidth / signature.aspectRatio : sigWidth * 0.4;
    // Center the signature on the tap point, clamped to canvas bounds
    const x = Math.max(0, Math.min(canvasWidth - sigWidth, tapX - sigWidth / 2));
    const y = Math.max(0, Math.min(canvasHeight - sigHeight, tapY - sigHeight / 2));

    const newInstanceId = Math.random().toString(36).substring(7);
    const newInstance = {
      id: newInstanceId,
      pos: { x, y, width: sigWidth, height: sigHeight },
      pageIndex: currentPage,
      canvasWidth,
      canvasHeight,
      url: signature.url,
      aspectRatio: signature.aspectRatio,
    };

    setSignature(prev => {
      if (!prev) return prev;
      return { ...prev, instances: [...(prev.instances || []), newInstance] };
    });

    setLastPlacedInstanceId(newInstanceId);
    setIsPlacementMode(false);
    setPlacedForConfirmation(true);
  };

  // Legacy handlePlacementTap kept as fallback (used by overlay click)
  const handlePlacementTap = () => {
    if (!isPlacementMode || !signature || !setIsPlacementMode || !setPlacedForConfirmation || !setLastPlacedInstanceId) return;

    const pageEl = window.document.getElementById('document-canvas-content') as HTMLElement | null;
    const canvasWidth = pageEl?.clientWidth || 300;
    const canvasHeight = pageEl?.clientHeight || 400;

    // Smart default: bottom-right quadrant
    const sigWidth = Math.min(canvasWidth * 0.35, 180);
    const sigHeight = signature.aspectRatio ? sigWidth / signature.aspectRatio : sigWidth * 0.4;
    const x = canvasWidth * 0.6 - sigWidth / 2;
    const y = canvasHeight * 0.72 - sigHeight / 2;

    const newInstanceId = Math.random().toString(36).substring(7);
    const newInstance = {
      id: newInstanceId,
      pos: { x, y, width: sigWidth, height: sigHeight },
      pageIndex: currentPage,
      canvasWidth,
      canvasHeight,
      url: signature.url,
      aspectRatio: signature.aspectRatio,
    };

    setSignature(prev => {
      if (!prev) return prev;
      return { ...prev, instances: [...(prev.instances || []), newInstance] };
    });

    setLastPlacedInstanceId(newInstanceId);
    setIsPlacementMode(false);
    setPlacedForConfirmation(true);
  };

  const handlePlacementCancel = () => {
    if (!setIsPlacementMode) return;
    setIsPlacementMode(false);
  };

  const handleConfirmDone = () => {
    if (!setPlacedForConfirmation) return;
    setPlacedForConfirmation(false);
    setLastPlacedInstanceId?.(null);
  };

  const handleReposition = () => {
    if (!setIsPlacementMode || !setPlacedForConfirmation) return;
    // Remove the last placed instance
    if (lastPlacedInstanceId) {
      setSignature(prev => {
        if (!prev) return prev;
        return { ...prev, instances: prev.instances.filter(i => i.id !== lastPlacedInstanceId) };
      });
      setLastPlacedInstanceId?.(null);
    }
    setPlacedForConfirmation(false);
    setIsPlacementMode(true);
  };

  const handleCancelPlacement = () => {
    if (!setPlacedForConfirmation) return;
    // Remove the last placed instance
    if (lastPlacedInstanceId) {
      setSignature(prev => {
        if (!prev) return prev;
        return { ...prev, instances: prev.instances.filter(i => i.id !== lastPlacedInstanceId) };
      });
      setLastPlacedInstanceId?.(null);
    }
    setPlacedForConfirmation(false);
  };

  if (!document) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="text-center max-w-sm font-sans">
          <div className="w-20 h-20 bg-gradient-to-tr from-indigo-100 to-violet-50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-white">
            <span className="text-4xl">✨</span>
          </div>
          <h3 className="text-xl font-bold text-slate-800 tracking-tight">Ready to Flow</h3>
          <p className="mt-2 text-sm text-slate-500">Upload a document using the button above to get started</p>

<<<<<<< HEAD
          {/* Privacy badge */}
=======
>>>>>>> feat/prepare-form
          <div className="mt-5 inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-full px-3.5 py-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={2.2} />
            <span className="text-[11px] font-medium text-emerald-800">100% private — files never leave your device</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden md:rounded-2xl md:shadow-sm md:border md:border-slate-200/60 bg-white/40 backdrop-blur-3xl" ref={containerRef}>

<<<<<<< HEAD
      {/* ============================================================
          MOBILE PLACEMENT MODE OVERLAY (only shown on mobile)
          Tapping on the overlay places the signature at the tapped location
          ============================================================ */}
=======


      {/* MOBILE PLACEMENT OVERLAY */}
>>>>>>> feat/prepare-form
      {isPlacementMode && (
        <div
          className="md:hidden absolute inset-0 z-[100] flex flex-col placement-enter"
          style={{ background: 'rgba(15, 15, 35, 0.5)', backdropFilter: 'blur(2px)' }}
          onClick={handleCanvasTap}
          onTouchStart={(e) => {
<<<<<<< HEAD
            // Prevent scroll, then handle tap
=======
>>>>>>> feat/prepare-form
            e.preventDefault();
            handleCanvasTap(e);
          }}
        >
<<<<<<< HEAD
          {/* Cancel button */}
=======
>>>>>>> feat/prepare-form
          <button
            onClick={(e) => { e.stopPropagation(); handlePlacementCancel(); }}
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
          >
            <X size={16} />
          </button>

<<<<<<< HEAD
          {/* Top instruction bar — doesn't block taps on the document */}
          <div className="absolute top-4 left-4 right-14 pointer-events-none">
            <div className="bg-black/60 backdrop-blur-sm rounded-2xl px-4 py-2.5 flex items-center gap-2.5 border border-white/10">
              {/* Signature preview */}
=======
          <div className="absolute top-4 left-4 right-14 pointer-events-none">
            <div className="bg-black/60 backdrop-blur-sm rounded-2xl px-4 py-2.5 flex items-center gap-2.5 border border-white/10 font-sans">
>>>>>>> feat/prepare-form
              {signature?.url && (
                <div className="w-10 h-7 shrink-0 flex items-center justify-center bg-white/10 rounded-lg p-1">
                  <img
                    src={signature.url}
                    alt="Your signature"
                    className="max-w-full max-h-full object-contain"
                    style={{ filter: 'brightness(0) invert(1)', opacity: 0.85 }}
                  />
                </div>
              )}
              <div>
                <p className="text-white font-bold text-[13px] leading-tight">Tap to place signature</p>
                <p className="text-white/50 text-[11px]">Touch anywhere on the document</p>
              </div>
            </div>
          </div>

<<<<<<< HEAD
          {/* Subtle crosshair hint in center */}
=======
>>>>>>> feat/prepare-form
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="placement-pulse-ring w-14 h-14 rounded-full border-4 border-indigo-400/60 bg-indigo-500/10 flex items-center justify-center">
              <MapPin className="text-white/70" size={22} strokeWidth={2} />
            </div>
          </div>
        </div>
      )}

<<<<<<< HEAD
      {/* ============================================================
          POST-PLACEMENT FLOATING ACTION BAR (mobile only)
          Shows after a signature is tapped into place
          ============================================================ */}
=======
      {/* POST-PLACEMENT FLOATING ACTION BAR (mobile only) */}
>>>>>>> feat/prepare-form
      {placedForConfirmation && (
        <div
          className="md:hidden fixed inset-x-0 bottom-[4rem] z-[90] px-3 float-up"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
<<<<<<< HEAD
          <div className="bg-slate-900 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-white/10 px-3 py-3">
            {/* Title row */}
=======
          <div className="bg-slate-900 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-white/10 px-3 py-3 font-sans">
>>>>>>> feat/prepare-form
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-white/80 text-xs font-semibold">Signature placed</span>
              </div>
              <span className="text-white/40 text-[10px]">Drag to reposition</span>
            </div>
<<<<<<< HEAD
            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelPlacement}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 text-xs font-semibold transition-colors active:scale-95"
=======
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelPlacement}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 text-xs font-semibold transition-colors active:scale-95 cursor-pointer"
>>>>>>> feat/prepare-form
              >
                <X size={13} /> Remove
              </button>
              <button
                onClick={handleReposition}
<<<<<<< HEAD
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-indigo-500/25 text-indigo-200 hover:bg-indigo-500/40 text-xs font-semibold transition-colors active:scale-95"
=======
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-indigo-500/25 text-indigo-200 hover:bg-indigo-500/40 text-xs font-semibold transition-colors active:scale-95 cursor-pointer"
>>>>>>> feat/prepare-form
              >
                <RefreshCw size={13} /> Move
              </button>
              <button
                onClick={handleConfirmDone}
<<<<<<< HEAD
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-bold shadow-[0_2px_8px_rgba(99,102,241,0.5)] transition-all active:scale-95"
=======
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-bold shadow-[0_2px_8px_rgba(99,102,241,0.5)] transition-all active:scale-95 cursor-pointer"
>>>>>>> feat/prepare-form
              >
                <CheckCircle size={13} /> Done
              </button>
            </div>
          </div>
        </div>
      )}
<<<<<<< HEAD
      {/* Pagination Toolbar — mobile friendly positioning */}
      {document.type === 'pdf' && numPages > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 md:bottom-8 md:right-8 md:left-auto md:translate-x-0 flex items-center bg-white/95 backdrop-blur-sm rounded-full shadow-lg border border-slate-200 px-3 py-1.5 gap-3 z-20">
=======

      {/* Pagination Toolbar */}
      {document.type === 'pdf' && numPages > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 md:bottom-8 md:right-8 md:left-auto md:translate-x-0 flex items-center bg-white/95 backdrop-blur-sm rounded-full shadow-lg border border-slate-200 px-3 py-1.5 gap-3 z-20 font-sans">
>>>>>>> feat/prepare-form
          <button 
            onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
<<<<<<< HEAD
            className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600 disabled:opacity-40 active:scale-90 transition-all"
=======
            className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600 disabled:opacity-40 active:scale-90 transition-all cursor-pointer"
>>>>>>> feat/prepare-form
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold text-slate-700 min-w-[3rem] text-center">
            {currentPage} / {numPages}
          </span>
          <button 
            onClick={() => scrollToPage(Math.min(numPages, currentPage + 1))}
            disabled={currentPage === numPages}
<<<<<<< HEAD
            className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600 disabled:opacity-40 active:scale-90 transition-all"
=======
            className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600 disabled:opacity-40 active:scale-90 transition-all cursor-pointer"
>>>>>>> feat/prepare-form
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Document Area */}
<<<<<<< HEAD
      <div className="flex-1 overflow-auto flex items-start justify-center bg-slate-100/50" style={{ padding: '0.5rem' }} ref={scrollAreaRef}>
        <div 
          className="relative bg-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] rounded-sm overflow-hidden flex flex-col transition-all duration-300"
          style={{
            width: renderedDimensions.width || 'auto',
            height: renderedDimensions.height || 'auto'
          }}
          id="document-canvas-container"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(e) => {
            e.preventDefault();
            const sigType = e.dataTransfer.getData("application/my-signature");
            const textType = e.dataTransfer.getData("application/my-text");
            
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            // Measure against the actual rendered page (canvas/img), NOT the
            // container. The container can be taller/wider than the page it
            // wraps, and using its size here would shift the signature on export.
            const pageEl = e.currentTarget.querySelector('#document-canvas-content') as HTMLElement | null;
            const canvasWidth = pageEl?.clientWidth || e.currentTarget.clientWidth;
            const canvasHeight = pageEl?.clientHeight || e.currentTarget.clientHeight;

            if (textType) {
              setTexts(prev => [...prev, {
                id: Math.random().toString(36).substring(7),
                text: 'Double click to edit',
                pageIndex: currentPage,
                pos: { x, y, width: 200, height: 40 },
                fontSize: 24,
                color: '#000000',
                fontFamily: TEXT_FONTS[0].value,
                canvasWidth,
                canvasHeight
=======
      <div 
        className={`flex-1 overflow-auto flex flex-col items-center gap-6 bg-slate-100/50 ${textPlacementMode || stampPlacementMode || redactPlacementMode || formFieldPlacementMode || commentPlacementMode ? 'cursor-crosshair' : ''}`}
        style={{ padding: '1.5rem 0.5rem' }} 
        ref={scrollAreaRef}
        onClick={(e) => {
          // Comment placement mode: place a sticky-note comment at click position
          if (commentPlacementMode) {
            const pageEl = (e.target as HTMLElement).closest('[data-page-number]');
            if (pageEl) {
              const pageRect = pageEl.getBoundingClientRect();
              const clickX = e.clientX - pageRect.left;
              const clickY = e.clientY - pageRect.top;
              const pageNum = parseInt(pageEl.getAttribute('data-page-number') || '1', 10);
              const canvasEl = pageEl.querySelector('canvas') || pageEl.querySelector('img');
              const cw = canvasEl?.clientWidth || pageEl.clientWidth;
              const ch = canvasEl?.clientHeight || pageEl.clientHeight;
              const cWidth = 220, cHeight = 120;
              const x = Math.max(0, Math.min(cw - cWidth, clickX - 10));
              const y = Math.max(0, Math.min(ch - cHeight, clickY - 10));
              const newId = crypto.randomUUID();
              commentsSetter(prev => [...prev, {
                id: newId,
                pageIndex: pageNum,
                pos: { x, y, width: cWidth, height: cHeight },
                text: '',
                author: commentAuthor || 'Me',
                color: commentColor || '#F59E0B',
                createdAt: new Date().toISOString(),
                canvasWidth: cw,
                canvasHeight: ch,
>>>>>>> feat/prepare-form
              }]);
              setSelectedCommentId(newId);
              onCommentPlaced?.();
            }
            return;
          }

          // Text placement mode: place text at click position
          if (textPlacementMode) {
            const pageEl = (e.target as HTMLElement).closest('[data-page-number]');
            if (pageEl) {
              const pageRect = pageEl.getBoundingClientRect();
              const clickX = e.clientX - pageRect.left;
              const clickY = e.clientY - pageRect.top;
              const pageNum = parseInt(pageEl.getAttribute('data-page-number') || '1', 10);
              
              const canvasEl = pageEl.querySelector('canvas') || pageEl.querySelector('img');
              const cw = canvasEl?.clientWidth || pageEl.clientWidth;
              const ch = canvasEl?.clientHeight || pageEl.clientHeight;
              
              const x = Math.max(0, Math.min(cw - 180, clickX - 10));
              const y = Math.max(0, Math.min(ch - 40, clickY - 10));
              
              const newId = crypto.randomUUID();
              
              setTexts(prev => [...prev, {
                id: newId,
                text: '',
                pageIndex: pageNum,
                pos: { x, y, width: 180, height: 40 },
                fontSize: 18,
                color: '#000000',
                fontFamily: 'Helvetica',
                canvasWidth: cw,
                canvasHeight: ch
              }]);
              
              setSelectedTextId(newId);
              setEditingTextId(newId);
              onTextPlacementModeChange?.(false);
            }
            return;
          }

          // Stamp placement mode: place stamp at click position
          if (stampPlacementMode && stampPlacementAsset) {
            const pageEl = (e.target as HTMLElement).closest('[data-page-number]');
            if (pageEl) {
              const pageRect = pageEl.getBoundingClientRect();
              const clickX = e.clientX - pageRect.left;
              const clickY = e.clientY - pageRect.top;
              const pageNum = parseInt(pageEl.getAttribute('data-page-number') || '1', 10);
              
              const canvasEl = pageEl.querySelector('canvas') || pageEl.querySelector('img');
              const cw = canvasEl?.clientWidth || pageEl.clientWidth;
              const ch = canvasEl?.clientHeight || pageEl.clientHeight;
              
              const stampWidth = 120;
              const stampHeight = stampPlacementAsset.aspectRatio ? stampWidth / stampPlacementAsset.aspectRatio : 80;
              const x = Math.max(0, Math.min(cw - stampWidth, clickX - stampWidth / 2));
              const y = Math.max(0, Math.min(ch - stampHeight, clickY - stampHeight / 2));
              
              setStamps(prev => [...prev, {
                id: crypto.randomUUID(),
                assetId: '',
                url: stampPlacementAsset.url,
                pageIndex: pageNum,
                pos: { x, y, width: stampWidth, height: stampHeight },
                canvasWidth: cw,
                canvasHeight: ch,
                aspectRatio: stampPlacementAsset.aspectRatio,
              }]);
              
              onStampPlaced?.();
            }
            return;
          }

          // Redact placement mode: place redact rectangle at click position
          if (redactPlacementMode) {
            const pageEl = (e.target as HTMLElement).closest('[data-page-number]');
            if (pageEl) {
              const pageRect = pageEl.getBoundingClientRect();
              const clickX = e.clientX - pageRect.left;
              const clickY = e.clientY - pageRect.top;
              const pageNum = parseInt(pageEl.getAttribute('data-page-number') || '1', 10);
              
              const canvasEl = pageEl.querySelector('canvas') || pageEl.querySelector('img');
              const cw = canvasEl?.clientWidth || pageEl.clientWidth;
              const ch = canvasEl?.clientHeight || pageEl.clientHeight;
              
              const rw = 160;
              const rh = 30;
              const x = Math.max(0, Math.min(cw - rw, clickX - rw / 2));
              const y = Math.max(0, Math.min(ch - rh, clickY - rh / 2));
              
              setRedacts(prev => [...prev, {
                id: crypto.randomUUID(),
                pageIndex: pageNum,
                pos: { x, y, width: rw, height: rh },
                color: redactPlacementColor || '#000000',
                canvasWidth: cw,
                canvasHeight: ch,
              }]);
              
              onRedactPlaced?.();
            }
            return;
          }

          // Form field placement mode: place form field at click position
          if (formFieldPlacementMode && formFieldPlacementType && setFormFields) {
            const pageEl = (e.target as HTMLElement).closest('[data-page-number]');
            if (pageEl) {
              const pageRect = pageEl.getBoundingClientRect();
              const clickX = e.clientX - pageRect.left;
              const clickY = e.clientY - pageRect.top;
              const pageNum = parseInt(pageEl.getAttribute('data-page-number') || '1', 10);
              
              const canvasEl = pageEl.querySelector('canvas') || pageEl.querySelector('img');
              const cw = canvasEl?.clientWidth || pageEl.clientWidth;
              const ch = canvasEl?.clientHeight || pageEl.clientHeight;
              
              let fieldWidth = 180;
              let fieldHeight = 28;
              if (formFieldPlacementType === 'textarea') {
                fieldWidth = 220;
                fieldHeight = 100;
              }
              
              const x = Math.max(0, Math.min(cw - fieldWidth, clickX - 10));
              const y = Math.max(0, Math.min(ch - fieldHeight, clickY - 10));
              
              setFormFields(prev => [...prev, {
                id: crypto.randomUUID(),
                type: formFieldPlacementType,
                pageIndex: pageNum,
                pos: { x, y, width: fieldWidth, height: fieldHeight },
                canvasWidth: cw,
                canvasHeight: ch,
                checked: false,
                label: '',
                text: '',
                fontSize: 14,
                fontFamily: 'Helvetica',
                color: formFieldColor || (formFieldPlacementType === 'checkbox' ? '#16A34A' : formFieldPlacementType === 'radio' ? '#7C3AED' : '#000000'),
              }]);
              
              onFormFieldPlaced?.();
            }
            return;
          }
          
          // Deselect all when clicking on the background (not on a Rnd element)
          if (e.target === e.currentTarget || (e.target as HTMLElement).closest('[data-page-number]') && !(e.target as HTMLElement).closest('.react-draggable')) {
            setSelectedTextId(null);
            setEditingTextId(null);
            setSelectedStampId(null);
            setSelectedRedactId(null);
            setSelectedFormFieldId(null);
            setSelectedCommentId(null);
            setSelectedDrawingId(null);
          }
        }}
      >
        {!(document.type === 'pdf' && needsPassword) && containerWidth > 0 && (
          <div style={{ width: containerWidth }} className="shrink-0 -mb-2 px-0.5">
            <span title={document.name} className="block text-sm font-semibold text-slate-700 truncate">
              {document.name}
            </span>
          </div>
        )}
        {document.type === 'pdf' && needsPassword ? (
          <div className="flex-1 flex items-center justify-center p-4 md:p-8 w-full">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (passwordInput) submitPassword(passwordInput);
              }}
              className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-[0_20px_50px_-20px_rgba(79,70,229,0.15)] font-sans"
            >
              <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-tr from-rose-500 to-red-500 flex items-center justify-center shadow-[0_8px_25px_rgba(244,63,94,0.3)]">
                <Lock className="w-7 h-7 text-white" strokeWidth={2} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 tracking-tight">Password protected</h3>
              <p className="mt-2 text-sm text-slate-500">
                This PDF is encrypted. Enter its password to open it.
              </p>
              <input
                type="password"
                autoFocus
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter password"
                className={cn(
                  "mt-5 w-full px-3.5 py-2.5 text-sm rounded-xl border bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400",
                  passwordError ? "border-rose-300" : "border-slate-200"
                )}
              />
              {passwordError && (
                <p className="mt-2 text-xs text-rose-500 font-medium">Incorrect password. Please try again.</p>
              )}
              <button
                type="submit"
                disabled={!passwordInput}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-bold shadow-[0_2px_8px_rgba(99,102,241,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
              >
                <Lock size={15} /> Unlock document
              </button>
            </form>
          </div>
        ) : document.type === 'pdf' ? (
          Array.from({ length: numPages }).map((_, index) => (
            <PdfPage
              key={index}
              pageNum={index + 1}
              pdfDoc={pdfDoc}
              containerWidth={containerWidth}
              signature={signature}
              setSignature={setSignature}
              texts={texts}
              setTexts={setTexts}
              stamps={stamps}
              setStamps={setStamps}
              redacts={redacts}
              setRedacts={setRedacts}
              editingTextId={editingTextId}
              setEditingTextId={setEditingTextId}
              selectedTextId={selectedTextId}
              setSelectedTextId={setSelectedTextId}
              selectedStampId={selectedStampId}
              setSelectedStampId={setSelectedStampId}
              selectedRedactId={selectedRedactId}
              setSelectedRedactId={setSelectedRedactId}
              formFields={formFields}
              setFormFields={setFormFields}
              selectedFormFieldId={selectedFormFieldId}
              setSelectedFormFieldId={setSelectedFormFieldId}
              onSetDefaultColor={onSetDefaultColor}
              comments={comments}
              setComments={commentsSetter}
              drawings={drawings}
              setDrawings={drawingsSetter}
              selectedCommentId={selectedCommentId}
              setSelectedCommentId={setSelectedCommentId}
              selectedDrawingId={selectedDrawingId}
              setSelectedDrawingId={setSelectedDrawingId}
              drawMode={drawMode}
              drawShape={drawShape}
              drawColor={drawColor}
              drawStrokeWidth={drawStrokeWidth}
              drawOpacity={drawOpacity}
              editTextMode={editTextMode}
              onEditTextRun={onEditTextRun}
            />
          ))
        ) : (
          <div 
            className="relative bg-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] rounded-sm overflow-hidden shrink-0 flex flex-col transition-all duration-300"
            style={{
              width: renderedDimensions.width || 'auto',
              height: renderedDimensions.height || 'auto'
            }}
            id="document-canvas-container"
            data-page-number="1"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const sigType = e.dataTransfer.getData("application/my-signature");
              const textType = e.dataTransfer.getData("application/my-text");
              
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              const pageEl = e.currentTarget.querySelector('#document-canvas-content') as HTMLElement | null;
              const canvasWidth = pageEl?.clientWidth || e.currentTarget.clientWidth;
              const canvasHeight = pageEl?.clientHeight || e.currentTarget.clientHeight;

              if (textType) {
                setTexts(prev => [...prev, {
                  id: crypto.randomUUID(),
                  text: 'Double click to edit',
                  pageIndex: 1,
                  pos: { x, y, width: 200, height: 40 },
                  fontSize: 24,
                  color: '#000000',
                  fontFamily: TEXT_FONTS[0].value,
                  canvasWidth,
                  canvasHeight
                }]);
                return;
              }

              if (sigType) {
                let payloadUrl = signature?.url || "";
                let payloadAspect = signature?.aspectRatio || 2.5;
                try {
                  if (sigType !== "true") {
                    const parsed = JSON.parse(sigType);
                    if (parsed.url) payloadUrl = parsed.url;
                    if (parsed.aspectRatio) payloadAspect = parsed.aspectRatio;
                  }
                } catch (e) {}

                setSignature(prev => {
                  const newInstance = {
                    id: crypto.randomUUID(),
                    pos: { x, y, width: 150, height: payloadAspect ? 150 / payloadAspect : 60 },
                    pageIndex: 1,
                    canvasWidth: canvasWidth,
                    canvasHeight: canvasHeight,
                    url: payloadUrl,
                    aspectRatio: payloadAspect
                  };

                  if (!prev) {
                    return {
                       url: payloadUrl,
                       originalUrl: payloadUrl,
                       bgRemovalTolerance: 50,
                       pos: { x: 100, y: 100, width: 150, height: payloadAspect ? 150 / payloadAspect : 60 },
                       applyMode: 'single',
                       customPages: '',
                       excludedPages: '',
                       instances: [newInstance],
                       aspectRatio: payloadAspect
                    };
                  }
                  
                  return {
                    ...prev,
                    instances: [...prev.instances, newInstance]
                  };
                });
              }
            }}
          >
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 font-sans"></div>
              </div>
            )}

            <img
              src={document.url}
              id="document-canvas-content"
              alt="Document"
              className="block w-full h-full select-none"
              draggable={false}
              onLoad={handleImageLoad}
            />

            {/* Signature Overlays (Image mode) */}
            {signature && renderedDimensions.width > 0 && signature.instances?.filter((instance) => {
              if (signature.applyMode === 'all') {
                return !isPageInRange(signature.excludedPages, 1);
              } else if (signature.applyMode === 'custom') {
                return isPageInRange(signature.customPages, 1);
              }
              return instance.pageIndex === 1;
            }).map((instance, index) => (
              <Rnd
                key={instance.id}
                size={{ width: instance.pos.width, height: instance.pos.height }}
                position={{ x: instance.pos.x, y: instance.pos.y }}
                lockAspectRatio={true}
                onDragStop={(e, d) => {
                  const pageEl = window.document.getElementById('document-canvas-content');
                  setSignature(prev => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      instances: prev.instances.map(inst => 
                        inst.id === instance.id ? { 
                          ...inst, 
                          pos: { ...inst.pos, x: d.x, y: d.y },
                          canvasWidth: pageEl?.clientWidth,
                          canvasHeight: pageEl?.clientHeight
                        } : inst
                      )
                    };
                  });
                }}
                onResizeStop={(e, direction, ref, delta, position) => {
                  const pageEl = window.document.getElementById('document-canvas-content');
                  setSignature(prev => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      instances: prev.instances.map(inst => 
                        inst.id === instance.id ? {
                          ...inst,
                          pos: {
                            x: position.x,
                            y: position.y,
                            width: parseInt(ref.style.width, 10),
                            height: parseInt(ref.style.height, 10),
                          },
                          canvasWidth: pageEl?.clientWidth,
                          canvasHeight: pageEl?.clientHeight
                        } : inst
                      )
                    };
                  });
                }}
                bounds="parent"
                resizeHandleStyles={isMobile ? cornerTouchResizeHandleStyles : undefined}
                className={cn("group rounded touch-none z-50")}
              >
                <div
                  className="w-full h-full relative"
                  style={{ transform: `rotate(${instance.rotation || 0}deg)` }}
                >
                  <div className="absolute inset-0 border-2 border-indigo-400 border-dashed rounded pointer-events-none group-active:border-indigo-500 z-10"></div>
                  <div className={cn("absolute -top-1 -left-1 w-3 h-3 bg-indigo-600 rounded-full border border-white shadow-sm pointer-events-none", isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100")}></div>
                  <div className={cn("absolute -top-1 -right-1 w-3 h-3 bg-indigo-600 rounded-full border border-white shadow-sm pointer-events-none", isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100")}></div>
                  <div className={cn("absolute -bottom-1 -left-1 w-3 h-3 bg-indigo-600 rounded-full border border-white shadow-sm pointer-events-none", isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100")}></div>
                  <div className={cn("absolute -bottom-1 -right-1 w-3 h-3 bg-indigo-600 rounded-full border border-white shadow-sm pointer-events-none", isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100")}></div>

                  <div
                    className={cn("absolute -top-9 md:-top-6 left-1/2 -translate-x-1/2 w-9 h-9 md:w-6 md:h-6 bg-white border border-slate-200 shadow-md rounded-full flex items-center justify-center cursor-crosshair pointer-events-auto z-50 hover:bg-slate-50 hover:text-indigo-600 text-slate-400 transition-colors touch-none", isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100")}
                    style={{ touchAction: 'none' }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      const startX = e.clientX;
                      const startY = e.clientY;
                      const startRot = instance.rotation || 0;
                      
                      const rect = e.currentTarget.parentElement!.getBoundingClientRect();
                      const centerX = rect.left + rect.width / 2;
                      const centerY = rect.top + rect.height / 2;

                      const onPointerMove = (moveEvent: PointerEvent) => {
                        const currentAngle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX) * 180 / Math.PI;
                        const startAngle = Math.atan2(startY - centerY, startX - centerX) * 180 / Math.PI;
                        let newRot = startRot + (currentAngle - startAngle);
                        
                        setSignature(prev => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            instances: prev.instances.map(inst => 
                              inst.id === instance.id ? { ...inst, rotation: newRot } : inst
                            )
                          };
                        });
                      };

                      const onPointerUp = () => {
                        window.removeEventListener('pointermove', onPointerMove);
                        window.removeEventListener('pointerup', onPointerUp);
                      };

                      window.addEventListener('pointermove', onPointerMove);
                      window.addEventListener('pointerup', onPointerUp);
                    }}
                  >
                    <RotateCw size={12} />
                  </div>

                  <img 
                    src={instance.url || signature.url} 
                    className="w-full h-full object-contain pointer-events-none select-none" 
                    draggable={false}
                  />
                </div>
                <div className={cn("absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-slate-800 text-white pl-2 pr-1 py-1 rounded text-[10px] flex gap-2 items-center shadow-xl transition-opacity whitespace-nowrap z-50 font-sans", isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                  <span>Signature #{index + 1}</span>
                  <div className="h-3 w-[1px] bg-slate-600"></div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSignature(prev => prev ? { ...prev, instances: prev.instances.filter(i => i.id !== instance.id) } : null);
                    }}
                    className="hover:text-red-400 text-red-300 cursor-pointer min-h-[36px] md:min-h-0 flex items-center px-1"
                  >Delete</button>
                </div>
              </Rnd>
            ))}

            {/* Custom Text Overlays (Image mode) */}
            {texts.filter(t => t.pageIndex === 1).map(text => {
              const isSelected = selectedTextId === text.id;
              const isEditing = editingTextId === text.id;
              return (
              <Rnd
                key={text.id}
                size={{ width: text.pos.width, height: text.pos.height }}
                position={{ x: text.pos.x, y: text.pos.y }}
                onDragStart={() => {
                  setSelectedTextId(text.id);
                }}
                onDragStop={(e, d) => {
                  const pageEl = window.document.getElementById('document-canvas-content');
                  setTexts(prev => prev.map(t => 
                    t.id === text.id ? { 
                      ...t, 
                      pos: { ...t.pos, x: d.x, y: d.y },
                      canvasWidth: pageEl?.clientWidth,
                      canvasHeight: pageEl?.clientHeight
                    } : t
                  ));
                }}
                onResizeStop={(e, direction, ref, delta, position) => {
                  const pageEl = window.document.getElementById('document-canvas-content');
                  setTexts(prev => prev.map(t => 
                    t.id === text.id ? {
                      ...t,
                      pos: {
                        x: position.x,
                        y: position.y,
                        width: parseInt(ref.style.width, 10),
                        height: parseInt(ref.style.height, 10)
                      },
                      fontSize: Math.max(12, parseInt(ref.style.height, 10) * 0.7),
                      canvasWidth: pageEl?.clientWidth,
                      canvasHeight: pageEl?.clientHeight
                    } : t
                  ));
                }}
                bounds="parent"
                enableResizing={isSelected && !isEditing}
                resizeHandleStyles={isMobile && isSelected && !isEditing ? cornerTouchResizeHandleStyles : undefined}
                disableDragging={isEditing}
                className={`rounded z-50 ${!isEditing ? 'touch-none' : ''} ${
                  isEditing ? 'ring-2 ring-indigo-500 shadow-lg' :
                  isSelected ? 'ring-2 ring-indigo-400 shadow-md' :
                  'hover:ring-1 hover:ring-indigo-300/50'
                } ${!isEditing ? 'cursor-move' : ''}`}
                style={{ background: isSelected || isEditing ? 'rgba(255,255,255,0.15)' : 'transparent' }}
                onMouseDown={(e: React.MouseEvent) => {
                  if (!isEditing) {
                    setSelectedTextId(text.id);
                  }
                }}
              >
                {isSelected && !isEditing && (
                  <div className="absolute inset-0 border-2 border-indigo-400/50 border-dashed rounded pointer-events-none z-10"></div>
                )}

                {isSelected && !isEditing && isMobile && (
                  <>
                    <span className="absolute -top-1 -left-1 w-3 h-3 bg-indigo-500 rounded-full border border-white shadow pointer-events-none z-10" />
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border border-white shadow pointer-events-none z-10" />
                    <span className="absolute -bottom-1 -left-1 w-3 h-3 bg-indigo-500 rounded-full border border-white shadow pointer-events-none z-10" />
                    <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border border-white shadow pointer-events-none z-10" />
                  </>
                )}

                {isEditing ? (
                  <textarea 
                    autoFocus
                    dir={isDhivehiFont(text.fontFamily) ? 'rtl' : 'ltr'}
                    onBlur={() => setEditingTextId(null)}
                    value={text.text}
                    onChange={(e) => setTexts(prev => prev.map(t => t.id === text.id ? { ...t, text: e.target.value } : t))}
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      handleThaanaKeyDown(
                        e,
                        isDhivehiFont(text.fontFamily),
                        (val) => setTexts(prev => prev.map(t => t.id === text.id ? { ...t, text: val } : t))
                      );
                      if (e.key === 'Escape') {
                        setEditingTextId(null);
                        e.currentTarget.blur();
                      }
                    }}
                    className="w-full h-full bg-transparent resize-none overflow-hidden outline-none break-words leading-tight"
                    style={{ fontSize: `${text.fontSize}px`, color: text.color, fontFamily: fontCss(text.fontFamily), fontWeight: text.bold ? 'bold' : undefined, fontStyle: text.italic ? 'italic' : undefined }}
                    spellCheck={false}
                  />
                ) : (
                  <div 
                     onDoubleClick={() => {
                       setSelectedTextId(text.id);
                       setEditingTextId(text.id);
                     }}
                     className="w-full h-full overflow-hidden select-none"
                  >
                     <p className="w-full h-full whitespace-pre-wrap break-words leading-tight pointer-events-none" dir={isDhivehiFont(text.fontFamily) ? 'rtl' : 'ltr'} style={{ fontSize: `${text.fontSize}px`, color: text.color, fontFamily: fontCss(text.fontFamily), fontWeight: text.bold ? 'bold' : undefined, fontStyle: text.italic ? 'italic' : undefined }}>
                       {text.text}
                     </p>
                  </div>
                )}

                {(isSelected || isEditing) && (
                <div
                  className="absolute -bottom-12 md:-bottom-10 left-1/2 -translate-x-1/2 bg-white border border-slate-200 shadow-xl rounded-lg px-1.5 py-1 flex items-center gap-1 z-[60] whitespace-nowrap max-w-[calc(100vw-2rem)] overflow-x-auto"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                   <select
                     value={text.fontFamily || TEXT_FONTS[0].value}
                     onMouseDown={(e) => e.stopPropagation()}
                     onChange={(e) => {
                       const val = e.target.value;
                       setTexts(prev => prev.map(t => t.id === text.id ? { ...t, fontFamily: val } : t));
                     }}
                     className="h-9 md:h-7 px-1.5 text-xs sm:text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-md cursor-pointer focus:outline-none focus:border-indigo-400 hover:border-indigo-300 w-[88px] sm:w-[120px] shrink-0"
                     title="Font"
                   >
                     {TEXT_FONTS.map(f => (
                       <option key={f.value} value={f.value} style={{ fontFamily: f.css }}>{f.label}</option>
                     ))}
                   </select>
                   <div className="w-[1px] h-5 bg-slate-200"></div>
                   <button
                     onClick={(e) => {
                       e.stopPropagation();
                       setTexts(prev => prev.map(t => t.id === text.id ? { ...t, bold: !t.bold } : t));
                     }}
                     className={cn("w-9 h-9 md:w-7 md:h-7 flex items-center justify-center rounded-md text-sm font-bold cursor-pointer shrink-0", text.bold ? "text-indigo-600 bg-indigo-50" : "text-slate-600 hover:text-indigo-600 hover:bg-indigo-50")}
                     title="Bold"
                   >
                     B
                   </button>
                   <button
                     onClick={(e) => {
                       e.stopPropagation();
                       setTexts(prev => prev.map(t => t.id === text.id ? { ...t, italic: !t.italic } : t));
                     }}
                     className={cn("w-9 h-9 md:w-7 md:h-7 flex items-center justify-center rounded-md text-sm italic font-serif cursor-pointer shrink-0", text.italic ? "text-indigo-600 bg-indigo-50" : "text-slate-600 hover:text-indigo-600 hover:bg-indigo-50")}
                     title="Italic"
                   >
                     I
                   </button>
                   <div className="w-[1px] h-5 bg-slate-200"></div>
                   <button
                     onClick={(e) => {
                       e.stopPropagation();
                       setTexts(prev => prev.map(t => t.id === text.id ? { ...t, fontSize: Math.max(8, t.fontSize - 2) } : t));
                     }}
                     className="w-9 h-9 md:w-7 md:h-7 flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md text-xs font-bold cursor-pointer"
                     title="Decrease font size"
                   >
                     A-
                   </button>
                   <button 
                     onClick={(e) => {
                       e.stopPropagation();
                       setTexts(prev => prev.map(t => t.id === text.id ? { ...t, fontSize: t.fontSize + 2 } : t));
                     }}
                     className="w-9 h-9 md:w-7 md:h-7 flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md text-sm font-bold cursor-pointer"
                     title="Increase font size"
                   >
                     A+
                   </button>
                   <div className="w-[1px] h-5 bg-slate-200"></div>
                   <input 
                     type="color" 
                     value={text.color}
                     onChange={e => setTexts(prev => prev.map(t => t.id === text.id ? { ...t, color: e.target.value } : t))}
                     className="w-9 h-9 md:w-7 md:h-7 p-0.5 border border-slate-200 rounded-md cursor-pointer" 
                   />
                   <div className="w-[1px] h-5 bg-slate-200"></div>
                   <button 
                     onClick={(e) => {
                       e.stopPropagation();
                       setTexts(prev => prev.filter(t => t.id !== text.id));
                       setSelectedTextId(null);
                     }}
                     className="w-9 h-9 md:w-7 md:h-7 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md cursor-pointer"
                     title="Delete text"
                   >
                     ✕
                   </button>
                </div>
                )}
              </Rnd>
              );
            })}

            {/* Form Field Overlays (Image mode) */}
            {(formFields || []).filter(f => f.pageIndex === 1).map(field => {
              const isFieldSelected = selectedFormFieldId === field.id;
              return (
              <Rnd
                key={field.id}
                size={{ width: field.pos.width, height: field.pos.height }}
                position={{ x: field.pos.x, y: field.pos.y }}
                onDragStart={() => setSelectedFormFieldId(field.id)}
                onDragStop={(e, d) => {
                  const pageEl = window.document.getElementById('document-canvas-content');
                  setFormFields?.(prev => prev.map(f => f.id === field.id ? {
                    ...f, pos: { ...f.pos, x: d.x, y: d.y },
                    canvasWidth: pageEl?.clientWidth, canvasHeight: pageEl?.clientHeight
                  } : f));
                }}
                onResizeStop={(e, direction, ref, delta, position) => {
                  const pageEl = window.document.getElementById('document-canvas-content');
                  setFormFields?.(prev => prev.map(f => f.id === field.id ? {
                    ...f, pos: { x: position.x, y: position.y, width: parseInt(ref.style.width, 10), height: parseInt(ref.style.height, 10) },
                    canvasWidth: pageEl?.clientWidth, canvasHeight: pageEl?.clientHeight
                  } : f));
                }}
                bounds="parent"
                enableResizing={field.type === 'textarea'}
                resizeHandleStyles={isMobile && isFieldSelected && field.type === 'textarea' ? edgeTouchResizeHandleStyles : undefined}
                className={cn("z-50 cursor-move rounded transition-all touch-none", isFieldSelected ? "ring-2 ring-indigo-500" : "hover:ring-2 hover:ring-indigo-300/50")}
                style={{ background: 'transparent' }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setSelectedFormFieldId(field.id);
                }}
              >
                {field.type === 'checkbox' && (
                  <div className="w-full h-full flex items-center justify-center select-none">
                    <div
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setSelectedFormFieldId(field.id);
                        setFormFields?.(prev => prev.map(f => f.id === field.id ? { ...f, checked: !f.checked } : f)); 
                      }}
                      className="shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all"
                      style={field.checked ? { backgroundColor: field.color || '#000', borderColor: field.color || '#000', color: '#fff' } : { backgroundColor: '#fff', borderColor: field.color || '#000' }}
                    >
                      {field.checked && <span className="text-xs font-bold">✓</span>}
                    </div>
                  </div>
                )}
                {field.type === 'radio' && (
                  <div className="w-full h-full flex items-center justify-center select-none">
                    <div
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setSelectedFormFieldId(field.id);
                        setFormFields?.(prev => prev.map(f => f.id === field.id ? { ...f, checked: !f.checked } : f)); 
                      }}
                      className="shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all"
                      style={{ borderColor: field.color || '#000' }}
                    >
                      {field.checked && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: field.color || '#000' }} />}
                    </div>
                  </div>
                )}
                {field.type === 'textarea' && (
                  <div className="w-full h-full border border-slate-300 rounded-lg bg-white/80 p-1.5 flex flex-col">
                    <textarea
                      value={field.text || ''}
                      onChange={(e) => setFormFields?.(prev => prev.map(f => f.id === field.id ? { ...f, text: e.target.value } : f))}
                      onMouseDown={(e) => e.stopPropagation()}
                      onFocus={() => setSelectedFormFieldId(field.id)}
                      placeholder="Type here..."
                      className="flex-1 w-full bg-transparent resize-none outline-none text-sm text-slate-700 leading-snug"
                      style={{ fontSize: `${field.fontSize || 14}px` }}
                    />
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/50">
                      <span className="text-[9px] text-slate-400 font-semibold">Text Area</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setFormFields?.(prev => prev.filter(f => f.id !== field.id)); }}
                        className="text-slate-400 hover:text-red-500 cursor-pointer"
                        onMouseDown={(e) => e.stopPropagation()}
                      ><X size={10} /></button>
                    </div>
                  </div>
                )}

                {/* Comment placed under the field */}
                {field.comment && (
                  <div 
                    className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 text-[10px] font-semibold select-none pointer-events-none bg-white/95 px-1.5 py-0.5 rounded shadow-sm border border-slate-100 whitespace-nowrap z-[55]"
                    style={{ color: field.color || '#000000', fontFamily: 'Inter, system-ui, sans-serif' }}
                  >
                    {field.comment}
                  </div>
                )}

                {/* Toolbar — only when selected */}
                {isFieldSelected && (
                  <div 
                    className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white border border-slate-200 shadow-xl rounded-lg px-2 py-1 flex items-center gap-1.5 z-[60] whitespace-nowrap max-w-[calc(100vw-2rem)] overflow-x-auto"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <input
                      type="color"
                      value={field.color || '#000000'}
                      onChange={e => {
                        const color = e.target.value;
                        setFormFields?.(prev => prev.map(f => f.id === field.id ? { ...f, color } : f));
                        onSetDefaultColor?.(field.type, color);
                      }}
                      className="w-9 h-9 md:w-7 md:h-7 p-0.5 border border-slate-200 rounded-md cursor-pointer"
                      title="Pick colour — also sets the default for new fields"
                    />
                    <div className="w-[1px] h-5 bg-slate-200"></div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFormFields?.(prev => prev.filter(f => f.id !== field.id));
                        setSelectedFormFieldId(null);
                      }}
                      className="w-9 h-9 md:w-7 md:h-7 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md cursor-pointer"
                      title="Delete field"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </Rnd>
              );
            })}

            {/* Redact Overlays (Image mode) */}
            {redacts.filter(r => r.pageIndex === 1).map(redact => {
              const isRedactSelected = selectedRedactId === redact.id;
              return (
              <Rnd
                key={redact.id}
                size={{ width: redact.pos.width, height: redact.pos.height }}
                position={{ x: redact.pos.x, y: redact.pos.y }}
                onDragStart={() => setSelectedRedactId(redact.id)}
                onDragStop={(e, d) => {
                  const pageEl = window.document.getElementById('document-canvas-content');
                  setRedacts(prev => prev.map(r => r.id === redact.id ? {
                    ...r, pos: { ...r.pos, x: d.x, y: d.y },
                    canvasWidth: pageEl?.clientWidth, canvasHeight: pageEl?.clientHeight
                  } : r));
                }}
                onResizeStop={(e, direction, ref, delta, position) => {
                  const pageEl = window.document.getElementById('document-canvas-content');
                  setRedacts(prev => prev.map(r => r.id === redact.id ? {
                    ...r, pos: { x: position.x, y: position.y, width: parseInt(ref.style.width, 10), height: parseInt(ref.style.height, 10) },
                    canvasWidth: pageEl?.clientWidth, canvasHeight: pageEl?.clientHeight
                  } : r));
                }}
                bounds="parent"
                resizeHandleStyles={isMobile && isRedactSelected ? edgeTouchResizeHandleStyles : undefined}
                className={`z-30 cursor-move touch-none ${isRedactSelected ? 'ring-2 ring-rose-400' : 'hover:ring-2 hover:ring-rose-400'}`}
                style={{ background: redact.color }}
                onMouseDown={() => setSelectedRedactId(redact.id)}
              >
                <div className="w-full h-full" />
                {isRedactSelected && (
                <div
                  className="absolute -bottom-12 md:-bottom-10 left-1/2 -translate-x-1/2 bg-white border border-slate-200 shadow-xl rounded-lg px-1.5 py-1 flex items-center gap-1 z-[60] whitespace-nowrap max-w-[calc(100vw-2rem)] overflow-x-auto"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <input
                    type="color"
                    value={redact.color}
                    onChange={e => setRedacts(prev => prev.map(r => r.id === redact.id ? { ...r, color: e.target.value } : r))}
                    className="w-9 h-9 md:w-7 md:h-7 p-0.5 border border-slate-200 rounded-md cursor-pointer"
                  />
                  <div className="w-[1px] h-5 bg-slate-200"></div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRedacts(prev => prev.filter(r => r.id !== redact.id));
                      setSelectedRedactId(null);
                    }}
                    className="w-9 h-9 md:w-7 md:h-7 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md cursor-pointer"
                    title="Delete redaction"
                  >
                    ✕
                  </button>
                </div>
                )}
              </Rnd>
              );
            })}

            {/* Stamp Overlays (Image mode) */}
            {stamps.filter(s => s.pageIndex === 1).map(stamp => {
              const isStampSelected = selectedStampId === stamp.id;
              return (
              <Rnd
                key={stamp.id}
                size={{ width: stamp.pos.width, height: stamp.pos.height }}
                position={{ x: stamp.pos.x, y: stamp.pos.y }}
                lockAspectRatio
                onDragStart={() => setSelectedStampId(stamp.id)}
                onDragStop={(e, d) => {
                  const pageEl = window.document.getElementById('document-canvas-content');
                  setStamps(prev => prev.map(s => s.id === stamp.id ? {
                    ...s, pos: { ...s.pos, x: d.x, y: d.y },
                    canvasWidth: pageEl?.clientWidth, canvasHeight: pageEl?.clientHeight
                  } : s));
                }}
                onResizeStop={(e, direction, ref, delta, position) => {
                  const pageEl = window.document.getElementById('document-canvas-content');
                  setStamps(prev => prev.map(s => s.id === stamp.id ? {
                    ...s, pos: { x: position.x, y: position.y, width: parseInt(ref.style.width, 10), height: parseInt(ref.style.height, 10) },
                    canvasWidth: pageEl?.clientWidth, canvasHeight: pageEl?.clientHeight
                  } : s));
                }}
                bounds="parent"
                resizeHandleStyles={isMobile && isStampSelected ? cornerTouchResizeHandleStyles : undefined}
                className={`rounded z-40 cursor-move touch-none ${isStampSelected ? 'ring-2 ring-amber-400' : 'hover:ring-2 hover:ring-amber-400'}`}
                onMouseDown={() => setSelectedStampId(stamp.id)}
              >
                <img src={stamp.url} className="w-full h-full object-contain pointer-events-none select-none" draggable={false} />
                {isStampSelected && (
                <div
                  className="absolute -bottom-12 md:-bottom-10 left-1/2 -translate-x-1/2 bg-white border border-slate-200 shadow-xl rounded-lg px-1.5 py-1 flex items-center gap-1 z-[60] whitespace-nowrap max-w-[calc(100vw-2rem)] overflow-x-auto"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setStamps(prev => prev.filter(s => s.id !== stamp.id));
                      setSelectedStampId(null);
                    }}
                    className="w-9 h-9 md:w-7 md:h-7 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md cursor-pointer"
                    title="Delete stamp"
                  >
                    ✕
                  </button>
                </div>
                )}
              </Rnd>
              );
            })}

            {/* Drawing Overlays (Image mode) */}
            {drawings.filter(d => d.pageIndex === 1).map(drawing => (
              <DrawingOverlay
                key={drawing.id}
                drawing={drawing}
                isSelected={selectedDrawingId === drawing.id}
                pageElId="document-canvas-content"
                onUpdate={(id, update) => drawingsSetter(prev => prev.map(d => d.id === id ? { ...d, ...update } : d))}
                onDelete={(id) => drawingsSetter(prev => prev.filter(d => d.id !== id))}
                onSelect={setSelectedDrawingId}
              />
            ))}

            {/* Comment Overlays (Image mode) */}
            {comments.filter(c => c.pageIndex === 1).map(comment => (
              <CommentOverlay
                key={comment.id}
                comment={comment}
                isSelected={selectedCommentId === comment.id}
                pageElId="document-canvas-content"
                onUpdate={(id, update) => commentsSetter(prev => prev.map(c => c.id === id ? { ...c, ...update } : c))}
                onDelete={(id) => commentsSetter(prev => prev.filter(c => c.id !== id))}
                onSelect={setSelectedCommentId}
              />
            ))}

            {/* Freehand / shape drawing capture surface (Image mode) */}
            <DrawingLayer
              active={!!drawMode}
              pageIndex={1}
              shape={drawShape || 'freehand'}
              color={drawColor || '#EF4444'}
              strokeWidth={drawStrokeWidth || 3}
              opacity={drawOpacity ?? 0.4}
              onCreate={(d) => { drawingsSetter(prev => [...prev, d]); setSelectedDrawingId(d.id); }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
