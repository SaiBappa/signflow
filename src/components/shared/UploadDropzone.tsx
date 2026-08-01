import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '../../utils';

/* Premium drag-and-drop zone for a tool's empty main area. Mirrors the
 * Fill & Sign upload card so every tool opens with the same look. */
interface UploadDropzoneProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  title?: string;
  /** Callers pass rich content (e.g. a highlighted "browse" span), not just text. */
  subtitle?: React.ReactNode;
  /** Small format chips, e.g. ['📄 PDF', '🖼️ PNG / JPG']. */
  chips?: string[];
  icon?: React.ReactNode;
}

export function UploadDropzone({
  onFiles,
  accept = 'application/pdf',
  multiple = false,
  title = 'Upload your document',
  subtitle,
  chips,
  icon,
}: UploadDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 md:p-8">
      <div
        onDragOver={e => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'edge-highlight w-full max-w-lg bg-white/75 backdrop-blur-xl border rounded-3xl p-8 md:p-12 text-center shadow-[0_30px_70px_-28px_rgba(79,70,229,0.28)] relative group transition-all duration-500',
          dragOver ? 'border-indigo-300 shadow-[0_36px_80px_-20px_rgba(79,70,229,0.34)] scale-[1.01]' : 'border-slate-200/60 hover:border-indigo-200/80 hover:-translate-y-0.5',
        )}
      >
        <input
          type="file"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          accept={accept}
          multiple={multiple}
          onChange={e => handleFiles(e.target.files)}
        />
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-[0_8px_25px_rgb(99,102,241,30%)] group-hover:scale-110 transition-transform duration-500 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
          <span className="relative text-white">{icon || <Upload className="w-9 h-9" strokeWidth={2} />}</span>
        </div>
        <h2 className="font-display text-2xl md:text-3xl font-bold text-slate-800 tracking-tight leading-tight">{title}</h2>
        <p className="mt-3 text-slate-500 text-sm font-medium max-w-sm mx-auto leading-relaxed">
          {subtitle || (
            <>
              Drag &amp; drop here, or <span className="text-indigo-600 font-semibold group-hover:underline">browse</span> to begin.
            </>
          )}
        </p>
        {chips && chips.length > 0 && (
          <div className="mt-6 flex justify-center flex-wrap gap-3 text-[10px] font-bold text-slate-400">
            {chips.map(c => (
              <span key={c} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100/80 rounded-xl">
                {c}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
