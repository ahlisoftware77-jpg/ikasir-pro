'use client';

import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, doc, getDoc, where, deleteDoc, updateDoc, writeBatch, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth';
import { ShoppingCart, Calendar, Search, Loader2, Eye, X, ReceiptText, Printer, MessageCircle, Truck, Trash2, PenTool, Share2, PenLine, Plus, Minus, Save, ShieldCheck, ArrowUpDown } from 'lucide-react';
import { Transaction } from '@/types';
import { printReceipt } from '@/lib/printReceipt';
import toast from 'react-hot-toast';
import { useBranding } from '@/context/BrandingContext';
import { CheckCircle2 } from 'lucide-react';

export default function TransactionsPage() {
  const { storeId } = useAuthStore();
  const { branding } = useBranding();
  const [viewingReceipt, setViewingReceipt] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTrx, setSelectedTrx] = useState<Transaction | null>(null);
  const [storeSettings, setStoreSettings] = useState<any>({});
  const [filterDate, setFilterDate] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editTrxData, setEditTrxData] = useState<Transaction | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    if (!storeId) return;

    // Requires a composite index for ordering by timestamp if deployed, but fine for local
    const q = query(
      collection(db, 'transactions'), 
      where('storeId', '==', storeId),
      orderBy('timestamp', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const trxs: Transaction[] = [];
      snapshot.forEach((doc) => {
        trxs.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      setTransactions(trxs);
      setIsLoading(false);
    });

    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', `store_${storeId}`));
        if (docSnap.exists()) {
          setStoreSettings(docSnap.data());
        }
      } catch(err) {
        console.error(err);
      }
    };
    fetchSettings();

    return () => unsubscribe();
  }, [storeId]);

  // --- ANDROID BACK BUTTON SUPPORT ---
  useEffect(() => {
    if (selectedTrx || viewingReceipt) {
      window.history.pushState({ modal: true }, '');
    }

    const handlePopState = () => {
      if (viewingReceipt) {
        setViewingReceipt(null);
      } else if (selectedTrx) {
        setSelectedTrx(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [!!selectedTrx, !!viewingReceipt]);
  // -----------------------------------

  const filtered = transactions.filter(t => {
    const matchSearch = t.id?.toLowerCase().includes(search.toLowerCase()) || 
                        t.cashierName?.toLowerCase().includes(search.toLowerCase());
    
    if (!filterDate) return matchSearch;

    let trxDateStr = '';
    if (t.timestamp?.toDate) {
      const dateObj = t.timestamp.toDate();
      const tzOffset = dateObj.getTimezoneOffset() * 60000;
      trxDateStr = new Date(dateObj.getTime() - tzOffset).toISOString().split('T')[0];
    }
    
    return matchSearch && trxDateStr === filterDate;
  });

  const sortedTransactions = [...filtered].sort((a, b) => {
    const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime();
    const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime();
    return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
  });

  const handleSendWA = async (trx: any) => {
    if (!trx.customerId) {
        toast.error("Nomor WhatsApp tidak diketahui karena tidak ada data Pelanggan yang ditautkan pada Kasir sebelumnya.");
        return;
    }
    
    try {
        const custDoc = await getDoc(doc(db, 'customers', trx.customerId));
        if (!custDoc.exists()) {
             toast.error("Data pelanggan tidak ditemukan!");
             return;
        }
        
        const customerData = custDoc.data();
        if (!customerData.phone) {
             toast.error(`Pelanggan "${customerData.name}" belum mencantumkan nomor telepon / WA pada sistem.`);
             return;
        }

        let phone = customerData.phone.replace(/\D/g, '');
        if (phone.startsWith('0')) {
             phone = '62' + phone.substring(1);
        }

        const paid = trx.paidAmount || 0;
        const total = trx.total || 0;
        const sisa = Math.max(0, total - paid);
        const dDate = trx.dueDate ? new Date(trx.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';
        const trxId = trx.id?.substring(0, 8);

        let text = storeSettings?.waTemplate || 'Halo *{customerName}*,\n\nKami dari *{storeName}* ingin menyampaikan rincian tagihan pesanan Anda (Ref: *#{trxId}*)\n\nTotal Tagihan: *{total}*\nTelah Dibayar: {paid}\nSisa Piutang : *{debt}*\nJatuh Tempo  : *{dueDate}*\n\nMohon dapat melakukan pelunasan sisa tagihan sebelum jatuh tempo. Terima kasih!';

        text = text.replace(/{customerName}/g, customerData.name)
                  .replace(/{trxId}/g, trxId)
                  .replace(/{total}/g, `Rp ${total.toLocaleString('id-ID')}`)
                  .replace(/{paid}/g, `Rp ${paid.toLocaleString('id-ID')}`)
                  .replace(/{debt}/g, `Rp ${sisa.toLocaleString('id-ID')}`)
                  .replace(/{dueDate}/g, dDate)
                  .replace(/{storeName}/g, storeSettings?.storeName || 'Toko Kami');

        const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
        window.open(waUrl, '_blank');
    } catch (err) {
        console.error("Gagal mengambil kontak WhatsApp: ", err);
        toast.error("Terjadi kesalahan saat memproses kontak.");
    }
  };

  const handleDeleteTrx = async (trxId: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus transaksi ini? Data yang dihapus tidak dapat dikembalikan.')) return;
    
    try {
      await deleteDoc(doc(db, 'transactions', trxId));
      toast.success('Transaksi berhasil dihapus');
      if (selectedTrx?.id === trxId) {
        setSelectedTrx(null);
      }
    } catch (error) {
      console.error(error);
      toast.error('Gagal menghapus transaksi');
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

  const handleSaveEdit = async () => {
    if (!editTrxData || !selectedTrx) return;
    setIsSaving(true);
    
    try {
      const batch = writeBatch(db);
      const trxRef = doc(db, 'transactions', selectedTrx.id!);
      
      // 1. Recalculate Totals
      const newSubtotal = editTrxData.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
      const taxRate = storeSettings?.taxRate || 0;
      const newTax = editTrxData.tax ? Math.round(newSubtotal * (taxRate / 100)) : 0;
      const newTotal = newSubtotal + newTax;
      
      const updatedData: any = {
        ...editTrxData,
        subtotal: newSubtotal,
        tax: newTax,
        total: newTotal,
        updatedAt: new Date().toISOString()
      };

      // Handle Debt Recalculation
      if (updatedData.paymentCategory === 'debt') {
        const paid = updatedData.paidAmount || 0;
        updatedData.debtAmount = Math.max(0, newTotal - paid);
        updatedData.paymentStatus = paid >= newTotal ? 'paid' : (paid > 0 ? 'partially_paid' : 'unpaid');
      } else if (updatedData.paymentStatus === 'paid') {
        updatedData.paidAmount = newTotal;
        updatedData.debtAmount = 0;
      }

      // 2. Stock Adjustments
      const oldItems = selectedTrx.items || [];
      const newItems = editTrxData.items || [];
      const stockChanges: Record<string, number> = {};

      oldItems.forEach(item => {
        if (item.productId && item.productId !== 'manual') {
          stockChanges[item.productId] = (stockChanges[item.productId] || 0) + item.qty;
        }
      });

      newItems.forEach(item => {
        if (item.productId && item.productId !== 'manual') {
          stockChanges[item.productId] = (stockChanges[item.productId] || 0) - item.qty;
        }
      });

      for (const [productId, change] of Object.entries(stockChanges)) {
        if (change !== 0) {
          const prodRef = doc(db, 'products', productId);
          batch.update(prodRef, {
            stock: increment(change)
          });
        }
      }

      batch.set(trxRef, updatedData, { merge: true });
      await batch.commit();
      
      toast.success('Transaksi berhasil diperbarui');
      setIsEditing(false);
      setSelectedTrx(updatedData);
    } catch (err) {
      console.error('Error updating transaction:', err);
      toast.error('Gagal memperbarui transaksi');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClaimWarranty = (item: any, trx: Transaction) => {
    if (!item.warrantyExpiry) return;
    
    const isExpired = new Date(item.warrantyExpiry) < new Date();
    
    if (isExpired) {
      toast.error(`Klaim Ditolak: Masa garansi untuk ${item.productName} telah berakhir pada ${new Date(item.warrantyExpiry).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}.`, {
        duration: 5000,
        icon: '⚠️'
      });
    } else {
      toast.success(`Klaim Valid: Produk ${item.productName} masih dalam masa garansi hingga ${new Date(item.warrantyExpiry).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}. Silakan proses perbaikan/penggantian.`, {
        duration: 5000,
        icon: '✅'
      });
    }
  };

  return (
    <div className="space-y-6 relative animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">Riwayat Transaksi</h1>
          <p className="text-xs md:text-sm text-app-text-muted mt-1 font-medium">Pantau aktivitas penjualan real-time</p>
        </div>
      </div>

      <div className="bg-surface border border-app-border rounded-3xl overflow-hidden shadow-xl shadow-black/5 transition-colors duration-300">
        <div className="p-4 md:p-6 border-b border-app-border flex flex-col sm:flex-row gap-4 items-center justify-between bg-background/30">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-muted" size={18} />
            <input 
              type="text" 
              placeholder="Cari transaksi..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-background border border-app-border rounded-2xl text-foreground font-bold focus:outline-none focus:border-accent transition-all text-sm"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
             <div className="relative flex w-full sm:w-auto">
                <button 
                   onClick={(e) => {
                      const inputElement = e.currentTarget.nextElementSibling as HTMLInputElement;
                      if (inputElement && inputElement.showPicker) {
                         inputElement.showPicker();
                      }
                   }}
                   className="w-full sm:w-auto flex items-center justify-center gap-2 bg-surface hover:bg-background text-foreground px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-app-border shadow-sm transition-all shrink-0 cursor-pointer"
                >
                   <Calendar size={16} className="text-accent shrink-0" /> 
                   <span className="sm:hidden md:inline">
                      {filterDate || 'Filter Tanggal'}
                   </span>
                   <span className="hidden sm:inline md:hidden">
                      {filterDate || 'Filter'}
                   </span>
                </button>
                <input 
                   type="date"
                   value={filterDate}
                   onChange={e => setFilterDate(e.target.value)}
                   className="absolute w-0 h-0 opacity-0 pointer-events-none"
                />
             </div>
             {filterDate && (
                <button 
                  onClick={() => setFilterDate('')}
                  className="px-4 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 rounded-2xl transition-all"
                  title="Hapus Filter Tanggal"
                >
                  <X size={16} />
                </button>
             )}
             <button 
                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="flex items-center justify-center gap-2 bg-surface hover:bg-background text-foreground px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-app-border shadow-sm transition-all shrink-0 cursor-pointer"
                title={sortOrder === 'desc' ? "Urutkan: Baru ke Lama" : "Urutkan: Lama ke Baru"}
             >
                <ArrowUpDown size={14} className="text-accent shrink-0" />
                <span>{sortOrder === 'desc' ? 'Baru' : 'Lama'}</span>
             </button>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-hidden">
          {/* Desktop View */}
          <table className="w-full text-left border-collapse hidden md:table">
            <thead>
              <tr className="bg-background/50 text-app-text-muted text-[10px] font-black uppercase tracking-[0.2em]">
                <th className="p-6">ID Trx</th>
                <th className="p-6">Waktu</th>
                <th className="p-6">Pelanggan</th>
                <th className="p-6">Kasir</th>
                <th className="p-6">Item</th>
                <th className="p-6">Metode</th>
                <th className="p-6 text-right">Total</th>
                <th className="p-6 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/30">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-20 text-center text-app-text-muted">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-accent" />
                    <p className="font-bold animate-pulse">Sinkronisasi data...</p>
                  </td>
                </tr>
              ) : sortedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-20 text-center text-app-text-muted">
                    <ShoppingCart className="w-16 h-16 opacity-10 mx-auto mb-4" />
                    <p className="font-bold italic">Data transaksi tidak ditemukan</p>
                  </td>
                </tr>
              ) : (
                sortedTransactions.map(trx => {
                  const date = trx.timestamp?.toDate ? trx.timestamp.toDate() : new Date();
                  return (
                    <tr key={trx.id} className="hover:bg-background/30 transition-colors group">
                      <td className="p-6 text-foreground font-mono text-xs max-w-[120px] truncate" title={trx.id}>
                         <span className="text-accent opacity-50 group-hover:opacity-100 transition-opacity">#</span>{trx.id?.substring(0,12)}
                      </td>
                      <td className="p-6">
                        <p className="text-foreground font-bold text-sm tracking-tight">{date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        <p className="text-[10px] text-app-text-muted font-black uppercase tracking-widest mt-0.5">{date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':')}</p>
                      </td>
                      <td className="p-6 text-foreground font-bold text-sm tracking-tight">
                         {trx.customerName || 'Umum'}
                      </td>
                      <td className="p-6">
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center text-[10px] font-black text-accent shrink-0">
                               {(trx.cashierName || 'Online (Sistem)').substring(0,2).toUpperCase()}
                            </div>
                            <span className="text-foreground font-bold text-sm truncate">{(trx.cashierName || 'Online (Sistem)').split('@')[0]}</span>
                         </div>
                      </td>
                      <td className="p-6 text-app-text-muted text-sm font-medium">{trx.items?.length || 0} Barang</td>
                      <td className="p-6">
                        <span className="px-3 py-1 bg-background border border-app-border text-foreground rounded-md text-[10px] font-black uppercase tracking-tighter shadow-sm">{trx.paymentMethod || trx.paymentCategory}</span>
                      </td>
                      <td className="p-6 text-emerald-400 font-black text-right text-base">Rp {trx.total?.toLocaleString('id-ID')}</td>
                      <td className="p-6 text-center">
                        <div className="flex justify-center gap-2">
                          <button 
                            onClick={() => setSelectedTrx(trx)}
                            className="p-3 bg-surface border border-app-border hover:border-accent hover:text-accent text-app-text-muted rounded-xl transition-all inline-flex shadow-sm active:scale-90"
                            title="Cetak / Lihat Rincian"
                          >
                            <Printer size={18} />
                          </button>
                          <button 
                            onClick={() => {
                               setSelectedTrx(trx);
                               setIsEditing(true);
                               setEditTrxData(JSON.parse(JSON.stringify(trx))); // Deep copy
                            }}
                            className="p-3 bg-surface border border-app-border hover:border-blue-500 hover:text-blue-500 text-app-text-muted rounded-xl transition-all inline-flex shadow-sm active:scale-90"
                            title="Edit Transaksi"
                          >
                            <PenLine size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteTrx(trx.id!)}
                            className="p-3 bg-surface border border-app-border hover:border-rose-500 hover:text-rose-500 text-app-text-muted rounded-xl transition-all inline-flex shadow-sm active:scale-90"
                            title="Hapus Transaksi"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>

          {/* Mobile View */}
          <div className="md:hidden divide-y divide-app-border">
             {isLoading ? (
                <div className="p-20 text-center">
                   <Loader2 className="w-10 h-10 animate-spin text-accent mx-auto mb-4" />
                   <p className="text-app-text-muted font-black animate-pulse">Sync data...</p>
                </div>
             ) : sortedTransactions.length === 0 ? (
                <div className="p-20 text-center text-app-text-muted italic">
                   Transaksi tidak ditemukan
                </div>
             ) : (
                sortedTransactions.map(trx => {
                   const date = trx.timestamp?.toDate ? trx.timestamp.toDate() : new Date();
                   return (
                      <button 
                        key={trx.id} 
                        onClick={() => setSelectedTrx(trx)}
                        className="w-full p-4 flex items-center justify-between hover:bg-accent/5 transition-colors text-left"
                      >
                         <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center gap-2 mb-1">
                               <span className="text-xs font-mono text-accent">#{trx.id?.substring(0,8)}</span>
                               <span className="px-2 py-0.5 bg-background border border-app-border rounded-md text-[8px] font-black uppercase text-app-text-muted">{trx.paymentMethod || trx.paymentCategory}</span>
                            </div>
                            <h4 className="font-bold text-foreground text-sm truncate">{trx.customerName || 'Umum'} <span className="text-[10px] text-app-text-muted font-medium">• Kasir: {(trx.cashierName || 'Online (Sistem)').split('@')[0]}</span></h4>
                            <p className="text-[10px] text-app-text-muted mt-1">
                               {date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} • {date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':')}
                            </p>
                         </div>
                         <div className="text-right shrink-0">
                            <p className="text-emerald-400 font-black">Rp {trx.total?.toLocaleString('id-ID')}</p>
                            <p className="text-[10px] text-app-text-muted">{trx.items?.length} item</p>
                         </div>
                      </button>
                   )
                })
             )}
          </div>
        </div>
      </div>

      {/* MODAL RINCIAN TRANSAKSI */}
      {selectedTrx && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-surface border-t md:border border-app-border rounded-t-xl md:rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col h-full md:h-auto md:max-h-[90vh] animate-in slide-in-from-bottom md:zoom-in-95 duration-300">
            <div className="p-6 md:p-8 border-b border-app-border flex items-center justify-between bg-background/30">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-foreground flex items-center gap-3">
                  <div className="p-2 bg-accent/20 rounded-xl">
                    <ReceiptText className="text-accent" size={24} />
                  </div>
                  Rincian Transaksi
                </h2>
                <p className="text-app-text-muted text-[10px] mt-2 font-black uppercase tracking-[0.2em]">{selectedTrx.id}</p>
              </div>
              <div className="flex items-center gap-2">
                {!isEditing && (
                  <button 
                    onClick={() => {
                      setIsEditing(true);
                      setEditTrxData(JSON.parse(JSON.stringify(selectedTrx)));
                    }} 
                    className="text-app-text-muted hover:text-blue-500 transition-colors p-2 hover:bg-blue-500/10 rounded-lg border border-transparent hover:border-blue-500/20" 
                    title="Edit Transaksi"
                  >
                    <PenLine size={24} />
                  </button>
                )}
                <button onClick={() => handleDeleteTrx(selectedTrx.id!)} className="text-app-text-muted hover:text-rose-500 transition-colors p-2 hover:bg-rose-500/10 rounded-lg border border-transparent hover:border-rose-500/20" title="Hapus Transaksi">
                  <Trash2 size={24} />
                </button>
                <button 
                  onClick={() => {
                    setSelectedTrx(null);
                    setIsEditing(false);
                    setEditTrxData(null);
                  }} 
                  className="text-app-text-muted hover:text-rose-500 transition-colors p-2 hover:bg-background rounded-lg border border-transparent hover:border-app-border" 
                  title="Tutup"
                >
                  <X size={28} />
                </button>
              </div>
            </div>
            
            <div className="p-6 md:p-10 overflow-y-auto flex-1 bg-surface">
              {isEditing && editTrxData ? (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Nama Pelanggan</label>
                      <input 
                        type="text"
                        value={editTrxData.customerName}
                        onChange={e => setEditTrxData({...editTrxData, customerName: e.target.value})}
                        className="w-full bg-background border border-app-border rounded-2xl p-4 text-sm font-bold focus:outline-none focus:border-accent transition-all"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Metode</label>
                        <select 
                          value={editTrxData.paymentMethod || ''}
                          onChange={e => setEditTrxData({...editTrxData, paymentMethod: e.target.value as any})}
                          className="w-full bg-background border border-app-border rounded-2xl p-4 text-sm font-bold focus:outline-none focus:border-accent transition-all appearance-none"
                        >
                          <option value="cash">Tunai (Cash)</option>
                          <option value="transfer">Transfer Bank</option>
                          <option value="qris">QRIS</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Kategori</label>
                        <select 
                          value={editTrxData.paymentCategory || ''}
                          onChange={e => setEditTrxData({...editTrxData, paymentCategory: e.target.value as any})}
                          className="w-full bg-background border border-app-border rounded-2xl p-4 text-sm font-bold focus:outline-none focus:border-accent transition-all appearance-none"
                        >
                          <option value="direct">Langsung (Lunas)</option>
                          <option value="debt">Piutang (Hutang)</option>
                        </select>
                      </div>
                    </div>

                    {editTrxData.paymentCategory === 'debt' && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Telah Dibayar (DP/Cicilan)</label>
                        <input 
                          type="number"
                          value={editTrxData.paidAmount || 0}
                          onChange={e => setEditTrxData({...editTrxData, paidAmount: Number(e.target.value)})}
                          className="w-full bg-background border border-app-border rounded-2xl p-4 text-sm font-bold focus:outline-none focus:border-accent transition-all"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-app-text-muted uppercase tracking-[0.3em] border-b border-app-border pb-2">Edit Item</h3>
                    <div className="space-y-4">
                      {editTrxData.items.map((item, idx) => (
                        <div key={idx} className="p-4 bg-background border border-app-border rounded-2xl space-y-3 relative group">
                          <button 
                            onClick={() => {
                              const newItems = [...editTrxData.items];
                              newItems.splice(idx, 1);
                              setEditTrxData({...editTrxData, items: newItems});
                            }}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={14} />
                          </button>
                          <p className="text-xs font-black text-foreground truncate pr-6">{item.productName}</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <p className="text-[9px] font-bold text-app-text-muted uppercase ml-1">Harga Satuan</p>
                              <input 
                                type="number"
                                value={item.price}
                                onChange={e => {
                                  const newItems = [...editTrxData.items];
                                  newItems[idx].price = Number(e.target.value);
                                  newItems[idx].subtotal = newItems[idx].price * newItems[idx].qty;
                                  setEditTrxData({...editTrxData, items: newItems});
                                }}
                                className="w-full bg-surface border border-app-border rounded-xl p-2 text-xs font-bold focus:outline-none focus:border-accent"
                              />
                            </div>
                            <div className="space-y-1">
                              <p className="text-[9px] font-bold text-app-text-muted uppercase ml-1">Jumlah (Qty)</p>
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => {
                                    const newItems = [...editTrxData.items];
                                    if (newItems[idx].qty > 1) {
                                      newItems[idx].qty -= 1;
                                      newItems[idx].subtotal = newItems[idx].price * newItems[idx].qty;
                                      setEditTrxData({...editTrxData, items: newItems});
                                    }
                                  }}
                                  className="w-8 h-8 bg-surface border border-app-border rounded-lg flex items-center justify-center hover:bg-accent/10"
                                >
                                  <Minus size={14} />
                                </button>
                                <span className="text-xs font-black w-8 text-center">{item.qty}</span>
                                <button 
                                  onClick={() => {
                                    const newItems = [...editTrxData.items];
                                    newItems[idx].qty += 1;
                                    newItems[idx].subtotal = newItems[idx].price * newItems[idx].qty;
                                    setEditTrxData({...editTrxData, items: newItems});
                                  }}
                                  className="w-8 h-8 bg-surface border border-app-border rounded-lg flex items-center justify-center hover:bg-accent/10"
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1">
                             <p className="text-[9px] font-bold text-app-text-muted uppercase ml-1">Catatan Item</p>
                             <input 
                                type="text"
                                value={item.note || ''}
                                onChange={e => {
                                   const newItems = [...editTrxData.items];
                                   newItems[idx].note = e.target.value;
                                   setEditTrxData({...editTrxData, items: newItems});
                                }}
                                placeholder="Tambahkan catatan..."
                                className="w-full bg-surface border border-app-border rounded-xl p-2 text-xs font-bold focus:outline-none focus:border-accent"
                             />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Pelanggan</p>
                      <p className="text-foreground font-bold text-base">{selectedTrx.customerName || 'Umum'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Operator Kasir</p>
                      <p className="text-foreground font-bold text-base">{(selectedTrx.cashierName || 'Online (Sistem)').split('@')[0]}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Metode / Status</p>
                      <div className="flex flex-wrap gap-2">
                        <span className="bg-accent/10 text-accent px-3 py-1 rounded-md text-[10px] font-black uppercase border border-accent/20 inline-block shadow-sm">{selectedTrx.paymentMethod || selectedTrx.paymentCategory}</span>
                        {(selectedTrx.orderType as string) === 'online' && <span className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-md text-[10px] font-black uppercase border border-emerald-500/20 inline-block shadow-sm">Online Order</span>}
                        {selectedTrx.paymentStatus === 'unpaid' && <span className="bg-rose-500/10 text-rose-500 px-3 py-1 rounded-md text-[10px] font-black uppercase border border-rose-500/20 inline-block shadow-sm">Belum Dibayar</span>}
                        {selectedTrx.paymentStatus === 'partially_paid' && <span className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded-md text-[10px] font-black uppercase border border-amber-500/20 inline-block shadow-sm">Dicicil</span>}
                        {selectedTrx.paymentStatus === 'paid' && <span className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-md text-[10px] font-black uppercase border border-emerald-500/20 inline-block shadow-sm">Lunas</span>}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Waktu Transaksi</p>
                      <p className="text-foreground font-bold">
                        {selectedTrx.timestamp?.toDate ? selectedTrx.timestamp.toDate().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' }).replace(/\./g, ':') : '-'}
                      </p>
                    </div>
                    {selectedTrx.dueDate && selectedTrx.paymentStatus !== 'paid' && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Jatuh Tempo</p>
                        <p className="text-rose-500 font-bold">
                          {new Date(selectedTrx.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    )}
                  </div>

                  <h3 className="text-xs font-black text-app-text-muted uppercase tracking-[0.3em] mb-4 border-b border-app-border pb-2">Daftar Belanja</h3>
                  <div className="space-y-5">
                    {selectedTrx.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start group">
                        <div className="flex-1 pr-6">
                          <p className="text-foreground font-bold text-sm group-hover:text-accent transition-colors">{item.productName}</p>
                          <p className="text-[11px] text-app-text-muted font-medium mt-0.5">{item.qty} x Rp {item.price?.toLocaleString('id-ID')}</p>
                          {item.note && (
                            <p className="mt-1 text-[11px] text-amber-500 italic bg-amber-500/10 px-2 py-1 rounded w-fit">
                              Catatan: {item.note}
                            </p>
                          )}
                          {item.selectedExtras && item.selectedExtras.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.selectedExtras.map((ext, eIdx) => (
                                <span key={eIdx} className="text-[9px] bg-background border border-app-border text-app-text-muted px-1.5 py-0.5 rounded">
                                  + {ext.optionName}
                                </span>
                              ))}
                            </div>
                          )}
                          {item.warrantyExpiry && (
                            <div className="mt-2 flex items-center gap-2">
                              <ShieldCheck size={14} className={new Date(item.warrantyExpiry) > new Date() ? "text-emerald-500" : "text-rose-500"} />
                              <span className={`text-[10px] font-black uppercase tracking-wider ${new Date(item.warrantyExpiry) > new Date() ? "text-emerald-500" : "text-rose-500"}`}>
                                Garansi {new Date(item.warrantyExpiry) > new Date() ? "Aktif" : "Habis"}
                                <span className="ml-1 opacity-70">
                                  • {new Date(item.warrantyExpiry).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'})}
                                </span>
                              </span>
                              <button 
                                onClick={() => handleClaimWarranty(item, selectedTrx)}
                                className="ml-auto text-[9px] bg-background border border-app-border hover:border-accent px-2 py-1 rounded font-black text-app-text-muted hover:text-accent transition-all"
                              >
                                CLAIM
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="text-foreground font-black text-sm tabular-nums">
                          Rp {item.subtotal?.toLocaleString('id-ID')}
                        </p>
                      </div>
                    ))}
                  </div>

                  {(selectedTrx as any).paymentHistory && (selectedTrx as any).paymentHistory.length > 0 && (
                    <div className="mt-8">
                      <h3 className="text-xs font-black text-app-text-muted uppercase tracking-[0.3em] mb-4 border-b border-app-border pb-2">Histori Pembayaran</h3>
                      <div className="space-y-3">
                        {(selectedTrx as any).paymentHistory.map((hist: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center bg-background p-3 rounded-2xl border border-app-border cursor-default hover:border-accent transition-colors">
                            <div>
                               <p className="text-xs font-black text-foreground">{hist.note}</p>
                               <p className="text-[9px] text-app-text-muted tracking-[0.2em] uppercase mt-1">
                                 {new Date(hist.date).toLocaleString('id-ID', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}).replace(/\./g, ':')}
                               </p>
                            </div>
                            <p className="text-sm font-black text-emerald-500">Rp {hist.amount?.toLocaleString('id-ID')}</p>
                          </div>
                        ))}
                        
                        <div className="bg-surface border border-app-border rounded-2xl p-4 mt-2 space-y-2">
                           <div className="flex justify-between items-center text-[10px] font-bold text-app-text-muted uppercase tracking-widest">
                              <span>Telah Terbayar</span>
                              <span className="text-sm font-black text-emerald-500">Rp {((selectedTrx as any).paidAmount || 0).toLocaleString('id-ID')}</span>
                           </div>
                           {selectedTrx.paymentStatus !== 'paid' && (
                              <div className="flex justify-between pt-2 border-t border-app-border/50 items-center">
                                 <span className="text-[10px] font-bold text-app-text-muted uppercase tracking-widest">Sisa Piutang</span>
                                 <span className="text-base font-black text-rose-500">Rp {Math.max(0, selectedTrx.total - ((selectedTrx as any).paidAmount || 0)).toLocaleString('id-ID')}</span>
                              </div>
                           )}
                        </div>
                      </div>
                    </div>
                  )}

                  {(selectedTrx as any).paymentProofUrl && (
                     <div className="mt-6 border-t border-app-border pt-4">
                        <h3 className="text-xs font-black text-app-text-muted uppercase tracking-[0.3em] mb-4">Bukti Pembayaran (Transfer/E-Wallet)</h3>
                        <div className="bg-background border border-app-border p-4 rounded-[20px] w-fit">
                           <a href={(selectedTrx as any).paymentProofUrl} target="_blank" rel="noopener noreferrer" className="block relative group overflow-hidden rounded-xl border border-app-border max-w-xs cursor-zoom-in">
                              <img src={(selectedTrx as any).paymentProofUrl} alt="Bukti Pembayaran" className="w-full h-auto max-h-60 object-contain mx-auto group-hover:scale-105 transition-transform" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                 <span className="text-[10px] font-black text-white uppercase tracking-widest">Buka Gambar Penuh</span>
                              </div>
                           </a>
                        </div>
                     </div>
                  )}
                </>
              )}
            </div>

            <div className="p-6 md:p-10 border-t border-app-border bg-background/50 space-y-3">
              <div className="flex justify-between text-xs font-bold text-app-text-muted uppercase tracking-widest">
                <span>Subtotal</span>
                <span className="text-foreground">Rp {(selectedTrx.total - (selectedTrx.tax || 0))?.toLocaleString('id-ID')}</span>
              </div>
              {selectedTrx.tax ? (
                <div className="flex justify-between text-xs font-bold text-app-text-muted uppercase tracking-widest">
                  <span>Pajak PPN</span>
                  <span className="text-foreground">Rp {selectedTrx.tax?.toLocaleString('id-ID')}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-xl font-black pt-5 border-t border-app-border mt-3">
                <span className="text-foreground tracking-tighter">TOTAL AKHIR</span>
                <span className="text-accent">Rp {selectedTrx.total?.toLocaleString('id-ID')}</span>
              </div>

              {selectedTrx.paymentMethod?.toLowerCase() === 'cash' && selectedTrx.cashReceived !== undefined && (
                <div className="pt-2 space-y-2 border-t border-app-border/50 mt-2">
                  <div className="flex justify-between text-[11px] font-bold text-app-text-muted uppercase tracking-widest">
                    <span>Tunai</span>
                    <span className="text-foreground">Rp {selectedTrx.cashReceived.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between text-xs font-black text-emerald-500 uppercase tracking-widest">
                    <span>Kembalian</span>
                    <span>Rp {selectedTrx.change?.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              )}
               <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-4 border-t border-app-border/30 max-w-2xl mx-auto">
                  {isEditing ? (
                    <>
                      <button 
                        onClick={() => {
                          setIsEditing(false);
                          setEditTrxData(null);
                        }}
                        disabled={isSaving}
                        className="flex items-center justify-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-500 py-4 px-2 rounded-xl font-black transition-all active:scale-95 text-[10px] uppercase disabled:opacity-50"
                      >
                        <X size={16} /> 
                        BATAL
                      </button>
                      <button 
                        onClick={handleSaveEdit}
                        disabled={isSaving}
                        className="col-span-1 md:col-span-2 flex items-center justify-center gap-2 bg-emerald-500 text-white py-4 px-2 rounded-xl font-black shadow-lg shadow-emerald-500/20 transition-all active:scale-95 text-[10px] uppercase disabled:opacity-50"
                      >
                        {isSaving ? <Loader2 className="animate-spin" size={16} /> : <><Save size={16} /> SIMPAN PERUBAHAN</>}
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={() => window.open('/invoice?id=' + selectedTrx.id, '_blank')}
                        className="flex items-center justify-center gap-2 bg-background border border-app-border hover:border-emerald-500 text-foreground py-3 px-2 rounded-xl font-black shadow-sm transition-all active:scale-95 text-[10px] uppercase group"
                      >
                        <Printer size={16} className="text-emerald-500 group-hover:scale-110 transition-transform" /> 
                        INVOICE
                      </button>

                      <button 
                        onClick={() => window.open('/delivery?id=' + selectedTrx.id, '_blank')}
                        className="flex items-center justify-center gap-2 bg-background border border-app-border hover:border-blue-500 text-foreground py-3 px-2 rounded-xl font-black shadow-sm transition-all active:scale-95 text-[10px] uppercase group"
                      >
                        <Truck size={16} className="text-blue-500 group-hover:scale-110 transition-transform" /> 
                        SURAT JALAN
                      </button>

                      <button 
                        onClick={() => selectedTrx.id && handleShareSignatureLink('trx', selectedTrx.id)}
                        className="flex items-center justify-center gap-2 bg-background border border-app-border hover:border-amber-500 text-foreground py-3 px-2 rounded-xl font-black shadow-sm transition-all active:scale-95 text-[10px] uppercase group"
                      >
                        <Share2 size={16} className="text-amber-500 group-hover:scale-110 transition-transform" /> 
                        BAGIKAN TTD
                      </button>

                      {selectedTrx.paymentStatus !== 'paid' ? (
                        <>
                          <button 
                            onClick={() => handleSendWA(selectedTrx)}
                            className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-3 px-2 rounded-xl font-black shadow-lg shadow-emerald-500/20 transition-all active:scale-95 text-[10px] uppercase group/wa"
                          >
                            <MessageCircle size={16} className="group/wa:rotate-12 transition-transform" />
                            INGATKAN WA
                          </button>
                          <button 
                            onClick={() => setViewingReceipt(selectedTrx)}
                            className="flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-foreground py-3 px-2 rounded-xl font-black shadow-lg shadow-accent/20 transition-all active:scale-95 text-[10px] uppercase"
                          >
                            <Printer size={16} /> 
                            CETAK STRUK
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={() => setViewingReceipt(selectedTrx)}
                          className="col-span-2 flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-foreground py-4 px-4 rounded-xl font-black shadow-lg shadow-accent/20 transition-all active:scale-95 text-xs uppercase"
                        >
                          <Printer size={20} /> 
                          CETAK STRUK THERMAL
                        </button>
                      )}
                    </>
                  )}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL STRUK DIGITAL */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                 <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2 italic">
                    <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
                       <CheckCircle2 size={18} />
                    </div>
                    Struk Digital
                 </h2>
                 <button onClick={() => setViewingReceipt(null)} className="p-2 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-xl transition-colors"><X size={20} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 font-mono text-[10px] space-y-6">
                 <div className="text-center space-y-2">
                    {storeSettings?.logoUrl && storeSettings?.showLogoOnReceipt !== false && <img src={storeSettings.logoUrl} alt="" className="w-12 h-12 mx-auto object-contain grayscale opacity-50 mb-2" />}
                    <h3 className="text-sm font-black uppercase text-slate-900">{storeSettings?.storeName || 'Toko Kami'}</h3>
                    {storeSettings?.showReceiptAddress !== false && <p className="text-slate-500 whitespace-pre-line">{storeSettings?.address}</p>}
                    {storeSettings?.showReceiptPhone !== false && <p className="text-slate-500">Telp: {storeSettings?.phone}</p>}
                    <div className="border-b border-dashed border-slate-300 pt-2"></div>
                 </div>

                 {/* Detail Transaksi */}
                 <div className="space-y-1 text-slate-600">
                    <div className="flex justify-between"><span>Nomor TRX</span><span className="font-bold text-slate-900">#{(viewingReceipt.id || "").toUpperCase()}</span></div>
                    <div className="flex justify-between"><span>Tanggal</span><span className="font-bold text-slate-900">{viewingReceipt.timestamp?.toDate ? viewingReceipt.timestamp.toDate().toLocaleString('id-ID').replace(/\./g, ':') : 'Baru saja'}</span></div>
                    {storeSettings?.showReceiptCustomer !== false && (
                      <div className="flex justify-between"><span>Pelanggan</span><span className="font-bold text-slate-900">{viewingReceipt.customerName || 'Umum'}</span></div>
                    )}
                    {storeSettings?.showReceiptCashier !== false && (
                      <div className="flex justify-between"><span>Kasir</span><span className="font-bold text-slate-900">{viewingReceipt.cashierName || 'Online'}</span></div>
                    )}
                    <div className="border-b border-dashed border-slate-300 pt-2"></div>
                 </div>

                 {/* List Item */}
                 <div className="space-y-4">
                    {viewingReceipt.items?.map((item: any, i: number) => (
                      <div key={i} className="space-y-1">
                         <div className="flex justify-between text-slate-900 font-bold uppercase">
                            <span className="flex-1 mr-4">{item.productName || item.name}</span>
                            <span>Rp {(item.subtotal || (item.price * (item.qty || item.cartQty)) || 0).toLocaleString('id-ID')}</span>
                         </div>
                         <div className="flex justify-between text-slate-500">
                            <span>{item.qty || item.cartQty} x {(item.price || 0).toLocaleString('id-ID')}</span>
                            <div className="flex flex-col items-end">
                               {item.note && <span className="text-[9px] italic">({item.note})</span>}
                               {item.warrantyExpiry && (
                                 <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded mt-0.5">
                                   🛡 Garansi s/d: {new Date(item.warrantyExpiry).toLocaleDateString('id-ID', {day: '2-digit', month: '2-digit', year: '2-digit'})}
                                 </span>
                               )}
                            </div>
                         </div>
                         {item.selectedExtras?.length > 0 && (
                           <div className="pl-2 border-l-2 border-slate-100 space-y-0.5">
                             {item.selectedExtras.map((ex: any, ei: number) => (
                               <div key={ei} className="flex justify-between text-[9px] text-slate-400">
                                 <span>+ {ex.optionName}</span>
                                 <span>Rp {(ex.price || 0).toLocaleString('id-ID')}</span>
                               </div>
                             ))}
                           </div>
                         )}
                      </div>
                    ))}
                    <div className="border-b border-dashed border-slate-300 pt-2"></div>
                 </div>

                 {/* Kalkulasi Akhir */}
                 <div className="space-y-2">
                    {storeSettings?.showReceiptSubtotal !== false && (
                      <div className="flex justify-between text-slate-600"><span>SUBTOTAL</span><span className="font-bold text-slate-900">Rp {(viewingReceipt.subtotal || viewingReceipt.total - (viewingReceipt.tax || 0) - (viewingReceipt.deliveryFee || 0)).toLocaleString('id-ID')}</span></div>
                    )}
                    {viewingReceipt.tax > 0 && (
                      <div className="flex justify-between text-slate-600"><span>PAJAK (PPN)</span><span className="font-bold text-slate-900">Rp {(viewingReceipt.tax || 0).toLocaleString('id-ID')}</span></div>
                    )}
                    {viewingReceipt.deliveryFee > 0 && (
                      <div className="flex justify-between text-slate-600"><span>ONGKIR</span><span className="font-bold text-slate-900">Rp {(viewingReceipt.deliveryFee || 0).toLocaleString('id-ID')}</span></div>
                    )}
                    <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                       <span>TOTAL</span>
                       <span>Rp {(viewingReceipt.total || 0).toLocaleString('id-ID')}</span>
                    </div>
                    {viewingReceipt.paymentStatus === 'paid' && (
                      <>
                        <div className="flex justify-between text-slate-600">
                           <span>{viewingReceipt.cashReceived ? 'UANG DITERIMA' : 'DIBAYAR'}</span>
                           <span className="font-bold text-emerald-600">Rp {(viewingReceipt.cashReceived || viewingReceipt.total || 0).toLocaleString('id-ID')}</span>
                        </div>
                        {viewingReceipt.change > 0 && (
                           <div className="flex justify-between text-slate-600">
                              <span>KEMBALIAN</span>
                              <span className="font-bold text-slate-900">Rp {(viewingReceipt.change || 0).toLocaleString('id-ID')}</span>
                           </div>
                        )}
                      </>
                    )}
                 </div>

                 <div className="text-center pt-6 space-y-1">
                    <p className="font-bold text-slate-900">{storeSettings?.receiptMessage || 'Terima Kasih Atas Kunjungan Anda'}</p>
                    {branding?.receiptWatermark && <p className="text-slate-400 uppercase tracking-widest mt-2 text-[8px]">{branding.receiptWatermark}</p>}
                 </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="p-4 bg-slate-50 flex gap-2 border-t border-slate-200 shrink-0">
                 <button 
                   onClick={() => setViewingReceipt(null)}
                   className="flex-1 py-4 font-bold text-slate-500 hover:bg-slate-200 bg-slate-200/50 rounded-2xl transition-colors"
                 >
                   Tutup
                 </button>
                 <button 
                   onClick={() => printReceipt(viewingReceipt, storeSettings, branding)}
                   className="flex-[2] py-4 bg-slate-900 hover:bg-black text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-slate-900/20 transition-all active:scale-95"
                 >
                   <Printer size={18} />CETAK KE PRINTER
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
