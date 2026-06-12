'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, addDoc, where, updateDoc, doc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth';
import { 
  History, 
  Play, 
  Lock, 
  Unlock, 
  Loader2, 
  DollarSign, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  Calculator, 
  ArrowRight,
  ChevronRight,
  TrendingUp,
  CreditCard,
  Wallet,
  X,
  Trash2
} from 'lucide-react';
import { Shift } from '@/types';
import toast from 'react-hot-toast';

export default function ShiftsPage() {
  const { user, storeId } = useAuthStore();
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [historyShifts, setHistoryShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);

  // Stats for Active Shift
  const [activeStats, setActiveStats] = useState({
    cashSales: 0,
    nonCashSales: 0,
    trxCount: 0
  });

  // Form States
  const [startingCash, setStartingCash] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [closeNote, setCloseNote] = useState('');

  // Reset startingCash States
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (!storeId || !user) return;

    // 1. Listen for Active Shift (Only for THIS user as requested: "per karyawan")
    const qActive = query(
      collection(db, 'shifts'),
      where('storeId', '==', storeId),
      where('userId', '==', user.uid),
      where('status', '==', 'open'),
      orderBy('startTime', 'desc')
    );

    const unsubActive = onSnapshot(qActive, (snap) => {
      if (!snap.empty) {
        setActiveShift({ id: snap.docs[0].id, ...snap.docs[0].data() } as Shift);
      } else {
        setActiveShift(null);
      }
      setIsLoading(false);
    });

    // 2. Listen for History
    const qHistory = query(
      collection(db, 'shifts'),
      where('storeId', '==', storeId),
      where('userId', '==', user.uid),
      where('status', '==', 'closed'),
      orderBy('endTime', 'desc')
    );

    const unsubHistory = onSnapshot(qHistory, (snap) => {
      const items: Shift[] = [];
      snap.forEach(doc => items.push({ id: doc.id, ...doc.data() } as Shift));
      setHistoryShifts(items);
    });

    return () => { unsubActive(); unsubHistory(); };
  }, [storeId, user]);

  // Real-time stats listener for active shift
  useEffect(() => {
    if (!activeShift || !storeId) return;

    // Fetch transactions made during THIS shift
    const qTrx = query(
      collection(db, 'transactions'),
      where('storeId', '==', storeId),
      where('cashierId', '==', activeShift.userId),
      where('timestamp', '>=', activeShift.startTime)
    );

    const unsubTrx = onSnapshot(qTrx, (snap) => {
      let cash = 0;
      let nonCash = 0;
      snap.forEach(doc => {
        const d = doc.data();
        if (d.paymentStatus === 'paid') {
            if (d.paymentMethod === 'cash') cash += d.total;
            else nonCash += d.total;
        }
      });
      setActiveStats({
        cashSales: cash,
        nonCashSales: nonCash,
        trxCount: snap.size
      });
    });

    return () => unsubTrx();
  }, [activeShift, storeId]);

  const handleResetStartingCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetConfirmText !== 'Kosongkan Saldo') {
      toast.error('Teks konfirmasi salah!');
      return;
    }
    if (!activeShift) return;

    setIsResetting(true);
    try {
      const shiftRef = doc(db, 'shifts', activeShift.id!);
      await updateDoc(shiftRef, {
        startingCash: 0
      });
      toast.success('Modal awal berhasil dikosongkan!');
      setIsResetModalOpen(false);
      setResetConfirmText('');
    } catch (err) {
      console.error(err);
      toast.error('Gagal mereset modal awal.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleStartShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startingCash) return;
    
    setIsProcessing(true);
    try {
      await addDoc(collection(db, 'shifts'), {
        storeId,
        userId: user?.uid,
        userName: user?.displayName || user?.email || 'Kasir',
        startTime: serverTimestamp(),
        startingCash: Number(startingCash),
        systemCalculatedCash: 0,
        actualCash: 0,
        status: 'open',
        notes: ''
      });
      toast.success('Shift Berhasil Dibuka! Selamat Bekerja.');
      setStartingCash('');
    } catch (err) {
      console.error(err);
      toast.error('Gagal membuka shift.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    setIsProcessing(true);
    try {
      const shiftRef = doc(db, 'shifts', activeShift.id!);
      const totalSystemCash = activeStats.cashSales;
      const actual = Number(actualCash);
      const diff = actual - (activeShift.startingCash + totalSystemCash);

      await updateDoc(shiftRef, {
        status: 'closed',
        endTime: serverTimestamp(),
        systemCalculatedCash: totalSystemCash,
        actualCash: actual,
        notes: closeNote
      });

      // Maintain backward compatibility with the old closure system for reports
      await addDoc(collection(db, 'cashier_sessions'), {
        cashierId: activeShift.userId,
        cashierName: activeShift.userName,
        timestamp: serverTimestamp(),
        systemCalculatedCash: totalSystemCash,
        actualCash: actual,
        difference: diff,
        note: `Shift Closed: ${closeNote}`,
        storeId: storeId
      });

      toast.success('Shift Berhasil Ditutup!');
      setIsCloseModalOpen(false);
      setActualCash('');
      setCloseNote('');
    } catch (err) {
      console.error(err);
      toast.error('Gagal menutup shift.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <Loader2 className="animate-spin text-accent w-10 h-10" />
        <p className="text-app-text-muted font-black uppercase tracking-widest text-[10px]">Memvalidasi Status Shift...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto pb-20">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tighter uppercase leading-none mb-2">Manajemen Shift</h1>
          <p className="text-sm text-app-text-muted font-bold uppercase tracking-widest opacity-70">Kelola Sesi Kerja Kasir & Audit Laci Kas</p>
        </div>
        <div className="flex items-center gap-2 bg-surface p-1 rounded-2xl border border-app-border">
            <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${activeShift ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
               <span className={`w-2 h-2 rounded-full animate-pulse ${activeShift ? 'bg-emerald-500' : 'bg-rose-500'}`} />
               {activeShift ? 'Shift Aktif' : 'Shift Belum Dibuka'}
            </div>
        </div>
      </div>

      {!activeShift ? (
        /* START SHIFT UI */
        <div className="bg-surface border-2 border-app-border rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden group">

            
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                    <div className="inline-flex items-center gap-2 bg-accent/20 text-accent px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest shrink-0">
                        <Unlock size={14} className="shrink-0" /> Langkah Awal
                    </div>
                    <h2 className="text-3xl font-black text-foreground tracking-tight leading-tight uppercase">Mulai Sesi Kerja Anda Sekarang</h2>
                    <p className="text-app-text-muted font-medium text-sm leading-relaxed">
                        Sebelum memulai transaksi di halaman Kasir (POS), Anda diwajibkan melakukan pembukaan shift dengan memasukkan **Modal Awal (Cash Float)** yang ada di laci saat ini.
                    </p>
                    <ul className="space-y-3">
                        {['Audit uang tunai real-time', 'Keamanan laci kas terjamin', 'Laporan selisih otomatis'].map((item, i) => (
                           <li key={i} className="flex items-center gap-3 text-xs font-bold text-foreground">
                               <CheckCircle2 size={16} className="text-emerald-500" /> {item}
                           </li>
                        ))}
                    </ul>
                </div>

                <form onSubmit={handleStartShift} className="bg-background border border-app-border rounded-[2rem] p-8 space-y-6 shadow-inner">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest pl-2">Modal Awal / Uang Kas Laci (Rp)</label>
                        <div className="relative">
                            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-sm font-black text-app-text-muted">RP</span>
                            <input 
                              type="number" 
                              required
                              min="0"
                              value={startingCash}
                              onChange={e => setStartingCash(e.target.value)}
                              placeholder="0"
                              className="w-full pl-14 pr-6 py-5 bg-surface border border-app-border rounded-2xl text-xl font-black text-foreground focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all"
                            />
                        </div>
                        <p className="text-[9px] text-app-text-muted font-bold italic px-2">*Masukkan jumlah uang tunai yang tersedia saat ini di laci kas.</p>
                    </div>

                    <button 
                      disabled={isProcessing}
                      type="submit" 
                      className="w-full py-5 bg-accent hover:bg-accent-hover text-foreground rounded-2xl font-black shadow-xl shadow-accent/20 transition-all active:scale-95 flex items-center justify-center gap-3 tracking-widest text-xs uppercase"
                    >
                        {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} />}
                        BUKA SHIFT SEKARANG
                    </button>
                </form>
            </div>
        </div>
      ) : (
        /* ACTIVE SHIFT DASHBOARD */
        <div className="space-y-6">
            <div className="bg-surface border-2 border-accent/30 rounded-[3rem] p-8 md:p-12 text-foreground shadow-xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent pointer-events-none" />
                <div className="absolute -right-10 -bottom-10 md:-right-5 md:-bottom-10 opacity-[0.03] group-hover:scale-110 transition-transform duration-1000 pointer-events-none text-accent">
                    <TrendingUp className="w-56 h-56 md:w-[300px] md:h-[300px]" />
                </div>
                
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-14 h-14 shrink-0 rounded-2xl bg-accent text-white flex items-center justify-center shadow-lg shadow-accent/20">
                                <User size={28} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Kasir Aktif</p>
                                <h2 className="text-2xl font-black uppercase tracking-tight truncate">{activeShift.userName}</h2>
                            </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-4">
                            <div className="flex items-center gap-2 bg-background border border-app-border px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest min-w-0 break-words">
                                <History size={14} className="shrink-0 text-app-text-muted" /> 
                                Sejak {activeShift.startTime?.toDate ? activeShift.startTime.toDate().toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'}) : '-'}
                            </div>
                            <div className="flex items-center gap-2 bg-background border border-app-border px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shrink-0">
                                <Wallet size={14} className="shrink-0 text-app-text-muted" /> 
                                Modal: Rp {activeShift.startingCash.toLocaleString('id-ID')}
                            </div>
                            <button
                              onClick={() => setIsResetModalOpen(true)}
                              className="flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors shrink-0"
                            >
                                <Trash2 size={14} /> Reset Saldo
                            </button>
                        </div>
                    </div>

                    <div className="w-full md:w-auto">
                        <button 
                          onClick={() => setIsCloseModalOpen(true)}
                          className="w-full md:w-auto px-10 py-5 bg-rose-500 hover:bg-rose-600 text-white rounded-3xl font-black shadow-xl shadow-rose-500/20 active:scale-95 transition-all text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3"
                        >
                            <Lock size={18} /> TUTUP SHIFT
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 relative z-10">
                    <div className="bg-background border border-app-border rounded-[2rem] p-6 shadow-sm">
                        <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1">Penjualan Tunai</p>
                        <h4 className="text-2xl font-black tracking-tighter">Rp {activeStats.cashSales.toLocaleString('id-ID')}</h4>
                    </div>
                    <div className="bg-background border-2 border-accent/20 rounded-[2rem] p-6 shadow-sm relative overflow-hidden">
                        <div className="absolute inset-0 bg-accent/5" />
                        <p className="text-[10px] font-black text-accent uppercase tracking-widest mb-1 relative z-10">Estimasi di Laci</p>
                        <h4 className="text-2xl font-black tracking-tighter text-foreground relative z-10">Rp {(activeShift.startingCash + activeStats.cashSales).toLocaleString('id-ID')}</h4>
                    </div>
                    <div className="bg-background border border-app-border rounded-[2rem] p-6 shadow-sm">
                        <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1">Order Terproses</p>
                        <h4 className="text-2xl font-black tracking-tighter">{activeStats.trxCount} Transaksi</h4>
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="md:col-span-2 bg-surface border border-app-border rounded-3xl p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                    <div className="w-12 h-12 shrink-0 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-inner">
                        <TrendingUp size={24} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Informasi Tambahan</p>
                        <p className="text-xs font-bold text-foreground mt-1 leading-relaxed">Sistem saat ini melacak seluruh transaksi tunai dan non-tunai secara terpisah untuk mempermudah rekonsiliasi.</p>
                    </div>
                 </div>
                 <div className="bg-background border-2 border-dashed border-app-border rounded-3xl p-6 flex flex-col items-center justify-center text-center opacity-60">
                    <CreditCard size={32} className="text-app-text-muted mb-2" />
                    <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Non-Tunai: <span className="text-foreground">Rp {activeStats.nonCashSales.toLocaleString('id-ID')}</span></p>
                 </div>
            </div>
        </div>
      )}

      {/* SHIFT HISTORY */}
      <div className="space-y-4">
          <div className="flex items-center gap-3 px-2">
             <History className="text-app-text-muted" size={20} />
             <h3 className="text-base font-black text-foreground uppercase tracking-tight">Riwayat Sesi Kerja</h3>
          </div>

          <div className="bg-surface border border-app-border rounded-[2rem] overflow-hidden shadow-sm">
              {historyShifts.length === 0 ? (
                 <div className="p-20 text-center text-app-text-muted italic opacity-50 font-bold uppercase tracking-widest text-[10px]">Belum ada riwayat shift</div>
              ) : (
                 <>
                 {/* Desktop View */}
                 <table className="w-full text-left border-collapse hidden md:table">
                     <thead>
                         <tr className="bg-surface text-app-text-muted text-[10px] font-black uppercase tracking-[0.15em] border-b-2 border-app-border">
                             <th className="py-4 px-6 w-12 text-center">#</th>
                             <th className="py-4 px-6">Sesi (Mulai - Tutup)</th>
                             <th className="py-4 px-6">Buku Sistem</th>
                             <th className="py-4 px-6">Setoran Laci</th>
                             <th className="py-4 px-6 text-center">Status Audit</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-app-border/50 bg-background text-sm">
                         {historyShifts.map((shift, i) => {
                             const diff = shift.actualCash - (shift.startingCash + shift.systemCalculatedCash);
                             const systemRequired = shift.startingCash + shift.systemCalculatedCash;
                             return (
                                 <tr key={shift.id} className="hover:bg-surface/50 transition-colors group cursor-default">
                                     <td className="py-5 px-6 text-center">
                                        <span className="text-xs font-black text-app-text-muted/50">{i + 1}</span>
                                     </td>
                                     <td className="py-5 px-6">
                                         <div className="flex items-center gap-3">
                                             <div className="w-10 h-10 rounded-xl bg-surface border border-app-border flex items-center justify-center shrink-0 shadow-sm text-foreground group-hover:text-accent transition-colors">
                                                 <History size={18} />
                                             </div>
                                             <div>
                                                 <p className="text-xs font-black text-foreground">{shift.startTime?.toDate ? shift.startTime.toDate().toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}) : '-'}</p>
                                                 <p className="text-[10px] text-app-text-muted font-bold uppercase mt-0.5 tracking-widest">
                                                     {shift.startTime?.toDate ? shift.startTime.toDate().toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'}) : '-'} 
                                                     <span className="mx-1 text-app-border">→</span> 
                                                     {shift.endTime?.toDate ? shift.endTime.toDate().toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'}) : '-'}
                                                 </p>
                                             </div>
                                         </div>
                                     </td>
                                     <td className="py-5 px-6">
                                         <p className="text-xs font-black text-foreground">Rp {systemRequired.toLocaleString('id-ID')}</p>
                                         <p className="text-[9px] text-app-text-muted font-bold mt-0.5">(Awal: Rp {shift.startingCash.toLocaleString('id-ID')})</p>
                                     </td>
                                     <td className="py-5 px-6">
                                         <p className="text-sm font-black text-emerald-500">Rp {shift.actualCash.toLocaleString('id-ID')}</p>
                                     </td>
                                     <td className="py-5 px-6">
                                         <div className="flex justify-center">
                                             {diff === 0 ? (
                                                 <span className="bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 shadow-sm">Sesuai/Balance</span>
                                             ) : diff > 0 ? (
                                                 <span className="bg-blue-500/10 text-blue-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-500/20 shadow-sm">+ {diff.toLocaleString('id-ID')} (Surplus)</span>
                                             ) : (
                                                 <span className="bg-rose-500/10 text-rose-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-rose-500/20 shadow-sm">- {Math.abs(diff).toLocaleString('id-ID')} (Minus)</span>
                                             )}
                                         </div>
                                     </td>
                                 </tr>
                             )
                         })}
                     </tbody>
                 </table>
                 
                 {/* Mobile View */}
                 <div className="md:hidden flex flex-col gap-3 p-4 bg-background/50">
                     {historyShifts.map(shift => {
                          const diff = shift.actualCash - (shift.startingCash + shift.systemCalculatedCash);
                          const systemRequired = shift.startingCash + shift.systemCalculatedCash;
                          return (
                             <div key={shift.id} className="bg-surface border border-app-border rounded-[1.5rem] p-5 relative overflow-hidden group shadow-sm">
                                 {/* Edge Indicator */}
                                 <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${diff === 0 ? 'bg-emerald-500' : diff > 0 ? 'bg-blue-500' : 'bg-rose-500'}`} />
                                 
                                 <div className="flex justify-between items-start mb-4 pl-2">
                                     <div className="flex gap-3 items-center min-w-0 pr-2">
                                         <div className="w-10 h-10 rounded-xl bg-background border border-app-border flex items-center justify-center shrink-0 text-app-text-muted">
                                            <History size={18} />
                                         </div>
                                         <div className="min-w-0">
                                             <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest leading-none mb-1 truncate">{shift.startTime?.toDate ? shift.startTime.toDate().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) : '-'}</p>
                                             <p className="text-xs font-black text-foreground uppercase tracking-tight truncate">{shift.startTime?.toDate ? shift.startTime.toDate().toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'}) : '-'} <span className="text-app-text-muted mx-1">→</span> {shift.endTime?.toDate ? shift.endTime.toDate().toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'}) : '-'}</p>
                                         </div>
                                     </div>
                                 </div>
                                 <div className="grid grid-cols-2 gap-3 mb-4 pl-2">
                                     <div className="bg-background border border-app-border p-3 rounded-2xl relative overflow-hidden text-center">
                                         <p className="text-[9px] font-black text-app-text-muted uppercase mb-1">Buku Sistem</p>
                                         <p className="text-sm font-black text-foreground leading-none">Rp {systemRequired.toLocaleString('id-ID')}</p>
                                     </div>
                                     <div className="bg-background border border-emerald-500/20 p-3 rounded-2xl relative overflow-hidden text-center">
                                         <div className="absolute inset-0 bg-emerald-500/5" />
                                         <p className="text-[9px] font-black text-emerald-600/70 dark:text-emerald-500/70 uppercase mb-1 relative z-10">Setoran Fisik</p>
                                         <p className="text-sm font-black text-emerald-600 dark:text-emerald-500 leading-none relative z-10">Rp {shift.actualCash.toLocaleString('id-ID')}</p>
                                     </div>
                                 </div>
                                 <div className="pl-2">
                                     <div className={`p-3 rounded-xl border flex items-center justify-between ${diff === 0 ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500' : diff > 0 ? 'bg-blue-500/5 border-blue-500/20 text-blue-500' : 'bg-rose-500/5 border-rose-500/20 text-rose-500'}`}>
                                        <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                                            {diff === 0 ? <CheckCircle2 size={12} className="shrink-0" /> : <AlertCircle size={12} className="shrink-0" />}
                                            {diff === 0 ? 'Sesuai (Balance)' : diff > 0 ? 'Surplus (Kelebihan)' : 'Minus (Kekurangan)'}
                                        </span>
                                        <span className="text-xs font-black shrink-0 underline decoration-dashed underline-offset-4">
                                            {diff === 0 ? 'MATCH' : `Rp ${Math.abs(diff).toLocaleString('id-ID')}`}
                                        </span>
                                     </div>
                                 </div>
                             </div>
                          )
                     })}
                 </div>
                 </>
              )}
           </div>
       </div>

      {/* CLOSE SHIFT MODAL */}
      {isCloseModalOpen && activeShift && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-black/95 backdrop-blur-xl">
          <div className="bg-surface border-t md:border border-app-border rounded-t-[3rem] md:rounded-[3.5rem] w-full max-w-lg shadow-2xl p-10 h-full md:h-auto overflow-y-auto animate-in slide-in-from-bottom md:zoom-in-95 duration-300">
             <div className="flex items-start justify-between mb-10">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 shrink-0 bg-rose-500/20 text-rose-500 rounded-[1.5rem] flex items-center justify-center">
                        <Calculator size={32} className="shrink-0" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-2xl font-black text-foreground tracking-tight uppercase leading-none mb-2 truncate">Penutupan Sesi</h2>
                        <p className="text-xs text-app-text-muted font-bold tracking-widest uppercase truncate">Input Data Uang Fisik Terakhir</p>
                    </div>
                </div>
                <button onClick={() => setIsCloseModalOpen(false)} className="p-2 border border-app-border rounded-full hover:bg-background transition-colors text-app-text-muted">
                    <X size={24} />
                </button>
             </div>

             <form onSubmit={handleCloseShift} className="space-y-8">
                <div className="bg-background border border-app-border rounded-[2rem] p-6 grid grid-cols-2 gap-6 relative overflow-hidden">
                    <div className="absolute right-[-10%] bottom-[-10%] opacity-5 text-accent pointer-events-none">
                        <TrendingUp size={120} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1">Modal + Penjualan</p>
                        <p className="text-lg font-black text-foreground tracking-tighter">Rp {(activeShift.startingCash + activeStats.cashSales).toLocaleString('id-ID')}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1">Status Shift</p>
                        <p className="text-sm font-black text-emerald-500 tracking-widest uppercase">BERJALAN</p>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-app-text-muted uppercase tracking-[0.3em] pl-2 mb-2 block">Total Uang Fisik Di Laci Kas (Rp)</label>
                    <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-sm font-black text-app-text-muted">RP</span>
                        <input 
                            type="number" 
                            required
                            min="0"
                            value={actualCash}
                            onChange={e => setActualCash(e.target.value)}
                            placeholder="0"
                            className="w-full pl-14 pr-6 py-6 bg-background border-2 border-app-border rounded-3xl text-2xl font-black text-foreground focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all font-mono"
                        />
                    </div>
                    <p className="text-[10px] text-app-text-muted font-bold italic px-2">*Hitung seluruh uang fisik (kertas & koin) yang ada di laci saat ini.</p>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-app-text-muted uppercase tracking-[0.3em] pl-2 mb-2 block">Catatan Penutupan</label>
                    <textarea 
                        value={closeNote}
                        onChange={e => setCloseNote(e.target.value)}
                        placeholder="Misal: Pecahan besar sudah disetor ke brankas..."
                        className="w-full px-6 py-5 bg-background border-2 border-app-border rounded-3xl text-sm font-bold text-foreground focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all resize-none h-28"
                    />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <button 
                      type="button" 
                      onClick={() => setIsCloseModalOpen(false)}
                      className="flex-1 py-5 text-[11px] font-black uppercase tracking-widest text-app-text-muted bg-background border border-app-border rounded-2xl hover:text-foreground transition-all"
                    >
                        BATAL
                    </button>
                    <button 
                      disabled={isProcessing}
                      type="submit" 
                      className="flex-[2] py-5 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black shadow-xl shadow-rose-500/20 transition-all active:scale-95 flex items-center justify-center gap-3 text-xs uppercase tracking-[0.2em]"
                    >
                        {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Lock size={18} />}
                        SELESAIKAN & TUTUP SHIFT
                    </button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* RESET SALDO MODAL */}
      {isResetModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface border-2 border-app-border rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="text-xl font-black text-rose-500 uppercase tracking-tight">Reset Modal Awal</h3>
                <p className="text-xs text-app-text-muted font-bold">Kosongkan saldo awal sesi shift aktif ini.</p>
              </div>
              <button 
                onClick={() => { setIsResetModalOpen(false); setResetConfirmText(''); }}
                className="w-8 h-8 rounded-lg bg-app-border/50 flex items-center justify-center text-app-text-muted hover:text-foreground transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleResetStartingCash} className="space-y-4">
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs font-bold text-rose-500 leading-relaxed">
                Tindakan ini akan mengosongkan Modal Awal aktif menjadi <strong>Rp 0</strong>. Ketik <strong>Kosongkan Saldo</strong> di bawah untuk mengonfirmasi.
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest pl-2">Teks Konfirmasi</label>
                <input 
                  type="text"
                  required
                  value={resetConfirmText}
                  onChange={e => setResetConfirmText(e.target.value)}
                  placeholder="Kosongkan Saldo"
                  className="w-full px-5 py-4 bg-background border border-app-border rounded-xl text-sm font-bold text-foreground focus:outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isResetting || resetConfirmText !== 'Kosongkan Saldo'}
                className="w-full py-4 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl font-black shadow-lg shadow-rose-500/20 active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2"
              >
                {isResetting && <Loader2 size={16} className="animate-spin" />}
                KONFIRMASI KOSONGKAN SALDO
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
