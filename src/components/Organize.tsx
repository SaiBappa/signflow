import React, { useState } from 'react';
import { PDFDocument, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { LayoutGrid, Download } from 'lucide-react';
import { downloadBlob } from '../utils';
import { ToolLayout, PrimaryButton } from './shared/ToolLayout';
import { UploadDropzone } from './shared/UploadDropzone';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Configure worker once at module level (not inside callbacks)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

interface PdfPageItem {
  id: string;
  file: File;
  pageIndex: number;
  thumbnailUrl: string;
  originalFileName: string;
  rotation: number;
}

function SortablePageItem({ item, onRemove, onPreview, onRotate }: { item: PdfPageItem, onRemove: (id: string) => void, onPreview: (item: PdfPageItem) => void, onRotate: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex flex-col items-center bg-white border ${isDragging ? 'border-indigo-500 shadow-xl scale-105' : 'border-slate-200 hover:border-indigo-300'} rounded-lg transition-colors cursor-grab touch-none select-none w-28 sm:w-36 shrink-0 group`}
      {...attributes}
      {...listeners}
    >
      <div className="w-full h-36 sm:h-44 p-2 bg-slate-50 flex items-center justify-center relative rounded-t-lg">
        <img 
          src={item.thumbnailUrl} 
          className="max-w-full max-h-full object-contain pointer-events-none shadow-sm border border-slate-200 bg-white transition-transform duration-200" 
          style={{ transform: `rotate(${item.rotation}deg)` }}
          alt={`Page ${item.pageIndex + 1}`} 
        />
        <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm z-10">
          p.{item.pageIndex + 1}
        </div>
      </div>
      
      <div className="w-full p-2 border-t border-slate-200 bg-white rounded-b-lg overflow-hidden flex flex-col items-center">
        <span className="text-[10px] text-slate-600 truncate w-full text-center" title={item.originalFileName}>
          {item.originalFileName}
        </span>
      </div>
      
      {/* Action Buttons */}
      <div className="absolute top-1 right-1 flex flex-col gap-1.5 md:gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-20">
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
          className="w-9 h-9 md:w-6 md:h-6 bg-white/90 backdrop-blur border border-slate-200 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors shadow-sm touch-auto"
          onPointerDown={(e) => e.stopPropagation()}
          title="Remove page"
        >
          ✕
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onPreview(item); }}
          className="w-9 h-9 md:w-6 md:h-6 bg-white/90 backdrop-blur border border-slate-200 rounded-full hover:bg-indigo-50 text-slate-400 hover:text-indigo-500 flex items-center justify-center transition-colors shadow-sm touch-auto"
          onPointerDown={(e) => e.stopPropagation()}
          title="Preview page"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRotate(item.id); }}
          className="w-9 h-9 md:w-6 md:h-6 bg-white/90 backdrop-blur border border-slate-200 rounded-full hover:bg-green-50 text-slate-400 hover:text-green-600 flex items-center justify-center transition-colors shadow-sm touch-auto"
          onPointerDown={(e) => e.stopPropagation()}
          title="Rotate page"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
        </button>
      </div>
    </div>
  );
}

export function Organize() {
  const [items, setItems] = useState<PdfPageItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewItem, setPreviewItem] = useState<PdfPageItem | null>(null);

  const sensors = useSensors(
    // Require a small drag distance before activating so taps on the
    // rotate/remove/preview buttons register on touch instead of starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setIsProcessing(true);
      const newItems: PdfPageItem[] = [];
      
      try {
        for (let i = 0; i < e.target.files.length; i++) {
          const file = e.target.files[i];
          if (file.type !== 'application/pdf') continue;
          
          const arrayBuffer = await file.arrayBuffer();
          // Wrap in Uint8Array — pdfjs-dist v5 transfers the buffer to the worker
          // thread which detaches it; a Uint8Array view ensures safe ownership.
          const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
          const totalPages = pdf.numPages;
          
          for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.2 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              await page.render({ canvas, canvasContext: ctx, viewport }).promise;
              const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
              newItems.push({
                id: `${file.name}-${pageNum}-${Math.random().toString(36).substring(7)}`,
                file,
                pageIndex: pageNum - 1,
                thumbnailUrl,
                originalFileName: file.name,
                rotation: 0
              });
            }
          }
        }
        setItems(prev => [...prev, ...newItems]);
      } catch (err) {
        console.error(err);
        alert('Error parsing PDFs. Make sure they are valid PDF files.');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };
  
  const rotateItem = (id: string) => {
    setItems(items.map(i => i.id === id ? { ...i, rotation: (i.rotation + 90) % 360 } : i));
  };
  
  const clearAll = () => {
    if (confirm("Clear all pages?")) {
      setItems([]);
    }
  };

  const handleMerge = async () => {
    if (items.length === 0) return;
    
    setIsProcessing(true);
    try {
      const mergedPdf = await PDFDocument.create();
      const loadedPdfs = new Map<File, PDFDocument>();
      
      for (const item of items) {
        let pdfDoc = loadedPdfs.get(item.file);
        if (!pdfDoc) {
          const bytes = await item.file.arrayBuffer();
          pdfDoc = await PDFDocument.load(bytes);
          loadedPdfs.set(item.file, pdfDoc);
        }
        
        const [copiedPage] = await mergedPdf.copyPages(pdfDoc, [item.pageIndex]);
        if (item.rotation) {
          const currentRotation = copiedPage.getRotation().angle;
          copiedPage.setRotation(degrees((currentRotation + item.rotation) % 360));
        }
        mergedPdf.addPage(copiedPage);
      }
      
      if (mergedPdf.getPageCount() === 0) {
        alert("Resulting PDF would be empty.");
        return;
      }
      
      const pdfBytes = await mergedPdf.save();
      const outputName = 'organized.pdf';
      downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), outputName);
    } catch (e) {
      console.error(e);
      alert("Error organizing PDFs");
    } finally {
      setIsProcessing(false);
    }
  };

  const fileInputClass =
    'absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed';

  const panel = (
    <>
      <div className="relative">
        <input
          type="file"
          multiple
          accept="application/pdf"
          onChange={handleUpload}
          disabled={isProcessing}
          className={fileInputClass}
          title="Add More PDFs"
        />
        <button
          disabled={isProcessing}
          className="w-full px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition disabled:opacity-50 flex items-center justify-center gap-2 pointer-events-none"
        >
          <span className="text-base leading-none">+</span> Add PDFs
        </button>
      </div>

      {items.length > 0 && (
        <button
          onClick={clearAll}
          disabled={isProcessing}
          className="w-full px-4 py-2.5 bg-white text-slate-700 border border-slate-300 rounded-xl text-sm font-bold hover:bg-slate-50 transition disabled:opacity-50"
        >
          Clear All
        </button>
      )}

      <p className="text-xs text-slate-400 font-medium leading-relaxed">
        Drag to reorder • hover a page to rotate/remove
      </p>

      {items.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-600">
          {items.length} {items.length === 1 ? 'page' : 'pages'}
        </div>
      )}
    </>
  );

  return (
    <ToolLayout
      icon={<LayoutGrid size={20} strokeWidth={2} />}
      title="Organize PDF Pages"
      description="Drag to reorder, rotate, or remove pages — then save a new PDF."
      accentClass="from-violet-500 to-purple-500"
      panel={panel}
      panelFooter={
        <PrimaryButton onClick={handleMerge} disabled={items.length === 0} loading={isProcessing} loadingText="Saving…">
          <Download size={16} /> Save PDF
        </PrimaryButton>
      }
    >
      {items.length === 0 && !isProcessing ? (
        <UploadDropzone
          multiple
          onFiles={fs => {
            const dt = new DataTransfer();
            fs.filter(f => f.type === 'application/pdf').forEach(f => dt.items.add(f));
            handleUpload({ target: { files: dt.files } } as React.ChangeEvent<HTMLInputElement>);
          }}
          accept="application/pdf"
          title="Add PDFs to organize"
          subtitle="Drag & drop PDFs here, or browse. Pages appear as a reorderable grid."
          chips={['📄 PDF']}
          icon={<LayoutGrid className="w-9 h-9" strokeWidth={2} />}
        />
      ) : isProcessing && items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-slate-600 font-medium">Extracting pages…</p>
        </div>
      ) : (
        <div className="relative flex-1 p-4 md:p-6 overflow-y-auto">
          {isProcessing && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
              <p className="text-slate-800 font-medium bg-white px-4 py-2 rounded shadow">Processing documents…</p>
            </div>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map(i => i.id)} strategy={rectSortingStrategy}>
              <div className="flex flex-wrap gap-4 items-start">
                {items.map(item => (
                  <SortablePageItem key={item.id} item={item} onRemove={removeItem} onPreview={setPreviewItem} onRotate={rotateItem} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Preview Modal */}
      {previewItem && (
        <div 
          className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center backdrop-blur-sm p-4"
          onClick={() => setPreviewItem(null)}
        >
          <div className="absolute top-4 right-4 z-[110]">
            <button 
              onClick={() => setPreviewItem(null)}
              className="w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur rounded-full text-white flex items-center justify-center transition-colors text-xl font-light"
            >
              ✕
            </button>
          </div>
          <div className="relative max-w-[90vw] max-h-[90vh] bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-100 p-3 border-b border-slate-200 flex justify-between items-center text-sm">
              <span className="font-semibold text-slate-700 truncate mr-4">{previewItem.originalFileName}</span>
              <span className="text-slate-500 font-medium bg-white px-2 py-1 rounded shadow-sm">Page {previewItem.pageIndex + 1}</span>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-slate-50 flex items-center justify-center">
              <img 
                src={previewItem.thumbnailUrl} 
                alt={`Preview of Page ${previewItem.pageIndex + 1}`} 
                className="max-h-[75vh] max-w-full object-contain shadow border border-slate-200 bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </ToolLayout>
  );
}

