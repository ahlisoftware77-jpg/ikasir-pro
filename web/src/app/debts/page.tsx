'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth';
import { 
  BookOpen, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  User, 
  CreditCard,
  ChevronRight,
  TrendingDown,
  History,
  X,
  Plus,
  Printer,
  Globe,
  Share2,
  Edit2,
  Download
} from 'lucide-react';
import { Transaction } from '@/types';
import toast from 'react-hot-toast';
import { printReceipt } from '@/lib/printReceipt';
import Link from 'next/link';
import { getDoc } from 'firebase/firestore';
import { useBranding } from '@/context/BrandingContext';
import { exportToExcel } from '@/lib/exportToExcel';

export default function DebtsPage() {
  const { storeId, user, userName } = useAuthStore();
  const { branding } = useBranding();
  const [debts, setDebts] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid'>('unpaid');
  const [storeSettings, setStoreSettings] = useState<any>(null);
  
  const [selectedDebt, setSelectedDebt] = useState<Transaction | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentNote, setPaymentNote] = useState<string>('Pembayaran cicilan');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteValue, setEditNoteValue] = useState('');

  const handleExport = () => {
    const formattedData = filteredDebts.map(d => {
      const currentPaid = d.paidAmount ?? d.cashReceived ?? 0;
      const remaining = d.total - currentPaid;
      return {
        'ID Transaksi': d.id,
        'Pelanggan': d.customerName || 'Pelanggan Anonim',
        'Tanggal': d.timestamp?.toDate ? d.timestamp.toDate().toLocaleString('id-ID') : new Date(d.timestamp).toLocaleString('id-ID'),
        'Total Transaksi (Rp)': d.total,
        'Telah Dibayar (Rp)': currentPaid,
        'Sisa Tagihan (Piutang) (Rp)': remaining,
        'Jatuh Tempo': d.dueDate ? new Date(d.dueDate).toLocaleDateString('id-ID') : '-',
        'Status': d.paymentStatus === 'paid' ? 'Lunas' : d.paymentStatus === 'partially_paid' ? 'Dicicil' : 'Belum Lunas'
      };
    });
    exportToExcel(formattedData, 'Laporan_Daftar_Piutang');
  };

  useEffect(() => {
    if (!storeId) return;

    const q = query(
      collection(db, 'transactions'),
      where('storeId', '==', storeId),
      where('paymentCategory', '==', 'debt')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbDebts: Transaction[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.paymentStatus !== 'cancelled' && data.orderStatus !== 'cancelled') {
          dbDebts.push({ id: d.id, ...data } as Transaction);
        }
      });
      // Sort by latest by default in client side
      dbDebts.sort((a, b) => {
        const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
        const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
        return dateB.getTime() - dateA.getTime();
      });
      setDebts(dbDebts);
      setIsLoading(false);
    });

    // Fetch Store Settings for printing
    const fetchSettings = async () => {
      const settingsSnap = await getDoc(doc(db, 'settings', `store_${storeId}`));
      if (settingsSnap.exists()) {
        setStoreSettings(settingsSnap.data());
      }
    };
    fetchSettings();

    return () => unsubscribe();
  }, [storeId]);

  const filteredDebts = debts.filter(d => {
    const matchesSearch = d.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) || d.id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = 
      filter === 'all' ? true : 
      filter === 'paid' ? d.paymentStatus === 'paid' : 
      (d.paymentStatus === 'unpaid' || d.paymentStatus === 'partially_paid');
    return matchesSearch && matchesFilter;
  });

  const totalUnpaid = debts
    .filter(d => d.paymentStatus !== 'paid')
    .reduce((acc, curr) => acc + (curr.total - (curr.paidAmount ?? curr.cashReceived ?? 0)), 0);

  const totalPaid = debts
    .filter(d => d.paymentStatus === 'paid')
    .reduce((acc, curr) => acc + curr.total, 0);

  const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  const handlePayInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt || !selectedDebt.id) return;
    if (paymentAmount <= 0) {
      toast.error('Jumlah pembayaran harus lebih dari Rp 0');
      return;
    }

    setIsSubmitting(true);
    try {
      const currentPaid = selectedDebt.paidAmount ?? selectedDebt.cashReceived ?? 0;
      const newPaid = currentPaid + paymentAmount;
      const remaining = selectedDebt.total - newPaid;
      
      const newStatus = remaining <= 0 ? 'paid' : 'partially_paid';
      const change = remaining < 0 ? Math.abs(remaining) : 0;

      const newHistoryItem = {
        id: Math.random().toString(36).substring(2, 9),
        amount: paymentAmount,
        date: new Date().toISOString(),
        cashierName: userName || user?.displayName || 'Unknown',
        note: paymentNote || 'Pembayaran cicilan'
      };

      const updatedHistory = [...(selectedDebt.paymentHistory || []), newHistoryItem];

      await updateDoc(doc(db, 'transactions', selectedDebt.id), {
        paidAmount: newPaid,
        debtAmount: Math.max(0, remaining),
        cashReceived: newPaid, // Keep for backward compatibility
        change: change,
        paymentStatus: newStatus,
        paymentHistory: updatedHistory,
        updatedAt: new Date().toISOString()
      });

      toast.success(newStatus === 'paid' ? 'Hutang berhasil dilunasi!' : 'Pembayaran cicilan berhasil dicatat.');
      setSelectedDebt(null);
      setPaymentAmount(0);
      setPaymentNote('Pembayaran cicilan');
    } catch (err) {
      console.error(err);
      toast.error('Terjadi kesalahan saat menyimpan pembayaran.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateHistoryNote = async (histId: string) => {
    if (!selectedDebt || !selectedDebt.id || !selectedDebt.paymentHistory) return;
    try {
      const updatedHistory = selectedDebt.paymentHistory.map((h, i) => {
        const id = h.id || i.toString();
        if (id === histId) {
          return { ...h, note: editNoteValue };
        }
        return h;
      });
      await updateDoc(doc(db, 'transactions', selectedDebt.id), {
        paymentHistory: updatedHistory
      });
      setSelectedDebt({ ...selectedDebt, paymentHistory: updatedHistory });
      setEditingNoteId(null);
      toast.success('Catatan berhasil diperbarui');
    } catch (err) {
      console.error(err);
      toast.error('Gagal memperbarui catatan');
    }
  };

  const handleShareSignatureLink = async (type: string, id: string) => {
    try {
      const collectionName = type === 'est' ? 'estimations' : 'transactions';
      await updateDoc(doc(db, collectionName, id), {
        isSignatureLinkActive: true
      });
      
      const url = `${window.location.origin}/sign?type=${type}&id=${id}`;
      if (navigator.share) {
        await navigator.share({
          title: 'Form Tanda Tangan',
          text: 'Silakan klik link berikut untuk menandatangani dokumen Anda:',
          url: url,
        });
      } else {
        navigator.clipboard.writeText(url);
        toast.success('Link disalin ke clipboard!');
      }
    } catch (err) {
      console.error('Error sharing/activating:', err);
      toast.error('Gagal mengaktifkan link tanda tangan');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-3 uppercase tracking-wider">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-500">
              <BookOpen size={20} />
            </div>
            Daftar Piutang
          </h1>
          <p className="text-xs text-app-text-muted font-bold tracking-widest uppercase mt-1">Kelola hutang pelanggan & cicilan</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-surface border border-app-border p-6 rounded-3xl relative overflow-hidden">
           <div className="absolute top-0 right-0 p-6 opacity-10">
             <TrendingDown size={60} className="text-rose-500" />
           </div>
           <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1">Total Piutang Berjalan</p>
           <h2 className="text-3xl font-black text-rose-500">{formatCurrency(totalUnpaid)}</h2>
        </div>
        <div className="bg-surface border border-app-border p-6 rounded-3xl relative overflow-hidden">
           <div className="absolute top-0 right-0 p-6 opacity-10">
             <CheckCircle2 size={60} className="text-emerald-500" />
           </div>
           <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-1">Total Lunas (Record)</p>
           <h2 className="text-3xl font-black text-emerald-500">{formatCurrency(totalPaid)}</h2>
        </div>
      </div>

      <div className="bg-surface border border-app-border rounded-[2rem] p-6 shadow-xl shadow-black/10">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-muted w-4 h-4" />
            <input 
              type="text" 
              placeholder="Cari nama pelanggan atau ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-background border border-app-border rounded-xl text-xs font-bold text-foreground focus:outline-none focus:border-accent transition-all"
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex bg-background border border-app-border rounded-xl p-1 overflow-x-auto w-full md:w-auto">
              {(['all', 'unpaid', 'paid'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all whitespace-nowrap ${
                    filter === f 
                      ? 'bg-accent text-foreground shadow-lg shadow-accent/20' 
                      : 'text-app-text-muted hover:text-foreground'
                  }`}
                >
                  {f === 'all' ? 'Semua' : f === 'unpaid' ? 'Belum Lunas' : 'Lunas'}
                </button>
              ))}
            </div>
            <button 
                onClick={handleExport}
                className="p-3 bg-background border border-app-border rounded-xl text-app-text-muted hover:text-emerald-500 hover:border-emerald-500/30 transition-all active:scale-95 flex items-center justify-center h-[38px] w-[38px]"
                title="Export Excel"
            >
                <Download size={18} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-20 flex justify-center">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredDebts.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-background border border-app-border flex items-center justify-center mx-auto mb-4 text-app-text-muted">
              <BookOpen size={24} />
            </div>
            <p className="text-sm font-black text-foreground">Tidak ada data piutang ditemukan</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredDebts.map((debt) => {
              const currentPaid = debt.paidAmount ?? debt.cashReceived ?? 0;
              const remaining = debt.total - currentPaid;
              const isOverdue = debt.dueDate && new Date(debt.dueDate).setHours(0,0,0,0) < new Date().setHours(0,0,0,0) && debt.paymentStatus !== 'paid';
              
              return (
                <div key={debt.id} className="bg-background border border-app-border rounded-2xl p-5 hover:border-accent/40 transition-all group">
                  <div className="flex justify-between items-start mb-3">
                     <div>
                        <div className="flex items-center gap-2 mb-1">
                           <User size={14} className="text-accent" />
                           <h3 className="font-black text-foreground text-sm uppercase">{debt.customerName || 'Pelanggan Anonim'}</h3>
                        </div>
                        <p className="text-[9px] text-app-text-muted font-mono">{debt.id}</p>
                     </div>
                     <span className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest ${
                       debt.paymentStatus === 'paid' ? 'bg-emerald-500/10 text-emerald-500' :
                       debt.paymentStatus === 'partially_paid' ? 'bg-amber-500/10 text-amber-500' :
                       'bg-rose-500/10 text-rose-500'
                     }`}>
                       {debt.paymentStatus === 'paid' ? 'Lunas' : debt.paymentStatus === 'partially_paid' ? 'Dicicil' : 'Belum Bayar'}
                     </span>
                  </div>

                  <div className="space-y-4 mb-4">
                     <div className="bg-surface p-3 rounded-xl border border-app-border flex justify-between items-center">
                        <span className="text-[10px] font-bold text-app-text-muted uppercase">Total Transaksi</span>
                        <span className="text-xs font-black text-foreground">{formatCurrency(debt.total)}</span>
                     </div>
                     
                     <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-app-text-muted uppercase">Sisa Tagihan</span>
                        <span className={`text-sm font-black ${remaining > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {remaining > 0 ? formatCurrency(remaining) : 'Rp 0'}
                        </span>
                     </div>

                     {debt.dueDate && debt.paymentStatus !== 'paid' && (
                        <div className="flex items-center gap-2 text-[10px] font-bold">
                           <Calendar size={12} className={isOverdue ? "text-rose-500" : "text-app-text-muted"} />
                           <span className={isOverdue ? "text-rose-500" : "text-app-text-muted"}>
                             Jatuh Tempo: {formatDate(debt.dueDate)}
                           </span>
                           {isOverdue && <span className="bg-rose-500 text-white px-1.5 py-0.5 rounded text-[8px] ml-1">LEWAT</span>}
                        </div>
                     )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <button 
                       onClick={() => {
                         setSelectedDebt(debt);
                         setPaymentAmount(remaining > 0 ? remaining : 0);
                       }}
                       className="w-full py-3 bg-surface border border-app-border text-foreground text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-accent hover:border-accent hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                       Rincian & Pembayaran <ChevronRight size={14} />
                    </button>
                    <button
                      onClick={() => debt.id && handleShareSignatureLink('deb', debt.id)}
                      className="w-full py-3 bg-accent/10 border border-accent/20 text-accent text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-accent hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                      <Share2 size={14} /> Bagikan Link TTD
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {selectedDebt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-surface border border-app-border rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-app-border flex justify-between items-center shrink-0">
                 <div>
                   <h2 className="text-lg font-black text-foreground uppercase tracking-wider">Rincian Piutang</h2>
                   <p className="text-[10px] font-bold text-app-text-muted">A.n {selectedDebt.customerName}</p>
                 </div>
                 <button onClick={() => setSelectedDebt(null)} className="w-8 h-8 flex items-center justify-center bg-background rounded-full text-app-text-muted hover:text-foreground border border-app-border">
                    <X size={16} />
                 </button>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-6">
                 {/* Top Summary */}
                 <div className="flex gap-4">
                    <div className="flex-1 bg-background border border-app-border p-4 rounded-2xl text-center">
                       <p className="text-[9px] font-black text-app-text-muted uppercase tracking-widest mb-1">Total Transaksi</p>
                       <p className="text-sm font-black text-foreground">{formatCurrency(selectedDebt.total)}</p>
                    </div>
                    <div className="flex-1 bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl text-center">
                       <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1">Sisa Hutang</p>
                       <p className="text-sm font-black text-rose-500">
                         {formatCurrency(selectedDebt.total - (selectedDebt.paidAmount ?? selectedDebt.cashReceived ?? 0))}
                       </p>
                    </div>
                 </div>

                 {/* Items */}
                 <div>
                   <h4 className="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-3 border-b border-app-border pb-2">Item Terbeli</h4>
                   <div className="space-y-2">
                      {selectedDebt.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs font-bold text-foreground bg-background p-2 rounded-lg">
                           <span>{item.qty}x {item.productName}</span>
                           <span>{formatCurrency(item.subtotal)}</span>
                        </div>
                      ))}
                   </div>
                 </div>

                 {/* Payment History Log */}
                 {selectedDebt.paymentHistory && selectedDebt.paymentHistory.length > 0 && (
                   <div>
                     <h4 className="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-3 border-b border-app-border pb-2 flex items-center gap-2">
                       <History size={12} /> Riwayat Cicilan
                     </h4>
                     <div className="space-y-2">
                         {selectedDebt.paymentHistory.map((hist, i) => {
                           const currentHistId = hist.id || i.toString();
                           return (
                          <div key={currentHistId} className="flex justify-between items-center text-[10px] bg-background border border-app-border p-3 rounded-xl">
                             <div className="space-y-1">
                               {editingNoteId === currentHistId ? (
                                  <div className="flex items-center gap-1 mb-1">
                                    <input 
                                      autoFocus
                                      value={editNoteValue}
                                      onChange={(e) => setEditNoteValue(e.target.value)}
                                      className="bg-surface border border-app-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-accent w-32"
                                      placeholder="Catatan..."
                                    />
                                    <button onClick={() => handleUpdateHistoryNote(currentHistId)} className="text-emerald-500 bg-emerald-500/10 p-1 rounded hover:bg-emerald-500 hover:text-white transition-colors"><CheckCircle2 size={12}/></button>
                                    <button onClick={() => setEditingNoteId(null)} className="text-rose-500 bg-rose-500/10 p-1 rounded hover:bg-rose-500 hover:text-white transition-colors"><X size={12}/></button>
                                  </div>
                               ) : (
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="font-bold text-foreground text-xs">{hist.note || 'Pembayaran cicilan'}</p>
                                    <button onClick={() => { setEditingNoteId(currentHistId); setEditNoteValue(hist.note || 'Pembayaran cicilan'); }} className="text-accent hover:text-accent-hover opacity-60 hover:opacity-100 transition-opacity p-0.5">
                                      <Edit2 size={10} />
                                    </button>
                                  </div>
                               )}
                               <p className="text-app-text-muted">{formatDate(hist.date)} • Oleh: {hist.cashierName?.includes('@') ? hist.cashierName.split('@')[0] : (hist.cashierName || 'Kasir')}</p>
                             </div>
                             <span className="font-black text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">
                               +{formatCurrency(hist.amount)}
                             </span>
                          </div>
                         )})}
                     </div>
                   </div>
                 )}

                  {/* Action Panel */}
                  <div className="pt-4 border-t border-app-border space-y-4">
                     {/* PRINT ACTIONS */}
                     <div className="grid grid-cols-2 gap-3 mb-2">
                        <button 
                          onClick={() => window.open(`/invoice?id=${selectedDebt.id}`, '_blank')}
                          className="py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-emerald-500 hover:text-white transition-all group"
                        >
                           <Printer size={18} className="group-hover:scale-110 transition-transform" />
                           <span className="text-[9px] font-black uppercase tracking-widest">Cetak A4</span>
                        </button>
                        <button 
                          onClick={() => printReceipt(selectedDebt, storeSettings, branding)}
                          className="py-3 bg-slate-500/10 border border-slate-500/20 text-slate-600 rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-slate-700 hover:text-white transition-all group"
                        >
                           <Printer size={18} className="group-hover:scale-110 transition-transform" />
                           <span className="text-[9px] font-black uppercase tracking-widest">Struk Thermal</span>
                        </button>
                     </div>

                     {selectedDebt.paymentStatus !== 'paid' && (
                        <form onSubmit={handlePayInstallment} className="space-y-4">
                           <div>
                             <label className="block text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1 mb-2">Masukkan Nominal Pembayaran</label>
                             <div className="relative mb-3">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground font-black text-sm">Rp</span>
                                <input 
                                  type="number"
                                  required
                                  min="1"
                                  value={paymentAmount || ''}
                                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                                  className="w-full pl-12 pr-4 py-4 bg-background border border-app-border rounded-xl text-lg font-black text-foreground focus:outline-none focus:border-accent"
                                />
                             </div>
                             <div className="relative mb-2">
                                <input 
                                  type="text"
                                  value={paymentNote}
                                  onChange={(e) => setPaymentNote(e.target.value)}
                                  placeholder="Catatan pembayaran (opsional)"
                                  className="w-full px-4 py-3 bg-background border border-app-border rounded-xl text-xs font-bold text-foreground focus:outline-none focus:border-accent"
                                />
                             </div>
                             <div className="flex gap-2 mt-2">
                                <button type="button" onClick={() => setPaymentAmount(selectedDebt.total - (selectedDebt.paidAmount ?? selectedDebt.cashReceived ?? 0))} className="px-3 py-1 bg-accent/10 text-accent rounded text-[10px] font-bold">Bayar Lunas</button>
                                <button type="button" onClick={() => setPaymentAmount(50000)} className="px-3 py-1 bg-surface border border-app-border rounded text-[10px] font-bold">+50Rb</button>
                                <button type="button" onClick={() => setPaymentAmount(100000)} className="px-3 py-1 bg-surface border border-app-border rounded text-[10px] font-bold">+100Rb</button>
                             </div>
                           </div>
                           
                           <button 
                             type="submit"
                             disabled={isSubmitting}
                             className="w-full py-4 bg-accent hover:bg-accent-hover text-white rounded-xl font-black text-xs uppercase tracking-widest disabled:opacity-50 transition-all flex justify-center items-center gap-2 shadow-lg shadow-accent/20"
                           >
                             {isSubmitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Plus size={16} />}
                             Simpan Pembayaran
                           </button>
                        </form>
                     )}
                  </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
