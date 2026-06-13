'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Eraser, RotateCcw, FileSignature } from 'lucide-react';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  initialImage?: string;
  className?: string;
  hideButtons?: boolean;
}

export default function SignaturePad({ onSave, initialImage, className, hideButtons }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [currentSignature, setCurrentSignature] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (initialImage) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = initialImage;
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setIsEmpty(false);
        setCurrentSignature(initialImage);
      };
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setIsEmpty(true);
      setCurrentSignature('');
    }
  }, [initialImage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set drawing styles
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';

    // Prevent scrolling when touching the canvas
    const preventDefault = (e: TouchEvent) => {
      if (e.target === canvas) {
        if (e.cancelable) e.preventDefault();
      }
    };

    // Use non-passive listeners to allow preventDefault()
    canvas.addEventListener('touchstart', preventDefault, { passive: false });
    canvas.addEventListener('touchmove', preventDefault, { passive: false });
    canvas.addEventListener('touchend', preventDefault, { passive: false });

    // Global lock when drawing starts
    const handleGlobalTouch = (e: TouchEvent) => {
      if (isDrawing && e.cancelable) {
        e.preventDefault();
      }
    };

    if (isDrawing) {
      window.addEventListener('touchmove', handleGlobalTouch, { passive: false });
    }

    return () => {
      canvas.removeEventListener('touchstart', preventDefault);
      canvas.removeEventListener('touchmove', preventDefault);
      canvas.removeEventListener('touchend', preventDefault);
      window.removeEventListener('touchmove', handleGlobalTouch);
    };
  }, [isDrawing]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setIsEmpty(false);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      setCurrentSignature(dataUrl);
      if (hideButtons) {
        onSave(dataUrl);
      }
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setIsEmpty(true);
      setCurrentSignature('');
      if (hideButtons) {
        onSave('');
      }
    }
  };

  const handleSave = () => {
    if (isEmpty || !currentSignature) return;
    onSave(currentSignature);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="relative bg-white border-2 border-app-border rounded-2xl overflow-hidden shadow-inner touch-none">
        <canvas
          ref={canvasRef}
          width={600}
          height={300}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-[250px] cursor-crosshair touch-none"
          style={{ touchAction: 'none' }}
        />
        
        {isEmpty && !initialImage && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 font-bold uppercase tracking-widest text-sm italic text-center px-4">
            Gambar tanda tangan di sini
          </div>
        )}
      </div>

      {!hideButtons && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={clear}
            className="flex-1 flex items-center justify-center gap-2 py-4 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-500 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border border-slate-200"
          >
            <RotateCcw size={16} /> Bersihkan
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isEmpty || !currentSignature}
            className="flex-[2] flex items-center justify-center gap-2 py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 disabled:shadow-none"
          >
            <FileSignature size={16} /> Simpan & Konfirmasi
          </button>
        </div>
      )}
    </div>
  );
}
