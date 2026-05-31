import { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export function usePdf(file: File | null) {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!file || file.type !== 'application/pdf') {
      setPdfDoc(null);
      setNumPages(0);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const loadPdf = async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (isMounted) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);
          setCurrentPage(1);
        }
      } catch (err) {
        console.error("Error loading PDF", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadPdf();

    return () => {
      isMounted = false;
      if (pdfDoc) {
        pdfDoc.destroy();
      }
    };
  }, [file]);

  return { pdfDoc, numPages, currentPage, setCurrentPage, loading };
}
