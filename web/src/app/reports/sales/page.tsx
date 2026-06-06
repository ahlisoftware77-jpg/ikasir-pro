'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, doc, getDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth';
import { ShoppingCart, TrendingUp, Loader2, Download, Filter, X, ReceiptText, Printer, MessageCircle, Truck } from 'lucide-react';
import { exportToExcel } from '@/lib/exportToExcel';
import { printReceipt } from '@/lib/printReceipt';
import toast from 'react-hot-toast';

export default function SalesReportPage() {
  const { storeId } = useAuthStore();
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filter States
  const [statusTab, setStatusTab] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [period, setPeriod] = useState<'all' | 'harian' | 'bulanan' | 'tahunan' | 'custom'>('all');
  
  // Custom Selection States
  const [selectedDate, setSelectedDate] = useState(() => {
     const tzOffset = (new Date()).getTimezoneOffset() * 60000;
     return (new Date(Date.now() - tzOffset)).toISOString().split('T')[0];
  });
  const [selectedMonth, setSelectedMonth] = useState(() => {
     const tzOffset = (new Date()).getTimezoneOffset() * 60000;
     return (new Date(Date.now() - tzOffset)).toISOString().slice(0, 7); // YYYY-MM
  });
  const [selectedYear, setSelectedYear] = useState(() => {
     return new Date().getFullYear().toString();
  });
  const [customDate, setCustomDate] = useState({ start: '', end: '' });

  // Detail Modal States
  const [selectedTrx, setSelectedTrx] = useState<any>(null);
  const [storeSettings, setStoreSettings] = useState<any>({});

  useEffect(() => {
    if (!storeId) return;

    const q = query(
      collection(db, 'transactions'), 
      where('storeId', '==', storeId),
      orderBy('timestamp', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
      setData(items);
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
    if (selectedTrx) {
      window.history.pushState({ modal: true }, '');
    }

    const handlePopState = () => {
      setSelectedTrx(null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [!!selectedTrx]);

  const handleManualClose = () => {
    if (window.history.state?.modal) {
      window.history.back();
    } else {
      setSelectedTrx(null);
    }
  };
  // -----------------------------------

  const filteredData = useMemo(() => {
    return data.filter(trx => {
      // 1. Status Filter
      if (statusTab === 'paid' && trx.paymentStatus !== 'paid') return false;
      if (statusTab === 'unpaid' && trx.paymentStatus === 'paid') return false;

      // 2. Period Filter
      if (period !== 'all') {
        if (!trx.timestamp?.toDate) return false;
        const tDate = trx.timestamp.toDate();

        if (period === 'harian') {
           if (!selectedDate) return true;
           const tStr = new Date(tDate.getTime() - (tDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
           if (tStr !== selectedDate) return false;
        }
        else if (period === 'bulanan') {
           if (!selectedMonth) return true;
           const [y, m] = selectedMonth.split('-');
           if (tDate.getFullYear().toString() !== y || (tDate.getMonth() + 1).toString().padStart(2, '0') !== m) return false;
        }
        else if (period === 'tahunan') {
           if (!selectedYear) return true;
           if (tDate.getFullYear().toString() !== selectedYear) return false;
        }
        else if (period === 'custom') {
           if (customDate.start) {
              const start = new Date(customDate.start);
              start.setHours(0,0,0,0);
              if (tDate < start) return false;
           }
           if (customDate.end) {
              const end = new Date(customDate.end);
              end.setHours(23,59,59,999);
              if (tDate > end) return false;
           }
        }
      }

      return true;
    });
  }, [data, statusTab, period, selectedDate, selectedMonth, selectedYear, customDate]);

  const totalSales = filteredData.reduce((sum, item) => sum + (item.total || 0), 0);
  const totalTrx = filteredData.length;

  const handleExport = () => {
    const formattedExcel = filteredData.map(trx => ({
      'Waktu': trx.timestamp?.toDate ? trx.timestamp.toDate().toLocaleString('id-ID') : '-',
      'ID Transaksi': trx.id,
      'Kasir': trx.cashierName?.split('@')[0],
      'Pelanggan': trx.customerName || 'Umum',
      'Tipe Pesanan': trx.orderType || 'STANDAR',
      'Metode Pembayaran': trx.paymentMethod || trx.paymentCategory,
      'Status': trx.paymentStatus === 'paid' ? 'LUNAS' : 'BELUM LUNAS',
      'Total Keseluruhan': trx.total || 0,
    }));
    exportToExcel(formattedExcel, `Laporan_Penjualan_${statusTab}_${period}`);
  };

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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">Laporan Penjualan</h1>
          <p className="text-sm text-app-text-muted mt-1 font-medium">Ringkasan transaksi penjualan dengan filter lanjutan</p>
        </div>
        <button 
          onClick={handleExport}
          disabled={filteredData.length === 0}
          className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-3 rounded-2xl font-black shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 text-sm"
        >
          <Download size={18} /> Export .xlsx
        </button>
      </div>

      {/* FILTER SECTION */}
      <div className="bg-surface border border-app-border rounded-3xl p-4 md:p-6 shadow-sm overflow-visible">
         <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
            
            {/* Status Tabs */}
            <div className="flex bg-background border border-app-border p-1.5 rounded-[20px] shrink-0 overflow-x-auto no-scrollbar max-w-full">
               <button 
                 onClick={() => setStatusTab('all')}
                 className={`flex-1 min-w-[90px] px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${statusTab === 'all' ? 'bg-surface text-foreground shadow-sm shadow-black/5' : 'text-app-text-muted hover:text-foreground'}`}
               >
                 Semua
               </button>
               <button 
                 onClick={() => setStatusTab('paid')}
                 className={`flex-1 min-w-[90px] px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${statusTab === 'paid' ? 'bg-emerald-500/10 text-emerald-500 shadow-sm' : 'text-app-text-muted hover:text-foreground'}`}
               >
                 Lunas
               </button>
               <button 
                 onClick={() => setStatusTab('unpaid')}
                 className={`flex-1 min-w-[90px] px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${statusTab === 'unpaid' ? 'bg-rose-500/10 text-rose-500 shadow-sm' : 'text-app-text-muted hover:text-foreground'}`}
               >
                 Belum Lunas
               </button>
            </div>


            {/* Period Filters Dropdown & Inputs */}
            <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full xl:w-auto">
               <div className="flex items-center gap-2 bg-background border border-app-border rounded-2xl px-4 py-3 sm:py-0 shrink-0 w-full sm:w-auto overflow-hidden">
                  <Filter size={16} className="text-accent shrink-0" />
                  <select 
                     value={period}
                     onChange={(e) => setPeriod(e.target.value as any)}
                     className="bg-transparent text-ellipsis min-w-[120px] border-none focus:outline-none text-xs font-black uppercase tracking-widest py-2 text-foreground w-full cursor-pointer"
                  >
                     <option value="all">Sepanjang Waktu</option>
                     <option value="harian">Harian</option>
                     <option value="bulanan">Bulanan</option>
                     <option value="tahunan">Tahunan</option>
                     <option value="custom">Periode Spesifik</option>
                  </select>
               </div>

               {/* Dynamic Secondary Inputs Based on Selected Period */}
               {period === 'harian' && (
                  <input 
                     type="date" 
                     value={selectedDate}
                     onChange={e => setSelectedDate(e.target.value)}
                     title="Pilih Tanggal"
                     className="bg-background border border-app-border text-foreground px-4 py-2 rounded-xl text-xs font-bold focus:outline-none focus:border-accent w-full sm:w-auto cursor-pointer animate-in fade-in zoom-in-95"
                  />
               )}
               {period === 'bulanan' && (
                  <input 
                     type="month" 
                     value={selectedMonth}
                     onChange={e => setSelectedMonth(e.target.value)}
                     title="Pilih Bulan"
                     className="bg-background border border-app-border text-foreground px-4 py-2 rounded-xl text-xs font-bold focus:outline-none focus:border-accent w-full sm:w-auto cursor-pointer animate-in fade-in zoom-in-95"
                  />
               )}
               {period === 'tahunan' && (
                  <div className="relative w-full sm:w-auto animate-in fade-in zoom-in-95">
                     <select 
                        value={selectedYear}
                        onChange={e => setSelectedYear(e.target.value)}
                        title="Pilih Tahun"
                        className="bg-background border border-app-border text-foreground px-4 py-2 rounded-xl text-xs font-bold focus:outline-none focus:border-accent w-full cursor-pointer appearance-none pr-8"
                     >
                        {[...Array(10)].map((_, i) => {
                           const y = new Date().getFullYear() - i;
                           return <option key={y} value={y.toString()}>{y}</option>;
                        })}
                     </select>
                  </div>
               )}
               {period === 'custom' && (
                  <div className="flex items-center gap-2 w-full sm:w-auto animate-in fade-in zoom-in-95 duration-200">
                     <input 
                        type="date" 
                        value={customDate.start}
                        onChange={e => setCustomDate(prev => ({...prev, start: e.target.value}))}
                        title="Tanggal Mulai"
                        className="bg-background border border-app-border text-foreground px-3 py-2 rounded-xl text-xs font-bold focus:outline-none focus:border-accent w-full sm:w-auto cursor-pointer"
                     />
                     <span className="text-app-text-muted font-bold text-xs">s/d</span>
                     <input 
                        type="date" 
                        value={customDate.end}
                        onChange={e => setCustomDate(prev => ({...prev, end: e.target.value}))}
                        title="Tanggal Akhir"
                        className="bg-background border border-app-border text-foreground px-3 py-2 rounded-xl text-xs font-bold focus:outline-none focus:border-accent w-full sm:w-auto cursor-pointer"
                     />
                  </div>
               )}
            </div>

         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-[2rem] flex items-center gap-5 shadow-sm transform transition-all hover:scale-[1.01]">
            <div className={`p-4 rounded-2xl bg-surface text-emerald-500 shadow-md`}>
               <TrendingUp size={32} />
            </div>
            <div>
               <p className="text-[10px] text-emerald-600/70 font-black uppercase tracking-widest">Total Nominal</p>
               <h3 className={`text-2xl font-black text-emerald-500 tracking-tighter`}>Rp {totalSales.toLocaleString('id-ID')}</h3>
            </div>
         </div>
         <div className="bg-accent/10 border border-accent/20 p-6 rounded-[2rem] flex items-center gap-5 shadow-sm transform transition-all hover:scale-[1.01]">
            <div className="p-4 bg-surface rounded-2xl text-accent shadow-md">
               <ShoppingCart size={32} />
            </div>
            <div>
               <p className="text-[10px] text-accent/70 font-black uppercase tracking-widest">Jumlah Transaksi</p>
               <h3 className="text-2xl font-black text-accent tracking-tighter">{totalTrx} Trx</h3>
            </div>
         </div>
      </div>

      <div className="bg-surface border border-app-border rounded-[2rem] p-4 md:p-6 shadow-sm">
          <div className="pb-4 mb-4 border-b border-app-border flex justify-between items-center">
             <span className="text-base font-black text-foreground tracking-tight">Daftar Transaksi ({filteredData.length})</span>
          </div>

          {/* DESKTOP TABLE VIEW */}
          <div className="hidden md:block overflow-x-auto no-scrollbar">
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="text-app-text-muted text-[10px] font-black uppercase tracking-[0.2em] bg-background/50">
                   <th className="p-4 rounded-l-2xl">Waktu</th>
                   <th className="p-4">ID Transaksi</th>
                   <th className="p-4">Pelanggan</th>
                   <th className="p-4">Kasir</th>
                   <th className="p-4 text-center">Status</th>
                   <th className="p-4">Metode</th>
                   <th className="p-4 text-right">Total Tagihan</th>
                   <th className="p-4 rounded-r-2xl text-center">Aksi</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-app-border/30">
                 {isLoading ? (
                   <tr><td colSpan={7} className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-accent mb-2" /> Menghitung data...</td></tr>
                 ) : filteredData.length === 0 ? (
                   <tr><td colSpan={7} className="p-10 text-center text-app-text-muted font-bold opacity-50">Tidak ada transaksi untuk filter ini</td></tr>
                 ) : filteredData.map(trx => (
                   <tr key={trx.id} className="hover:bg-background/50 transition-colors group">
                     <td className="p-4">
                        <p className="text-foreground font-bold text-xs tracking-tight">{trx.timestamp?.toDate ? trx.timestamp.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</p>
                        <p className="text-[9px] text-app-text-muted font-black uppercase tracking-widest mt-0.5">{trx.timestamp?.toDate ? trx.timestamp.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</p>
                     </td>
                     <td className="p-4 text-xs font-mono text-app-text-muted" title={trx.id}>#{trx.id?.substring(0,8)}</td>
                     <td className="p-4 text-sm font-bold tracking-tight">{trx.customerName || 'Umum'}</td>
                     <td className="p-4 text-sm font-bold">{trx.cashierName?.split('@')[0]}</td>
                     <td className="p-4 text-center">
                        {trx.paymentStatus === 'paid' ? (
                           <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">Lunas</span>
                        ) : trx.paymentStatus === 'partially_paid' ? (
                           <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">Dicicil</span>
                        ) : (
                           <span className="bg-rose-500/10 text-rose-500 border border-rose-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">Belum</span>
                        )}
                     </td>
                     <td className="p-4 text-xs font-black uppercase">{trx.paymentMethod || trx.paymentCategory || '-'}</td>
                     <td className="p-4 text-right text-emerald-500 font-black tracking-tighter">Rp {trx.total?.toLocaleString('id-ID')}</td>
                     <td className="p-4 text-center">
                        <button 
                          onClick={() => setSelectedTrx(trx)}
                          className="p-2.5 bg-background border border-app-border hover:border-accent hover:text-accent hover:bg-accent/5 text-app-text-muted rounded-xl transition-all inline-flex shadow-sm active:scale-90"
                          title="Cetak / Lihat Rincian"
                        >
                          <Printer size={16} />
                        </button>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
          </div>

          <div className="md:hidden">
             {isLoading ? (
                <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-accent mb-2" /></div>
             ) : filteredData.length === 0 ? (
                <div className="p-10 text-center text-app-text-muted text-xs font-bold italic">Tidak ada transaksi</div>
             ) : (
                filteredData.map(trx => (
                   <button key={trx.id} className="p-5 bg-background border border-app-border flex flex-col rounded-3xl space-y-4 mb-3 shadow-sm hover:border-accent hover:shadow-xl transition-all w-full text-left" onClick={() => setSelectedTrx(trx)}>
                      <div className="flex justify-between items-start border-b border-app-border/50 pb-3 w-full">
                         <div>
                            <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest flex items-center gap-1">
                              {trx.timestamp?.toDate ? trx.timestamp.toDate().toLocaleDateString('id-ID', { dateStyle: 'medium'}) : '-'}
                            </p>
                            <p className="text-xs font-mono text-foreground font-black mt-1">#{trx.id?.substring(0,8)}</p>
                         </div>
                         {trx.paymentStatus === 'paid' ? (
                            <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">LUNAS</span>
                         ) : trx.paymentStatus === 'partially_paid' ? (
                            <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">DICICIL</span>
                         ) : (
                            <span className="bg-rose-500/10 text-rose-500 border border-rose-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">BELUM</span>
                         )}
                      </div>
                      
                      <div className="flex justify-between items-end w-full">
                         <div className="flex flex-col">
                            <span className="text-[9px] font-black text-app-text-muted uppercase tracking-widest">Metode / {trx.items?.length || 0} Item</span>
                            <span className="text-xs font-black text-foreground mt-0.5">{trx.paymentMethod || trx.paymentCategory || '-'}</span>
                         </div>
                         <div className="text-right">
                            <span className="text-[9px] font-black text-app-text-muted uppercase tracking-widest">Total Tagihan</span>
                            <p className="text-base font-black text-emerald-500 tracking-tighter">Rp {trx.total?.toLocaleString('id-ID')}</p>
                         </div>
                      </div>
                      
                      <div className="pt-3 w-full flex justify-between items-center border-t border-app-border/50">
                          <div className="text-[10px] text-app-text-muted font-bold truncate pr-3">
                             {trx.customerName || 'Umum'} <span className="font-normal text-[9px] uppercase tracking-widest ml-1 opacity-70">• Kasir {trx.cashierName?.split('@')[0]}</span>
                          </div>
                          <div className="text-accent flex items-center gap-1 text-[9px] font-black uppercase shrink-0">
                             Cetak / Rincian <Printer size={12} />
                          </div>
                      </div>
                   </button>
                ))
             )}
          </div>
      </div>

      {/* MODAL RINCIAN TRANSAKSI */}
      {selectedTrx && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-surface border-t md:border border-app-border rounded-t-[2rem] md:rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col h-full md:h-auto md:max-h-[90vh] animate-in slide-in-from-bottom md:zoom-in-95 duration-300">
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
              <button onClick={handleManualClose} className="text-app-text-muted hover:text-rose-500 transition-colors p-2 hover:bg-background rounded-full">
                <X size={28} />
              </button>
            </div>
            
            <div className="p-10 overflow-y-auto flex-1 bg-surface">
              <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Pelanggan</p>
                  <p className="text-foreground font-bold text-base">{selectedTrx.customerName || 'Umum'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Operator Kasir</p>
                  <p className="text-foreground font-bold text-base">{selectedTrx.cashierName?.split('@')[0]}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Metode / Status</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="bg-accent/10 text-accent px-3 py-1 rounded-full text-[10px] font-black uppercase border border-accent/20 inline-block">{selectedTrx.paymentMethod || selectedTrx.paymentCategory}</span>
                    {selectedTrx.paymentStatus === 'unpaid' && <span className="bg-rose-500/10 text-rose-500 px-3 py-1 rounded-full text-[10px] font-black uppercase border border-rose-500/20 inline-block">Belum Dibayar</span>}
                    {selectedTrx.paymentStatus === 'partially_paid' && <span className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full text-[10px] font-black uppercase border border-amber-500/20 inline-block">Dicicil</span>}
                    {selectedTrx.paymentStatus === 'paid' && <span className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-[10px] font-black uppercase border border-emerald-500/20 inline-block">Lunas</span>}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-app-text-muted uppercase tracking-widest">Waktu Transaksi</p>
                  <p className="text-foreground font-bold">
                    {selectedTrx.timestamp?.toDate ? selectedTrx.timestamp.toDate().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' }) : '-'}
                  </p>
                </div>
                {selectedTrx.dueDate && (
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
                {selectedTrx.items?.map((item: any, idx: number) => (
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
                          {item.selectedExtras.map((ext: any, eIdx: number) => (
                            <span key={eIdx} className="text-[9px] bg-background border border-app-border text-app-text-muted px-1.5 py-0.5 rounded">
                              + {ext.optionName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-foreground font-black text-sm tabular-nums">
                      Rp {item.subtotal?.toLocaleString('id-ID')}
                    </p>
                  </div>
                ))}
              </div>

              {selectedTrx.paymentHistory && selectedTrx.paymentHistory.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-xs font-black text-app-text-muted uppercase tracking-[0.3em] mb-4 border-b border-app-border pb-2">Histori Pembayaran</h3>
                  <div className="space-y-3">
                    {selectedTrx.paymentHistory.map((hist: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center bg-background p-3 rounded-2xl border border-app-border cursor-default hover:border-accent transition-colors">
                        <div>
                           <p className="text-xs font-black text-foreground">{hist.note}</p>
                           <p className="text-[9px] text-app-text-muted tracking-[0.2em] uppercase mt-1">
                             {new Date(hist.date).toLocaleString('id-ID', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})}
                           </p>
                        </div>
                        <p className="text-sm font-black text-emerald-500">Rp {hist.amount?.toLocaleString('id-ID')}</p>
                      </div>
                    ))}
                    
                    <div className="bg-surface border border-app-border rounded-2xl p-4 mt-2 space-y-2">
                       <div className="flex justify-between items-center text-[10px] font-bold text-app-text-muted uppercase tracking-widest">
                          <span>Telah Terbayar</span>
                          <span className="text-sm font-black text-emerald-500">Rp {(selectedTrx.paidAmount || 0).toLocaleString('id-ID')}</span>
                       </div>
                       {selectedTrx.paymentStatus !== 'paid' && (
                          <div className="flex justify-between pt-2 border-t border-app-border/50 items-center">
                             <span className="text-[10px] font-bold text-app-text-muted uppercase tracking-widest">Sisa Piutang</span>
                             <span className="text-base font-black text-rose-500">Rp {Math.max(0, selectedTrx.total - (selectedTrx.paidAmount || 0)).toLocaleString('id-ID')}</span>
                          </div>
                       )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 md:p-10 border-t border-app-border bg-background/50 space-y-3">
              <div className="flex justify-between text-xs font-bold text-app-text-muted uppercase tracking-widest">
                <span>Subtotal</span>
                <span className="text-foreground">Rp {((selectedTrx.total || 0) - (selectedTrx.tax || 0))?.toLocaleString('id-ID')}</span>
              </div>
              {selectedTrx.tax ? (
                <div className="flex justify-between text-xs font-bold text-app-text-muted uppercase tracking-widest">
                  <span>Pajak PPN</span>
                  <span className="text-foreground">Rp {selectedTrx.tax?.toLocaleString('id-ID')}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-xl font-black pt-5 border-t border-app-border mt-3 mb-6">
                <span className="text-foreground tracking-tighter">TOTAL AKHIR</span>
                <span className="text-accent">Rp {selectedTrx.total?.toLocaleString('id-ID')}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-app-border/30 max-w-2xl mx-auto">
                  <button 
                    onClick={() => window.open('/invoice?id=' + selectedTrx.id, '_blank')}
                    className="flex items-center justify-center gap-2 bg-background border border-app-border hover:border-emerald-500 text-foreground py-3 px-2 rounded-xl font-black shadow-sm transition-all active:scale-95 text-[10px] uppercase group"
                  >
                    <Printer size={16} className="text-emerald-500 group-hover:scale-110 transition-transform" /> 
                    INVOICE A4
                  </button>

                  <button 
                    onClick={() => window.open('/delivery?id=' + selectedTrx.id, '_blank')}
                    className="flex items-center justify-center gap-2 bg-background border border-app-border hover:border-blue-500 text-foreground py-3 px-2 rounded-xl font-black shadow-sm transition-all active:scale-95 text-[10px] uppercase group"
                  >
                    <Truck size={16} className="text-blue-500 group-hover:scale-110 transition-transform" /> 
                    SURAT JALAN
                  </button>

                  {selectedTrx.paymentStatus !== 'paid' ? (
                    <>
                      <button 
                        onClick={() => handleSendWA(selectedTrx)}
                        className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-3 px-2 rounded-xl font-black shadow-lg shadow-emerald-500/20 transition-all active:scale-95 text-[10px] uppercase group/wa"
                      >
                        <MessageCircle size={16} className="group-hover/wa:rotate-12 transition-transform" />
                        INGATKAN WA
                      </button>
                      <button 
                        onClick={() => printReceipt(selectedTrx, storeSettings)}
                        className="flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-foreground py-3 px-2 rounded-xl font-black shadow-lg shadow-accent/20 transition-all active:scale-95 text-[10px] uppercase"
                      >
                        <Printer size={16} /> 
                        CETAK STRUK
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => printReceipt(selectedTrx, storeSettings)}
                      className="col-span-2 flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-foreground py-4 px-4 rounded-xl font-black shadow-lg shadow-accent/20 transition-all active:scale-95 text-xs uppercase"
                    >
                      <Printer size={20} /> 
                      CETAK STRUK THERMAL
                    </button>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
