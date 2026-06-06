'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth';
import { Star, Loader2, Award, Download, TrendingUp, Package, DollarSign, ChevronRight, Medal } from 'lucide-react';
import { exportToExcel } from '@/lib/exportToExcel';

export default function BestSellersReportPage() {
  const { storeId } = useAuthStore();
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;

    const q = query(
      collection(db, 'transactions'), 
      where('storeId', '==', storeId),
      orderBy('timestamp', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const trxs: any[] = [];
      snapshot.forEach(doc => trxs.push({ id: doc.id, ...doc.data() }));
      setData(trxs);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [storeId]);

  const bestSellers = useMemo(() => {
    const stats: Record<string, { id: string; name: string; qty: number; revenue: number; unit?: string }> = {};
    
    data.forEach(trx => {
      trx.items?.forEach((item: any) => {
        if (!stats[item.productId]) {
          stats[item.productId] = { 
            id: item.productId, 
            name: item.productName, 
            qty: 0, 
            revenue: 0,
            unit: item.unit || 'PCS'
          };
        }
        stats[item.productId].qty += item.qty;
        stats[item.productId].revenue += (item.price * item.qty);
      });
    });

    return Object.values(stats)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 50); // Top 50
  }, [data]);

  const handleExport = () => {
    const formattedData = bestSellers.map((item, idx) => ({
      'Peringkat': idx + 1,
      'Nama Produk': item.name,
      'Total Terjual (Qty)': item.qty,
      'Satuan': item.unit,
      'Estimasi Omzet (Rp)': item.revenue,
    }));
    exportToExcel(formattedData, 'Laporan_Produk_Terlaris');
  };

  const topThree = bestSellers.slice(0, 3);
  const others = bestSellers.slice(3);

  return (
    <div className="space-y-6 md:space-y-8 max-w-6xl mx-auto pb-10">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="bg-accent/20 p-1.5 rounded-lg">
                <TrendingUp className="text-accent" size={20} />
            </div>
            <h1 className="text-2xl md:text-4xl font-black text-foreground tracking-tighter uppercase leading-none">Produk Terlaris</h1>
          </div>
          <p className="text-[10px] md:text-sm text-app-text-muted font-bold uppercase tracking-[0.2em] opacity-70">Analisis Pergerakan Katalog & Ranking Inventaris</p>
        </div>
        
        <button 
          onClick={handleExport}
          disabled={bestSellers.length === 0}
          className="group flex items-center justify-center gap-3 bg-background border-2 border-emerald-500/20 hover:border-emerald-500 hover:bg-emerald-500 text-emerald-500 hover:text-white px-6 py-3 md:py-4 rounded-2xl font-black shadow-xl shadow-emerald-500/5 transition-all active:scale-95 disabled:opacity-50 text-[11px] uppercase tracking-widest"
        >
          <Download size={18} className="group-hover:bounce" /> Export EXCEL
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
           <Loader2 className="w-12 h-12 animate-spin text-accent" />
           <p className="text-[10px] font-black text-app-text-muted uppercase tracking-[0.3em] animate-pulse">Sinkronisasi Riwayat...</p>
        </div>
      ) : bestSellers.length === 0 ? (
        <div className="bg-surface border-2 border-dashed border-app-border rounded-[2.5rem] p-20 text-center flex flex-col items-center justify-center gap-4">
            <Star className="text-app-text-muted opacity-20" size={64} />
            <p className="text-app-text-muted font-black uppercase tracking-widest text-sm">Belum ada data transaksi untuk dihitung</p>
        </div>
      ) : (
        <>
          {/* TOP 3 SPOTLIGHT CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 px-1">
            {topThree.map((item, idx) => (
              <div 
                key={item.id}
                className={`relative overflow-hidden group bg-surface border border-app-border rounded-[2rem] p-6 shadow-2xl transition-all hover:-translate-y-2 duration-500 ${
                  idx === 0 ? 'border-yellow-500/30' : idx === 1 ? 'border-slate-400/30' : 'border-amber-600/30'
                }`}
              >
                {/* Visual Rank Background Badge */}
                <div className={`absolute -right-6 -top-6 rounded-full w-32 h-32 opacity-[0.03] flex items-center justify-center pointer-events-none group-hover:scale-110 transition-transform duration-700 ${
                    idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-slate-400' : 'bg-amber-600'
                }`}>
                    <Award size={80} />
                </div>

                <div className="flex items-start justify-between mb-4">
                   <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg ${
                      idx === 0 ? 'bg-yellow-500 text-black shadow-yellow-500/20' : 
                      idx === 1 ? 'bg-slate-400 text-black shadow-slate-400/20' : 
                      'bg-amber-700 text-white shadow-amber-700/20'
                   }`}>
                      <Medal size={14} /> Juara {idx + 1}
                   </div>
                   <div className="bg-background/50 p-2 rounded-xl border border-app-border">
                      <TrendingUp size={16} className="text-accent" />
                   </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-xl md:text-2xl font-black text-foreground tracking-tighter leading-tight line-clamp-2 min-h-[3.5rem]">{item.name}</h3>
                    
                    <div className="flex items-center gap-6">
                        <div className="space-y-1">
                           <p className="text-[9px] font-black text-app-text-muted uppercase tracking-widest">Terjual</p>
                           <p className="text-2xl font-black text-foreground tracking-tighter">{item.qty} <span className="text-[10px] opacity-40 uppercase">{item.unit || 'PCS'}</span></p>
                        </div>
                        <div className="w-px h-8 bg-app-border opacity-50" />
                        <div className="space-y-1">
                           <p className="text-[9px] font-black text-app-text-muted uppercase tracking-widest">Revenue</p>
                           <p className="text-lg font-black text-emerald-400 tracking-tighter">Rp {item.revenue.toLocaleString('id-ID')}</p>
                        </div>
                    </div>
                </div>
              </div>
            ))}
          </div>

          {/* MAIN LIST SECTION */}
          <div className="bg-surface border border-app-border rounded-[2.5rem] overflow-hidden shadow-2xl transition-all duration-300">
            <div className="p-6 md:p-8 border-b border-app-border bg-background/30 flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className="bg-accent/10 p-2 rounded-xl">
                      <Star className="text-accent" size={18} />
                   </div>
                   <h3 className="text-[11px] font-black text-foreground uppercase tracking-[0.2em]">Peringkat Selengkapnya</h3>
                </div>
                <div className="px-3 py-1 bg-accent/10 border border-accent/20 rounded-full text-[9px] font-black text-accent uppercase tracking-widest">Top 50 Katalog</div>
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-background/10 text-app-text-muted text-[10px] font-black uppercase tracking-[0.2em] border-b border-app-border">
                      <th className="p-6 w-24 text-center">Rank</th>
                      <th className="p-6">Detail Produk</th>
                      <th className="p-6 text-center">Volume Jual</th>
                      <th className="p-6 text-right">Potensi Omzet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border/40">
                    {bestSellers.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-accent/5 transition-all duration-300 group">
                        <td className="p-6 text-center">
                          <div className={`text-lg font-black tracking-tighter ${idx < 3 ? 'text-accent' : 'text-app-text-muted opacity-50'}`}>
                            #{idx + 1}
                          </div>
                        </td>
                        <td className="p-6">
                            <div className="flex items-center gap-4">
                               <div className="w-10 h-10 rounded-xl bg-background border border-app-border flex items-center justify-center text-[10px] font-black text-app-text-muted group-hover:border-accent group-hover:text-accent transition-all uppercase">
                                  {item.name.substring(0,2)}
                               </div>
                               <div className="font-bold text-foreground group-hover:translate-x-1 transition-transform">{item.name}</div>
                            </div>
                        </td>
                        <td className="p-6 text-center">
                           <div className="inline-flex items-center gap-2 bg-background/50 px-4 py-2 rounded-xl border border-app-border group-hover:border-accent/30 group-hover:bg-accent/5 transition-all">
                              <Package size={14} className="text-app-text-muted group-hover:text-accent" />
                              <span className="text-sm font-black text-foreground">{item.qty} <span className="text-[10px] text-app-text-muted ml-0.5 lowercase group-hover:text-foreground">{item.unit || 'pcs'}</span></span>
                           </div>
                        </td>
                        <td className="p-6 text-right">
                            <div className="flex flex-col items-end">
                                <span className="text-lg font-black text-emerald-400 tracking-tighter group-hover:scale-105 transition-transform duration-300">Rp {item.revenue.toLocaleString('id-ID')}</span>
                                <span className="text-[8px] font-black uppercase tracking-widest text-app-text-muted opacity-0 group-hover:opacity-100 transition-opacity">Gross Estimated</span>
                            </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            </div>

            {/* Mobile Card-List View */}
            <div className="md:hidden divide-y divide-app-border/40 bg-background/20">
              {bestSellers.map((item, idx) => (
                <div 
                  key={item.id} 
                  className={`p-5 flex items-center gap-4 relative active:bg-accent/10 transition-colors animate-in fade-in slide-in-from-left duration-500`}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  {/* Rank Badge */}
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 border-2 ${
                    idx === 0 ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-500' :
                    idx === 1 ? 'bg-slate-400/10 border-slate-400/40 text-slate-400' :
                    idx === 2 ? 'bg-amber-700/10 border-amber-700/40 text-amber-600' :
                    'bg-background border-app-border text-app-text-muted'
                  }`}>
                    #{idx + 1}
                  </div>

                  <div className="flex-1 min-w-0 pr-2">
                    <h4 className="font-black text-foreground text-sm tracking-tight leading-tight mb-2 truncate">{item.name}</h4>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 bg-background px-2.5 py-1 rounded-lg border border-app-border">
                           <Package size={10} className="text-accent" />
                           <span className="text-[11px] font-black text-foreground">{item.qty} <span className="text-[10px] text-app-text-muted opacity-60 ml-0.5 lowercase">{item.unit || 'pcs'}</span></span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                           <DollarSign size={10} className="text-emerald-500" />
                           <span className="text-xs font-black text-emerald-500 tracking-tighter">Rp {item.revenue.toLocaleString('id-ID')}</span>
                        </div>
                    </div>
                  </div>

                  <div className="text-app-text-muted opacity-30">
                    <ChevronRight size={18} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 text-center">
             <p className="text-[9px] font-black text-app-text-muted uppercase tracking-[0.4em]">Akhir Dari Laporan Top 50</p>
          </div>
        </>
      )}
    </div>
  );
}
