import { create } from 'zustand';
import type {
  SignatureState,
  TextInstance,
  StampInstance,
  RedactInstance,
  SavedAsset,
  StampAsset,
} from '../types';
import { getDefaultStamps } from '../utils/defaultStamps';

const SAVED_SIGNATURES_KEY = 'signflow_saved_signatures';
const SAVED_STAMPS_KEY = 'signflow_saved_stamps';

function loadSavedAssets(): SavedAsset[] {
  try {
    const raw = localStorage.getItem(SAVED_SIGNATURES_KEY);
    return raw ? (JSON.parse(raw) as SavedAsset[]) : [];
  } catch {
    return [];
  }
}

function loadSavedStamps(): StampAsset[] {
  try {
    const raw = localStorage.getItem(SAVED_STAMPS_KEY);
    return raw ? (JSON.parse(raw) as StampAsset[]) : getDefaultStamps();
  } catch {
    return getDefaultStamps();
  }
}

interface AnnotationStore {
  signature: SignatureState | null;
  texts: TextInstance[];
  stamps: StampInstance[];
  redacts: RedactInstance[];
  savedAssets: SavedAsset[];
  savedStamps: StampAsset[];

  setSignature: (signature: SignatureState | null) => void;
  setTexts: (texts: TextInstance[]) => void;
  setStamps: (stamps: StampInstance[]) => void;
  setRedacts: (redacts: RedactInstance[]) => void;

  addSavedAsset: (asset: SavedAsset) => void;
  deleteSavedAsset: (id: string) => void;

  addSavedStamp: (stamp: StampAsset) => void;
  deleteSavedStamp: (id: string) => void;

  clearAllAnnotations: () => void;
}

export const useAnnotationStore = create<AnnotationStore>((set) => ({
  signature: null,
  texts: [],
  stamps: [],
  redacts: [],
  savedAssets: loadSavedAssets(),
  savedStamps: loadSavedStamps(),

  setSignature: (signature) => set({ signature }),
  setTexts: (texts) => set({ texts }),
  setStamps: (stamps) => set({ stamps }),
  setRedacts: (redacts) => set({ redacts }),

  addSavedAsset: (asset) =>
    set((state) => {
      const updated = [...state.savedAssets, asset];
      localStorage.setItem(SAVED_SIGNATURES_KEY, JSON.stringify(updated));
      return { savedAssets: updated };
    }),

  deleteSavedAsset: (id) =>
    set((state) => {
      const updated = state.savedAssets.filter((a) => a.id !== id);
      localStorage.setItem(SAVED_SIGNATURES_KEY, JSON.stringify(updated));
      return { savedAssets: updated };
    }),

  addSavedStamp: (stamp) =>
    set((state) => {
      const updated = [...state.savedStamps, stamp];
      localStorage.setItem(SAVED_STAMPS_KEY, JSON.stringify(updated));
      return { savedStamps: updated };
    }),

  deleteSavedStamp: (id) =>
    set((state) => {
      const updated = state.savedStamps.filter((s) => s.id !== id);
      localStorage.setItem(SAVED_STAMPS_KEY, JSON.stringify(updated));
      return { savedStamps: updated };
    }),

  clearAllAnnotations: () =>
    set({
      signature: null,
      texts: [],
      stamps: [],
      redacts: [],
    }),
}));
