import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { GitCompareArrows, FileText, ChevronLeft, ChevronRight, Download, ArrowLeftRight, AlertCircle } from 'lucide-react';
import { downloadBlob } from '../utils';
import {
  ToolLayout,
  ToolSection,
  PrimaryButton,
  Segmented,
  RangeRow,
  FileChip,
} from './shared/ToolLayout';
import { UploadDropzone } from './shared/UploadDropzone';
import {
  extractAllPageText,
  buildTextDiff,
  renderPageToCanvas,
  diffCanvases,
  type PageTextDiff,
  type CompareSummary,
  type DiffSegment,
} from '../utils/pdfCompare';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

type Mode = 'text' | 'visual';

interface LoadedDoc {
  file: File;
  pdf: pdfjsLib.PDFDocumentProxy;
}

/* ============================================================================
 * Compare — diff two PDFs entirely in the browser.
 *  • Text mode:   word-level additions/removals highlighted side by side.
 *  • Visual mode: rasterised pages overlaid with a pixel-difference heatmap.
 * ========================================================================== */
export function Compare() {
  const [docA, setDocA] = useState<LoadedDoc | null>(null);
  const [docB, setDocB] = useState<LoadedDoc | null>(null);
  const [mode, setMode] = useState<Mode>('text');
  const [loadingSlot, setLoadingSlot] = useState<'A' | 'B' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Text-diff results
  const [textPages, setTextPages] = useState<PageTextDiff[] | null>(null);
  const [summary, setSummary] = useState<CompareSummary | null>(null);
  const [comparing, setComparing] = useState(false);

  // Shared page navigation
  const [pageIndex, setPageIndex] = useState(0);

  // Visual diff
  const [sensitivity, setSensitivity] = useState(32);
  const [changedRatio, setChangedRatio] = useState<number | null>(null);
  const [visualBusy, setVisualBusy] = useState(false);
  const leftCanvasRef = useRef<HTMLDivElement>(null);
  const rightCanvasRef = useRef<HTMLDivElement>(null);
  const diffCanvasRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.max(docA?.pdf.numPages ?? 0, docB?.pdf.numPages ?? 0);

  const loadInto = useCallback(async (slot: 'A' | 'B', file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Please choose a PDF file.');
      return;
    }
    setError(null);
    setLoadingSlot(slot);
    // Reset any previous comparison when documents change.
    setTextPages(null);
    setSummary(null);
    setChangedRatio(null);
    try {
      const bytes = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
      const doc = { file, pdf };
      if (slot === 'A') setDocA(doc);
      else setDocB(doc);
    } catch (e) {
      console.error(e);
      setError('Could not open that PDF. It may be encrypted or corrupted.');
    } finally {
      setLoadingSlot(null);
    }
  }, []);

  const clearSlot = (slot: 'A' | 'B') => {
    if (slot === 'A') setDocA(null);
    else setDocB(null);
    setTextPages(null);
    setSummary(null);
    setChangedRatio(null);
  };

  const swap = () => {
    setDocA(docB);
    setDocB(docA);
    setTextPages(null);
    setSummary(null);
    setChangedRatio(null);
  };

  // ── Text comparison ──
  const runTextCompare = useCallback(async () => {
    if (!docA || !docB) return;
    setComparing(true);
    setError(null);
    try {
      const [a, b] = await Promise.all([extractAllPageText(docA.pdf), extractAllPageText(docB.pdf)]);
      const { pages, summary } = buildTextDiff(a, b);
      setTextPages(pages);
      setSummary(summary);
      setPageIndex(0);
    } catch (e) {
      console.error(e);
      setError('Something went wrong while reading the text. Try Visual mode instead.');
    } finally {
      setComparing(false);
    }
  }, [docA, docB]);

  // ── Visual comparison for the current page ──
  const runVisualCompare = useCallback(async () => {
    if (!docA || !docB) return;
    const pageNum = pageIndex + 1;
    setVisualBusy(true);
    setError(null);
    try {
      const scale = 1.4;
      const hasA = pageNum <= docA.pdf.numPages;
      const hasB = pageNum <= docB.pdf.numPages;
      const [ca, cb] = await Promise.all([
        hasA ? renderPageToCanvas(docA.pdf, pageNum, scale) : Promise.resolve(blankCanvas()),
        hasB ? renderPageToCanvas(docB.pdf, pageNum, scale) : Promise.resolve(blankCanvas()),
      ]);

      mount(leftCanvasRef.current, ca);
      mount(rightCanvasRef.current, cb);

      if (hasA && hasB) {
        const { canvas, changedRatio } = diffCanvases(ca, cb, sensitivity);
        mount(diffCanvasRef.current, canvas);
        setChangedRatio(changedRatio);
      } else {
        // Page exists in only one document — the whole page is the change.
        mount(diffCanvasRef.current, hasA ? ca : cb);
        setChangedRatio(1);
      }
    } catch (e) {
      console.error(e);
      setError('Could not render these pages for visual comparison.');
    } finally {
      setVisualBusy(false);
    }
  }, [docA, docB, pageIndex, sensitivity]);

  // Re-render the visual diff when the page, sensitivity, or mode changes.
  useEffect(() => {
    if (mode === 'visual' && docA && docB) runVisualCompare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pageIndex, sensitivity, docA, docB]);

  const ready = !!docA && !!docB;
  const currentTextPage = textPages?.[pageIndex];

  const downloadReport = () => {
    if (!textPages || !summary || !docA || !docB) return;
    const lines: string[] = [];
    lines.push('PDF COMPARISON REPORT');
    lines.push('='.repeat(60));
    lines.push(`Original : ${docA.file.name}`);
    lines.push(`Revised  : ${docB.file.name}`);
    lines.push('');
    lines.push(`Pages compared : ${summary.pagesCompared}`);
    lines.push(`Pages changed  : ${summary.pagesChanged}`);
    lines.push(`Pages added    : ${summary.pagesAdded}`);
    lines.push(`Pages removed  : ${summary.pagesRemoved}`);
    lines.push(`Words added    : ${summary.wordsAdded}`);
    lines.push(`Words removed  : ${summary.wordsRemoved}`);
    lines.push('');
    for (const p of textPages) {
      if (p.status === 'unchanged') continue;
      lines.push('-'.repeat(60));
      lines.push(`Page ${p.page} — ${p.status.toUpperCase()} (+${p.added} / -${p.removed} words)`);
      for (const seg of p.segments) {
        if (seg.type === 'add') lines.push(`  + ${seg.value.trim()}`);
        else if (seg.type === 'remove') lines.push(`  - ${seg.value.trim()}`);
      }
    }
    const name = `compare-${docA.file.name.replace(/\.pdf$/i, '')}-vs-${docB.file.name.replace(/\.pdf$/i, '')}.txt`;
    downloadBlob(new Blob([lines.join('\n')], { type: 'text/plain' }), name);
  };

  // ── Panel (left controls) ──
  const panel = (
    <>
      <ToolSection label="Documents">
        {docA ? (
          <FileChip name={`A · ${docA.file.name}`} onRemove={() => clearSlot('A')} />
        ) : (
          <SlotPlaceholder label="Original (A)" />
        )}
        {docB ? (
          <FileChip name={`B · ${docB.file.name}`} onRemove={() => clearSlot('B')} />
        ) : (
          <SlotPlaceholder label="Revised (B)" />
        )}
        {docA && docB && (
          <button
            onClick={swap}
            className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-indigo-600 py-1.5 transition-colors"
          >
            <ArrowLeftRight size={13} /> Swap A &amp; B
          </button>
        )}
      </ToolSection>

      <ToolSection label="Comparison mode">
        <Segmented<Mode>
          options={[
            { id: 'text', label: 'Text' },
            { id: 'visual', label: 'Visual' },
          ]}
          value={mode}
          onChange={setMode}
        />
        <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
          {mode === 'text'
            ? 'Highlights words added or removed. Best for digital, text-based PDFs.'
            : 'Overlays pages and tints changed pixels. Catches layout, image and scan changes.'}
        </p>
      </ToolSection>

      {mode === 'visual' && ready && (
        <ToolSection label="Sensitivity">
          <RangeRow
            label="Pixel threshold"
            value={sensitivity}
            min={4}
            max={96}
            step={4}
            onChange={e => setSensitivity(Number(e.target.value))}
          />
          <p className="text-[10px] text-slate-400 font-medium">Lower = more sensitive to small changes.</p>
          {changedRatio !== null && (
            <div className="mt-2 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
              <span className="text-xs font-bold text-rose-700">{(changedRatio * 100).toFixed(2)}%</span>
              <span className="text-[10px] text-rose-600 font-medium"> of this page differs</span>
            </div>
          )}
        </ToolSection>
      )}

      {mode === 'text' && summary && (
        <ToolSection label="Summary">
          <div className="grid grid-cols-2 gap-2">
            <Stat value={summary.wordsAdded} label="words added" tone="add" />
            <Stat value={summary.wordsRemoved} label="words removed" tone="remove" />
            <Stat value={summary.pagesChanged} label="pages changed" tone="neutral" />
            <Stat value={summary.pagesAdded + summary.pagesRemoved} label="pages +/-" tone="neutral" />
          </div>
        </ToolSection>
      )}
    </>
  );

  const panelFooter =
    mode === 'text' ? (
      summary ? (
        <button
          onClick={downloadReport}
          className="w-full px-5 py-3 text-sm font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          <Download size={16} /> Download report
        </button>
      ) : (
        <PrimaryButton disabled={!ready} loading={comparing} loadingText="Comparing…" onClick={runTextCompare}>
          Compare text
        </PrimaryButton>
      )
    ) : (
      <PrimaryButton disabled={!ready} loading={visualBusy} loadingText="Rendering…" onClick={runVisualCompare}>
        Refresh visual diff
      </PrimaryButton>
    );

  return (
    <ToolLayout
      icon={<GitCompareArrows size={20} strokeWidth={2} />}
      title="Compare PDFs"
      description="Find what changed between two documents"
      accentClass="from-indigo-500 to-cyan-500"
      panel={panel}
      panelFooter={panelFooter}
    >
      {/* Upload stage */}
      {!ready ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 gap-4">
          {error && <ErrorBanner message={error} />}
          {!docA ? (
            <UploadDropzone
              onFiles={fs => fs[0] && loadInto('A', fs[0])}
              title="Upload the original (A)"
              subtitle="Drag & drop the first PDF, or browse."
              icon={<FileText className="w-9 h-9" strokeWidth={2} />}
              chips={['📄 PDF']}
            />
          ) : (
            <UploadDropzone
              onFiles={fs => fs[0] && loadInto('B', fs[0])}
              title="Upload the revised version (B)"
              subtitle={`Comparing against “${docA.file.name}”.`}
              icon={<FileText className="w-9 h-9" strokeWidth={2} />}
              chips={['📄 PDF']}
            />
          )}
          {loadingSlot && <p className="text-sm text-slate-400 font-medium">Loading document…</p>}
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Page navigator */}
          <div className="flex items-center justify-between gap-3 px-4 md:px-6 py-3 border-b border-slate-200/60 bg-white/70 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPageIndex(i => Math.max(0, i - 1))}
                disabled={pageIndex === 0}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 hover:border-indigo-300 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-bold text-slate-600 tabular-nums min-w-[5.5rem] text-center">
                Page {pageIndex + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPageIndex(i => Math.min(totalPages - 1, i + 1))}
                disabled={pageIndex >= totalPages - 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 hover:border-indigo-300 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            {mode === 'text' && currentTextPage && <PageBadge page={currentTextPage} />}
          </div>

          {error && (
            <div className="px-4 md:px-6 pt-3">
              <ErrorBanner message={error} />
            </div>
          )}

          {/* Comparison body */}
          <div className="flex-1 overflow-auto p-4 md:p-6">
            {mode === 'text' ? (
              !textPages ? (
                <EmptyHint text="Press “Compare text” to highlight word-level changes." />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl mx-auto">
                  <TextPane title={docA!.file.name} side="before" page={currentTextPage!} />
                  <TextPane title={docB!.file.name} side="after" page={currentTextPage!} />
                </div>
              )
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 max-w-7xl mx-auto">
                <CanvasPane title={`A · ${docA!.file.name}`} innerRef={leftCanvasRef} />
                <CanvasPane title={`B · ${docB!.file.name}`} innerRef={rightCanvasRef} />
                <CanvasPane title="Differences" innerRef={diffCanvasRef} highlight />
              </div>
            )}
          </div>
        </div>
      )}
    </ToolLayout>
  );
}

