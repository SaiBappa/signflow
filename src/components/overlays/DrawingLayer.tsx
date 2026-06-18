import React, { useRef, useState } from 'react';
import { DrawInstance, DrawShape } from '../../types';

interface DrawingLayerProps {
  active: boolean;
  pageIndex: number;
  shape: DrawShape;
  color: string;
  strokeWidth: number;
  opacity: number;
  onCreate: (d: DrawInstance) => void;
}

interface Pt { x: number; y: number; }

const MIN_SIZE = 4;

export function DrawingLayer({ active, pageIndex, shape, color, strokeWidth, opacity, onCreate }: DrawingLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const ptsRef = useRef<Pt[]>([]);
  const [preview, setPreview] = useState<Pt[] | null>(null);

  if (!active) return null;

  const localPoint = (e: React.PointerEvent): Pt => {
    const rect = layerRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(rect.width, e.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, e.clientY - rect.top)),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = localPoint(e);
    ptsRef.current = [p];
    setPreview([p, p]);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (ptsRef.current.length === 0) return;
    const p = localPoint(e);
    if (shape === 'freehand') {
      ptsRef.current.push(p);
      setPreview([...ptsRef.current]);
    } else {
      ptsRef.current = [ptsRef.current[0], p];
      setPreview([ptsRef.current[0], p]);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (ptsRef.current.length === 0) return;
    const pts = ptsRef.current;
    ptsRef.current = [];
    setPreview(null);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    }
    const boxW = Math.max(maxX - minX, 1);
    const boxH = Math.max(maxY - minY, 1);
    // Ignore stray clicks that didn't produce a real shape.
    if (boxW < MIN_SIZE && boxH < MIN_SIZE) return;

    const rect = layerRef.current!.getBoundingClientRect();
    const normalized: number[] = [];
    for (const p of pts) {
      normalized.push((p.x - minX) / boxW, (p.y - minY) / boxH);
    }

    // Give shapes that should not collapse a minimum drawable size.
    let x = minX, y = minY, w = boxW, h = boxH;
    if (shape === 'line' || shape === 'arrow' || shape === 'freehand') {
      // keep box; normalized points carry the geometry
    } else {
      if (w < MIN_SIZE) w = MIN_SIZE;
      if (h < MIN_SIZE) h = MIN_SIZE;
    }

    onCreate({
      id: crypto.randomUUID(),
      pageIndex,
      shape,
      pos: { x, y, width: w, height: h },
      color,
      strokeWidth,
      opacity,
      points: (shape === 'line' || shape === 'arrow' || shape === 'freehand') ? normalized : undefined,
      canvasWidth: rect.width,
      canvasHeight: rect.height,
    });
  };

  // Live preview rendered in raw pixel space.
  const renderPreview = () => {
    if (!preview) return null;
    const common = {
      stroke: color,
      strokeWidth,
      strokeOpacity: opacity,
      fill: 'none',
      strokeLinecap: 'round' as const,
      strokeLinejoin: 'round' as const,
    };
    if (shape === 'freehand') {
      return <polyline points={preview.map(p => `${p.x},${p.y}`).join(' ')} {...common} />;
    }
    const a = preview[0], b = preview[preview.length - 1];
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    const w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
    if (shape === 'rectangle') return <rect x={x} y={y} width={w} height={h} {...common} />;
    if (shape === 'highlight') return <rect x={x} y={y} width={w} height={h} fill={color} fillOpacity={opacity} stroke="none" />;
    if (shape === 'ellipse') return <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} {...common} />;
    if (shape === 'line' || shape === 'arrow') return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...common} />;
    return null;
  };

  return (
    <div
      ref={layerRef}
      className="absolute inset-0 z-[55] cursor-crosshair touch-none"
      style={{ touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <svg width="100%" height="100%" style={{ overflow: 'visible', pointerEvents: 'none' }}>
        {renderPreview()}
      </svg>
    </div>
  );
}
