import React from 'react';
import { Rnd } from 'react-rnd';
import { Trash2 } from 'lucide-react';
import { DrawInstance } from '../../types';
import { DRAW_COLORS } from '../../utils/annotations';
import { useIsMobile } from '../../hooks/useIsMobile';

// Enlarged resize handles for touch (default react-rnd handles are ~10px).
const TH = 28;
const off = -TH / 2;
const touchResizeHandleStyles = {
  topLeft: { width: TH, height: TH, top: off, left: off },
  topRight: { width: TH, height: TH, top: off, right: off },
  bottomLeft: { width: TH, height: TH, bottom: off, left: off },
  bottomRight: { width: TH, height: TH, bottom: off, right: off },
  top: { height: TH, top: off },
  bottom: { height: TH, bottom: off },
  left: { width: TH, left: off },
  right: { width: TH, right: off },
};

interface DrawingOverlayProps {
  drawing: DrawInstance;
  isSelected: boolean;
  pageElId: string;
  onUpdate: (id: string, update: Partial<DrawInstance>) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string | null) => void;
}

// Render the shape inside a 0-100 viewBox so it stretches with the Rnd box.
function ShapeSvg({ d }: { d: DrawInstance }) {
  const stroke = d.color;
  const sw = d.strokeWidth;
  const common = {
    stroke,
    strokeWidth: sw,
    strokeOpacity: d.opacity ?? 1,
    fill: 'none',
    vectorEffect: 'non-scaling-stroke' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const pts = d.points || [];
  const markerId = `arrow-${d.id}`;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ overflow: 'visible', display: 'block', pointerEvents: 'none' }}
    >
      {d.shape === 'arrow' && (
        <defs>
          <marker id={markerId} markerWidth="10" markerHeight="10" refX="7" refY="5" orient="auto" markerUnits="strokeWidth">
            <path d="M0,1 L8,5 L0,9" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        </defs>
      )}
      {d.shape === 'rectangle' && <rect x="0" y="0" width="100" height="100" {...common} />}
      {d.shape === 'highlight' && (
        <rect x="0" y="0" width="100" height="100" fill={stroke} fillOpacity={d.opacity ?? 0.4} stroke="none" />
      )}
      {d.shape === 'redact' && (
        <rect x="0" y="0" width="100" height="100" fill={stroke} fillOpacity={d.opacity ?? 1} stroke="none" />
      )}
      {d.shape === 'ellipse' && <ellipse cx="50" cy="50" rx="50" ry="50" {...common} />}
      {(d.shape === 'line' || d.shape === 'arrow') && pts.length >= 4 && (
        <line
          x1={pts[0] * 100} y1={pts[1] * 100} x2={pts[2] * 100} y2={pts[3] * 100}
          {...common}
          markerEnd={d.shape === 'arrow' ? `url(#${markerId})` : undefined}
        />
      )}
      {d.shape === 'freehand' && pts.length >= 4 && (
        <polyline
          points={Array.from({ length: Math.floor(pts.length / 2) }, (_, i) => `${pts[i * 2] * 100},${pts[i * 2 + 1] * 100}`).join(' ')}
          {...common}
        />
      )}
    </svg>
  );
}

export const DrawingOverlay: React.FC<DrawingOverlayProps> = ({ drawing, isSelected, pageElId, onUpdate, onDelete, onSelect }) => {
  const getPageEl = () => window.document.getElementById(pageElId);
  const isHighlight = drawing.shape === 'highlight' || drawing.shape === 'redact';
  const isMobile = useIsMobile();

  return (
    <Rnd
      size={{ width: drawing.pos.width, height: drawing.pos.height }}
      position={{ x: drawing.pos.x, y: drawing.pos.y }}
      onDragStart={() => onSelect(drawing.id)}
      onDragStop={(e, d) => {
        const pageEl = getPageEl();
        onUpdate(drawing.id, {
          pos: { ...drawing.pos, x: d.x, y: d.y },
          canvasWidth: pageEl?.clientWidth,
          canvasHeight: pageEl?.clientHeight,
        });
      }}
      onResizeStop={(e, direction, ref, delta, position) => {
        const pageEl = getPageEl();
        onUpdate(drawing.id, {
          pos: { x: position.x, y: position.y, width: parseInt(ref.style.width, 10), height: parseInt(ref.style.height, 10) },
          canvasWidth: pageEl?.clientWidth,
          canvasHeight: pageEl?.clientHeight,
        });
      }}
      bounds="parent"
      resizeHandleStyles={isMobile && isSelected ? touchResizeHandleStyles : undefined}
      className={`z-[35] cursor-move touch-none ${isSelected ? 'ring-2 ring-indigo-400 ring-offset-1' : 'hover:ring-1 hover:ring-indigo-300'}`}
      onMouseDown={() => onSelect(drawing.id)}
    >
      <ShapeSvg d={drawing} />

      {isSelected && (
        <div
          className="absolute -bottom-12 md:-bottom-10 left-1/2 -translate-x-1/2 bg-white border border-slate-200 shadow-xl rounded-lg px-1.5 py-1 flex items-center gap-1 z-[70] whitespace-nowrap max-w-[calc(100vw-2rem)] overflow-x-auto"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {DRAW_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={(e) => { e.stopPropagation(); onUpdate(drawing.id, { color: c.value }); }}
              className="w-7 h-7 md:w-5 md:h-5 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer shrink-0"
              style={{ backgroundColor: c.value, borderColor: drawing.color === c.value ? '#475569' : 'transparent' }}
              title={c.name}
            />
          ))}
          <input
            type="color"
            value={drawing.color}
            onChange={(e) => onUpdate(drawing.id, { color: e.target.value })}
            className="w-8 h-8 md:w-6 md:h-6 p-0.5 border border-slate-200 rounded-md cursor-pointer shrink-0"
            title="Custom colour"
          />
          {!isHighlight && (
            <>
              <div className="w-[1px] h-5 bg-slate-200" />
              <input
                type="range"
                min={1}
                max={12}
                value={drawing.strokeWidth}
                onChange={(e) => onUpdate(drawing.id, { strokeWidth: parseInt(e.target.value, 10) })}
                className="w-16 cursor-pointer shrink-0"
                title="Stroke width"
              />
            </>
          )}
          <div className="w-[1px] h-5 bg-slate-200" />
          <input
            type="range"
            min={10}
            max={100}
            value={Math.round((drawing.opacity ?? 1) * 100)}
            onChange={(e) => onUpdate(drawing.id, { opacity: parseInt(e.target.value, 10) / 100 })}
            className="w-16 cursor-pointer shrink-0"
            title="Opacity"
          />
          <div className="w-[1px] h-5 bg-slate-200" />
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(drawing.id); onSelect(null); }}
            className="w-9 h-9 md:w-7 md:h-7 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md cursor-pointer shrink-0"
            title="Delete drawing"
          >
            <Trash2 size={15} />
          </button>
        </div>
      )}
    </Rnd>
  );
}
