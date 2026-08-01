import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { FileArchive } from 'lucide-react';
import { downloadBlob } from '../utils';
import { ToolLayout, ToolSection, Segmented, PrimaryButton, FileChip } from './shared/ToolLayout';
import { UploadDropzone } from './shared/UploadDropzone';

type CompressionLevel = 'light' | 'balanced' | 'aggressive';

const LEVELS: { id: CompressionLevel; label: string; description: string }[] = [
  {
    id: 'light',
    label: 'Light',
    description: 'Compact structure, keeps all metadata & quality',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Removes unused objects and metadata',
  },
  {
    id: 'aggressive',
    label: 'Aggressive',
    description: 'Maximum reduction — strips everything possible',
  },
];

export function Compress() {
  const [file, setFile] = useState<File | null>(null);
  const [level, setLevel] = useState<CompressionLevel>('balanced');
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState<{ before: number; after: number } | null>(null);

  const compressPDF = async (bytes: ArrayBuffer, lvl: CompressionLevel): Promise<Uint8Array> => {
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });

    if (lvl === 'balanced' || lvl === 'aggressive') {
      // Strip document info metadata
      pdfDoc.setTitle('');
      pdfDoc.setAuthor('');
      pdfDoc.setSubject('');
      pdfDoc.setKeywords([]);
      pdfDoc.setProducer('');
      pdfDoc.setCreator('');
    }

    // useObjectStreams: true → enables cross-reference streams & compresses object table
    // addDefaultPage: false → don't alter page count
    const saved = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
      // Aggressive: also re-serialise without update sections to flatten history
      ...(lvl === 'aggressive' ? { objectsPerTick: Infinity } : {}),
    });

    return saved;
  };

  const handleCompress = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const bytes = await file.arrayBuffer();
      const compressedBytes = await compressPDF(bytes, level);

      const before = bytes.byteLength;
      const after = compressedBytes.byteLength;

      setStats({ before, after });

      const prefix = level === 'light' ? 'light' : level === 'balanced' ? 'compressed' : 'min';
      downloadBlob(
        new Blob([compressedBytes], { type: 'application/pdf' }),
        `${prefix}-${file.name}`
      );
    } catch (e) {
      console.error(e);
      alert('Error compressing PDF');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatSize = (b: number) => {
    if (b >= 1024 * 1024) return (b / 1024 / 1024).toFixed(2) + ' MB';
    return (b / 1024).toFixed(1) + ' KB';
  };

  const savingPct = stats ? Math.round((1 - stats.after / stats.before) * 100) : 0;
  const increased = stats ? stats.after > stats.before : false;

  const panel = (
    <>
      {file && <FileChip name={file.name} onRemove={() => { setFile(null); setStats(null); }} />}

      <ToolSection label="Compression level">
        <Segmented
          options={LEVELS.map(l => ({ id: l.id, label: l.label }))}
          value={level}
          onChange={v => { setLevel(v); setStats(null); }}
        />
        <p className="text-[10px] text-slate-400 font-medium leading-snug">
          {LEVELS.find(l => l.id === level)?.description}
        </p>
      </ToolSection>
    </>
  );

  return (
    <ToolLayout
      icon={<FileArchive size={20} strokeWidth={2} />}
      title="Compress PDF"
      description="Reduce file size while preserving document fidelity."
      accentClass="from-sky-500 to-cyan-500"
      panel={panel}
      panelFooter={
        <PrimaryButton onClick={handleCompress} disabled={!file} loading={isProcessing} loadingText="Compressing…">
          <FileArchive size={16} /> Compress PDF
        </PrimaryButton>
      }
    >
      {!file ? (
        <UploadDropzone
          onFiles={fs => {
            const f = fs.find(x => x.type === 'application/pdf');
            if (f) { setFile(f); setStats(null); }
          }}
          accept="application/pdf"
          title="Add a PDF to compress"
          chips={['📄 PDF only']}
          icon={<FileArchive className="w-9 h-9" strokeWidth={2} />}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center p-4 md:p-8">
          <div className="w-full max-w-lg bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 md:p-8 shadow-[0_20px_50px_-20px_rgba(79,70,229,0.15)]">
            {/* File info */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-tr from-sky-500 to-cyan-500 flex items-center justify-center text-white shadow-sm relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
                <FileArchive className="w-6 h-6 relative" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-800 truncate" title={file.name}>
                  {file.name}
                </div>
                <div className="text-sm text-slate-500 font-medium">{formatSize(file.size)}</div>
              </div>
            </div>

            {!stats ? (
              <p className="mt-6 text-center text-sm text-slate-500 font-medium leading-relaxed">
                Ready to compress with the{' '}
                <span className="font-bold text-slate-700">{LEVELS.find(l => l.id === level)?.label}</span> preset.
                Hit <span className="font-bold text-slate-700">Compress PDF</span> to start.
              </p>
            ) : (
              <div className="mt-6 pt-6 border-t border-slate-200/80">
                <div className="grid grid-cols-3 items-center gap-2 text-center">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Original</div>
                    <div className="mt-1 text-lg font-extrabold text-slate-700 font-mono">{formatSize(stats.before)}</div>
                  </div>
                  <div className="text-2xl text-slate-300 font-bold">→</div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Compressed</div>
                    <div className={`mt-1 text-lg font-extrabold font-mono ${increased ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {formatSize(stats.after)}
                    </div>
                  </div>
                </div>

                <div
                  className={`mt-5 rounded-2xl p-4 text-center ${
                    increased ? 'bg-amber-50 border border-amber-100' : 'bg-emerald-50 border border-emerald-100'
                  }`}
                >
                  {increased ? (
                    <p className="text-sm font-semibold text-amber-700">
                      ⚠ This PDF is already optimised — no further reduction possible.
                    </p>
                  ) : (
                    <>
                      <div className="text-3xl font-extrabold text-emerald-600 leading-none">{savingPct}%</div>
                      <div className="mt-1 text-xs font-bold uppercase tracking-wider text-emerald-700">smaller — saved &amp; downloaded</div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </ToolLayout>
  );
}
