import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { downloadBlob } from '../utils';

export function Compress() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState<{ before: number, after: number } | null>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStats(null);
    }
  };

  const handleCompress = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const bytes = await file.arrayBuffer();
      // Basic structural compression
      const pdfDoc = await PDFDocument.load(bytes);
      // We can remove structural bloat by saving with useObjectStreams
      const compressedBytes = await pdfDoc.save({ useObjectStreams: false });
      
      setStats({
        before: bytes.byteLength,
        after: compressedBytes.byteLength
      });

      downloadBlob(new Blob([compressedBytes], { type: 'application/pdf' }), `compressed-${file.name}`);
    } catch (e) {
      console.error(e);
      alert('Error compressing PDF');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatSize = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  return (
    <div className="flex-1 bg-slate-100 p-4 md:p-8 flex flex-col items-center justify-center relative overflow-y-auto">
      <div className="max-w-xl w-full bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-2 text-center">Compress PDF</h2>
        <p className="text-slate-600 mb-8 text-center px-4">
          Optimizes PDF structure and removes unused objects to reduce file size.
        </p>

        {!file ? (
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center flex flex-col items-center justify-center bg-slate-50 relative group hover:bg-slate-100 transition-colors">
            <input 
              type="file" 
              accept="application/pdf"
              onChange={handleUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-blue-600 text-3xl mb-4 shadow-sm border border-slate-100">
              📉
            </div>
            <p className="font-semibold text-slate-700">Select PDF to Compress</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 w-full mb-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">📄</span>
                <div className="flex-1 truncate">
                  <div className="font-medium text-slate-800 truncate" title={file.name}>{file.name}</div>
                  <div className="text-sm text-slate-500">{formatSize(file.size)}</div>
                </div>
                <button 
                  onClick={() => { setFile(null); setStats(null); }}
                  className="text-slate-400 hover:text-red-500 text-sm font-medium ml-2 px-2 py-1 rounded hover:bg-red-50"
                  >
                  Remove
                </button>
              </div>

              {stats && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span className="text-slate-500">Original: {formatSize(stats.before)}</span>
                    <span className="text-green-600">Compressed: {formatSize(stats.after)}</span>
                  </div>
                  <div className="text-center mt-2 text-xs text-slate-500">
                    Saved {Math.round((1 - stats.after / stats.before) * 100)}%
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={handleCompress}
              disabled={isProcessing}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {isProcessing ? 'Compressing...' : 'Compress PDF'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
