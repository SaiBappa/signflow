import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  FormInput,
  Type,
  CheckSquare,
  Signature,
  Calendar,
  Circle,
  Trash2,
  Sparkles,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ScanSearch,
} from 'lucide-react';
import { downloadBlob, cn } from '../utils';
import {
  ToolLayout,
  ToolField,
  ToolSection,
  ToolInput,
  ToolSelect,
  PrimaryButton,
  FileChip,
  RangeRow,
} from './shared/ToolLayout';
import { UploadDropzone } from './shared/UploadDropzone';
import type {
  DetectedField,
  DetectedFieldType,
  DetectionResult,
  DetectionOptions,
} from '../services/formDetectionTypes';
import { DEFAULT_DETECTION_OPTIONS } from '../services/formDetectionTypes';
import { detectFormFields } from '../services/formDetection';
import { detectFormFieldsAI } from '../services/aiFormDetection';
import { useAiAvailable } from '../services/geminiClient';
import { buildFillablePdf } from '../services/fillableFormExport';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

/* ============================================================================
 * Prepare Form — auto-detect form fields and convert a flat PDF into a
 * fillable AcroForm (Acrobat "Prepare Form" style). The main area renders the
 * page to a canvas and overlays colour-coded boxes for every detected field on
 * that page; the left panel lists those fields for review, rename, retype,
 * enable/disable and delete before exporting.
 * ========================================================================== */

/* Per-type visual + label metadata. Colours match the prompt's contract:
 * text = indigo, checkbox = emerald, signature = violet, date = amber,
 * radio = sky. */
const FIELD_META: Record<
  DetectedFieldType,
  { label: string; icon: React.ReactNode; box: string; chip: string; dot: string; ring: string }
> = {
  text: {
    label: 'Text',
    icon: <Type size={13} />,
    box: 'border-indigo-500 bg-indigo-500/10',
    chip: 'bg-indigo-500',
    dot: 'bg-indigo-500',
    ring: 'ring-indigo-400',
  },
  checkbox: {
    label: 'Checkbox',
    icon: <CheckSquare size={13} />,
    box: 'border-emerald-500 bg-emerald-500/10',
    chip: 'bg-emerald-500',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-400',
  },
  signature: {
    label: 'Signature',
    icon: <Signature size={13} />,
    box: 'border-violet-500 bg-violet-500/10',
    chip: 'bg-violet-500',
    dot: 'bg-violet-500',
    ring: 'ring-violet-400',
  },
  date: {
    label: 'Date',
    icon: <Calendar size={13} />,
    box: 'border-amber-500 bg-amber-500/10',
    chip: 'bg-amber-500',
    dot: 'bg-amber-500',
    ring: 'ring-amber-400',
  },
  radio: {
    label: 'Radio',
    icon: <Circle size={13} />,
    box: 'border-sky-500 bg-sky-500/10',
    chip: 'bg-sky-500',
    dot: 'bg-sky-500',
    ring: 'ring-sky-400',
  },
};

const TYPE_ORDER: DetectedFieldType[] = ['text', 'checkbox', 'signature', 'date', 'radio'];

