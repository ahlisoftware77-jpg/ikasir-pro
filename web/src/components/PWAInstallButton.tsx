'use client';

import { useState, useEffect } from 'react';
import { DownloadCloud, Smartphone, Sparkles, X } from 'lucide-react';
import { useBranding } from '@/context/BrandingContext';

export default function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const { branding } = useBranding();

  useEffect(() => {
    // Check if already in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true);
    }

    const handler = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      console.log('beforeinstallprompt event fired');
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);

    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
  };

  // Don't show anything if already installed
  if (isStandalone) return null;

  // Don't show anything if the prompt isn't available yet
  if (!deferredPrompt || !isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:bottom-8 md:right-8 md:left-auto md:w-80 z-[100] p-5 bg-gradient-to-br from-accent to-purple-600 rounded-[2.5rem] shadow-2xl shadow-accent/40 animate-in slide-in-from-bottom-10 duration-700 border border-white/20 backdrop-blur-xl group">
      <button 
        onClick={() => setIsVisible(false)}
        className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
      >
        <X size={16} />
      </button>

      <div className="flex items-center gap-4 mb-5">
        <div className="w-14 h-14 bg-white/20 rounded-2xl backdrop-blur-md flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform duration-500">
          <Smartphone size={28} className="text-white" />
        </div>
        <div>
          <h4 className="text-sm font-black text-white uppercase tracking-tighter flex items-center gap-2">
            Instal {branding?.appName?.split(' ')[0] || 'KASIR'} <Sparkles size={14} className="animate-pulse text-amber-300" />
          </h4>
          <p className="text-[10px] text-white/90 font-bold leading-tight mt-1">Akses lebih cepat, hemat kuota & stabil tanpa browser.</p>
        </div>
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={handleInstallClick}
          className="flex-1 py-4 bg-white text-accent rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl hover:shadow-white/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 group/btn"
        >
          <DownloadCloud size={18} className="group-hover/btn:animate-bounce" />
          PASANG SEKARANG
        </button>
      </div>
    </div>
  );
}
