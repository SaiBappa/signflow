import React, { useState, useEffect } from 'react';
import { useIsMobile } from './hooks/useIsMobile';
import { PDFDocument, rgb, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
import { DrawSignature } from './components/DrawSignature';
import { DocumentViewer } from './components/DocumentViewer';
<<<<<<< HEAD
import { DocumentFile, SignatureState, SavedAsset, TextInstance } from './types';
import { FileImage, FileSignature, Settings, Image as ImageIcon, FilePen, LayoutGrid, FileArchive, RefreshCw, Upload, PenTool, SlidersHorizontal, RotateCcw, Trash2, MoreVertical, Download, ShieldCheck } from 'lucide-react';
import { removeImageBackground, downloadBlob, isPageInRange, TEXT_FONTS, cn } from './utils';
=======
import { DocumentFile, SignatureState, SavedAsset, TextInstance, StampAsset, StampInstance, RedactInstance, FormFieldInstance, FormFieldType, UserTemplate, CommentInstance, DrawInstance, DrawShape } from './types';
import type { ExtractedRun } from './services/textExtraction';
import { COMMENT_COLORS, DRAW_COLORS, DRAW_SHAPES, drawCommentToCanvas, drawDrawingToCanvas, drawCommentToPdf, drawDrawingToPdf } from './utils/annotations';
import { useTemplatesStore } from './store/useTemplatesStore';
import { SaveTemplateModal, SaveTemplateValues } from './components/SaveTemplateModal';
import { SignatureImageEditor } from './components/SignatureImageEditor';
import { fileToDataUrl, dataUrlToFile, makeThumbnail } from './utils/templateMedia';
import { FileImage, FileSignature, Settings, Image as ImageIcon, FilePen, LayoutGrid, FileArchive, RefreshCw, Upload, PenTool, SlidersHorizontal, RotateCcw, RotateCw, Trash2, MoreVertical, MoreHorizontal, Download, ShieldCheck, Stamp, RectangleHorizontal, Type, Pen, Plus, X, ChevronDown, CheckSquare, Circle, AlignLeft, Sparkles, History, Scissors, Droplet, Hash, Lock, ScanText, Combine, LayoutTemplate, Eraser, MessageSquare, Highlighter, Minus, ArrowUpRight, Square, Pencil, FormInput, GitCompareArrows } from 'lucide-react';
import { getDefaultStamps } from './utils/defaultStamps';
import { removeImageBackground, enhanceSignature, rotateImage, downloadBlob, isPageInRange, TEXT_FONTS, cn, canvasFontString, ensureTextFontsLoaded } from './utils';
import { embedTextFonts, fontSpecKey } from './services/fontRegistry';
>>>>>>> feat/prepare-form
import { Organize } from './components/Organize';
import { Compress } from './components/Compress';
import { Convert } from './components/Convert';
// New tools are lazy-loaded so their heavy deps (PDF encryption, OCR engine)
// stay out of the initial bundle and only load when the tool is opened.
const Split = React.lazy(() => import('./components/Split').then(m => ({ default: m.Split })));
const Watermark = React.lazy(() => import('./components/Watermark').then(m => ({ default: m.Watermark })));
const PageNumbers = React.lazy(() => import('./components/PageNumbers').then(m => ({ default: m.PageNumbers })));
const Protect = React.lazy(() => import('./components/Protect').then(m => ({ default: m.Protect })));
const Ocr = React.lazy(() => import('./components/Ocr').then(m => ({ default: m.Ocr })));
const Merge = React.lazy(() => import('./components/Merge').then(m => ({ default: m.Merge })));
const DigitalSign = React.lazy(() => import('./components/DigitalSign').then(m => ({ default: m.DigitalSign })));
const TemplatesGallery = React.lazy(() => import('./components/TemplatesGallery').then(m => ({ default: m.TemplatesGallery })));
const AskAI = React.lazy(() => import('./components/AskAI').then(m => ({ default: m.AskAI })));
const PrepareForm = React.lazy(() => import('./components/PrepareForm').then(m => ({ default: m.PrepareForm })));
const Compare = React.lazy(() => import('./components/Compare').then(m => ({ default: m.Compare })));
import Footer from './components/Footer';
import { useRecentFilesStore } from './store/useRecentFilesStore';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';

import { motion, AnimatePresence } from 'motion/react';
import './print.css';

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString();
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'Fill & Sign' | 'Organize' | 'Compress' | 'Convert' | 'Split' | 'Merge' | 'Watermark' | 'Numbering' | 'Protect' | 'OCR' | 'DigitalSign' | 'Templates' | 'AskAI' | 'PrepareForm' | 'Compare'>('Fill & Sign');
  const [moreToolsOpen, setMoreToolsOpen] = useState(false);
  const [documentFile, setDocumentFile] = useState<DocumentFile | null>(null);
  const [savedAssets, setSavedAssets] = useState<SavedAsset[]>(() => {
    try {
      const saved = localStorage.getItem('signflow_saved_signatures');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });
  const [signature, setSignature] = useState<SignatureState | null>(null);

  // Close the "More tools" menu when clicking/tapping anywhere outside it, or on Escape.
  useEffect(() => {
    if (!moreToolsOpen) return;
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-more-tools]')) {
        setMoreToolsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreToolsOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [moreToolsOpen]);

  // Migrate legacy saved assets that were stored before background removal ran at
  // upload time. Such assets have `url === originalUrl` (the raw photo). Reprocess
  // them once so drag-to-place uses a transparent PNG instead of the background.
  useEffect(() => {
    const legacy = savedAssets.filter(a => a.url === a.originalUrl);
    if (legacy.length === 0) return;
    let cancelled = false;
    (async () => {
      const processed = await Promise.all(
        legacy.map(async a => {
          try {
            const url = await removeImageBackground(a.originalUrl, 50, a.tintColor, 'auto');
            return { id: a.id, url };
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      const byId = new Map(processed.filter(Boolean).map(p => [p!.id, p!.url]));
      if (byId.size === 0) return;
      setSavedAssets(prev => {
        const updated = prev.map(a => byId.has(a.id) ? { ...a, url: byId.get(a.id)! } : a);
        try { localStorage.setItem('signflow_saved_signatures', JSON.stringify(updated)); } catch (e) {}
        return updated;
      });
    })();
    return () => { cancelled = true; };
    // Run once on mount against the assets loaded from localStorage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [texts, setTexts] = useState<TextInstance[]>([]);
  const [stamps, setStamps] = useState<StampInstance[]>([]);
  const [redacts, setRedacts] = useState<RedactInstance[]>([]);
  const [comments, setComments] = useState<CommentInstance[]>([]);
  const [drawings, setDrawings] = useState<DrawInstance[]>([]);
  const [formFields, setFormFields] = useState<FormFieldInstance[]>([]);
  const [formFieldPlacementMode, setFormFieldPlacementMode] = useState(false);
  const [formFieldPlacementType, setFormFieldPlacementType] = useState<FormFieldType>('checkbox');
  const [savedStamps, setSavedStamps] = useState<StampAsset[]>(() => {
    try {
      const saved = localStorage.getItem('signflow_saved_stamps');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return getDefaultStamps();
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isDownloadDropdownOpen, setIsDownloadDropdownOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
<<<<<<< HEAD
  const [isPlacementMode, setIsPlacementMode] = useState(false);
  const [placedForConfirmation, setPlacedForConfirmation] = useState(false);
  const [lastPlacedInstanceId, setLastPlacedInstanceId] = useState<string | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);

  const isMobile = () => window.innerWidth < 768;
=======
  const [isMobileToolSheetOpen, setIsMobileToolSheetOpen] = useState(false);
  const [isMobileDownloadOpen, setIsMobileDownloadOpen] = useState(false);
  const [isPlacementMode, setIsPlacementMode] = useState(false);
  const [placedForConfirmation, setPlacedForConfirmation] = useState(false);
  const [lastPlacedInstanceId, setLastPlacedInstanceId] = useState<string | null>(null);
>>>>>>> feat/prepare-form

  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [editingAsset, setEditingAsset] = useState<SavedAsset | null>(null);
  const [activeTool, setActiveTool] = useState<'sign' | 'stamp' | 'redact' | 'fields' | 'comment' | 'draw' | 'editText'>('sign');
  const [stampPlacementMode, setStampPlacementMode] = useState(false);
  const [stampPlacementAsset, setStampPlacementAsset] = useState<{ url: string; aspectRatio: number } | null>(null);
  const [redactPlacementMode, setRedactPlacementMode] = useState(false);
  const [redactColor, setRedactColor] = useState('#FFFFFF');
  const [textPlacementMode, setTextPlacementMode] = useState(false);
  // Comments
  const [commentPlacementMode, setCommentPlacementMode] = useState(false);
  const [commentColor, setCommentColor] = useState('#F59E0B');
  // Drawing / markup
  const [drawMode, setDrawMode] = useState(false);
  const [drawShape, setDrawShape] = useState<DrawShape>('freehand');
  const [drawColor, setDrawColor] = useState('#EF4444');
  const [drawStrokeWidth, setDrawStrokeWidth] = useState(3);
  const [drawOpacity, setDrawOpacity] = useState(1);
  const [formFieldColor, setFormFieldColor] = useState('#000000');
  // Per-type default colors for newly placed form fields (persisted across the session)
  const [formFieldDefaultColors, setFormFieldDefaultColors] = useState<Record<FormFieldType, string>>(() => {
    try {
      const saved = localStorage.getItem('signflow_field_default_colors');
      if (saved) return { checkbox: '#16A34A', radio: '#7C3AED', textarea: '#000000', ...JSON.parse(saved) };
    } catch (e) {}
    return { checkbox: '#16A34A', radio: '#7C3AED', textarea: '#000000' };
  });
  const setDefaultFieldColor = (type: FormFieldType, color: string) => {
    setFormFieldDefaultColors(prev => {
      const next = { ...prev, [type]: color };
      try { localStorage.setItem('signflow_field_default_colors', JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

  const hasActions = (signature?.instances?.length ?? 0) > 0 || texts.length > 0 || stamps.length > 0 || redacts.length > 0 || formFields.length > 0 || comments.length > 0 || drawings.length > 0;

  const mobile = useIsMobile();
  const { recentFiles, addRecentFile, removeRecentFile, clearRecentFiles } = useRecentFilesStore();
  const addTemplate = useTemplatesStore(s => s.addTemplate);

  // Save-as-template modal
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [saveTemplateError, setSaveTemplateError] = useState<string | null>(null);
  const [saveTemplateThumb, setSaveTemplateThumb] = useState<string | undefined>(undefined);
  const [templateBusyId, setTemplateBusyId] = useState<string | null>(null);

  // A template is worth saving once at least one reusable element (form field or
  // text box) has been placed on the document.
  const canSaveTemplate = !!documentFile && (formFields.length > 0 || texts.length > 0);

  // Apply background removal + enhancement when settings change
  useEffect(() => {
    if (!signature) return;
    
    let isMounted = true;
    const processImg = async () => {
      try {
        // Step 1: Background removal
        let processedUrl = await removeImageBackground(
          signature.originalUrl,
          signature.bgRemovalTolerance,
          signature.tintColor,
          signature.bgRemovalMode || 'white'
        );
        
        // Step 2: Enhancement (if enabled)
        if (signature.enhanceEnabled) {
          processedUrl = await enhanceSignature(
            processedUrl,
            signature.enhanceStrength ?? 50
          );
        }
        
        if (isMounted) {
          // Update the active signature url AND only the already-placed instances
          // that belong to it (i.e. currently showing its image), so live
          // tolerance/tint/enhancement edits are reflected without clobbering
          // instances placed from a different saved signature or colour.
          setSignature(prev => {
            if (!prev) return null;
            const activeUrl = prev.url;
            return {
              ...prev,
              url: processedUrl,
              instances: prev.instances.map(inst =>
                inst.url === activeUrl ? { ...inst, url: processedUrl } : inst
              ),
            };
          });
        }
      } catch (err) {
        console.error("Failed to process signature", err);
      }
    };
    
    const timer = setTimeout(processImg, 150);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
<<<<<<< HEAD
  }, [signature?.bgRemovalTolerance, signature?.originalUrl, signature?.tintColor, signature?.bgRemovalMode]);
=======
  }, [signature?.bgRemovalTolerance, signature?.originalUrl, signature?.tintColor, signature?.bgRemovalMode, signature?.enhanceEnabled, signature?.enhanceStrength]);
>>>>>>> feat/prepare-form

  const handleUploadDoc = (file: File) => {
    const isPdf = file.type === 'application/pdf';
    setDocumentFile({
      type: isPdf ? 'pdf' : 'image',
      name: file.name,
      url: URL.createObjectURL(file),
      file,
    });
<<<<<<< HEAD
    // Clear existing signatures/texts when a new document is uploaded
    setSignature(null);
    setTexts([]);
    setIsPlacementMode(false);
    setPlacedForConfirmation(false);
    setLastPlacedInstanceId(null);
=======
    // Track in recent files
    addRecentFile({ name: file.name, type: isPdf ? 'pdf' : 'image', size: file.size });
    // Clear existing signatures/texts/stamps/redacts when a new document is uploaded
    setSignature(null);
    setTexts([]);
    setStamps([]);
    setRedacts([]);
    setIsPlacementMode(false);
    setPlacedForConfirmation(false);
    setLastPlacedInstanceId(null);
    setStampPlacementMode(false);
    setStampPlacementAsset(null);
    setRedactPlacementMode(false);
    setTextPlacementMode(false);
    setComments([]);
    setDrawings([]);
    setCommentPlacementMode(false);
    setDrawMode(false);
    setActiveTool('sign');
>>>>>>> feat/prepare-form
  };

  const handleClearSignatures = () => {
    setSignature(null);
    setTexts([]);
<<<<<<< HEAD
    setIsPlacementMode(false);
    setPlacedForConfirmation(false);
    setLastPlacedInstanceId(null);
    setShowMobileMenu(false);
=======
    setStamps([]);
    setRedacts([]);
    setIsPlacementMode(false);
    setPlacedForConfirmation(false);
    setLastPlacedInstanceId(null);

    setStampPlacementMode(false);
    setRedactPlacementMode(false);
    setTextPlacementMode(false);
    setComments([]);
    setDrawings([]);
    setCommentPlacementMode(false);
    setDrawMode(false);
    setActiveTool('sign');
>>>>>>> feat/prepare-form
  };

  const handleStartAgain = () => {
    setDocumentFile(null);
    setSignature(null);
    setTexts([]);
<<<<<<< HEAD
    setIsPlacementMode(false);
    setPlacedForConfirmation(false);
    setLastPlacedInstanceId(null);
    setShowMobileMenu(false);
=======
    setStamps([]);
    setRedacts([]);
    setFormFields([]);
    setIsPlacementMode(false);
    setPlacedForConfirmation(false);
    setLastPlacedInstanceId(null);

    setStampPlacementMode(false);
    setStampPlacementAsset(null);
    setRedactPlacementMode(false);
    setTextPlacementMode(false);
    setFormFieldPlacementMode(false);
    setComments([]);
    setDrawings([]);
    setCommentPlacementMode(false);
    setDrawMode(false);
    setActiveTool('sign');
  };

  // Open a saved template: decode its blank document and restore the placed
  // form fields and text boxes so the user can fill it without re-placing anything.
  const handleLoadTemplate = async (tpl: UserTemplate) => {
    setTemplateBusyId(tpl.id);
    try {
      const file = await dataUrlToFile(
        tpl.docDataUrl,
        tpl.docName,
        tpl.docType === 'pdf' ? 'application/pdf' : 'image/png'
      );
      // Reset to a clean document state, then layer the template's layout on top.
      handleStartAgain();
      setDocumentFile({
        type: tpl.docType,
        name: tpl.docName,
        url: URL.createObjectURL(file),
        file,
      });
      addRecentFile({ name: tpl.docName, type: tpl.docType, size: file.size });
      // Give restored elements fresh ids so editing this instance is independent
      // of the stored template.
      setFormFields(tpl.formFields.map(f => ({ ...f, id: crypto.randomUUID() })));
      setTexts(tpl.texts.map(t => ({ ...t, id: crypto.randomUUID() })));
      setActiveTab('Fill & Sign');
      setActiveTool('fields');
    } catch (e) {
      console.error('Failed to open template', e);
      alert('Could not open this template.');
    } finally {
      setTemplateBusyId(null);
    }
  };

  const handleOpenSaveTemplate = async () => {
    if (!documentFile) return;
    setSaveTemplateError(null);
    setSaveTemplateThumb(undefined);
    setSaveTemplateOpen(true);
    // Generate a preview in the background; the modal renders without it meanwhile.
    const thumb = await makeThumbnail(documentFile.file);
    setSaveTemplateThumb(thumb);
  };

  const handleSaveTemplate = async (values: SaveTemplateValues) => {
    if (!documentFile) return;
    setSavingTemplate(true);
    setSaveTemplateError(null);
    try {
      const docDataUrl = await fileToDataUrl(documentFile.file);
      // Strip filled-in values so the template reopens as a blank, reusable form.
      const blankFields = formFields.map(f => ({
        ...f,
        checked: false,
        text: f.type === 'textarea' ? '' : f.text,
      }));
      const thumbnail = saveTemplateThumb ?? await makeThumbnail(documentFile.file);
      addTemplate({
        name: values.name,
        nameDv: values.nameDv,
        category: values.category,
        docType: documentFile.type,
        docName: documentFile.name,
        docDataUrl,
        thumbnail,
        formFields: blankFields,
        texts: texts.map(t => ({ ...t })),
      });
      setSaveTemplateOpen(false);
    } catch (e: any) {
      const quota = e && (e.name === 'QuotaExceededError' || /quota/i.test(e.message || ''));
      setSaveTemplateError(
        quota
          ? 'Not enough local storage to save this template. Try deleting an old template first — large documents take up the most space.'
          : 'Could not save this template. Please try again.'
      );
      console.error('Failed to save template', e);
    } finally {
      setSavingTemplate(false);
    }
>>>>>>> feat/prepare-form
  };

  const handleUploadSig = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      if (!url) return;
      const img = new Image();
      img.src = url;
      img.onload = async () => {
        const aspectRatio = img.width / img.height;

        // Remove the background up front so the saved asset (and any drag-to-place
        // from it) uses a transparent PNG, not the raw photo with its background.
        let processedUrl = url;
        try {
          processedUrl = await removeImageBackground(url, 50, undefined, 'auto');
        } catch (err) {
          console.error('Failed to remove signature background on upload', err);
        }

        const newAsset: SavedAsset = {
          id: crypto.randomUUID(),
          url: processedUrl,
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
<<<<<<< HEAD
          bgRemovalMode: 'white',
=======
          bgRemovalMode: 'auto',
>>>>>>> feat/prepare-form
          pos: { x: 100, y: 100, width: 150, height: 150 / aspectRatio },
          applyMode: 'single',
          customPages: '',
          excludedPages: '',
          instances: prev ? prev.instances : [],
          aspectRatio: newAsset.aspectRatio,
        }));

        // On mobile: auto-close panel and enter placement mode
<<<<<<< HEAD
        if (isMobile()) {
=======
        if (mobile) {
>>>>>>> feat/prepare-form
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

  const handleRecolorAsset = async (assetId: string, tintColor: string | undefined) => {
    const asset = savedAssets.find(a => a.id === assetId);
    if (!asset) return;
    let newUrl: string;
    if (tintColor) {
      newUrl = await removeImageBackground(asset.originalUrl, 50, tintColor, 'auto');
    } else {
      // "Original" — re-process without tint
      newUrl = await removeImageBackground(asset.originalUrl, 50, undefined, 'auto');
    }
    setSavedAssets(prev => {
      const updated = prev.map(a => a.id === assetId ? { ...a, url: newUrl, tintColor } : a);
      try { localStorage.setItem('signflow_saved_signatures', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    // Also update active signature if it's using this asset
    setSignature(prev => {
      if (!prev || prev.originalUrl !== asset.originalUrl) return prev;
      return { ...prev, url: newUrl, tintColor };
    });
  };

  // Rotate a saved signature 90° clockwise and persist the rotated image so the
  // new orientation sticks across re-colors, placement and reloads.
  const handleRotateAsset = async (assetId: string) => {
    const asset = savedAssets.find(a => a.id === assetId);
    if (!asset) return;
    const [newUrl, newOriginalUrl] = await Promise.all([
      rotateImage(asset.url, 90),
      rotateImage(asset.originalUrl, 90),
    ]);
    const newAspectRatio = 1 / asset.aspectRatio;
    setSavedAssets(prev => {
      const updated = prev.map(a => a.id === assetId
        ? { ...a, url: newUrl, originalUrl: newOriginalUrl, aspectRatio: newAspectRatio }
        : a);
      try { localStorage.setItem('signflow_saved_signatures', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    // Also update active signature if it's using this asset
    setSignature(prev => {
      if (!prev || prev.originalUrl !== asset.originalUrl) return prev;
      return { ...prev, url: newUrl, originalUrl: newOriginalUrl, aspectRatio: newAspectRatio };
    });
  };

  // Persist the result of the in-app signature editor (eraser/restore) back onto
  // the saved asset, updating the live signature too if it's currently active.
  const handleEditAssetSave = (assetId: string, result: { url: string; originalUrl: string }) => {
    const asset = savedAssets.find(a => a.id === assetId);
    setSavedAssets(prev => {
      const updated = prev.map(a => a.id === assetId
        ? { ...a, url: result.url, originalUrl: result.originalUrl }
        : a);
      try { localStorage.setItem('signflow_saved_signatures', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    setSignature(prev => {
      if (!prev || !asset || prev.originalUrl !== asset.originalUrl) return prev;
      return { ...prev, url: result.url, originalUrl: result.originalUrl };
    });
    setEditingAsset(null);
  };

  const handleUploadStamp = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      if (!url) return;
      const img = new Image();
      img.src = url;
      img.onload = () => {
        const newStamp: StampAsset = {
          id: crypto.randomUUID(),
          url,
          label: file.name.replace(/\.[^/.]+$/, ''),
        };
        setSavedStamps(prev => {
          const updated = [...prev, newStamp];
          try { localStorage.setItem('signflow_saved_stamps', JSON.stringify(updated)); } catch (e) {}
          return updated;
        });
      };
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteStamp = (id: string) => {
    setSavedStamps(prev => {
      const updated = prev.filter(s => s.id !== id);
      try { localStorage.setItem('signflow_saved_stamps', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    // Also remove any placed instances of this stamp
    setStamps(prev => prev.filter(s => s.assetId !== id));
  };

  // In-place text edit: cover the original glyphs with a background-matched
  // rectangle and drop an editable text box carrying the original string on top.
  // Reuses the existing redact + text primitives so it flows through every
  // render and export path unchanged.
  const handleEditTextRun = (run: ExtractedRun) => {
    setRedacts(prev => [...prev, {
      id: crypto.randomUUID(),
      pageIndex: run.pageIndex,
      pos: { ...run.pos },
      color: run.bgColor || '#ffffff',
      canvasWidth: run.canvasWidth,
      canvasHeight: run.canvasHeight,
    }]);
    setTexts(prev => [...prev, {
      id: crypto.randomUUID(),
      text: run.text,
      pageIndex: run.pageIndex,
      pos: { ...run.pos },
      fontSize: run.fontSize,
      color: run.textColor || '#000000',
      fontFamily: run.fontFamily,
      bold: run.bold,
      italic: run.italic,
      canvasWidth: run.canvasWidth,
      canvasHeight: run.canvasHeight,
    }]);
  };

  const handleDownload = async () => {
    if (!documentFile || !hasActions) return;
    setIsExporting(true);

    try {
      // Use the actual rendered page element (canvas/img), not its wrapper.
      // The wrapper container can be larger than the page it holds, which would
      // otherwise scale the signature/date/text placement and shift it on export.
      const pageEl = document.getElementById('document-canvas-content-1') || 
                     document.getElementById('document-canvas-content');
      const container = document.getElementById('document-canvas-container-1') || 
                        document.getElementById('document-canvas-container');
      if (!pageEl || !container) throw new Error("Could not find document page");

      const displayWidth = pageEl.clientWidth;
      const displayHeight = pageEl.clientHeight;

      if (documentFile.type === 'pdf') {
        const arrayBuffer = await documentFile.file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        
        // Fetch and embed all unique signature image bytes
        const embeddedImages = new Map();
        if (signature && signature.instances.length > 0) {
          const allUrls: string[] = Array.from(new Set(signature.instances.map(i => i.url || signature.url)));
          if (allUrls.length === 0) allUrls.push(signature.url);
          
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
        }

        // Embed stamp images
        const embeddedStampImages = new Map();
        if (stamps.length > 0) {
          const stampUrls: string[] = Array.from(new Set(stamps.map(s => s.url)));
          for (const url of stampUrls) {
            const res = await fetch(url);
            const buf = await res.arrayBuffer();
            let img;
            try { img = await pdfDoc.embedPng(buf); } catch { img = await pdfDoc.embedJpg(buf); }
            embeddedStampImages.set(url, img);
          }
        }

        const pages = pdfDoc.getPages();
        // Embed each (family, bold, italic) combination in use once, keyed by
        // fontSpecKey. Bundled Liberation/Faruma TTFs give real weight/style
        // and Unicode coverage; Standard-14 remains the per-font fallback.
        const textFonts = await embedTextFonts(pdfDoc, [
          ...texts.map(t => ({ family: t.fontFamily, bold: t.bold, italic: t.italic })),
          ...formFields.map(f => ({ family: f.fontFamily })),
        ]);

        // Load document into pdfjs to get exact viewports for mapping
        const pdfjsDoc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;

        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          const pdfjsPage = await pdfjsDoc.getPage(i + 1);
          // Get the viewport at scale=1 (native PDF size)
          const viewport = pdfjsPage.getViewport({ scale: 1.0 });
          const rotation = page.getRotation().angle;

          // Draw redaction rectangles FIRST (below everything else)
          redacts.forEach(redact => {
            if (redact.pageIndex !== i + 1) return;
            const pageElR = document.getElementById(`document-canvas-content-${redact.pageIndex}`) || pageEl;
            const cw = redact.canvasWidth || pageElR.clientWidth;
            const ch = redact.canvasHeight || pageElR.clientHeight;
            const sx = viewport.width / cw;
            const sy = viewport.height / ch;
            const hex = redact.color.replace('#', '');
            const rr = parseInt(hex.substring(0,2), 16) / 255 || 1;
            const rg = parseInt(hex.substring(2,4), 16) / 255 || 1;
            const rb = parseInt(hex.substring(4,6), 16) / 255 || 1;
            const visX = redact.pos.x * sx;
            const visY = redact.pos.y * sy;
            const visW = redact.pos.width * sx;
            const visH = redact.pos.height * sy;
            // Convert top-left visual to PDF coords (bottom-left origin)
            const bl = viewport.convertToPdfPoint(visX, visY + visH);
            page.drawRectangle({
              x: bl[0], y: bl[1],
              width: visW, height: visH,
              color: rgb(rr, rg, rb),
              rotate: degrees(-rotation),
            });
          });

          // Draw signatures
          if (signature) {
            signature.instances.forEach(instance => {
              if (signature.applyMode === 'all') {
                if (isPageInRange(signature.excludedPages, i + 1)) return;
              } else if (signature.applyMode === 'custom') {
                if (!isPageInRange(signature.customPages, i + 1)) return;
              } else {
                if (instance.pageIndex !== i + 1) return;
              }

              const pageElForInstance = document.getElementById(`document-canvas-content-${instance.pageIndex}`) || pageEl;
              const instCanvasWidth = instance.canvasWidth || pageElForInstance.clientWidth;
              const instCanvasHeight = instance.canvasHeight || pageElForInstance.clientHeight;
              const scaleX = viewport.width / instCanvasWidth;
              const scaleY = viewport.height / instCanvasHeight;
              const pdfVisX = instance.pos.x * scaleX;
              const pdfVisY = instance.pos.y * scaleY;
              const pdfVisW = instance.pos.width * scaleX;
              const pdfVisH = instance.pos.height * scaleY;
              const instAspect = instance.aspectRatio || signature.aspectRatio;
              let drawW = pdfVisW, drawH = pdfVisH, drawX = pdfVisX, drawY = pdfVisY;
              if (instAspect) {
                const boxRatio = pdfVisW / pdfVisH;
                if (instAspect > boxRatio) { drawW = pdfVisW; drawH = pdfVisW / instAspect; drawY = pdfVisY + (pdfVisH - drawH) / 2; }
                else { drawH = pdfVisH; drawW = pdfVisH * instAspect; drawX = pdfVisX + (pdfVisW - drawW) / 2; }
              }
              const cx = drawX + drawW / 2;
              const cy = drawY + drawH / 2;
              const pdfCenter = viewport.convertToPdfPoint(cx, cy);
              const totalRotationDeg = -rotation - (instance.rotation || 0);
              const totalRotationRad = totalRotationDeg * Math.PI / 180;
              const dx = (drawW / 2) * Math.cos(totalRotationRad) - (drawH / 2) * Math.sin(totalRotationRad);
              const dy = (drawW / 2) * Math.sin(totalRotationRad) + (drawH / 2) * Math.cos(totalRotationRad);
              const finalX = pdfCenter[0] - dx;
              const finalY = pdfCenter[1] - dy;
              const imgToDraw = embeddedImages.get(instance.url || signature.url);
              if (imgToDraw) {
                page.drawImage(imgToDraw, { x: finalX, y: finalY, width: drawW, height: drawH, rotate: degrees(totalRotationDeg) });
              }
            });
          }

          // Draw stamps
          stamps.forEach(stamp => {
            if (stamp.pageIndex !== i + 1) return;
            const pageElS = document.getElementById(`document-canvas-content-${stamp.pageIndex}`) || pageEl;
            const cw = stamp.canvasWidth || pageElS.clientWidth;
            const ch = stamp.canvasHeight || pageElS.clientHeight;
            const sx = viewport.width / cw;
            const sy = viewport.height / ch;
            const visX = stamp.pos.x * sx;
            const visY = stamp.pos.y * sy;
            const visW = stamp.pos.width * sx;
            const visH = stamp.pos.height * sy;
            const cx = visX + visW / 2;
            const cy = visY + visH / 2;
            const pdfCenter = viewport.convertToPdfPoint(cx, cy);
            const totalRotDeg = -rotation - (stamp.rotation || 0);
            const totalRotRad = totalRotDeg * Math.PI / 180;
            const dx = (visW / 2) * Math.cos(totalRotRad) - (visH / 2) * Math.sin(totalRotRad);
            const dy = (visW / 2) * Math.sin(totalRotRad) + (visH / 2) * Math.cos(totalRotRad);
            const imgToDraw = embeddedStampImages.get(stamp.url);
            if (imgToDraw) {
              page.drawImage(imgToDraw, { x: pdfCenter[0] - dx, y: pdfCenter[1] - dy, width: visW, height: visH, rotate: degrees(totalRotDeg) });
            }
          });

          // Render custom texts
          texts.forEach(text => {
            if (text.pageIndex !== i + 1) return;
            const pageElForText = document.getElementById(`document-canvas-content-${text.pageIndex}`) || pageEl;
            const instCanvasWidth = text.canvasWidth || pageElForText.clientWidth;
            const instCanvasHeight = text.canvasHeight || pageElForText.clientHeight;
            const scaleX = viewport.width / instCanvasWidth;
            const scaleY = viewport.height / instCanvasHeight;
            const pdfVisX = text.pos.x * scaleX;
            const pdfVisY = text.pos.y * scaleY;
            const hex = text.color.replace('#', '');
            const r = parseInt(hex.substring(0,2), 16) / 255 || 0;
            const g = parseInt(hex.substring(2,4), 16) / 255 || 0;
            const b = parseInt(hex.substring(4,6), 16) / 255 || 0;
            const fontSize = text.fontSize * scaleY;
            const textFont = textFonts[fontSpecKey(text.fontFamily, text.bold, text.italic)] || textFonts[fontSpecKey()];
            const lines = text.text.split('\n');
            const lineHeight = fontSize * 1.2;
            for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
              const line = lines[lineIdx];
              const visualBottomLeft = viewport.convertToPdfPoint(pdfVisX, pdfVisY + (lineIdx * lineHeight) + fontSize);
              page.drawText(line, { x: visualBottomLeft[0], y: visualBottomLeft[1], size: fontSize, font: textFont, color: rgb(r, g, b), rotate: degrees(-rotation) });
            }
          });

          // Render form fields
          formFields.forEach(field => {
            if (field.pageIndex !== i + 1) return;
            const pageElForField = document.getElementById(`document-canvas-content-${field.pageIndex}`) || pageEl;
            const instCanvasWidth = field.canvasWidth || pageElForField.clientWidth;
            const instCanvasHeight = field.canvasHeight || pageElForField.clientHeight;
            const scaleX = viewport.width / instCanvasWidth;
            const scaleY = viewport.height / instCanvasHeight;
            const pdfVisX = field.pos.x * scaleX;
            const pdfVisY = field.pos.y * scaleY;
            const fieldW = field.pos.width * scaleX;
            const fieldH = field.pos.height * scaleY;

            if (field.type === 'checkbox') {
              const hexToRgb = (hex: string) => { const h = hex.replace('#', ''); return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255 }; };
              const fc = hexToRgb(field.color || '#16A34A');
              const boxSize = Math.min(fieldH * 0.7, fieldW * 0.7);
              const boxPt = viewport.convertToPdfPoint(pdfVisX + fieldH * 0.15, pdfVisY + fieldH * 0.15);
              page.drawRectangle({ x: boxPt[0], y: boxPt[1] - boxSize, width: boxSize, height: boxSize, borderColor: rgb(fc.r, fc.g, fc.b), borderWidth: 1.5, color: rgb(1, 1, 1), rotate: degrees(-rotation) });
              if (field.checked) {
                const textFont2 = textFonts[fontSpecKey()];
                page.drawText('X', { x: boxPt[0] + boxSize * 0.2, y: boxPt[1] - boxSize * 0.8, size: boxSize * 0.7, font: textFont2, color: rgb(fc.r, fc.g, fc.b), rotate: degrees(-rotation) });
              }
            } else if (field.type === 'radio') {
              const hexToRgb = (hex: string) => { const h = hex.replace('#', ''); return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255 }; };
              const fc = hexToRgb(field.color || '#7C3AED');
              const radius = Math.min(fieldH * 0.35, fieldW * 0.35);
              const centerPt = viewport.convertToPdfPoint(pdfVisX + fieldH * 0.15 + radius, pdfVisY + fieldH / 2);
              page.drawCircle({ x: centerPt[0], y: centerPt[1], size: radius, borderColor: rgb(fc.r, fc.g, fc.b), borderWidth: 1.5, color: rgb(1, 1, 1) });
              if (field.checked) {
                page.drawCircle({ x: centerPt[0], y: centerPt[1], size: radius * 0.5, color: rgb(fc.r, fc.g, fc.b) });
              }
            } else if (field.type === 'textarea') {
              const topLeft = viewport.convertToPdfPoint(pdfVisX, pdfVisY);
              const bottomRight = viewport.convertToPdfPoint(pdfVisX + fieldW, pdfVisY + fieldH);
              page.drawRectangle({ x: topLeft[0], y: bottomRight[1], width: bottomRight[0] - topLeft[0], height: topLeft[1] - bottomRight[1], borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 1, rotate: degrees(-rotation) });
              if (field.text) {
                const textFontForField = textFonts[fontSpecKey(field.fontFamily)] || textFonts[fontSpecKey()];
                const fSize = (field.fontSize || 14) * scaleY;
                const fieldLines = field.text.split('\n');
                const lineH = fSize * 1.3;
                for (let lineIdx = 0; lineIdx < fieldLines.length; lineIdx++) {
                  const pt = viewport.convertToPdfPoint(pdfVisX + 6 * scaleX, pdfVisY + 6 * scaleY + (lineIdx * lineH) + fSize);
                  page.drawText(fieldLines[lineIdx], { x: pt[0], y: pt[1], size: fSize, font: textFontForField, color: rgb(0.15, 0.15, 0.15), rotate: degrees(-rotation) });
                }
              }
            }

            if (field.comment) {
              const hexToRgb = (hex: string) => { const h = hex.replace('#', ''); return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255 }; };
              const fc = hexToRgb(field.color || '#000000');
              const commentFontSize = 8 * scaleY;
              const commentFont = textFonts[fontSpecKey()];
              const estWidth = field.comment.length * commentFontSize * 0.5;
              const startX = pdfVisX + (fieldW - estWidth) / 2;
              const startY = pdfVisY + fieldH + 6 * scaleY;
              const commentPt = viewport.convertToPdfPoint(startX, startY + commentFontSize);
              page.drawText(field.comment, {
                x: commentPt[0],
                y: commentPt[1],
                size: commentFontSize,
                font: commentFont,
                color: rgb(fc.r, fc.g, fc.b),
                rotate: degrees(-rotation)
              });
            }
          });

          // Draw freehand / shape markup (above page content)
          drawings.forEach(d => {
            if (d.pageIndex !== i + 1) return;
            const el = document.getElementById(`document-canvas-content-${d.pageIndex}`) || pageEl;
            const cw = d.canvasWidth || el.clientWidth;
            const ch = d.canvasHeight || el.clientHeight;
            drawDrawingToPdf(page, d, viewport, cw, ch, rotation, rgb, degrees);
          });

          // Draw comment notes (top-most)
          comments.forEach(c => {
            if (c.pageIndex !== i + 1) return;
            const el = document.getElementById(`document-canvas-content-${c.pageIndex}`) || pageEl;
            const cw = c.canvasWidth || el.clientWidth;
            const ch = c.canvasHeight || el.clientHeight;
            drawCommentToPdf(page, c, viewport, cw, ch, rotation, rgb, degrees, textFonts[fontSpecKey()]);
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

        // Draw Redaction rectangles first (below everything)
        redacts.forEach(redact => {
          if (redact.pageIndex !== 1) return;
          const cw = redact.canvasWidth || displayWidth;
          const ch = redact.canvasHeight || displayHeight;
          const x = (redact.pos.x / cw) * img.width;
          const y = (redact.pos.y / ch) * img.height;
          const w = (redact.pos.width / cw) * img.width;
          const h = (redact.pos.height / ch) * img.height;
          ctx.fillStyle = redact.color;
          ctx.fillRect(x, y, w, h);
        });

        // Draw Signatures
        if (signature && signature.instances.length > 0) {
          const allUrls: string[] = Array.from(new Set(signature.instances.map(i => i.url || signature.url)));
          if (allUrls.length === 0) allUrls.push(signature.url);
          const loadedImages = new Map();
          for (const url of allUrls) {
            const sigImg = new Image();
            sigImg.src = url;
            await new Promise((resolve, reject) => { sigImg.onload = resolve; sigImg.onerror = reject; });
            loadedImages.set(url, sigImg);
          }
          signature.instances.forEach(instance => {
            if (signature.applyMode === 'all') { if (isPageInRange(signature.excludedPages, 1)) return; }
            else if (signature.applyMode === 'custom') { if (!isPageInRange(signature.customPages, 1)) return; }
            else { if (instance.pageIndex !== 1) return; }
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
              ctx.translate(drawX + drawW / 2, drawY + drawH / 2);
              ctx.rotate((instance.rotation || 0) * Math.PI / 180);
              ctx.drawImage(imgToDraw, -drawW / 2, -drawH / 2, drawW, drawH);
              ctx.restore();
            }
          });
        }

        // Draw Stamps
        for (const stamp of stamps) {
          if (stamp.pageIndex !== 1) continue;
          const stampImg = new Image();
          stampImg.src = stamp.url;
          await new Promise((resolve, reject) => { stampImg.onload = resolve; stampImg.onerror = reject; });
          const cw = stamp.canvasWidth || displayWidth;
          const ch = stamp.canvasHeight || displayHeight;
          const drawX = (stamp.pos.x / cw) * img.width;
          const drawY = (stamp.pos.y / ch) * img.height;
          const drawW = (stamp.pos.width / cw) * img.width;
          const drawH = (stamp.pos.height / ch) * img.height;
          ctx.save();
          ctx.translate(drawX + drawW / 2, drawY + drawH / 2);
          ctx.rotate((stamp.rotation || 0) * Math.PI / 180);
          ctx.drawImage(stampImg, -drawW / 2, -drawH / 2, drawW, drawH);
          ctx.restore();
        }

        // Draw Text annotations
        await ensureTextFontsLoaded(texts.filter(t => t.pageIndex === 1));
        texts.forEach(text => {
          if (text.pageIndex !== 1) return;
          const cw = text.canvasWidth || displayWidth;
          const ch = text.canvasHeight || displayHeight;
          const drawX = (text.pos.x / cw) * img.width;
          const drawY = (text.pos.y / ch) * img.height;
          const fontSize = text.fontSize * (img.height / ch);
          ctx.save();
          ctx.font = canvasFontString(fontSize, text.fontFamily, text.bold, text.italic);
          ctx.fillStyle = text.color;
          ctx.textBaseline = 'top';
          const lines = text.text.split('\n');
          const lineHeight = fontSize * 1.2;
          lines.forEach((line, lineIdx) => {
            ctx.fillText(line, drawX, drawY + lineIdx * lineHeight);
          });
          ctx.restore();
        });

        // Draw form fields
        formFields.forEach(field => {
          if (field.pageIndex !== 1) return;
          const cw = field.canvasWidth || displayWidth;
          const ch = field.canvasHeight || displayHeight;
          const drawX = (field.pos.x / cw) * img.width;
          const drawY = (field.pos.y / ch) * img.height;
          const drawW = (field.pos.width / cw) * img.width;
          const drawH = (field.pos.height / ch) * img.height;
          ctx.save();
          if (field.type === 'checkbox') {
            const fc = field.color || '#16A34A';
            const boxSize = Math.min(drawH * 0.7, drawW * 0.7);
            const bx = drawX + drawH * 0.15;
            const by = drawY + (drawH - boxSize) / 2;
            ctx.strokeStyle = fc;
            ctx.lineWidth = 2;
            ctx.strokeRect(bx, by, boxSize, boxSize);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(bx + 1, by + 1, boxSize - 2, boxSize - 2);
            if (field.checked) {
              ctx.fillStyle = fc;
              ctx.font = `bold ${boxSize * 0.8}px sans-serif`;
              ctx.textBaseline = 'middle';
              ctx.fillText('✓', bx + boxSize * 0.15, by + boxSize * 0.55);
            }
          } else if (field.type === 'radio') {
            const fc = field.color || '#7C3AED';
            const radius = Math.min(drawH * 0.35, drawW * 0.35);
            const cx = drawX + drawH * 0.15 + radius;
            const cy = drawY + drawH / 2;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.strokeStyle = fc;
            ctx.lineWidth = 2;
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();
            ctx.stroke();
            if (field.checked) {
              ctx.beginPath();
              ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
              ctx.fillStyle = fc;
              ctx.fill();
            }
          } else if (field.type === 'textarea') {
            ctx.strokeStyle = '#9CA3AF';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(drawX, drawY, drawW, drawH);
            if (field.text) {
              const fSize = (field.fontSize || 14) * (img.height / ch);
              ctx.fillStyle = '#1a1a1a';
              ctx.font = `${fSize}px sans-serif`;
              ctx.textBaseline = 'top';
              const lines = field.text.split('\n');
              const lineH = fSize * 1.3;
              lines.forEach((line, lineIdx) => {
                ctx.fillText(line, drawX + 6, drawY + 6 + lineIdx * lineH);
              });
            }
          }

          if (field.comment) {
            const fc = field.color || '#000000';
            const commentFontSize = 8 * (img.height / ch);
            ctx.save();
            ctx.font = `semibold ${commentFontSize}px sans-serif`;
            ctx.fillStyle = fc;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            const textX = drawX + drawW / 2;
            const textY = drawY + drawH + 6 * (img.height / ch);
            ctx.fillText(field.comment, textX, textY);
            ctx.restore();
          }

          ctx.restore();
        });

        // Draw freehand / shape markup (above content)
        drawings.forEach(d => {
          if (d.pageIndex !== 1) return;
          const cw = d.canvasWidth || displayWidth;
          const ch = d.canvasHeight || displayHeight;
          drawDrawingToCanvas(ctx, d, cw, ch, img.width, img.height);
        });

        // Draw comment notes (top-most)
        comments.forEach(c => {
          if (c.pageIndex !== 1) return;
          const cw = c.canvasWidth || displayWidth;
          const ch = c.canvasHeight || displayHeight;
          drawCommentToCanvas(ctx, c, cw, ch, img.width, img.height);
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

  const handleDownloadAsPng = async () => {
    if (!documentFile || !hasActions || documentFile.type !== 'pdf') return;
    setIsExporting(true);
    setIsDownloadDropdownOpen(false);
    try {
      const arrayBuffer = await documentFile.file.arrayBuffer();
      const pdfjsDoc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
      // Find the current visible page (default to 1)
      let currentPageNum = 1;
      for (let p = 1; p <= pdfjsDoc.numPages; p++) {
        const el = document.getElementById(`document-canvas-content-${p}`);
        if (el) { currentPageNum = p; break; }
      }
      const pdfjsPage = await pdfjsDoc.getPage(currentPageNum);
      const scale = 2; // High-res export
      const viewport = pdfjsPage.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await pdfjsPage.render({ canvasContext: ctx, viewport, canvas } as any).promise;

      const pageEl = document.getElementById(`document-canvas-content-${currentPageNum}`);
      const displayWidth = pageEl?.clientWidth || viewport.width / scale;
      const displayHeight = pageEl?.clientHeight || viewport.height / scale;
      const scaleX = viewport.width / displayWidth;
      const scaleY = viewport.height / displayHeight;

      // Draw redacts
      redacts.forEach(r => {
        if (r.pageIndex !== currentPageNum) return;
        const cw = r.canvasWidth || displayWidth;
        const ch = r.canvasHeight || displayHeight;
        const x = (r.pos.x / cw) * viewport.width;
        const y = (r.pos.y / ch) * viewport.height;
        const w = (r.pos.width / cw) * viewport.width;
        const h = (r.pos.height / ch) * viewport.height;
        ctx.fillStyle = r.color;
        ctx.fillRect(x, y, w, h);
      });

      // Draw signatures
      if (signature && signature.instances.length > 0) {
        const allUrls: string[] = Array.from(new Set(signature.instances.map(i => i.url || signature.url)));
        if (allUrls.length === 0) allUrls.push(signature.url);
        const loadedImages = new Map<string, HTMLImageElement>();
        for (const url of allUrls) {
          const sigImg = new window.Image();
          sigImg.src = url;
          await new Promise((resolve, reject) => { sigImg.onload = resolve; sigImg.onerror = reject; });
          loadedImages.set(url, sigImg);
        }
        signature.instances.forEach(instance => {
          if (signature.applyMode === 'all') { if (isPageInRange(signature.excludedPages, currentPageNum)) return; }
          else if (signature.applyMode === 'custom') { if (!isPageInRange(signature.customPages, currentPageNum)) return; }
          else { if (instance.pageIndex !== currentPageNum) return; }
          const instCW = instance.canvasWidth || displayWidth;
          const instCH = instance.canvasHeight || displayHeight;
          const normX = instance.pos.x / instCW;
          const normY = instance.pos.y / instCH;
          const normW = instance.pos.width / instCW;
          const normH = instance.pos.height / instCH;
          const imgToDraw = loadedImages.get(instance.url || signature.url);
          if (imgToDraw) {
            ctx.save();
            const drawX = normX * viewport.width;
            const drawY = normY * viewport.height;
            const drawW = normW * viewport.width;
            const drawH = normH * viewport.height;
            ctx.translate(drawX + drawW / 2, drawY + drawH / 2);
            ctx.rotate((instance.rotation || 0) * Math.PI / 180);
            ctx.drawImage(imgToDraw, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx.restore();
          }
        });
      }

      // Draw stamps
      for (const stamp of stamps) {
        if (stamp.pageIndex !== currentPageNum) continue;
        const stampImg = new window.Image();
        stampImg.src = stamp.url;
        await new Promise((resolve, reject) => { stampImg.onload = resolve; stampImg.onerror = reject; });
        const cw = stamp.canvasWidth || displayWidth;
        const ch = stamp.canvasHeight || displayHeight;
        const drawX = (stamp.pos.x / cw) * viewport.width;
        const drawY = (stamp.pos.y / ch) * viewport.height;
        const drawW = (stamp.pos.width / cw) * viewport.width;
        const drawH = (stamp.pos.height / ch) * viewport.height;
        ctx.save();
        ctx.translate(drawX + drawW / 2, drawY + drawH / 2);
        ctx.rotate((stamp.rotation || 0) * Math.PI / 180);
        ctx.drawImage(stampImg, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
      }

      // Draw texts
      await ensureTextFontsLoaded(texts.filter(t => t.pageIndex === currentPageNum));
      texts.forEach(text => {
        if (text.pageIndex !== currentPageNum) return;
        const cw = text.canvasWidth || displayWidth;
        const ch = text.canvasHeight || displayHeight;
        const drawX = (text.pos.x / cw) * viewport.width;
        const drawY = (text.pos.y / ch) * viewport.height;
        const fontSize = text.fontSize * (viewport.height / ch);
        ctx.save();
        ctx.font = canvasFontString(fontSize, text.fontFamily, text.bold, text.italic);
        ctx.fillStyle = text.color;
        ctx.textBaseline = 'top';
        const lines = text.text.split('\n');
        const lineHeight = fontSize * 1.2;
        lines.forEach((line, lineIdx) => {
          ctx.fillText(line, drawX, drawY + lineIdx * lineHeight);
        });
        ctx.restore();
      });

      // Draw form fields
      formFields.forEach(field => {
        if (field.pageIndex !== currentPageNum) return;
        const cw = field.canvasWidth || displayWidth;
        const ch = field.canvasHeight || displayHeight;
        const drawX = (field.pos.x / cw) * viewport.width;
        const drawY = (field.pos.y / ch) * viewport.height;
        const drawW = (field.pos.width / cw) * viewport.width;
        const drawH = (field.pos.height / ch) * viewport.height;
        ctx.save();
        if (field.type === 'checkbox') {
          const fc = field.color || '#16A34A';
          const boxSize = Math.min(drawH * 0.7, drawW * 0.7);
          const bx = drawX + drawH * 0.15;
          const by = drawY + (drawH - boxSize) / 2;
          ctx.strokeStyle = fc;
          ctx.lineWidth = 2;
          ctx.strokeRect(bx, by, boxSize, boxSize);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(bx + 1, by + 1, boxSize - 2, boxSize - 2);
          if (field.checked) {
            ctx.fillStyle = fc;
            ctx.font = `bold ${boxSize * 0.8}px sans-serif`;
            ctx.textBaseline = 'middle';
            ctx.fillText('✓', bx + boxSize * 0.15, by + boxSize * 0.55);
          }
        } else if (field.type === 'radio') {
          const fc = field.color || '#7C3AED';
          const radius = Math.min(drawH * 0.35, drawW * 0.35);
          const cx = drawX + drawH * 0.15 + radius;
          const cy = drawY + drawH / 2;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.strokeStyle = fc;
          ctx.lineWidth = 2;
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
          ctx.stroke();
          if (field.checked) {
            ctx.beginPath();
            ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
            ctx.fillStyle = fc;
            ctx.fill();
          }
        } else if (field.type === 'textarea') {
          ctx.strokeStyle = '#9CA3AF';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(drawX, drawY, drawW, drawH);
          if (field.text) {
            const fSize = (field.fontSize || 14) * (viewport.height / ch);
            ctx.fillStyle = '#1a1a1a';
            ctx.font = `${fSize}px sans-serif`;
            ctx.textBaseline = 'top';
            const fieldLines = field.text.split('\n');
            const lineH = fSize * 1.3;
            fieldLines.forEach((line, lineIdx) => {
              ctx.fillText(line, drawX + 6, drawY + 6 + lineIdx * lineH);
            });
          }
        }

        if (field.comment) {
          const fc = field.color || '#000000';
          const commentFontSize = 8 * (viewport.height / ch);
          ctx.save();
          ctx.font = `semibold ${commentFontSize}px sans-serif`;
          ctx.fillStyle = fc;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          const textX = drawX + drawW / 2;
          const textY = drawY + drawH + 6 * (viewport.height / ch);
          ctx.fillText(field.comment, textX, textY);
          ctx.restore();
        }

        ctx.restore();
      });

      // Draw freehand / shape markup (above content)
      drawings.forEach(d => {
        if (d.pageIndex !== currentPageNum) return;
        const cw = d.canvasWidth || displayWidth;
        const ch = d.canvasHeight || displayHeight;
        drawDrawingToCanvas(ctx, d, cw, ch, viewport.width, viewport.height);
      });

      // Draw comment notes (top-most)
      comments.forEach(c => {
        if (c.pageIndex !== currentPageNum) return;
        const cw = c.canvasWidth || displayWidth;
        const ch = c.canvasHeight || displayHeight;
        drawCommentToCanvas(ctx, c, cw, ch, viewport.width, viewport.height);
      });

      canvas.toBlob((blob) => {
        if (blob) {
          downloadBlob(blob, `signed_${documentFile.name.replace(/\.[^/.]+$/, '')}_page${currentPageNum}.png`);
        }
      }, 'image/png');
    } catch (err) {
      console.error('PNG export error', err);
      alert('An error occurred while exporting as PNG.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-slate-50 font-sans text-slate-800 overflow-hidden">
      {/* Top Header */}
      <header className="h-16 md:h-18 px-4 md:px-8 flex items-center gap-2 z-20 shrink-0 bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="w-8 h-8 md:w-10 md:h-10 shrink-0 flex items-center justify-center p-0.5 rounded-xl border border-indigo-100 shadow-sm bg-gradient-to-tr from-white to-indigo-50"
          >
            <img src="/favicon.svg" alt="Logo" className="w-full h-full object-contain" />
          </motion.div>
          
          <h1 className="font-display text-base md:text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 hidden sm:block whitespace-nowrap shrink-0">
            SignFlow <span className="font-sans font-medium text-slate-400">Studio</span>
          </h1>
          <div className="h-5 w-[1px] bg-slate-200 mx-1 md:mx-2 hidden sm:block shrink-0"></div>
          <span
            title={documentFile ? documentFile.name : undefined}
            className="text-slate-500 font-medium text-xs md:text-sm truncate flex-1 md:flex-none md:max-w-[110px] lg:max-w-[150px] min-[1750px]:max-w-[240px]"
          >
            {documentFile ? documentFile.name : 'No document selected'}
          </span>
        </div>
        
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-1 ml-2 lg:ml-4 shrink-0 bg-slate-100/80 backdrop-blur-md p-1 rounded-xl shadow-inner">
           {['Fill & Sign', 'Organize', 'Compress', 'Convert'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`relative whitespace-nowrap px-2.5 lg:px-3 min-[1750px]:px-4 py-1.5 text-sm font-semibold rounded-lg transition-all duration-300 ${activeTab === tab ? 'text-indigo-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'}`}
            >
              {activeTab === tab && (
                <motion.div layoutId="navIndicator" className="absolute inset-0 bg-white rounded-lg shadow-sm border border-slate-200/50 pointer-events-none" />
              )}
              <span className="relative z-10">{tab}</span>
            </button>
          ))}
          {/* More tools dropdown */}
          {(() => {
            const moreGroups = [
              {
                heading: 'Organize Pages',
                items: [
                  { id: 'Split', label: 'Split', desc: 'Separate into multiple files', icon: <Scissors size={17} />, accent: 'text-blue-600 bg-blue-50 border-blue-100' },
                  { id: 'Merge', label: 'Merge', desc: 'Combine files into one', icon: <Combine size={17} />, accent: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
                  { id: 'Numbering', label: 'Page Numbers', desc: 'Add automatic numbering', icon: <Hash size={17} />, accent: 'text-amber-600 bg-amber-50 border-amber-100' },
                ],
              },
              {
                heading: 'Protect & Brand',
                items: [
                  { id: 'DigitalSign', label: 'Digital Signature', desc: 'Sign with a certificate', icon: <FileSignature size={17} />, accent: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
                  { id: 'Watermark', label: 'Watermark', desc: 'Overlay text or an image', icon: <Droplet size={17} />, accent: 'text-cyan-600 bg-cyan-50 border-cyan-100' },
                  { id: 'Protect', label: 'Protect', desc: 'Encrypt with a password', icon: <Lock size={17} />, accent: 'text-rose-600 bg-rose-50 border-rose-100' },
                ],
              },
              {
                heading: 'Create & Extract',
                items: [
                  { id: 'PrepareForm', label: 'Prepare Form', desc: 'Auto-detect fields → fillable PDF', icon: <FormInput size={17} />, accent: 'text-fuchsia-600 bg-fuchsia-50 border-fuchsia-100' },
                  { id: 'OCR', label: 'Extract Text', desc: 'Recognize text with OCR', icon: <ScanText size={17} />, accent: 'text-violet-600 bg-violet-50 border-violet-100' },
                  { id: 'Templates', label: 'Templates', desc: 'Start from a ready-made form', icon: <LayoutTemplate size={17} />, accent: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
                ],
              },
              {
                heading: 'Review',
                items: [
                  { id: 'Compare', label: 'Compare', desc: 'Diff two PDFs side by side', icon: <GitCompareArrows size={17} />, accent: 'text-cyan-600 bg-cyan-50 border-cyan-100' },
                ],
              },
              {
                heading: 'AI Tools',
                items: [
                  { id: 'AskAI', label: 'Ask AI', desc: 'Chat with & summarize a PDF', icon: <Sparkles size={17} />, accent: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
                ],
              },
            ];
            const isMoreActive = moreGroups.some(g => g.items.some(t => t.id === activeTab));
            return (
              <div className="relative" data-more-tools>
                <button
                  onClick={() => setMoreToolsOpen(o => !o)}
                  className={`relative whitespace-nowrap px-2.5 lg:px-3 min-[1750px]:px-4 py-1.5 text-sm font-semibold rounded-lg transition-all duration-300 flex items-center gap-1 ${isMoreActive ? 'text-indigo-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'}`}
                >
                  {isMoreActive && (
                    <motion.div layoutId="navIndicator" className="absolute inset-0 bg-white rounded-lg shadow-sm border border-slate-200/50 pointer-events-none" />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    More <ChevronDown size={14} className={`transition-transform ${moreToolsOpen ? 'rotate-180' : ''}`} />
                  </span>
                </button>
                <AnimatePresence>
                  {moreToolsOpen && (
                    <>
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute left-0 top-full mt-2 w-[20rem] bg-white rounded-2xl shadow-[0_16px_50px_-10px_rgba(0,0,0,0.22)] border border-slate-200/80 overflow-hidden z-50"
                      >
                        <div className="px-4 pt-3.5 pb-2.5 border-b border-slate-100">
                          <p className="text-sm font-bold text-slate-800">More Tools</p>
                          <p className="text-xs text-slate-400 font-medium">Edit, secure, and convert your document</p>
                        </div>
                        <div className="max-h-[70vh] overflow-y-auto py-1.5">
                          {moreGroups.map(group => (
                            <div key={group.heading} className="px-2 py-1">
                              <p className="px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{group.heading}</p>
                              {group.items.map(t => {
                                const isActive = activeTab === t.id;
                                return (
                                  <button
                                    key={t.id}
                                    onClick={() => { setActiveTab(t.id as any); setMoreToolsOpen(false); }}
                                    className={`group/item w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left transition-colors ${isActive ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                                  >
                                    <span className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-lg border ${t.accent}`}>
                                      {t.icon}
                                    </span>
                                    <span className="flex flex-col min-w-0">
                                      <span className={`text-sm font-semibold leading-tight ${isActive ? 'text-indigo-700' : 'text-slate-700'}`}>{t.label}</span>
                                      <span className="text-xs text-slate-400 font-medium truncate">{t.desc}</span>
                                    </span>
                                    {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            );
          })()}
        </div>

        {/* Global Action Button */}
        <div className="flex items-center gap-2 md:gap-2.5 ml-auto shrink-0">
          {/* Start New / Cancel Button */}
          {documentFile && (
            <button
              onClick={() => {
                if (!hasActions || window.confirm('Start a new document? Your current signatures, text, stamps and other edits will be discarded.')) {
                  handleStartAgain();
                }
              }}
              className="h-9 md:h-10 px-2.5 md:px-3 min-[1750px]:px-4 flex items-center gap-1.5 md:gap-2 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-slate-600 hover:text-rose-600 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
              title="Start over with a new document"
            >
              <RotateCcw size={16} className="shrink-0" strokeWidth={2} />
              <span className="text-xs md:text-sm font-semibold whitespace-nowrap hidden min-[1750px]:inline">New</span>
            </button>
          )}

          {/* History Button */}
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="h-9 md:h-10 px-2.5 md:px-3 min-[1750px]:px-4 flex items-center gap-1.5 md:gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
            title="View File History"
          >
            <History size={16} className="text-slate-400 shrink-0" strokeWidth={2} />
            <span className="text-xs md:text-sm font-semibold whitespace-nowrap hidden min-[1750px]:inline">History</span>
            <span className="text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-md px-1.5 py-0.5 font-bold text-[10px] md:text-xs leading-none">
              {recentFiles.length}
            </span>
          </button>

          {/* Ask AI Button — opens the current document in the AI chat tool */}
          {activeTab === 'Fill & Sign' && documentFile && documentFile.type === 'pdf' && (
            <button
              onClick={() => setActiveTab('AskAI')}
              title="Chat with this PDF and get an instant AI summary"
              className="h-9 md:h-10 px-2.5 md:px-3 min-[1750px]:px-4 flex items-center gap-1.5 md:gap-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
            >
              <Sparkles size={16} className="shrink-0" strokeWidth={2} />
              <span className="text-xs md:text-sm font-semibold whitespace-nowrap hidden min-[1750px]:inline">Ask AI</span>
            </button>
          )}

          {/* Save as Template Button */}
          {activeTab === 'Fill & Sign' && documentFile && (
            <button
              onClick={handleOpenSaveTemplate}
              disabled={!canSaveTemplate}
              title={canSaveTemplate ? 'Save this document & its fields as a reusable template' : 'Place at least one field or text box to save as a template'}
              className="h-9 md:h-10 px-2.5 md:px-3 min-[1750px]:px-4 flex items-center gap-1.5 md:gap-2 rounded-xl border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-200 text-slate-600 hover:text-indigo-600 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-slate-600 disabled:hover:border-slate-200"
            >
              <LayoutTemplate size={16} className="shrink-0" strokeWidth={2} />
              <span className="text-xs md:text-sm font-semibold whitespace-nowrap hidden min-[1750px]:inline">Save as Template</span>
            </button>
          )}

          {/* Mobile Download Button */}
          {activeTab === 'Fill & Sign' && documentFile && hasActions && (
            <div className="md:hidden relative">
              <button
                onClick={() => setIsMobileDownloadOpen(prev => !prev)}
                disabled={isExporting}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md disabled:opacity-50 active:scale-95 transition-all"
              >
                {isExporting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <Download size={16} strokeWidth={2.5} />
                )}
              </button>
              <AnimatePresence>
                {isMobileDownloadOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsMobileDownloadOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.96 }}
                      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute right-0 top-full mt-2 w-52 bg-white/95 backdrop-blur-xl rounded-xl shadow-[0_10px_40px_-8px_rgba(0,0,0,0.15)] border border-slate-200/80 overflow-hidden z-50"
                    >
                      <div className="px-3 pt-2.5 pb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Export Format</span>
                      </div>
                      <button
                        onClick={() => { setIsMobileDownloadOpen(false); handleDownload(); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-indigo-50/70 active:bg-indigo-50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                          <Download size={14} className="text-red-500" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-800">PDF Document</span>
                          <span className="text-[10px] text-slate-400 font-medium">Best for sharing</span>
                        </div>
                      </button>
                      <div className="mx-3 border-t border-slate-100" />
                      <button
                        onClick={() => { setIsMobileDownloadOpen(false); handleDownloadAsPng(); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-indigo-50/70 active:bg-indigo-50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0">
                          <FileImage size={14} className="text-violet-500" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-800">PNG Image</span>
                          <span className="text-[10px] text-slate-400 font-medium">Quick attachment</span>
                        </div>
                      </button>
                      <div className="px-3 pt-1.5 pb-2.5">
                        <p className="text-[9px] text-slate-400 font-medium text-center">All processing happens locally</p>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}
          {activeTab === 'Fill & Sign' && (
            <div className="hidden md:flex items-center relative">
              <button 
<<<<<<< HEAD
                onClick={handleDownload}
                disabled={!documentFile || !signature || isExporting}
                className="hidden md:flex group relative px-4 md:px-6 py-2 md:py-2.5 text-xs md:text-sm font-bold text-white shadow-[0_4px_14px_0_rgb(79,70,229,39%)] hover:shadow-[0_6px_20px_rgba(79,70,229,23%)] disabled:shadow-none bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed items-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
=======
                onClick={() => {
                  if (documentFile?.type === 'pdf') {
                    setIsDownloadDropdownOpen(prev => !prev);
                  } else {
                    handleDownload();
                  }
                }}
                disabled={!documentFile || !hasActions || isExporting}
                title={!hasActions ? 'Add at least one signature, stamp, text, or redaction before downloading' : ''}
                className="group relative px-4 md:px-5 min-[1750px]:px-6 py-2 md:py-2.5 text-xs md:text-sm font-bold text-white shadow-[0_4px_14px_0_rgb(79,70,229,39%)] hover:shadow-[0_6px_20px_rgba(79,70,229,23%)] disabled:shadow-none bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
>>>>>>> feat/prepare-form
              >
                {isExporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span className="hidden sm:inline">Exporting...</span>
                  </>
                ) : (
                  <>
<<<<<<< HEAD
                     <span className="hidden sm:inline">Finish & Download</span>
                     <span className="sm:hidden">Download</span>
=======
                    <Download size={16} strokeWidth={2.5} />
                    <span className="hidden min-[1750px]:inline">Finish &amp; Download</span>
                    <span className="min-[1750px]:hidden">Download</span>
                    {documentFile?.type === 'pdf' && (
                      <ChevronDown size={14} strokeWidth={2.5} className={`ml-0.5 transition-transform duration-200 ${isDownloadDropdownOpen ? 'rotate-180' : ''}`} />
                    )}
>>>>>>> feat/prepare-form
                  </>
                )}
              </button>
              {/* Format dropdown menu (PDF docs only) */}
              <AnimatePresence>
                {isDownloadDropdownOpen && documentFile?.type === 'pdf' && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.96 }}
                    transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute right-0 top-full mt-2 w-56 bg-white/95 backdrop-blur-xl rounded-xl shadow-[0_10px_40px_-8px_rgba(0,0,0,0.12)] border border-slate-200/80 overflow-hidden z-50"
                  >
                    <div className="px-3 pt-2.5 pb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Export Format</span>
                    </div>
                    <button
                      onClick={() => { setIsDownloadDropdownOpen(false); handleDownload(); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-indigo-50/70 transition-colors group/item"
                    >
                      <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                        <Download size={14} className="text-red-500" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800 group-hover/item:text-indigo-700 transition-colors">PDF Document</span>
                        <span className="text-[10px] text-slate-400 font-medium">Best for sharing & printing</span>
                      </div>
                    </button>
                    <div className="mx-3 border-t border-slate-100" />
                    <button
                      onClick={() => { setIsDownloadDropdownOpen(false); handleDownloadAsPng(); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-indigo-50/70 transition-colors group/item"
                    >
                      <div className="w-8 h-8 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0">
                        <FileImage size={14} className="text-violet-500" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800 group-hover/item:text-indigo-700 transition-colors">PNG Image</span>
                        <span className="text-[10px] text-slate-400 font-medium">Best for quick attachments</span>
                      </div>
                    </button>
                    <div className="px-3 pt-1.5 pb-2.5">
                      <p className="text-[9px] text-slate-400 font-medium text-center">All processing happens locally</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
<<<<<<< HEAD
      <div className="flex flex-col flex-1 overflow-hidden relative mb-14 md:mb-0">
=======
      {/* On mobile, reserve extra bottom space when the persistent tools bar is shown
          (Fill & Sign with a document) so the document isn't hidden behind it. */}
      <div className={cn(
        "flex flex-col flex-1 overflow-hidden relative md:mb-0",
        activeTab === 'Fill & Sign' && documentFile ? "mb-[7.75rem]" : "mb-14"
      )}>
>>>>>>> feat/prepare-form
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
<<<<<<< HEAD
                  className="w-full max-w-xl bg-white/70 backdrop-blur-xl border border-slate-200/50 rounded-3xl p-8 md:p-12 text-center shadow-[0_20px_50px_-20px_rgba(79,70,229,0.15)] relative group hover:shadow-[0_25px_60px_-15px_rgba(79,70,229,0.22)] hover:border-indigo-200/80 transition-all duration-500"
=======
                  className="edge-highlight w-full max-w-xl bg-white/75 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-8 md:p-12 text-center shadow-[0_30px_70px_-28px_rgba(79,70,229,0.30)] relative group hover:shadow-[0_36px_80px_-24px_rgba(79,70,229,0.34)] hover:border-indigo-200/80 hover:-translate-y-0.5 transition-all duration-500"
>>>>>>> feat/prepare-form
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
                  
<<<<<<< HEAD
                  <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight leading-tight">
=======
                  <h2 className="font-display text-2xl md:text-3xl font-bold text-slate-800 tracking-tight leading-tight">
>>>>>>> feat/prepare-form
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
<<<<<<< HEAD
=======


>>>>>>> feat/prepare-form
              </div>
            ) : (
              /* ============================================================
                 2. DOCUMENT PRESENT STATE - PREMIUM REDESIGN
                 ============================================================ */
<<<<<<< HEAD
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
=======
              <div className="flex-1 flex flex-row overflow-hidden">
                {/* ── Vertical Tool Palette ── */}
                <div className="hidden md:flex flex-col w-14 shrink-0 bg-white/95 backdrop-blur-xl border-r border-slate-200/60 items-center py-4 gap-1 z-20">
                  {([
                    { id: 'sign' as const, icon: <Pen size={18} strokeWidth={2} />, label: 'Sign' },
                    { id: 'stamp' as const, icon: <Stamp size={18} strokeWidth={2} />, label: 'Stamp' },
                    { id: 'fields' as const, icon: <CheckSquare size={18} strokeWidth={2} />, label: 'Fields' },
                    { id: 'comment' as const, icon: <MessageSquare size={18} strokeWidth={2} />, label: 'Comment' },
                    { id: 'draw' as const, icon: <Pencil size={18} strokeWidth={2} />, label: 'Draw' },
                    { id: 'redact' as const, icon: <RectangleHorizontal size={18} strokeWidth={2} />, label: 'Redact' },
                    { id: 'editText' as const, icon: <Type size={18} strokeWidth={2} />, label: 'Edit Text' },
                  ]).map(tool => (
                    <button
                      key={tool.id}
                      onClick={() => {
                        setActiveTool(tool.id);
                        setStampPlacementMode(false);
                        setRedactPlacementMode(false);
                        setTextPlacementMode(false);
                        setFormFieldPlacementMode(false);
                        setCommentPlacementMode(false);
                        setDrawMode(false);
                      }}
                      className={cn(
                        "w-11 h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer",
                        activeTool === tool.id
                          ? "bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200"
                          : "text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                      )}
                      title={tool.label}
                    >
                      {tool.icon}
                      <span className="text-[8px] font-bold leading-none">{tool.label}</span>
                    </button>
                  ))}
                  <div className="flex-1" />
                  {hasActions && (
                    <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[10px] font-extrabold text-emerald-700" title="Total annotations">
                      {(signature?.instances?.length ?? 0) + texts.length + stamps.length + redacts.length + formFields.length + comments.length + drawings.length}
                    </div>
                  )}
                </div>

                {/* ── Context Panel ── */}
                <AnimatePresence>
                  {activeTool && (
                    <motion.div
                      initial={{ opacity: 0, x: -240 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -240 }}
                      transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                      className="hidden md:flex w-64 shrink-0 bg-white/95 backdrop-blur-xl border-r border-slate-200/60 shadow-lg flex-col h-full overflow-y-auto z-20"
                    >
                      <div className="p-4 space-y-4 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                            {activeTool === 'sign' && 'Signatures'}
                            {activeTool === 'stamp' && 'Stamps'}
                            {activeTool === 'fields' && 'Fields'}
                            {activeTool === 'comment' && 'Comments'}
                            {activeTool === 'draw' && 'Draw & Markup'}
                            {activeTool === 'redact' && 'Redact'}
                            {activeTool === 'editText' && 'Edit Text'}
                          </span>
                        </div>

                        {/* ─── SIGN PANEL ─── */}
                        {activeTool === 'sign' && (
                          <div className="space-y-4">
                            <div className="flex gap-2">
                              <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition-colors cursor-pointer">
                                <Upload size={14} /> Upload
                                <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadSig(f); }} />
                              </label>
                              <button onClick={() => setIsDrawing(true)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition-colors cursor-pointer">
                                <PenTool size={14} /> Draw
                              </button>
                            </div>
                            {savedAssets.length > 0 && (
                              <div className="space-y-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Saved Signatures</span>
                                <div className="grid grid-cols-2 gap-3">
                                  {savedAssets.map(asset => (
                                    <div key={asset.id} className="relative group">
                                      <button onClick={() => { setSignature(prev => ({ url: asset.url, originalUrl: asset.originalUrl, bgRemovalTolerance: 50, bgRemovalMode: prev?.bgRemovalMode || 'auto', pos: { x: 100, y: 100, width: 150, height: 150 / asset.aspectRatio }, applyMode: prev ? prev.applyMode : 'single', customPages: prev ? prev.customPages : '', excludedPages: prev ? prev.excludedPages : '', instances: prev ? prev.instances : [], aspectRatio: asset.aspectRatio, tintColor: asset.tintColor })); if (mobile) { setIsMobileSidebarOpen(false); setIsPlacementMode(true); } }}
                                        draggable onDragStart={(e) => { e.dataTransfer.setData("application/my-signature", JSON.stringify({ url: asset.url, aspectRatio: asset.aspectRatio })); }}
                                        className={cn("w-full aspect-[4/3] border rounded-lg flex items-center justify-center p-1.5 bg-slate-50 transition-all cursor-grab active:cursor-grabbing hover:scale-105", signature?.originalUrl === asset.originalUrl ? "border-indigo-500 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-200" : "border-slate-200 hover:border-indigo-300")}>
                                        <img src={signature?.originalUrl === asset.originalUrl ? signature.url : asset.url} className="max-w-full max-h-full object-contain pointer-events-none" />
                                      </button>
                                      {/* Edit (eraser) overlay — opens the in-app image editor. The wrapper is
                                          pointer-events-none so dragging still works on the thumbnail; only the
                                          small Edit chip is clickable. */}
                                      <div className="absolute inset-x-0 top-0 aspect-[4/3] flex items-end justify-center pb-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                        <button onClick={(e) => { e.stopPropagation(); setEditingAsset(asset); }} title="Edit / erase parts"
                                          className="pointer-events-auto flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/95 text-indigo-700 text-[10px] font-bold shadow-sm border border-slate-200 hover:bg-indigo-50 cursor-pointer"><Eraser size={11} /> Edit</button>
                                      </div>
                                      {/* Color tint dots */}
                                      <div className="flex items-center justify-center gap-1 mt-1">
                                        {[
                                          { name: 'Original', value: undefined, bg: 'bg-white border-slate-300', style: { backgroundImage: 'linear-gradient(45deg, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%), linear-gradient(45deg, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%)', backgroundSize: '4px 4px', backgroundPosition: '0 0, 2px 2px' } },
                                          { name: 'Black', value: '#000000', bg: 'bg-black' },
                                          { name: 'Blue', value: '#2563eb', bg: 'bg-blue-600' },
                                          { name: 'Red', value: '#dc2626', bg: 'bg-red-600' },
                                          { name: 'Green', value: '#16a34a', bg: 'bg-green-600' },
                                        ].map(c => (
                                          <button key={c.name} onClick={(e) => { e.stopPropagation(); handleRecolorAsset(asset.id, c.value); }}
                                            className={cn("w-3.5 h-3.5 rounded-full border transition-transform hover:scale-125 cursor-pointer", c.bg,
                                              asset.tintColor === c.value ? "ring-2 ring-offset-1 ring-indigo-400 scale-110" : "border-slate-200")}
                                            style={c.style || {}} title={c.name} />
                                        ))}
                                      </div>
                                      <button onClick={(e) => { e.stopPropagation(); handleRotateAsset(asset.id); }} title="Rotate 90°" className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-white border border-slate-200 text-slate-400 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all z-10 cursor-pointer"><RotateCw size={9} /></button>
                                      <button onClick={(e) => { e.stopPropagation(); handleDeleteAsset(asset.id); }} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white border border-slate-200 text-slate-400 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all z-10 text-[8px] cursor-pointer">✕</button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {signature && (
                              <div className="space-y-4 border-t border-slate-100 pt-4">
                                {/* Background removal & enhancement live in the signature image
                                    editor (the "Edit" chip on each saved signature) — not here. */}
                                <div className="space-y-2">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Apply Scope</span>
                                  <div className="flex flex-col gap-2">
                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                                      <input type="radio" name="applyMode" value="single" checked={signature.applyMode === 'single'} onChange={() => setSignature(p => p ? { ...p, applyMode: 'single' } : null)} className="text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5" />
                                      <span>Current Page</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                                      <input type="radio" name="applyMode" value="all" checked={signature.applyMode === 'all'} onChange={() => setSignature(p => p ? { ...p, applyMode: 'all' } : null)} className="text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5" />
                                      <span>All Pages</span>
                                    </label>
                                    {signature.applyMode === 'all' && (
                                      <input type="text" value={signature.excludedPages || ''} onChange={(e) => setSignature(p => p ? { ...p, excludedPages: e.target.value } : null)} placeholder="Exclude pages (e.g. 1, 3-5)" className="ml-6 w-[calc(100%-1.5rem)] border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                                    )}
                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                                      <input type="radio" name="applyMode" value="custom" checked={signature.applyMode === 'custom'} onChange={() => setSignature(p => p ? { ...p, applyMode: 'custom' } : null)} className="text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5" />
                                      <span>Custom Range</span>
                                    </label>
                                    {signature.applyMode === 'custom' && (
                                      <input type="text" value={signature.customPages || ''} onChange={(e) => setSignature(p => p ? { ...p, customPages: e.target.value } : null)} placeholder="Pages (e.g. 1, 3-5)" className="ml-6 w-[calc(100%-1.5rem)] border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* ─── STAMP PANEL ─── */}
                        {activeTool === 'stamp' && (
                          <div className="space-y-4">
                            <label className="flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-slate-300 rounded-xl text-xs font-bold text-slate-500 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50/50 transition-colors cursor-pointer">
                              <Plus size={14} /> Upload Custom Stamp
                              <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadStamp(f); }} />
                            </label>
                            <div className="space-y-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Available Stamps</span>
                              <div className="grid grid-cols-2 gap-2">
                                {savedStamps.map(stamp => (
                                  <div key={stamp.id} className="relative group">
                                    <button onClick={() => {
                                        const img = new Image();
                                        img.src = stamp.url;
                                        img.onload = () => { setStampPlacementAsset({ url: stamp.url, aspectRatio: img.width / img.height }); setStampPlacementMode(true); setRedactPlacementMode(false); setTextPlacementMode(false); };
                                        if (stamp.url.startsWith('data:image/svg')) { setStampPlacementAsset({ url: stamp.url, aspectRatio: 200/80 }); setStampPlacementMode(true); setRedactPlacementMode(false); setTextPlacementMode(false); }
                                      }}
                                      className={cn("w-full aspect-[5/2] border rounded-lg flex items-center justify-center p-2 bg-slate-50 transition-all cursor-pointer hover:scale-105 hover:border-amber-400", stampPlacementAsset?.url === stamp.url && stampPlacementMode ? "border-amber-500 bg-amber-50/50 ring-1 ring-amber-200" : "border-slate-200")}>
                                      <img src={stamp.url} className="max-w-full max-h-full object-contain pointer-events-none" />
                                    </button>
                                    <span className="text-[9px] font-semibold text-slate-500 text-center block mt-1 truncate">{stamp.label}</span>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteStamp(stamp.id); }} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white border border-slate-200 text-slate-400 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all z-10 text-[8px] cursor-pointer">✕</button>
                                  </div>
                                ))}
                              </div>
                            </div>
                            {stampPlacementMode && (
                              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                                <p className="text-xs font-bold text-amber-800">Click on the document to place stamp</p>
                                <button onClick={() => { setStampPlacementMode(false); setStampPlacementAsset(null); }} className="mt-2 text-[10px] font-bold text-amber-600 hover:text-amber-800 underline cursor-pointer">Cancel</button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* ─── FORM FIELDS PANEL ─── */}
                        {activeTool === 'fields' && (
                          <div className="space-y-4">
                            {/* Text Box button */}
                            <button onClick={() => { setTextPlacementMode(prev => !prev); setStampPlacementMode(false); setRedactPlacementMode(false); setFormFieldPlacementMode(false); }}
                              className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all cursor-pointer",
                                textPlacementMode ? "bg-sky-600 text-white ring-2 ring-sky-300" : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200")}>
                              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", textPlacementMode ? "bg-white/20 text-white" : "bg-sky-500 text-white")}>
                                <Type size={16} />
                              </div>
                              {textPlacementMode ? 'Click on page...' : 'Add Text Box'}
                            </button>

                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Add Form Element</span>
                            <div className="space-y-2">
                              {([
                                { type: 'checkbox' as FormFieldType, icon: <CheckSquare size={18} />, label: 'Checkbox', defaultColor: '#16A34A', bg: 'bg-emerald-50', hover: 'hover:bg-emerald-100/70', border: 'border-emerald-200', text: 'text-emerald-700', iconColor: 'text-emerald-600' },
                                { type: 'radio' as FormFieldType, icon: <Circle size={18} />, label: 'Radio Button', defaultColor: '#7C3AED', bg: 'bg-violet-50', hover: 'hover:bg-violet-100/70', border: 'border-violet-200', text: 'text-violet-700', iconColor: 'text-violet-600' },
                                { type: 'textarea' as FormFieldType, icon: <AlignLeft size={18} />, label: 'Text Area', defaultColor: '#000000', bg: 'bg-amber-50', hover: 'hover:bg-amber-100/70', border: 'border-amber-200', text: 'text-amber-700', iconColor: 'text-amber-600' },
                              ]).map(field => {
                                const isActive = formFieldPlacementMode && formFieldPlacementType === field.type;
                                return (
                                <button
                                  key={field.type}
                                  onClick={() => {
                                    setFormFieldPlacementType(field.type);
                                    setFormFieldPlacementMode(true);
                                    setFormFieldColor(formFieldDefaultColors[field.type]);
                                    setStampPlacementMode(false);
                                    setRedactPlacementMode(false);
                                    setTextPlacementMode(false);
                                  }}
                                  className={cn(
                                    "w-full flex items-center gap-3 px-3.5 py-3 rounded-xl font-semibold text-sm border transition-all cursor-pointer",
                                    field.bg, field.border, field.text,
                                    isActive ? "ring-2 ring-current/40 shadow-sm" : field.hover
                                  )}
                                >
                                  <span className={cn("shrink-0", field.iconColor)}>{field.icon}</span>
                                  {isActive ? 'Click on page…' : `Add ${field.label}`}
                                </button>
                                );
                              })}
                            </div>
                            {formFieldPlacementMode && (
                              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 space-y-2.5">
                                <p className="text-xs font-bold text-indigo-800 text-center">Click on the document to place the {formFieldPlacementType}</p>
                                <div className="flex items-center justify-center gap-2 flex-wrap">
                                  {['#16A34A', '#7C3AED', '#DC2626', '#2563EB', '#D97706', '#000000'].map(c => (
                                    <button
                                      key={c}
                                      onClick={() => { setFormFieldColor(c); setDefaultFieldColor(formFieldPlacementType, c); }}
                                      className={cn("w-6 h-6 rounded-lg border-2 transition-transform hover:scale-110 cursor-pointer", formFieldColor.toLowerCase() === c.toLowerCase() ? "border-indigo-500 scale-110 shadow" : "border-white shadow-sm")}
                                      style={{ backgroundColor: c }}
                                      title={`Set ${c} as default`}
                                    />
                                  ))}
                                  <input
                                    type="color"
                                    value={formFieldColor}
                                    onChange={(e) => { setFormFieldColor(e.target.value); setDefaultFieldColor(formFieldPlacementType, e.target.value); }}
                                    className="w-6 h-6 rounded-lg border border-indigo-200 cursor-pointer p-0.5 bg-white"
                                    title="Custom default color"
                                  />
                                </div>
                                <p className="text-[10px] text-indigo-500 font-medium text-center">Default color for new {formFieldPlacementType} fields</p>
                                <button onClick={() => setFormFieldPlacementMode(false)} className="block mx-auto text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer">Cancel</button>
                              </div>
                            )}
                            {(texts.length > 0 || formFields.length > 0) && (
                              <div className="space-y-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Placed ({texts.length + formFields.length})</span>
                                <div className="space-y-1">
                                  {texts.map((t, i) => (
                                    <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-lg text-xs">
                                      <Type size={12} className="text-sky-500 shrink-0" />
                                      <span className="flex-1 truncate text-slate-600">{t.text || `Text ${i + 1}`}</span>
                                      <button onClick={() => setTexts(prev => prev.filter(tt => tt.id !== t.id))} className="text-slate-400 hover:text-red-500 cursor-pointer"><X size={12} /></button>
                                    </div>
                                  ))}
                                  {formFields.map((f, i) => (
                                    <div key={f.id} className="space-y-1.5 p-2 bg-slate-50 rounded-xl text-xs border border-slate-200/50">
                                      <div className="flex items-center gap-2">
                                        <div className="shrink-0" style={{ color: f.color || '#000' }}>
                                          {f.type === 'checkbox' && <CheckSquare size={12} />}
                                          {f.type === 'radio' && <Circle size={12} />}
                                          {f.type === 'textarea' && <AlignLeft size={12} />}
                                        </div>
                                        <span className="flex-1 truncate text-slate-600 font-semibold">
                                          {f.type === 'checkbox' ? 'Checkbox'
                                            : f.type === 'radio' ? 'Radio'
                                            : `Text Area ${i + 1}`}
                                        </span>
                                        <input
                                          type="color"
                                          value={f.color || '#000000'}
                                          onChange={(e) => setFormFields(prev => prev.map(ff => ff.id === f.id ? { ...ff, color: e.target.value } : ff))}
                                          className="w-5 h-5 rounded border border-slate-200 cursor-pointer p-0"
                                          title="Change color"
                                        />
                                        <button onClick={() => setFormFields(prev => prev.filter(ff => ff.id !== f.id))} className="text-slate-400 hover:text-red-500 cursor-pointer"><X size={12} /></button>
                                      </div>
                                      <div className="flex gap-1.5 items-center">
                                        <span className="text-[10px] text-slate-400 font-medium select-none shrink-0">Comment:</span>
                                        <input
                                          type="text"
                                          value={f.comment || ''}
                                          onChange={(e) => setFormFields(prev => prev.map(ff => ff.id === f.id ? { ...ff, comment: e.target.value } : ff))}
                                          placeholder="Add comment..."
                                          className="flex-1 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10px] text-slate-600 focus:outline-none focus:border-indigo-500"
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* ─── REDACT PANEL ─── */}
                        {activeTool === 'redact' && (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Rectangle Color</span>
                              <div className="flex gap-2 flex-wrap">
                                {[{ name: 'White', value: '#FFFFFF' }, { name: 'Black', value: '#000000' }, { name: 'Gray', value: '#9CA3AF' }, { name: 'Red', value: '#EF4444' }, { name: 'Yellow', value: '#FBBF24' }, { name: 'Blue', value: '#3B82F6' }].map(c => (
                                  <button key={c.name} onClick={() => setRedactColor(c.value)} className={cn("w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110 cursor-pointer", redactColor === c.value ? "border-slate-500 scale-110 shadow-md" : "border-slate-200")} style={{ backgroundColor: c.value }} title={c.name} />
                                ))}
                                <input type="color" value={redactColor} onChange={(e) => setRedactColor(e.target.value)} className="w-7 h-7 rounded-lg border border-slate-200 cursor-pointer p-0.5" title="Custom color" />
                              </div>
                            </div>
                            <button onClick={() => { setRedactPlacementMode(prev => !prev); setStampPlacementMode(false); setTextPlacementMode(false); }}
                              className={cn("w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer",
                                redactPlacementMode ? "bg-rose-600 text-white ring-2 ring-rose-300" : "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200")}>
                              <RectangleHorizontal size={16} />
                              {redactPlacementMode ? 'Click on page to place...' : 'Add Rectangle'}
                            </button>
                            {redacts.length > 0 && (
                              <div className="space-y-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Placed ({redacts.length})</span>
                                <div className="space-y-1">
                                  {redacts.map((r, i) => (
                                    <div key={r.id} className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-lg text-xs">
                                      <div className="w-4 h-3 rounded border border-slate-300 shrink-0" style={{ backgroundColor: r.color }} />
                                      <span className="flex-1 text-slate-600">Rectangle {i + 1}</span>
                                      <button onClick={() => setRedacts(prev => prev.filter(rr => rr.id !== r.id))} className="text-slate-400 hover:text-red-500 cursor-pointer"><X size={12} /></button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* ─── EDIT TEXT PANEL ─── */}
                        {activeTool === 'editText' && (
                          <div className="space-y-4">
                            <p className="text-xs text-slate-500 leading-relaxed">
                              Click any highlighted text in the document to edit it in place. The original is covered and a matching, editable text box is placed on top — double-click it to change the wording.
                            </p>
                            <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-[11px] leading-relaxed text-amber-800">
                              <span className="font-bold">Tip:</span> Works best on documents with a plain white background. Scanned PDFs have no text layer — run <span className="font-semibold">Extract Text (OCR)</span> first.
                            </div>
                          </div>
                        )}

                        {/* ─── COMMENT PANEL ─── */}
                        {activeTool === 'comment' && (
                          <div className="space-y-4">
                            <p className="text-xs text-slate-500 leading-relaxed">
                              Drop a sticky note anywhere on the document. Notes show a tinted background and a coloured header so readers know it's a comment.
                            </p>
                            <div className="space-y-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Note Colour</span>
                              <div className="flex gap-2 flex-wrap">
                                {COMMENT_COLORS.map(c => (
                                  <button key={c.value} onClick={() => setCommentColor(c.value)} className={cn("w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer", commentColor === c.value ? "border-slate-500 scale-110 shadow-md" : "border-slate-200")} style={{ backgroundColor: c.value }} title={c.name} />
                                ))}
                                <input type="color" value={commentColor} onChange={(e) => setCommentColor(e.target.value)} className="w-7 h-7 rounded-full border border-slate-200 cursor-pointer p-0.5" title="Custom colour" />
                              </div>
                            </div>
                            <button onClick={() => { setCommentPlacementMode(prev => !prev); setStampPlacementMode(false); setRedactPlacementMode(false); setTextPlacementMode(false); setFormFieldPlacementMode(false); setDrawMode(false); }}
                              className={cn("w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer",
                                commentPlacementMode ? "bg-amber-500 text-white ring-2 ring-amber-300" : "bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200")}>
                              <MessageSquare size={16} />
                              {commentPlacementMode ? 'Click on page to place…' : 'Add Comment'}
                            </button>
                            {comments.length > 0 && (
                              <div className="space-y-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Notes ({comments.length})</span>
                                <div className="space-y-1">
                                  {comments.map((c, i) => (
                                    <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-lg text-xs">
                                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                                      <span className="flex-1 text-slate-600 truncate">{c.text?.trim() || `Comment ${i + 1}`}</span>
                                      <button onClick={() => setComments(prev => prev.filter(cc => cc.id !== c.id))} className="text-slate-400 hover:text-red-500 cursor-pointer"><X size={12} /></button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* ─── DRAW & MARKUP PANEL ─── */}
                        {activeTool === 'draw' && (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Tool</span>
                              <div className="grid grid-cols-3 gap-1.5">
                                {DRAW_SHAPES.map(s => {
                                  const Icon = s.id === 'freehand' ? Pencil : s.id === 'rectangle' ? Square : s.id === 'ellipse' ? Circle : s.id === 'line' ? Minus : s.id === 'arrow' ? ArrowUpRight : s.id === 'redact' ? RectangleHorizontal : Highlighter;
                                  const isActive = drawMode && drawShape === s.id;
                                  return (
                                    <button key={s.id}
                                      onClick={() => { setDrawShape(s.id); if (s.id === 'highlight' && drawOpacity === 1) setDrawOpacity(0.4); if (s.id === 'redact' && drawOpacity !== 1) setDrawOpacity(1); setDrawMode(true); setStampPlacementMode(false); setRedactPlacementMode(false); setTextPlacementMode(false); setFormFieldPlacementMode(false); setCommentPlacementMode(false); }}
                                      className={cn("flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border text-[10px] font-bold transition-all cursor-pointer",
                                        isActive ? "bg-indigo-600 text-white border-indigo-600 shadow" : "bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600")}
                                      title={s.label}>
                                      <Icon size={16} />
                                      {s.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Colour</span>
                              <div className="flex gap-2 flex-wrap">
                                {DRAW_COLORS.map(c => (
                                  <button key={c.value} onClick={() => setDrawColor(c.value)} className={cn("w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer", drawColor === c.value ? "border-slate-500 scale-110 shadow-md" : "border-slate-200")} style={{ backgroundColor: c.value }} title={c.name} />
                                ))}
                                <input type="color" value={drawColor} onChange={(e) => setDrawColor(e.target.value)} className="w-7 h-7 rounded-full border border-slate-200 cursor-pointer p-0.5" title="Custom colour" />
                              </div>
                            </div>
                            {drawShape !== 'highlight' && drawShape !== 'redact' && (
                              <div className="space-y-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Stroke Width — {drawStrokeWidth}px</span>
                                <input type="range" min={1} max={12} value={drawStrokeWidth} onChange={(e) => setDrawStrokeWidth(parseInt(e.target.value, 10))} className="w-full cursor-pointer" />
                              </div>
                            )}
                            <div className="space-y-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Opacity — {Math.round(drawOpacity * 100)}%</span>
                              <input type="range" min={10} max={100} value={Math.round(drawOpacity * 100)} onChange={(e) => setDrawOpacity(parseInt(e.target.value, 10) / 100)} className="w-full cursor-pointer" />
                            </div>
                            <button onClick={() => setDrawMode(prev => !prev)}
                              className={cn("w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer",
                                drawMode ? "bg-indigo-600 text-white ring-2 ring-indigo-300" : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200")}>
                              <Pencil size={16} />
                              {drawMode ? 'Drawing — click to stop' : 'Start Drawing'}
                            </button>
                            {drawMode && (
                              <p className="text-[11px] text-indigo-600 font-medium text-center">Drag on the document to draw a {DRAW_SHAPES.find(s => s.id === drawShape)?.label.toLowerCase()}.</p>
                            )}
                            {drawings.length > 0 && (
                              <div className="space-y-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Markup ({drawings.length})</span>
                                <div className="space-y-1">
                                  {drawings.map((d, i) => (
                                    <div key={d.id} className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-lg text-xs">
                                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                                      <span className="flex-1 text-slate-600 capitalize">{d.shape} {i + 1}</span>
                                      <button onClick={() => setDrawings(prev => prev.filter(dd => dd.id !== d.id))} className="text-slate-400 hover:text-red-500 cursor-pointer"><X size={12} /></button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="p-4 border-t border-slate-100">
                        <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-2.5 flex gap-2">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" strokeWidth={2.5} />
                          <p className="text-[9px] text-emerald-800 leading-normal font-semibold">100% local. Nothing leaves your browser.</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── Center Canvas ── */}
                <main className="flex-1 surface-aurora p-0 md:p-6 lg:p-8 flex flex-col justify-start md:justify-center relative overflow-hidden transition-all duration-300">
                  <div
                    className="hidden md:block absolute inset-0 pointer-events-none opacity-[0.6] border-l border-white/50"
                    style={{
                      backgroundImage: 'radial-gradient(rgba(99,102,241,0.08) 1px, transparent 1px)',
                      backgroundSize: '22px 22px',
                      maskImage: 'radial-gradient(ellipse 75% 75% at 50% 45%, #000 35%, transparent 100%)',
                      WebkitMaskImage: 'radial-gradient(ellipse 75% 75% at 50% 45%, #000 35%, transparent 100%)',
                    }}
                  />
                  
                  <DocumentViewer 
                    document={documentFile}
                    signature={signature}
                    setSignature={setSignature}
                    texts={texts}
                    setTexts={setTexts}
                    stamps={stamps}
                    setStamps={setStamps}
                    redacts={redacts}
                    setRedacts={setRedacts}
                    isPlacementMode={isPlacementMode}
                    setIsPlacementMode={setIsPlacementMode}
                    placedForConfirmation={placedForConfirmation}
                    setPlacedForConfirmation={setPlacedForConfirmation}
                    lastPlacedInstanceId={lastPlacedInstanceId}
                    setLastPlacedInstanceId={setLastPlacedInstanceId}
                    textPlacementMode={textPlacementMode}
                    onTextPlacementModeChange={setTextPlacementMode}
                    stampPlacementMode={stampPlacementMode}
                    stampPlacementAsset={stampPlacementAsset}
                    redactPlacementMode={redactPlacementMode}
                    redactPlacementColor={redactColor}
                    onStampPlaced={() => { setStampPlacementMode(false); setStampPlacementAsset(null); }}
                    onRedactPlaced={() => { setRedactPlacementMode(false); }}
                    formFields={formFields}
                    setFormFields={setFormFields}
                    formFieldPlacementMode={formFieldPlacementMode}
                    formFieldPlacementType={formFieldPlacementType}
                    formFieldColor={formFieldColor}
                    onFormFieldPlaced={() => { setFormFieldPlacementMode(false); }}
                    onSetDefaultColor={setDefaultFieldColor}
                    comments={comments}
                    setComments={setComments}
                    drawings={drawings}
                    setDrawings={setDrawings}
                    commentPlacementMode={commentPlacementMode}
                    commentColor={commentColor}
                    onCommentPlaced={() => { setCommentPlacementMode(false); }}
                    drawMode={drawMode}
                    drawShape={drawShape}
                    drawColor={drawColor}
                    drawStrokeWidth={drawStrokeWidth}
                    drawOpacity={drawOpacity}
                    editTextMode={activeTool === 'editText'}
                    onEditTextRun={handleEditTextRun}
                  />
                </main>
>>>>>>> feat/prepare-form
              </div>
            )}
          </>
        )}
        {activeTab === 'Organize' && <Organize />}
        {activeTab === 'Compress' && <Compress />}
        {activeTab === 'Convert' && <Convert />}
        {['Split', 'Merge', 'Watermark', 'Numbering', 'Protect', 'OCR', 'DigitalSign', 'Templates', 'AskAI', 'PrepareForm', 'Compare'].includes(activeTab) && (
          <React.Suspense fallback={
            <div className="flex-1 flex items-center justify-center bg-slate-100">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
          }>
            {activeTab === 'Split' && <Split />}
            {activeTab === 'Merge' && <Merge />}
            {activeTab === 'Watermark' && <Watermark />}
            {activeTab === 'Numbering' && <PageNumbers />}
            {activeTab === 'Protect' && <Protect />}
            {activeTab === 'OCR' && <Ocr />}
            {activeTab === 'DigitalSign' && <DigitalSign />}
            {activeTab === 'AskAI' && <AskAI initialFile={documentFile?.type === 'pdf' ? documentFile.file : null} />}
            {activeTab === 'PrepareForm' && <PrepareForm />}
            {activeTab === 'Compare' && <Compare />}
            {activeTab === 'Templates' && (
              <TemplatesGallery
                onPick={handleLoadTemplate}
                onUploadNew={(file) => { handleUploadDoc(file); setActiveTab('Fill & Sign'); }}
                busyId={templateBusyId}
              />
            )}
          </React.Suspense>
        )}
      </div>

      <Footer>
        <KeyboardShortcuts />
      </Footer>

      {isDrawing && (
<<<<<<< HEAD
        <DrawSignature 
          onSave={handleDrawSave} 
          onCancel={() => setIsDrawing(false)} 
        />
      )}
      <div className="md:hidden shrink-0 w-full bg-white/95 backdrop-blur-xl border-t border-slate-100/80 flex items-center justify-around z-30 px-1 pb-safe pt-1 min-h-[4rem] shadow-[0_-1px_0_0_rgba(0,0,0,0.04)]">
=======
        <DrawSignature
          onSave={handleDrawSave}
          onCancel={() => setIsDrawing(false)}
        />
      )}
      {editingAsset && (
        <SignatureImageEditor
          asset={editingAsset}
          onSave={(result) => handleEditAssetSave(editingAsset.id, result)}
          onClose={() => setEditingAsset(null)}
        />
      )}
      {saveTemplateOpen && documentFile && (
        <SaveTemplateModal
          defaultName={documentFile.name.replace(/\.[^/.]+$/, '')}
          thumbnail={saveTemplateThumb}
          fieldCount={formFields.length}
          textCount={texts.length}
          saving={savingTemplate}
          error={saveTemplateError}
          onSave={handleSaveTemplate}
          onClose={() => { if (!savingTemplate) setSaveTemplateOpen(false); }}
        />
      )}
      {/* ─── MOBILE FAB + TOOL SHEET ─── */}
      {activeTab === 'Fill & Sign' && documentFile && !isPlacementMode && !placedForConfirmation && (
        <>
          {/* Persistent mobile tools bar — replaces the old unlabeled "+" FAB so the
              signing tools are always visible & discoverable. Sits just above the
              bottom tab navigation. Tapping a tool opens its bottom sheet. */}
          {!isMobileToolSheetOpen && (
            <div
              className="md:hidden fixed inset-x-0 z-[45] bg-white/95 backdrop-blur-xl border-t border-slate-100 flex items-stretch gap-0.5 px-1.5 pt-1.5 pb-1 shadow-[0_-3px_14px_-6px_rgba(0,0,0,0.12)]"
              style={{ bottom: 'calc(4.25rem + env(safe-area-inset-bottom, 0px))' }}
            >
              {([
                { id: 'sign' as const, icon: <Pen size={17} strokeWidth={2} />, label: 'Sign' },
                { id: 'stamp' as const, icon: <Stamp size={17} strokeWidth={2} />, label: 'Stamp' },
                { id: 'fields' as const, icon: <CheckSquare size={17} strokeWidth={2} />, label: 'Fields' },
                { id: 'comment' as const, icon: <MessageSquare size={17} strokeWidth={2} />, label: 'Note' },
                { id: 'draw' as const, icon: <Pencil size={17} strokeWidth={2} />, label: 'Draw' },
                { id: 'redact' as const, icon: <RectangleHorizontal size={17} strokeWidth={2} />, label: 'Redact' },
              ]).map(tool => (
                <button
                  key={tool.id}
                  onClick={() => { setActiveTool(tool.id); setIsMobileToolSheetOpen(true); }}
                  aria-label={`Open ${tool.label} tools`}
                  className={cn(
                    "flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition-colors active:scale-95",
                    activeTool === tool.id
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-500 active:bg-slate-50"
                  )}
                >
                  {tool.icon}
                  <span className="text-[10px] font-bold leading-none">{tool.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Tool Sheet Backdrop */}
          <AnimatePresence>
            {isMobileToolSheetOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="md:hidden fixed inset-0 bg-black/40 z-[55]"
                  onClick={() => setIsMobileToolSheetOpen(false)}
                />
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', bounce: 0.1, duration: 0.4 }}
                  className="md:hidden fixed inset-x-0 bottom-0 z-[60] bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)] border-t border-slate-200/50 max-h-[75vh] flex flex-col"
                  style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
                >
                  {/* Sheet Handle + Close */}
                  <div className="relative flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full bg-slate-300" />
                    <button
                      onClick={() => setIsMobileToolSheetOpen(false)}
                      aria-label="Close tools"
                      className="absolute right-3 top-1.5 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 active:bg-slate-200 transition-colors"
                    >
                      <X size={18} strokeWidth={2.5} />
                    </button>
                  </div>

                  {/* Tool Buttons Row */}
                  <div className="flex items-center gap-0.5 px-3 pt-1 pb-3">
                    {([
                      { id: 'sign' as const, icon: <Pen size={16} strokeWidth={2} />, label: 'Sign', color: 'indigo' },
                      { id: 'stamp' as const, icon: <Stamp size={16} strokeWidth={2} />, label: 'Stamp', color: 'amber' },
                      { id: 'fields' as const, icon: <CheckSquare size={16} strokeWidth={2} />, label: 'Fields', color: 'emerald' },
                      { id: 'comment' as const, icon: <MessageSquare size={16} strokeWidth={2} />, label: 'Note', color: 'amber' },
                      { id: 'draw' as const, icon: <Pencil size={16} strokeWidth={2} />, label: 'Draw', color: 'indigo' },
                      { id: 'redact' as const, icon: <RectangleHorizontal size={16} strokeWidth={2} />, label: 'Redact', color: 'rose' },
                    ]).map(tool => (
                      <button
                        key={tool.id}
                        onClick={() => {
                          setActiveTool(tool.id);
                          setStampPlacementMode(false);
                          setRedactPlacementMode(false);
                          setTextPlacementMode(false);
                          setFormFieldPlacementMode(false);
                          setCommentPlacementMode(false);
                          setDrawMode(false);
                        }}
                        className={cn(
                          "flex-1 min-w-0 flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl transition-all",
                          activeTool === tool.id
                            ? "bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200"
                            : "text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                        )}
                      >
                        {tool.icon}
                        <span className="text-[9px] font-bold leading-none">{tool.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Tool Content Area */}
                  <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
                    {/* ─── SIGN PANEL (Mobile) ─── */}
                    {activeTool === 'sign' && (
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 active:bg-indigo-50 transition-colors cursor-pointer">
                            <Upload size={14} /> Upload
                            <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleUploadSig(f); } }} />
                          </label>
                          <button onClick={() => { setIsMobileToolSheetOpen(false); setIsDrawing(true); }} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 active:bg-indigo-50 transition-colors cursor-pointer">
                            <PenTool size={14} /> Draw
                          </button>
                        </div>
                        {savedAssets.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Tap to place</span>
                            <div className="grid grid-cols-3 gap-2">
                              {savedAssets.map(asset => (
                                <div key={asset.id} className="relative">
                                  <button onClick={() => {
                                    setSignature(prev => ({ url: asset.url, originalUrl: asset.originalUrl, bgRemovalTolerance: 50, bgRemovalMode: prev?.bgRemovalMode || 'auto', pos: { x: 100, y: 100, width: 150, height: 150 / asset.aspectRatio }, applyMode: prev ? prev.applyMode : 'single', customPages: prev ? prev.customPages : '', excludedPages: prev ? prev.excludedPages : '', instances: prev ? prev.instances : [], aspectRatio: asset.aspectRatio, tintColor: asset.tintColor }));
                                    setIsMobileToolSheetOpen(false);
                                    setIsPlacementMode(true);
                                  }}
                                    className={cn("w-full aspect-[4/3] border rounded-xl flex items-center justify-center p-2 bg-slate-50 transition-all active:scale-95", signature?.originalUrl === asset.originalUrl ? "border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-200" : "border-slate-200")}
                                  >
                                    <img src={signature?.originalUrl === asset.originalUrl ? signature.url : asset.url} className="max-w-full max-h-full object-contain pointer-events-none" />
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); setIsMobileToolSheetOpen(false); setEditingAsset(asset); }} title="Edit / erase parts"
                                    className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-white border border-slate-200 text-indigo-600 shadow-sm flex items-center justify-center active:scale-90 transition-transform">
                                    <Eraser size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {savedAssets.length === 0 && (
                          <p className="text-xs text-slate-400 text-center py-4">Upload or draw a signature to get started</p>
                        )}
                      </div>
                    )}

                    {/* ─── STAMP PANEL (Mobile) ─── */}
                    {activeTool === 'stamp' && (
                      <div className="space-y-4">
                        <label className="flex items-center justify-center gap-1.5 px-3 py-3 border border-dashed border-slate-300 rounded-xl text-xs font-bold text-slate-500 active:bg-amber-50 transition-colors cursor-pointer">
                          <Plus size={14} /> Upload Custom Stamp
                          <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadStamp(f); }} />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {savedStamps.map(stamp => (
                            <button key={stamp.id} onClick={() => {
                              const img = new Image();
                              img.src = stamp.url;
                              img.onload = () => { setStampPlacementAsset({ url: stamp.url, aspectRatio: img.width / img.height }); setStampPlacementMode(true); setIsMobileToolSheetOpen(false); };
                              if (stamp.url.startsWith('data:image/svg')) { setStampPlacementAsset({ url: stamp.url, aspectRatio: 200/80 }); setStampPlacementMode(true); setIsMobileToolSheetOpen(false); }
                            }}
                              className={cn("w-full aspect-[5/2] border rounded-xl flex items-center justify-center p-2 bg-slate-50 transition-all active:scale-95", stampPlacementAsset?.url === stamp.url && stampPlacementMode ? "border-amber-500 bg-amber-50/50 ring-1 ring-amber-200" : "border-slate-200")}
                            >
                              <img src={stamp.url} className="max-w-full max-h-full object-contain pointer-events-none" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ─── FORM FIELDS PANEL (Mobile) ─── */}
                    {activeTool === 'fields' && (
                      <div className="space-y-3">
                        <button onClick={() => { setTextPlacementMode(true); setStampPlacementMode(false); setRedactPlacementMode(false); setFormFieldPlacementMode(false); setIsMobileToolSheetOpen(false); }}
                          className="w-full flex items-center gap-2.5 px-3 py-3 rounded-xl font-semibold text-sm bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-200 transition-all">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-sky-500"><Type size={16} /></div>
                          Add Text Box
                        </button>
                        {([
                          { type: 'checkbox' as FormFieldType, icon: <CheckSquare size={18} />, label: 'Checkbox', defaultColor: '#16A34A', bg: 'bg-emerald-50', active: 'active:bg-emerald-100', border: 'border-emerald-200', text: 'text-emerald-700', iconColor: 'text-emerald-600' },
                          { type: 'radio' as FormFieldType, icon: <Circle size={18} />, label: 'Radio Button', defaultColor: '#7C3AED', bg: 'bg-violet-50', active: 'active:bg-violet-100', border: 'border-violet-200', text: 'text-violet-700', iconColor: 'text-violet-600' },
                          { type: 'textarea' as FormFieldType, icon: <AlignLeft size={18} />, label: 'Text Area', defaultColor: '#000000', bg: 'bg-amber-50', active: 'active:bg-amber-100', border: 'border-amber-200', text: 'text-amber-700', iconColor: 'text-amber-600' },
                        ]).map(field => (
                          <button
                            key={field.type}
                            onClick={() => {
                              setFormFieldPlacementType(field.type);
                              setFormFieldPlacementMode(true);
                              setFormFieldColor(formFieldDefaultColors[field.type]);
                              setStampPlacementMode(false);
                              setRedactPlacementMode(false);
                              setTextPlacementMode(false);
                              setIsMobileToolSheetOpen(false);
                            }}
                            className={cn("w-full flex items-center gap-3 px-3.5 py-3 rounded-xl font-semibold text-sm border transition-all", field.bg, field.active, field.border, field.text)}
                          >
                            <span className={cn("shrink-0", field.iconColor)}>{field.icon}</span>
                            Add {field.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* ─── REDACT PANEL (Mobile) ─── */}
                    {activeTool === 'redact' && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Rectangle Color</span>
                          <div className="flex gap-2 flex-wrap">
                            {[{ name: 'White', value: '#FFFFFF' }, { name: 'Black', value: '#000000' }, { name: 'Gray', value: '#9CA3AF' }, { name: 'Red', value: '#EF4444' }, { name: 'Yellow', value: '#FBBF24' }, { name: 'Blue', value: '#3B82F6' }].map(c => (
                              <button key={c.name} onClick={() => setRedactColor(c.value)} className={cn("w-9 h-9 rounded-xl border-2 transition-transform active:scale-90", redactColor === c.value ? "border-slate-500 scale-110 shadow-md" : "border-slate-200")} style={{ backgroundColor: c.value }} title={c.name} />
                            ))}
                            <input type="color" value={redactColor} onChange={(e) => setRedactColor(e.target.value)} className="w-9 h-9 rounded-xl border border-slate-200 cursor-pointer p-0.5" title="Custom color" />
                          </div>
                        </div>
                        <button onClick={() => { setRedactPlacementMode(true); setStampPlacementMode(false); setTextPlacementMode(false); setIsMobileToolSheetOpen(false); }}
                          className="w-full flex items-center justify-center gap-2 px-3 py-3.5 rounded-xl font-bold text-sm bg-rose-50 active:bg-rose-100 text-rose-700 border border-rose-200 transition-all">
                          <RectangleHorizontal size={16} />
                          Add Rectangle
                        </button>
                      </div>
                    )}

                    {/* ─── COMMENT PANEL (Mobile) ─── */}
                    {activeTool === 'comment' && (
                      <div className="space-y-4">
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Drop a sticky note anywhere on the document. Tap the page after choosing a colour.
                        </p>
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Note Colour</span>
                          <div className="flex gap-2 flex-wrap">
                            {COMMENT_COLORS.map(c => (
                              <button key={c.value} onClick={() => setCommentColor(c.value)} className={cn("w-9 h-9 rounded-full border-2 transition-transform active:scale-90", commentColor === c.value ? "border-slate-500 scale-110 shadow-md" : "border-slate-200")} style={{ backgroundColor: c.value }} title={c.name} />
                            ))}
                            <input type="color" value={commentColor} onChange={(e) => setCommentColor(e.target.value)} className="w-9 h-9 rounded-full border border-slate-200 cursor-pointer p-0.5" title="Custom colour" />
                          </div>
                        </div>
                        <button onClick={() => { setCommentPlacementMode(true); setStampPlacementMode(false); setRedactPlacementMode(false); setTextPlacementMode(false); setFormFieldPlacementMode(false); setDrawMode(false); setIsMobileToolSheetOpen(false); }}
                          className="w-full flex items-center justify-center gap-2 px-3 py-3.5 rounded-xl font-bold text-sm bg-amber-50 active:bg-amber-100 text-amber-700 border border-amber-200 transition-all">
                          <MessageSquare size={16} />
                          Add Comment
                        </button>
                      </div>
                    )}

                    {/* ─── DRAW & MARKUP PANEL (Mobile) ─── */}
                    {activeTool === 'draw' && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Tool</span>
                          <div className="grid grid-cols-3 gap-1.5">
                            {DRAW_SHAPES.map(s => {
                              const Icon = s.id === 'freehand' ? Pencil : s.id === 'rectangle' ? Square : s.id === 'ellipse' ? Circle : s.id === 'line' ? Minus : s.id === 'arrow' ? ArrowUpRight : s.id === 'redact' ? RectangleHorizontal : Highlighter;
                              const isActive = drawShape === s.id;
                              return (
                                <button key={s.id}
                                  onClick={() => { setDrawShape(s.id); if (s.id === 'highlight' && drawOpacity === 1) setDrawOpacity(0.4); if (s.id === 'redact' && drawOpacity !== 1) setDrawOpacity(1); }}
                                  className={cn("flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border text-[10px] font-bold transition-all active:scale-95",
                                    isActive ? "bg-indigo-600 text-white border-indigo-600 shadow" : "bg-white text-slate-500 border-slate-200")}
                                  title={s.label}>
                                  <Icon size={16} />
                                  {s.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Colour</span>
                          <div className="flex gap-2 flex-wrap">
                            {DRAW_COLORS.map(c => (
                              <button key={c.value} onClick={() => setDrawColor(c.value)} className={cn("w-9 h-9 rounded-full border-2 transition-transform active:scale-90", drawColor === c.value ? "border-slate-500 scale-110 shadow-md" : "border-slate-200")} style={{ backgroundColor: c.value }} title={c.name} />
                            ))}
                            <input type="color" value={drawColor} onChange={(e) => setDrawColor(e.target.value)} className="w-9 h-9 rounded-full border border-slate-200 cursor-pointer p-0.5" title="Custom colour" />
                          </div>
                        </div>
                        {drawShape !== 'highlight' && drawShape !== 'redact' && (
                          <div className="space-y-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Stroke Width — {drawStrokeWidth}px</span>
                            <input type="range" min={1} max={12} value={drawStrokeWidth} onChange={(e) => setDrawStrokeWidth(parseInt(e.target.value, 10))} className="w-full cursor-pointer" />
                          </div>
                        )}
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Opacity — {Math.round(drawOpacity * 100)}%</span>
                          <input type="range" min={10} max={100} value={Math.round(drawOpacity * 100)} onChange={(e) => setDrawOpacity(parseInt(e.target.value, 10) / 100)} className="w-full cursor-pointer" />
                        </div>
                        <button onClick={() => { setDrawMode(true); setStampPlacementMode(false); setRedactPlacementMode(false); setTextPlacementMode(false); setFormFieldPlacementMode(false); setCommentPlacementMode(false); setIsMobileToolSheetOpen(false); }}
                          className="w-full flex items-center justify-center gap-2 px-3 py-3.5 rounded-xl font-bold text-sm bg-indigo-50 active:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all">
                          <Pencil size={16} />
                          Start Drawing
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}

      {/* ─── MOBILE BOTTOM TAB BAR ─── */}
      <div className="md:hidden fixed bottom-0 inset-x-0 w-full bg-white/95 backdrop-blur-xl border-t border-slate-100/80 flex items-center justify-around z-30 px-1 pb-safe pt-1 min-h-[4rem] shadow-[0_-1px_0_0_rgba(0,0,0,0.04)]">
>>>>>>> feat/prepare-form
        {[
          { id: 'Fill & Sign', icon: <FilePen size={20} strokeWidth={1.8} />, label: 'Sign' },
          { id: 'Organize', icon: <LayoutGrid size={20} strokeWidth={1.8} />, label: 'Organize' },
          { id: 'Compress', icon: <FileArchive size={20} strokeWidth={1.8} />, label: 'Compress' },
          { id: 'Convert', icon: <RefreshCw size={20} strokeWidth={1.8} />, label: 'Convert' },
        ].map(tab => (
          <button
            key={tab.id}
<<<<<<< HEAD
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex flex-col items-center justify-center flex-1 h-full gap-1 py-2 transition-all duration-200 ${
=======
            onClick={() => { setActiveTab(tab.id as any); setIsMobileToolSheetOpen(false); }}
            className={`relative flex flex-col items-center justify-center flex-1 h-full gap-1 py-2 transition-all duration-200 ${
>>>>>>> feat/prepare-form
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
        {/* More tools (mobile) */}
        {(() => {
          const moreIds = ['Split', 'Merge', 'Watermark', 'Numbering', 'Protect', 'OCR', 'DigitalSign', 'Templates', 'AskAI', 'PrepareForm', 'Compare'];
          const isMoreActive = moreIds.includes(activeTab);
          return (
            <button
              onClick={() => setMoreToolsOpen(true)}
              className={`relative flex flex-col items-center justify-center flex-1 h-full gap-1 py-2 transition-all duration-200 ${isMoreActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <span className={`transition-transform duration-200 ${isMoreActive ? 'scale-110' : ''}`}>
                <MoreHorizontal size={20} strokeWidth={1.8} />
              </span>
              <span className={`text-[10px] tracking-wide ${isMoreActive ? 'font-bold' : 'font-medium'}`}>More</span>
              {isMoreActive && <span className="absolute bottom-0 w-6 h-0.5 bg-indigo-600 rounded-full" />}
            </button>
          );
        })()}
      </div>

      {/* More tools sheet (mobile) */}
      <AnimatePresence>
        {moreToolsOpen && (
          <div className="md:hidden fixed inset-0 z-[90] flex items-end" data-more-tools>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMoreToolsOpen(false)} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="relative w-full bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 p-4 pb-safe z-10"
            >
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">More Tools</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'Split', label: 'Split', icon: <Scissors size={22} /> },
                  { id: 'Merge', label: 'Merge', icon: <Combine size={22} /> },
                  { id: 'Watermark', label: 'Watermark', icon: <Droplet size={22} /> },
                  { id: 'Numbering', label: 'Numbers', icon: <Hash size={22} /> },
                  { id: 'Protect', label: 'Protect', icon: <Lock size={22} /> },
                  { id: 'DigitalSign', label: 'Sign', icon: <FileSignature size={22} /> },
                  { id: 'OCR', label: 'OCR', icon: <ScanText size={22} /> },
                  { id: 'Templates', label: 'Templates', icon: <LayoutTemplate size={22} /> },
                  { id: 'AskAI', label: 'Ask AI', icon: <Sparkles size={22} /> },
                  { id: 'PrepareForm', label: 'Prepare Form', icon: <FormInput size={22} /> },
                  { id: 'Compare', label: 'Compare', icon: <GitCompareArrows size={22} /> },
                ].map(t => (
                  <button key={t.id}
                    onClick={() => { setActiveTab(t.id as any); setMoreToolsOpen(false); setIsMobileToolSheetOpen(false); }}
                    className={`flex flex-col items-center justify-center gap-2 py-4 rounded-xl border transition-all ${activeTab === t.id ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600 active:bg-slate-100'}`}
                  >
                    {t.icon}
                    <span className="text-xs font-semibold">{t.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Drawer (desktop) / Bottom Sheet (mobile) */}
      <AnimatePresence>
        {isHistoryOpen && (
          <div className={`fixed inset-0 z-[100] flex ${mobile ? 'items-end justify-center' : 'items-stretch justify-end'}`}>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsHistoryOpen(false)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />

            {/* Panel */}
            <motion.div
              initial={mobile ? { y: '100%' } : { x: '100%' }}
              animate={mobile ? { y: 0 } : { x: 0 }}
              exit={mobile ? { y: '100%' } : { x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className={`relative bg-white shadow-2xl border-slate-200/80 overflow-hidden flex flex-col z-10 ${
                mobile
                  ? 'w-full rounded-t-3xl border-t max-h-[85vh]'
                  : 'w-full max-w-md h-full border-l'
              }`}
            >
              {/* Mobile grab handle */}
              {mobile && (
                <div className="flex justify-center pt-2.5 pb-1 shrink-0">
                  <div className="w-10 h-1.5 rounded-full bg-slate-200" />
                </div>
              )}

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                    <History size={18} strokeWidth={2} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-base leading-tight">Document History</h3>
                    <p className="text-[11px] text-slate-400 font-medium">Your recent documents ({recentFiles.length})</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsHistoryOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <X size={18} strokeWidth={2.5} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {recentFiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 mb-4">
                      <History size={28} strokeWidth={1.5} />
                    </div>
                    <h4 className="text-sm font-bold text-slate-700">No History Found</h4>
                    <p className="text-xs text-slate-400 max-w-[240px] mt-1.5 leading-relaxed">
                      Signed or viewed documents will appear here for quick reference.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="bg-slate-50/50 border border-slate-200/50 rounded-2xl divide-y divide-slate-100 overflow-hidden shadow-sm">
                      {recentFiles.map((rf) => (
                        <div
                          key={rf.id}
                          className="flex items-center gap-3 px-4 py-3.5 hover:bg-indigo-50/40 transition-colors group cursor-pointer"
                          onClick={() => {
                            const uploadInput = document.getElementById('history-reupload-input');
                            if (uploadInput) {
                              uploadInput.click();
                            }
                          }}
                          title="Click to browse and re-upload"
                        >
                          {rf.type === 'pdf' ? (
                            <FileSignature size={18} className="text-indigo-500 shrink-0" strokeWidth={2} />
                          ) : (
                            <FileImage size={18} className="text-violet-500 shrink-0" strokeWidth={2} />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-700 group-hover:text-indigo-600 transition-colors truncate">{rf.name}</p>
                            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                              {formatRelativeTime(rf.lastOpened)}
                              {rf.size > 0 && <> · {formatFileSize(rf.size)}</>}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-500 transition-colors bg-white group-hover:bg-indigo-50/50 px-2 py-1 rounded-lg border border-slate-200/60 group-hover:border-indigo-100">
                              Re-upload
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeRecentFile(rf.id);
                              }}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100 border border-transparent transition-colors cursor-pointer"
                              title="Remove from history"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="border border-indigo-50 pt-3.5 pb-3.5 px-4.5 flex gap-3 text-[11px] font-semibold text-indigo-700 bg-indigo-50/40 rounded-2xl leading-relaxed">
                      <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" strokeWidth={2.5} />
                      <span>
                        For privacy, document files are kept only in your local memory. Click <strong>Re-upload</strong> to open the original file.
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              {recentFiles.length > 0 && (
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                  <button
                    onClick={() => {
                      clearRecentFiles();
                      setIsHistoryOpen(false);
                    }}
                    className="flex items-center gap-1.5 text-xs font-bold text-red-500 hover:text-red-600 transition-colors cursor-pointer bg-transparent border-0"
                  >
                    <Trash2 size={14} />
                    Clear History
                  </button>
                  <button
                    onClick={() => setIsHistoryOpen(false)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all active:scale-95"
                  >
                    Close
                  </button>
                </div>
              )}
            </motion.div>
            
            {/* Hidden file input for history modal re-upload */}
            <input
              id="history-reupload-input"
              type="file"
              className="hidden"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleUploadDoc(file);
                  setIsHistoryOpen(false);
                }
              }}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
