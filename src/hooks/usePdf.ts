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
  // Encrypted-PDF handling: when pdf.js reports the document is password
  // protected we surface `needsPassword` so the UI can prompt, and retry the
  // load once a password is supplied via `submitPassword`.
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [password, setPassword] = useState<string | undefined>(undefined);

  // Reset the unlock state whenever a new file is selected.
  useEffect(() => {
    setPassword(undefined);
    setNeedsPassword(false);
    setPasswordError(false);
  }, [file]);

  useEffect(() => {
    if (!file || file.type !== 'application/pdf') {
      setPdfDoc(null);
      setNumPages(0);
      setNeedsPassword(false);
      setPasswordError(false);
      return;
    }

    let isMounted = true;
    let loadedDoc: pdfjsLib.PDFDocumentProxy | null = null;
    setLoading(true);

    const loadPdf = async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const params: Record<string, unknown> = { data: arrayBuffer };
        if (password !== undefined) params.password = password;
        const doc = await pdfjsLib.getDocument(params as any).promise;
        loadedDoc = doc;
        if (isMounted) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);
          setCurrentPage(1);
          setNeedsPassword(false);
          setPasswordError(false);
        }
      } catch (err: any) {
        // PasswordException: code 1 = needs password, code 2 = wrong password.
        if (err?.name === 'PasswordException') {
          if (isMounted) {
            setPdfDoc(null);
            setNumPages(0);
            setNeedsPassword(true);
            // If we already tried a password, the file is encrypted and the
            // supplied password was incorrect.
            setPasswordError(password !== undefined);
          }
        } else {
          console.error('Error loading PDF', err);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadPdf();

    return () => {
      isMounted = false;
      if (loadedDoc) {
        loadedDoc.destroy();
      }
    };
  }, [file, password]);

  return {
    pdfDoc,
    numPages,
    currentPage,
    setCurrentPage,
    loading,
    needsPassword,
    passwordError,
    submitPassword: setPassword,
  };
}
