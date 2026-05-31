import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import JSZip from 'jszip';
import { downloadBlob } from '../utils';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export function Convert() {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const convertImagesToPdf = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    try {
      const pdfDoc = await PDFDocument.create();
      for (const file of files) {
        const bytes = await file.arrayBuffer();
        let image;
        if (file.type === 'image/jpeg') {
          image = await pdfDoc.embedJpg(bytes);
        } else if (file.type === 'image/png') {
          image = await pdfDoc.embedPng(bytes);
        } else {
          continue; // skip unsupported
        }
        
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        });
      }
      
      const pdfBytes = await pdfDoc.save();
      downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), 'converted.pdf');
    } catch (e) {
      console.error(e);
      alert('Error converting to PDF');
    } finally {
      setIsProcessing(false);
    }
  };

  const convertPdfToImages = async () => {
    if (files.length === 0 || files[0].type !== 'application/pdf') {
      alert("Please upload a single PDF file to convert to images.");
      return;
    }
    
    setIsProcessing(true);
    try {
      const file = files[0];
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      
      const zip = new JSZip();
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        
        await page.render({ canvasContext: ctx, viewport }).promise;
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const base64Data = dataUrl.replace(/^data:image\/(png|jpeg);base64,/, "");
        zip.file(`page-${i}.jpg`, base64Data, { base64: true });
      }
      
      const content = await zip.generateAsync({ type: 'blob' });
      downloadBlob(content, 'pdf-images.zip');
    } catch (e) {
      console.error(e);
      alert('Error converting PDF to images');
    } finally {
      setIsProcessing(false);
    }
  };

  const isPdf = files.length > 0 && files[0].type === 'application/pdf';
  const hasImages = files.length > 0 && files.some(f => f.type.startsWith('image/'));

  return (
    <div className="flex-1 bg-slate-100 p-4 md:p-8 flex flex-col items-center justify-center relative overflow-y-auto">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Convert Documents</h2>
        <p className="text-slate-600 mb-8">Convert images to PDF, or extract pages from a PDF as images.</p>
        
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center flex flex-col items-center justify-center mb-8 bg-slate-50 relative group hover:bg-slate-100 hover:border-blue-400 transition-colors">
          <input 
            type="file" 
            multiple 
            accept="image/jpeg,image/png,application/pdf"
            onChange={handleUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-blue-600 text-3xl mb-4 shadow-sm border border-slate-100">
            {files.length === 0 ? '📁' : isPdf ? '📄' : '🖼️'}
          </div>
          <p className="font-semibold text-slate-700">
            {files.length > 0 ? `${files.length} file(s) selected` : "Drag & drop files or click to browse"}
          </p>
          <p className="text-sm text-slate-500 mt-1">Supports PDF, JPG, PNG</p>
        </div>

        {files.length > 0 && (
          <div className="flex gap-4 justify-center">
            {hasImages && (
              <button 
                onClick={convertImagesToPdf}
                disabled={isProcessing}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                {isProcessing ? 'Processing...' : 'Convert Images to PDF'}
              </button>
            )}
            
            {isPdf && (
              <button 
                onClick={convertPdfToImages}
                disabled={isProcessing}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
               >
                {isProcessing ? 'Processing...' : 'Convert PDF to Images (ZIP)'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
