import React, { useState } from 'react';
import { PDFDocument, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { downloadBlob } from '../utils';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
      className={`relative flex flex-col items-center bg-white border ${isDragging ? 'border-blue-500 shadow-xl scale-105' : 'border-slate-200 hover:border-blue-300'} rounded-lg transition-colors cursor-grab w-36 shrink-0 group`}
      {...attributes}
      {...listeners}
    >
      <div className="w-full h-44 p-2 bg-slate-50 flex items-center justify-center relative rounded-t-lg">
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
      <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
        <button 
          onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
          className="w-6 h-6 bg-white/90 backdrop-blur border border-slate-200 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors shadow-sm"
          onPointerDown={(e) => e.stopPropagation()}
          title="Remove page"
        >
          ✕
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onPreview(item); }}
          className="w-6 h-6 bg-white/90 backdrop-blur border border-slate-200 rounded-full hover:bg-blue-50 text-slate-400 hover:text-blue-500 flex items-center justify-center transition-colors shadow-sm"
          onPointerDown={(e) => e.stopPropagation()}
          title="Preview page"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onRotate(item.id); }}
          className="w-6 h-6 bg-white/90 backdrop-blur border border-slate-200 rounded-full hover:bg-green-50 text-slate-400 hover:text-green-600 flex items-center justify-center transition-colors shadow-sm"
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
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setIsProcessing(true);
      const newItems: PdfPageItem[] = [];
      
      try {
        // Ensure worker is configured for pdfjs
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
        }

        for (let i = 0; i < e.target.files.length; i++) {
          const file = e.target.files[i];
          if (file.type !== 'application/pdf') continue;
          
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          const totalPages = pdf.numPages;
          
          for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.2 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              await page.render({ canvasContext: ctx, viewport }).promise;
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

  return (
    <div className="flex-1 bg-slate-100 p-4 md:p-8 flex flex-col items-center overflow-y-auto">
      <div className="max-w-5xl w-full">
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-6 text-slate-800">
          <div>
            <h2 className="text-xl md:text-2xl font-bold mb-1">Organize PDF Pages</h2>
            <p className="text-sm md:text-base text-slate-600">Drag to reorder. Click ✕ to remove unwanted pages. Merge into a new PDF.</p>
          </div>
          <div className="flex flex-wrap gap-2 md:gap-3">
            {items.length > 0 && (
               <button 
                onClick={clearAll}
                disabled={isProcessing}
                className="px-3 md:px-4 py-1.5 md:py-2 bg-white text-slate-700 border border-slate-300 rounded-lg text-xs md:text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50"
              >
                Clear All
              </button>
            )}
            <div className="relative">
              <input 
                type="file" 
                multiple 
                accept="application/pdf"
                onChange={handleUpload}
                disabled={isProcessing}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                title="Add More PDFs"
              />
              <button 
                disabled={isProcessing}
                className="px-3 md:px-4 py-1.5 md:py-2 bg-slate-200 text-slate-700 rounded-lg text-xs md:text-sm font-medium hover:bg-slate-300 transition disabled:opacity-50 flex items-center gap-2 pointer-events-none"
              >
                <span>+ Add PDFs</span>
              </button>
            </div>
            {items.length > 0 && (
              <button 
                onClick={handleMerge}
                disabled={isProcessing}
                className="px-4 md:px-6 py-1.5 md:py-2 bg-blue-600 text-white rounded-lg text-xs md:text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 shadow-sm"
              >
                {isProcessing ? 'Processing...' : 'Save PDF'}
              </button>
            )}
          </div>
        </div>

        {items.length === 0 && !isProcessing && (
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-16 text-center flex flex-col items-center justify-center bg-white relative group hover:border-blue-400 transition-colors mb-6">
            <input 
              type="file" 
              multiple 
              accept="application/pdf"
              onChange={handleUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-3xl mb-4">
              📑
            </div>
            <p className="font-semibold text-lg text-slate-700">Upload PDF files to organize pages</p>
            <p className="text-slate-500 mt-2">Drag and drop files here, or click to browse</p>
          </div>
        )}

        {isProcessing && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-slate-600 font-medium">Extracting pages...</p>
          </div>
        )}

        {items.length > 0 && (
          <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm min-h-[400px]">
             {isProcessing && (
               <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-xl">
                 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                 <p className="text-slate-800 font-medium bg-white px-4 py-2 rounded shadow">Processing documents...</p>
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
      </div>

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
    </div>
  );
}

