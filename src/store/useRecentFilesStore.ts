import { create } from 'zustand';

const STORAGE_KEY = 'signflow_recent_files';
const MAX_RECENT = 10;

export interface RecentFile {
  id: string;
  name: string;
  type: 'pdf' | 'image';
  lastOpened: string; // ISO date string
  size: number; // bytes
}

interface RecentFilesStore {
  recentFiles: RecentFile[];
  addRecentFile: (file: { name: string; type: 'pdf' | 'image'; size: number }) => void;
  removeRecentFile: (id: string) => void;
  clearRecentFiles: () => void;
}

function loadRecentFiles(): RecentFile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecentFile[]) : [];
  } catch {
    return [];
  }
}

function persistRecentFiles(files: RecentFile[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export const useRecentFilesStore = create<RecentFilesStore>((set) => ({
  recentFiles: loadRecentFiles(),

  addRecentFile: ({ name, type, size }) =>
    set((state) => {
      // Remove any existing entry with the same name (dedup)
      const deduped = state.recentFiles.filter((f) => f.name !== name);

      const newEntry: RecentFile = {
        id: crypto.randomUUID(),
        name,
        type,
        size,
        lastOpened: new Date().toISOString(),
      };

      // Prepend new entry, trim to max
      const updated = [newEntry, ...deduped].slice(0, MAX_RECENT);
      persistRecentFiles(updated);
      return { recentFiles: updated };
    }),

  removeRecentFile: (id) =>
    set((state) => {
      const updated = state.recentFiles.filter((f) => f.id !== id);
      persistRecentFiles(updated);
      return { recentFiles: updated };
    }),

  clearRecentFiles: () => {
    persistRecentFiles([]);
    return set({ recentFiles: [] });
  },
}));
