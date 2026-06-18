import React, { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import Tesseract from 'tesseract.js';
import { ScanText, Loader2, Copy, Download, Check } from 'lucide-react';
import { downloadBlob } from '../utils';
import { ToolLayout, PrimaryButton, FileChip } from './shared/ToolLayout';
import { UploadDropzone } from './shared/UploadDropzone';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export function Ocr() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);

  const isImage = file?.type.startsWith('image/');

  const loadFile = (f: File) => {
    if (f.type === 'application/pdf' || f.type.startsWith('image/')) {
      setFile(f);
      setText('');
      setProgress(0);
    }
  };

  // Rasterize each PDF page to a canvas for the OCR engine.
  const renderPdfPages = async (bytes: ArrayBuffer): Promise<HTMLCanvasElement[]> => {
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
    const canvases: HTMLCanvasElement[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 }); // 2x for legible OCR
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport } as any).promise;
      canvases.push(canvas);
    }
    return canvases;
  };

  const handleOcr = async () => {
    if (!file) return;
    setIsProcessing(true);
    setText('');
    setProgress(0);
    setStage('Loading OCR engine…');
    let worker: Tesseract.Worker | null = null;
    try {
      worker = await Tesseract.createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100));
        },
      });

      let collected = '';
      if (isImage) {
        setStage('Reading image…');
        const url = URL.createObjectURL(file);
        const { data } = await worker.recognize(url);
        URL.revokeObjectURL(url);
        collected = data.text;
      } else {
        const bytes = await file.arrayBuffer();
        setStage('Rendering pages…');
        const canvases = await renderPdfPages(bytes);
        for (let i = 0; i < canvases.length; i++) {
          setStage(`Reading page ${i + 1} of ${canvases.length}…`);
          setProgress(0);
          const { data } = await worker.recognize(canvases[i]);
          collected += `\n\n----- Page ${i + 1} -----\n\n` + data.text;
        }
      }
      setText(collected.trim());
      setStage('Done');
    } catch (e) {
      console.error(e);
      alert('Error running OCR.');
    } finally {
      if (worker) await worker.terminate();
      setIsProcessing(false);
    }
  };

  const copyText = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadText = () => {
    const base = file ? file.name.replace(/\.[^.]+$/, '') : 'ocr';
    downloadBlob(new Blob([text], { type: 'text/plain' }), `${base}.txt`);
  };

  const secondaryBtn =
    'flex items-center justify-center gap-1.5 px-3 py-2.5 md:py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:border-indigo-300 hover:text-indigo-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

  const panel = (
    <>
      {file && (
        <FileChip
          name={file.name}
          onRemove={() => {
            setFile(null);
            setText('');
          }}
        />
      )}

      {text ? (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={copyText} className={secondaryBtn}>
            {copied ? (
              <>
                <Check size={14} /> Copied
              </>
            ) : (
              <>
                <Copy size={14} /> Copy text
              </>
            )}
          </button>
          <button onClick={downloadText} className={secondaryBtn}>
            <Download size={14} /> Download .txt
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-400 font-medium leading-relaxed">
          {file
            ? 'Run text recognition to pull the words out of your file. Everything happens locally.'
            : 'Add a scanned PDF or an image, then extract its text. Runs entirely in your browser.'}
        </p>
      )}
    </>
  );

  return (
    <ToolLayout
      icon={<ScanText size={20} strokeWidth={2} />}
      title="Extract Text (OCR)"
      description="Pull text out of scanned PDFs and images — right in your browser."
      accentClass="from-violet-500 to-fuchsia-500"
      panel={panel}
      panelFooter={
        <PrimaryButton onClick={handleOcr} disabled={!file || isProcessing} loading={isProcessing} loadingText="Recognizing…">
          <ScanText size={16} /> Extract Text
        </PrimaryButton>
      }
    >
      {!file ? (
        <UploadDropzone
          onFiles={(fs) => {
            const f = fs.find((x) => x.type === 'application/pdf' || x.type.startsWith('image/'));
            if (f) loadFile(f);
          }}
          accept="application/pdf,image/png,image/jpeg"
          title="Add a file to extract text"
          subtitle={
            <>
              Drag &amp; drop a PDF or image here, or <span className="text-indigo-600 font-semibold">browse</span>. Text recognition runs locally.
            </>
          }
          chips={['📄 PDF', '🖼️ Image']}
          icon={<ScanText className="w-9 h-9" strokeWidth={2} />}
        />
      ) : isProcessing ? (
        <div className="flex-1 flex items-center justify-center p-6 md:p-10">
          <div className="w-full max-w-md bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-8 md:p-10 text-center shadow-[0_20px_50px_-20px_rgba(79,70,229,0.15)]">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-tr from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-[0_8px_25px_rgba(168,85,247,0.3)]">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <p className="text-sm font-bold text-slate-700">{stage}</p>
            <div className="mt-4 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div className="bg-gradient-to-r from-violet-500 to-fuchsia-500 h-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-500 font-mono font-bold">{progress}%</p>
            <p className="mt-4 text-[11px] text-slate-400 leading-relaxed">
              First run downloads the language model (~3&nbsp;MB) — your document is never uploaded.
            </p>
          </div>
        </div>
      ) : text ? (
        <div className="flex-1 flex flex-col p-4 md:p-6 min-h-0">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Extracted text</span>
            <span className="text-[10px] text-slate-400 font-medium">{isImage ? 'Image' : 'PDF'} · editable</span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 w-full min-h-[20rem] px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-mono text-slate-700 leading-relaxed shadow-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none transition-colors"
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-6 md:p-10">
          <div className="w-full max-w-md bg-white/70 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-8 md:p-12 text-center shadow-[0_20px_50px_-20px_rgba(79,70,229,0.15)]">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-tr from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-[0_8px_25px_rgba(168,85,247,0.3)]">
              <span className="text-3xl">{isImage ? '🖼️' : '📄'}</span>
            </div>
            <h2 className="text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight">Ready to extract text</h2>
            <p className="mt-2 text-slate-500 text-sm font-medium max-w-sm mx-auto leading-relaxed">
              Hit <span className="text-indigo-600 font-semibold">Extract Text</span> to recognize the words in your file.
            </p>
          </div>
        </div>
      )}
    </ToolLayout>
  );
}
