import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Combine, ArrowUp, ArrowDown, X, Plus } from 'lucide-react';
import { downloadBlob } from '../utils';
import { ToolLayout, ToolField, ToolInput, PrimaryButton } from './shared/ToolLayout';
import { UploadDropzone } from './shared/UploadDropzone';

interface MergeItem {
  id: string;
  file: File;
}

let idCounter = 0;
const nextId = () => `m${++idCounter}`;

export function Merge() {
  const [items, setItems] = useState<MergeItem[]>([]);
  const [fileName, setFileName] = useState('merged.pdf');
  const [isProcessing, setIsProcessing] = useState(false);

  const addFiles = (files: FileList | File[]) => {
    const accepted = Array.from(files).filter(
      f => f.type === 'application/pdf' || f.type.startsWith('image/')
    );
    setItems(prev => [...prev, ...accepted.map(f => ({ id: nextId(), file: f }))]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = '';
  };

  const move = (index: number, dir: -1 | 1) => {
    setItems(prev => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };
  const remove = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  const handleMerge = async () => {
    if (items.length < 2) return;
    setIsProcessing(true);
    try {
      const merged = await PDFDocument.create();
      for (const item of items) {
        const bytes = await item.file.arrayBuffer();
        if (item.file.type === 'application/pdf') {
          const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
          const pages = await merged.copyPages(src, src.getPageIndices());
          pages.forEach(p => merged.addPage(p));
        } else {
          // image → full-page
          const img = item.file.type.includes('png')
            ? await merged.embedPng(bytes)
            : await merged.embedJpg(bytes);
          const page = merged.addPage([img.width, img.height]);
          page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        }
      }
      const out = await merged.save();
      const name = fileName.trim().endsWith('.pdf') ? fileName.trim() : `${fileName.trim() || 'merged'}.pdf`;
      downloadBlob(new Blob([out], { type: 'application/pdf' }), name);
    } catch (e) {
      console.error(e);
      alert('Error merging files. One of them may be password-protected.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatSize = (b: number) => (b >= 1024 * 1024 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1024).toFixed(0) + ' KB');

  const panel = (
    <>
      <ToolField label="Output filename">
        <ToolInput value={fileName} onChange={e => setFileName(e.target.value)} placeholder="merged.pdf" />
      </ToolField>

      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Files</span>
        <label className="relative flex items-center justify-center gap-2 w-full px-3 py-2.5 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg cursor-pointer hover:bg-indigo-100 transition-colors">
          <input
            type="file"
            accept="application/pdf,image/*"
            multiple
            onChange={handleFileInput}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <Plus size={16} /> Add more files
        </label>
        <p className="text-[10px] text-slate-400 font-medium">
          {items.length === 0
            ? 'No files yet — add at least two to merge.'
            : items.length === 1
            ? '1 file added — add at least one more to merge.'
            : `${items.length} files ready to merge.`}
        </p>
      </div>
    </>
  );

  return (
    <ToolLayout
      icon={<Combine size={20} strokeWidth={2} />}
      title="Merge Files"
      description="Combine PDFs and images into one document — add and reorder freely."
      accentClass="from-emerald-500 to-teal-500"
      panel={panel}
      panelFooter={
        <PrimaryButton onClick={handleMerge} disabled={items.length < 2} loading={isProcessing} loadingText="Merging…">
          <Combine size={16} /> Merge PDFs
        </PrimaryButton>
      }
    >
      {items.length === 0 ? (
        <UploadDropzone
          multiple
          onFiles={fs => addFiles(fs)}
          accept="application/pdf,image/*"
          title="Add PDFs to merge"
          subtitle={
            <>
              Drag &amp; drop PDFs or images here, or <span className="text-indigo-600 font-semibold">browse</span>. Reorder them however you like.
            </>
          }
          chips={['📄 PDF', '🖼️ PNG / JPG']}
          icon={<Combine className="w-9 h-9" strokeWidth={2} />}
        />
      ) : (
        <div className="flex-1 p-4 md:p-8">
          <div className="max-w-2xl mx-auto space-y-2">
            {items.map((item, i) => (
              <div key={item.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm">
                <span className="w-6 text-center text-xs font-bold text-slate-400">{i + 1}</span>
                <span className="text-lg shrink-0">{item.file.type.startsWith('image/') ? '🖼️' : '📄'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700 truncate" title={item.file.name}>{item.file.name}</div>
                  <div className="text-xs text-slate-400">{formatSize(item.file.size)}</div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="w-10 h-10 md:w-auto md:h-auto md:p-1.5 flex items-center justify-center text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors"><ArrowUp size={16} /></button>
                  <button onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down" className="w-10 h-10 md:w-auto md:h-auto md:p-1.5 flex items-center justify-center text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors"><ArrowDown size={16} /></button>
                  <button onClick={() => remove(item.id)} aria-label="Remove file" className="w-10 h-10 md:w-auto md:h-auto md:p-1.5 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors"><X size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </ToolLayout>
  );
}
