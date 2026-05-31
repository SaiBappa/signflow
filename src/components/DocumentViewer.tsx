import React, { useRef, useEffect, useState } from 'react';
import { Rnd } from 'react-rnd';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import { DocumentFile, SignatureState, DateState, TextInstance } from '../types';
import { usePdf } from '../hooks/usePdf';
import { cn, isPageInRange } from '../utils';

interface DocumentViewerProps {
  document: DocumentFile | null;
  signature: SignatureState | null;
  setSignature: React.Dispatch<React.SetStateAction<SignatureState | null>>;
  dateState: DateState;
  setDateState: React.Dispatch<React.SetStateAction<DateState>>;
  texts: TextInstance[];
  setTexts: React.Dispatch<React.SetStateAction<TextInstance[]>>;
}

export function DocumentViewer({
  document,
  signature,
  setSignature,
  dateState,
  setDateState,
  texts,
  setTexts,
}: DocumentViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { pdfDoc, numPages, currentPage, setCurrentPage, loading } = usePdf(document?.type === 'pdf' ? document.file : null);
  const [renderScale, setRenderScale] = useState(1);
  const [renderedDimensions, setRenderedDimensions] = useState({ width: 0, height: 0 });
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  // Render PDF page
  useEffect(() => {
    let renderTask: any = null;

    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current || !containerRef.current) return;

      try {
        const page = await pdfDoc.getPage(currentPage);
        
        // Determine optimal scale to fit container width
        const containerWidth = containerRef.current.clientWidth - 32; // 32px padding
        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(containerWidth / unscaledViewport.width, 2.0); // max scale 2.0
        setRenderScale(scale);
        
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;
        setRenderedDimensions({ width: viewport.width, height: viewport.height });

        renderTask = page.render({
          canvasContext: context,
          viewport: viewport,
        });

        await renderTask.promise;
      } catch (err) {
        if (err instanceof Error && err.name === 'RenderingCancelledException') {
          // Ignore cancelled renders
        } else {
          console.error("Render error", err);
        }
      }
    };

    renderPage();

    return () => {
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, currentPage, containerRef.current?.clientWidth]);

  // Handle Image loading dimensions
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setRenderedDimensions({
      width: e.currentTarget.width,
      height: e.currentTarget.height
    });
  };

  if (!document) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-gradient-to-tr from-indigo-100 to-violet-50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-white">
            <span className="text-4xl">✨</span>
          </div>
          <h3 className="text-xl font-bold text-slate-800 tracking-tight">Ready to Flow</h3>
          <p className="text-sm text-slate-500 mt-2 font-medium">Upload a PDF or Image from the sidebar to begin signing.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden rounded-2xl shadow-sm border border-slate-200/60 bg-white/40 backdrop-blur-3xl" ref={containerRef}>
      {/* Pagination Toolbar */}
      {document.type === 'pdf' && numPages > 1 && (
        <div className="absolute bottom-8 right-8 flex items-center bg-white rounded-full shadow-lg border border-slate-200 px-4 py-2 gap-4 z-20">
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600 disabled:opacity-50"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium text-slate-700">
            {currentPage} / {numPages}
          </span>
          <button 
            onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
            disabled={currentPage === numPages}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600 disabled:opacity-50"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Document Area */}
      <div className="flex-1 overflow-auto p-4 md:p-8 flex items-start justify-center rounded-2xl">
        <div 
          className="relative bg-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] rounded-sm overflow-hidden flex flex-col transition-all duration-300"
          style={{
            width: renderedDimensions.width || 'auto',
            height: renderedDimensions.height || 'auto'
          }}
          id="document-canvas-container"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(e) => {
            e.preventDefault();
            const sigType = e.dataTransfer.getData("application/my-signature");
            const textType = e.dataTransfer.getData("application/my-text");
            
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const canvasWidth = e.currentTarget.clientWidth;
            const canvasHeight = e.currentTarget.clientHeight;

            if (textType) {
              setTexts(prev => [...prev, {
                id: Math.random().toString(36).substring(7),
                text: 'Double click to edit',
                pageIndex: currentPage,
                pos: { x, y, width: 200, height: 40 },
                fontSize: 24,
                color: '#000000',
                canvasWidth,
                canvasHeight
              }]);
              return;
            }

            if (sigType) {
              let payloadUrl = signature?.url || "";
              let payloadAspect = signature?.aspectRatio || 2.5;
              try {
                if (sigType !== "true") {
                  const parsed = JSON.parse(sigType);
                  if (parsed.url) payloadUrl = parsed.url;
                  if (parsed.aspectRatio) payloadAspect = parsed.aspectRatio;
                }
              } catch (e) {}

              setSignature(prev => {
                const newInstance = {
                  id: Math.random().toString(36).substring(7),
                  pos: { x, y, width: 150, height: payloadAspect ? 150 / payloadAspect : 60 },
                  pageIndex: currentPage,
                  canvasWidth: canvasWidth,
                  canvasHeight: canvasHeight,
                  url: payloadUrl,
                  aspectRatio: payloadAspect
                };

                if (!prev) {
                  return {
                     url: payloadUrl,
                     originalUrl: payloadUrl,
                     bgRemovalTolerance: 50,
                     pos: { x: 100, y: 100, width: 150, height: payloadAspect ? 150 / payloadAspect : 60 },
                     applyMode: 'single',
                     customPages: '',
                     excludedPages: '',
                     instances: [newInstance],
                     aspectRatio: payloadAspect
                  };
                }
                
                return {
                  ...prev,
                  instances: [...prev.instances, newInstance]
                };
              });
            }
          }}
        >
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          )}

          {document.type === 'pdf' ? (
            <canvas ref={canvasRef} id="document-canvas-content" className="block" />
          ) : (
            <img 
              src={document.url} 
              id="document-canvas-content"
              alt="Document" 
              className="block" 
              onLoad={handleImageLoad}
            />
          )}

          {/* Overlays */}
          {signature && renderedDimensions.width > 0 && signature.instances?.filter((instance) => {
            if (signature.applyMode === 'all') {
              return !isPageInRange(signature.excludedPages, currentPage);
            } else if (signature.applyMode === 'custom') {
              return isPageInRange(signature.customPages, currentPage);
            }
            return instance.pageIndex === currentPage;
          }).map((instance, index) => (
            <Rnd
              key={instance.id}
              size={{ width: instance.pos.width, height: instance.pos.height }}
              position={{ x: instance.pos.x, y: instance.pos.y }}
              lockAspectRatio={true}
              onDragStop={(e, d) => {
                const container = window.document.getElementById('document-canvas-container');
                setSignature(prev => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    instances: prev.instances.map(inst => 
                      inst.id === instance.id ? { 
                        ...inst, 
                        pos: { ...inst.pos, x: d.x, y: d.y },
                        canvasWidth: container?.clientWidth,
                        canvasHeight: container?.clientHeight
                      } : inst
                    )
                  };
                });
              }}
              onResizeStop={(e, direction, ref, delta, position) => {
                const container = window.document.getElementById('document-canvas-container');
                setSignature(prev => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    instances: prev.instances.map(inst => 
                      inst.id === instance.id ? {
                        ...inst,
                        pos: {
                          x: position.x,
                          y: position.y,
                          width: parseInt(ref.style.width, 10),
                          height: parseInt(ref.style.height, 10),
                        },
                        canvasWidth: container?.clientWidth,
                        canvasHeight: container?.clientHeight
                      } : inst
                    )
                  };
                });
              }}
              bounds="parent"
              className={cn("group rounded touch-none z-50")}
            >
              <div 
                className="w-full h-full relative" 
                style={{ transform: `rotate(${instance.rotation || 0}deg)` }}
              >
                <div className="absolute inset-0 border-2 border-indigo-400 border-dashed rounded pointer-events-none group-active:border-indigo-500 z-10"></div>
                {/* Transform Controls styled to match theme */}
                <div className="absolute -top-1 -left-1 w-3 h-3 bg-indigo-600 rounded-full border border-white shadow-sm opacity-0 group-hover:opacity-100 pointer-events-none"></div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-600 rounded-full border border-white shadow-sm opacity-0 group-hover:opacity-100 pointer-events-none"></div>
                <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-indigo-600 rounded-full border border-white shadow-sm opacity-0 group-hover:opacity-100 pointer-events-none"></div>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-indigo-600 rounded-full border border-white shadow-sm opacity-0 group-hover:opacity-100 pointer-events-none"></div>

                {/* Rotation Handle */}
                <div 
                  className="absolute -top-6 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border border-slate-200 shadow-md rounded-full flex items-center justify-center cursor-crosshair opacity-0 group-hover:opacity-100 pointer-events-auto z-50 hover:bg-slate-50 hover:text-indigo-600 text-slate-400 transition-colors"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const startRot = instance.rotation || 0;
                    
                    const rect = e.currentTarget.parentElement!.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;

                    const onPointerMove = (moveEvent: PointerEvent) => {
                      const currentAngle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX) * 180 / Math.PI;
                      const startAngle = Math.atan2(startY - centerY, startX - centerX) * 180 / Math.PI;
                      let newRot = startRot + (currentAngle - startAngle);
                      
                      setSignature(prev => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          instances: prev.instances.map(inst => 
                            inst.id === instance.id ? { ...inst, rotation: newRot } : inst
                          )
                        };
                      });
                    };

                    const onPointerUp = () => {
                      window.removeEventListener('pointermove', onPointerMove);
                      window.removeEventListener('pointerup', onPointerUp);
                    };

                    window.addEventListener('pointermove', onPointerMove);
                    window.addEventListener('pointerup', onPointerUp);
                  }}
                >
                  <RotateCw size={12} />
                </div>

                <img 
                  src={instance.url || signature.url} 
                  className="w-full h-full object-contain pointer-events-none select-none" 
                  draggable={false}
                />
              </div>
              {/* Floating Toolbar representation */}
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-2 py-1 rounded text-[10px] flex gap-2 items-center shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                <span>Signature #{index + 1}</span>
                <div className="h-3 w-[1px] bg-slate-600"></div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSignature(prev => prev ? { ...prev, instances: prev.instances.filter(i => i.id !== instance.id) } : null);
                  }}
                  className="hover:text-red-400 text-red-300"
                >Delete</button>
              </div>
            </Rnd>
          ))}

          {texts.filter(t => t.pageIndex === currentPage).map(text => (
            <Rnd
              key={text.id}
              size={{ width: text.pos.width, height: text.pos.height }}
              position={{ x: text.pos.x, y: text.pos.y }}
              onDragStop={(e, d) => {
                const container = window.document.getElementById('document-canvas-container');
                setTexts(prev => prev.map(t => 
                  t.id === text.id ? { 
                    ...t, 
                    pos: { ...t.pos, x: d.x, y: d.y },
                    canvasWidth: container?.clientWidth,
                    canvasHeight: container?.clientHeight
                  } : t
                ));
              }}
              onResizeStop={(e, direction, ref, delta, position) => {
                const container = window.document.getElementById('document-canvas-container');
                setTexts(prev => prev.map(t => 
                  t.id === text.id ? {
                    ...t,
                    pos: {
                      x: position.x,
                      y: position.y,
                      width: parseInt(ref.style.width, 10),
                      height: parseInt(ref.style.height, 10)
                    },
                    fontSize: Math.max(12, parseInt(ref.style.height, 10) * 0.7),
                    canvasWidth: container?.clientWidth,
                    canvasHeight: container?.clientHeight
                  } : t
                ));
              }}
              bounds="parent"
              enableResizing={editingTextId !== text.id}
              disableDragging={editingTextId === text.id}
              className={`group rounded z-50 ${editingTextId === text.id ? 'ring-2 ring-indigo-500 bg-white/10' : 'hover:ring-2 hover:ring-indigo-400/50'}`}
            >
              <div className="absolute inset-0 border-2 border-transparent group-hover:border-indigo-400 border-dashed rounded pointer-events-none z-10 transition-colors"></div>
              
              {editingTextId === text.id ? (
                <textarea 
                  autoFocus
                  onBlur={() => setEditingTextId(null)}
                  value={text.text}
                  onChange={(e) => setTexts(prev => prev.map(t => t.id === text.id ? { ...t, text: e.target.value } : t))}
                  onMouseDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Escape') {
                      setEditingTextId(null);
                      e.currentTarget.blur();
                    }
                  }}
                  className="w-full h-full bg-transparent resize-none overflow-hidden outline-none break-words leading-tight"
                  style={{ fontSize: `${text.fontSize}px`, color: text.color }}
                  spellCheck={false}
                />
              ) : (
                <div 
                   onDoubleClick={() => setEditingTextId(text.id)}
                   className="w-full h-full cursor-move overflow-hidden"
                >
                   <p className="w-full h-full whitespace-pre-wrap break-words leading-tight" style={{ fontSize: `${text.fontSize}px`, color: text.color }}>
                     {text.text}
                   </p>
                </div>
              )}

              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white border border-slate-200 shadow-lg rounded-lg p-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none group-hover:pointer-events-auto">
                 <button 
                   onClick={(e) => {
                     e.stopPropagation();
                     setTexts(prev => prev.map(t => t.id === text.id ? { ...t, fontSize: Math.max(8, t.fontSize - 2) } : t));
                   }}
                   className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded text-xs font-bold"
                   title="Decrease font size"
                 >
                   A-
                 </button>
                 <button 
                   onClick={(e) => {
                     e.stopPropagation();
                     setTexts(prev => prev.map(t => t.id === text.id ? { ...t, fontSize: t.fontSize + 2 } : t));
                   }}
                   className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded text-sm font-bold"
                   title="Increase font size"
                 >
                   A+
                 </button>
                 <div className="w-[1px] h-4 bg-slate-200 mx-1"></div>
                 <input 
                   type="color" 
                   value={text.color}
                   onChange={e => setTexts(prev => prev.map(t => t.id === text.id ? { ...t, color: e.target.value } : t))}
                   className="w-6 h-6 p-0 border-0 rounded cursor-pointer" 
                 />
                 <div className="w-[1px] h-4 bg-slate-200 mx-1"></div>
                 <button 
                   onClick={(e) => {
                     e.stopPropagation();
                     setTexts(prev => prev.filter(t => t.id !== text.id));
                   }}
                   className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                 >
                   ✕
                 </button>
              </div>
            </Rnd>
          ))}

          {dateState.enabled && renderedDimensions.width > 0 && (
            <Rnd
              default={{
                x: dateState.pos.x,
                y: dateState.pos.y,
                width: dateState.pos.width,
                height: dateState.pos.height
              }}
              onDragStop={(e, d) => {
                setDateState({ ...dateState, pos: { ...dateState.pos, x: d.x, y: d.y } });
              }}
              onResizeStop={(e, direction, ref, delta, position) => {
                setDateState({
                  ...dateState,
                  pos: {
                    x: position.x,
                    y: position.y,
                    width: parseInt(ref.style.width, 10),
                    height: parseInt(ref.style.height, 10),
                  },
                  fontSize: Math.max(12, parseInt(ref.style.height, 10) * 0.7)
                });
              }}
              bounds="parent"
              className="group rounded touch-none flex items-center z-50 hover:ring-2 hover:ring-green-400/50"
            >
              <div className="absolute inset-0 border-2 border-transparent group-active:border-green-600 group-hover:border-green-400 border-dashed rounded pointer-events-none z-10 transition-colors"></div>
              
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white border border-slate-200 shadow-lg rounded-lg p-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none group-hover:pointer-events-auto">
                 <button 
                   onClick={(e) => {
                     e.stopPropagation();
                     setDateState(prev => ({ ...prev, fontSize: Math.max(8, (prev.fontSize || 16) - 2) }));
                   }}
                   className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-green-600 hover:bg-green-50 rounded text-xs font-bold"
                   title="Decrease font size"
                 >
                   A-
                 </button>
                 <button 
                   onClick={(e) => {
                     e.stopPropagation();
                     setDateState(prev => ({ ...prev, fontSize: (prev.fontSize || 16) + 2 }));
                   }}
                   className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-green-600 hover:bg-green-50 rounded text-sm font-bold"
                   title="Increase font size"
                 >
                   A+
                 </button>
                 <div className="w-[1px] h-4 bg-slate-200 mx-1"></div>
                 <button 
                   onClick={(e) => {
                     e.stopPropagation();
                     setDateState(prev => ({ ...prev, enabled: false }));
                   }}
                   className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                 >
                   ✕
                 </button>
              </div>

              <div className="w-full h-full whitespace-nowrap text-slate-800 font-medium whitespace-nowrap flex items-center select-none" style={{ fontSize: `${dateState.fontSize || 16}px` }}>
                {format(dateState.value, dateState.format)}
              </div>
            </Rnd>
          )}
        </div>
      </div>
    </div>
  );
}
