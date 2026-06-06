'use client';

import { WifiOff, Home, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="w-24 h-24 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mb-8 animate-pulse">
        <WifiOff size={48} />
      </div>
      
      <h1 className="text-3xl font-black text-foreground mb-4 tracking-tight uppercase">Anda Sedang Offline</h1>
      <p className="text-app-text-muted max-w-md mb-8 font-medium">
        Halaman ini belum tersimpan di memori perangkat Anda. Silakan hubungkan ke internet untuk memuat halaman ini pertama kali, atau kembali ke halaman utama yang sudah tersimpan.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
        <button 
          onClick={() => window.location.reload()}
          className="flex-1 py-4 bg-accent text-foreground rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl shadow-accent/20 active:scale-95 transition-all"
        >
          <RefreshCw size={20} /> COBA LAGI
        </button>
        
        <Link 
          href="/"
          className="flex-1 py-4 bg-surface border border-app-border text-foreground rounded-2xl font-black flex items-center justify-center gap-3 active:scale-95 transition-all"
        >
          <Home size={20} /> DASHBOARD
        </Link>
      </div>
      
      <p className="mt-12 text-[10px] text-app-text-muted font-black tracking-[0.2em] uppercase opacity-50">
        Kasir Modern POS • System Offline Mode
      </p>
    </div>
  );
}
