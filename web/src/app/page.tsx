'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/store/auth';
import { collection, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DollarSign, Package, ShoppingBag, TrendingUp, Users, Copy, Share2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Home() {
  const { user, role, storeId } = useAuthStore();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [customersCount, setCustomersCount] = useState(0);

  useEffect(() => {
    if (!storeId) return;

    const qTrx = query(
      collection(db, 'transactions'), 
      where('storeId', '==', storeId),
      orderBy('timestamp', 'desc')
    );
    const unsubTrx = onSnapshot(qTrx, (snap) => {
      const items: any[] = [];
      snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
      setTransactions(items);
    });

    const qCust = query(
      collection(db, 'customers'),
      where('storeId', '==', storeId)
    );
    const unsubCust = onSnapshot(qCust, (snap) => {
      setCustomersCount(snap.size);
    });

    return () => { unsubTrx(); unsubCust(); };
  }, [storeId]);

  const { totalPendapatan, totalProduk, topProducts } = useMemo(() => {
    let rev = 0;
    let qty = 0;
    let productMap: Record<string, {name: string, qty: number}> = {};

    transactions.forEach(trx => {
      rev += (trx.total || 0);
      trx.items?.forEach((item: any) => {
        qty += item.qty;
        if (!productMap[item.productId]) {
          productMap[item.productId] = { name: item.productName, qty: 0 };
        }
        productMap[item.productId].qty += item.qty;
      });
    });

    const top = Object.values(productMap).sort((a,b) => b.qty - a.qty).slice(0, 5);

    return { totalPendapatan: rev, totalProduk: qty, topProducts: top };
  }, [transactions]);

  const stats = [
    { name: 'Total Pendapatan', value: `Rp ${totalPendapatan.toLocaleString('id-ID')}`, icon: DollarSign, change: 'Realtime', positive: true },
    { name: 'Total Transaksi', value: transactions.length.toLocaleString(), icon: ShoppingBag, change: 'Realtime', positive: true },
    { name: 'Produk Terjual', value: totalProduk.toLocaleString(), icon: Package, change: 'Realtime', positive: true },
    { name: 'Total Pelanggan', value: customersCount.toLocaleString(), icon: Users, change: 'Realtime', positive: true },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">Dashboard</h1>
          <p className="text-xs md:text-sm text-app-text-muted mt-2 font-medium">Selamat datang kembali, <span className="text-accent font-bold">{user?.email}</span> 👋</p>
        </div>
      </div>

      {/* SHARE STORE LINK CARD */}
      <div className="bg-gradient-to-br from-accent/5 to-accent/10 border border-accent/20 rounded-[2rem] p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-6 group hover:border-accent/40 transition-all duration-500 shadow-xl shadow-accent/5">
        <div className="flex items-center gap-5 w-full md:w-auto">
          <div className="w-16 h-16 rounded-2xl bg-accent text-foreground flex items-center justify-center shadow-lg shadow-accent/30 group-hover:scale-110 transition-transform duration-500">
            <ShoppingBag size={32} />
          </div>
          <div>
            <h2 className="text-xl font-black text-foreground tracking-tight">Link Pemesanan Online</h2>
            <p className="text-xs text-app-text-muted font-medium mt-1">Bagikan link ini ke pelanggan agar mereka dapat memesan produk Anda secara mandiri.</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="flex-1 md:w-64 bg-background/50 border border-app-border rounded-xl px-4 py-3 text-xs font-bold text-app-text-muted truncate select-all">
            {typeof window !== 'undefined' ? `${window.location.origin}/tr?s=${storeId}` : 'Loading link...'}
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button 
              onClick={() => {
                const url = `${window.location.origin}/tr?s=${storeId}`;
                navigator.clipboard.writeText(url);
                toast.success('Link pemesanan berhasil disalin!');
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-surface border border-app-border hover:border-accent hover:text-accent text-foreground rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95"
            >
              <Copy size={14} /> Salin
            </button>
            <button 
              onClick={() => {
                const url = `${window.location.origin}/tr?s=${storeId}`;
                if (navigator.share) {
                  navigator.share({
                    title: 'Toko Online Kami',
                    text: 'Silakan kunjungi toko online kami untuk memesan produk favorit Anda!',
                    url: url
                  }).catch(console.error);
                } else {
                  window.open(url, '_blank');
                }
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-accent text-foreground rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-accent/20 hover:bg-accent-hover transition-all active:scale-95"
            >
              <Share2 size={14} /> Bagikan
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-surface border border-app-border rounded-2xl md:rounded-[2rem] p-4 md:p-8 shadow-xl shadow-black/5 hover:border-accent/30 transition-all group active:scale-95 duration-300">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-background border border-app-border flex items-center justify-center shadow-inner group-hover:bg-accent/10 group-hover:border-accent/30 transition-all">
                <stat.icon className="w-5 h-5 md:w-7 md:h-7 text-accent" />
              </div>
              <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black border ${stat.positive ? 'bg-emerald-400/10 border-emerald-400/20 text-emerald-400' : 'bg-rose-400/10 border-rose-400/20 text-rose-400'}`}>
                {stat.change}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black text-app-text-muted mb-1 md:mb-2 uppercase tracking-widest">{stat.name}</p>
              <h3 className="text-lg md:text-3xl font-black text-foreground tracking-tight truncate">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-surface border border-app-border rounded-[2.5rem] p-8 shadow-xl shadow-black/5 min-h-[450px] flex flex-col transition-colors duration-300">
          <h2 className="text-xl font-black text-foreground mb-8 uppercase tracking-wider flex items-center gap-3">
             <div className="w-2 h-8 bg-accent rounded-full"></div>
             Grafik Penjualan
          </h2>
          <div className="flex-1 flex items-center justify-center border-4 border-dashed border-app-border/50 rounded-[2rem] bg-background/50">
            <div className="text-center group">
               <TrendingUp className="w-16 h-16 text-app-text-muted mx-auto mb-4 opacity-20 group-hover:scale-110 group-hover:text-accent group-hover:opacity-100 transition-all duration-500" />
               <p className="text-app-text-muted font-bold italic">Integrasi Grafik ke Laporan Omzet</p>
            </div>
          </div>
        </div>

        <div className="bg-surface border border-app-border rounded-[2.5rem] p-8 shadow-xl shadow-black/5 flex flex-col transition-colors duration-300">
          <h2 className="text-xl font-black text-foreground mb-8 uppercase tracking-wider">Top 5 Produk</h2>
          <div className="flex-1 flex flex-col gap-6">
            {topProducts.length === 0 ? (
               <div className="text-center text-app-text-muted font-bold text-sm mt-10 opacity-50">Belum ada barang terjual</div>
            ) : topProducts.map((item, index) => (
              <div key={index} className="flex items-center gap-5 group cursor-pointer">
                <div className="w-14 h-14 rounded-2xl bg-background border border-app-border flex-shrink-0 relative overflow-hidden shadow-inner group-hover:border-accent transition-colors">
                  <div className="absolute inset-0 bg-accent/5 animate-pulse"></div>
                  <Package className="absolute inset-0 m-auto w-6 h-6 text-app-text-muted opacity-20 group-hover:text-accent group-hover:opacity-100 transition-all" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-foreground truncate group-hover:text-accent transition-colors">{item.name}</p>
                  <p className="text-[10px] text-app-text-muted font-bold uppercase tracking-widest mt-0.5">Penjualan Teratas</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-black text-foreground">{item.qty} <span className="text-[10px] text-app-text-muted font-bold tracking-tighter">PCS</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
