import React, { useState, useMemo } from 'react';
import { LayoutTemplate, FileText, CheckSquare, Type, MoreVertical, Trash2, Pencil, FolderInput, Loader2, Upload } from 'lucide-react';
import { useTemplatesStore, TEMPLATE_CATEGORIES } from '../store/useTemplatesStore';
import { UserTemplate } from '../types';
import { cn } from '../utils';
import { ToolLayout } from './shared/ToolLayout';

export function TemplatesGallery({
  onPick,
  onUploadNew,
  busyId,
}: {
  onPick: (template: UserTemplate) => void;
  onUploadNew: (file: File) => void;
  busyId?: string | null;
}) {
  const { templates, removeTemplate, renameTemplate, recategorizeTemplate } = useTemplatesStore();
  const [category, setCategory] = useState('All');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const categories = useMemo(() => {
    const used = new Set(templates.map(t => t.category));
    return ['All', ...TEMPLATE_CATEGORIES.filter(c => used.has(c))];
  }, [templates]);

  const shown = category === 'All' ? templates : templates.filter(t => t.category === category);

  const commitRename = (id: string) => {
    const name = renameValue.trim();
    if (name) renameTemplate(id, name);
    setRenamingId(null);
  };

  const panel = (
    <nav className="space-y-1">
      {categories.map(c => (
        <button
          key={c}
          onClick={() => setCategory(c)}
          className={cn(
            'w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-all',
            category === c
              ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
              : 'text-slate-600 hover:bg-slate-50',
          )}
        >
          {c}
        </button>
      ))}
    </nav>
  );

  const panelFooter = (
    <label className="w-full px-5 py-3 text-sm font-bold text-white rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_4px_14px_0_rgb(79,70,229,0.39)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)] bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0">
      <Upload size={16} /> New template
      <input
        type="file"
        className="hidden"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadNew(f); e.currentTarget.value = ''; }}
      />
    </label>
  );

  return (
    <ToolLayout
      icon={<LayoutTemplate size={20} strokeWidth={2} />}
      title="Templates"
      description="Turn a manual form into a reusable digital one — place fields once, reopen straight into Fill & Sign."
      accentClass="from-indigo-500 to-violet-500"
      panel={panel}
      panelFooter={panelFooter}
      hideSecurityNote={true}
    >
      {templates.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="border-2 border-dashed border-slate-300 rounded-2xl bg-white/60 px-6 py-14 text-center max-w-md">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center">
              <LayoutTemplate size={26} />
            </div>
            <h3 className="font-bold text-slate-700">No templates yet</h3>
            <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
              Open a form in <span className="font-semibold text-slate-700">Fill &amp; Sign</span>, place your checkboxes
              and text boxes, then choose <span className="font-semibold text-slate-700">Save as Template</span>.
              Or upload a blank form here to get started.
            </p>
            <label className="inline-flex items-center gap-1.5 mt-5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold cursor-pointer hover:bg-indigo-700 transition-colors">
              <Upload size={15} /> Upload a blank form
              <input
                type="file"
                className="hidden"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadNew(f); e.currentTarget.value = ''; }}
              />
            </label>
          </div>
        </div>
      ) : (
        <div className="flex-1 p-4 md:p-6 grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 content-start">
          {shown.map(tpl => {
            const isBusy = busyId === tpl.id;
            const isRenaming = renamingId === tpl.id;
            return (
              <div key={tpl.id} className="relative text-left bg-white rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all group overflow-hidden">
                <button
                  onClick={() => !isRenaming && onPick(tpl)}
                  disabled={isBusy}
                  className="w-full text-left disabled:opacity-60 cursor-pointer"
                >
                  <div className="h-28 bg-slate-50 border-b border-slate-100 flex items-center justify-center overflow-hidden">
                    {isBusy ? (
                      <Loader2 size={22} className="animate-spin text-indigo-500" />
                    ) : tpl.thumbnail ? (
                      <img src={tpl.thumbnail} alt="" className="w-full h-full object-cover object-top" />
                    ) : (
                      <FileText size={26} className="text-slate-300" />
                    )}
                  </div>
                  <div className="p-4">
                    {isRenaming ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitRename(tpl.id); if (e.key === 'Escape') setRenamingId(null); }}
                        onBlur={() => commitRename(tpl.id)}
                        className="w-full border border-indigo-300 rounded-md px-2 py-1 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    ) : (
                      <div className="font-semibold text-slate-800 truncate pr-6">{tpl.name}</div>
                    )}
                    {tpl.nameDv && (
                      <div className="text-sm text-slate-400 truncate" style={{ fontFamily: 'Faruma, sans-serif' }} dir="rtl">{tpl.nameDv}</div>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400 font-medium">
                      <span className="uppercase tracking-wider">{tpl.category}</span>
                      {tpl.formFields.length > 0 && <span className="inline-flex items-center gap-1"><CheckSquare size={11} />{tpl.formFields.length}</span>}
                      {tpl.texts.length > 0 && <span className="inline-flex items-center gap-1"><Type size={11} />{tpl.texts.length}</span>}
                    </div>
                  </div>
                </button>

                {/* Manage menu */}
                <div className="absolute top-2 right-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuId(menuId === tpl.id ? null : tpl.id); }}
                    className="w-9 h-9 md:w-7 md:h-7 rounded-lg bg-white/90 border border-slate-200 text-slate-500 flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    <MoreVertical size={15} />
                  </button>
                  {menuId === tpl.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuId(null)} />
                      <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
                        <button
                          onClick={() => { setRenamingId(tpl.id); setRenameValue(tpl.name); setMenuId(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          <Pencil size={14} className="text-slate-400" /> Rename
                        </button>
                        <div className="px-3 py-1.5">
                          <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1"><FolderInput size={12} /> Move to</span>
                          <select
                            value={tpl.category}
                            onChange={(e) => { recategorizeTemplate(tpl.id, e.target.value); setMenuId(null); }}
                            className="w-full border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-700 bg-white focus:outline-none focus:border-indigo-500"
                          >
                            {TEMPLATE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div className="border-t border-slate-100 my-1" />
                        <button
                          onClick={() => { if (window.confirm(`Delete template "${tpl.name}"?`)) removeTemplate(tpl.id); setMenuId(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ToolLayout>
  );
}