export function PrepareForm() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [fields, setFields] = useState<DetectedField[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(1); // 1-based
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  // Whether AI detection is usable (server key or a user-supplied key).
  const aiAvailable = useAiAvailable();
  // Detection engine: Gemini vision (default) or local heuristics.
  const [useAI, setUseAI] = useState<boolean>(true);

  // Detection options.
  const [detectText, setDetectText] = useState(DEFAULT_DETECTION_OPTIONS.detectText);
  const [detectCheckbox, setDetectCheckbox] = useState(DEFAULT_DETECTION_OPTIONS.detectCheckbox);
  const [detectSignature, setDetectSignature] = useState(DEFAULT_DETECTION_OPTIONS.detectSignature);
  const [detectDate, setDetectDate] = useState(DEFAULT_DETECTION_OPTIONS.detectDate);
  const [sensitivity, setSensitivity] = useState(Math.round(DEFAULT_DETECTION_OPTIONS.sensitivity * 100)); // 0..100

  // Refs to panel rows so selecting a box can scroll its row into view.
  const rowRefs = useRef<Record<string, HTMLLIElement | null>>({});

  const resetAll = useCallback(() => {
    setFile(null);
    setResult(null);
    setFields([]);
    setError(null);
    setPageNumber(1);
    setSelectedFieldId(null);
    setIsDetecting(false);
    setIsExporting(false);
  }, []);

  // Run a detection pass against the current file with the current options.
  const runDetection = useCallback(
    async (target: File) => {
      setIsDetecting(true);
      setError(null);
      try {
        const options: DetectionOptions = {
          detectText,
          detectCheckbox,
          detectSignature,
          detectDate,
          sensitivity: sensitivity / 100,
        };
        const res = useAI
          ? await detectFormFieldsAI(target, options)
          : await detectFormFields(target, options);
        setResult(res);
        setFields(res.fields.map(f => ({ ...f })));
        setSelectedFieldId(null);
        setPageNumber(1);
      } catch (e) {
        console.error('Form detection failed', e);
        setResult(null);
        setFields([]);
        setError(
          useAI
            ? `AI detection failed: ${e instanceof Error ? e.message : 'unknown error'}. Turn off "AI detection" to use the offline scanner.`
            : 'We could not scan this PDF for form fields. It may be encrypted, corrupt, or an unsupported file.',
        );
      } finally {
        setIsDetecting(false);
      }
    },
    [useAI, detectText, detectCheckbox, detectSignature, detectDate, sensitivity],
  );

  // On first file selection, auto-run detection.
  const handleFile = useCallback(
    (f: File) => {
      setFile(f);
      setResult(null);
      setFields([]);
      setSelectedFieldId(null);
      setError(null);
      setPageNumber(1);
      void runDetection(f);
    },
    [runDetection],
  );

  // ── Field editing helpers ──
  const updateField = useCallback((id: string, patch: Partial<DetectedField>) => {
    setFields(prev => prev.map(f => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const deleteField = useCallback(
    (id: string) => {
      setFields(prev => prev.filter(f => f.id !== id));
      setSelectedFieldId(sel => (sel === id ? null : sel));
    },
    [],
  );

  const selectField = useCallback((id: string) => {
    setSelectedFieldId(id);
    const row = rowRefs.current[id];
    if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);

  // ── Derived data ──
  const counts = useMemo(() => {
    const c: Record<DetectedFieldType, number> = { text: 0, checkbox: 0, signature: 0, date: 0, radio: 0 };
    for (const f of fields) c[f.type] += 1;
    return c;
  }, [fields]);

  const enabledFields = useMemo(() => fields.filter(f => f.enabled), [fields]);
  const totalPages = result?.pages.length ?? 0;
  const pageIndex = pageNumber - 1;
  const fieldsOnPage = useMemo(() => fields.filter(f => f.pageIndex === pageIndex), [fields, pageIndex]);

  const summaryParts = TYPE_ORDER.filter(t => counts[t] > 0).map(t => `${counts[t]} ${FIELD_META[t].label.toLowerCase()}`);

  // ── Export ──
  const handleExport = useCallback(async () => {
    if (!file || !result || enabledFields.length === 0) return;
    setIsExporting(true);
    setError(null);
    try {
      const bytes = await buildFillablePdf(file, enabledFields, result.pages);
      downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `fillable-${file.name}`);
    } catch (e) {
      console.error('Fillable export failed', e);
      setError('Something went wrong while building the fillable PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [file, result, enabledFields]);

  // Clamp the page number if a re-detection returns fewer pages.
  useEffect(() => {
    if (totalPages > 0 && pageNumber > totalPages) setPageNumber(totalPages);
  }, [totalPages, pageNumber]);

  // ── Left panel ──
  const optionToggles: { id: DetectedFieldType; label: string; on: boolean; set: (v: boolean) => void }[] = [
    { id: 'text', label: 'Text', on: detectText, set: setDetectText },
    { id: 'checkbox', label: 'Checkbox', on: detectCheckbox, set: setDetectCheckbox },
    { id: 'signature', label: 'Signature', on: detectSignature, set: setDetectSignature },
    { id: 'date', label: 'Date', on: detectDate, set: setDetectDate },
  ];

  const panel = (
    <>
      {file && <FileChip name={file.name} onRemove={resetAll} />}

      {/* Detection summary */}
      {file && (
        <div className="bg-gradient-to-tr from-fuchsia-50 to-pink-50 border border-pink-100 rounded-xl p-3">
          {isDetecting ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-pink-700">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning…
            </div>
          ) : fields.length > 0 ? (
            <>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-pink-700 tabular-nums leading-none">{fields.length}</span>
                <span className="text-[11px] font-bold uppercase tracking-wide text-pink-600/80">
                  field{fields.length === 1 ? '' : 's'} detected
                </span>
              </div>
              {summaryParts.length > 0 && (
                <p className="text-[11px] text-slate-500 font-medium mt-1 leading-snug">{summaryParts.join(' · ')}</p>
              )}
            </>
          ) : (
            <p className="text-[11px] text-slate-500 font-medium">No fields detected yet.</p>
          )}
        </div>
      )}

      {/* Detection engine */}
      <ToolSection label="Engine">
        <button
          type="button"
          onClick={() => setUseAI(v => !v)}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer',
            useAI
              ? 'border-transparent text-white shadow-sm bg-gradient-to-r from-indigo-500 to-violet-500'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
          )}
        >
          <Sparkles className={cn('w-4 h-4 shrink-0', useAI ? 'text-white' : 'text-indigo-500')} />
          <span className="flex-1 min-w-0">
            <span className="block text-xs font-bold leading-tight">AI detection</span>
            <span className={cn('block text-[10px] font-medium leading-tight', useAI ? 'text-white/80' : 'text-slate-400')}>
              {useAI ? 'Gemini 3.5 Flash · vision' : 'Offline heuristic scanner'}
            </span>
          </span>
          <span
            className={cn(
              'relative w-8 h-[18px] rounded-full shrink-0 transition-colors',
              useAI ? 'bg-white/30' : 'bg-slate-200',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-all',
                useAI ? 'left-[15px]' : 'left-0.5',
              )}
            />
          </span>
        </button>
        {useAI && !aiAvailable && (
          <div className="flex items-start gap-1.5 text-[10px] text-amber-600 bg-amber-50/60 p-2 rounded-lg border border-amber-100 mt-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>No Gemini API key available. Add one in the panel, or switch to the offline scanner.</span>
          </div>
        )}
      </ToolSection>

      {/* Detection controls */}
      <ToolSection label="Detect">
        <div className="grid grid-cols-2 gap-1.5">
          {optionToggles.map(o => (
            <button
              key={o.id}
              type="button"
              onClick={() => o.set(!o.on)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer',
                o.on
                  ? 'border-transparent text-white shadow-sm ' + FIELD_META[o.id].chip
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
              )}
            >
              <span className={cn(o.on ? 'text-white' : 'text-slate-400')}>{FIELD_META[o.id].icon}</span>
              {o.label}
            </button>
          ))}
        </div>
      </ToolSection>

      <RangeRow
        label="Sensitivity"
        value={sensitivity}
        suffix="%"
        min={0}
        max={100}
        onChange={e => setSensitivity(+e.target.value)}
      />

      {file && (
        <button
          type="button"
          onClick={() => file && runDetection(file)}
          disabled={isDetecting}
          className="w-full px-4 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all border border-pink-200 text-pink-700 bg-pink-50 hover:bg-pink-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isDetecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanSearch size={15} />}
          {isDetecting ? 'Scanning…' : 'Re-scan with these settings'}
        </button>
      )}

      {/* Detected fields list */}
      {fields.length > 0 && (
        <ToolSection label={`Fields (${fields.length})`}>
          <ul className="space-y-1.5 max-h-[42vh] overflow-y-auto pr-0.5 -mr-0.5">
            {fields.map(f => {
              const meta = FIELD_META[f.type];
              const selected = selectedFieldId === f.id;
              return (
                <li
                  key={f.id}
                  ref={el => {
                    rowRefs.current[f.id] = el;
                  }}
                  onClick={() => {
                    setSelectedFieldId(f.id);
                    if (f.pageIndex !== pageIndex) setPageNumber(f.pageIndex + 1);
                  }}
                  className={cn(
                    'rounded-xl border p-2 cursor-pointer transition-all',
                    selected ? 'border-pink-300 bg-pink-50/70 ring-1 ring-pink-200' : 'border-slate-200 bg-white hover:border-slate-300',
                    !f.enabled && 'opacity-60',
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={cn('w-5 h-5 shrink-0 rounded-md flex items-center justify-center text-white', meta.chip)}>
                      {meta.icon}
                    </span>
                    <ToolInput
                      value={f.name}
                      onChange={e => updateField(f.id, { name: e.target.value })}
                      onClick={e => e.stopPropagation()}
                      placeholder="Field name"
                      className="flex-1 min-w-0 px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      title="Delete field"
                      onClick={e => {
                        e.stopPropagation();
                        deleteField(f.id);
                      }}
                      className="w-6 h-6 shrink-0 flex items-center justify-center rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 cursor-pointer transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 mt-1.5">
                    <ToolSelect
                      value={f.type}
                      onChange={e => updateField(f.id, { type: e.target.value as DetectedFieldType })}
                      onClick={e => e.stopPropagation()}
                      className="flex-1 px-2 py-1 text-[11px]"
                    >
                      {TYPE_ORDER.map(t => (
                        <option key={t} value={t}>
                          {FIELD_META[t].label}
                        </option>
                      ))}
                    </ToolSelect>
                    <label
                      className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400 cursor-pointer select-none px-1"
                      onClick={e => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={f.enabled}
                        onChange={e => updateField(f.id, { enabled: e.target.checked })}
                        className="accent-pink-500 cursor-pointer"
                      />
                      On
                    </label>
                    <span className="text-[10px] font-mono text-slate-300 tabular-nums" title="Page">
                      p{f.pageIndex + 1}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </ToolSection>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 flex gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-rose-700 leading-snug font-semibold">{error}</p>
        </div>
      )}
    </>
  );

  return (
    <ToolLayout
      icon={<FormInput size={20} strokeWidth={2} />}
      title="Prepare Form"
      description="Auto-detect form fields and convert to a fillable PDF."
      accentClass="from-fuchsia-500 to-pink-500"
      panel={panel}
      panelFooter={
        <PrimaryButton
          onClick={handleExport}
          disabled={!file || enabledFields.length === 0}
          loading={isExporting}
          loadingText="Building…"
        >
          <Sparkles size={16} /> Create Fillable PDF
        </PrimaryButton>
      }
    >
      {!file ? (
        <UploadDropzone
          onFiles={fs => {
            const f = fs.find(x => x.type === 'application/pdf');
            if (f) handleFile(f);
          }}
          accept="application/pdf"
          title="Add a PDF to convert"
          subtitle={
            <>
              Drag &amp; drop a PDF here, or <span className="text-indigo-600 font-semibold">browse</span>. We will scan it for
              fillable form fields automatically.
            </>
          }
          chips={['📄 PDF only', '✨ Auto field detection']}
          icon={<FormInput className="w-9 h-9" strokeWidth={2} />}
        />
      ) : (
        <DetectionPreview
          file={file}
          fields={fieldsOnPage}
          isDetecting={isDetecting}
          totalDetected={fields.length}
          pageNumber={pageNumber}
          totalPages={totalPages}
          selectedFieldId={selectedFieldId}
          onSelectField={selectField}
          onPageChange={setPageNumber}
          sensitivity={sensitivity}
        />
      )}
    </ToolLayout>
  );
}

/* ============================================================================
 * DetectionPreview — renders the active page to a canvas and overlays the
 * detected fields for that page as colour-coded, clickable boxes. Mirrors the
 * pdfjs setup from PdfPagePreview but with an interactive, field-aware overlay.
 * ========================================================================== */
interface DetectionPreviewProps {
  file: File;
  fields: DetectedField[]; // fields on the current page only
  isDetecting: boolean;
  totalDetected: number;
  pageNumber: number; // 1-based
  totalPages: number;
  selectedFieldId: string | null;
  onSelectField: (id: string) => void;
  onPageChange: (page: number) => void;
  sensitivity: number;
}

function DetectionPreview({
  file,
  fields,
  isDetecting,
  totalDetected,
  pageNumber,
  totalPages,
  selectedFieldId,
  onSelectField,
  onPageChange,
}: DetectionPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const docRef = useRef<any>(null);
  const [docPages, setDocPages] = useState(0);
  const [native, setNative] = useState({ width: 0, height: 0 });
  const [displayed, setDisplayed] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);

  // (Re)load the document when the file changes. Pass a COPY of the bytes so
  // pdfjs can't detach the buffer the parent still holds for export.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const buf = await file.arrayBuffer();
        if (cancelled) return;
        const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
        if (cancelled) return;
        docRef.current = doc;
        setDocPages(doc.numPages);
      } catch (e) {
        console.error('Preview load failed', e);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Render the active page to the canvas.
  useEffect(() => {
    let cancelled = false;
    const doc = docRef.current;
    if (!doc || docPages === 0) return;
    setLoading(true);
    (async () => {
      try {
        const page = await doc.getPage(Math.min(pageNumber, doc.numPages));
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1 });
        const renderScale = Math.min(2, Math.max(1, 1000 / viewport.width));
        const rv = page.getViewport({ scale: renderScale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = rv.width;
        canvas.height = rv.height;
        await page.render({ canvasContext: ctx, viewport: rv }).promise;
        if (cancelled) return;
        setNative({ width: viewport.width, height: viewport.height });
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          console.error('Preview render failed', e);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pageNumber, docPages]);

  // Track displayed size so the overlay boxes scale with the page on screen.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setDisplayed({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [native.width, native.height]);

  // S = displayedWidth / nativePdfWidth. rect is top-left origin → no Y flip.
  const scale = native.width ? displayed.width / native.width : 1;
  const showEmptyHint = !isDetecting && totalDetected === 0;

  return (
    <div className="flex-1 flex flex-col items-center justify-start gap-3 p-4 md:p-8 min-h-0">
      <div
        className="relative shadow-[0_10px_40px_-12px_rgba(0,0,0,0.25)] rounded-sm bg-white"
        style={{
          aspectRatio: native.width ? `${native.width} / ${native.height}` : undefined,
          width: '100%',
          maxWidth: 720,
        }}
      >
        <div ref={wrapRef} className="relative w-full h-full">
          <canvas ref={canvasRef} className="block w-full h-full rounded-sm" />

          {/* Detected-field overlay */}
          {!loading && native.width > 0 && displayed.width > 0 && (
            <div className="absolute inset-0">
              {fields.map(f => {
                const meta = FIELD_META[f.type];
                const selected = selectedFieldId === f.id;
                const left = f.rect.x * scale;
                const top = f.rect.y * scale;
                const width = f.rect.width * scale;
                const height = f.rect.height * scale;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onSelectField(f.id)}
                    title={`${meta.label}: ${f.name}`}
                    style={{ left, top, width, height }}
                    className={cn(
                      'absolute border-2 rounded-[3px] transition-all cursor-pointer group',
                      meta.box,
                      !f.enabled && 'border-dashed opacity-50',
                      selected && cn('ring-2 ring-offset-1 z-10 shadow-md', meta.ring),
                    )}
                  >
                    {/* Name chip above the box */}
                    <span
                      className={cn(
                        'absolute -top-[18px] left-0 px-1.5 py-px rounded text-[9px] font-bold text-white whitespace-nowrap max-w-[160px] truncate flex items-center gap-1 shadow-sm',
                        meta.chip,
                        selected ? 'opacity-100' : 'opacity-80 group-hover:opacity-100',
                      )}
                    >
                      {meta.icon}
                      {f.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Detecting / loading overlay */}
          {(loading || isDetecting) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/70 backdrop-blur-[1px]">
              <Loader2 className="w-7 h-7 text-fuchsia-500 animate-spin" />
              {isDetecting && <p className="text-xs font-semibold text-slate-500">Scanning for form fields…</p>}
            </div>
          )}

          {/* Empty result hint */}
          {showEmptyHint && !loading && (
            <div className="absolute inset-x-3 bottom-3 bg-amber-50/95 border border-amber-200 rounded-xl p-3 flex gap-2 shadow-sm">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800 leading-snug font-semibold">
                No form fields were recognised. Try raising the sensitivity, enabling more field types, then re-scan — or this
                PDF may simply have no detectable fields.
              </p>
            </div>
          )}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-3 bg-white/90 border border-slate-200 rounded-full px-2 py-1 shadow-sm">
          <button
            onClick={() => onPageChange(Math.max(1, pageNumber - 1))}
            disabled={pageNumber <= 1}
            className="w-7 h-7 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-bold text-slate-600 tabular-nums">
            {pageNumber} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages, pageNumber + 1))}
            disabled={pageNumber >= totalPages}
            className="w-7 h-7 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
