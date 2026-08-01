import React from 'react';
import { Rnd } from 'react-rnd';
import { TextInstance } from '../../types';
import { TEXT_FONTS, fontCss } from '../../utils';
import { handleThaanaKeyDown, isDhivehiFont } from '../../utils/thaanaKeyboard';
import { useIsMobile } from '../../hooks/useIsMobile';

// Enlarged corner resize handles so they can be grabbed with a finger on touch.
const TH = 28;
const off = -TH / 2;
const touchResizeHandleStyles = {
  topLeft: { width: TH, height: TH, top: off, left: off },
  topRight: { width: TH, height: TH, top: off, right: off },
  bottomLeft: { width: TH, height: TH, bottom: off, left: off },
  bottomRight: { width: TH, height: TH, bottom: off, right: off },
};

interface TextOverlayProps {
  text: TextInstance;
  isEditing: boolean;
  isSelected: boolean;
  onUpdate: (id: string, update: Partial<TextInstance>) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string | null) => void;
  onStartEditing: (id: string) => void;
  onStopEditing: () => void;
}

export function TextOverlay({
  text,
  isEditing,
  isSelected,
  onUpdate,
  onDelete,
  onSelect,
  onStartEditing,
  onStopEditing,
}: TextOverlayProps) {
  const pageIndex = text.pageIndex;
  const isMobile = useIsMobile();

  return (
    <Rnd
      key={text.id}
      size={{ width: text.pos.width, height: text.pos.height }}
      position={{ x: text.pos.x, y: text.pos.y }}
      onDragStart={() => {
        onSelect(text.id);
      }}
      onDragStop={(e, d) => {
        const pageEl = window.document.getElementById(`document-canvas-content-${pageIndex}`);
        onUpdate(text.id, {
          pos: { ...text.pos, x: d.x, y: d.y },
          canvasWidth: pageEl?.clientWidth,
          canvasHeight: pageEl?.clientHeight,
        });
      }}
      onResizeStop={(e, direction, ref, delta, position) => {
        const pageEl = window.document.getElementById(`document-canvas-content-${pageIndex}`);
        onUpdate(text.id, {
          pos: {
            x: position.x,
            y: position.y,
            width: parseInt(ref.style.width, 10),
            height: parseInt(ref.style.height, 10),
          },
          fontSize: Math.max(12, parseInt(ref.style.height, 10) * 0.7),
          canvasWidth: pageEl?.clientWidth,
          canvasHeight: pageEl?.clientHeight,
        });
      }}
      bounds="parent"
      enableResizing={isSelected && !isEditing}
      resizeHandleStyles={isMobile && isSelected && !isEditing ? touchResizeHandleStyles : undefined}
      disableDragging={isEditing}
      className={`rounded z-50 ${!isEditing ? 'touch-none' : ''} ${
        isEditing ? 'ring-2 ring-indigo-500 shadow-lg' :
        isSelected ? 'ring-2 ring-indigo-400 shadow-md' :
        'hover:ring-1 hover:ring-indigo-300/50'
      } ${!isEditing ? 'cursor-move' : ''}`}
      style={{ background: isSelected || isEditing ? 'rgba(255,255,255,0.15)' : 'transparent' }}
      onMouseDown={() => {
        // Select on click (but don't interfere with toolbar interactions)
        if (!isEditing) {
          onSelect(text.id);
        }
      }}
    >
      {/* Border indicator — only when selected */}
      {isSelected && !isEditing && (
        <div className="absolute inset-0 border-2 border-indigo-400/50 border-dashed rounded pointer-events-none z-10"></div>
      )}

      {/* Visible corner dots when selected on mobile — a target to aim the finger at */}
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
          onBlur={() => onStopEditing()}
          value={text.text}
          onChange={(e) => onUpdate(text.id, { text: e.target.value })}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            handleThaanaKeyDown(
              e,
              isDhivehiFont(text.fontFamily),
              (val) => onUpdate(text.id, { text: val })
            );
            if (e.key === 'Escape') {
              onStopEditing();
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
            onSelect(text.id);
            onStartEditing(text.id);
          }}
          className="w-full h-full overflow-hidden select-none flex items-center"
        >
          <p className="w-full whitespace-pre-wrap break-words leading-tight pointer-events-none" dir={isDhivehiFont(text.fontFamily) ? 'rtl' : 'ltr'} style={{ fontSize: `${text.fontSize}px`, color: text.color, fontFamily: fontCss(text.fontFamily), fontWeight: text.bold ? 'bold' : undefined, fontStyle: text.italic ? 'italic' : undefined }}>
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
             onUpdate(text.id, { fontFamily: val });
           }}
           className="h-9 md:h-7 px-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-md cursor-pointer focus:outline-none focus:border-indigo-400 hover:border-indigo-300 w-[88px] sm:w-[110px] shrink-0"
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
             onUpdate(text.id, { bold: !text.bold });
           }}
           className={`w-9 h-9 md:w-7 md:h-7 flex items-center justify-center rounded-md text-sm font-bold cursor-pointer shrink-0 ${text.bold ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50'}`}
           title="Bold"
         >
           B
         </button>
         <button
           onClick={(e) => {
             e.stopPropagation();
             onUpdate(text.id, { italic: !text.italic });
           }}
           className={`w-9 h-9 md:w-7 md:h-7 flex items-center justify-center rounded-md text-sm italic font-serif cursor-pointer shrink-0 ${text.italic ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50'}`}
           title="Italic"
         >
           I
         </button>
         <div className="w-[1px] h-5 bg-slate-200"></div>
         <button
           onClick={(e) => {
             e.stopPropagation();
             onUpdate(text.id, { fontSize: Math.max(8, text.fontSize - 2) });
           }}
           className="w-9 h-9 md:w-7 md:h-7 flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md text-xs font-bold cursor-pointer shrink-0"
           title="Decrease font size"
         >
           A-
         </button>
         <button
           onClick={(e) => {
             e.stopPropagation();
             onUpdate(text.id, { fontSize: text.fontSize + 2 });
           }}
           className="w-9 h-9 md:w-7 md:h-7 flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md text-sm font-bold cursor-pointer shrink-0"
           title="Increase font size"
         >
           A+
         </button>
         <div className="w-[1px] h-5 bg-slate-200"></div>
         <input
           type="color"
           value={text.color}
           onChange={e => onUpdate(text.id, { color: e.target.value })}
           className="w-9 h-9 md:w-7 md:h-7 p-0.5 border border-slate-200 rounded-md cursor-pointer shrink-0"
         />
         <div className="w-[1px] h-5 bg-slate-200"></div>
         <button
           onClick={(e) => {
             e.stopPropagation();
             onDelete(text.id);
             onSelect(null);
           }}
           className="w-9 h-9 md:w-7 md:h-7 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md cursor-pointer shrink-0"
           title="Delete text"
         >
           ✕
         </button>
      </div>
      )}
    </Rnd>
  );
}
