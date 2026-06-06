'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, where, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Transaction } from '@/types';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Activity, TrendingUp, Package, Loader2, Calendar, Trash2, AlertTriangle, X } from 'lucide-react';
import { useAuthStore } from '@/store/auth';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function SoldPage() {
  const { storeId } = useAuthStore();
  const [rawTransactions, setRawTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clearedAt, setClearedAt] = useState<Date | null>(null);
  
  // Filters
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  
  // Reset state
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Generate year options based on current year (last 5 years)
  const currentYear = new Date().getFullYear();
  const years = Array.from({length: 5}, (_, i) => (currentYear - i).toString());

  useEffect(() => {
    if (!storeId) return;

    // Fetch settings for clearedAt
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', `store_${storeId}`);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().salesAnalyticsClearedAt) {
          setClearedAt(docSnap.data().salesAnalyticsClearedAt.toDate());
        }
      } catch (err) {
        console.error("Failed to fetch settings", err);
      }
    };
    fetchSettings();

    // Fetch transactions
    const q = query(collection(db, 'transactions'), where('storeId', '==', storeId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allTrx: Transaction[] = [];
      snapshot.forEach(d => allTrx.push(d.data() as Transaction));
      setRawTransactions(allTrx);
      setIsLoading(false);
    }, (err) => {
      console.error(err);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [storeId]);

  const soldItems = useMemo(() => {
    const itemsMap: Record<string, {name: string, qty: number, total: number}> = {};
    
    rawTransactions.forEach(trx => {
      if (trx.paymentStatus !== 'paid') return; // only paid items

      const trxDate = trx.timestamp?.toDate ? trx.timestamp.toDate() : new Date(trx.timestamp);
      
      // Filter by clearedAt
      if (clearedAt && trxDate < clearedAt) return;
      
      // Filter by Month & Year
      if (selectedMonth !== 'all') {
        if (trxDate.getMonth() !== parseInt(selectedMonth) || trxDate.getFullYear() !== parseInt(selectedYear)) return;
      } else {
        if (trxDate.getFullYear() !== parseInt(selectedYear)) return;
      }

      trx.items?.forEach(item => {
        if (!itemsMap[item.productId]) {
          itemsMap[item.productId] = { name: item.productName, qty: 0, total: 0 };
        }
        itemsMap[item.productId].qty += item.qty;
        itemsMap[item.productId].total += (item.qty * item.price);
      });
    });

    return Object.values(itemsMap).sort((a, b) => b.qty - a.qty);
  }, [rawTransactions, clearedAt, selectedMonth, selectedYear]);

  const totalSoldQty = soldItems.reduce((sum, item) => sum + item.qty, 0);

  const handleReset = async () => {
    if (!storeId) return;
    setIsResetting(true);
    try {
      const now = new Date();
      const docRef = doc(db, 'settings', `store_${storeId}`);
      await setDoc(docRef, { salesAnalyticsClearedAt: now }, { merge: true });
      setClearedAt(now);
      setShowResetConfirm(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-surface/50 backdrop-blur-xl border border-app-border p-6 rounded-3xl shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight uppercase bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60">
            Analisis Produk Terjual
          </h1>
          <p className="text-app-text-muted mt-2 font-medium max-w-xl">
            Pantau performa barang keluar dengan elegan. Data yang ditampilkan telah disesuaikan dengan rentang waktu yang Anda pilih.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex bg-background border border-app-border rounded-xl p-1 shadow-inner">
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-sm font-bold text-foreground px-3 py-2 outline-none cursor-pointer"
            >
              <option value="all">Semua Bulan</option>
              {MONTHS.map((m, idx) => (
                <option key={idx} value={idx}>{m}</option>
              ))}
            </select>
            <div className="w-px bg-app-border/50 my-2 mx-1" />
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent text-sm font-bold text-foreground px-3 py-2 outline-none cursor-pointer"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-xl transition-all font-bold text-sm uppercase tracking-wider"
          >
            <Trash2 size={16} />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-surface border border-app-border rounded-3xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-rose-400" />
            
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-6 border border-rose-500/20">
              <AlertTriangle className="w-8 h-8 text-rose-500" />
            </div>
            
            <h3 className="text-xl font-black text-foreground uppercase tracking-tight mb-2">Reset Analitik Terjual?</h3>
            <p className="text-sm text-app-text-muted mb-6 leading-relaxed font-medium">
              Aksi ini akan mengatur ulang penghitungan barang terjual mulai dari detik ini. Data historis di grafik ini akan dikosongkan. 
              <br/><br/>
              <strong className="text-amber-500">Catatan:</strong> Data Transaksi & Keuangan asli Anda <strong className="text-emerald-500">TIDAK</strong> akan terhapus.
            </p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-app-border text-foreground font-bold hover:bg-background transition-colors uppercase text-sm tracking-wider"
              >
                Batal
              </button>
              <button 
                onClick={handleReset}
                disabled={isResetting}
                className="flex-1 py-3 px-4 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold transition-colors flex items-center justify-center gap-2 uppercase text-sm tracking-wider"
              >
                {isResetting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ya, Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32 text-app-text-muted">
          <Loader2 className="w-10 h-10 animate-spin mb-6 text-accent" />
          <p className="font-black text-sm uppercase tracking-widest text-accent">Menganalisis Jutaan Piksel...</p>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="relative overflow-hidden bg-gradient-to-br from-surface to-background border border-app-border rounded-[2rem] p-8 shadow-lg group hover:border-accent/50 transition-all">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-colors" />
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-accent/10 text-accent rounded-2xl">
                  <Package size={24} />
                </div>
                <h3 className="text-xs font-black uppercase tracking-widest text-app-text-muted">Total Barang Keluar</h3>
              </div>
              <p className="text-5xl font-black text-foreground tracking-tighter">
                {totalSoldQty.toLocaleString('id-ID')}
                <span className="text-sm font-black text-app-text-muted uppercase tracking-widest ml-2">Unit</span>
              </p>
            </div>

            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500/10 via-surface to-background border border-emerald-500/20 rounded-[2rem] p-8 shadow-lg group hover:border-emerald-500/50 transition-all">
              <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-colors" />
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-emerald-500/20 text-emerald-500 rounded-2xl">
                  <TrendingUp size={24} />
                </div>
                <h3 className="text-xs font-black uppercase tracking-widest text-emerald-500/70">Varian Paling Laku</h3>
              </div>
              <p className="text-2xl font-black text-emerald-500 line-clamp-1 mb-1">
                {soldItems[0]?.name || 'Belum ada data'}
              </p>
              <p className="text-sm font-black text-app-text-muted uppercase tracking-widest">
                {soldItems[0]?.qty || 0} Terjual
              </p>
            </div>

            <div className="relative overflow-hidden bg-gradient-to-br from-surface to-background border border-app-border rounded-[2rem] p-8 shadow-lg group hover:border-blue-500/50 transition-all">
              <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors" />
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-blue-500/10 text-blue-500 rounded-2xl">
                  <Activity size={24} />
                </div>
                <h3 className="text-xs font-black uppercase tracking-widest text-app-text-muted">Katalog Teraktif</h3>
              </div>
              <p className="text-5xl font-black text-foreground tracking-tighter">
                {soldItems.length.toLocaleString('id-ID')}
                <span className="text-sm font-black text-app-text-muted uppercase tracking-widest ml-2">Jenis</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Chart Section */}
            <div className="xl:col-span-2 bg-surface/80 backdrop-blur-md border border-app-border rounded-[2rem] p-8 shadow-lg">
              <div className="flex items-center justify-between mb-8">
                 <div>
                   <h3 className="text-2xl font-black text-foreground uppercase tracking-tighter">Top 7 Terlaris</h3>
                   <p className="text-xs text-app-text-muted font-bold mt-1 uppercase tracking-widest">Visualisasi Performa Penjualan</p>
                 </div>
                 <div className="px-4 py-2 bg-accent/10 border border-accent/20 rounded-full text-xs font-black text-accent uppercase tracking-widest flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                   Live Data
                 </div>
              </div>
              <div className="h-[360px] w-full">
                {soldItems.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={soldItems.slice(0, 7)} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border)" horizontal={false} opacity={0.3} />
                      <XAxis type="number" stroke="var(--app-text-muted)" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} />
                      <YAxis dataKey="name" type="category" stroke="var(--app-text-muted)" fontSize={11} fontWeight="bold" tickLine={false} axisLine={false} width={120} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(var(--bg-surface-rgb), 0.8)', 
                          backdropFilter: 'blur(12px)',
                          borderColor: 'var(--app-border)', 
                          borderRadius: '16px', 
                          border: '1px solid var(--app-border)', 
                          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' 
                        }}
                        itemStyle={{ color: 'var(--foreground)', fontWeight: '900', fontSize: '14px' }}
                        labelStyle={{ color: 'var(--app-text-muted)', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}
                        cursor={{fill: 'var(--bg-background)', opacity: 0.5}}
                      />
                      <Bar dataKey="qty" name="Unit Terjual" radius={[0, 12, 12, 0]} barSize={32}>
                        {soldItems.slice(0, 7).map((entry, index) => {
                          const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6'];
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-app-text-muted opacity-40 gap-4">
                    <Package size={64} className="opacity-50" />
                    <p className="text-sm font-black uppercase tracking-widest">Tidak ada data untuk periode ini</p>
                  </div>
                )}
              </div>
            </div>

            {/* List Section */}
            <div className="bg-surface/80 backdrop-blur-md border border-app-border rounded-[2rem] overflow-hidden flex flex-col shadow-lg">
              <div className="p-8 border-b border-app-border bg-gradient-to-b from-background/50 to-transparent flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-foreground uppercase tracking-tighter">Papan Peringkat</h3>
                  <p className="text-[10px] text-app-text-muted font-bold mt-1 uppercase tracking-widest">Detail Semua Varian</p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-background border border-app-border flex items-center justify-center text-app-text-muted">
                   <TrendingUp size={20} />
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto max-h-[400px] p-2">
                {soldItems.length > 0 ? (
                  <div className="space-y-2">
                    {soldItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 rounded-2xl hover:bg-background transition-colors group border border-transparent hover:border-app-border">
                        <div className="flex items-center gap-4">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${
                            idx === 0 ? 'bg-emerald-500/10 text-emerald-500' :
                            idx === 1 ? 'bg-amber-500/10 text-amber-500' :
                            idx === 2 ? 'bg-amber-700/10 text-amber-700' :
                            'bg-background text-app-text-muted'
                          }`}>
                            {idx + 1}
                          </div>
                          <div>
                            <h4 className="text-sm text-foreground font-black group-hover:text-accent transition-colors line-clamp-1">{item.name}</h4>
                            <p className="text-[10px] text-app-text-muted font-bold mt-0.5">Total Omzet: Rp {item.total.toLocaleString('id-ID')}</p>
                          </div>
                        </div>
                        <div className="text-right pl-4">
                          <p className="text-lg text-emerald-500 font-black tracking-tighter">{item.qty}</p>
                          <p className="text-[8px] text-app-text-muted uppercase tracking-widest font-bold">Terjual</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="w-full h-full min-h-[200px] flex items-center justify-center">
                    <p className="text-xs text-app-text-muted font-bold uppercase tracking-widest opacity-50">List Kosong</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
