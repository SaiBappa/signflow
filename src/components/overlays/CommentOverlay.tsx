import React, { useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { MessageSquare, Check, Trash2 } from 'lucide-react';
import { CommentInstance } from '../../types';
import { COMMENT_COLORS, lightTint } from '../../utils/annotations';
import { useIsMobile } from '../../hooks/useIsMobile';

// Enlarged resize handles for touch (default react-rnd handles are ~10px).
const TH = 28;
const off = -TH / 2;
const touchResizeHandleStyles = {
  topLeft: { width: TH, height: TH, top: off, left: off },
  topRight: { width: TH, height: TH, top: off, right: off },
  bottomLeft: { width: TH, height: TH, bottom: off, left: off },
  bottomRight: { width: TH, height: TH, bottom: off, right: off },
};

interface CommentOverlayProps {
  comment: CommentInstance;
  isSelected: boolean;
  pageElId: string;
  onUpdate: (id: string, update: Partial<CommentInstance>) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string | null) => void;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(0, Math.floor((now - then) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export const CommentOverlay: React.FC<CommentOverlayProps> = ({ comment, isSelected, pageElId, onUpdate, onDelete, onSelect }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isSelected && textareaRef.current && !comment.text) {
      textareaRef.current.focus();
    }
  }, [isSelected, comment.text]);

  const getPageEl = () => window.document.getElementById(pageElId);

  return (
    <Rnd
      size={{ width: comment.pos.width, height: comment.pos.height }}
      position={{ x: comment.pos.x, y: comment.pos.y }}
      minWidth={140}
      minHeight={80}
      onDragStart={() => onSelect(comment.id)}
      onDragStop={(e, d) => {
        const pageEl = getPageEl();
        onUpdate(comment.id, {
          pos: { ...comment.pos, x: d.x, y: d.y },
          canvasWidth: pageEl?.clientWidth,
          canvasHeight: pageEl?.clientHeight,
        });
      }}
      onResizeStop={(e, direction, ref, delta, position) => {
        const pageEl = getPageEl();
        onUpdate(comment.id, {
          pos: { x: position.x, y: position.y, width: parseInt(ref.style.width, 10), height: parseInt(ref.style.height, 10) },
          canvasWidth: pageEl?.clientWidth,
          canvasHeight: pageEl?.clientHeight,
        });
      }}
      bounds="parent"
      cancel="textarea, .comment-toolbar"
      dragHandleClassName="comment-drag-handle"
      resizeHandleStyles={isMobile && isSelected ? touchResizeHandleStyles : undefined}
      className={`z-[45] ${isSelected ? '' : ''}`}
      onMouseDown={() => onSelect(comment.id)}
    >
      <div
        className="w-full h-full flex flex-col rounded-lg overflow-hidden shadow-lg"
        style={{
          background: lightTint(comment.color, 0.86),
          border: `1.5px solid ${comment.color}`,
          opacity: comment.resolved ? 0.6 : 1,
          boxShadow: isSelected ? `0 0 0 2px ${comment.color}55, 0 10px 25px -10px rgba(0,0,0,0.3)` : undefined,
        }}
      >
        {/* Header */}
        <div
          className="comment-drag-handle flex items-center gap-1.5 px-2 py-1.5 md:py-1 cursor-move select-none touch-none"
          style={{ background: comment.color }}
        >
          <MessageSquare size={12} className="text-white shrink-0" strokeWidth={2.5} />
          <span className="text-[11px] font-bold text-white truncate flex-1">{comment.author || 'Comment'}</span>
          <span className="text-[9px] text-white/80 whitespace-nowrap">{relativeTime(comment.createdAt)}</span>
        </div>
        {/* Body */}
        <textarea
          ref={textareaRef}
          value={comment.text}
          placeholder="Write a comment…"
          onChange={(e) => onUpdate(comment.id, { text: e.target.value })}
          onMouseDown={(e) => { e.stopPropagation(); onSelect(comment.id); }}
          className="flex-1 w-full resize-none bg-transparent px-2 py-1.5 text-[12px] leading-snug text-slate-800 placeholder:text-slate-400 focus:outline-none cursor-text"
          style={{ textDecoration: comment.resolved ? 'line-through' : 'none' }}
        />
      </div>

      {isSelected && (
        <div
          className="comment-toolbar absolute -bottom-12 md:-bottom-10 left-1/2 -translate-x-1/2 bg-white border border-slate-200 shadow-xl rounded-lg px-1.5 py-1 flex items-center gap-1 z-[70] whitespace-nowrap max-w-[calc(100vw-2rem)] overflow-x-auto"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {COMMENT_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={(e) => { e.stopPropagation(); onUpdate(comment.id, { color: c.value }); }}
              className="w-7 h-7 md:w-5 md:h-5 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer shrink-0"
              style={{ backgroundColor: c.value, borderColor: comment.color === c.value ? '#475569' : 'transparent' }}
              title={c.name}
            />
          ))}
          <div className="w-[1px] h-5 bg-slate-200" />
          <button
            onClick={(e) => { e.stopPropagation(); onUpdate(comment.id, { resolved: !comment.resolved }); }}
            className={`w-9 h-9 md:w-7 md:h-7 flex items-center justify-center rounded-md cursor-pointer shrink-0 ${comment.resolved ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
            title={comment.resolved ? 'Mark unresolved' : 'Mark resolved'}
          >
            <Check size={15} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(comment.id); onSelect(null); }}
            className="w-9 h-9 md:w-7 md:h-7 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md cursor-pointer shrink-0"
            title="Delete comment"
          >
            <Trash2 size={15} />
          </button>
        </div>
      )}
    </Rnd>
  );
}
