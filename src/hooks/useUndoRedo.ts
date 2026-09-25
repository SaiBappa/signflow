import { useEffect } from 'react';
import { useHistoryStore } from '../store/useHistoryStore';
import { useAnnotationStore } from '../store/useAnnotationStore';
import type { AnnotationSnapshot } from '../store/useHistoryStore';

/** Returns the current annotation state as a snapshot. */
function getCurrentSnapshot(): AnnotationSnapshot {
  const { signature, texts, stamps, redacts } = useAnnotationStore.getState();
  return { signature, texts, stamps, redacts };
}

/** Applies a snapshot back to the annotation store. */
function applySnapshot(snapshot: AnnotationSnapshot) {
  const { setSignature, setTexts, setStamps, setRedacts } =
    useAnnotationStore.getState();
  setSignature(snapshot.signature);
  setTexts(snapshot.texts);
  setStamps(snapshot.stamps);
  setRedacts(snapshot.redacts);
}

/**
 * Hook that listens for keyboard shortcuts to trigger undo/redo.
 *
 * - **Undo**: `Ctrl+Z` (or `Cmd+Z` on macOS)
 * - **Redo**: `Ctrl+Shift+Z` / `Cmd+Shift+Z` or `Ctrl+Y` / `Cmd+Y`
 *
 * Shortcuts are suppressed when an `<input>` or `<textarea>` is focused
 * so native text-editing undo is not hijacked.
 */
export function useUndoRedoKeyboard() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when the user is typing in a form field
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      const ctrlOrMeta = e.ctrlKey || e.metaKey;
      if (!ctrlOrMeta) return;

      const { undo, redo, canUndo, canRedo } = useHistoryStore.getState();

      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((e.key === 'z' || e.key === 'Z') && e.shiftKey) {
        e.preventDefault();
        if (!canRedo()) return;
        const restored = redo(getCurrentSnapshot());
        if (restored) applySnapshot(restored);
        return;
      }

      if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        if (!canRedo()) return;
        const restored = redo(getCurrentSnapshot());
        if (restored) applySnapshot(restored);
        return;
      }

      // Undo: Ctrl+Z (without Shift)
      if ((e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        e.preventDefault();
        if (!canUndo()) return;
        const restored = undo(getCurrentSnapshot());
        if (restored) applySnapshot(restored);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
