'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';
import { auth, db, primaryDb } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { ShieldAlert, Hourglass, LogOut, ArrowRight, History, MessageCircle, Wrench } from 'lucide-react';
import SubscriptionModal from '@/components/SubscriptionModal';

export default function BlockingModal() {
  const { blockingDetails, setBlockingDetails, setUser, setRole, storeId } = useAuthStore();
  const router = useRouter();
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [hasPendingSubscription, setHasPendingSubscription] = useState(false);

  useEffect(() => {
    if (blockingDetails?.type === 'expired' && storeId) {
      const q = query(collection(primaryDb, 'subscription_requests'), where('storeId', '==', storeId), where('status', '==', 'pending'));
      const unsubscribe = onSnapshot(q, (snap) => {
        setHasPendingSubscription(!snap.empty);
      });
      return () => unsubscribe();
    }
  }, [blockingDetails, storeId]);

  if (!blockingDetails) return null;

  const handleReturnToLogin = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setRole(null);
      setBlockingDetails(null);
      router.push('/login');
    } catch (err) {
      console.error(err);
      window.location.href = '/login';
    }
  };

  const isExpired = blockingDetails.type === 'expired';
  const isPending = blockingDetails.type === 'pending_approval';
  const isMaintenance = blockingDetails.type === 'maintenance';
  const isWarning = isExpired || isPending;

  return (
    <>
      <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/40 backdrop-blur-xl animate-in fade-in duration-500">
        <div className="bg-surface border border-app-border rounded-[3rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 duration-700">
          
          {/* TOP DECORATION */}
          <div className={`h-2 w-full ${isMaintenance ? 'bg-rose-600' : isWarning ? 'bg-amber-500' : 'bg-rose-500'}`}></div>

          <div className="p-10 text-center space-y-8">
            {/* ICON SECTION */}
            <div className="relative inline-block">
               <div className={`p-6 rounded-[2rem] ${isWarning ? 'bg-amber-500/20 text-amber-500' : 'bg-rose-500/20 text-rose-500'} animate-bounce`}>
                  {isPending ? (
                    <History size={48} strokeWidth={2.5} />
                  ) : isExpired ? (
                    <Hourglass size={48} strokeWidth={2.5} />
                  ) : isMaintenance ? (
                    <Wrench size={48} className="animate-spin" style={{ animationDuration: '3s' }} strokeWidth={2.5} />
                  ) : (
                    <ShieldAlert size={48} strokeWidth={2.5} />
                  )}
               </div>
               <div className="absolute -top-2 -right-2 w-6 h-6 bg-surface rounded-full flex items-center justify-center border border-app-border shadow-lg">
                  <div className={`w-2 h-2 rounded-full ${isWarning ? 'bg-amber-500' : 'bg-rose-500'} animate-pulse`}></div>
               </div>
            </div>

            {/* TEXT SECTION */}
            <div className="space-y-3">
               <h2 className="text-3xl font-black text-foreground tracking-tight leading-tight uppercase italic leading-none">
                  {blockingDetails.title}
               </h2>
               <p className="text-sm text-app-text-muted font-bold tracking-wide leading-relaxed px-4">
                  {blockingDetails.message}
               </p>
            </div>

            {/* ADDITIONAL INFO BOX */}
            <div className="bg-background/50 border border-app-border p-5 rounded-3xl flex items-start gap-4 text-left">
               <div className="p-2 bg-surface rounded-xl text-app-text-muted">
                  <ShieldAlert size={18} />
               </div>
               <div>
                  <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest leading-none mb-1">
                     {isMaintenance ? 'Info Pemeliharaan' : 'Status Keamanan'}
                  </p>
                  <p className="text-xs font-bold text-foreground">
                     {isMaintenance 
                       ? 'Sistem kasir sedang dimigrasikan / diperbarui. Silakan tunggu.' 
                       : 'Akses dibatasi sementara oleh sistem keamanan IKASIR PRO.'}
                  </p>
               </div>
            </div>

            {/* ACTION BUTTON */}
            <div className="space-y-3">
              {isExpired && (
                <>
                  <button 
                    onClick={() => setShowSubscriptionModal(true)}
                    className="w-full group relative overflow-hidden flex items-center justify-center gap-3 py-5 rounded-2xl font-black transition-all active:scale-95 shadow-2xl bg-accent hover:bg-accent/90 text-white shadow-accent/20"
                  >
                     <span className="uppercase tracking-[0.2em] text-xs">Buka Menu Langganan</span>
                     <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shine" />
                  </button>
                </>
              )}
              {isMaintenance ? (
                <button 
                  onClick={() => window.location.reload()}
                  className="w-full group relative overflow-hidden flex items-center justify-center gap-3 py-5 rounded-2xl font-black transition-all active:scale-95 shadow-2xl bg-accent hover:bg-accent/90 text-white shadow-accent/20"
                >
                   <span className="uppercase tracking-[0.2em] text-xs">Muat Ulang Aplikasi</span>
                   <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shine" />
                </button>
              ) : (
                <button 
                  onClick={handleReturnToLogin}
                  className={`w-full group relative overflow-hidden flex items-center justify-center gap-3 py-5 rounded-2xl font-black transition-all active:scale-95 shadow-2xl ${
                    isWarning 
                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20' 
                    : 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20'
                  }`}
                >
                   <LogOut size={20} />
                   <span className="uppercase tracking-[0.2em] text-xs">Kembali ke Login</span>
                   <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                   
                   {/* GLOW EFFECT */}
                   <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shine" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <SubscriptionModal isOpen={showSubscriptionModal} onClose={() => setShowSubscriptionModal(false)} />
    </>
  );
}
