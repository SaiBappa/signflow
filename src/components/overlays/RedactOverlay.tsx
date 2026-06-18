import React from 'react';
import { Rnd } from 'react-rnd';
import { RedactInstance } from '../../types';
import { useIsMobile } from '../../hooks/useIsMobile';

interface RedactOverlayProps {
  redact: RedactInstance;
  isSelected: boolean;
  onUpdate: (id: string, update: Partial<RedactInstance>) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string | null) => void;
  onColorChange: (id: string, color: string) => void;
}

// Enlarged corner/edge resize handles for touch. Default react-rnd handles are
// ~10px which are nearly impossible to grab with a finger.
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

export function RedactOverlay({
  redact,
  isSelected,
  onUpdate,
  onDelete,
  onSelect,
  onColorChange,
}: RedactOverlayProps) {
  const pageIndex = redact.pageIndex;
  const isMobile = useIsMobile();

  return (
    <Rnd
      key={redact.id}
      size={{ width: redact.pos.width, height: redact.pos.height }}
      position={{ x: redact.pos.x, y: redact.pos.y }}
      onDragStart={() => onSelect(redact.id)}
      onDragStop={(e, d) => {
        const pageEl = window.document.getElementById(`document-canvas-content-${pageIndex}`);
        onUpdate(redact.id, {
          pos: { ...redact.pos, x: d.x, y: d.y },
          canvasWidth: pageEl?.clientWidth,
          canvasHeight: pageEl?.clientHeight,
        });
      }}
      onResizeStop={(e, direction, ref, delta, position) => {
        const pageEl = window.document.getElementById(`document-canvas-content-${pageIndex}`);
        onUpdate(redact.id, {
          pos: { x: position.x, y: position.y, width: parseInt(ref.style.width, 10), height: parseInt(ref.style.height, 10) },
          canvasWidth: pageEl?.clientWidth,
          canvasHeight: pageEl?.clientHeight,
        });
      }}
      bounds="parent"
      resizeHandleStyles={isMobile && isSelected ? touchResizeHandleStyles : undefined}
      className={`z-30 cursor-move touch-none ${isSelected ? 'ring-2 ring-rose-400' : 'hover:ring-2 hover:ring-rose-400'}`}
      style={{ background: redact.color }}
      onMouseDown={() => onSelect(redact.id)}
    >
      <div className="w-full h-full" />
      {isSelected && (
      <div
        className="absolute -bottom-12 md:-bottom-10 left-1/2 -translate-x-1/2 bg-white border border-slate-200 shadow-xl rounded-lg px-1.5 py-1 flex items-center gap-1 z-[60] whitespace-nowrap max-w-[calc(100vw-2rem)] overflow-x-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          type="color"
          value={redact.color}
          onChange={e => onColorChange(redact.id, e.target.value)}
          className="w-9 h-9 md:w-7 md:h-7 p-0.5 border border-slate-200 rounded-md cursor-pointer"
        />
        <div className="w-[1px] h-5 bg-slate-200"></div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(redact.id);
            onSelect(null);
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
}
