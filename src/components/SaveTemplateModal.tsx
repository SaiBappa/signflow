import React, { useState } from 'react';
import { X, LayoutTemplate, Loader2, CheckSquare, Type } from 'lucide-react';
import { TEMPLATE_CATEGORIES } from '../store/useTemplatesStore';

export interface SaveTemplateValues {
  name: string;
  nameDv?: string;
  category: string;
}

interface Props {
  defaultName: string;
  thumbnail?: string;
  fieldCount: number;
  textCount: number;
  saving: boolean;
  error?: string | null;
  onSave: (values: SaveTemplateValues) => void;
  onClose: () => void;
}

export function SaveTemplateModal({ defaultName, thumbnail, fieldCount, textCount, saving, error, onSave, onClose }: Props) {
  const [name, setName] = useState(defaultName);
  const [nameDv, setNameDv] = useState('');
  const [category, setCategory] = useState(TEMPLATE_CATEGORIES[0]);

  const canSave = name.trim().length > 0 && !saving;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <LayoutTemplate size={17} />
            </span>
            <h3 className="font-bold text-slate-800">Save as Template</h3>
          </div>
          <button onClick={onClose} disabled={saving} className="text-slate-400 hover:text-slate-700 disabled:opacity-50 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <p className="text-xs text-slate-500 leading-relaxed">
            Saves this document with all placed fields &amp; text boxes as a reusable form. Filled-in
            values are cleared so it opens blank and ready to fill next time.
          </p>

          <div className="flex gap-4">
            {thumbnail ? (
              <img src={thumbnail} alt="" className="w-20 h-24 object-cover rounded-lg border border-slate-200 bg-slate-50 shrink-0" />
            ) : (
              <div className="w-20 h-24 rounded-lg border border-slate-200 bg-slate-50 shrink-0" />
            )}
            <div className="flex flex-col justify-center gap-1.5 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5"><CheckSquare size={13} className="text-indigo-500" /> {fieldCount} form field{fieldCount === 1 ? '' : 's'}</span>
              <span className="inline-flex items-center gap-1.5"><Type size={13} className="text-indigo-500" /> {textCount} text box{textCount === 1 ? '' : 'es'}</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Template name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Leave Request Form"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Dhivehi name (optional)</label>
            <input
              value={nameDv}
              onChange={(e) => setNameDv(e.target.value)}
              dir="rtl"
              style={{ fontFamily: 'Faruma, sans-serif' }}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              {TEMPLATE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 cursor-pointer">
            Cancel
          </button>
          <button
            onClick={() => onSave({ name: name.trim(), nameDv: nameDv.trim() || undefined, category })}
            disabled={!canSave}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
          >
            {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
