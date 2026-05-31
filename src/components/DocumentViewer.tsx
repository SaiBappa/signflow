import React, { useRef, useEffect, useState } from 'react';
import { Rnd } from 'react-rnd';
import { ChevronLeft, ChevronRight, RotateCw, ShieldCheck, MapPin, CheckCircle, RefreshCw, X } from 'lucide-react';
import { DocumentFile, SignatureState, TextInstance } from '../types';
import { usePdf } from '../hooks/usePdf';
import { cn, isPageInRange, fontCss, TEXT_FONTS } from '../utils';

interface DocumentViewerProps {
  document: DocumentFile | null;
  signature: SignatureState | null;
  setSignature: React.Dispatch<React.SetStateAction<SignatureState | null>>;
  texts: TextInstance[];
  setTexts: React.Dispatch<React.SetStateAction<TextInstance[]>>;
  isPlacementMode?: boolean;
  setIsPlacementMode?: (v: boolean) => void;
  placedForConfirmation?: boolean;
  setPlacedForConfirmation?: (v: boolean) => void;
  lastPlacedInstanceId?: string | null;
  setLastPlacedInstanceId?: (id: string | null) => void;
  onOpenTools?: () => void;
}

export function DocumentViewer({
  document,
  signature,
  setSignature,
  texts,
  setTexts,
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { pdfDoc, numPages, currentPage, setCurrentPage, loading } = usePdf(document?.type === 'pdf' ? document.file : null);
  const [renderScale, setRenderScale] = useState(1);
  const [renderedDimensions, setRenderedDimensions] = useState({ width: 0, height: 0 });
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

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

      // Resolve an available width: prefer measured containerWidth, fall back to
      // the element's live offsetWidth minus padding (handles cases where the
      // ResizeObserver hasn't fired yet when pdfDoc first becomes ready).
      let availableWidth = containerWidth;
      if (availableWidth <= 0 && scrollAreaRef.current) {
        availableWidth = scrollAreaRef.current.clientWidth - SCROLL_PADDING * 2;
      }
      if (availableWidth <= 0) return; // still not laid out — wait

      try {
        const page = await pdfDoc.getPage(currentPage);
        if (cancelled) return;

        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(availableWidth / unscaledViewport.width, 2.5);
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
        setRenderedDimensions({ width: viewport.width, height: viewport.height });

        renderTask = page.render({
          canvasContext: context,
          viewport: viewport,
        });

        await renderTask.promise;
      } catch (err) {
        if (err instanceof Error && err.name === 'RenderingCancelledException') {
          // Ignore cancelled renders — a new one will follow.
        } else {
          console.error("PDF render error", err);
        }
      }
    };

    renderPage();

    return () => {
      cancelled = true;
      if (renderTask) renderTask.cancel();
    };
  }, [pdfDoc, currentPage, containerWidth]);

  // Handle Image loading dimensions
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setRenderedDimensions({
      width: e.currentTarget.width,
      height: e.currentTarget.height
    });
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
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-gradient-to-tr from-indigo-100 to-violet-50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-white">
            <span className="text-4xl">✨</span>
          </div>
          <h3 className="text-xl font-bold text-slate-800 tracking-tight">Ready to Flow</h3>
          <p className="mt-2 text-sm text-slate-500">Upload a document using the button above to get started</p>

          {/* Privacy badge */}
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

      {/* ============================================================
          MOBILE PLACEMENT MODE OVERLAY (only shown on mobile)
          Tapping on the overlay places the signature at the tapped location
          ============================================================ */}
      {isPlacementMode && (
        <div
          className="md:hidden absolute inset-0 z-[100] flex flex-col placement-enter"
          style={{ background: 'rgba(15, 15, 35, 0.5)', backdropFilter: 'blur(2px)' }}
          onClick={handleCanvasTap}
          onTouchStart={(e) => {
            // Prevent scroll, then handle tap
            e.preventDefault();
            handleCanvasTap(e);
          }}
        >
          {/* Cancel button */}
          <button
            onClick={(e) => { e.stopPropagation(); handlePlacementCancel(); }}
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
          >
            <X size={16} />
          </button>

          {/* Top instruction bar — doesn't block taps on the document */}
          <div className="absolute top-4 left-4 right-14 pointer-events-none">
            <div className="bg-black/60 backdrop-blur-sm rounded-2xl px-4 py-2.5 flex items-center gap-2.5 border border-white/10">
              {/* Signature preview */}
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

          {/* Subtle crosshair hint in center */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="placement-pulse-ring w-14 h-14 rounded-full border-4 border-indigo-400/60 bg-indigo-500/10 flex items-center justify-center">
              <MapPin className="text-white/70" size={22} strokeWidth={2} />
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          POST-PLACEMENT FLOATING ACTION BAR (mobile only)
          Shows after a signature is tapped into place
          ============================================================ */}
      {placedForConfirmation && (
        <div
          className="md:hidden fixed inset-x-0 bottom-[4rem] z-[90] px-3 float-up"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="bg-slate-900 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-white/10 px-3 py-3">
            {/* Title row */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-white/80 text-xs font-semibold">Signature placed</span>
              </div>
              <span className="text-white/40 text-[10px]">Drag to reposition</span>
            </div>
            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelPlacement}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 text-xs font-semibold transition-colors active:scale-95"
              >
                <X size={13} /> Remove
              </button>
              <button
                onClick={handleReposition}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-indigo-500/25 text-indigo-200 hover:bg-indigo-500/40 text-xs font-semibold transition-colors active:scale-95"
              >
                <RefreshCw size={13} /> Move
              </button>
              <button
                onClick={handleConfirmDone}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-bold shadow-[0_2px_8px_rgba(99,102,241,0.5)] transition-all active:scale-95"
              >
                <CheckCircle size={13} /> Done
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Pagination Toolbar — mobile friendly positioning */}
      {document.type === 'pdf' && numPages > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 md:bottom-8 md:right-8 md:left-auto md:translate-x-0 flex items-center bg-white/95 backdrop-blur-sm rounded-full shadow-lg border border-slate-200 px-3 py-1.5 gap-3 z-20">
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600 disabled:opacity-40 active:scale-90 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold text-slate-700 min-w-[3rem] text-center">
            {currentPage} / {numPages}
          </span>
          <button 
            onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
            disabled={currentPage === numPages}
            className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600 disabled:opacity-40 active:scale-90 transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Document Area */}
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
                  id: Math.random().toString(36).substring(7),
                  pos: { x, y, width: 150, height: payloadAspect ? 150 / payloadAspect : 60 },
                  pageIndex: currentPage,
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
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          )}

          {document.type === 'pdf' ? (
            <canvas ref={canvasRef} id="document-canvas-content" className="block" />
          ) : (
            <img 
              src={document.url} 
              id="document-canvas-content"
              alt="Document" 
              className="block" 
              onLoad={handleImageLoad}
            />
          )}

          {/* Overlays */}
          {signature && renderedDimensions.width > 0 && signature.instances?.filter((instance) => {
            if (signature.applyMode === 'all') {
              return !isPageInRange(signature.excludedPages, currentPage);
            } else if (signature.applyMode === 'custom') {
              return isPageInRange(signature.customPages, currentPage);
            }
            return instance.pageIndex === currentPage;
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
              className={cn("group rounded touch-none z-50")}
            >
              <div 
                className="w-full h-full relative" 
                style={{ transform: `rotate(${instance.rotation || 0}deg)` }}
              >
                <div className="absolute inset-0 border-2 border-indigo-400 border-dashed rounded pointer-events-none group-active:border-indigo-500 z-10"></div>
                {/* Transform Controls styled to match theme */}
                <div className="absolute -top-1 -left-1 w-3 h-3 bg-indigo-600 rounded-full border border-white shadow-sm opacity-0 group-hover:opacity-100 pointer-events-none"></div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-600 rounded-full border border-white shadow-sm opacity-0 group-hover:opacity-100 pointer-events-none"></div>
                <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-indigo-600 rounded-full border border-white shadow-sm opacity-0 group-hover:opacity-100 pointer-events-none"></div>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-indigo-600 rounded-full border border-white shadow-sm opacity-0 group-hover:opacity-100 pointer-events-none"></div>

                {/* Rotation Handle */}
                <div 
                  className="absolute -top-6 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border border-slate-200 shadow-md rounded-full flex items-center justify-center cursor-crosshair opacity-0 group-hover:opacity-100 pointer-events-auto z-50 hover:bg-slate-50 hover:text-indigo-600 text-slate-400 transition-colors"
                  onPointerDown={(e) => {
                    e.stopPropagation();
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
              {/* Floating Toolbar representation */}
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-2 py-1 rounded text-[10px] flex gap-2 items-center shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                <span>Signature #{index + 1}</span>
                <div className="h-3 w-[1px] bg-slate-600"></div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSignature(prev => prev ? { ...prev, instances: prev.instances.filter(i => i.id !== instance.id) } : null);
                  }}
                  className="hover:text-red-400 text-red-300"
                >Delete</button>
              </div>
            </Rnd>
          ))}

          {texts.filter(t => t.pageIndex === currentPage).map(text => (
            <Rnd
              key={text.id}
              size={{ width: text.pos.width, height: text.pos.height }}
              position={{ x: text.pos.x, y: text.pos.y }}
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
              enableResizing={editingTextId !== text.id}
              disableDragging={editingTextId === text.id}
              className={`group rounded z-50 ${editingTextId === text.id ? 'ring-2 ring-indigo-500 bg-white/10' : 'hover:ring-2 hover:ring-indigo-400/50'}`}
            >
              <div className="absolute inset-0 border-2 border-transparent group-hover:border-indigo-400 border-dashed rounded pointer-events-none z-10 transition-colors"></div>
              
              {editingTextId === text.id ? (
                <textarea 
                  autoFocus
                  onBlur={() => setEditingTextId(null)}
                  value={text.text}
                  onChange={(e) => setTexts(prev => prev.map(t => t.id === text.id ? { ...t, text: e.target.value } : t))}
                  onMouseDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Escape') {
                      setEditingTextId(null);
                      e.currentTarget.blur();
                    }
                  }}
                  className="w-full h-full bg-transparent resize-none overflow-hidden outline-none break-words leading-tight"
                  style={{ fontSize: `${text.fontSize}px`, color: text.color, fontFamily: fontCss(text.fontFamily) }}
                  spellCheck={false}
                />
              ) : (
                <div 
                   onDoubleClick={() => setEditingTextId(text.id)}
                   className="w-full h-full cursor-move overflow-hidden"
                >
                   <p className="w-full h-full whitespace-pre-wrap break-words leading-tight" style={{ fontSize: `${text.fontSize}px`, color: text.color, fontFamily: fontCss(text.fontFamily) }}>
                     {text.text}
                   </p>
                </div>
              )}

              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white border border-slate-200 shadow-lg rounded-lg p-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none group-hover:pointer-events-auto">
                 <select
                   value={text.fontFamily || TEXT_FONTS[0].value}
                   onMouseDown={(e) => e.stopPropagation()}
                   onChange={(e) => {
                     const val = e.target.value;
                     setTexts(prev => prev.map(t => t.id === text.id ? { ...t, fontFamily: val } : t));
                   }}
                   className="h-6 px-1 text-xs text-slate-700 bg-white border border-slate-200 rounded cursor-pointer focus:outline-none focus:border-indigo-400 hover:border-indigo-300"
                   title="Font"
                 >
                   {TEXT_FONTS.map(f => (
                     <option key={f.value} value={f.value} style={{ fontFamily: f.css }}>{f.label}</option>
                   ))}
                 </select>
                 <div className="w-[1px] h-4 bg-slate-200 mx-1"></div>
                 <button
                   onClick={(e) => {
                     e.stopPropagation();
                     setTexts(prev => prev.map(t => t.id === text.id ? { ...t, fontSize: Math.max(8, t.fontSize - 2) } : t));
                   }}
                   className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded text-xs font-bold"
                   title="Decrease font size"
                 >
                   A-
                 </button>
                 <button 
                   onClick={(e) => {
                     e.stopPropagation();
                     setTexts(prev => prev.map(t => t.id === text.id ? { ...t, fontSize: t.fontSize + 2 } : t));
                   }}
                   className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded text-sm font-bold"
                   title="Increase font size"
                 >
                   A+
                 </button>
                 <div className="w-[1px] h-4 bg-slate-200 mx-1"></div>
                 <input 
                   type="color" 
                   value={text.color}
                   onChange={e => setTexts(prev => prev.map(t => t.id === text.id ? { ...t, color: e.target.value } : t))}
                   className="w-6 h-6 p-0 border-0 rounded cursor-pointer" 
                 />
                 <div className="w-[1px] h-4 bg-slate-200 mx-1"></div>
                 <button 
                   onClick={(e) => {
                     e.stopPropagation();
                     setTexts(prev => prev.filter(t => t.id !== text.id));
                   }}
                   className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                 >
                   ✕
                 </button>
              </div>
            </Rnd>
          ))}

        </div>
      </div>
    </div>
  );
}
