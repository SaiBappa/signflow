import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import JSZip from 'jszip';
import { Scissors, Loader2 } from 'lucide-react';
import { downloadBlob, parsePageRange } from '../utils';
import { ToolLayout, ToolField, ToolInput, ToolSection, Segmented, PrimaryButton, FileChip } from './shared/ToolLayout';
import { UploadDropzone } from './shared/UploadDropzone';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

type SplitMode = 'extract' | 'eachPage' | 'ranges';

interface PageThumb {
  pageNumber: number; // 1-based
  dataUrl: string;
}

export function Split() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<PageThumb[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<SplitMode>('extract');
  const [rangeText, setRangeText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadFile = async (f: File) => {
    if (f.type !== 'application/pdf') return;
    setFile(f);
    setThumbs([]);
    setSelected(new Set());
    setRangeText('');
    setIsLoading(true);
    try {
      const bytes = await f.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
      const out: PageThumb[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvas, canvasContext: ctx, viewport } as any).promise;
        out.push({ pageNumber: i, dataUrl: canvas.toDataURL('image/jpeg', 0.7) });
      }
      setThumbs(out);
    } catch (e) {
      console.error(e);
      alert('Could not read this PDF.');
      setFile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePage = (pageNumber: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(pageNumber) ? next.delete(pageNumber) : next.add(pageNumber);
      return next;
    });
  };

  const reset = () => {
    setFile(null);
    setThumbs([]);
    setSelected(new Set());
    setRangeText('');
  };

  const baseName = file ? file.name.replace(/\.pdf$/i, '') : 'document';

  // Build one PDF from a set of 1-based page numbers.
  const buildPdf = async (src: PDFDocument, pageNumbers: number[]): Promise<Uint8Array> => {
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, pageNumbers.map(n => n - 1));
    copied.forEach(p => out.addPage(p));
    return out.save();
  };

  const handleSplit = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const bytes = await file.arrayBuffer();
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const total = src.getPageCount();

      if (mode === 'extract') {
        const pages = [...selected].sort((a, b) => a - b) as number[];
        if (pages.length === 0) {
          alert('Select at least one page to extract.');
          return;
        }
        const out = await buildPdf(src, pages);
        downloadBlob(new Blob([out], { type: 'application/pdf' }), `${baseName}-extracted.pdf`);
      } else if (mode === 'eachPage') {
        const zip = new JSZip();
        for (let n = 1; n <= total; n++) {
          const out = await buildPdf(src, [n]);
          zip.file(`${baseName}-page-${n}.pdf`, out);
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(blob, `${baseName}-pages.zip`);
      } else {
        // ranges: each comma-separated segment becomes its own file
        const segments = rangeText.split(',').map(s => s.trim()).filter(Boolean);
        if (segments.length === 0) {
          alert('Enter at least one range, e.g. "1-3, 4-6".');
          return;
        }
        const zip = new JSZip();
        let made = 0;
        for (const seg of segments) {
          const pages = parsePageRange(seg, total);
          if (pages.length === 0) continue;
          const out = await buildPdf(src, pages);
          zip.file(`${baseName}-${seg.replace(/\s+/g, '')}.pdf`, out);
          made++;
        }
        if (made === 0) {
          alert('No valid pages in the ranges you entered.');
          return;
        }
        if (made === 1) {
          // single range → download a plain PDF instead of a zip
          const pages = parsePageRange(segments[0], total);
          const out = await buildPdf(src, pages);
          downloadBlob(new Blob([out], { type: 'application/pdf' }), `${baseName}-${segments[0].replace(/\s+/g, '')}.pdf`);
        } else {
          const blob = await zip.generateAsync({ type: 'blob' });
          downloadBlob(blob, `${baseName}-split.zip`);
        }
      }
    } catch (e) {
      console.error(e);
      alert('Error splitting PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Short, mode-aware summary of what the split will produce.
  const summary = (() => {
    if (mode === 'extract') {
      return selected.size > 0
        ? `${selected.size} page${selected.size > 1 ? 's' : ''} selected → 1 file`
        : 'Click pages to select them.';
    }
    if (mode === 'eachPage') {
      return thumbs.length > 0 ? `${thumbs.length} pages → ${thumbs.length} files` : 'Every page becomes its own file.';
    }
    const segments = rangeText.split(',').map(s => s.trim()).filter(Boolean);
    return segments.length > 0
      ? `${segments.length} range${segments.length > 1 ? 's' : ''} → ${segments.length} file${segments.length > 1 ? 's' : ''}`
      : 'Each range becomes its own file.';
  })();

  const panel = (
    <>
      {file && <FileChip name={file.name} onRemove={reset} />}

      <ToolSection label="Split mode">
        <Segmented<SplitMode>
          value={mode}
          onChange={setMode}
          options={[
            { id: 'extract', label: 'Pick pages' },
            { id: 'ranges', label: 'Ranges' },
            { id: 'eachPage', label: 'Every page' },
          ]}
        />
      </ToolSection>

      {mode === 'ranges' && (
        <ToolField label="Ranges (one file per comma)" hint="Each comma-separated segment is saved as its own PDF.">
          <ToolInput value={rangeText} onChange={e => setRangeText(e.target.value)} placeholder="e.g. 1-3, 4-6, 7" />
        </ToolField>
      )}

      <ToolSection label="Result">
        <p className="text-xs font-semibold text-slate-500">{summary}</p>
      </ToolSection>
    </>
  );

  return (
    <ToolLayout
      icon={<Scissors size={20} strokeWidth={2} />}
      title="Split PDF"
      description="Extract pages or divide a PDF into separate files — all on your device."
      accentClass="from-blue-500 to-indigo-500"
      panel={panel}
      panelFooter={
        <PrimaryButton onClick={handleSplit} disabled={!file || isLoading} loading={isProcessing} loadingText="Splitting…">
          <Scissors size={16} /> Split PDF
        </PrimaryButton>
      }
    >
      {!file ? (
        <UploadDropzone
          onFiles={fs => {
            const f = fs.find(x => x.type === 'application/pdf');
            if (f) loadFile(f);
          }}
          accept="application/pdf"
          title="Add a PDF to split"
          subtitle={
            <>
              Drag &amp; drop a PDF here, or <span className="text-indigo-600 font-semibold">browse</span>. Pick the pages you want.
            </>
          }
          chips={['📄 PDF only']}
          icon={<Scissors className="w-9 h-9" strokeWidth={2} />}
        />
      ) : isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-3" />
          Rendering pages…
        </div>
      ) : (
        <div className="p-4 md:p-6">
          {mode === 'extract' && (
            <p className="text-sm text-slate-500 mb-4">
              {selected.size > 0 ? `${selected.size} page${selected.size > 1 ? 's' : ''} selected` : 'Click pages to select them.'}
            </p>
          )}
          {mode !== 'extract' && (
            <p className="text-sm text-slate-500 mb-4">
              {mode === 'ranges' ? 'Preview of all pages — files are built from the ranges in the panel.' : 'Every page below will be exported as its own PDF.'}
            </p>
          )}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {thumbs.map(t => {
              const isSel = selected.has(t.pageNumber);
              const selectable = mode === 'extract';
              return (
                <button
                  key={t.pageNumber}
                  onClick={() => selectable && togglePage(t.pageNumber)}
                  className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                    selectable ? 'cursor-pointer' : 'cursor-default'
                  } ${isSel ? 'border-indigo-500 ring-2 ring-indigo-200 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300'}`}
                >
                  <img src={t.dataUrl} alt={`Page ${t.pageNumber}`} className="w-full block bg-white" />
                  <span className="absolute bottom-1 left-1 bg-slate-900/70 text-white text-[10px] font-bold rounded px-1.5 py-0.5">
                    {t.pageNumber}
                  </span>
                  {selectable && isSel && (
                    <span className="absolute top-1 right-1 w-5 h-5 bg-indigo-500 text-white rounded-full flex items-center justify-center text-xs font-bold">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </ToolLayout>
  );
}
