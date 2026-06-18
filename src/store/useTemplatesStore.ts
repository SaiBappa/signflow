import { create } from 'zustand';
import { UserTemplate } from '../types';

const STORAGE_KEY = 'signflow_templates';

export const TEMPLATE_CATEGORIES = ['Letters', 'Contracts', 'Government', 'Business', 'Other'];

export interface NewTemplateInput {
  name: string;
  nameDv?: string;
  category: string;
  docType: 'pdf' | 'image';
  docName: string;
  docDataUrl: string;
  thumbnail?: string;
  formFields: UserTemplate['formFields'];
  texts: UserTemplate['texts'];
}

interface TemplatesStore {
  templates: UserTemplate[];
  /** Persist a new template. Returns the created template, or throws if storage is full. */
  addTemplate: (input: NewTemplateInput) => UserTemplate;
  removeTemplate: (id: string) => void;
  renameTemplate: (id: string, name: string) => void;
  recategorizeTemplate: (id: string, category: string) => void;
}

function loadTemplates(): UserTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserTemplate[]) : [];
  } catch {
    return [];
  }
}

/** Persist templates. Throws on quota errors so callers can surface a message. */
function persistTemplates(templates: UserTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export const useTemplatesStore = create<TemplatesStore>((set, get) => ({
  templates: loadTemplates(),

  addTemplate: (input) => {
    const now = new Date().toISOString();
    const template: UserTemplate = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      ...input,
    };
    const updated = [template, ...get().templates];
    // Let quota errors propagate; don't mutate state if the write failed.
    persistTemplates(updated);
    set({ templates: updated });
    return template;
  },

  removeTemplate: (id) =>
    set((state) => {
      const updated = state.templates.filter((t) => t.id !== id);
      try { persistTemplates(updated); } catch { /* ignore */ }
      return { templates: updated };
    }),

  renameTemplate: (id, name) =>
    set((state) => {
      const updated = state.templates.map((t) =>
        t.id === id ? { ...t, name, updatedAt: new Date().toISOString() } : t
      );
      try { persistTemplates(updated); } catch { /* ignore */ }
      return { templates: updated };
    }),

  recategorizeTemplate: (id, category) =>
    set((state) => {
      const updated = state.templates.map((t) =>
        t.id === id ? { ...t, category, updatedAt: new Date().toISOString() } : t
      );
      try { persistTemplates(updated); } catch { /* ignore */ }
      return { templates: updated };
    }),
}));
