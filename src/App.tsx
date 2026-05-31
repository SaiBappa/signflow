import React, { useState, useEffect } from 'react';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
import { DrawSignature } from './components/DrawSignature';
import { DocumentViewer } from './components/DocumentViewer';
import { DocumentFile, SignatureState, SavedAsset, TextInstance } from './types';
import { FileImage, FileSignature, Settings, Image as ImageIcon, FilePen, LayoutGrid, FileArchive, RefreshCw, Upload, PenTool, SlidersHorizontal, RotateCcw, Trash2, MoreVertical, Download, ShieldCheck } from 'lucide-react';
import { removeImageBackground, downloadBlob, isPageInRange, TEXT_FONTS, cn } from './utils';
import { Organize } from './components/Organize';
import { Compress } from './components/Compress';
import { Convert } from './components/Convert';
import Footer from './components/Footer';

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
  const [texts, setTexts] = useState<TextInstance[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isPlacementMode, setIsPlacementMode] = useState(false);
  const [placedForConfirmation, setPlacedForConfirmation] = useState(false);
  const [lastPlacedInstanceId, setLastPlacedInstanceId] = useState<string | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);

  const isMobile = () => window.innerWidth < 768;

  // Apply background removal when tolerance changes
  useEffect(() => {
    if (!signature) return;
    
    let isMounted = true;
    const processImg = async () => {
      try {
        const processedUrl = await removeImageBackground(
          signature.originalUrl,
          signature.bgRemovalTolerance,
          signature.tintColor,
          signature.bgRemovalMode || 'white'
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
  }, [signature?.bgRemovalTolerance, signature?.originalUrl, signature?.tintColor, signature?.bgRemovalMode]);

  const handleUploadDoc = (file: File) => {
    const isPdf = file.type === 'application/pdf';
    setDocumentFile({
      type: isPdf ? 'pdf' : 'image',
      name: file.name,
      url: URL.createObjectURL(file),
      file,
    });
    // Clear existing signatures/texts when a new document is uploaded
    setSignature(null);
    setTexts([]);
    setIsPlacementMode(false);
    setPlacedForConfirmation(false);
    setLastPlacedInstanceId(null);
  };

  const handleClearSignatures = () => {
    setSignature(null);
    setTexts([]);
    setIsPlacementMode(false);
    setPlacedForConfirmation(false);
    setLastPlacedInstanceId(null);
    setShowMobileMenu(false);
  };

  const handleStartAgain = () => {
    setDocumentFile(null);
    setSignature(null);
    setTexts([]);
    setIsPlacementMode(false);
    setPlacedForConfirmation(false);
    setLastPlacedInstanceId(null);
    setShowMobileMenu(false);
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
          bgRemovalMode: 'white',
          pos: { x: 100, y: 100, width: 150, height: 150 / aspectRatio },
          applyMode: 'single',
          customPages: '',
          excludedPages: '',
          instances: prev ? prev.instances : [],
          aspectRatio: newAsset.aspectRatio,
        }));

        // On mobile: auto-close panel and enter placement mode
        if (isMobile()) {
          setIsMobileSidebarOpen(false);
          setIsPlacementMode(true);
          setPlacedForConfirmation(false);
          setLastPlacedInstanceId(null);
        }
      };
    };
    reader.readAsDataURL(file);
  };
  
  const handleDrawSave = (dataUrl: string) => {
    fetch(dataUrl)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], "drawn-signature.png", { type: "image/png" });
        handleUploadSig(file);
        setIsDrawing(false);
      });
  };

  const handleDeleteAsset = (id: string) => {
    setSavedAssets(prev => {
      const target = prev.find(a => a.id === id);
      const updated = prev.filter(a => a.id !== id);
      try {
        localStorage.setItem('signflow_saved_signatures', JSON.stringify(updated));
      } catch (e) {}
      // If the deleted asset is the active signature, clear or switch it.
      if (target) {
        setSignature(curr => {
          if (!curr || (curr.url !== target.url && curr.originalUrl !== target.originalUrl)) return curr;
          const next = updated[updated.length - 1];
          if (!next) return null;
          return {
            ...curr,
            url: next.url,
            originalUrl: next.originalUrl,
            aspectRatio: next.aspectRatio,
          };
        });
      }
      return updated;
    });
  };

  const handleDownload = async () => {
    if (!documentFile || !signature) return;
    setIsExporting(true);

    try {
      // Use the actual rendered page element (canvas/img), not its wrapper.
      // The wrapper container can be larger than the page it holds, which would
      // otherwise scale the signature/date/text placement and shift it on export.
      const pageEl = document.getElementById('document-canvas-content');
      const container = document.getElementById('document-canvas-container');
      if (!pageEl || !container) throw new Error("Could not find document page");

      const displayWidth = pageEl.clientWidth;
      const displayHeight = pageEl.clientHeight;

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
        // Embed each selectable text font once, keyed by its TEXT_FONTS value.
        const textFonts: Record<string, any> = {
          Helvetica: await pdfDoc.embedFont(StandardFonts.Helvetica),
          Times: await pdfDoc.embedFont(StandardFonts.TimesRoman),
          Courier: await pdfDoc.embedFont(StandardFonts.Courier),
        };

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
            const textFont = textFonts[text.fontFamily || 'Helvetica'] || textFonts.Helvetica;

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
                font: textFont,
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
                className="hidden md:flex group relative px-4 md:px-6 py-2 md:py-2.5 text-xs md:text-sm font-bold text-white shadow-[0_4px_14px_0_rgb(79,70,229,39%)] hover:shadow-[0_6px_20px_rgba(79,70,229,23%)] disabled:shadow-none bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed items-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                {isExporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span className="hidden sm:inline">Exporting...</span>
                  </>
                ) : (
                  <>
                     <span className="hidden sm:inline">Finish & Download</span>
                     <span className="sm:hidden">Download</span>
                  </>
                )}
                </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 overflow-hidden relative mb-14 md:mb-0">
        {activeTab === 'Fill & Sign' && (
          <>
            {!documentFile ? (
              /* ============================================================
                 1. EMPTY STATE / CENTRED UPLOAD DROPZONE
                 ============================================================ */
              <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative bg-gradient-to-b from-indigo-50/20 via-slate-50 to-indigo-50/10">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.06),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(139,92,246,0.05),transparent_50%)] pointer-events-none" />
                
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full max-w-xl bg-white/70 backdrop-blur-xl border border-slate-200/50 rounded-3xl p-8 md:p-12 text-center shadow-[0_20px_50px_-20px_rgba(79,70,229,0.15)] relative group hover:shadow-[0_25px_60px_-15px_rgba(79,70,229,0.22)] hover:border-indigo-200/80 transition-all duration-500"
                >
                  <input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    accept="application/pdf,image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadDoc(file);
                    }}
                  />
                  
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-[0_8px_25px_rgb(99,102,241,30%)] group-hover:scale-110 transition-transform duration-500 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
                    <Upload className="w-9 h-9 text-white animate-pulse" strokeWidth={2} />
                  </div>
                  
                  <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight leading-tight">
                    Upload your document
                  </h2>
                  <p className="mt-3 text-slate-500 text-sm font-medium max-w-sm mx-auto leading-relaxed">
                    Drag & drop your PDF or image here, or <span className="text-indigo-600 font-semibold group-hover:underline">browse</span> to start signing.
                  </p>
                  
                  <div className="mt-6 flex justify-center gap-3 text-[10px] font-bold text-slate-400">
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100/80 rounded-xl">📄 PDF</span>
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100/80 rounded-xl">🖼️ PNG / JPG</span>
                  </div>
                  
                  <div className="mt-8 border border-emerald-100/80 pt-4 pb-4 px-5 flex items-center justify-center gap-2.5 text-[10px] font-bold text-emerald-800 bg-emerald-50/40 rounded-2xl max-w-sm mx-auto">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={2.5} />
                    <span>100% secure. Processing is fully local in your browser.</span>
                  </div>
                </motion.div>
              </div>
            ) : (
              /* ============================================================
                 2. DOCUMENT PRESENT STATE - PREMIUM REDESIGN
                 ============================================================ */
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Horizontal Top Controller Bar */}
                <div className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-4 md:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 shadow-sm relative z-20">
                  
                  {/* Left Column: Active / Upload Signature */}
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {!signature ? (
                      /* Guided Signature Upload Area (Soft pulsing indigo outline) */
                      <div className="flex items-center gap-3 bg-gradient-to-r from-indigo-50/50 to-violet-50/30 border border-indigo-100/70 rounded-2xl p-2 pr-4 shadow-sm animate-pulse-subtle">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                          ✍️
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-extrabold text-indigo-900 leading-tight">Create your signature</p>
                          <div className="flex gap-3 mt-1.5">
                            <label className="text-[10px] text-indigo-600 font-bold hover:text-indigo-800 hover:underline cursor-pointer">
                              Upload File
                              <input 
                                type="file" 
                                className="hidden" 
                                accept="image/png,image/jpeg,image/webp" 
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleUploadSig(file);
                                }} 
                              />
                            </label>
                            <span className="text-[10px] text-indigo-200">|</span>
                            <button 
                              onClick={() => setIsDrawing(true)} 
                              className="text-[10px] text-indigo-600 font-bold hover:text-indigo-800 hover:underline flex items-center gap-0.5"
                            >
                              Draw Signature
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Glowing Active Signature Preview Box (Draggable) */
                      <div className="flex items-center gap-3">
                        <div 
                          className="h-14 w-32 border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-indigo-400 rounded-xl p-1.5 flex items-center justify-center cursor-grab active:cursor-grabbing group relative transition-all duration-300 shadow-sm"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("application/my-signature", "true");
                          }}
                        >
                          <img src={signature.url} className="max-h-full max-w-full object-contain mix-blend-multiply opacity-80 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-xl pointer-events-none transition-opacity">
                            <span className="text-[9px] font-bold text-indigo-700 bg-white/95 px-1.5 py-0.5 rounded shadow-sm border border-indigo-100">Drag me!</span>
                          </div>
                          
                          <button 
                            onClick={() => setSignature(null)}
                            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white border border-slate-200 text-slate-400 shadow-sm flex items-center justify-center hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all text-[8px]"
                            title="Remove signature"
                          >
                            ✕
                          </button>
                        </div>
                        
                        <div className="hidden lg:flex flex-col text-left">
                          <span className="text-[10px] font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                            Drag and drop signature
                          </span>
                          <span className="text-[9px] text-slate-400 mt-0.5">Drag onto desired location in document</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Middle Column: Saved Signatures container */}
                  {savedAssets.length > 0 && (
                    <div className="flex items-center gap-2 border-l border-slate-200 pl-4 py-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 hidden xl:block">Saved:</span>
                      <div className="flex gap-1.5 overflow-x-auto max-w-[150px] sm:max-w-[240px] md:max-w-[320px] py-1 px-1">
                        {savedAssets.map(asset => (
                          <div key={asset.id} className="relative group shrink-0">
                            <button
                              onClick={() => {
                                setSignature(prev => ({
                                  url: asset.url,
                                  originalUrl: asset.originalUrl,
                                  bgRemovalTolerance: 50,
                                  bgRemovalMode: prev?.bgRemovalMode || 'white',
                                  pos: { x: 100, y: 100, width: 150, height: 150 / asset.aspectRatio },
                                  applyMode: prev ? prev.applyMode : 'single',
                                  customPages: prev ? prev.customPages : '',
                                  excludedPages: prev ? prev.excludedPages : '',
                                  instances: prev ? prev.instances : [],
                                  aspectRatio: asset.aspectRatio,
                                }));
                              }}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData("application/my-signature", JSON.stringify({ url: asset.url, aspectRatio: asset.aspectRatio }));
                              }}
                              className={cn(
                                "w-11 h-9 border rounded-lg flex items-center justify-center p-1 bg-slate-50 transition-all cursor-grab active:cursor-grabbing hover:scale-105",
                                signature?.url === asset.url ? "border-indigo-500 bg-indigo-50/50 shadow-sm" : "border-slate-200 hover:border-indigo-300"
                              )}
                            >
                              <img src={asset.url} className="max-w-full max-h-full object-contain pointer-events-none" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAsset(asset.id);
                              }}
                              className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-white border border-slate-200 text-slate-400 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all z-10 text-[8px]"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Right Column: Drawing Trigger & Settings Panel Toggle */}
                  <div className="flex items-center gap-2 ml-auto shrink-0">
                    {signature && (
                      <button 
                        onClick={() => setIsDrawing(true)}
                        className="px-3 py-1.5 border border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-600 hover:text-indigo-600 font-bold text-xs rounded-xl flex items-center gap-1 transition-colors shadow-sm cursor-pointer"
                      >
                        <PenTool className="w-3.5 h-3.5" /> Draw New
                      </button>
                    )}
                    
                    {signature && (
                      <button
                        onClick={() => setIsInspectorOpen(v => !v)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl border font-bold text-xs flex items-center gap-1 transition-all shadow-sm cursor-pointer",
                          isInspectorOpen
                            ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-extrabold"
                            : "bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-600 hover:text-indigo-600"
                        )}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>Settings</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Main Workspace Frame */}
                <div className="flex-1 flex flex-row overflow-hidden relative">
                  {/* Center Canvas */}
                  <main className="flex-1 bg-slate-100/50 p-0 md:p-6 lg:p-8 flex flex-col justify-start md:justify-center relative overflow-hidden transition-all duration-300">
                    <div className="hidden md:block absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.02] pointer-events-none mix-blend-multiply border-l border-white/50" />
                    
                    <DocumentViewer 
                      document={documentFile}
                      signature={signature}
                      setSignature={setSignature}
                      texts={texts}
                      setTexts={setTexts}
                      isPlacementMode={isPlacementMode}
                      setIsPlacementMode={setIsPlacementMode}
                      placedForConfirmation={placedForConfirmation}
                      setPlacedForConfirmation={setPlacedForConfirmation}
                      lastPlacedInstanceId={lastPlacedInstanceId}
                      setLastPlacedInstanceId={setLastPlacedInstanceId}
                    />
                  </main>

                  {/* Collapsible Sliding Inspector Panel */}
                  <AnimatePresence>
                    {isInspectorOpen && signature && (
                      <motion.div
                        initial={{ opacity: 0, x: 280 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 280 }}
                        transition={{ type: "spring", bounce: 0, duration: 0.35 }}
                        className="w-72 shrink-0 bg-white/95 backdrop-blur-xl border-l border-slate-200 shadow-2xl flex flex-col h-full overflow-y-auto z-30"
                      >
                        <div className="p-5 space-y-6">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Signature Settings</span>
                            <button 
                              onClick={() => setIsInspectorOpen(false)}
                              className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors text-xs"
                            >
                              ✕
                            </button>
                          </div>

                          {/* Background Remove Settings */}
                          <div className="space-y-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Remove Background</span>
                            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl text-[10px] font-semibold">
                              {[
                                { id: 'white', label: 'White' },
                                { id: 'black', label: 'Black' },
                                { id: 'auto', label: 'Auto' },
                              ].map(mode => (
                                <button
                                  key={mode.id}
                                  type="button"
                                  onClick={() => setSignature(p => p ? { ...p, bgRemovalMode: mode.id as any } : null)}
                                  className={cn(
                                    "py-1.5 rounded-lg text-center cursor-pointer transition-all",
                                    signature.bgRemovalMode === mode.id
                                      ? "bg-white text-indigo-700 shadow-sm font-bold border border-slate-200/30"
                                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/30"
                                  )}
                                >
                                  {mode.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Tolerance Slider */}
                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-600 font-medium">Removal Tolerance</span>
                              <span className="text-slate-500 font-bold font-mono">{signature.bgRemovalTolerance}%</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="200"
                              value={signature.bgRemovalTolerance}
                              onChange={(e) => setSignature(p => p ? { ...p, bgRemovalTolerance: Number(e.target.value) } : null)}
                              className="w-full accent-indigo-600 h-1 bg-slate-100 rounded-full appearance-none cursor-pointer"
                            />
                          </div>

                          {/* Tint Color Selector */}
                          <div className="space-y-2 border-t border-slate-100 pt-4">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Tint Color</span>
                            <div className="flex gap-2">
                              {[
                                { name: 'Original', value: undefined },
                                { name: 'Black', value: '#000000' },
                                { name: 'Blue', value: '#2563eb' },
                                { name: 'Red', value: '#dc2626' },
                                { name: 'Green', value: '#16a34a' },
                              ].map(color => (
                                <button
                                  key={color.name}
                                  onClick={() => setSignature(p => p ? { ...p, tintColor: color.value } : null)}
                                  className={cn(
                                    "w-6 h-6 rounded-full border-2 transition-transform hover:scale-115 cursor-pointer",
                                    signature.tintColor === color.value ? "border-slate-400 scale-110 shadow-md" : "border-transparent shadow-sm",
                                    !color.value && "bg-white overflow-hidden"
                                  )}
                                  style={color.value ? { backgroundColor: color.value } : {}}
                                  title={color.name}
                                >
                                  {!color.value && (
                                    <div className="w-full h-full bg-slate-200" style={{ backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)', backgroundSize: '8px 8px', backgroundPosition: '0 0, 4px 4px' }} />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Scope / Placement Range Selector */}
                          <div className="space-y-3 border-t border-slate-100 pt-4">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Apply Scope</span>
                            <div className="flex flex-col gap-2">
                              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-700">
                                <input 
                                  type="radio" 
                                  name="applyMode" 
                                  value="single"
                                  checked={signature.applyMode === 'single'}
                                  onChange={() => setSignature(p => p ? { ...p, applyMode: 'single' } : null)}
                                  className="text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                />
                                <span>Current Page Only</span>
                              </label>

                              <div className="flex flex-col gap-1">
                                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-700">
                                  <input 
                                    type="radio" 
                                    name="applyMode" 
                                    value="all"
                                    checked={signature.applyMode === 'all'}
                                    onChange={() => setSignature(p => p ? { ...p, applyMode: 'all' } : null)}
                                    className="text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                  />
                                  <span>Apply to All Pages</span>
                                </label>
                                {signature.applyMode === 'all' && (
                                  <div className="space-y-1 pl-7 animate-fade-in">
                                    <label className="text-[10px] text-slate-400 font-bold block">Exclude Pages (e.g. 1, 3-5)</label>
                                    <input 
                                      type="text" 
                                      value={signature.excludedPages || ''}
                                      onChange={(e) => setSignature(p => p ? { ...p, excludedPages: e.target.value } : null)}
                                      placeholder="None"
                                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-col gap-1">
                                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-700">
                                  <input 
                                    type="radio" 
                                    name="applyMode" 
                                    value="custom"
                                    checked={signature.applyMode === 'custom'}
                                    onChange={() => setSignature(p => p ? { ...p, applyMode: 'custom' } : null)}
                                    className="text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                  />
                                  <span>Specific Page Range</span>
                                </label>
                                {signature.applyMode === 'custom' && (
                                  <div className="space-y-1 pl-7 animate-fade-in">
                                    <label className="text-[10px] text-slate-400 font-bold block">Pages list (e.g. 1, 3-5)</label>
                                    <input 
                                      type="text" 
                                      value={signature.customPages || ''}
                                      onChange={(e) => setSignature(p => p ? { ...p, customPages: e.target.value } : null)}
                                      placeholder="e.g. 1, 3-5"
                                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Private Security Badge inside Settings Tray */}
                          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 flex gap-2 pt-3">
                            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" strokeWidth={2.5} />
                            <p className="text-[10px] text-emerald-800 leading-normal font-semibold">
                              All adjustments happen instantly on your device via client-side Canvas operations.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </>
        )}
        {activeTab === 'Organize' && <Organize />}
        {activeTab === 'Compress' && <Compress />}
        {activeTab === 'Convert' && <Convert />}
      </div>

      <Footer />

      {isDrawing && (
        <DrawSignature 
          onSave={handleDrawSave} 
          onCancel={() => setIsDrawing(false)} 
        />
      )}
      <div className="md:hidden shrink-0 w-full bg-white/95 backdrop-blur-xl border-t border-slate-100/80 flex items-center justify-around z-30 px-1 pb-safe pt-1 min-h-[4rem] shadow-[0_-1px_0_0_rgba(0,0,0,0.04)]">
        {[
          { id: 'Fill & Sign', icon: <FilePen size={20} strokeWidth={1.8} />, label: 'Sign' },
          { id: 'Organize', icon: <LayoutGrid size={20} strokeWidth={1.8} />, label: 'Organize' },
          { id: 'Compress', icon: <FileArchive size={20} strokeWidth={1.8} />, label: 'Compress' },
          { id: 'Convert', icon: <RefreshCw size={20} strokeWidth={1.8} />, label: 'Convert' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex flex-col items-center justify-center flex-1 h-full gap-1 py-2 transition-all duration-200 ${
              activeTab === tab.id
                ? 'text-indigo-600'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <span className={`transition-transform duration-200 ${activeTab === tab.id ? 'scale-110' : ''}`}>
              {tab.icon}
            </span>
            <span className={`text-[10px] tracking-wide ${activeTab === tab.id ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
            {activeTab === tab.id && (
              <span className="absolute bottom-0 w-6 h-0.5 bg-indigo-600 rounded-full" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
