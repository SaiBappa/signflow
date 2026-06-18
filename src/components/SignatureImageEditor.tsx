import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Eraser, Paintbrush, Undo2, Redo2, RotateCcw, Loader2, Check, Sparkles } from 'lucide-react';
import { cn, removeImageBackground, enhanceSignature } from '../utils';
import type { SavedAsset } from '../types';

interface Props {
  asset: SavedAsset;
  /** Called with the edited images (display + original layers) once the user saves. */
  onSave: (result: { url: string; originalUrl: string }) => void;
  onClose: () => void;
}

type Tool = 'erase' | 'restore';
type BgMode = 'white' | 'black' | 'auto';

const MAX_DISPLAY = 460;   // px – longest side of the editing canvas
const MAX_HISTORY = 40;

const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/**
 * A lightweight, in-app image editor for saved signatures.
 *
 * Combines pixel scrubbing (erase / restore brush) with the same background
 * removal + enhancement controls available in the sign panel, all with a live
 * preview — so users can perfect a signature without any external tool. The
 * erase work is kept as an alpha mask that is composited onto BOTH the processed
 * `url` and the raw `originalUrl` on save, so re-coloring and rotating keep
 * working afterwards.
 */
export function SignatureImageEditor({ asset, onSave, onClose }: Props) {
  const displayRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);       // full-res erase mask (opaque = hidden)
  const processedImgRef = useRef<HTMLImageElement | null>(null); // current bg-removed/enhanced layer
  const origImgRef = useRef<HTMLImageElement | null>(null);     // raw layer

  const [dims, setDims] = useState<{ w: number; h: number; scale: number } | null>(null);
  const [tool, setTool] = useState<Tool>('erase');
  const [brush, setBrush] = useState(24);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  // Background-removal / enhancement settings.
  const [mode, setMode] = useState<BgMode>('auto');
  const [tolerance, setTolerance] = useState(50);
  const [enhanceEnabled, setEnhanceEnabled] = useState(false);
  const [enhanceStrength, setEnhanceStrength] = useState(50);

  // Undo/redo history of mask ImageData snapshots.
  const historyRef = useRef<ImageData[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const drawingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);

  const reqIdRef = useRef(0);
  const didInitRef = useRef(false);

  // ── Composite the preview (processed layer minus mask) onto the display ──
  const render = useCallback(() => {
    const canvas = displayRef.current;
    const img = processedImgRef.current;
    const mask = maskRef.current;
    if (!canvas || !img || !mask || !dims) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, dims.w, dims.h);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(mask, 0, 0, dims.w, dims.h);
    ctx.globalCompositeOperation = 'source-over';
  }, [dims]);

  // ── Load both image layers ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    Promise.all([loadImg(asset.url), loadImg(asset.originalUrl)])
      .then(([urlImg, origImg]) => {
        if (cancelled) return;
        processedImgRef.current = urlImg; // start from the already-processed image
        origImgRef.current = origImg;
        const w = urlImg.naturalWidth || 300;
        const h = urlImg.naturalHeight || 150;

        const mask = document.createElement('canvas');
        mask.width = w;
        mask.height = h;
        maskRef.current = mask;

        const scale = Math.min(1, MAX_DISPLAY / Math.max(w, h));
        setDims({ w, h, scale });

        historyRef.current = [mask.getContext('2d')!.getImageData(0, 0, w, h)];
        setHistIdx(0);
        setLoading(false);
      })
      .catch(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [asset.url, asset.originalUrl]);

  useEffect(() => { if (dims) render(); }, [dims, render]);

  // ── Re-derive the processed layer when bg/enhance settings change ────────
  const recompute = useCallback(async () => {
    if (!dims) return;
    const reqId = ++reqIdRef.current;
    setProcessing(true);
    try {
      let processed = await removeImageBackground(asset.originalUrl, tolerance, asset.tintColor, mode);
      if (enhanceEnabled) processed = await enhanceSignature(processed, enhanceStrength);
      const img = await loadImg(processed);
      if (reqId !== reqIdRef.current) return; // a newer request superseded this one
      processedImgRef.current = img;
      render();
    } catch {
      /* keep the previous preview on failure */
    } finally {
      if (reqId === reqIdRef.current) setProcessing(false);
    }
  }, [dims, asset.originalUrl, asset.tintColor, tolerance, mode, enhanceEnabled, enhanceStrength, render]);

  useEffect(() => {
    if (loading) return;
    if (!didInitRef.current) { didInitRef.current = true; return; } // skip initial (url is already processed)
    const t = setTimeout(recompute, 160); // debounce slider drags
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, tolerance, enhanceEnabled, enhanceStrength, loading]);

  // ── Brush helpers (operate in full-res mask coordinates) ────────────────
  const stamp = (x: number, y: number) => {
    const mask = maskRef.current;
    if (!mask) return;
    const mctx = mask.getContext('2d')!;
    const r = brush / (dims?.scale || 1) / 2;
    mctx.globalCompositeOperation = tool === 'erase' ? 'source-over' : 'destination-out';
    mctx.fillStyle = '#000';
    mctx.beginPath();
    mctx.arc(x, y, r, 0, Math.PI * 2);
    mctx.fill();
    mctx.globalCompositeOperation = 'source-over';
  };

  const strokeTo = (x: number, y: number) => {
    const last = lastPtRef.current;
    if (last) {
      const dist = Math.hypot(x - last.x, y - last.y);
      const step = Math.max(1, (brush / (dims?.scale || 1)) / 4);
      const steps = Math.ceil(dist / step);
      for (let i = 1; i <= steps; i++) {
        stamp(last.x + ((x - last.x) * i) / steps, last.y + ((y - last.y) * i) / steps);
      }
    } else {
      stamp(x, y);
    }
    lastPtRef.current = { x, y };
    render();
  };

  const toMaskCoords = (e: React.PointerEvent) => {
    const canvas = displayRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const pushHistory = () => {
    const mask = maskRef.current;
    if (!mask) return;
    const snap = mask.getContext('2d')!.getImageData(0, 0, mask.width, mask.height);
    const next = historyRef.current.slice(0, histIdx + 1);
    next.push(snap);
    if (next.length > MAX_HISTORY) next.shift();
    historyRef.current = next;
    setHistIdx(next.length - 1);
    setDirty(true);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (loading || saving) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastPtRef.current = null;
    const { x, y } = toMaskCoords(e);
    strokeTo(x, y);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const rect = displayRef.current!.getBoundingClientRect();
    setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    if (!drawingRef.current) return;
    const { x, y } = toMaskCoords(e);
    strokeTo(x, y);
  };

  const endStroke = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPtRef.current = null;
    pushHistory();
  };

  // ── Undo / redo / reset (mask only) ─────────────────────────────────────
  const restoreSnapshot = (idx: number) => {
    const mask = maskRef.current;
    const snap = historyRef.current[idx];
    if (!mask || !snap) return;
    mask.getContext('2d')!.putImageData(snap, 0, 0);
    setHistIdx(idx);
    render();
  };
  const canUndo = histIdx > 0;
  const canRedo = histIdx < historyRef.current.length - 1;
  const undo = () => canUndo && restoreSnapshot(histIdx - 1);
  const redo = () => canRedo && restoreSnapshot(histIdx + 1);
  const reset = () => {
    const mask = maskRef.current;
    if (!mask) return;
    mask.getContext('2d')!.clearRect(0, 0, mask.width, mask.height);
    pushHistory();
    render();
  };

  // Keyboard shortcuts within the editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (e.key === 'Escape') { onClose(); return; }
      const meta = e.ctrlKey || e.metaKey;
      if (meta && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (meta && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); }
      else if (e.key === 'e' || e.key === 'E') setTool('erase');
      else if (e.key === 'r' || e.key === 'R') setTool('restore');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ── Save: bake the mask into both layers ────────────────────────────────
  const handleSave = () => {
    const mask = maskRef.current;
    const processed = processedImgRef.current;
    const origImg = origImgRef.current;
    if (!mask || !processed || !origImg) return;
    setSaving(true);
    const bake = (img: HTMLImageElement) => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(mask, 0, 0, c.width, c.height); // mask scales to each layer's dims
      ctx.globalCompositeOperation = 'source-over';
      return c.toDataURL('image/png');
    };
    onSave({ url: bake(processed), originalUrl: bake(origImg) });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Eraser size={17} />
            </span>
            <div>
              <h3 className="font-bold text-slate-800 leading-tight">Edit Signature</h3>
              <p className="text-[11px] text-slate-400">Scrub marks, tune background &amp; enhance</p>
            </div>
          </div>
          <button onClick={onClose} disabled={saving} className="text-slate-400 hover:text-slate-700 disabled:opacity-50 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Brush toolbar */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 shrink-0 flex-wrap">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
            <button onClick={() => setTool('erase')}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                tool === 'erase' ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800")}>
              <Eraser size={14} /> Erase
            </button>
            <button onClick={() => setTool('restore')}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                tool === 'restore' ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800")}>
              <Paintbrush size={14} /> Restore
            </button>
          </div>

          <div className="flex items-center gap-2 ml-1">
            <span className="text-[11px] font-semibold text-slate-500">Size</span>
            <input type="range" min={6} max={80} value={brush} onChange={(e) => setBrush(Number(e.target.value))}
              className="w-20 accent-indigo-600 h-1 bg-slate-100 rounded-full appearance-none cursor-pointer" />
            <span className="text-[11px] font-mono text-slate-400 w-6">{brush}</span>
          </div>

          <div className="flex items-center gap-1 ml-auto">
            <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-default">
              <Undo2 size={15} />
            </button>
            <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-default">
              <Redo2 size={15} />
            </button>
            <button onClick={reset} disabled={!canUndo} title="Reset erase edits"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500 cursor-pointer disabled:cursor-default">
              <RotateCcw size={15} />
            </button>
          </div>
        </div>

        {/* Scrollable body: canvas + adjustment controls */}
        <div className="flex-1 overflow-y-auto">
          {/* Canvas */}
          <div className="p-5 bg-slate-50 flex items-center justify-center min-h-[200px]">
            {loading ? (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Loader2 size={22} className="animate-spin" />
                <span className="text-xs font-medium">Loading…</span>
              </div>
            ) : dims && (
              <div className="relative inline-block rounded-xl overflow-hidden border border-slate-200 shadow-sm"
                style={{
                  backgroundImage:
                    'linear-gradient(45deg, #e2e8f0 25%, transparent 25%, transparent 75%, #e2e8f0 75%), linear-gradient(45deg, #e2e8f0 25%, transparent 25%, transparent 75%, #e2e8f0 75%)',
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 8px 8px',
                  backgroundColor: '#fff',
                }}>
                <canvas
                  ref={displayRef}
                  width={dims.w}
                  height={dims.h}
                  style={{ width: dims.w * dims.scale, height: dims.h * dims.scale, maxWidth: '100%', aspectRatio: `${dims.w} / ${dims.h}`, touchAction: 'none', cursor: 'none', display: 'block' }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={endStroke}
                  onPointerLeave={() => { endStroke(); setCursor(null); }}
                />
                {/* Brush cursor preview */}
                {cursor && (
                  <div className="pointer-events-none absolute rounded-full border-2"
                    style={{
                      width: brush, height: brush,
                      left: cursor.x - brush / 2, top: cursor.y - brush / 2,
                      borderColor: tool === 'erase' ? 'rgba(220,38,38,0.9)' : 'rgba(37,99,235,0.9)',
                      boxShadow: '0 0 0 1px rgba(255,255,255,0.8)',
                    }} />
                )}
                {/* Re-processing overlay */}
                {processing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px]">
                    <Loader2 size={20} className="animate-spin text-indigo-500" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Adjustment controls */}
          {!loading && (
            <div className="px-5 pb-5 space-y-4">
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Background Removal</span>
                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl text-[11px] font-semibold">
                  {([{ id: 'white', label: 'White' }, { id: 'black', label: 'Black' }, { id: 'auto', label: 'Auto' }] as const).map(m => (
                    <button key={m.id} onClick={() => { setMode(m.id); setDirty(true); }}
                      className={cn("py-1.5 rounded-lg text-center cursor-pointer transition-all",
                        mode === m.id ? "bg-white text-indigo-700 shadow-sm font-bold" : "text-slate-500 hover:text-slate-800")}>
                      {m.label}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 font-medium">Tolerance</span>
                  <span className="text-slate-500 font-bold font-mono">{tolerance}%</span>
                </div>
                <input type="range" min={0} max={200} value={tolerance}
                  onChange={(e) => { setTolerance(Number(e.target.value)); setDirty(true); }}
                  className="w-full accent-indigo-600 h-1 bg-slate-100 rounded-full appearance-none cursor-pointer" />
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Enhance Signature</span>
                  <button onClick={() => { setEnhanceEnabled(v => !v); setDirty(true); }}
                    className={cn("relative w-9 h-5 rounded-full transition-colors duration-200 cursor-pointer",
                      enhanceEnabled ? "bg-indigo-500" : "bg-slate-200")}>
                    <span className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                      enhanceEnabled ? "translate-x-4" : "translate-x-0")} />
                  </button>
                </div>
                {enhanceEnabled && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-slate-400 flex items-center gap-1"><Sparkles size={10} className="text-amber-500" /> Darkens strokes &amp; boosts contrast for a real ink look</p>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-600 font-medium">Strength</span>
                      <span className="text-slate-500 font-bold font-mono">{enhanceStrength}%</span>
                    </div>
                    <input type="range" min={10} max={100} value={enhanceStrength}
                      onChange={(e) => { setEnhanceStrength(Number(e.target.value)); setDirty(true); }}
                      className="w-full accent-amber-500 h-1 bg-slate-100 rounded-full appearance-none cursor-pointer" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
          <span className="text-[11px] text-slate-400 hidden sm:block">Tip: <kbd className="font-mono">E</kbd> erase · <kbd className="font-mono">R</kbd> restore</span>
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 cursor-pointer">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || loading || processing || !dirty}
              className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer">
              {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : <><Check size={15} /> Save Changes</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
