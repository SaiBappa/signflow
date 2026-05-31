import React, { useRef, useState, useEffect } from 'react';

interface DrawSignatureProps {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}

export function DrawSignature({ onSave, onCancel }: DrawSignatureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Setup canvas for high-DPI displays
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(1, 1);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000000';
      }
    }
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // prevent scrolling
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Check if completely empty
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const hasPixels = Array.from(pixels).some(p => p !== 0);
      if (hasPixels) {
        onSave(canvas.toDataURL('image/png'));
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-4 w-full max-w-sm flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800">Draw Signature</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        
        <div className="border-2 border-slate-200 rounded-lg bg-slate-50 relative overflow-hidden mb-4 touch-none">
          <canvas
            ref={canvasRef}
            width={400}
            height={200}
            className="w-full h-[200px] cursor-crosshair touch-none"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
          <div className="absolute bottom-2 left-2 pointer-events-none text-[10px] text-slate-300">
            Sign here
          </div>
        </div>
        
        <div className="flex justify-between items-center mt-auto">
          <button 
            onClick={clearCanvas}
            className="text-sm font-medium text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded hover:bg-slate-100"
          >
            Clear
          </button>
          <div className="flex gap-2">
            <button 
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm"
            >
              Save & Use
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
