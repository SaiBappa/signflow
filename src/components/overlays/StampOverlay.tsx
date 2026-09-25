import React from 'react';
import { Rnd } from 'react-rnd';
import { StampInstance } from '../../types';
import { useIsMobile } from '../../hooks/useIsMobile';

interface StampOverlayProps {
  stamp: StampInstance;
  isSelected: boolean;
  onUpdate: (id: string, update: Partial<StampInstance>) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string | null) => void;
}

// Enlarged corner resize handles so they can be grabbed with a finger on touch.
// Each handle is a generous hit area centred on the corner of the box.
const touchHandle = (corner: 'tl' | 'tr' | 'bl' | 'br'): React.CSSProperties => {
  const size = 28;
  const off = -size / 2;
  return {
    width: size,
    height: size,
    ...(corner[0] === 't' ? { top: off } : { bottom: off }),
    ...(corner[1] === 'l' ? { left: off } : { right: off }),
  };
};
const touchResizeHandleStyles = {
  topLeft: touchHandle('tl'),
  topRight: touchHandle('tr'),
  bottomLeft: touchHandle('bl'),
  bottomRight: touchHandle('br'),
};

export function StampOverlay({
  stamp,
  isSelected,
  onUpdate,
  onDelete,
  onSelect,
}: StampOverlayProps) {
  const pageIndex = stamp.pageIndex;
  const isMobile = useIsMobile();

  return (
    <Rnd
      key={stamp.id}
      size={{ width: stamp.pos.width, height: stamp.pos.height }}
      position={{ x: stamp.pos.x, y: stamp.pos.y }}
      lockAspectRatio
      onDragStart={() => onSelect(stamp.id)}
      onDragStop={(e, d) => {
        const pageEl = window.document.getElementById(`document-canvas-content-${pageIndex}`);
        onUpdate(stamp.id, {
          pos: { ...stamp.pos, x: d.x, y: d.y },
          canvasWidth: pageEl?.clientWidth,
          canvasHeight: pageEl?.clientHeight,
        });
      }}
      onResizeStop={(e, direction, ref, delta, position) => {
        const pageEl = window.document.getElementById(`document-canvas-content-${pageIndex}`);
        onUpdate(stamp.id, {
          pos: { x: position.x, y: position.y, width: parseInt(ref.style.width, 10), height: parseInt(ref.style.height, 10) },
          canvasWidth: pageEl?.clientWidth,
          canvasHeight: pageEl?.clientHeight,
        });
      }}
      bounds="parent"
      resizeHandleStyles={isMobile && isSelected ? touchResizeHandleStyles : undefined}
      className={`rounded z-40 cursor-move touch-none ${isSelected ? 'ring-2 ring-amber-400' : 'hover:ring-2 hover:ring-amber-400'}`}
      onMouseDown={() => onSelect(stamp.id)}
    >
      <img src={stamp.url} className="w-full h-full object-contain pointer-events-none select-none" draggable={false} />
      {/* Visible corner dots when selected — give touch users a target to aim for */}
      {isSelected && isMobile && (
        <>
          <span className="absolute -top-1 -left-1 w-3 h-3 bg-amber-500 rounded-full border border-white shadow pointer-events-none z-[55]" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border border-white shadow pointer-events-none z-[55]" />
          <span className="absolute -bottom-1 -left-1 w-3 h-3 bg-amber-500 rounded-full border border-white shadow pointer-events-none z-[55]" />
          <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border border-white shadow pointer-events-none z-[55]" />
        </>
      )}
      {isSelected && (
      <div
        className="absolute -bottom-12 md:-bottom-10 left-1/2 -translate-x-1/2 bg-white border border-slate-200 shadow-xl rounded-lg px-1.5 py-1 flex items-center gap-1 z-[60] whitespace-nowrap max-w-[calc(100vw-2rem)] overflow-x-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(stamp.id);
            onSelect(null);
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
}
