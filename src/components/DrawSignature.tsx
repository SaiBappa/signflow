import React, { useRef, useState, useEffect, useCallback } from 'react';

interface DrawSignatureProps {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}

type Mode = 'draw' | 'type';

interface Point {
  x: number;
  y: number;
  width: number;
}

interface Stroke {
  color: string;
  points: Point[];
}

const INK_COLORS = [
  { name: 'Ink Black', value: '#0f172a' },
  { name: 'Royal Blue', value: '#1d4ed8' },
  { name: 'Signature Red', value: '#dc2626' },
];

const SCRIPT_FONTS = [
  { name: 'Classic', stack: '"Snell Roundhand", "Brush Script MT", "Segoe Script", cursive' },
  { name: 'Formal', stack: '"Apple Chancery", "Lucida Calligraphy", "Palatino Linotype", cursive' },
  { name: 'Casual', stack: '"Bradley Hand", "Comic Sans MS", "Segoe Print", cursive' },
];

// Pen dynamics — width responds to drawing speed for a natural ink feel.
const MIN_WIDTH = 1.2;
const MAX_WIDTH = 4.2;
const VELOCITY_FILTER = 0.55; // how strongly speed thins the stroke

const midpoint = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

export function DrawSignature({ onSave, onCancel }: DrawSignatureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [mode, setMode] = useState<Mode>('draw');
  const [color, setColor] = useState(INK_COLORS[0].value);
  const [hasInk, setHasInk] = useState(false);

  // Typed-signature state
  const [typedName, setTypedName] = useState('');
  const [fontStack, setFontStack] = useState(SCRIPT_FONTS[0].stack);

  // Drawing state kept in refs so re-renders don't interrupt a stroke.
  const strokesRef = useRef<Stroke[]>([]);
  const currentRef = useRef<Stroke | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastMidRef = useRef<{ x: number; y: number } | null>(null);
  const lastWidthRef = useRef(MAX_WIDTH);
  const lastTimeRef = useRef(0);

  /** Resize the backing buffer to the element size × DPR and restore pen styles. */
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // Fixed fallback (400×200) keeps a sensible buffer when the element hasn't
    // been laid out yet (e.g. in jsdom, where getBoundingClientRect is 0).
    canvas.width = (rect.width || 400) * dpr;
    canvas.height = (rect.height || 200) * dpr;

    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  /** Replay a finished stroke with smoothed, variable-width ink. */
  const renderStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    const pts = stroke.points;
    if (pts.length === 0) return;
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;

    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, pts[0].width / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    let prevMid: { x: number; y: number } = pts[0];
    for (let i = 1; i < pts.length; i++) {
      const mid = midpoint(pts[i - 1], pts[i]);
      ctx.beginPath();
      ctx.lineWidth = pts[i].width;
      ctx.moveTo(prevMid.x, prevMid.y);
      ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, mid.x, mid.y);
      ctx.stroke();
      prevMid = mid;
    }
  }, []);

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokesRef.current.forEach((s) => renderStroke(ctx, s));
  }, [renderStroke]);

  useEffect(() => {
    setupCanvas();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      setupCanvas();
      redrawAll();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [setupCanvas, redrawAll]);

  const getPoint = (canvas: HTMLCanvasElement, e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture?.(e.pointerId);

    drawingRef.current = true;
    const p = getPoint(canvas, e);
    const width = e.pressure ? MIN_WIDTH + e.pressure * (MAX_WIDTH - MIN_WIDTH) : MAX_WIDTH;

    lastPointRef.current = p;
    lastMidRef.current = p;
    lastWidthRef.current = width;
    lastTimeRef.current = performance.now();

    currentRef.current = { color, points: [{ ...p, width }] };

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, width / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    setHasInk(true);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const stroke = currentRef.current;
    const last = lastPointRef.current;
    const lastMid = lastMidRef.current;
    if (!canvas || !stroke || !last || !lastMid) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const p = getPoint(canvas, e);
    const now = performance.now();
    const dt = Math.max(now - lastTimeRef.current, 1);
    const dist = Math.hypot(p.x - last.x, p.y - last.y);

    // Faster strokes → thinner ink. Stylus pressure overrides speed when present.
    let target = MAX_WIDTH - (dist / dt) * 14 * VELOCITY_FILTER;
    if (e.pressure) target = MIN_WIDTH + e.pressure * (MAX_WIDTH - MIN_WIDTH);
    target = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, target));
    const width = lastWidthRef.current * 0.5 + target * 0.5;

    const mid = midpoint(last, p);
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(lastMid.x, lastMid.y);
    ctx.quadraticCurveTo(last.x, last.y, mid.x, mid.y);
    ctx.stroke();

    stroke.points.push({ ...p, width });
    lastPointRef.current = p;
    lastMidRef.current = mid;
    lastWidthRef.current = width;
    lastTimeRef.current = now;
  };

  const stopDrawing = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (currentRef.current && currentRef.current.points.length > 0) {
      strokesRef.current.push(currentRef.current);
    }
    currentRef.current = null;
  };

  const undo = () => {
    strokesRef.current.pop();
    redrawAll();
    setHasInk(strokesRef.current.length > 0);
  };

  const clearCanvas = () => {
    strokesRef.current = [];
    currentRef.current = null;
    drawingRef.current = false;
    redrawAll();
    setHasInk(false);
  };

  /** Crop the exported PNG to the inked area so it drops cleanly onto a page. */
  const exportTrimmed = (canvas: HTMLCanvasElement): string => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas.toDataURL('image/png');
    try {
      const { width: w, height: h } = canvas;
      const data = ctx.getImageData(0, 0, w, h).data;
      let minX = w, minY = h, maxX = 0, maxY = 0, found = false;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (data[(y * w + x) * 4 + 3] !== 0) {
            found = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (!found) return canvas.toDataURL('image/png');

      const pad = 8;
      minX = Math.max(0, minX - pad);
      minY = Math.max(0, minY - pad);
      maxX = Math.min(w, maxX + pad);
      maxY = Math.min(h, maxY + pad);
      const cw = Math.max(1, maxX - minX);
      const ch = Math.max(1, maxY - minY);

      const out = document.createElement('canvas');
      out.width = cw;
      out.height = ch;
      const octx = out.getContext('2d');
      if (!octx) return canvas.toDataURL('image/png');
      octx.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
      return out.toDataURL('image/png');
    } catch {
      return canvas.toDataURL('image/png');
    }
  };

  const renderTypedToCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.min(cssH * 0.5, 56)}px ${fontStack}`;
    ctx.fillText(typedName.trim(), cssW / 2, cssH / 2);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (mode === 'type') {
      if (!typedName.trim()) return;
      renderTypedToCanvas();
    }

    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const hasPixels = Array.from(pixels).some((p) => p !== 0);
    if (hasPixels) {
      onSave(exportTrimmed(canvas));
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    clearCanvas();
    if (next === 'type') setTypedName('');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-y-auto max-h-[92vh] ring-1 ring-slate-900/5">
        {/* Header */}
        <div className="flex justify-between items-center px-5 pt-5 pb-3">
          <h3 className="font-bold text-lg text-slate-800 tracking-tight">Draw Signature</h3>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="w-8 h-8 grid place-items-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Mode tabs */}
        <div className="px-5">
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
            {(['draw', 'type'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`text-sm font-semibold py-1.5 rounded-lg transition-all ${
                  mode === m ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {m === 'draw' ? 'Draw' : 'Type'}
              </button>
            ))}
          </div>
        </div>

        {/* Canvas / type input */}
        <div className="px-5 pt-4">
          <div className="relative rounded-xl bg-gradient-to-b from-slate-50 to-slate-100 ring-1 ring-slate-200 overflow-hidden">
            {/* Signature baseline */}
            <div className="absolute left-6 right-6 bottom-9 border-b-2 border-dashed border-slate-300 pointer-events-none" />
            <span className="absolute left-6 bottom-3 text-[11px] font-medium text-slate-400 pointer-events-none select-none">
              Sign here
            </span>

            <canvas
              ref={canvasRef}
              className={`w-full h-[200px] touch-none ${
                mode === 'draw' ? 'cursor-crosshair' : 'pointer-events-none'
              }`}
              style={{ display: mode === 'draw' ? 'block' : 'none' }}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerLeave={stopDrawing}
              onPointerCancel={stopDrawing}
            />

            {mode === 'type' && (
              <div className="h-[200px] flex items-center justify-center px-6">
                <input
                  type="text"
                  autoFocus
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder="Type your name"
                  style={{ fontFamily: fontStack, color }}
                  className="w-full bg-transparent text-center text-4xl outline-none placeholder:text-slate-300 placeholder:font-sans"
                />
              </div>
            )}
          </div>
        </div>

        {/* Pen options */}
        <div className="px-5 pt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400">{mode === 'draw' ? 'Ink' : 'Color'}</span>
            {INK_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setColor(c.value)}
                aria-label={c.name}
                title={c.name}
                className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${
                  color === c.value ? 'ring-2 ring-offset-2 ring-slate-400' : 'ring-1 ring-slate-200'
                }`}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>

          {mode === 'draw' ? (
            <button
              onClick={undo}
              disabled={!hasInk}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1 rounded-md hover:bg-slate-100 transition-colors"
            >
              ↶ Undo
            </button>
          ) : (
            <select
              value={fontStack}
              onChange={(e) => setFontStack(e.target.value)}
              className="text-xs font-medium text-slate-600 bg-slate-100 rounded-md px-2 py-1 outline-none"
            >
              {SCRIPT_FONTS.map((f) => (
                <option key={f.name} value={f.stack}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex justify-between items-center px-5 py-4 mt-2">
          <button
            onClick={clearCanvas}
            className="text-sm font-medium text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Clear
          </button>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
            >
              Save & Use
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
