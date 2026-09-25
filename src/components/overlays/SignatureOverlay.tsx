import React from 'react';
import { Rnd } from 'react-rnd';
import { RotateCw } from 'lucide-react';
import { SignatureState, SignatureInstance } from '../../types';
import { cn } from '../../utils';
import { useIsMobile } from '../../hooks/useIsMobile';

// Enlarged corner resize handles so they can be grabbed with a finger on touch.
const TH = 28;
const hOff = -TH / 2;
const touchResizeHandleStyles = {
  topLeft: { width: TH, height: TH, top: hOff, left: hOff },
  topRight: { width: TH, height: TH, top: hOff, right: hOff },
  bottomLeft: { width: TH, height: TH, bottom: hOff, left: hOff },
  bottomRight: { width: TH, height: TH, bottom: hOff, right: hOff },
};

interface SignatureOverlayProps {
  signature: SignatureState;
  instance: SignatureInstance;
  /** Display index for the label (1-based) */
  index: number;
  pageIndex: number;
  containerWidth: number;
  containerHeight: number;
  onUpdate: (id: string, update: Partial<SignatureInstance>) => void;
  onDelete: (id: string) => void;
  onRotate: (id: string, rotation: number) => void;
}

export function SignatureOverlay({
  signature,
  instance,
  index,
  pageIndex,
  containerWidth,
  containerHeight,
  onUpdate,
  onDelete,
  onRotate,
}: SignatureOverlayProps) {
  const isMobile = useIsMobile();
  // On touch there is no hover, so reveal handles/label/controls whenever the
  // overlay is present. Desktop keeps the hover-reveal behaviour.
  const revealCls = isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100';
  return (
    <Rnd
      key={instance.id}
      size={{ width: instance.pos.width, height: instance.pos.height }}
      position={{ x: instance.pos.x, y: instance.pos.y }}
      lockAspectRatio={true}
      onDragStop={(e, d) => {
        const pageEl = window.document.getElementById(`document-canvas-content-${pageIndex}`);
        onUpdate(instance.id, {
          pos: { ...instance.pos, x: d.x, y: d.y },
          canvasWidth: pageEl?.clientWidth,
          canvasHeight: pageEl?.clientHeight,
        });
      }}
      onResizeStop={(e, direction, ref, delta, position) => {
        const pageEl = window.document.getElementById(`document-canvas-content-${pageIndex}`);
        onUpdate(instance.id, {
          pos: {
            x: position.x,
            y: position.y,
            width: parseInt(ref.style.width, 10),
            height: parseInt(ref.style.height, 10),
          },
          canvasWidth: pageEl?.clientWidth,
          canvasHeight: pageEl?.clientHeight,
        });
      }}
      bounds="parent"
      resizeHandleStyles={isMobile ? touchResizeHandleStyles : undefined}
      className={cn("group rounded touch-none z-50")}
    >
      <div
        className="w-full h-full relative"
        style={{ transform: `rotate(${instance.rotation || 0}deg)` }}
      >
        <div className="absolute inset-0 border-2 border-indigo-400 border-dashed rounded pointer-events-none group-active:border-indigo-500 z-10"></div>
        <div className={cn("absolute -top-1 -left-1 w-3 h-3 bg-indigo-600 rounded-full border border-white shadow-sm pointer-events-none", revealCls)}></div>
        <div className={cn("absolute -top-1 -right-1 w-3 h-3 bg-indigo-600 rounded-full border border-white shadow-sm pointer-events-none", revealCls)}></div>
        <div className={cn("absolute -bottom-1 -left-1 w-3 h-3 bg-indigo-600 rounded-full border border-white shadow-sm pointer-events-none", revealCls)}></div>
        <div className={cn("absolute -bottom-1 -right-1 w-3 h-3 bg-indigo-600 rounded-full border border-white shadow-sm pointer-events-none", revealCls)}></div>

        {/* Rotation Handle */}
        <div
          className={cn("absolute -top-9 md:-top-6 left-1/2 -translate-x-1/2 w-9 h-9 md:w-6 md:h-6 bg-white border border-slate-200 shadow-md rounded-full flex items-center justify-center cursor-crosshair pointer-events-auto z-50 hover:bg-slate-50 hover:text-indigo-600 text-slate-400 transition-colors touch-none", revealCls)}
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

              onRotate(instance.id, newRot);
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
      <div className={cn("absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-slate-800 text-white pl-2 pr-1 py-1 md:py-1 rounded text-[10px] flex gap-2 items-center shadow-xl transition-opacity whitespace-nowrap z-50 font-sans", revealCls)}>
        <span>Signature #{index + 1}</span>
        <div className="h-3 w-[1px] bg-slate-600"></div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(instance.id);
          }}
          className="hover:text-red-400 text-red-300 cursor-pointer min-h-[36px] md:min-h-0 flex items-center px-1"
        >Delete</button>
      </div>
    </Rnd>
  );
}
