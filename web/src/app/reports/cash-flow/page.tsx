'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, addDoc, where, Timestamp, doc, deleteDoc, getDoc, updateDoc } from 'firebase/firestore';
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
  TrendingUp,
  Eye,
  Trash2,
  Info
} from 'lucide-react';
import { CashFlow } from '@/types';
import { exportToExcel } from '@/lib/exportToExcel';
import toast from 'react-hot-toast';

const categoryMap: { [key: string]: { label: string, emoji: string } } = {
  modal: { label: 'Tambahan Modal', emoji: '💵' },
  piutang: { label: 'Pelunasan Piutang', emoji: '📈' },
  penjualan: { label: 'Penjualan / POS', emoji: '🛍️' },
  jasa: { label: 'Jasa & Servis', emoji: '🔧' },
  investasi: { label: 'Investasi & Bunga', emoji: '🏦' },
  hibah: { label: 'Hibah / Hadiah', emoji: '🎁' },
  operasional: { label: 'Operasional', emoji: '⚙️' },
  belanja: { label: 'Belanja Stok', emoji: '📦' },
  listrik: { label: 'Listrik & Air', emoji: '⚡' },
  gaji: { label: 'Gaji Karyawan', emoji: '👤' },
  sewa: { label: 'Sewa Tempat', emoji: '🏠' },
  transportasi: { label: 'Transportasi', emoji: '🚗' },
  promosi: { label: 'Promosi & Iklan', emoji: '📣' },
  pemeliharaan: { label: 'Pemeliharaan', emoji: '🛠️' },
  pribadi: { label: 'Pribadi (Prive)', emoji: '💸' },
  pajak: { label: 'Pajak & Asuransi', emoji: '🛡️' },
  konsumsi: { label: 'Konsumsi & ATK', emoji: '☕' },
  lainnya: { label: 'Lain-lain', emoji: '❓' }
};

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
  const [isSearchVisible, setIsSearchVisible] = useState(true);
  
  const [formData, setFormData] = useState({
    type: 'out',
    category: 'operasional',
    amount: '',
    description: '',
    linkedTransactionId: ''
  });

  const [manualData, setManualData] = useState<any[]>([]);
  const [trxData, setTrxData] = useState<any[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [selectedCashFlow, setSelectedCashFlow] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [tempSubNotes, setTempSubNotes] = useState<{ description: string; amount: string }[]>([
    { description: '', amount: '' }
  ]);
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  const [isTrxDetailOpen, setIsTrxDetailOpen] = useState(false);
  const [isFetchingTrx, setIsFetchingTrx] = useState(false);
  const [detailSubNotes, setDetailSubNotes] = useState<{ description: string; amount: string }[]>([]);
  const [isSavingSubNotes, setIsSavingSubNotes] = useState(false);

  const [cashFlowTrxDetails, setCashFlowTrxDetails] = useState<any | null>(null);
  const [isLoadingTrxDetails, setIsLoadingTrxDetails] = useState(false);

  useEffect(() => {
    if (!selectedCashFlow) {
      setCashFlowTrxDetails(null);
      setDetailSubNotes([]);
      return;
    }

    if (selectedCashFlow.isManual) {
      const formattedNotes = (selectedCashFlow.subNotes || []).map((n: any) => ({
        description: n.description,
        amount: String(n.amount)
      }));
      setDetailSubNotes(formattedNotes.length > 0 ? formattedNotes : [{ description: '', amount: '' }]);
      setCashFlowTrxDetails(null);
    } else {
      const trxId = selectedCashFlow.id.split('_')[0];
      setIsLoadingTrxDetails(true);
      const docRef = doc(db, 'transactions', trxId);
      getDoc(docRef).then(docSnap => {
        if (docSnap.exists()) {
          setCashFlowTrxDetails(docSnap.data());
        }
      }).catch(console.error).finally(() => {
        setIsLoadingTrxDetails(false);
      });
    }
  }, [selectedCashFlow]);

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
       const trxs: any[] = [];
        snap.forEach(doc => {
           const d = doc.data();
           trxs.push({ id: doc.id, ...d });
           if (d.paymentHistory && d.paymentHistory.length > 0) {
              d.paymentHistory.forEach((entry: any) => {
                 trxItems.push({
                    id: `${doc.id}_${entry.id || Math.random()}`,
                    type: 'in',
                    category: 'penjualan',
                    amount: entry.amount || 0,
                    paymentMethod: entry.paymentMethod || d.paymentMethod || 'cash',
                    description: `Penjualan POS - ${doc.id.substring(0,8)} (${entry.note || 'DP/Cicilan'})`,
                    timestamp: entry.date ? { toDate: () => new Date(entry.date) } : d.timestamp,
                    userEmail: entry.cashierName || d.cashierName || 'System'
                 });
              });
           } else {
              if (d.paymentStatus === 'paid') {
                 trxItems.push({
                    id: doc.id,
                    type: 'in',
                    category: 'penjualan',
                    amount: d.total || 0,
                    paymentMethod: d.paymentMethod || 'cash',
                    description: `Penjualan POS - ${doc.id.substring(0,8)}`,
                    timestamp: d.timestamp,
                    userEmail: d.cashierName || 'System'
                 });
              } else if (d.paidAmount > 0) {
                 trxItems.push({
                    id: doc.id,
                    type: 'in',
                    category: 'penjualan',
                    amount: d.paidAmount,
                    paymentMethod: d.paymentMethod || 'cash',
                    description: `Penjualan POS - ${doc.id.substring(0,8)} (DP)`,
                    timestamp: d.timestamp,
                    userEmail: d.cashierName || 'System'
                 });
              }
           }
        });
       setTrxData(trxItems);
       setAllTransactions(trxs);
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

  const fetchAndShowTransaction = async (trxId: string) => {
    setIsFetchingTrx(true);
    try {
      const docRef = doc(db, 'transactions', trxId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSelectedTransaction({ id: docSnap.id, ...docSnap.data() });
        setIsTrxDetailOpen(true);
      } else {
        toast.error("Transaksi tidak ditemukan di database.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Gagal memuat detail transaksi: " + err.message);
    } finally {
      setIsFetchingTrx(false);
    }
  };

  const handleSaveSubNotes = async (cashFlowId: string) => {
    setIsSavingSubNotes(true);
    try {
      const cleanSubNotes = detailSubNotes
        .filter(n => n.description.trim() !== '' && n.amount.trim() !== '')
        .map(n => ({ description: n.description, amount: Number(n.amount) }));

      await updateDoc(doc(db, 'cash_flow', cashFlowId), {
        subNotes: cleanSubNotes
      });
      setSelectedCashFlow((prev: any) => ({ ...prev, subNotes: cleanSubNotes }));
      toast.success("Sub-catatan berhasil diperbarui!");
    } catch (err: any) {
      console.error(err);
      toast.error("Gagal menyimpan sub-catatan: " + err.message);
    } finally {
      setIsSavingSubNotes(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus catatan arus kas ini?")) return;
    
    try {
      await deleteDoc(doc(db, 'cash_flow', id));
      toast.success("Catatan arus kas berhasil dihapus!");
    } catch (err: any) {
      console.error(err);
      toast.error("Gagal menghapus catatan: " + err.message);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.description) return;
    
    setIsProcessing(true);
    try {
      const cleanSubNotes = tempSubNotes
        .filter(n => n.description.trim() !== '' && n.amount.trim() !== '')
        .map(n => ({ description: n.description, amount: Number(n.amount) }));

      await addDoc(collection(db, 'cash_flow'), {
        type: formData.type,
        category: formData.category,
        amount: Number(formData.amount),
        description: formData.description,
        linkedTransactionId: formData.linkedTransactionId || '',
        subNotes: cleanSubNotes,
        timestamp: new Date(),
        userEmail: user?.email || 'admin',
        storeId: storeId
      });
      setIsModalOpen(false);
      setFormData({ type: 'out', category: 'operasional', amount: '', description: '', linkedTransactionId: '' });
      setTempSubNotes([{ description: '', amount: '' }]);
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
          <div className="flex items-center gap-2 bg-surface border border-app-border p-1 rounded-2xl w-full md:w-auto">
             <div className="flex items-center gap-1.5 flex-1 md:flex-none">
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
             
             {/* Search Toggle Button */}
             <button
                type="button"
                onClick={() => setIsSearchVisible(!isSearchVisible)}
                className={`p-3 rounded-xl transition-all border ${isSearchVisible ? 'bg-accent/10 border-accent/20 text-accent' : 'bg-background border-app-border text-app-text-muted hover:text-foreground'}`}
                title="Toggle Pencarian"
             >
                <Search size={14} />
             </button>
          </div>
          
          <div className={`relative w-full md:w-64 group flex items-center transition-all duration-300 overflow-hidden ${isSearchVisible ? 'max-h-20 opacity-100 py-0' : 'max-h-0 opacity-0 py-0 pointer-events-none'}`}>
              <div className="absolute left-4 flex items-center justify-center pointer-events-none text-app-text-muted group-focus-within:text-accent transition-colors">
                 <Search size={16} />
              </div>
              <input 
                 type="text" 
                 placeholder="Cari transaksi..." 
                 value={searchQuery}
                 onChange={e => {
                    setSearchQuery(e.target.value);
                 }}
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
                          <th className="p-6 text-center">Aksi</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border/40">
                      {processedDataWithBalance.length === 0 ? (
                          <tr><td colSpan={6} className="p-20 text-center text-app-text-muted font-bold uppercase tracking-widest opacity-50 italic">Data tidak ditemukan dalam rentang waktu ini</td></tr>
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
                                            <Tag size={10} className="text-accent" /> {categoryMap[item.category]?.emoji || '📝'} {categoryMap[item.category]?.label || item.category}
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
                                <td className="p-6 text-center">
                                    <div className="flex justify-center items-center gap-2">
                                        <button 
                                            onClick={() => {
                                                setSelectedCashFlow(item);
                                                setIsDetailOpen(true);
                                            }}
                                            className="p-2 bg-accent/10 hover:bg-accent/20 text-accent rounded-xl transition-all"
                                            title="Detail Rincian"
                                        >
                                            <Eye size={14} />
                                        </button>
                                        {item.isManual && (
                                            <button 
                                                onClick={() => handleDelete(item.id)}
                                                className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-xl transition-all"
                                                title="Hapus Catatan"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
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
                                <option value="modal">💵 TAMBAHAN MODAL</option>
                                <option value="piutang">📈 PELUNASAN PIUTANG</option>
                                <option value="jasa">🔧 JASA & SERVIS</option>
                                <option value="investasi">🏦 INVESTASI & BUNGA</option>
                                <option value="hibah">🎁 HIBAH / HADIAH</option>
                                <option value="lainnya">💰 LAINNYA</option>
                            </>
                        ) : (
                            <>
                                <option value="operasional">⚙️ BIAYA OPERASIONAL</option>
                                <option value="belanja">📦 BELANJA STOK / BAHAN</option>
                                <option value="listrik">⚡ LISTRIK & AIR</option>
                                <option value="gaji">👤 GAJI KARYAWAN</option>
                                <option value="sewa">🏠 SEWA TEMPAT</option>
                                <option value="transportasi">🚗 BIAYA TRANSPORTASI</option>
                                <option value="promosi">📣 PROMOSI & IKLAN</option>
                                <option value="pemeliharaan">🛠️ PEMELIHARAAN</option>
                                <option value="pribadi">💸 KEPERLUAN PRIBADI (PRIVE)</option>
                                <option value="pajak">🛡️ PAJAK & ASURANSI</option>
                                <option value="konsumsi">☕ KONSUMSI & ATK</option>
                                <option value="lainnya">❓ LAIN-LAIN</option>
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

                {formData.type === 'out' && (
                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-app-text-muted uppercase tracking-[0.3em] pl-2 mb-2 block">Pilih Transaksi Asal (Opsional)</label>
                      <select 
                          value={formData.linkedTransactionId}
                          onChange={e => setFormData({...formData, linkedTransactionId: e.target.value})}
                          className="w-full px-6 py-5 bg-background border-2 border-app-border rounded-3xl text-sm font-black text-foreground focus:outline-none focus:border-accent transition-all appearance-none cursor-pointer"
                      >
                          <option value="">-- Tidak dikaitkan dengan transaksi --</option>
                          {allTransactions.map((trx) => (
                              <option key={trx.id} value={trx.id}>
                                  Ref: #{trx.id.substring(0, 8)} {trx.customerName ? `- ${trx.customerName}` : ''} (Rp {trx.total?.toLocaleString('id-ID')})
                              </option>
                          ))}
                      </select>
                  </div>
                )}

                <div className="space-y-4 border-t border-app-border/40 pt-4">
                    <label className="text-[10px] font-black text-app-text-muted uppercase tracking-[0.3em] pl-2 mb-2 block">
                        Rincian Sub Catatan (Opsional)
                    </label>
                    <div className="space-y-3">
                        {tempSubNotes.map((note, idx) => (
                            <div key={idx} className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Nama Rincian (e.g. Beras)"
                                    value={note.description}
                                    onChange={e => {
                                        const newNotes = [...tempSubNotes];
                                        newNotes[idx].description = e.target.value;
                                        setTempSubNotes(newNotes);
                                    }}
                                    className="flex-[2] px-4 py-3 bg-background border border-app-border rounded-2xl text-xs font-bold text-foreground focus:outline-none"
                                />
                                <input
                                    type="number"
                                    placeholder="Jumlah (Rp)"
                                    value={note.amount}
                                    onChange={e => {
                                        const newNotes = [...tempSubNotes];
                                        newNotes[idx].amount = e.target.value;
                                        setTempSubNotes(newNotes);
                                    }}
                                    className="flex-1 px-4 py-3 bg-background border border-app-border rounded-2xl text-xs font-bold text-foreground focus:outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newNotes = tempSubNotes.filter((_, i) => i !== idx);
                                        setTempSubNotes(newNotes.length > 0 ? newNotes : [{ description: '', amount: '' }]);
                                    }}
                                    className="px-3 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500/20"
                                >
                                    Hapus
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() => setTempSubNotes([...tempSubNotes, { description: '', amount: '' }])}
                        className="py-2.5 px-4 bg-background border border-app-border text-[9px] font-black uppercase tracking-widest text-accent rounded-xl hover:bg-surface transition-all"
                    >
                        + Tambah Baris Rincian
                    </button>
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
      {/* DETAIL MODAL */}
      {isDetailOpen && selectedCashFlow && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-black/95 backdrop-blur-xl">
          <div className="bg-surface border-t md:border border-app-border rounded-t-[3rem] md:rounded-[3.5rem] w-full max-w-lg shadow-2xl p-10 h-full md:h-auto overflow-y-auto animate-in slide-in-from-bottom md:zoom-in-95 duration-300">
             <div className="flex items-start justify-between mb-10">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-accent/20 text-accent rounded-[1.5rem] flex items-center justify-center">
                        <Info size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-foreground tracking-tight uppercase leading-none mb-2">Rincian Arus Kas</h2>
                        <p className="text-xs text-app-text-muted font-bold tracking-widest uppercase">Detail Lengkap Mutasi Kas</p>
                    </div>
                </div>
                <button onClick={() => setIsDetailOpen(false)} className="p-2 border border-app-border rounded-full hover:bg-background transition-colors text-app-text-muted">
                    <X size={24} />
                </button>
             </div>

             <div className="space-y-6">
                <div className="bg-background border border-app-border rounded-[2rem] p-6 space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b border-app-border/40">
                        <span className="text-[9px] font-black text-app-text-muted uppercase tracking-widest">Jenis Mutasi</span>
                        <span className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg tracking-wider ${selectedCashFlow.type === 'in' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                            {selectedCashFlow.type === 'in' ? 'Pemasukan (+)' : 'Pengeluaran (-)'}
                        </span>
                    </div>

                    <div className="flex justify-between items-center pb-3 border-b border-app-border/40">
                        <span className="text-[9px] font-black text-app-text-muted uppercase tracking-widest">Kategori</span>
                        <span className="text-xs font-black text-foreground uppercase tracking-wide">{categoryMap[selectedCashFlow.category]?.emoji || '📝'} {categoryMap[selectedCashFlow.category]?.label || selectedCashFlow.category}</span>
                    </div>

                    <div className="flex justify-between items-center pb-3 border-b border-app-border/40">
                        <span className="text-[9px] font-black text-app-text-muted uppercase tracking-widest">Nominal</span>
                        <span className={`text-lg font-black ${selectedCashFlow.type === 'in' ? 'text-emerald-500' : 'text-rose-500'}`}>
                            Rp {selectedCashFlow.amount.toLocaleString('id-ID')}
                        </span>
                    </div>

                    <div className="flex justify-between items-center pb-3 border-b border-app-border/40">
                        <span className="text-[9px] font-black text-app-text-muted uppercase tracking-widest">Dicatat Oleh</span>
                        <span className="text-xs font-bold text-foreground">{selectedCashFlow.userEmail || 'System'}</span>
                    </div>

                    <div className="flex justify-between items-center pb-3 border-b border-app-border/40">
                        <span className="text-[9px] font-black text-app-text-muted uppercase tracking-widest">Metode Bayar</span>
                        <span className="text-xs font-bold text-foreground uppercase">{selectedCashFlow.paymentMethod || '-'}</span>
                    </div>

                    <div className="flex justify-between items-center pb-3 border-b border-app-border/40">
                        <span className="text-[9px] font-black text-app-text-muted uppercase tracking-widest">Waktu</span>
                        <span className="text-xs font-bold text-foreground">
                            {selectedCashFlow.timestamp?.toDate 
                                ? selectedCashFlow.timestamp.toDate().toLocaleString('id-ID') 
                                : selectedCashFlow.timestamp instanceof Date 
                                    ? selectedCashFlow.timestamp.toLocaleString('id-ID') 
                                    : '-'}
                        </span>
                    </div>

                    {selectedCashFlow.linkedTransactionId && (
                        <div className="flex justify-between items-center pb-3 border-b border-app-border/40">
                            <span className="text-[9px] font-black text-app-text-muted uppercase tracking-widest">Terkait Transaksi</span>
                            <button 
                                type="button" 
                                onClick={() => fetchAndShowTransaction(selectedCashFlow.linkedTransactionId)}
                                className="text-xs font-black text-accent hover:underline focus:outline-none"
                            >
                                Ref: #{selectedCashFlow.linkedTransactionId.substring(0, 8)}
                            </button>
                        </div>
                    )}

                    {!selectedCashFlow.isManual && (
                        <div className="flex justify-between items-center pb-3 border-b border-app-border/40">
                            <span className="text-[9px] font-black text-app-text-muted uppercase tracking-widest">Detail Transaksi POS</span>
                            <button 
                                type="button" 
                                onClick={() => fetchAndShowTransaction(selectedCashFlow.id.split('_')[0])}
                                className="text-xs font-black text-accent hover:underline focus:outline-none"
                            >
                                Lihat Nota #{selectedCashFlow.id.split('_')[0].substring(0, 8)}
                            </button>
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <label className="text-[9px] font-black text-app-text-muted uppercase tracking-widest pl-2">Keterangan / Catatan Utama</label>
                    <div className="bg-background border border-app-border rounded-3xl p-5 text-sm font-bold text-foreground min-h-[4rem] whitespace-pre-line">
                        {selectedCashFlow.description || '-'}
                    </div>
                </div>

                {/* SUB NOTES / BREAKDOWN SECTION */}
                <div className="space-y-4 border-t border-app-border/40 pt-4">
                    <h3 className="text-[10px] font-black text-app-text-muted uppercase tracking-[0.2em]">Rincian Penggunaan Dana</h3>
                    
                    {selectedCashFlow.isManual ? (
                        /* Manual Cashflow: Editable Sub Notes */
                        <div className="space-y-3">
                            {detailSubNotes.map((note, idx) => (
                                <div key={idx} className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Rincian"
                                        value={note.description}
                                        onChange={e => {
                                            const newNotes = [...detailSubNotes];
                                            newNotes[idx].description = e.target.value;
                                            setDetailSubNotes(newNotes);
                                        }}
                                        className="flex-[2] px-4 py-3 bg-background border border-app-border rounded-2xl text-xs font-bold text-foreground focus:outline-none"
                                    />
                                    <input
                                        type="number"
                                        placeholder="Jumlah"
                                        value={note.amount}
                                        onChange={e => {
                                            const newNotes = [...detailSubNotes];
                                            newNotes[idx].amount = e.target.value;
                                            setDetailSubNotes(newNotes);
                                        }}
                                        className="flex-1 px-4 py-3 bg-background border border-app-border rounded-2xl text-xs font-bold text-foreground focus:outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const newNotes = detailSubNotes.filter((_, i) => i !== idx);
                                            setDetailSubNotes(newNotes.length > 0 ? newNotes : [{ description: '', amount: '' }]);
                                        }}
                                        className="px-3 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500/20 text-xs font-bold"
                                    >
                                        Hapus
                                    </button>
                                </div>
                            ))}

                            {(() => {
                                const subNotesSum = detailSubNotes.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
                                const diff = (Number(selectedCashFlow.amount) || 0) - subNotesSum;
                                return (
                                    <div className="space-y-1.5 mt-2">
                                        <div className="flex justify-between items-center px-4 py-2.5 bg-app-surface/60 border border-app-border/40 rounded-2xl">
                                            <span className="text-[10px] font-black uppercase text-app-text-muted">Total Rincian:</span>
                                            <span className="text-xs font-black text-foreground">Rp {subNotesSum.toLocaleString('id-ID')}</span>
                                        </div>
                                        <div className="flex justify-between items-center px-4 py-2.5 bg-app-surface/60 border border-app-border/40 rounded-2xl">
                                            <span className="text-[10px] font-black uppercase text-app-text-muted">Selisih:</span>
                                            <span className={`text-xs font-black ${diff === 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                Rp {diff.toLocaleString('id-ID')}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })()}
                            
                            <div className="flex justify-between items-center gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setDetailSubNotes([...detailSubNotes, { description: '', amount: '' }])}
                                    className="py-2 px-4 bg-background border border-app-border text-[9px] font-black uppercase tracking-widest text-accent rounded-xl hover:bg-surface transition-all"
                                >
                                    + Tambah Baris
                                </button>
                                <button
                                    type="button"
                                    disabled={isSavingSubNotes}
                                    onClick={() => handleSaveSubNotes(selectedCashFlow.id)}
                                    className="py-2 px-5 bg-accent text-foreground text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-accent-hover transition-all flex items-center gap-2"
                                >
                                    {isSavingSubNotes ? 'Menyimpan...' : 'Simpan Rincian'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* POS Transaction: View Only Purchased Items */
                        <div className="bg-background border border-app-border rounded-[2rem] p-5 space-y-3">
                            {isLoadingTrxDetails ? (
                                <div className="py-4 text-center text-xs text-app-text-muted font-bold uppercase tracking-widest animate-pulse">
                                    Memuat rincian keranjang POS...
                                </div>
                            ) : cashFlowTrxDetails?.items ? (
                                <div className="space-y-2">
                                    {cashFlowTrxDetails.items.map((item: any, idx: number) => (
                                        <div key={idx} className="flex justify-between text-xs pb-2 border-b border-app-border/20 last:border-0 last:pb-0">
                                            <div className="flex-1 pr-2">
                                                <p className="font-bold text-foreground">{item.productName}</p>
                                                <p className="text-[9px] text-app-text-muted font-black">{item.qty} x Rp {item.price?.toLocaleString('id-ID')}</p>
                                            </div>
                                            <span className="font-black text-foreground">Rp {item.subtotal?.toLocaleString('id-ID')}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-xs text-app-text-muted italic">Tidak ada rincian item POS.</div>
                            )}
                        </div>
                    )}
                </div>

                <button onClick={() => setIsDetailOpen(false)} className="w-full py-5 bg-background border border-app-border hover:bg-surface hover:text-foreground text-app-text-muted rounded-2xl font-black text-xs uppercase tracking-widest transition-all">
                    Tutup Rincian
                </button>
             </div>
          </div>
        </div>
      )}

      {/* TRANSACTION PREVIEW MODAL */}
      {isTrxDetailOpen && selectedTransaction && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-0 md:p-4 bg-black/95 backdrop-blur-xl">
          <div className="bg-surface border-t md:border border-app-border rounded-t-[3rem] md:rounded-[3.5rem] w-full max-w-lg shadow-2xl p-10 h-full md:h-auto overflow-y-auto animate-in slide-in-from-bottom md:zoom-in-95 duration-300">
             <div className="flex items-start justify-between mb-10">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-accent/20 text-accent rounded-[1.5rem] flex items-center justify-center">
                        <DollarSign size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-foreground tracking-tight uppercase leading-none mb-2">Detail Transaksi</h2>
                        <p className="text-xs text-app-text-muted font-bold tracking-widest uppercase">Nota Penjualan POS</p>
                    </div>
                </div>
                <button onClick={() => setIsTrxDetailOpen(false)} className="p-2 border border-app-border rounded-full hover:bg-background transition-colors text-app-text-muted">
                    <X size={24} />
                </button>
             </div>

             <div className="space-y-6">
                <div className="bg-background border border-app-border rounded-[2rem] p-6 space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b border-app-border/40">
                        <span className="text-[9px] font-black text-app-text-muted uppercase tracking-widest">Nomor Nota</span>
                        <span className="text-xs font-black text-foreground uppercase tracking-wide">#{selectedTransaction.id.substring(0, 8)}</span>
                    </div>

                    <div className="flex justify-between items-center pb-3 border-b border-app-border/40">
                        <span className="text-[9px] font-black text-app-text-muted uppercase tracking-widest">Pelanggan</span>
                        <span className="text-xs font-bold text-foreground">{selectedTransaction.customerName || 'Umum'}</span>
                    </div>

                    <div className="flex justify-between items-center pb-3 border-b border-app-border/40">
                        <span className="text-[9px] font-black text-app-text-muted uppercase tracking-widest">Kasir</span>
                        <span className="text-xs font-bold text-foreground">{selectedTransaction.cashierName || 'System'}</span>
                    </div>

                    <div className="flex justify-between items-center pb-3 border-b border-app-border/40">
                        <span className="text-[9px] font-black text-app-text-muted uppercase tracking-widest">Status Bayar</span>
                        <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-lg tracking-wider ${selectedTransaction.paymentStatus === 'paid' ? 'bg-emerald-500/10 text-emerald-500' : selectedTransaction.paymentStatus === 'partially_paid' ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'}`}>
                            {selectedTransaction.paymentStatus === 'paid' ? 'Lunas' : selectedTransaction.paymentStatus === 'partially_paid' ? 'Dicicil' : 'Hutang'}
                        </span>
                    </div>

                    <div className="flex justify-between items-center pb-3 border-b border-app-border/40">
                        <span className="text-[9px] font-black text-app-text-muted uppercase tracking-widest">Metode Pembayaran</span>
                        <span className="text-xs font-bold text-foreground uppercase">{selectedTransaction.paymentMethod || 'cash'}</span>
                    </div>

                    <div className="flex justify-between items-center pb-3 border-b border-app-border/40">
                        <span className="text-[9px] font-black text-app-text-muted uppercase tracking-widest">Waktu</span>
                        <span className="text-xs font-bold text-foreground">
                            {selectedTransaction.timestamp?.toDate 
                                ? selectedTransaction.timestamp.toDate().toLocaleString('id-ID') 
                                : selectedTransaction.timestamp 
                                    ? new Date(selectedTransaction.timestamp).toLocaleString('id-ID') 
                                    : '-'}
                        </span>
                    </div>

                    <div className="flex justify-between items-center pb-3 border-b border-app-border/40">
                        <span className="text-[9px] font-black text-app-text-muted uppercase tracking-widest">Total Pembelanjaan</span>
                        <span className="text-sm font-black text-foreground">
                            Rp {selectedTransaction.total?.toLocaleString('id-ID')}
                        </span>
                    </div>

                    <div className="flex justify-between items-center pb-3 border-b border-app-border/40">
                        <span className="text-[9px] font-black text-app-text-muted uppercase tracking-widest">Telah Dibayar</span>
                        <span className="text-sm font-black text-emerald-500">
                            Rp {selectedTransaction.paidAmount?.toLocaleString('id-ID')}
                        </span>
                    </div>

                    {selectedTransaction.paymentStatus !== 'paid' && selectedTransaction.debtAmount !== undefined && (
                        <div className="flex justify-between items-center pb-3 border-b border-app-border/40">
                            <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Sisa Bayar (Utang)</span>
                            <span className="text-sm font-black text-rose-500">
                                Rp {selectedTransaction.debtAmount?.toLocaleString('id-ID')}
                            </span>
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <label className="text-[9px] font-black text-app-text-muted uppercase tracking-widest pl-2">Keranjang Belanja</label>
                    <div className="bg-background border border-app-border rounded-[2rem] p-6 space-y-3">
                        {selectedTransaction.items && selectedTransaction.items.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-xs pb-3 border-b border-app-border/20 last:border-0 last:pb-0">
                                <div className="flex-1 pr-2">
                                    <p className="font-bold text-foreground">{item.productName}</p>
                                    <p className="text-[9px] text-app-text-muted font-black">{item.qty} x Rp {item.price?.toLocaleString('id-ID')}</p>
                                </div>
                                <span className="font-black text-foreground">Rp {item.subtotal?.toLocaleString('id-ID')}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <button onClick={() => setIsTrxDetailOpen(false)} className="w-full py-5 bg-background border border-app-border hover:bg-surface hover:text-foreground text-app-text-muted rounded-2xl font-black text-xs uppercase tracking-widest transition-all">
                    Tutup Detail Transaksi
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
