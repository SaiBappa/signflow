import { create } from 'zustand';
import type { DocumentFile } from '../types';

interface DocumentStore {
  documentFile: DocumentFile | null;
  setDocumentFile: (file: DocumentFile | null) => void;
  clearDocument: () => void;
}

export const useDocumentStore = create<DocumentStore>((set) => ({
  documentFile: null,
  setDocumentFile: (file) => set({ documentFile: file }),
  clearDocument: () => set({ documentFile: null }),
}));
