import React, { useState, useEffect, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import JSZip from 'jszip';
import { downloadBlob, cn } from '../utils';
import * as XLSX from 'xlsx';
import {
  FileText, FileSpreadsheet, Sparkles,
  AlertCircle, RefreshCw, Key,
  ArrowRight, Loader2, Eye, EyeOff, X
} from 'lucide-react';
import { ToolLayout, ToolField, ToolInput } from './shared/ToolLayout';
import { UploadDropzone } from './shared/UploadDropzone';
import { extractPageRuns, ExtractedRun } from '../services/textExtraction';
import { generateContent, useServerKeyAvailable, isUsableKey, hasUserGeminiKey, GEMINI_KEY_STORAGE } from '../services/geminiClient';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

interface PdfPagePreviewProps {
  pdfDoc: any;
  pageNum: number;
  useAi: boolean;
  aiReady: boolean;
  isProcessing: boolean;
  setIsProcessing: (v: boolean) => void;
  setStatus: (v: string) => void;
}

function PdfPagePreview({
  pdfDoc,
  pageNum,
  useAi,
  aiReady,
  isProcessing,
  setIsProcessing,
  setStatus
}: PdfPagePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selection, setSelection] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [loadingPage, setLoadingPage] = useState(false);
  const [exportingType, setExportingType] = useState<'excel' | 'word' | null>(null);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      if (!pdfDoc || !canvasRef.current) return;
      setLoadingPage(true);
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (cancelled) return;
        
        const containerWidth = Math.min(960, window.innerWidth - 64);
        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = containerWidth / unscaledViewport.width;
        const viewport = page.getViewport({ scale });
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        setDimensions({ width: viewport.width, height: viewport.height });
        
        const context = canvas.getContext('2d');
        if (context && !cancelled) {
          await page.render({ canvasContext: context, viewport }).promise;
        }
      } catch (e) {
        console.error("Error rendering preview page:", e);
      } finally {
        if (!cancelled) setLoadingPage(false);
      }
    };
    render();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageNum]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (exportingType) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setStartPos({ x, y });
    setSelection({ x, y, w: 0, h: 0 });
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !selection || exportingType) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    const clampedX = Math.max(0, Math.min(currentX, dimensions.width));
    const clampedY = Math.max(0, Math.min(currentY, dimensions.height));

    const x = Math.min(startPos.x, clampedX);
    const y = Math.min(startPos.y, clampedY);
    const w = Math.abs(startPos.x - clampedX);
    const h = Math.abs(startPos.y - clampedY);
    
    setSelection({ x, y, w, h });
  };

  const handleMouseUp = () => {
    if (exportingType) return;
    setIsDrawing(false);
    if (selection && (selection.w < 10 || selection.h < 10)) {
      setSelection(null);
    }
  };

  const handleExportSelection = async (type: 'excel' | 'word') => {
    if (!selection) return;
    setExportingType(type);
    setIsProcessing(true);
    setStatus(`Extracting text runs for selection...`);

    try {
      const runs = await extractPageRuns(pdfDoc, pageNum, dimensions.width, dimensions.height);
      const selectedRuns = runs.filter(run => {
        const rx = run.pos.x;
        const ry = run.pos.y;
        const rw = run.pos.width;
        const rh = run.pos.height;
        
        const sx = selection.x;
        const sy = selection.y;
        const sw = selection.w;
        const sh = selection.h;
        
        return rx + rw >= sx && rx <= sx + sw && ry + rh >= sy && ry <= sy + sh;
      });

      if (selectedRuns.length === 0) {
        alert("No text found in the selected area. Please try a different area.");
        setIsProcessing(false);
        setExportingType(null);
        return;
      }

      const selectedRows: ExtractedRun[][] = [];
      selectedRuns.forEach(run => {
        let placed = false;
        for (const row of selectedRows) {
          const avgY = row.reduce((sum, r) => sum + r.pos.y, 0) / row.length;
          if (Math.abs(run.pos.y - avgY) < 8) {
            row.push(run);
            placed = true;
            break;
          }
        }
        if (!placed) {
          selectedRows.push([run]);
        }
      });

      selectedRows.sort((a, b) => {
        const avgYA = a.reduce((sum, r) => sum + r.pos.y, 0) / a.length;
        const avgYB = b.reduce((sum, r) => sum + r.pos.y, 0) / b.length;
        return avgYA - avgYB;
      });

      selectedRows.forEach(row => {
        row.sort((a, b) => a.pos.x - b.pos.x);
      });

      if (useAi && aiReady) {
        setStatus("Sending selected text to AI for structured layout formatting...");
        const runsText = selectedRows.map((row, rIdx) => {
          return `Row ${rIdx + 1}: ` + row.map(run => `[x:${Math.round(run.pos.x)}, text:"${run.text}"]`).join(', ');
        }).join('\n');

        const requestText = type === 'excel'
          ? "Extract this tabular data. Provide the output in a JSON object with a single top-level key 'rows' containing an array of objects where each object is a key-value pair representing a row of the table. Column names should be descriptive. Ensure numbers and IDs are exact. Output ONLY the JSON."
          : "Convert this selected layout data into a beautiful Word-compatible semantic HTML table. Style the table header with a gray background and borders. Output ONLY the HTML inside a JSON object: `{\"html\": \"...\"}`.";

        const resData = await generateContent('gemini-2.5-flash', {
          contents: [
            {
              parts: [
                {
                  text: `Here is text extracted from a selected portion of a document page:\n\n${runsText}\n\n${requestText}`
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json"
          }
        });
        const jsonText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!jsonText) throw new Error("Empty response from AI");

        const parsed = JSON.parse(jsonText);

        if (type === 'excel') {
          setStatus("Generating Excel workbook...");
          const wb = XLSX.utils.book_new();
          const ws = XLSX.utils.json_to_sheet(parsed.rows || parsed.tables?.[0]?.rows || parsed || []);
          XLSX.utils.book_append_sheet(wb, ws, "Selected Data");
          
          const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
          const buf = new ArrayBuffer(wbout.length);
          const view = new Uint8Array(buf);
          for (let i = 0; i < wbout.length; i++) view[i] = wbout.charCodeAt(i) & 0xFF;
          downloadBlob(new Blob([buf], { type: "application/octet-stream" }), `selected_rows_page_${pageNum}.xlsx`);
        } else {
          setStatus("Generating Word document...");
          const htmlContent = parsed.html || "";
          const wordDocContent = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: 'Calibri', sans-serif; font-size: 11pt; margin: 1in; }
                table { border-collapse: collapse; width: 100%; margin: 12px 0; }
                th { border: 1px solid #999; background-color: #f3f4f6; padding: 6px; font-weight: bold; text-align: left; }
                td { border: 1px solid #ccc; padding: 6px; }
              </style>
            </head>
            <body>
              ${htmlContent}
            </body>
            </html>
          `;
          downloadBlob(new Blob(['\ufeff' + wordDocContent], { type: 'application/msword' }), `selected_rows_page_${pageNum}.doc`);
        }
        setStatus("Selected data exported successfully!");
      } else {
        setStatus("Exporting data using local coordinate heuristic...");
        const aoa = selectedRows.map(row => {
          const cells: string[] = [];
          let currentCell = "";
          let lastX = -999;
          
          row.forEach(item => {
            const gap = item.pos.x - lastX;
            if (lastX === -999 || gap < 25) {
              if (lastX !== -999 && gap > 4) {
                currentCell += " " + item.text;
              } else {
                currentCell += item.text;
              }
            } else {
              cells.push(currentCell.trim());
              currentCell = item.text;
            }
            lastX = item.pos.x + item.pos.width;
          });
          if (currentCell) {
            cells.push(currentCell.trim());
          }
          return cells;
        });

        if (type === 'excel') {
          const wb = XLSX.utils.book_new();
          const ws = XLSX.utils.aoa_to_sheet(aoa);
          XLSX.utils.book_append_sheet(wb, ws, "Selected Data");
          
          const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
          const buf = new ArrayBuffer(wbout.length);
          const view = new Uint8Array(buf);
          for (let i = 0; i < wbout.length; i++) view[i] = wbout.charCodeAt(i) & 0xFF;
          downloadBlob(new Blob([buf], { type: "application/octet-stream" }), `selected_rows_page_${pageNum}_extracted.xlsx`);
        } else {
          const htmlContent = `
            <table border="1" style="border-collapse: collapse; width: 100%;">
              ${aoa.map(row => `<tr>${row.map(cell => `<td style="border: 1px solid #ccc; padding: 6px;">${cell}</td>`).join("")}</tr>`).join("")}
            </table>
          `;
          const wordDocContent = `
            <html>
            <head><meta charset="utf-8"><style>body { font-family: sans-serif; font-size: 10pt; } td { padding: 6px; }</style></head>
            <body>${htmlContent}</body>
            </html>
          `;
          downloadBlob(new Blob(['\ufeff' + wordDocContent], { type: 'application/msword' }), `selected_rows_page_${pageNum}_extracted.doc`);
        }
        setStatus("Selected data exported successfully!");
      }
    } catch (e: any) {
      console.error(e);
      alert(`Error exporting selection: ${e.message || e}`);
      setStatus("Export failed.");
    } finally {
      setIsProcessing(false);
      setExportingType(null);
      setSelection(null);
    }
  };

  return (
    <div className="relative mx-auto my-2 select-none">
      {loadingPage && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10 rounded-xl">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      )}
      
      <div 
        ref={containerRef} 
        className="relative border border-slate-200/80 rounded-xl shadow-sm overflow-hidden bg-white cursor-crosshair"
        style={{ width: dimensions.width || 'auto', height: dimensions.height || 'auto' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <canvas ref={canvasRef} className="block max-w-full" />
        
        {selection && (
          <div 
            className="absolute border-2 border-dashed border-indigo-500 bg-indigo-500/10 pointer-events-none rounded"
            style={{
              left: selection.x,
              top: selection.y,
              width: selection.w,
              height: selection.h
            }}
          />
        )}

        {selection && !isDrawing && selection.w > 15 && selection.h > 15 && (
          <div 
            className="absolute bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl rounded-xl p-1.5 flex items-center gap-1 z-30 pointer-events-auto scale-in"
            style={{
              left: Math.min(dimensions.width - 170, Math.max(8, selection.x + selection.w/2 - 85)),
              top: selection.y + selection.h + 10 > dimensions.height - 50 
                ? Math.max(8, selection.y - 48) 
                : selection.y + selection.h + 10
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => handleExportSelection('excel')}
              disabled={isProcessing}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {exportingType === 'excel' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
              Excel
            </button>
            <button
              onClick={() => handleExportSelection('word')}
              disabled={isProcessing}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {exportingType === 'word' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              Word
            </button>
            <button
              onClick={() => setSelection(null)}
              disabled={isProcessing}
              className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5 font-bold" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export function Convert() {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [convertTab, setConvertTab] = useState<'entire' | 'selective'>('entire');
  const [pdfDoc, setPdfDoc] = useState<any>(null);

  // AI Settings
  const [useAi, setUseAi] = useState<boolean>(true);
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem(GEMINI_KEY_STORAGE) || '';
  });
  const [showKey, setShowKey] = useState<boolean>(false);

  // The server may hold the key; the user can also bring their own.
  const hasServerKey = useServerKeyAvailable();

  // Sync API Key to Local Storage
  useEffect(() => {
    localStorage.setItem(GEMINI_KEY_STORAGE, apiKey);
  }, [apiKey]);

  useEffect(() => {
    const loadPdf = async () => {
      if (files.length === 0 || files[0].type !== 'application/pdf') {
        setPdfDoc(null);
        setConvertTab('entire');
        return;
      }
      try {
        const arrayBuffer = await files[0].arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        setPdfDoc(doc);
      } catch (e) {
        console.error("Error loading PDF for preview:", e);
      }
    };
    loadPdf();
  }, [files]);

  const convertImagesToPdf = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setStatus("Generating PDF from images...");
    try {
      const pdfDoc = await PDFDocument.create();
      for (const file of files) {
        const bytes = await file.arrayBuffer();
        let image;
        if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
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
      setStatus("PDF downloaded successfully!");
    } catch (e) {
      console.error(e);
      alert('Error converting to PDF');
      setStatus("Conversion failed.");
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
    setStatus("Extracting pages from PDF...");
    try {
      const file = files[0];
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

      const zip = new JSZip();

      for (let i = 1; i <= pdf.numPages; i++) {
        setStatus(`Rendering page ${i} of ${pdf.numPages}...`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        // @ts-ignore
        await page.render({ canvasContext: ctx, viewport }).promise;

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const base64Data = dataUrl.replace(/^data:image\/(png|jpeg);base64,/, "");
        zip.file(`page-${i}.jpg`, base64Data, { base64: true });
      }

      setStatus("Zipping image files...");
      const content = await zip.generateAsync({ type: 'blob' });
      downloadBlob(content, `${file.name.replace(/\.[^/.]+$/, "")}_images.zip`);
      setStatus("Images ZIP downloaded successfully!");
    } catch (e) {
      console.error(e);
      alert('Error converting PDF to images');
      setStatus("Conversion failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const convertPdfToExcel = async () => {
    if (files.length === 0 || files[0].type !== 'application/pdf') {
      alert("Please upload a PDF file to convert to Excel.");
      return;
    }

    const file = files[0];
    setIsProcessing(true);
    setStatus("Initializing PDF parsing...");

    try {
      const arrayBuffer = await file.arrayBuffer();
      const aiReady = hasServerKey || hasUserGeminiKey();

      if (useAi && aiReady) {
        setStatus("Encoding PDF bytes...");
        const binary = new Uint8Array(arrayBuffer);
        let binaryString = "";
        const len = binary.byteLength;
        const chunkSize = 8192;
        for (let i = 0; i < len; i += chunkSize) {
          binaryString += String.fromCharCode.apply(
            null,
            Array.from(binary.subarray(i, Math.min(i + chunkSize, len)))
          );
        }
        const base64 = btoa(binaryString);

        setStatus("Sending document for AI extraction...");

        const resData = await generateContent('gemini-2.5-flash', {
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: "application/pdf",
                    data: base64
                  }
                },
                {
                  text: "Extract all tabular and transactional data from this document. Provide the output in a JSON object with a single top-level key 'tables' containing an array of table objects. Each table object must have a 'name' (string, e.g. the section title or billing section name) and a 'rows' array of objects where each object is a key-value pair representing a row of the table. Column names should be descriptive (e.g. CoO, Tariff Number, Material Code, EAN/UPC, Material Description, UoM, Ship Qty, Unit Price, Amount, VAT). Ensure numeric values, currency values, codes, and IDs are extracted with 100% precision. Do not omit any rows or tables."
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json"
          }
        });

        setStatus("Parsing extracted data from AI...");
        const jsonText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!jsonText) throw new Error("Empty response from AI service");

        const parsed = JSON.parse(jsonText);

        setStatus("Generating Excel workbook...");
        const wb = XLSX.utils.book_new();

        if (parsed.tables && parsed.tables.length > 0) {
          parsed.tables.forEach((table: any, idx: number) => {
            const ws = XLSX.utils.json_to_sheet(table.rows || []);
            let sheetName = (table.name || `Table ${idx + 1}`)
              .substring(0, 30)
              .replace(/[\\\?\*\/\[\]]/g, '');
            if (!sheetName.trim()) sheetName = `Sheet ${idx + 1}`;
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
          });
        } else if (parsed.rows) {
          const ws = XLSX.utils.json_to_sheet(parsed.rows);
          XLSX.utils.book_append_sheet(wb, ws, "Sheet 1");
        } else {
          throw new Error("No tables or rows found in the AI response");
        }

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
        const buf = new ArrayBuffer(wbout.length);
        const view = new Uint8Array(buf);
        for (let i = 0; i < wbout.length; i++) view[i] = wbout.charCodeAt(i) & 0xFF;

        const blob = new Blob([buf], { type: "application/octet-stream" });
        downloadBlob(blob, `${file.name.replace(/\.[^/.]+$/, "")}.xlsx`);
        setStatus("Excel workbook downloaded successfully!");
      } else {
        setStatus("Running local PDF coordinate extraction (fallback)...");
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        const wb = XLSX.utils.book_new();

        const allParsedRows: string[][] = [];

        for (let pNum = 1; pNum <= pdf.numPages; pNum++) {
          setStatus(`Parsing page ${pNum} of ${pdf.numPages}...`);
          const page = await pdf.getPage(pNum);
          const textContent = await page.getTextContent();
          const items = textContent.items as any[];

          const rowsMap: { y: number; items: any[] }[] = [];
          for (const item of items) {
            if (!item.str.trim()) continue;
            const x = item.transform[4];
            const y = item.transform[5];

            let foundRow = rowsMap.find(row => Math.abs(row.y - y) < 4);
            if (foundRow) {
              foundRow.items.push({ text: item.str, x, y });
            } else {
              rowsMap.push({ y, items: [{ text: item.str, x, y }] });
            }
          }

          rowsMap.sort((a, b) => b.y - a.y);

          for (const row of rowsMap) {
            row.items.sort((a, b) => a.x - b.x);

            const cells: string[] = [];
            let currentCell = "";
            let lastX = -999;

            for (const item of row.items) {
              const gap = item.x - lastX;
              if (lastX === -999 || gap < 18) {
                if (lastX !== -999 && gap > 4) {
                  currentCell += " " + item.text;
                } else {
                  currentCell += item.text;
                }
              } else {
                cells.push(currentCell.trim());
                currentCell = item.text;
              }
              lastX = item.x + item.text.length * 5;
            }
            if (currentCell) {
              cells.push(currentCell.trim());
            }
            allParsedRows.push(cells);
          }
          if (pdf.numPages > 1 && pNum < pdf.numPages) {
            allParsedRows.push([]);
            allParsedRows.push([`--- End of Page ${pNum} / Start of Page ${pNum + 1} ---`]);
            allParsedRows.push([]);
          }
        }

        setStatus("Creating Excel worksheet from rows...");
        const ws = XLSX.utils.aoa_to_sheet(allParsedRows);
        XLSX.utils.book_append_sheet(wb, ws, "Sheet 1");

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
        const buf = new ArrayBuffer(wbout.length);
        const view = new Uint8Array(buf);
        for (let i = 0; i < wbout.length; i++) view[i] = wbout.charCodeAt(i) & 0xFF;

        const blob = new Blob([buf], { type: "application/octet-stream" });
        downloadBlob(blob, `${file.name.replace(/\.[^/.]+$/, "")}_extracted.xlsx`);
        setStatus("Excel downloaded successfully!");
      }
    } catch (e: any) {
      console.error(e);
      alert(`Error converting to Excel: ${e.message || e}`);
      setStatus("Conversion failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const convertPdfToWord = async () => {
    if (files.length === 0 || files[0].type !== 'application/pdf') {
      alert("Please upload a PDF file to convert to Word.");
      return;
    }

    const file = files[0];
    setIsProcessing(true);
    setStatus("Initializing PDF parsing...");

    try {
      const arrayBuffer = await file.arrayBuffer();
      const aiReady = hasServerKey || hasUserGeminiKey();

      let htmlContent = "";

      if (useAi && aiReady) {
        setStatus("Encoding PDF bytes...");
        const binary = new Uint8Array(arrayBuffer);
        let binaryString = "";
        const len = binary.byteLength;
        const chunkSize = 8192;
        for (let i = 0; i < len; i += chunkSize) {
          binaryString += String.fromCharCode.apply(
            null,
            Array.from(binary.subarray(i, Math.min(i + chunkSize, len)))
          );
        }
        const base64 = btoa(binaryString);

        setStatus("Sending document for AI conversion...");

        const resData = await generateContent('gemini-2.5-flash', {
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: "application/pdf",
                    data: base64
                  }
                },
                {
                  text: "Convert this document into formatted Word-compatible semantic HTML. Preserve the layout structure, headings, lists, tables, bold text, alignments, and spacing. Include clean inline CSS for table borders, padding, and gray headers. Return ONLY the HTML code inside a JSON object: `{\"html\": \"...\"}`."
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json"
          }
        });

        setStatus("Parsing Word document markup...");
        const jsonText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!jsonText) throw new Error("Empty response from AI service");

        const parsed = JSON.parse(jsonText);
        htmlContent = parsed.html || "";
      } else {
        setStatus("Running local text layout analysis (fallback)...");
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

        let localHtml = "";
        let inTable = false;

        for (let pNum = 1; pNum <= pdf.numPages; pNum++) {
          setStatus(`Extracting page ${pNum} of ${pdf.numPages}...`);
          const page = await pdf.getPage(pNum);
          const textContent = await page.getTextContent();
          const items = textContent.items as any[];

          const rowsMap: { y: number; items: any[] }[] = [];
          for (const item of items) {
            if (!item.str.trim()) continue;
            const x = item.transform[4];
            const y = item.transform[5];

            let foundRow = rowsMap.find(row => Math.abs(row.y - y) < 4);
            if (foundRow) {
              foundRow.items.push({ text: item.str, x, y });
            } else {
              rowsMap.push({ y, items: [{ text: item.str, x, y }] });
            }
          }

          rowsMap.sort((a, b) => b.y - a.y);

          localHtml += `<h2>Page ${pNum}</h2>`;

          for (const row of rowsMap) {
            row.items.sort((a, b) => a.x - b.x);

            const cells: string[] = [];
            let currentCell = "";
            let lastX = -999;

            for (const item of row.items) {
              const gap = item.x - lastX;
              if (lastX === -999 || gap < 18) {
                if (lastX !== -999 && gap > 4) {
                  currentCell += " " + item.text;
                } else {
                  currentCell += item.text;
                }
              } else {
                cells.push(currentCell.trim());
                currentCell = item.text;
              }
              lastX = item.x + item.text.length * 5;
            }
            if (currentCell) {
              cells.push(currentCell.trim());
            }

            if (cells.length > 2) {
              if (!inTable) {
                localHtml += "<table style='border-collapse: collapse; width: 100%; margin: 10px 0; border: 1px solid #ddd;'>";
                inTable = true;
              }
              localHtml += "<tr>" + cells.map(cell => `<td style='border: 1px solid #ddd; padding: 6px; font-size: 10pt;'>${cell}</td>`).join("") + "</tr>";
            } else {
              if (inTable) {
                localHtml += "</table>";
                inTable = false;
              }
              localHtml += `<p style='margin-bottom: 6px; font-size: 11pt;'>${cells.join(" ")}</p>`;
            }
          }
        }

        if (inTable) {
          localHtml += "</table>";
        }

        htmlContent = localHtml;
      }

      setStatus("Wrapping Word document and downloading...");

      const wordDocContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset="utf-8">
          <title>Exported PDF Document</title>
          <!--[if gte mso 9]>
          <xml>
            <w:WordDocument>
              <w:View>Print</w:View>
              <w:Zoom>100</w:Zoom>
              <w:DoNotOptimizeForBrowser/>
            </w:WordDocument>
          </xml>
          <![endif]-->
          <style>
            body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.25; margin: 1in; }
            h1 { font-size: 20pt; font-weight: bold; color: #1e3a8a; margin-top: 18px; margin-bottom: 8px; }
            h2 { font-size: 15pt; font-weight: bold; color: #4338ca; margin-top: 15px; margin-bottom: 6px; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
            p { margin: 0 0 8px 0; text-align: justify; }
            table { border-collapse: collapse; width: 100%; margin: 12px 0; }
            th { border: 1px solid #999; background-color: #f3f4f6; padding: 6px; font-weight: bold; text-align: left; font-size: 10pt; }
            td { border: 1px solid #ccc; padding: 6px; font-size: 10pt; vertical-align: top; }
            ul, ol { margin-top: 0; margin-bottom: 8px; padding-left: 20px; }
            li { margin-bottom: 3px; }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
        </html>
      `;

      const blob = new Blob(['﻿' + wordDocContent], { type: 'application/msword' });
      downloadBlob(blob, `${file.name.replace(/\.[^/.]+$/, "")}.doc`);
      setStatus("Word document downloaded successfully!");
    } catch (e: any) {
      console.error(e);
      alert(`Error converting to Word: ${e.message || e}`);
      setStatus("Conversion failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const isPdf = files.length > 0 && files[0].type === 'application/pdf';
  const hasImages = files.length > 0 && files.some(f => f.type.startsWith('image/'));
  const hasValidKey = hasServerKey || isUsableKey(apiKey);
  const isAiDisabled = useAi && !hasValidKey;

  /* ── Left functions panel: AI engine settings ── */
  const panel = null;

  /* ── Main work area ── */
  const mainArea = files.length === 0 ? (
    <UploadDropzone
      multiple
      onFiles={fs => { setFiles(fs); setStatus(''); }}
      accept="image/jpeg,image/png,image/jpg,application/pdf"
      title="Add files to convert"
      subtitle={
        <>
          Drag &amp; drop here, or <span className="text-indigo-600 font-semibold">browse</span>. PDFs convert to Excel, Word, or images — images merge to PDF.
        </>
      }
      chips={['📄 PDF', '🖼️ PNG / JPG']}
      icon={<RefreshCw className="w-9 h-9" strokeWidth={2} />}
    />
  ) : (
    <div className="flex-1 p-4 md:p-8">
      <div className={cn("mx-auto space-y-5 transition-all duration-300", convertTab === 'selective' ? "max-w-5xl" : "max-w-2xl")}>
        {/* File summary */}
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
              {files.length} file{files.length > 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => { setFiles([]); setStatus(''); setConvertTab('entire'); }}
              className="text-slate-400 hover:text-rose-500 text-xs font-semibold cursor-pointer transition-colors"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {files.map((f, i) => (
              <span key={i} className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg truncate max-w-[180px]" title={f.name}>
                {f.type === 'application/pdf' ? '📄' : '🖼️'} {f.name}
              </span>
            ))}
          </div>
        </div>

        {/* Tab Selector for PDF */}
        {isPdf && (
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100/80 border border-slate-200/40 rounded-2xl text-xs font-bold text-slate-700 shadow-sm shrink-0">
            <button
              onClick={() => setConvertTab('entire')}
              className={cn(
                "py-2 rounded-xl text-center transition-all cursor-pointer",
                convertTab === 'entire'
                  ? "bg-white text-indigo-700 shadow-sm font-bold border border-slate-200/10"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              Convert Entire File
            </button>
            <button
              onClick={() => setConvertTab('selective')}
              className={cn(
                "py-2 rounded-xl text-center transition-all cursor-pointer",
                convertTab === 'selective'
                  ? "bg-white text-indigo-700 shadow-sm font-bold border border-slate-200/10"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              Export Custom Selection
            </button>
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-indigo-600 animate-spin shrink-0" />
            <div className="text-left">
              <span className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider">Processing conversion</span>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{status || 'Starting conversion…'}</p>
            </div>
          </div>
        )}

        {!isProcessing && status && (
          <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-2xl">
            <p className="text-xs font-semibold text-emerald-800">{status}</p>
          </div>
        )}

        {/* Conversion action cards (Entire file tab) */}
        {!isProcessing && convertTab === 'entire' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {isPdf && (
              <>
                {/* PDF → Excel */}
                <button
                  onClick={convertPdfToExcel}
                  className="flex items-center justify-between p-4 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-100 hover:border-emerald-200 text-emerald-800 rounded-2xl transition-all hover:-translate-y-0.5 active:translate-y-0 shadow-sm font-bold text-sm text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="block font-bold">PDF to Excel</span>
                      <span className="text-[10px] text-emerald-700/80 font-medium mt-0.5">
                        {isAiDisabled ? 'Local layout parsing' : 'AI-powered table extraction'}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-emerald-500/70 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* PDF → Word */}
                <button
                  onClick={convertPdfToWord}
                  className="flex items-center justify-between p-4 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-100/70 hover:border-indigo-200/80 text-indigo-800 rounded-2xl transition-all hover:-translate-y-0.5 active:translate-y-0 shadow-sm font-bold text-sm text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="block font-bold">PDF to Word</span>
                      <span className="text-[10px] text-indigo-700/80 font-medium mt-0.5">
                        {isAiDisabled ? 'Local structural parsing' : 'AI document layout rendering'}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-indigo-500/70 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* PDF → Images */}
                <button
                  onClick={convertPdfToImages}
                  className="flex items-center justify-between p-4 bg-violet-50 hover:bg-violet-100/80 border border-violet-100 hover:border-violet-200 text-violet-800 rounded-2xl transition-all hover:-translate-y-0.5 active:translate-y-0 shadow-sm font-bold text-sm text-left group cursor-pointer sm:col-span-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-600 group-hover:scale-110 transition-transform text-lg">
                      🖼️
                    </div>
                    <div>
                      <span className="block font-bold">PDF to Images (ZIP)</span>
                      <span className="text-[10px] text-violet-700/80 font-medium mt-0.5">Extract individual pages as JPG files</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-violet-500/70 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </>
            )}

            {hasImages && (
              <button
                onClick={convertImagesToPdf}
                className="flex items-center justify-between p-4 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-100/70 hover:border-indigo-200/80 text-indigo-800 rounded-2xl transition-all hover:-translate-y-0.5 active:translate-y-0 shadow-sm font-bold text-sm text-left group cursor-pointer sm:col-span-2"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform text-lg">
                    📄
                  </div>
                  <div>
                    <span className="block font-bold">Images to PDF</span>
                    <span className="text-[10px] text-indigo-700/80 font-medium mt-0.5">Merge image files into a single PDF document</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-indigo-500/70 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
          </div>
        )}

        {/* Custom selection workspace (Selective tab) */}
        {!isProcessing && convertTab === 'selective' && isPdf && pdfDoc && (
          <div className="space-y-4">
            <div className="bg-amber-50/70 border border-amber-100/60 p-3.5 rounded-2xl flex items-start gap-2.5 shadow-sm">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-left">
                <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block">Custom Area Selection</span>
                <p className="text-xs text-slate-500 font-medium leading-relaxed mt-0.5 font-sans">
                  Scroll and <strong>drag a box</strong> over any table or rows on the pages below. Use the floating menu to instantly export that specific area to Excel or Word.
                </p>
              </div>
            </div>

            <div className="space-y-6 max-h-[600px] overflow-y-auto px-1.5 py-1 border border-slate-200/60 bg-slate-50/50 rounded-2xl shadow-inner scrollbar-thin">
              {Array.from({ length: pdfDoc.numPages }, (_, idx) => (
                <div key={idx + 1} className="relative bg-white p-3 rounded-2xl border border-slate-200/50 shadow-sm max-w-fit mx-auto my-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 px-1 flex justify-between">
                    <span>Page {idx + 1} of {pdfDoc.numPages}</span>
                  </div>
                  <PdfPagePreview 
                    pdfDoc={pdfDoc}
                    pageNum={idx + 1}
                    useAi={useAi}
                    aiReady={hasValidKey}
                    isProcessing={isProcessing}
                    setIsProcessing={setIsProcessing}
                    setStatus={setStatus}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <ToolLayout
      icon={<RefreshCw size={20} strokeWidth={2} />}
      title="Convert Documents"
      description="Transform PDFs into spreadsheets, Word docs, or images — and merge images into PDFs."
      accentClass="from-indigo-500 to-violet-500"
      panel={panel}
    >
      {mainArea}
    </ToolLayout>
  );
}
