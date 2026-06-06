'use client';

import React, { useState, useRef, useEffect } from 'react';
import Barcode from 'react-barcode';
import { toPng } from 'html-to-image';
import { Product } from '@/types';
import { X, Printer, Plus, Minus, Settings2, Image as ImageIcon, Loader2 } from 'lucide-react';

interface BarcodePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
}

type LabelSize = '58x30' | '58x20';

export default function BarcodePrintModal({ isOpen, onClose, products }: BarcodePrintModalProps) {
  const [size, setSize] = useState<LabelSize>('58x30');
  const [isSharing, setIsSharing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(products.map(p => [p.id!, 1]))
  );

  // Back Button Guard Logic
  useEffect(() => {
    if (isOpen) {
      // Push a fake state to history so back button has something to "pop"
      window.history.pushState({ modalOpen: 'barcode' }, '');

      const handlePopState = (e: PopStateEvent) => {
        // If user clicks back, close the modal
        onClose();
      };

      window.addEventListener('popstate', handlePopState);

      return () => {
        window.removeEventListener('popstate', handlePopState);
        // If modal was closed NOT by back button (manually via X or Batal), 
        // we need to remove the pushed history state
        if (window.history.state?.modalOpen === 'barcode') {
          window.history.back();
        }
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const updateQuantity = (id: string, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [id]: Math.max(1, (prev[id] || 1) + delta)
    }));
  };

  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

  const centerText = (str: string, length: number) => {
    if (!str) return '';
    return str.split('\n').map(line => {
      const trimmed = line.trim();
      if (trimmed.length >= length) return trimmed;
      const leftPad = Math.floor((length - trimmed.length) / 2);
      const rightPad = length - trimmed.length - leftPad;
      return ' '.repeat(leftPad) + trimmed + ' '.repeat(rightPad);
    }).join('\n');
  };

  const handlePrint = () => {
    if (isAndroid && navigator.share) {
      const width = 32;
      const hr = '-'.repeat(width) + '\n';
      let text = '';
      
      products.forEach(p => {
        const qty = quantities[p.id!] || 1;
        for (let i = 0; i < qty; i++) {
          text += `${centerText(p.name.toUpperCase(), width)}\n`;
          text += `${centerText(p.barcode || p.sku || 'No Barcode', width)}\n`;
          text += `${centerText(`Rp ${p.price.toLocaleString('id-ID')}`, width)}\n`;
          text += hr + '\n';
        }
      });

      try {
        navigator.share({
          title: 'Barcode_Cetak',
          text: text
        });
        return;
      } catch (e) {
        console.error('Share failed', e);
      }
    }
    
    window.print();
  };

  const handleShareGraphics = async () => {
    if (!printRef.current || isSharing) return;
    
    setIsSharing(true);
    setIsCapturing(true); // Bring into view for capture
    
    try {
      // Wait for fonts to be ready
      if (document.fonts) {
        await document.fonts.ready;
      }

      // Re-trigger layout and wait for browser to paint
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 500)));
      
      const widthInPixels = 58 * 3.78 * 2; // ~58mm at high DPI
      const dataUrl = await toPng(printRef.current, { 
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true,
        style: {
          position: 'static',
          left: '0',
          top: '0',
          opacity: '1',
          visibility: 'visible',
        }
      });
      
      setIsCapturing(false);

      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `barcode_labels_${Date.now()}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Barcode_Grafis',
          text: 'Labels'
        });
      } else {
        const link = document.createElement('a');
        link.download = `barcode_labels.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (error: any) {
      setIsCapturing(false);
      console.error('Error sharing graphics:', error);
      alert('Gagal mengambil gambar: ' + (error.message || 'Coba lagi atau gunakan Cetak Browser.'));
    } finally {
      setIsSharing(false);
    }
  };

  // Generate the flattened list for the actual print view
  const printItems = products.flatMap(p => 
    Array.from({ length: quantities[p.id!] || 1 }).map((_, i) => ({
      ...p,
      uniqueKey: `${p.id}-${i}`
    }))
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 md:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-surface border border-app-border rounded-[32px] w-full max-w-4xl shadow-2xl flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-300 overflow-hidden print:hidden">
        {/* Header - Fixed */}
        <div className="flex items-center justify-between p-5 md:p-8 border-b border-app-border bg-surface shrink-0 z-20">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-foreground uppercase tracking-tighter leading-tight">Cetak Barcode</h2>
            <p className="text-[9px] md:text-[10px] text-app-text-muted font-black uppercase tracking-widest mt-1">Konfigurasi & Preview Cetak</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-background flex items-center justify-center text-app-text-muted hover:text-foreground transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-y-auto p-5 md:p-8 space-y-8 custom-scrollbar">
          {/* Settings Section */}
          <div className="bg-background/50 border border-app-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Settings2 size={18} className="text-accent" />
              <h3 className="text-xs font-black text-foreground uppercase tracking-wider">Pengaturan Label</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-app-text-muted mb-2 uppercase tracking-widest">Ukuran Kertas (mm)</label>
                <div className="flex gap-2">
                  {(['58x30', '58x20'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      className={`flex-1 py-3 text-xs font-black rounded-xl border transition-all ${
                        size === s 
                          ? 'bg-accent border-accent text-foreground shadow-lg shadow-accent/20' 
                          : 'bg-background border-app-border text-app-text-muted hover:border-accent/40'
                      }`}
                    >
                      {s} mm
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-end">
                <p className="text-[10px] text-app-text-muted italic leading-relaxed">
                  * Ukuran ini disesuaikan untuk printer label thermal standar. Pastikan ukuran kertas di printer sesuai.
                </p>
              </div>
            </div>
          </div>

          {/* Product List Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-xs font-black text-foreground uppercase tracking-wider">Daftar Produk ({products.length})</h3>
              <p className="text-[10px] font-black text-accent uppercase tracking-widest">Total Label: {Object.values(quantities).reduce((a, b) => a + b, 0)}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {products.map(product => (
                <div key={product.id} className="bg-background p-4 rounded-xl border border-app-border flex items-center justify-between group hover:border-accent/30 transition-all">
                  <div className="min-w-0 flex-1 pr-4">
                    <p className="font-bold text-sm truncate uppercase tracking-tight">{product.name}</p>
                    <p className="text-[9px] font-bold text-app-text-muted font-mono mt-0.5">{product.barcode || product.sku || 'No Barcode'}</p>
                    <p className="text-[10px] font-black text-emerald-400 mt-1">Rp {product.price.toLocaleString('id-ID')}</p>
                  </div>
                  <div className="flex items-center gap-3 bg-surface p-1 rounded-lg border border-app-border">
                    <button 
                      onClick={() => updateQuantity(product.id!, -1)}
                      className="w-8 h-8 rounded-md bg-background flex items-center justify-center text-rose-500 hover:bg-rose-500/10 transition-all active:scale-90"
                    >
                      <Minus size={14} strokeWidth={3} />
                    </button>
                    <span className="w-8 text-center font-black text-sm">{quantities[product.id!] || 1}</span>
                    <button 
                      onClick={() => updateQuantity(product.id!, 1)}
                      className="w-8 h-8 rounded-md bg-background flex items-center justify-center text-emerald-500 hover:bg-emerald-500/10 transition-all active:scale-90"
                    >
                      <Plus size={14} strokeWidth={3} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="p-4 md:p-8 border-t border-app-border bg-surface flex flex-col md:flex-row gap-3 md:gap-4 shrink-0">
          <div className="flex gap-3 md:flex-1">
            <button onClick={onClose} className="flex-1 py-4 bg-background border border-app-border hover:bg-surface text-app-text-muted hover:text-foreground rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all">BATAL</button>
            <button onClick={handlePrint} className={`flex-[2] py-4 rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2 active:scale-95 text-center ${
              isAndroid 
                ? 'bg-background border border-app-border text-app-text-muted hover:text-foreground' 
                : 'bg-accent hover:bg-accent-hover text-foreground shadow-accent/20'
            }`}>
              <Printer size={18} />
              {isAndroid ? 'Bagikan Teks (Cepat)' : 'Mulai Cetak'}
            </button>
          </div>

          {isAndroid && (
            <button 
              onClick={handleShareGraphics} 
              disabled={isSharing}
              className="w-full md:flex-1 py-4 bg-accent hover:bg-accent-hover text-foreground rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all shadow-xl shadow-accent/20 flex items-center justify-center gap-2 active:scale-95 text-center disabled:opacity-50"
            >
              {isSharing ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <ImageIcon size={18} />
              )}
              {isSharing ? 'Memproses...' : 'Bagikan Gambar (Grafis)'}
            </button>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media screen {
          .offscreen-capture {
            position: fixed !important;
            left: -9999px !important;
            top: -9999px !important;
            opacity: 0.1 !important;
            z-index: -100 !important;
            width: 58mm !important;
          }
          .offscreen-capture.is-capturing {
            left: 0 !important;
            top: 0 !important;
            opacity: 1 !important;
            z-index: 9999 !important;
            background: white !important;
            visibility: visible !important;
          }
        }
        @media print {
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
          @page {
            margin: 0;
            size: 58mm ${size === '58x30' ? '30mm' : '20mm'};
          }
          .offscreen-capture {
            position: static !important;
            width: 58mm !important;
            display: block !important;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .barcode-label {
            width: 58mm;
            height: ${size === '58x30' ? '30mm' : '20mm'};
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            page-break-after: always;
            overflow: hidden;
            padding: 2mm;
            box-sizing: border-box;
          }
        }
      `}} />

      {/* Print View Region - Off-screen for capture, visible in Print */}
      <div 
        ref={printRef}
        className={`offscreen-capture ${isCapturing ? 'is-capturing' : ''}`}
      >
        <div className="print-page bg-white">
          {printItems.map((item) => (
            <div key={item.uniqueKey} className="barcode-label">
              {/* Product Name - Stronger Presence */}
              <div style={{ 
                fontSize: '8pt', 
                fontWeight: '900', 
                width: '100%', 
                marginBottom: '0.5mm', 
                textTransform: 'uppercase',
                color: '#000000',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}>
                {item.name}
              </div>
              
              {/* Barcode Number - As separate text line just like Share */}
              <div style={{ fontSize: '7pt', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '1mm' }}>
                {item.barcode || item.sku || '00000000'}
              </div>

              {/* Barcode Bars - Graphics Only (No text below to avoid redundancy) */}
              <div style={{ background: 'white', display: 'flex', justifyContent: 'center' }}>
                <Barcode 
                  value={item.barcode || item.sku || '00000000'} 
                  width={1.4} 
                  height={size === '58x30' ? 40 : 25} 
                  displayValue={false}
                  margin={0}
                />
              </div>

              {/* Price - Larger and Centered */}
              <div style={{ 
                fontSize: '10pt', 
                fontWeight: '1000', 
                marginTop: '1.5mm',
                color: '#000000',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}>
                Rp {item.price.toLocaleString('id-ID')}
              </div>
              
              {/* Visual Divider (Optional but helps matching Share 'hr') */}
              <div style={{ width: '80%', borderBottom: '0.5pt dashed #000', marginTop: '1mm', opacity: 0.3 }}></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
