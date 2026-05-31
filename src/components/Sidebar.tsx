import React, { useState } from 'react';
import { Upload, Download, FileImage, FileSignature, Settings, Image as ImageIcon, PenTool, X, ShieldCheck } from 'lucide-react';
import { cn } from '@/src/utils';
import { SavedAsset } from '../types';
import { DrawSignature } from './DrawSignature';

interface SidebarProps {
  onUploadDoc: (file: File) => void;
  onUploadSig: (file: File) => void;
  bgTolerance: number;
  setBgTolerance: (v: number) => void;
  tintColor?: string;
  setTintColor: (color?: string) => void;
  applyMode: 'single' | 'all' | 'custom';
  setApplyMode: (val: 'single' | 'all' | 'custom') => void;
  customPages: string;
  setCustomPages: (v: string) => void;
  excludedPages: string;
  setExcludedPages: (v: string) => void;
  savedAssets: SavedAsset[];
  onSelectAsset: (asset: SavedAsset) => void;
  onDeleteAsset: (id: string) => void;
  onDownload: () => void;
  hasDocument: boolean;
  hasSignature: boolean;
  signatureUrl?: string;
  onAddText: () => void;
}

export function Sidebar({
  onUploadDoc,
  onUploadSig,
  bgTolerance,
  setBgTolerance,
  tintColor,
  setTintColor,
  applyMode,
  setApplyMode,
  customPages,
  setCustomPages,
  excludedPages,
  setExcludedPages,
  savedAssets,
  onSelectAsset,
  onDeleteAsset,
  onDownload,
  hasDocument,
  hasSignature,
  signatureUrl,
  onAddText
}: SidebarProps) {
  const [isDrawing, setIsDrawing] = useState(false);

  const handleDrawSave = (dataUrl: string) => {
    fetch(dataUrl)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], "drawn-signature.png", { type: "image/png" });
        onUploadSig(file);
        setIsDrawing(false);
      });
  };

  return (
    <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto z-10">
      <div className="p-6 space-y-8 flex-1">
        {/* Document Section */}
        <section className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">1. Document</h2>
          <label className={cn(
            "flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-all",
            hasDocument ? "border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50" : "border-slate-200 hover:border-indigo-400 bg-slate-50"
          )}>
            <div className="flex flex-col items-center justify-center text-center p-4">
              <p className="text-xs font-medium text-slate-600 mb-1">
                {hasDocument ? 'Document Loaded' : 'Upload PDF or Image'}
              </p>
              <p className="text-[10px] text-indigo-600 font-semibold hover:underline">
                {hasDocument ? 'Replace Document' : 'Select File'}
              </p>
            </div>
            <input 
              type="file" 
              className="hidden" 
              accept="application/pdf,image/png,image/jpeg,image/webp" 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUploadDoc(file);
              }}
            />
          </label>
        </section>

        {/* Signature Section */}
        <section className={cn("space-y-4 transition-opacity", !hasDocument && "opacity-50 pointer-events-none")}>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">2. Signatures & Stamps</h2>
          
          {hasSignature && signatureUrl ? (
            <div className="space-y-3">
              <div 
                className="w-full h-24 border-2 border-dashed border-slate-300 rounded-lg p-2 bg-slate-50 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing hover:border-indigo-400 group relative transition-colors"
                draggable
                onDragStart={(e) => {
                   e.dataTransfer.setData("application/my-signature", "true");
                }}
              >
                <img src={signatureUrl} className="max-h-full max-w-full mix-blend-multiply pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-0 bg-indigo-50/10 opacity-0 group-hover:opacity-100 flex items-center justify-center pointer-events-none transition-opacity">
                   <span className="text-[10px] font-semibold text-indigo-700 bg-white/90 px-2 py-1 rounded shadow-sm border border-indigo-100">Drag to Document</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-indigo-600 font-semibold hover:bg-indigo-50 py-1.5 rounded cursor-pointer block text-center border border-transparent transition-colors">
                  + Upload New Signature
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/png,image/jpeg,image/webp" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onUploadSig(file);
                    }}
                  />
                </label>
                <div className="flex items-center w-full px-4">
                  <div className="flex-1 h-px bg-slate-100"></div>
                  <span className="text-[10px] text-slate-400 px-2">OR</span>
                  <div className="flex-1 h-px bg-slate-100"></div>
                </div>
                <button 
                  onClick={() => setIsDrawing(true)}
                  className="text-[10px] text-indigo-600 font-semibold hover:bg-indigo-50 py-1.5 rounded cursor-pointer block text-center flex items-center justify-center gap-1 transition-colors"
                >
                  <PenTool className="w-3 h-3" /> Draw Signature
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label className={cn(
                "flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-all",
                hasSignature ? "border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50" : "border-slate-200 hover:border-indigo-400 bg-slate-50"
              )}>
                <div className="flex flex-col items-center justify-center text-center p-4">
                  <p className="text-[11px] font-bold text-slate-600 mb-1">
                    Upload Signature
                  </p>
                  <p className="text-[10px] text-indigo-600 hover:underline">
                    Select File
                  </p>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/png,image/jpeg,image/webp" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUploadSig(file);
                  }}
                />
              </label>
              
              <div className="flex items-center w-full">
                <div className="flex-1 h-px bg-slate-100"></div>
                <span className="text-[10px] text-slate-400 px-2 font-medium">OR</span>
                <div className="flex-1 h-px bg-slate-100"></div>
              </div>
              
              <button 
                onClick={() => setIsDrawing(true)}
                className="w-full py-2 bg-white border border-slate-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 flex items-center justify-center gap-1.5 transition-colors shadow-sm text-slate-700 hover:text-indigo-700"
              >
                 <PenTool className="w-4 h-4" />
                 <span className="text-[11px] font-bold">Draw Signature</span>
              </button>
            </div>
          )}

          {hasSignature && (
            <div className="space-y-3 pt-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Placement Mode</label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="applyMode" 
                    value="single"
                    checked={applyMode === 'single'}
                    onChange={(e) => setApplyMode('single')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-700">Current Page Only</span>
                </label>
                <div className="flex flex-col gap-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="applyMode" 
                      value="all"
                      checked={applyMode === 'all'}
                      onChange={(e) => setApplyMode('all')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700">Apply to All Pages</span>
                  </label>
                  {applyMode === 'all' && (
                    <div className="space-y-1 pl-6 fade-in scale-in">
                      <label className="text-xs text-slate-500">Exclude Pages (e.g. 1, 3-5)</label>
                      <input 
                        type="text" 
                        value={excludedPages}
                        onChange={(e) => setExcludedPages(e.target.value)}
                        placeholder="Leave blank for none"
                        className="w-full border border-slate-200 rounded px-2 py-1 text-sm text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="applyMode" 
                      value="custom"
                      checked={applyMode === 'custom'}
                      onChange={(e) => setApplyMode('custom')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700">Specific Page Range</span>
                  </label>
                  {applyMode === 'custom' && (
                    <div className="space-y-1 pl-6 fade-in scale-in">
                      <label className="text-xs text-slate-500">Pages to apply (e.g. 1, 3-5)</label>
                      <input 
                        type="text" 
                        value={customPages}
                        onChange={(e) => setCustomPages(e.target.value)}
                        placeholder="e.g. 1, 3-5"
                        className="w-full border border-slate-200 rounded px-2 py-1 text-sm text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {savedAssets.length > 0 && (
            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Saved Assets</label>
              <div className="flex gap-2 overflow-x-auto pb-2 pt-2 px-1">
                {savedAssets.map(asset => (
                  <div key={asset.id} className="relative group shrink-0">
                    <button
                      onClick={() => onSelectAsset(asset)}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/my-signature", JSON.stringify({ url: asset.url, aspectRatio: asset.aspectRatio }));
                      }}
                      className={cn(
                        "w-12 h-12 border rounded flex items-center justify-center p-1 bg-slate-50 transition-colors cursor-grab active:cursor-grabbing",
                        signatureUrl === asset.url ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-indigo-300"
                      )}
                    >
                      <img src={asset.url} className="max-w-full max-h-full object-contain pointer-events-none" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteAsset(asset.id);
                      }}
                      title="Remove saved asset"
                      aria-label="Remove saved asset"
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white border border-slate-200 text-slate-400 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all z-10"
                    >
                      <X className="w-2.5 h-2.5" strokeWidth={3} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasSignature && (
            <div className="space-y-4 pt-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Signature Settings</label>
              
              <div className="space-y-3">
                {/* Background Remove Toggle Equivalent (Tolerance) */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Remove Background</span>
                    <span className="text-xs text-slate-500 font-mono">{bgTolerance}%</span>
                  </div>
                  <div className="relative">
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={bgTolerance}
                      onChange={(e) => setBgTolerance(Number(e.target.value))}
                      className="w-full accent-indigo-600 h-1 bg-slate-100 rounded-full appearance-none cursor-pointer relative z-10"
                    />
                  </div>
                </div>

                {/* Color Selection */}
                <div className="space-y-2 pt-2">
                  <span className="text-sm text-slate-600">Tint Color</span>
                  <div className="flex gap-2">
                    {[
                      { name: 'Original', value: undefined },
                      { name: 'Black', value: '#000000' },
                      { name: 'Blue', value: '#2563eb' },
                      { name: 'Red', value: '#dc2626' },
                      { name: 'Green', value: '#16a34a' },
                    ].map(color => (
                      <button
                        key={color.name}
                        onClick={() => setTintColor(color.value)}
                        className={cn(
                          "w-6 h-6 rounded-full border-2 transition-transform hover:scale-110",
                          tintColor === color.value ? "border-slate-400 scale-110" : "border-transparent shadow-sm",
                          !color.value && "bg-white overflow-hidden"
                        )}
                        style={color.value ? { backgroundColor: color.value } : {}}
                        title={color.name}
                      >
                        {!color.value && (
                          <div className="w-full h-full bg-slate-200" style={{ backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)', backgroundSize: '8px 8px', backgroundPosition: '0 0, 4px 4px' }} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}
        </section>

        {/* Text Section */}
        <section className={cn("space-y-4 pt-2 transition-opacity", !hasDocument && "opacity-50 pointer-events-none")}>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">3. Text</h2>
          <div>
             <button
               onClick={onAddText}
               className="w-full py-2.5 px-3 bg-white border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-medium text-sm rounded flex items-center justify-center gap-2 transition-colors shadow-sm"
               draggable
               onDragStart={(e) => {
                 e.dataTransfer.setData("application/my-text", "true");
               }}
             >
               <span className="text-lg">T</span> Add Text Field
             </button>
             <p className="text-[10px] text-slate-400 text-center mt-1.5">Click to add or drag to document, then pick a font from its toolbar</p>
          </div>
        </section>
      </div>

      <div className="mt-auto p-4 md:p-6 border-t border-slate-100 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-3">
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
          <p className="text-[11px] text-indigo-700 leading-relaxed">
            <strong>Pro Tip:</strong> Drag your signature carefully to position it exactly where you need it on the document.
          </p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" strokeWidth={2.2} />
          <p className="text-[11px] text-emerald-800 leading-relaxed">
            <strong className="font-semibold">100% private.</strong> Your documents and signatures never leave your device. All processing happens locally in your browser — nothing is uploaded to or stored on any server.
          </p>
        </div>
      </div>
      
      {isDrawing && (
        <DrawSignature 
          onSave={handleDrawSave} 
          onCancel={() => setIsDrawing(false)} 
        />
      )}
    </aside>
  );
}
