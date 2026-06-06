'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, CameraOff, Loader2 } from 'lucide-react';

// Global Lock to prevent concurrent access across the entire app
let isCameraStarting = false;

interface BarcodeScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
  title?: string;
  continuous?: boolean;
  bottomContent?: React.ReactNode;
}

export default function BarcodeScanner({ onScan, onClose, title = "Scan Barcode", continuous = false, bottomContent }: BarcodeScannerProps) {
  const lastScannedTime = useRef(0);
  const lastScannedText = useRef('');
  const [status, setStatus] = useState<'loading' | 'active' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const containerId = "app-qr-reader";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMounted = useRef(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Pre-load audio
    audioRef.current = new Audio('/sound/beepscan.mp3');
    audioRef.current.load();
    
    // Attempt to "unlock" audio on first interaction
    const unlockAudio = () => {
      console.log("Attempting to unlock audio...");
      if (audioRef.current) {
        audioRef.current.play().then(() => {
          console.log("Audio unlocked successfully");
          audioRef.current?.pause();
          audioRef.current!.currentTime = 0;
        }).catch((err) => {
          console.warn("Audio unlock failed, will retry on next click:", err);
        });
      }
      // Note: We don't remove the listener immediately if it fails
      // but we do if it succeeds or we can just leave it for the first few taps
    };
    
    // Listen for any interaction anywhere to unlock audio
    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('touchstart', unlockAudio, { once: true });

    isMounted.current = true;
    
    const initScanner = async () => {
      // 0. Timeout Protection: If still loading after 10s, release lock and error out
      const timeout = setTimeout(() => {
        if (status === 'loading' && isMounted.current) {
          isCameraStarting = false;
          setStatus('error');
          setErrorMessage("Waktu inisialisasi habis. Mohon muat ulang.");
        }
      }, 10000);

      // 1. Wait if another process is starting (Max wait 3s)
      let waitTime = 0;
      while (isCameraStarting && waitTime < 30) {
        await new Promise(r => setTimeout(r, 100));
        waitTime++;
        if (!isMounted.current) {
          clearTimeout(timeout);
          return;
        }
      }

      // Check Secure Context
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        clearTimeout(timeout);
        setStatus('error');
        setErrorMessage("Koneksi tidak aman (Non-HTTPS).");
        return;
      }

      isCameraStarting = true;
      if (isMounted.current) setStatus('loading');

      try {
        // 2. Clear Any Hanging Streams
        if (typeof window !== 'undefined' && (window as any).currentScannerStream) {
          const stream = (window as any).currentScannerStream;
          stream.getTracks().forEach((t: any) => t.stop());
          (window as any).currentScannerStream = null;
        }

        // 3. Prepare DOM
        const container = document.getElementById(containerId);
        if (container) container.innerHTML = "";

        // 4. Start Scanner
        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;

        await new Promise(r => setTimeout(r, 500)); // Hardware cool-down
        
        if (!isMounted.current) throw new Error("Abort");

        await scanner.start(
          { facingMode: "environment" },
          { fps: 15, qrbox: { width: 250, height: 250 } },
          (text) => {
            const now = Date.now();
            if (continuous) {
              if (text === lastScannedText.current && now - lastScannedTime.current < 2000) return; // Prevent spamming same code
              lastScannedText.current = text;
              lastScannedTime.current = now;
              
              // Play beep sound
              try {
                if (audioRef.current) {
                  audioRef.current.currentTime = 0;
                  audioRef.current.play().catch(e => console.error("Audio play failed:", e));
                }
              } catch (e) {}

              onScan(text);
            } else {
              // Play beep sound
              try {
                if (audioRef.current) {
                  audioRef.current.currentTime = 0;
                  audioRef.current.play().catch(e => console.error("Audio play failed:", e));
                }
              } catch (e) {}

              onScan(text);
              forceClose();
            }
          },
          () => {} 
        );

        if (isMounted.current) {
          clearTimeout(timeout);
          setStatus('active');
          const video = container?.querySelector('video');
          if (video) (window as any).currentScannerStream = (video as any).srcObject;
        }

      } catch (err: any) {
        console.error("Scanner Error:", err);
        if (isMounted.current) {
          clearTimeout(timeout);
          setStatus('error');
          setErrorMessage("Kamera sedang sibuk. Mohon tutup aplikasi lain atau muat ulang.");
        }
      } finally {
        isCameraStarting = false;
      }
    };

    const forceClose = async () => {
      isMounted.current = false;
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) await scannerRef.current.stop();
          scannerRef.current.clear();
        } catch (e) {}
      }
      onClose();
    };

    initScanner();

    return () => {
      isMounted.current = false;
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().then(() => scannerRef.current?.clear()).catch(() => {});
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-300">
      <div className="bg-surface border border-app-border rounded-[2.5rem] w-full max-w-sm shadow-2xl relative overflow-hidden flex flex-col">
        <div className="p-6 border-b border-app-border flex items-center justify-between bg-surface">
          <div>
            <h3 className="text-foreground font-black uppercase tracking-widest text-xs">{title}</h3>
            <p className="text-[10px] text-app-text-muted mt-1 font-bold">Secure Scan Engine</p>
          </div>
          <button onClick={onClose} className="p-2 bg-background rounded-full text-app-text-muted hover:text-rose-500 transition-all">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-8 bg-black flex flex-col items-center">
          <div className="relative w-full aspect-square bg-slate-900 rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
            <div id={containerId} className="w-full h-full"></div>
            
            {status === 'loading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 bg-slate-900/50">
                <Loader2 className="w-10 h-10 animate-spin text-accent" />
                <p className="text-[10px] font-black text-accent uppercase tracking-[3px]">Inisialisasi...</p>
              </div>
            )}

            {status === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center space-y-4 bg-rose-500/10">
                <CameraOff size={48} className="text-rose-500" />
                <p className="text-xs font-bold text-rose-400 leading-relaxed uppercase">{errorMessage}</p>
                <button onClick={() => window.location.reload()} className="px-5 py-2.5 bg-rose-500 text-white text-[10px] font-black rounded-xl">MUAT ULANG</button>
              </div>
            )}

            {status === 'active' && (
              <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none rounded-3xl">
                <div className="w-full h-full border-2 border-accent/30 rounded-lg relative">
                   <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-accent rounded-tr-md" />
                   <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-accent rounded-tl-md" />
                   <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-accent rounded-br-md" />
                   <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-accent rounded-bl-md" />
                </div>
              </div>
            )}
          </div>

          {status === 'active' && (
            <div className="mt-6 w-full space-y-4">
              {bottomContent ? (
                bottomContent
              ) : (
                <>
                  <div className="w-full h-1 bg-accent/10 rounded-full overflow-hidden relative">
                     <div className="absolute inset-y-0 bg-accent animate-[shimmer_2s_infinite] w-1/3" />
                  </div>
                  <p className="text-center text-[10px] text-app-text-muted font-black uppercase tracking-[5px] animate-pulse">Scanning...</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