/* ── helpers ── */

function blankCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 8;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 8, 8);
  return c;
}

function mount(host: HTMLDivElement | null, canvas: HTMLCanvasElement) {
  if (!host) return;
  host.innerHTML = '';
  canvas.className = 'w-full h-auto block';
  host.appendChild(canvas);
}

function SlotPlaceholder({ label }: { label: string }) {
  return (
    <div className="border border-dashed border-slate-300 rounded-xl p-2.5 flex items-center gap-2.5 text-slate-400">
      <span className="text-lg shrink-0">＋</span>
      <span className="text-xs font-semibold">{label}</span>
    </div>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: 'add' | 'remove' | 'neutral' }) {
  const tones = {
    add: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    remove: 'bg-rose-50 border-rose-100 text-rose-700',
    neutral: 'bg-slate-50 border-slate-200 text-slate-700',
  } as const;
  return (
    <div className={`rounded-lg border px-2.5 py-2 ${tones[tone]}`}>
      <div className="text-base font-bold tabular-nums leading-none">{value}</div>
      <div className="text-[10px] font-semibold opacity-80 mt-0.5">{label}</div>
    </div>
  );
}

function PageBadge({ page }: { page: PageTextDiff }) {
  if (page.status === 'unchanged')
    return <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">No changes</span>;
  if (page.status === 'added')
    return <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">Page added</span>;
  if (page.status === 'removed')
    return <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full">Page removed</span>;
  return (
    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
      +{page.added} / −{page.removed}
    </span>
  );
}

