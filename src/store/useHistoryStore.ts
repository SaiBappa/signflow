import { create } from 'zustand';
import type {
  SignatureState,
  TextInstance,
  StampInstance,
  RedactInstance,
} from '../types';

const MAX_HISTORY = 50;

export interface AnnotationSnapshot {
  signature: SignatureState | null;
  texts: TextInstance[];
  stamps: StampInstance[];
  redacts: RedactInstance[];
}

interface HistoryState {
  past: AnnotationSnapshot[];
  future: AnnotationSnapshot[];

  /** Save a snapshot of the current annotation state onto the undo stack. */
  pushSnapshot: (snapshot: AnnotationSnapshot) => void;

  /** Undo: pop the most recent snapshot from `past`, push the current state
   *  (provided by the caller) onto `future`, and return the restored snapshot.
   *  Returns `null` if there is nothing to undo. */
  undo: (currentSnapshot: AnnotationSnapshot) => AnnotationSnapshot | null;

  /** Redo: pop the most recent snapshot from `future`, push the current state
   *  (provided by the caller) onto `past`, and return the restored snapshot.
   *  Returns `null` if there is nothing to redo. */
  redo: (currentSnapshot: AnnotationSnapshot) => AnnotationSnapshot | null;

  /** Whether there are snapshots available to undo. */
  canUndo: () => boolean;

  /** Whether there are snapshots available to redo. */
  canRedo: () => boolean;

  /** Clear all history (e.g. when loading a new document). */
  clearHistory: () => void;
}

/** Deep-clone a snapshot so mutations to the live state don't corrupt history. */
function cloneSnapshot(snapshot: AnnotationSnapshot): AnnotationSnapshot {
  return structuredClone(snapshot);
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],

  pushSnapshot: (snapshot) =>
    set((state) => {
      const cloned = cloneSnapshot(snapshot);
      const newPast =
        state.past.length >= MAX_HISTORY
          ? [...state.past.slice(1), cloned]
          : [...state.past, cloned];
      // Any new action invalidates the redo stack
      return { past: newPast, future: [] };
    }),

  undo: (currentSnapshot) => {
    const { past } = get();
    if (past.length === 0) return null;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);
    const clonedCurrent = cloneSnapshot(currentSnapshot);

    set((state) => ({
      past: newPast,
      future: [...state.future, clonedCurrent],
    }));

    return cloneSnapshot(previous);
  },

  redo: (currentSnapshot) => {
    const { future } = get();
    if (future.length === 0) return null;

    const next = future[future.length - 1];
    const newFuture = future.slice(0, -1);
    const clonedCurrent = cloneSnapshot(currentSnapshot);

    set((state) => ({
      past: [...state.past, clonedCurrent],
      future: newFuture,
    }));

    return cloneSnapshot(next);
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  clearHistory: () => set({ past: [], future: [] }),
}));
