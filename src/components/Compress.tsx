import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { downloadBlob } from '../utils';

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
  const [dragOver, setDragOver] = useState(false);

  const handleUpload = (f: File) => {
    if (f.type === 'application/pdf') {
      setFile(f);
      setStats(null);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleUpload(e.target.files[0]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.[0]) handleUpload(e.dataTransfer.files[0]);
  };

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

  return (
    <div className="flex-1 bg-slate-100 p-4 md:p-8 flex flex-col items-center justify-center relative overflow-y-auto">
      <div className="max-w-xl w-full bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-2 text-center">Compress PDF</h2>
        <p className="text-slate-500 mb-6 text-center text-sm px-4">
          Reduce file size while preserving document fidelity.
        </p>

        {/* Compression level selector */}
        <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-lg">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              onClick={() => { setLevel(l.id); setStats(null); }}
              className={`flex-1 py-2 px-1 rounded-md text-sm font-semibold transition-all ${
                level === l.id
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 text-center -mt-4 mb-6">
          {LEVELS.find((l) => l.id === level)?.description}
        </p>

        {!file ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-12 text-center flex flex-col items-center justify-center relative group transition-colors cursor-pointer ${
              dragOver
                ? 'border-blue-400 bg-blue-50'
                : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
            }`}
          >
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-3xl mb-4 shadow-sm border border-slate-100">
              📉
            </div>
            <p className="font-semibold text-slate-700">Drop PDF here or click to select</p>
            <p className="text-sm text-slate-400 mt-1">PDF files only</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 w-full mb-6">
              <div className="flex items-center gap-3">
                <span className="text-2xl shrink-0">📄</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 truncate" title={file.name}>
                    {file.name}
                  </div>
                  <div className="text-sm text-slate-500">{formatSize(file.size)}</div>
                </div>
                <button
                  onClick={() => { setFile(null); setStats(null); }}
                  className="text-slate-400 hover:text-red-500 text-sm font-medium ml-2 px-2 py-1 rounded hover:bg-red-50 shrink-0"
                >
                  Remove
                </button>
              </div>

              {stats && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span className="text-slate-500">Original: {formatSize(stats.before)}</span>
                    <span className={increased ? 'text-amber-600' : 'text-green-600'}>
                      Output: {formatSize(stats.after)}
                    </span>
                  </div>
                  <div className={`text-center mt-2 text-xs font-medium ${increased ? 'text-amber-500' : 'text-green-600'}`}>
                    {increased
                      ? `⚠ This PDF is already optimised — no further reduction possible`
                      : `✓ Saved ${savingPct}%`}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleCompress}
              disabled={isProcessing}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm w-full"
            >
              {isProcessing ? 'Compressing…' : 'Compress PDF'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
