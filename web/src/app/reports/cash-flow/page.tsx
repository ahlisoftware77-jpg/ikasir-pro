'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, addDoc, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth';
import { 
  DollarSign, 
  Plus, 
  Loader2, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Banknote, 
  ListPlus, 
  Download, 
  History, 
  Calculator, 
  User, 
  Tag, 
  ChevronRight, 
  X,
  Calendar,
  Filter,
  Wallet,
  CreditCard,
  ArrowRightLeft,
  Search,
  TrendingUp
} from 'lucide-react';
import { CashFlow } from '@/types';
import { exportToExcel } from '@/lib/exportToExcel';
import toast from 'react-hot-toast';

export default function CashFlowReportPage() {
  const { user, storeId } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'all' | 'income' | 'expense'>('all');
  
  // Date Filter State
  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [formData, setFormData] = useState({
    type: 'out',
    category: 'operasional',
    amount: '',
    description: ''
  });

  const [manualData, setManualData] = useState<any[]>([]);
  const [trxData, setTrxData] = useState<any[]>([]);

  useEffect(() => {
    if (!storeId) return;

    // Calculate start of day for 'today' default
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const unsub1 = onSnapshot(query(
      collection(db, 'cash_flow'), 
      where('storeId', '==', storeId),
      orderBy('timestamp', 'desc')
    ), snap => {
       const items: any[] = [];
       snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
       setManualData(items);
    });
    
    const unsub2 = onSnapshot(query(
      collection(db, 'transactions'), 
      where('storeId', '==', storeId),
      orderBy('timestamp', 'desc')
    ), snap => {
       const trxItems: any[] = [];
       snap.forEach(doc => {
          const d = doc.data();
          if (d.paymentStatus === 'paid') {
             trxItems.push({
                id: doc.id,
                type: 'in',
                category: 'penjualan',
                amount: d.total,
                paymentMethod: d.paymentMethod || 'cash',
                description: `Penjualan POS - ${doc.id.substring(0,8)}`,
                timestamp: d.timestamp,
                userEmail: d.cashierName || 'System'
             });
          }
       });
       setTrxData(trxItems);
       setIsLoading(false);
    });
    
    return () => { unsub1(); unsub2(); }
  }, [storeId]);

  // --- FILTER LOGIC ---
  const filteredData = useMemo(() => {
    let combined = [...manualData, ...trxData];
    
    const now = new Date();
    let startDate: Date | null = null;

    if (dateRange === 'today') {
        startDate = new Date();
        startDate.setHours(0,0,0,0);
    } else if (dateRange === '7days') {
        startDate = new Date(now.setDate(now.getDate() - 7));
    } else if (dateRange === '30days') {
        startDate = new Date(now.setDate(now.getDate() - 30));
    } else if (dateRange === 'custom') {
        if (customStartDate) startDate = new Date(customStartDate);
    }

    if (startDate) {
        combined = combined.filter(item => {
            const itemDate = item.timestamp?.toDate ? item.timestamp.toDate() : (item.timestamp instanceof Date ? item.timestamp : new Date());
            return itemDate >= startDate!;
        });
    }

    if (dateRange === 'custom' && customEndDate) {
        const endDate = new Date(customEndDate);
        endDate.setHours(23, 59, 59, 999);
        combined = combined.filter(item => {
            const itemDate = item.timestamp?.toDate ? item.timestamp.toDate() : (item.timestamp instanceof Date ? item.timestamp : new Date());
            return itemDate <= endDate;
        });
    }

    // Tab filtering
    if (activeTab === 'income') combined = combined.filter(d => d.type === 'in');
    if (activeTab === 'expense') combined = combined.filter(d => d.type === 'out');

    if (searchQuery) {
        const queryLower = searchQuery.toLowerCase();
        combined = combined.filter(d => 
            (d.description && d.description.toLowerCase().includes(queryLower)) || 
            (d.category && d.category.toLowerCase().includes(queryLower)) ||
            (d.userEmail && d.userEmail.toLowerCase().includes(queryLower))
        );
    }

    return combined.sort((a, b) => {
        const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
        const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
        return timeB - timeA;
    });
  }, [manualData, trxData, dateRange, customStartDate, customEndDate, activeTab, searchQuery]);

  // --- CALCULATION LOGIC (Professional Accounting Style) ---
  const { totalIn, totalOut, cashIn, nonCashIn, processedDataWithBalance } = useMemo(() => {
    // We need to calculate running balance from OLDEST to NEWEST
    const chronological = [...filteredData].reverse();
    let running = 0;
    
    let tIn = 0;
    let tOut = 0;
    let cIn = 0;
    let nIn = 0;

    const withBalance = chronological.map(item => {
        if (item.type === 'in') {
            running += item.amount;
            tIn += item.amount;
            if (item.paymentMethod === 'cash') cIn += item.amount;
            else nIn += item.amount;
        } else {
            running -= item.amount;
            tOut += item.amount;
        }
        return { ...item, runningBalance: running };
    });

    return {
        totalIn: tIn,
        totalOut: tOut,
        cashIn: cIn,
        nonCashIn: nIn,
        processedDataWithBalance: withBalance.reverse() // Back to newest first for display
    };
  }, [filteredData]);

  const handleExport = () => {
    const formattedData = processedDataWithBalance.map(item => ({
      'Waktu': item.timestamp?.toDate ? item.timestamp.toDate().toLocaleString('id-ID') : '-',
      'Kategori': item.category,
      'Deskripsi': item.description,
      'Metode': item.paymentMethod || '-',
      'Tipe': item.type === 'in' ? 'Pemasukan' : 'Pengeluaran',
      'Nominal (Rp)': item.amount,
      'Saldo Berjalan (Rp)': item.runningBalance,
      'Dicatat Oleh': item.userEmail,
    }));
    exportToExcel(formattedData, `Laporan_Arus_Kas_${dateRange}`);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.description) return;
    
    setIsProcessing(true);
    try {
      await addDoc(collection(db, 'cash_flow'), {
        type: formData.type,
        category: formData.category,
        amount: Number(formData.amount),
        description: formData.description,
        timestamp: new Date(),
        userEmail: user?.email || 'admin',
        storeId: storeId
      });
      setIsModalOpen(false);
      setFormData({ type: 'out', category: 'operasional', amount: '', description: '' });
      toast.success('Pencatatan kas berhasil disimpan!');
    } catch (err) {
      console.error(err);
      toast.error('Gagal merekam data arus kas.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
            <Loader2 className="animate-spin text-accent w-12 h-12" />
            <p className="text-app-text-muted font-black uppercase tracking-widest text-[10px]">Menyinkronkan Arus Kas...</p>
        </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto pb-20 px-2 lg:px-4">
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2">
            <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-accent/20 text-accent rounded-3xl flex items-center justify-center shadow-inner">
                    <ArrowRightLeft size={28} />
                </div>
                <div>
                    <h1 className="text-3xl md:text-5xl font-black text-foreground tracking-tighter uppercase leading-none">Arus Kas</h1>
                    <div className="flex items-center gap-2 mt-2">
                        <Calendar size={14} className="text-app-text-muted" />
                        <span className="text-xs font-black text-app-text-muted uppercase tracking-widest">Procedural Audit Ledger</span>
                    </div>
                </div>
            </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-surface p-1 rounded-2xl border border-app-border shadow-inner">
                {['today', '7days', '30days', 'custom'].map((opt) => (
                    <button
                        key={opt}
                        onClick={() => setDateRange(opt as any)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${dateRange === opt ? 'bg-accent text-foreground shadow-lg' : 'text-app-text-muted hover:text-foreground'}`}
                    >
                        {opt === '7days' ? '7 Hari' : opt === '30days' ? '30 Hari' : opt === 'custom' ? 'Kustom' : 'Hari Ini'}
                    </button>
                ))}
            </div>
            <button 
                onClick={handleExport}
                className="p-4 bg-background border border-app-border rounded-2xl text-app-text-muted hover:text-emerald-500 hover:border-emerald-500/30 transition-all active:scale-95"
                title="Export Excel"
            >
                <Download size={20} />
            </button>
            <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-3 bg-accent hover:bg-accent-hover text-foreground px-6 py-4 rounded-2xl font-black shadow-xl shadow-accent/20 transition-all active:scale-95 text-[11px] uppercase tracking-widest"
            >
                <Plus size={18} /> Catat Pengeluaran
            </button>
        </div>
      </div>

      {dateRange === 'custom' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-surface border border-app-border rounded-3xl animate-in slide-in-from-top-4 duration-300 shadow-inner">
             <div className="space-y-1.5">
                <label className="text-[9px] font-black text-app-text-muted uppercase tracking-widest pl-1">Mulai Dari</label>
                <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="w-full bg-background border border-app-border p-3 rounded-xl text-xs font-bold focus:outline-none focus:border-accent" />
             </div>
             <div className="space-y-1.5">
                <label className="text-[9px] font-black text-app-text-muted uppercase tracking-widest pl-1">Sampai Dengan</label>
                <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="w-full bg-background border border-app-border p-3 rounded-xl text-xs font-bold focus:outline-none focus:border-accent" />
             </div>
          </div>
      )}

      {/* DASHBOARD SUMMARY */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
          {/* CASH IN DRAWER */}
          <div className="bg-emerald-500 border border-emerald-400 p-4 md:p-8 rounded-[2rem] md:rounded-[3rem] text-white shadow-xl shadow-emerald-500/20 group relative overflow-hidden transition-all hover:-translate-y-1 duration-300">
             <div className="absolute right-2 bottom-2 md:right-6 md:bottom-6 opacity-10 group-hover:scale-110 transition-transform duration-700 pointer-events-none">
                <Wallet className="w-16 h-16 md:w-28 md:h-28" />
             </div>
             <div className="relative z-10 space-y-1 md:space-y-2">
                <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-emerald-100/80 leading-tight">Laci (Tunai)</p>
                <h3 className="text-xl md:text-3xl font-black tracking-tighter truncate">Rp {cashIn.toLocaleString('id-ID')}</h3>
                <div className="hidden md:flex items-center gap-2 text-[9px] font-bold bg-white/10 w-fit px-2 py-1 rounded-lg mt-2">
                    <ArrowDownCircle size={12} /> Dari Penjualan
                </div>
             </div>
          </div>

          {/* NON-CASH (BANK/QRIS) */}
          <div className="bg-blue-500 border border-blue-400 p-4 md:p-8 rounded-[2rem] md:rounded-[3rem] text-white shadow-xl shadow-blue-500/20 group relative overflow-hidden transition-all hover:-translate-y-1 duration-300">
             <div className="absolute right-2 bottom-2 md:right-6 md:bottom-6 opacity-10 group-hover:scale-110 transition-transform duration-700 pointer-events-none">
                <CreditCard className="w-16 h-16 md:w-28 md:h-28" />
             </div>
             <div className="relative z-10 space-y-1 md:space-y-2">
                <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-blue-100/80 leading-tight">Bank & QRIS</p>
                <h3 className="text-xl md:text-3xl font-black tracking-tighter truncate">Rp {nonCashIn.toLocaleString('id-ID')}</h3>
                <div className="hidden md:flex items-center gap-2 text-[9px] font-bold bg-white/10 w-fit px-2 py-1 rounded-lg mt-2">
                    <History size={12} /> Realtime Balance
                </div>
             </div>
          </div>

          {/* EXPENSES */}
          <div className="bg-rose-500 border border-rose-400 p-4 md:p-8 rounded-[2rem] md:rounded-[3rem] text-white shadow-xl shadow-rose-500/20 group relative overflow-hidden transition-all hover:-translate-y-1 duration-300">
             <div className="absolute right-2 bottom-2 md:right-6 md:bottom-6 opacity-10 group-hover:scale-110 transition-transform duration-700 pointer-events-none">
                <ArrowUpCircle className="w-16 h-16 md:w-28 md:h-28" />
             </div>
             <div className="relative z-10 space-y-1 md:space-y-2">
                <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-rose-100/80 leading-tight">Biaya & Keluar</p>
                <h3 className="text-xl md:text-3xl font-black tracking-tighter truncate">Rp {totalOut.toLocaleString('id-ID')}</h3>
                <div className="hidden md:flex items-center gap-2 text-[9px] font-bold bg-white/10 w-fit px-2 py-1 rounded-lg mt-2">
                    <Calculator size={12} /> Pengeluaran
                </div>
             </div>
          </div>

          {/* FINAL BALANCE (NET) */}
          <div className="bg-surface border-2 md:border-4 border-accent p-4 md:p-8 rounded-[2rem] md:rounded-[3rem] text-foreground shadow-2xl group relative overflow-hidden transition-all hover:-translate-y-1 duration-300">
             <div className="absolute right-2 bottom-2 md:right-6 md:bottom-6 opacity-5 group-hover:scale-110 transition-transform duration-700 pointer-events-none text-accent">
                <TrendingUp className="w-20 h-20 md:w-32 md:h-32" />
             </div>
             <div className="relative z-10 space-y-1 md:space-y-2">
                <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-app-text-muted leading-tight">Laba Bersih Kas</p>
                <h3 className={`text-2xl md:text-4xl font-black tracking-tighter truncate ${(totalIn - totalOut) < 0 ? 'text-rose-500' : 'text-foreground'}`}>
                    Rp {(totalIn - totalOut).toLocaleString('id-ID')}
                </h3>
             </div>
          </div>
      </div>

      {/* FILTER TABS & SEARCH */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-2">
          <div className="flex items-center gap-1.5 bg-surface border border-app-border p-1 rounded-2xl w-full md:w-auto">
             {(['all', 'income', 'expense'] as const).map(tab => (
                 <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-background text-accent border border-app-border shadow-sm' : 'text-app-text-muted'}`}
                 >
                    {tab === 'income' ? 'Pemasukan' : tab === 'expense' ? 'Pengeluaran' : 'Semua'}
                 </button>
             ))}
          </div>
          
          <div className="relative w-full md:w-64 group flex items-center">
              <div className="absolute left-4 flex items-center justify-center pointer-events-none text-app-text-muted group-focus-within:text-accent transition-colors">
                 <Search size={16} />
              </div>
              <input 
                 type="text" 
                 placeholder="Cari transaksi..." 
                 value={searchQuery}
                 onChange={e => setSearchQuery(e.target.value)}
                 className="w-full pl-10 pr-4 py-3 bg-surface border border-app-border rounded-2xl text-xs font-bold focus:outline-none focus:border-accent transition-all" 
              />
          </div>
      </div>

      {/* PROFESSIONAL LEDGER TABLE */}
      <div className="bg-surface border border-app-border rounded-[2.5rem] overflow-hidden shadow-2xl">
          <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse">
                  <thead>
                      <tr className="bg-background/20 text-app-text-muted text-[10px] font-black uppercase tracking-[0.2em] border-b border-app-border">
                          <th className="p-6">Waktu & Sumber</th>
                          <th className="p-6">Kategori & Detail</th>
                          <th className="p-6 text-right">Debit (Masuk)</th>
                          <th className="p-6 text-right">Kredit (Keluar)</th>
                          <th className="p-6 text-right bg-background/50">Saldo Akhir</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border/40">
                      {processedDataWithBalance.length === 0 ? (
                          <tr><td colSpan={5} className="p-20 text-center text-app-text-muted font-bold uppercase tracking-widest opacity-50 italic">Data tidak ditemukan dalam rentang waktu ini</td></tr>
                      ) : (
                        processedDataWithBalance.map((item, idx) => (
                            <tr key={idx} className="hover:bg-accent/5 transition-all group">
                                <td className="p-6">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${item.type === 'in' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}>
                                            {item.type === 'in' ? <ArrowDownCircle size={18} /> : <ArrowUpCircle size={18} />}
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-foreground">{item.timestamp?.toDate ? item.timestamp.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</p>
                                            <p className="text-[9px] text-app-text-muted font-black uppercase tracking-widest mt-1">
                                                {item.timestamp?.toDate ? item.timestamp.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'}
                                                <span className="mx-2 opacity-30">|</span>
                                                {item.category === 'penjualan' ? 'SISTEM POS' : 'MANUAL'}
                                            </p>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-6">
                                    <h4 className="text-sm font-bold text-foreground leading-snug line-clamp-1">{item.description}</h4>
                                    <div className="flex items-center gap-4 mt-2">
                                        <div className="flex items-center gap-1.5 text-[9px] font-black text-app-text-muted uppercase tracking-widest bg-background border border-app-border px-2 py-1 rounded-md">
                                            <Tag size={10} className="text-accent" /> {item.category}
                                        </div>
                                        {item.paymentMethod && (
                                            <div className="flex items-center gap-1.5 text-[9px] font-black text-accent uppercase tracking-widest bg-accent/5 px-2 py-1 rounded-md">
                                                <Wallet size={10} /> {item.paymentMethod}
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="p-6 text-right font-black text-emerald-500 text-sm">
                                    {item.type === 'in' ? `Rp ${item.amount.toLocaleString('id-ID')}` : '-'}
                                </td>
                                <td className="p-6 text-right font-black text-rose-500 text-sm">
                                    {item.type === 'out' ? `Rp ${item.amount.toLocaleString('id-ID')}` : '-'}
                                </td>
                                <td className="p-6 text-right font-black text-foreground text-base bg-background/20 tracking-tighter">
                                    Rp {item.runningBalance.toLocaleString('id-ID')}
                                </td>
                            </tr>
                        ))
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      {/* MANUAL ENTRY MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-black/95 backdrop-blur-xl">
          <div className="bg-surface border-t md:border border-app-border rounded-t-[3rem] md:rounded-[3.5rem] w-full max-w-lg shadow-2xl p-10 h-full md:h-auto overflow-y-auto animate-in slide-in-from-bottom md:zoom-in-95 duration-300">
             <div className="flex items-start justify-between mb-10">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-accent/20 text-accent rounded-[1.5rem] flex items-center justify-center">
                        <ListPlus size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-foreground tracking-tight uppercase leading-none mb-2">Pencatatan Kas</h2>
                        <p className="text-xs text-app-text-muted font-bold tracking-widest uppercase">Input Manual Arus Kas Keluar/Masuk</p>
                    </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 border border-app-border rounded-full hover:bg-background transition-colors text-app-text-muted">
                    <X size={24} />
                </button>
             </div>

             <form onSubmit={handleSave} className="space-y-8">
                <div className="flex gap-2 p-1.5 bg-background border border-app-border rounded-[2rem]">
                    <button 
                        type="button"
                        onClick={() => setFormData({...formData, type: 'in', category: 'modal'})}
                        className={`flex-1 py-4 text-[11px] font-black rounded-2xl transition-all uppercase tracking-widest ${formData.type === 'in' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'text-app-text-muted hover:text-foreground'}`}
                    >
                        Pemasukan
                    </button>
                    <button 
                        type="button"
                        onClick={() => setFormData({...formData, type: 'out', category: 'operasional'})}
                        className={`flex-1 py-4 text-[11px] font-black rounded-2xl transition-all uppercase tracking-widest ${formData.type === 'out' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30' : 'text-app-text-muted hover:text-foreground'}`}
                    >
                        Pengeluaran
                    </button>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-app-text-muted uppercase tracking-[0.3em] pl-2 mb-2 block">Kategori Transaksi</label>
                    <select 
                        required
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value})}
                        className="w-full px-6 py-5 bg-background border-2 border-app-border rounded-3xl text-sm font-black text-foreground focus:outline-none focus:border-accent transition-all appearance-none cursor-pointer"
                    >
                        {formData.type === 'in' ? (
                            <>
                                <option value="modal">TAMBAHAN MODAL</option>
                                <option value="piutang">PELUNASAN PIUTANG</option>
                                <option value="lainnya">PENDAPATAN LAINNYA</option>
                            </>
                        ) : (
                            <>
                                <option value="operasional">BIAYA OPERASIONAL</option>
                                <option value="belanja">BELANJA STOK / BAHAN</option>
                                <option value="listrik">LISTRIK & AIR</option>
                                <option value="gaji">GAJI KARYAWAN</option>
                                <option value="pribadi">KEPERLUAN PRIBADI (PRIVE)</option>
                                <option value="lainnya">LAIN-LAIN</option>
                            </>
                        )}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-app-text-muted uppercase tracking-[0.3em] pl-2 mb-2 block">Nominal (Rp)</label>
                    <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-sm font-black text-app-text-muted">RP</span>
                        <input 
                            type="number" 
                            required
                            min="1"
                            value={formData.amount}
                            onChange={e => setFormData({...formData, amount: e.target.value})}
                            placeholder="0"
                            className="w-full pl-14 pr-6 py-5 bg-background border-2 border-app-border rounded-3xl text-2xl font-black text-foreground focus:outline-none focus:border-accent transition-all"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-app-text-muted uppercase tracking-[0.3em] pl-2 mb-2 block">Keterangan / Deskripsi</label>
                    <textarea 
                        required
                        value={formData.description}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                        placeholder="Contoh: Bayar listrik bulan April..."
                        className="w-full px-6 py-5 bg-background border-2 border-app-border rounded-3xl text-sm font-bold text-foreground focus:outline-none focus:border-accent transition-all h-32 resize-none"
                    />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 text-[11px] font-black uppercase tracking-widest text-app-text-muted bg-background border border-app-border rounded-2xl hover:text-foreground transition-all">
                        BATAL
                    </button>
                    <button 
                        disabled={isProcessing}
                        type="submit" 
                        className="flex-[2] py-5 bg-accent hover:bg-accent-hover text-foreground rounded-2xl font-black shadow-xl shadow-accent/20 transition-all active:scale-95 flex items-center justify-center gap-3 text-xs uppercase tracking-[0.2em]"
                    >
                        {isProcessing ? <Loader2 className="animate-spin" size={18} /> : null}
                        {isProcessing ? 'MENYIMPAN...' : 'SIMPAN DATA'}
                    </button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}
