import React, { useState, useEffect } from 'react';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
import { format } from 'date-fns';
import { Sidebar } from './components/Sidebar';
import { DocumentViewer } from './components/DocumentViewer';
import { DocumentFile, SignatureState, DateState, SavedAsset, TextInstance } from './types';
import { FileImage, FileSignature, Calendar, Settings, Image as ImageIcon, PenTool } from 'lucide-react';
import { removeImageBackground, downloadBlob, isPageInRange } from './utils';
import { Organize } from './components/Organize';
import { Compress } from './components/Compress';
import { Convert } from './components/Convert';

import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'Fill & Sign' | 'Organize' | 'Compress' | 'Convert'>('Fill & Sign');
  const [documentFile, setDocumentFile] = useState<DocumentFile | null>(null);
  const [savedAssets, setSavedAssets] = useState<SavedAsset[]>(() => {
    try {
      const saved = localStorage.getItem('signflow_saved_signatures');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });
  const [signature, setSignature] = useState<SignatureState | null>(null);
  const [dateState, setDateState] = useState<DateState>({
    enabled: false,
    format: 'MMMM do, yyyy',
    pos: { x: 50, y: 50, width: 200, height: 30 },
    value: new Date(),
    fontSize: 16,
  });
  const [texts, setTexts] = useState<TextInstance[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Apply background removal when tolerance changes
  useEffect(() => {
    if (!signature) return;
    
    let isMounted = true;
    const processImg = async () => {
      try {
        const processedUrl = await removeImageBackground(
          signature.originalUrl,
          signature.bgRemovalTolerance,
          signature.tintColor
        );
        if (isMounted) {
          setSignature(prev => prev ? { ...prev, url: processedUrl } : null);
        }
      } catch (err) {
        console.error("Failed to remove bg", err);
      }
    };
    
    // Add a small debounce if needed, or directly process
    const timer = setTimeout(processImg, 150);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [signature?.bgRemovalTolerance, signature?.originalUrl, signature?.tintColor]);

  const handleUploadDoc = (file: File) => {
    const isPdf = file.type === 'application/pdf';
    setDocumentFile({
      type: isPdf ? 'pdf' : 'image',
      name: file.name,
      url: URL.createObjectURL(file),
      file,
    });
  };

  const handleUploadSig = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      if (!url) return;
      const img = new Image();
      img.src = url;
      img.onload = () => {
        const aspectRatio = img.width / img.height;
        const newAsset: SavedAsset = {
          id: crypto.randomUUID(),
          url,
          originalUrl: url,
          aspectRatio,
        };

        setSavedAssets(prev => {
          const updated = [...prev, newAsset];
          try {
            localStorage.setItem('signflow_saved_signatures', JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });

        // Set as active signature
        setSignature(prev => ({
          url: newAsset.url,
          originalUrl: newAsset.originalUrl,
          bgRemovalTolerance: 50,
          pos: { x: 100, y: 100, width: 150, height: 150 / aspectRatio },
          applyMode: 'single',
          customPages: '',
          excludedPages: '',
          instances: prev ? prev.instances : [],
          aspectRatio: newAsset.aspectRatio,
        }));
      };
    };
    reader.readAsDataURL(file);
  };

  const handleDownload = async () => {
    if (!documentFile || !signature) return;
    setIsExporting(true);

    try {
      const container = document.getElementById('document-canvas-container');
      if (!container) throw new Error("Could not find document container");
      
      const displayWidth = container.clientWidth;
      const displayHeight = container.clientHeight;

      if (documentFile.type === 'pdf') {
        const arrayBuffer = await documentFile.file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        
        // Fetch and embed all unique signature image bytes
        const allUrls: string[] = Array.from(new Set(signature.instances.map(i => i.url || signature.url)));
        if (allUrls.length === 0) allUrls.push(signature.url); // fallback
        
        const embeddedImages = new Map();
        for (const url of allUrls) {
          const sigRes = await fetch(url);
          const sigArrayBuffer = await sigRes.arrayBuffer();
          let embeddedImage;
          try {
            embeddedImage = await pdfDoc.embedPng(sigArrayBuffer);
          } catch (e) {
            embeddedImage = await pdfDoc.embedJpg(sigArrayBuffer);
          }
          embeddedImages.set(url, embeddedImage);
        }

        const pages = pdfDoc.getPages();
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        // Load document into pdfjs to get exact viewports for mapping
        const pdfjsDoc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;

        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          const pdfjsPage = await pdfjsDoc.getPage(i + 1);
          // Get the viewport at scale=1 (native PDF size)
          const viewport = pdfjsPage.getViewport({ scale: 1.0 });
          const rotation = page.getRotation().angle;

          signature.instances.forEach(instance => {
            if (signature.applyMode === 'all') {
              if (isPageInRange(signature.excludedPages, i + 1)) return;
            } else if (signature.applyMode === 'custom') {
              if (!isPageInRange(signature.customPages, i + 1)) return;
            } else {
              if (instance.pageIndex !== i + 1) return;
            }

            const instCanvasWidth = instance.canvasWidth || displayWidth;
            const instCanvasHeight = instance.canvasHeight || displayHeight;

            // Map visual coordinates to unscaled PDF visual space
            const scaleX = viewport.width / instCanvasWidth;
            const scaleY = viewport.height / instCanvasHeight;

            const pdfVisX = instance.pos.x * scaleX;
            const pdfVisY = instance.pos.y * scaleY;
            const pdfVisW = instance.pos.width * scaleX;
            const pdfVisH = instance.pos.height * scaleY;

            // Use instance specific aspect ratio
            const instAspect = instance.aspectRatio || signature.aspectRatio;

            // Apply object-contain logic to match HTML img behavior
            let drawW = pdfVisW;
            let drawH = pdfVisH;
            let drawX = pdfVisX;
            let drawY = pdfVisY;

            if (instAspect) {
              const boxRatio = pdfVisW / pdfVisH;
              if (instAspect > boxRatio) {
                drawW = pdfVisW;
                drawH = pdfVisW / instAspect;
                drawY = pdfVisY + (pdfVisH - drawH) / 2;
              } else {
                drawH = pdfVisH;
                drawW = pdfVisH * instAspect;
                drawX = pdfVisX + (pdfVisW - drawW) / 2;
              }
            }

            // Unrotated visual bounds
            const cx = drawX + drawW / 2;
            const cy = drawY + drawH / 2;
            
            // Map the visual center to the absolute native PDF center
            const pdfCenter = viewport.convertToPdfPoint(cx, cy);
            
            // Determine the native rotation: HTML rotation is clockwise (visual)
            // Page intrinsic rotation (rotation) also rotates clockwise conceptually in PDF coords
            // pdf-lib's drawImage rotate takes counter-clockwise degrees.
            const totalRotationDeg = -rotation - (instance.rotation || 0);
            const totalRotationRad = totalRotationDeg * Math.PI / 180;
            
            // The origin of page.drawImage is its unrotated bottom-left corner.
            // We need to find (finalX, finalY) such that after applying totalRotationRad (counter-clockwise),
            // the center of the image lands EXACTLY at pdfCenter.
            // Vector from bottom-left to center is (drawW/2, drawH/2).
            // Rotate this vector by totalRotationRad:
            const dx = (drawW / 2) * Math.cos(totalRotationRad) - (drawH / 2) * Math.sin(totalRotationRad);
            const dy = (drawW / 2) * Math.sin(totalRotationRad) + (drawH / 2) * Math.cos(totalRotationRad);
            
            const finalX = pdfCenter[0] - dx;
            const finalY = pdfCenter[1] - dy;

            const imgToDraw = embeddedImages.get(instance.url || signature.url);

            if (imgToDraw) {
              page.drawImage(imgToDraw, {
                x: finalX,
                y: finalY,
                width: drawW,
                height: drawH,
                rotate: degrees(totalRotationDeg),
              });
            }
          });

          if (dateState.enabled) {
            const dateStr = format(dateState.value, dateState.format);
            const scaleX = viewport.width / displayWidth;
            const scaleY = viewport.height / displayHeight;
            
            const pdfVisX = dateState.pos.x * scaleX;
            const pdfVisY = dateState.pos.y * scaleY;
            const pdfVisH = dateState.pos.height * scaleY;

            // Calculate font size
            const fontSize = (dateState.fontSize || 16) * scaleY; 

            // Text is drawn from the baseline (bottom-left)
            const visualBottomLeft = viewport.convertToPdfPoint(pdfVisX, pdfVisY + pdfVisH);
            
            page.drawText(dateStr, {
              x: visualBottomLeft[0],
              y: visualBottomLeft[1] + (pdfVisH * 0.15),
              size: fontSize,
              font: helveticaFont,
              color: rgb(0.1, 0.1, 0.1),
              rotate: degrees(-rotation),
            });
          }

          // Render custom texts
          texts.forEach(text => {
            if (text.pageIndex !== i + 1) return;
            
            const instCanvasWidth = text.canvasWidth || displayWidth;
            const instCanvasHeight = text.canvasHeight || displayHeight;

            const scaleX = viewport.width / instCanvasWidth;
            const scaleY = viewport.height / instCanvasHeight;

            const pdfVisX = text.pos.x * scaleX;
            const pdfVisY = text.pos.y * scaleY;
            const pdfVisW = text.pos.width * scaleX;
            const pdfVisH = text.pos.height * scaleY;

            // Parse hex color 
            const hex = text.color.replace('#', '');
            const r = parseInt(hex.substring(0,2), 16) / 255 || 0;
            const g = parseInt(hex.substring(2,4), 16) / 255 || 0;
            const b = parseInt(hex.substring(4,6), 16) / 255 || 0;

            const fontSize = text.fontSize * scaleY; // naive scaling

            // Approximate line wrapping for text-area (splitting by newline)
            const lines = text.text.split('\n');
            const lineHeight = fontSize * 1.2;

            for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
              const line = lines[lineIdx];
              // Y is drawn from bottom up, so add descent compensation and offset by lineIdx
              const visualBottomLeft = viewport.convertToPdfPoint(pdfVisX, pdfVisY + (lineIdx * lineHeight) + fontSize);
              page.drawText(line, {
                x: visualBottomLeft[0],
                y: visualBottomLeft[1],
                size: fontSize,
                font: helveticaFont,
                color: rgb(r, g, b),
                rotate: degrees(-rotation),
              });
            }
          });
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        downloadBlob(blob, `signed_${documentFile.name}`);
        
      } else {
        // Image processing
        const img = new Image();
        img.src = documentFile.url;
        await new Promise(resolve => img.onload = resolve);

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Could not create canvas context");

        ctx.drawImage(img, 0, 0);

        const scaleX = img.width / displayWidth;
        const scaleY = img.height / displayHeight;

        // Draw Signatures
        const allUrls: string[] = Array.from(new Set(signature.instances.map(i => i.url || signature.url)));
        if (allUrls.length === 0) allUrls.push(signature.url);

        const loadedImages = new Map();
        for (const url of allUrls) {
          const sigImg = new Image();
          sigImg.src = url;
          await new Promise((resolve, reject) => {
             sigImg.onload = resolve;
             sigImg.onerror = reject;
          });
          loadedImages.set(url, sigImg);
        }

        signature.instances.forEach(instance => {
          if (signature.applyMode === 'all') {
            if (isPageInRange(signature.excludedPages, 1)) return;
          } else if (signature.applyMode === 'custom') {
            if (!isPageInRange(signature.customPages, 1)) return;
          } else {
            if (instance.pageIndex !== 1) return;
          }

          const instCanvasWidth = instance.canvasWidth || displayWidth;
          const instCanvasHeight = instance.canvasHeight || displayHeight;

          const normX = instance.pos.x / instCanvasWidth;
          const normY = instance.pos.y / instCanvasHeight;
          const normW = instance.pos.width / instCanvasWidth;
          const normH = instance.pos.height / instCanvasHeight;

          const imgToDraw = loadedImages.get(instance.url || signature.url);
          if (imgToDraw) {
            ctx.save();
            const drawX = normX * img.width;
            const drawY = normY * img.height;
            const drawW = normW * img.width;
            const drawH = normH * img.height;
            const cx = drawX + drawW / 2;
            const cy = drawY + drawH / 2;
            ctx.translate(cx, cy);
            ctx.rotate((instance.rotation || 0) * Math.PI / 180);
            ctx.drawImage(
              imgToDraw,
              -drawW / 2,
              -drawH / 2,
              drawW,
              drawH
            );
            ctx.restore();
          }
        });

        // Draw Date
        if (dateState.enabled) {
          const instCanvasWidth = displayWidth;
          const instCanvasHeight = displayHeight;
          const normX = dateState.pos.x / instCanvasWidth;
          const normY = dateState.pos.y / instCanvasHeight;
          const normH = dateState.pos.height / instCanvasHeight;

          const fontSize = normH * img.height * 0.7;
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.fillStyle = '#1e293b';
          // Canvas text origin is bottom-left of the text bounding box roughly
          ctx.fillText(
            format(dateState.value, dateState.format),
            normX * img.width,
            (normY * img.height) + fontSize + (fontSize * 0.2) // slight baseline adjustment
          );
        }

        canvas.toBlob((blob) => {
          if (blob) {
            downloadBlob(blob, `signed_${documentFile.name.replace(/\.[^/.]+$/, "")}.png`);
          }
        }, 'image/png');
      }
    } catch (err) {
      console.error("Export error", err);
      alert("An error occurred while exporting the document.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-slate-50 font-sans text-slate-800 overflow-hidden">
      {/* Top Header */}
      <header className="h-16 md:h-18 px-4 md:px-8 flex items-center justify-between z-20 shrink-0 bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-3 md:gap-5 w-full md:w-auto">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="w-8 h-8 md:w-10 md:h-10 shrink-0 flex items-center justify-center p-0.5 rounded-xl border border-indigo-100 shadow-sm bg-gradient-to-tr from-white to-indigo-50"
          >
            <img src="/favicon.svg" alt="Logo" className="w-full h-full object-contain" />
          </motion.div>
          
          <h1 className="text-base md:text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 hidden sm:block">
            SignFlow <span className="font-medium text-slate-400">Studio</span>
          </h1>
          <div className="h-5 w-[1px] bg-slate-200 mx-1 md:mx-3 hidden sm:block"></div>
          <span className="text-slate-500 font-medium text-xs md:text-sm truncate flex-1 md:flex-none md:max-w-[300px]">
             {documentFile ? documentFile.name : 'No document selected'}
          </span>
        </div>
        
        {/* Desktop Navigation */}
        <div className="hidden md:flex gap-1 ml-8 mr-auto bg-slate-100/80 backdrop-blur-md p-1 rounded-xl shadow-inner">
           {['Fill & Sign', 'Organize', 'Compress', 'Convert'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`relative px-4 py-1.5 text-sm font-semibold rounded-lg transition-all duration-300 ${activeTab === tab ? 'text-indigo-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'}`}
            >
              {activeTab === tab && (
                <motion.div layoutId="navIndicator" className="absolute inset-0 bg-white rounded-lg shadow-sm border border-slate-200/50 pointer-events-none" />
              )}
              <span className="relative z-10">{tab}</span>
            </button>
          ))}
        </div>

        {/* Global Action Button */}
        <div className="flex items-center gap-2 md:gap-3 ml-2">
          {activeTab === 'Fill & Sign' && (
            <>
              <button 
                onClick={handleDownload}
                disabled={!documentFile || !signature || isExporting}
                className="group relative px-4 md:px-6 py-2 md:py-2.5 text-xs md:text-sm font-bold text-white shadow-[0_4px_14px_0_rgb(79,70,229,39%)] hover:shadow-[0_6px_20px_rgba(79,70,229,23%)] disabled:shadow-none bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                {isExporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span className="hidden sm:inline">Exporting...</span>
                  </>
                ) : (
                  <>
                     <span className="hidden sm:inline">Finish & Download</span>
                     <span className="sm:hidden">Save</span>
                  </>
                )}
                </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative mb-14 md:mb-0">
        {activeTab === 'Fill & Sign' && (
          <>
            {/* Desktop Sidebar OR Mobile Drawer */}
            <AnimatePresence>
              {(isMobileSidebarOpen || window.innerWidth >= 768) && (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm ${isMobileSidebarOpen ? 'block' : 'hidden md:block'}`}
                    onClick={() => setIsMobileSidebarOpen(false)}
                  />
                  <motion.div 
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                    className={`fixed inset-x-0 bottom-0 top-16 z-50 md:z-auto bg-white/95 backdrop-blur-2xl md:bg-white rounded-t-3xl md:rounded-none md:relative md:h-full md:w-auto overflow-hidden flex flex-col shadow-[0_-8px_30px_rgba(0,0,0,0.1)] md:shadow-none ${isMobileSidebarOpen ? 'flex' : 'hidden md:flex'}`}
                  >
                    {/* Mobile Handle / Header */}
                    <div className="md:hidden flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
                       <h3 className="font-bold text-slate-800 text-lg">Tools</h3>
                       <button onClick={() => setIsMobileSidebarOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100/80 text-slate-500 hover:bg-slate-200 transition-colors">✕</button>
                    </div>
                    
                    <Sidebar 
                      onUploadDoc={handleUploadDoc}
                  onUploadSig={handleUploadSig}
                  bgTolerance={signature?.bgRemovalTolerance || 0}
                  setBgTolerance={(val) => setSignature(p => p ? { ...p, bgRemovalTolerance: val } : null)}
                  tintColor={signature?.tintColor}
                  setTintColor={(val) => setSignature(p => p ? { ...p, tintColor: val } : null)}
                  applyMode={signature?.applyMode || 'single'}
                  setApplyMode={(val) => setSignature(p => p ? { ...p, applyMode: val } : null)}
                  customPages={signature?.customPages || ''}
                  setCustomPages={(val) => setSignature(p => p ? { ...p, customPages: val } : null)}
                  excludedPages={signature?.excludedPages || ''}
                  setExcludedPages={(val) => setSignature(p => p ? { ...p, excludedPages: val } : null)}
                  savedAssets={savedAssets}
                  onSelectAsset={(asset) => setSignature(prev => ({
                    url: asset.url,
                    originalUrl: asset.originalUrl,
                    bgRemovalTolerance: 50,
                    pos: { x: 100, y: 100, width: 150, height: 150 / asset.aspectRatio },
                    applyMode: prev ? prev.applyMode : 'single',
                    customPages: prev ? prev.customPages : '',
                    excludedPages: prev ? prev.excludedPages : '',
                    instances: prev ? prev.instances : [],
                    aspectRatio: asset.aspectRatio,
                  }))}
                  dateEnabled={dateState.enabled}
                  setDateEnabled={(val) => setDateState(p => ({ ...p, enabled: val }))}
                  onDownload={handleDownload}
                  hasDocument={!!documentFile}
                  hasSignature={!!signature}
                  signatureUrl={signature?.url}
                  onAddText={() => setTexts(prev => [...prev, {
                    id: Math.random().toString(36).substring(7),
                    text: 'Double click to edit',
                    pageIndex: 1, // Will be overridden on drop
                    pos: { x: 50, y: 50, width: 200, height: 40 },
                    fontSize: 24,
                    color: '#000000',
                  }])}
                />
                  </motion.div>
                </>
              )}
            </AnimatePresence>
            
            <main className="flex-1 bg-slate-50/50 p-2 md:p-6 lg:p-8 flex flex-col justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none mix-blend-multiply border-l border-white/50" />
              <DocumentViewer 
                document={documentFile}
                signature={signature}
                setSignature={setSignature}
                dateState={dateState}
                setDateState={setDateState}
                texts={texts}
                setTexts={setTexts}
              />
              
              {/* Mobile FAB to open tools */}
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="md:hidden absolute bottom-[6rem] right-4 w-14 h-14 bg-gradient-to-tr from-indigo-600 to-violet-600 text-white rounded-full shadow-[0_8px_25px_rgb(79,70,229,0.5)] flex items-center justify-center z-10 hover:shadow-[0_8px_30px_rgb(79,70,229,0.7)] transition-shadow"
                onClick={() => setIsMobileSidebarOpen(true)}
              >
                <PenTool strokeWidth={2.5} size={24} className="ml-0.5" />
              </motion.button>
            </main>
          </>
        )}
        {activeTab === 'Organize' && <Organize />}
        {activeTab === 'Compress' && <Compress />}
        {activeTab === 'Convert' && <Convert />}
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden shrink-0 w-full bg-white/90 backdrop-blur-xl border-t border-slate-100 flex items-center justify-around z-30 px-2 pb-safe pt-2 min-h-[4.5rem] shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.05)]">
        {[
          { id: 'Fill & Sign', icon: '✨', label: 'Sign' },
          { id: 'Organize', icon: '📑', label: 'Organize' },
          { id: 'Compress', icon: '📦', label: 'Compress' },
          { id: 'Convert', icon: '🔄', label: 'Convert' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all ${activeTab === tab.id ? 'text-indigo-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <span className={`text-xl ${activeTab === tab.id ? 'opacity-100' : 'opacity-80 grayscale'}`}>{tab.icon}</span>
            <span className={`text-[10px] ${activeTab === tab.id ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