function TextPane({ title, side, page }: { title: string; side: 'before' | 'after'; page: PageTextDiff }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
      <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <h3 className="text-xs font-bold text-slate-600 truncate" title={title}>
          {side === 'before' ? 'A · ' : 'B · '}
          {title}
        </h3>
      </div>
      <div className="p-4 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap break-words font-serif min-h-[12rem]">
        {renderSegments(page.segments, side)}
      </div>
    </div>
  );
}

function renderSegments(segments: DiffSegment[], side: 'before' | 'after') {
  return segments.map((seg, i) => {
    // On the "before" pane we show equal + removed; on "after" we show equal + added.
    if (seg.type === 'equal') return <span key={i}>{seg.value}</span>;
    if (seg.type === 'remove' && side === 'before')
      return (
        <span key={i} className="bg-rose-100 text-rose-800 line-through decoration-rose-400 rounded-[3px]">
          {seg.value}
        </span>
      );
    if (seg.type === 'add' && side === 'after')
      return (
        <span key={i} className="bg-emerald-100 text-emerald-800 rounded-[3px]">
          {seg.value}
        </span>
      );
    return null;
  });
}

function CanvasPane({
  title,
  innerRef,
  highlight,
}: {
  title: string;
  innerRef: React.RefObject<HTMLDivElement | null>;
  highlight?: boolean;
}) {
  return (
    <div
      className={`border rounded-2xl overflow-hidden flex flex-col ${
        highlight ? 'border-rose-200 ring-1 ring-rose-100' : 'border-slate-200'
      }`}
    >
      <div className={`px-4 py-2.5 border-b ${highlight ? 'border-rose-100 bg-rose-50/50' : 'border-slate-100 bg-slate-50/60'}`}>
        <h3 className={`text-xs font-bold truncate ${highlight ? 'text-rose-700' : 'text-slate-600'}`} title={title}>
          {title}
        </h3>
      </div>
      <div ref={innerRef} className="bg-slate-100/50 p-2 min-h-[12rem] flex items-start justify-center" />
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex-1 flex items-center justify-center text-center py-16">
      <p className="text-sm text-slate-400 font-medium max-w-xs">{text}</p>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="w-full max-w-lg bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center gap-2.5">
      <AlertCircle size={16} className="text-rose-500 shrink-0" />
      <p className="text-xs font-semibold text-rose-700">{message}</p>
    </div>
  );
}
